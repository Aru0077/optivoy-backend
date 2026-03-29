import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes, createHash, randomInt, randomUUID } from 'crypto';
import type { StringValue } from 'ms';
import { QueryFailedError } from 'typeorm';
import { AdminService } from '../admin/admin.service';
import { Admin } from '../admin/entities/admin.entity';
import { AuditService } from '../audit/audit.service';
import { AuditActorType } from '../audit/entities/audit-log.entity';
import { AppConfig } from '../../config/app.config';
import { AuthConfig } from '../../config/auth.config';
import {
  UserSecurityTokenType,
  UserSecurityToken,
} from '../users/entities/user-security-token.entity';
import { Provider, User, UserStatus } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { AccessTokenBlacklistService } from './access-token-blacklist.service';
import {
  AdminLoginChallengeResponse,
  AdminTwoFactorService,
} from './admin-two-factor.service';
import { EmailService } from './email.service';
import { RateLimitService } from './rate-limit/rate-limit.service';
import { OAuthProfile } from './strategies/google.strategy';
import { UserProfileItem } from '../users/users.service';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export type AuthClient = 'user-web' | 'user-app' | 'admin-web';

export interface ActionMessageResponse {
  message: string;
}

export interface AccountLinkTokenPayload {
  typ: 'oauth-link';
  targetUserId: string;
  provider: Provider;
  providerUserId: string;
  providerEmail: string;
}

export type UserProfileView = UserProfileItem;

interface OAuthAuthContext {
  linkingUserId?: string | null;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly emailVerificationMaxAttempts = 3;

