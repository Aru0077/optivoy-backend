import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomInt, randomUUID, createHash } from 'crypto';
import type { StringValue } from 'ms';
import {
  AppRedisClient,
  createAppRedisClient,
} from '../../common/redis/redis-client.factory';
import { AuthConfig } from '../../config/auth.config';
import { RedisConfig } from '../../config/redis.config';
import { AdminService } from '../admin/admin.service';
import { Admin } from '../admin/entities/admin.entity';
import { EmailService } from './email.service';
import { RateLimitService } from './rate-limit/rate-limit.service';

interface AdminTwoFactorChallengeRecord {
  adminId: string;
  email: string;
  codeHash: string;
  expiresAt: number;
}

interface AdminTwoFactorChallengePayload {
  typ: 'admin-2fa';
  cid: string;
  sub: string;
  email: string;
}

export interface AdminLoginChallengeResponse {
  requiresTwoFactor: true;
  challengeToken: string;
  message: string;
}

@Injectable()
export class AdminTwoFactorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AdminTwoFactorService.name);
  private redisClient: AppRedisClient | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly adminService: AdminService,
    private readonly emailService: EmailService,
    private readonly rateLimitService: RateLimitService,
  ) {}

  async onModuleInit(): Promise<void> {
    const redis = this.configService.get<RedisConfig>('redis');
    if (!redis?.enabled) {
      throw new Error('Admin 2FA requires Redis to be enabled.');
    }

    const client = createAppRedisClient({
      host: redis.host,
      port: redis.port,
      password: redis.password || undefined,
      db: redis.db,
    });

    try {
      await client.connect();
      await client.ping();
      this.redisClient = client;
    } catch (error) {
      this.logger.error(
        `Admin 2FA Redis initialization failed: ${(error as Error).message}`,
      );
      await client.disconnect().catch(() => undefined);
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.redisClient) {
      return;
    }
    await this.redisClient.quit().catch(() => undefined);
    this.redisClient = null;
  }

  async issueChallenge(admin: Admin): Promise<AdminLoginChallengeResponse> {
    const auth = this.configService.get<AuthConfig>('auth')!;
    const ttlSeconds = auth.admin.twoFactorTtlMinutes * 60;
    const challengeId = randomUUID();
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const expiresAt = Date.now() + ttlSeconds * 1000;
    const record: AdminTwoFactorChallengeRecord = {
      adminId: admin.id,
      email: admin.email,
      codeHash: createHash('sha256').update(code).digest('hex'),
      expiresAt,
    };

    await this.storeChallenge(challengeId, record, ttlSeconds);

    try {
      await this.emailService.sendAdminTwoFactorCode(admin.email, code);
    } catch (error) {
      await this.deleteChallenge(challengeId).catch((cleanupError: unknown) => {
        this.logger.error(
          `Failed to cleanup admin 2FA challenge ${challengeId}: ${
            (cleanupError as Error).message
          }`,
        );
      });
      throw error;
    }

    const challengeToken = this.jwtService.sign(
      {
        typ: 'admin-2fa',
        cid: challengeId,
        sub: admin.id,
        email: admin.email,
      } satisfies AdminTwoFactorChallengePayload,
      {
        secret: this.resolveChallengeSecret(auth),
        expiresIn: `${auth.admin.twoFactorTtlMinutes}m` as StringValue,
      },
    );

    return {
      requiresTwoFactor: true,
      challengeToken,
      message: 'Verification code sent to admin email address.',
    };
  }

  async verifyChallenge(challengeToken: string, code: string): Promise<Admin> {
    if (!code) {
      throw new UnauthorizedException(
        'Invalid or expired admin verification code',
      );
    }

    const payload = this.verifyChallengeToken(challengeToken);
    const record = await this.readChallenge(payload.cid);
    if (!record || record.expiresAt <= Date.now()) {
      throw new UnauthorizedException(
        'Invalid or expired admin verification code',
      );
    }
    if (record.adminId !== payload.sub || record.email !== payload.email) {
      await this.deleteChallenge(payload.cid);
      throw new UnauthorizedException(
        'Invalid or expired admin verification code',
      );
    }

    const codeHash = createHash('sha256').update(code).digest('hex');
    if (codeHash !== record.codeHash) {
      const ttlSeconds = Math.max(
        Math.ceil((record.expiresAt - Date.now()) / 1000),
        1,
      );
      const attemptKey = this.buildAttemptKey(payload.cid);
      const result = await this.rateLimitService.consumeKey(
        attemptKey,
        5,
        ttlSeconds,
      );
      if (result.remaining === 0) {
        await this.rateLimitService.resetKey(attemptKey);
        await this.deleteChallenge(payload.cid);
      }
      throw new UnauthorizedException(
        'Invalid or expired admin verification code',
      );
    }

    await this.rateLimitService.resetKey(this.buildAttemptKey(payload.cid));
    await this.deleteChallenge(payload.cid);

    const admin = await this.adminService.findById(payload.sub);
    if (!admin || admin.email !== payload.email) {
      throw new UnauthorizedException(
        'Invalid or expired admin verification code',
      );
    }

    return admin;
  }

  private verifyChallengeToken(token: string): AdminTwoFactorChallengePayload {
    const auth = this.configService.get<AuthConfig>('auth')!;
    let decoded: unknown;
    try {
      decoded = this.jwtService.verify(token, {
        secret: this.resolveChallengeSecret(auth),
      });
    } catch {
      throw new UnauthorizedException(
        'Invalid or expired admin verification code',
      );
    }

    if (
      typeof decoded !== 'object' ||
      !decoded ||
      (decoded as Record<string, unknown>).typ !== 'admin-2fa'
    ) {
      throw new UnauthorizedException(
        'Invalid or expired admin verification code',
      );
    }

    return decoded as AdminTwoFactorChallengePayload;
  }

  private async storeChallenge(
    challengeId: string,
    record: AdminTwoFactorChallengeRecord,
    ttlSeconds: number,
  ): Promise<void> {
    const redisClient = this.requireRedisClient();
    try {
      await redisClient.set(
        this.buildChallengeKey(challengeId),
        JSON.stringify(record),
        { EX: ttlSeconds },
      );
    } catch (error) {
      this.logger.error(
        `Failed to write admin 2FA challenge ${challengeId}: ${(error as Error).message}`,
      );
      throw new ServiceUnavailableException('Admin 2FA storage unavailable');
    }
  }

  private async readChallenge(
    challengeId: string,
  ): Promise<AdminTwoFactorChallengeRecord | null> {
    const redisClient = this.requireRedisClient();
    try {
      const raw = await redisClient.get(this.buildChallengeKey(challengeId));
      if (!raw) {
        return null;
      }
      return JSON.parse(raw) as AdminTwoFactorChallengeRecord;
    } catch (error) {
      this.logger.error(
        `Failed to read admin 2FA challenge ${challengeId}: ${(error as Error).message}`,
      );
      throw new ServiceUnavailableException('Admin 2FA storage unavailable');
    }
  }

  private async deleteChallenge(challengeId: string): Promise<void> {
    const redisClient = this.requireRedisClient();
    try {
      await redisClient.del(this.buildChallengeKey(challengeId));
    } catch (error) {
      this.logger.error(
        `Failed to delete admin 2FA challenge ${challengeId}: ${(error as Error).message}`,
      );
      throw new ServiceUnavailableException('Admin 2FA storage unavailable');
    }
  }

  private buildChallengeKey(challengeId: string): string {
    return `auth:admin-2fa:challenge:${challengeId}`;
  }

  private buildAttemptKey(challengeId: string): string {
    return `auth:admin-2fa:attempts:${challengeId}`;
  }

  private resolveChallengeSecret(auth: AuthConfig): string {
    return auth.admin.twoFactorSecret;
  }

  private requireRedisClient(): AppRedisClient {
    if (!this.redisClient) {
      throw new ServiceUnavailableException('Admin 2FA storage unavailable');
    }
    return this.redisClient;
  }
}