  constructor(
    private readonly usersService: UsersService,
    private readonly adminService: AdminService,
    private readonly auditService: AuditService,
    private readonly rateLimitService: RateLimitService,
    private readonly emailService: EmailService,
    private readonly accessTokenBlacklistService: AccessTokenBlacklistService,
    private readonly adminTwoFactorService: AdminTwoFactorService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async registerUser(
    account: string,
    password: string,
    name: string,
    client: Extract<AuthClient, 'user-web' | 'user-app'> = 'user-web',
  ): Promise<TokenPair> {
    const normalizedAccount = this.normalizeAccount(account);
    if (!normalizedAccount) {
      throw new BadRequestException('Account is required');
    }
    if (!password || password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }

    const existing = await this.usersService.findByAccount(normalizedAccount);
    if (existing) {
      throw new ConflictException({
        code: 'ACCOUNT_ALREADY_IN_USE',
        message: 'This account is already in use.',
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await this.usersService.createLocalUser({
      account: normalizedAccount,
      name: (name?.trim() || normalizedAccount).slice(0, 120),
      passwordHash,
      avatar: null,
    });

    await this.auditService.create({
      actorType: AuditActorType.User,
      actorId: user.id,
      action: 'user.registered',
      targetType: 'user',
      targetId: user.id,
      metadata: { method: 'local' },
    });

    return this.login(user, client);
  }

  async loginUser(
    account: string,
    password: string,
    ip: string,
    client: Extract<AuthClient, 'user-web' | 'user-app'> = 'user-web',
  ): Promise<TokenPair> {
    const normalizedAccount = this.normalizeAccount(account);
    if (!normalizedAccount || !password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.assertLoginRateLimit('user', normalizedAccount, ip);

    let user = await this.usersService.validateLocalPassword(
      normalizedAccount,
      password,
    );
    if (!user) {
      user = await this.tryBootstrapOAuthPasswordLogin(
        normalizedAccount,
        password,
      );
    }
    if (!user) {
      await this.auditService.create({
        actorType: AuditActorType.System,
        action: 'user.login.failed',
        targetType: 'user',
        metadata: {
          account: normalizedAccount,
          ip,
          reason: 'invalid_credentials',
        },
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    this.assertUserActive(user);

    await this.rateLimitService.resetLoginAttempt(
      'user',
      normalizedAccount,
      ip,
    );

    await this.auditService.create({
      actorType: AuditActorType.User,
      actorId: user.id,
      action: 'user.login.succeeded',
      targetType: 'user',
      targetId: user.id,
      metadata: { method: 'local', ip },
    });

    return this.login(user, client);
  }

  async validateAdminCredentials(
    email: string,
    password: string,
    ip: string,
    options?: { skipSuccessAudit?: boolean },
  ): Promise<Admin> {
    const normalizedEmail = this.normalizeEmail(email);
    if (!normalizedEmail || !password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.assertLoginRateLimit('admin', normalizedEmail, ip);

    const admin = await this.adminService.validatePassword(
      normalizedEmail,
      password,
    );
    if (!admin) {
      await this.auditService.create({
        actorType: AuditActorType.System,
        action: 'admin.login.failed',
        targetType: 'admin',
        metadata: { email: normalizedEmail, ip, reason: 'invalid_credentials' },
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.rateLimitService.resetLoginAttempt('admin', normalizedEmail, ip);

    if (!options?.skipSuccessAudit) {
      await this.auditService.create({
        actorType: AuditActorType.Admin,
        actorId: admin.id,
        action: 'admin.login.succeeded',
        targetType: 'admin',
        targetId: admin.id,
        metadata: { ip },
      });
    }

    return admin;
  }

  async loginAdmin(
    email: string,
    password: string,
    ip: string,
  ): Promise<AdminLoginChallengeResponse> {
    const admin = await this.validateAdminCredentials(email, password, ip, {
      skipSuccessAudit: true,
    });
    return this.adminTwoFactorService.issueChallenge(admin);
  }

  async verifyAdminTwoFactor(
    challengeToken: string,
    code: string,
    ip: string,
  ): Promise<TokenPair> {
    const admin = await this.adminTwoFactorService.verifyChallenge(
      challengeToken,
      code,
    );
    const tokens = await this.login(admin, 'admin-web');
    await this.auditService.create({
      actorType: AuditActorType.Admin,
      actorId: admin.id,
      action: 'admin.login.succeeded',
      targetType: 'admin',
      targetId: admin.id,
      metadata: { ip, method: 'email_2fa' },
    });
    return tokens;
  }

  async authenticateOAuth(
    provider: Provider,
    profile: OAuthProfile,
    context: OAuthAuthContext = {},
  ): Promise<TokenPair> {
    const providerUserId = profile.providerId?.trim();
    if (!providerUserId) {
      throw new UnauthorizedException('Invalid OAuth profile');
    }
    const linkingUserId = context.linkingUserId?.trim() || null;

    const existingByIdentity = await this.usersService.findUserByProvider(
      provider,
      providerUserId,
    );
    if (existingByIdentity) {
      if (linkingUserId && existingByIdentity.id !== linkingUserId) {
        throw new ConflictException({
          code: 'OAUTH_IDENTITY_ALREADY_LINKED',
          message: 'This OAuth identity is already linked to another account.',
          provider,
        });
      }
      const hydratedUser =
        await this.ensureOAuthDefaultPassword(existingByIdentity);
      this.assertUserActive(hydratedUser);
      await this.auditService.create({
        actorType: AuditActorType.User,
        actorId: hydratedUser.id,
        action: 'user.login.succeeded',
        targetType: 'user',
        targetId: hydratedUser.id,
        metadata: { method: provider },
      });
      return this.login(hydratedUser, 'user-web');
    }

    const normalizedEmail = this.normalizeEmail(profile.email);
    if (!normalizedEmail && !linkingUserId) {
      throw new ConflictException({
        code: 'OAUTH_EMAIL_REQUIRED',
        message: 'OAuth provider did not return an email address.',
      });
    }

    const linkingUser = linkingUserId
      ? await this.usersService.findById(linkingUserId)
      : null;
    if (linkingUserId && !linkingUser) {
      throw new UnauthorizedException('User not found');
    }
    if (linkingUser) {
      this.assertUserActive(linkingUser);
    }

    const existingByEmail = normalizedEmail
      ? ((await this.usersService.findByEmail(normalizedEmail)) ??
        (await this.usersService.findByAccount(normalizedEmail)))
      : null;

    if (linkingUser) {
      if (existingByEmail && existingByEmail.id !== linkingUser.id) {
        throw new ConflictException({
          code: 'OAUTH_EMAIL_ALREADY_IN_USE',
          message:
            'The OAuth email is already associated with another account.',
          provider,
          email: normalizedEmail ?? profile.email ?? null,
        });
      }

      await this.usersService.linkOAuthIdentity({
        userId: linkingUser.id,
        provider,
        providerUserId,
        providerEmail: normalizedEmail ?? null,
      });
      const hydratedLinkingUser =
        await this.ensureOAuthDefaultPassword(linkingUser);
      await this.auditService.create({
        actorType: AuditActorType.User,
        actorId: hydratedLinkingUser.id,
        action: 'user.oauth.linked',
        targetType: 'user',
        targetId: hydratedLinkingUser.id,
        metadata: { provider },
      });
      return this.login(hydratedLinkingUser, 'user-web');
    }

    const oauthEmail = normalizedEmail;
    if (!oauthEmail) {
      throw new ConflictException({
        code: 'OAUTH_EMAIL_REQUIRED',
        message: 'OAuth provider did not return an email address.',
      });
    }

    if (!existingByEmail) {
      const passwordHash = await bcrypt.hash(
        this.getOAuthInitialPassword(),
        10,
      );
      const user = await this.usersService.createOAuthUser({
        account: oauthEmail,
        email: oauthEmail,
        name: (profile.name?.trim() || oauthEmail.split('@')[0]).slice(0, 120),
        avatar: profile.avatar ?? null,
        passwordHash,
        provider,
        providerUserId,
      });

      await this.auditService.create({
        actorType: AuditActorType.User,
        actorId: user.id,
        action: 'user.registered',
        targetType: 'user',
        targetId: user.id,
        metadata: { method: provider },
      });

      return this.login(user, 'user-web');
    }

    const hydratedExistingByEmail =
      await this.ensureOAuthDefaultPassword(existingByEmail);
    this.assertUserActive(hydratedExistingByEmail);

    const linkToken = this.createAccountLinkToken({
      targetUserId: hydratedExistingByEmail.id,
      provider,
      providerUserId,
      providerEmail: oauthEmail,
    });
    throw new ConflictException({
      code: 'ACCOUNT_LINK_REQUIRED',
      message:
        'An account with this email already exists. Sign in to that account and link this OAuth provider.',
      provider,
      email: oauthEmail,
      linkToken,
    });
  }

  async linkOAuthIdentity(
    actorUserId: string,
    actorRole: 'admin' | 'user',
    linkToken: string,
  ): Promise<void> {
    if (actorRole !== 'user') {
      throw new ForbiddenException(
        'Only user accounts can link OAuth identities',
      );
    }

    const payload = this.verifyAccountLinkToken(linkToken);
    if (payload.targetUserId !== actorUserId) {
      throw new ForbiddenException('Link token does not belong to this user');
    }

    await this.usersService.linkOAuthIdentity({
      userId: actorUserId,
      provider: payload.provider,
      providerUserId: payload.providerUserId,
      providerEmail: payload.providerEmail,
    });

    await this.auditService.create({
      actorType: AuditActorType.User,
      actorId: actorUserId,
      action: 'user.oauth.linked',
      targetType: 'user',
      targetId: actorUserId,
      metadata: { provider: payload.provider },
    });
  }

  async getCurrentUserProfile(
    actorUserId: string,
    actorRole: 'admin' | 'user',
  ): Promise<UserProfileView> {
    if (actorRole !== 'user') {
      throw new ForbiddenException('Only user accounts can view profile');
    }

    const user = await this.usersService.getProfileById(actorUserId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return user;
  }

  async updateCurrentUserProfile(
    actorUserId: string,
    actorRole: 'admin' | 'user',
    input: { name?: string; avatar?: string },
  ): Promise<UserProfileView> {
    if (actorRole !== 'user') {
      throw new ForbiddenException('Only user accounts can update profile');
    }

    const update: { name?: string; avatar?: string | null } = {};
    if (input.name !== undefined) {
      const normalizedName = input.name.trim();
      if (!normalizedName) {
        throw new BadRequestException('Name is required');
      }
      update.name = normalizedName.slice(0, 120);
    }
    if (input.avatar !== undefined) {
      const normalizedAvatar = input.avatar.trim();
      update.avatar = normalizedAvatar ? normalizedAvatar.slice(0, 500) : null;
    }

    await this.usersService.updateProfile(actorUserId, update);

    await this.auditService.create({
      actorType: AuditActorType.User,
      actorId: actorUserId,
      action: 'user.profile.updated',
      targetType: 'user',
      targetId: actorUserId,
      metadata: update,
    });

    return this.getCurrentUserProfile(actorUserId, actorRole);
  }

  async changeCurrentUserPassword(
    actorUserId: string,
    actorRole: 'admin' | 'user',
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    if (actorRole !== 'user') {
      throw new ForbiddenException('Only user accounts can change password');
    }
    if (!newPassword || newPassword.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }

    const user = await this.usersService.findById(actorUserId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    this.assertUserActive(user);

    const currentMatches = await this.usersService.verifyCurrentPassword(
      actorUserId,
      currentPassword,
    );
    if (!currentMatches) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.usersService.updatePassword(actorUserId, passwordHash);

    await this.auditService.create({
      actorType: AuditActorType.User,
      actorId: actorUserId,
      action: 'user.password.changed',
      targetType: 'user',
      targetId: actorUserId,
    });
  }

  async requestEmailVerification(
    userId: string,
    userRole: 'admin' | 'user',
    email: string,
  ): Promise<ActionMessageResponse> {
    if (userRole !== 'user') {
      throw new ForbiddenException('Only user accounts can bind email');
    }

    const normalizedEmail = this.normalizeEmail(email);
    if (!normalizedEmail) {
      throw new BadRequestException('Email is required');
    }

    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const existingEmailOwner =
      await this.usersService.findByEmail(normalizedEmail);
    if (existingEmailOwner && existingEmailOwner.id !== userId) {
      throw new ConflictException({
        code: 'EMAIL_ALREADY_BOUND',
        message: 'This email has already been bound to another account.',
      });
    }

    const auth = this.configService.get<AuthConfig>('auth')!;
    const code = await this.issueUserSecurityCode(
      user.id,
      UserSecurityTokenType.EmailVerification,
      auth.token.emailVerificationTtlMinutes,
      normalizedEmail,
    );
    await this.emailService.sendEmailVerification(normalizedEmail, code);

    await this.auditService.create({
      actorType: AuditActorType.User,
      actorId: user.id,
      action: 'user.email_binding.requested',
      targetType: 'user',
      targetId: user.id,
      metadata: { email: normalizedEmail },
    });

    if (!this.isProduction()) {
      this.logger.debug(
        `[DEV] Email verification code for ${normalizedEmail}: ${code}`,
      );
    }
    return {
      message: 'Verification code sent to your email address.',
    };
  }

  async confirmEmailVerification(
    userId: string,
    userRole: 'admin' | 'user',
    code: string,
  ): Promise<void> {
    if (userRole !== 'user') {
      throw new ForbiddenException('Only user accounts can bind email');
    }

    const payload = await this.consumeUserSecurityCode(
      userId,
      UserSecurityTokenType.EmailVerification,
      code,
    );

    if (!payload.targetEmail) {
      throw new UnauthorizedException('Invalid or expired verification code');
    }

    let consumed = false;
    try {
      consumed =
        await this.usersService.consumeEmailVerificationTokenAndBindEmail({
          tokenId: payload.id,
          userId: payload.userId,
          email: payload.targetEmail,
        });
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string }).code === '23505'
      ) {
        throw new ConflictException({
          code: 'EMAIL_ALREADY_BOUND',
          message: 'This email has already been bound to another account.',
        });
      }
      throw error;
    }

    if (!consumed) {
      throw new UnauthorizedException('Invalid or expired verification code');
    }

    await this.auditService.create({
      actorType: AuditActorType.User,
      actorId: payload.userId,
      action: 'user.email_binding.confirmed',
      targetType: 'user',
      targetId: payload.userId,
    });
  }

  async requestPasswordReset(email: string): Promise<ActionMessageResponse> {
    const normalizedEmail = this.normalizeEmail(email);
    if (!normalizedEmail) {
      throw new BadRequestException('Email is required');
    }

    const user = await this.usersService.findByEmail(normalizedEmail);
    if (!user) {
      return {
        message: 'If the email exists, a password reset email has been sent.',
      };
    }

    const auth = this.configService.get<AuthConfig>('auth')!;
    const token = await this.issueUserSecurityToken(
      user.id,
      UserSecurityTokenType.PasswordReset,
      auth.token.passwordResetTtlMinutes,
    );
    await this.emailService.sendPasswordReset(normalizedEmail, token);

    await this.auditService.create({
      actorType: AuditActorType.User,
      actorId: user.id,
      action: 'user.password_reset.requested',
      targetType: 'user',
      targetId: user.id,
    });

    if (!this.isProduction()) {
      this.logger.debug(
        `[DEV] Password reset token for ${normalizedEmail}: ${token}`,
      );
    }
    return {
      message: 'If the email exists, a password reset email has been sent.',
    };
  }

  async confirmPasswordReset(
    token: string,
    newPassword: string,
  ): Promise<void> {
    if (!newPassword || newPassword.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }

    const payload = await this.consumeUserSecurityToken(
      UserSecurityTokenType.PasswordReset,
      token,
    );

    this.assertUserActive(payload.user);

    const consumed = await this.usersService.markSecurityTokenUsedIfUnused(
      payload.id,
    );
    if (!consumed) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.usersService.updatePassword(payload.userId, passwordHash);

    await this.auditService.create({
      actorType: AuditActorType.User,
      actorId: payload.userId,
      action: 'user.password_reset.confirmed',
      targetType: 'user',
      targetId: payload.userId,
    });
  }

  generateTokens(
    userId: string,
    account: string,
    role: 'admin' | 'user',
    client: AuthClient,
  ): TokenPair {
    const auth = this.configService.get<AuthConfig>('auth')!;
    const basePayload = { sub: userId, account, role, client };

    const accessToken = this.jwtService.sign(
      {
        ...basePayload,
        jti: randomUUID(),
      },
      {
        secret: auth.jwt.accessSecret,
        expiresIn: auth.jwt.accessExpiresIn as StringValue,
      },
    );

    const refreshToken = this.jwtService.sign(
      {
        ...basePayload,
        jti: randomUUID(),
      },
      {
        secret: auth.jwt.refreshSecret,
        expiresIn: auth.jwt.refreshExpiresIn as StringValue,
      },
    );

    return { accessToken, refreshToken };
  }

  async login(entity: Admin | User, client: AuthClient): Promise<TokenPair> {
    const role: 'admin' | 'user' = entity instanceof Admin ? 'admin' : 'user';
    if (entity instanceof User) {
      this.assertUserActive(entity);
    }

    const account = entity instanceof Admin ? entity.email : entity.account;
    const tokens = this.generateTokens(entity.id, account, role, client);

    if (entity instanceof Admin) {
      await this.adminService.setRefreshToken(entity.id, tokens.refreshToken);
    } else {
      await this.usersService.setRefreshToken(
        entity.id,
        tokens.refreshToken,
        client === 'user-app' ? 'app' : 'web',
      );
    }

    return tokens;
  }

  async refreshTokens(
    userId: string,
    role: 'admin' | 'user',
    refreshToken: string,
    client: AuthClient,
  ): Promise<TokenPair> {
    if (role === 'admin') {
      if (client !== 'admin-web') {
        throw new UnauthorizedException();
      }
      const admin = await this.adminService.findById(userId);
      if (!admin || !admin.hashedRefreshToken) {
        throw new UnauthorizedException();
      }
      const tokenMatches = await bcrypt.compare(
        refreshToken,
        admin.hashedRefreshToken,
      );
      if (!tokenMatches) throw new UnauthorizedException();

      const tokens = this.generateTokens(
        admin.id,
        admin.email,
        'admin',
        'admin-web',
      );
      await this.adminService.setRefreshToken(admin.id, tokens.refreshToken);
      return tokens;
    }

    const user = await this.usersService.findById(userId);
    const storedRefreshTokenHash =
      client === 'user-app'
        ? user?.hashedAppRefreshToken
        : user?.hashedRefreshToken;
    if (!user || !storedRefreshTokenHash) {
      throw new UnauthorizedException();
    }
    this.assertUserActive(user);

    const tokenMatches = await bcrypt.compare(
      refreshToken,
      storedRefreshTokenHash,
    );
    if (!tokenMatches) throw new UnauthorizedException();

    const nextClient = client === 'user-app' ? 'user-app' : 'user-web';
    const tokens = this.generateTokens(
      user.id,
      user.account,
      'user',
      nextClient,
    );
    await this.usersService.setRefreshToken(
      user.id,
      tokens.refreshToken,
      client === 'user-app' ? 'app' : 'web',
    );
    return tokens;
  }

  async logout(
    userId: string,
    role: 'admin' | 'user',
    client: AuthClient,
    accessTokenJti?: string,
    accessTokenExp?: number,
  ): Promise<void> {
    if (role === 'admin') {
      await this.adminService.setRefreshToken(userId, null);
    } else {
      await this.usersService.setRefreshToken(
        userId,
        null,
        client === 'user-app' ? 'app' : 'web',
      );
    }

    if (accessTokenJti && accessTokenExp) {
      await this.accessTokenBlacklistService.blacklist(
        accessTokenJti,
        accessTokenExp,
      );
    }
  }

  async resolveActiveWebUserIdFromRefreshToken(
    refreshToken?: string | null,
  ): Promise<string | null> {
    const token = refreshToken?.trim();
    if (!token) {
      return null;
    }

    const auth = this.configService.get<AuthConfig>('auth')!;
    let payload:
      | {
          sub?: string;
          role?: string;
          client?: string;
        }
      | undefined;
    try {
      payload = this.jwtService.verify(token, {
        secret: auth.jwt.refreshSecret,
      });
    } catch {
      return null;
    }

    if (
      !payload?.sub ||
      payload.role !== 'user' ||
      payload.client !== 'user-web'
    ) {
      return null;
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user?.hashedRefreshToken) {
      return null;
    }

    const tokenMatches = await bcrypt.compare(token, user.hashedRefreshToken);
    if (!tokenMatches || user.status !== UserStatus.Active) {
      return null;
    }

    return user.id;
  }

  private async assertLoginRateLimit(
    scope: 'user' | 'admin',
    email: string,
    ip: string,
  ): Promise<void> {
    const auth = this.configService.get<AuthConfig>('auth')!;
    const result = await this.rateLimitService.consumeLoginAttempt(
      scope,
      email,
      ip,
      auth.loginRateLimit.maxAttempts,
      auth.loginRateLimit.windowSeconds,
    );

    if (!result.allowed) {
      throw new HttpException(
        {
          code: 'LOGIN_RATE_LIMITED',
          message: 'Too many login attempts. Please try again later.',
          retryAfterSeconds: result.retryAfterSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private assertUserActive(user: User): void {
    if (user.status === UserStatus.Active) {
      return;
    }

    throw new ForbiddenException({
      code: 'USER_DISABLED',
      message:
        user.status === UserStatus.Banned
          ? 'This account has been banned.'
          : 'This account is suspended.',
      status: user.status,
      reason: user.statusReason,
    });
  }

  private normalizeEmail(email?: string): string | null {
    const normalized = email?.trim().toLowerCase();
    return normalized ? normalized : null;
  }

  private normalizeAccount(account?: string): string | null {
    const normalized = account?.trim().toLowerCase();
    return normalized ? normalized : null;
  }

  private getOAuthInitialPassword(): string {
    const auth = this.configService.get<AuthConfig>('auth');
    const configured = auth?.oauthInitialPassword?.trim();
    if (configured && configured.length >= 8) {
      return configured;
    }
    return 'Optivoy@2026';
  }

  private async ensureOAuthDefaultPassword(user: User): Promise<User> {
    if (user.passwordHash) {
      return user;
    }

    const passwordHash = await bcrypt.hash(this.getOAuthInitialPassword(), 10);
    await this.usersService.updatePassword(user.id, passwordHash);
    return {
      ...user,
      passwordHash,
      hashedRefreshToken: null,
      hashedAppRefreshToken: null,
    };
  }

  private async tryBootstrapOAuthPasswordLogin(
    normalizedAccount: string,
    password: string,
  ): Promise<User | null> {
    if (password !== this.getOAuthInitialPassword()) {
      return null;
    }

    const user = await this.usersService.findByAccount(normalizedAccount);
    if (!user || user.passwordHash) {
      return null;
    }

    const passwordHash = await bcrypt.hash(this.getOAuthInitialPassword(), 10);
    await this.usersService.updatePassword(user.id, passwordHash);
    return {
      ...user,
      passwordHash,
      hashedRefreshToken: null,
      hashedAppRefreshToken: null,
    };
  }

  private async issueUserSecurityToken(
    userId: string,
    type: UserSecurityTokenType,
    ttlMinutes: number,
    targetEmail?: string,
  ): Promise<string> {
    await this.usersService.invalidateTokensByType(userId, type);

    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

    await this.usersService.createSecurityToken({
      userId,
      type,
      tokenHash,
      expiresAt,
      targetEmail,
    });

    return token;
  }

  private async issueUserSecurityCode(
    userId: string,
    type: UserSecurityTokenType,
    ttlMinutes: number,
    targetEmail?: string,
  ): Promise<string> {
    await this.usersService.invalidateTokensByType(userId, type);

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const tokenHash = createHash('sha256').update(code).digest('hex');
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

    await this.usersService.createSecurityToken({
      userId,
      type,
      tokenHash,
      expiresAt,
      targetEmail,
    });

    return code;
  }

  private async consumeUserSecurityToken(
    type: UserSecurityTokenType,
    token: string,
  ): Promise<UserSecurityToken> {
    if (!token) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const tokenHash = createHash('sha256').update(token).digest('hex');
    const record = await this.usersService.findActiveSecurityTokenByHash(
      type,
      tokenHash,
    );

    if (!record || record.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    return record;
  }

  private async consumeUserSecurityCode(
    userId: string,
    type: UserSecurityTokenType,
    code: string,
  ): Promise<UserSecurityToken> {
    if (!code) {
      throw new UnauthorizedException('Invalid or expired verification code');
    }

    const record = await this.usersService.findLatestActiveSecurityTokenForUser(
      userId,
      type,
    );
    if (!record || record.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Invalid or expired verification code');
    }

    const tokenHash = createHash('sha256').update(code).digest('hex');
    if (record.tokenHash !== tokenHash) {
      const attemptKey = this.buildEmailVerificationAttemptKey(record.id);
      const windowSeconds = Math.max(
        Math.ceil((record.expiresAt.getTime() - Date.now()) / 1000),
        1,
      );
      const attemptResult = await this.rateLimitService.consumeKey(
        attemptKey,
        this.emailVerificationMaxAttempts,
        windowSeconds,
      );

      if (attemptResult.remaining === 0) {
        await this.usersService.markSecurityTokenUsedIfUnused(record.id);
        await this.rateLimitService.resetKey(attemptKey);
        throw new UnauthorizedException(
          'Verification code has expired. Please request a new code.',
        );
      }

      throw new UnauthorizedException('Invalid or expired verification code');
    }

    await this.rateLimitService.resetKey(
      this.buildEmailVerificationAttemptKey(record.id),
    );
    return record;
  }

  private createAccountLinkToken(
    payload: Omit<AccountLinkTokenPayload, 'typ'>,
  ): string {
    const auth = this.configService.get<AuthConfig>('auth')!;
    return this.jwtService.sign(
      { typ: 'oauth-link', ...payload } satisfies AccountLinkTokenPayload,
      {
        secret: auth.jwt.accessSecret,
        expiresIn: '10m',
      },
    );
  }

  private verifyAccountLinkToken(token: string): AccountLinkTokenPayload {
    const auth = this.configService.get<AuthConfig>('auth')!;
    let decoded: unknown;
    try {
      decoded = this.jwtService.verify(token, {
        secret: auth.jwt.accessSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired link token');
    }

    if (
      typeof decoded !== 'object' ||
      !decoded ||
      (decoded as Record<string, unknown>).typ !== 'oauth-link'
    ) {
      throw new UnauthorizedException('Invalid link token');
    }
    return decoded as AccountLinkTokenPayload;
  }

  private isProduction(): boolean {
    const app = this.configService.get<AppConfig>('app');
    return app?.nodeEnv === 'production';
  }

  private buildEmailVerificationAttemptKey(tokenId: string): string {
    return `auth:email-verification:attempts:${tokenId}`;
  }
}
