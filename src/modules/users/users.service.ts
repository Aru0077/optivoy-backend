import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, MoreThan, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UserOauthIdentity } from './entities/user-oauth-identity.entity';
import {
  UserSecurityToken,
  UserSecurityTokenType,
} from './entities/user-security-token.entity';
import { Provider, User, UserStatus } from './entities/user.entity';

export interface UserListItem {
  id: string;
  account: string;
  name: string;
  avatar: string | null;
  status: UserStatus;
  statusReason: string | null;
  email: string | null;
  emailVerifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProfileItem {
  id: string;
  account: string;
  name: string;
  avatar: string | null;
  status: UserStatus;
  email: string | null;
  emailVerifiedAt: Date | null;
  hasPassword: boolean;
  linkedProviders: Array<{
    provider: Provider;
    providerEmail: string | null;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(UserOauthIdentity)
    private readonly oauthIdentityRepository: Repository<UserOauthIdentity>,
    @InjectRepository(UserSecurityToken)
    private readonly userSecurityTokenRepository: Repository<UserSecurityToken>,
    private readonly dataSource: DataSource,
  ) {}

  findById(id: string): Promise<User | null> {
    return this.usersRepository.findOneBy({ id });
  }

  findByAccount(account: string): Promise<User | null> {
    return this.usersRepository.findOneBy({ account });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOneBy({ email });
  }

  async getProfileById(userId: string): Promise<UserProfileItem | null> {
    const user = await this.findById(userId);
    if (!user) {
      return null;
    }

    const identities = await this.oauthIdentityRepository.find({
      where: { userId },
      order: { provider: 'ASC' },
    });

    return {
      id: user.id,
      account: user.account,
      name: user.name,
      avatar: user.avatar,
      status: user.status,
      email: user.email,
      emailVerifiedAt: user.emailVerifiedAt,
      hasPassword: Boolean(user.passwordHash),
      linkedProviders: identities.map((identity) => ({
        provider: identity.provider,
        providerEmail: identity.providerEmail,
      })),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  createLocalUser(data: {
    account: string;
    name: string;
    avatar?: string | null;
    passwordHash: string;
  }): Promise<User> {
    const user = this.usersRepository.create({
      account: data.account,
      name: data.name,
      avatar: data.avatar ?? null,
      passwordHash: data.passwordHash,
      status: UserStatus.Active,
      statusReason: null,
      emailVerifiedAt: null,
      email: null,
      hashedRefreshToken: null,
      hashedAppRefreshToken: null,
    });
    return this.usersRepository.save(user);
  }

  createOAuthUser(data: {
    account: string;
    email: string;
    name: string;
    avatar?: string | null;
    passwordHash?: string | null;
    provider: Provider;
    providerUserId: string;
  }): Promise<User> {
    return this.dataSource.transaction(async (manager) => {
      const user = manager.create(User, {
        account: data.account,
        name: data.name,
        avatar: data.avatar ?? null,
        passwordHash: data.passwordHash ?? null,
        status: UserStatus.Active,
        statusReason: null,
        emailVerifiedAt: new Date(),
        email: data.email,
        hashedRefreshToken: null,
        hashedAppRefreshToken: null,
      });
      const savedUser = await manager.save(User, user);

      const identity = manager.create(UserOauthIdentity, {
        userId: savedUser.id,
        provider: data.provider,
        providerUserId: data.providerUserId,
        providerEmail: data.email,
      });
      await manager.save(UserOauthIdentity, identity);
      return savedUser;
    });
  }

  async validateLocalPassword(
    account: string,
    plainPassword: string,
  ): Promise<User | null> {
    const user = await this.findByAccount(account);
    if (!user?.passwordHash) return null;
    const matches = await bcrypt.compare(plainPassword, user.passwordHash);
    return matches ? user : null;
  }

  findIdentityByProvider(
    provider: Provider,
    providerUserId: string,
  ): Promise<UserOauthIdentity | null> {
    return this.oauthIdentityRepository.findOne({
      where: { provider, providerUserId },
      relations: { user: true },
    });
  }

  findUserByProvider(
    provider: Provider,
    providerUserId: string,
  ): Promise<User | null> {
    return this.oauthIdentityRepository
      .findOne({
        where: { provider, providerUserId },
        relations: { user: true },
      })
      .then((identity) => identity?.user ?? null);
  }

  async linkOAuthIdentity(data: {
    userId: string;
    provider: Provider;
    providerUserId: string;
    providerEmail?: string | null;
  }): Promise<void> {
    const existingByProvider = await this.findIdentityByProvider(
      data.provider,
      data.providerUserId,
    );
    if (existingByProvider && existingByProvider.userId !== data.userId) {
      throw new ConflictException({
        code: 'OAUTH_IDENTITY_ALREADY_LINKED',
        message: 'This OAuth identity is already linked to another account.',
      });
    }

    const existingForUserProvider =
      await this.oauthIdentityRepository.findOneBy({
        userId: data.userId,
        provider: data.provider,
      });
    if (
      existingForUserProvider &&
      existingForUserProvider.providerUserId !== data.providerUserId
    ) {
      throw new ConflictException({
        code: 'PROVIDER_ALREADY_LINKED',
        message: 'This provider is already linked with a different account.',
      });
    }
    if (existingForUserProvider) {
      return;
    }

    const identity = this.oauthIdentityRepository.create({
      userId: data.userId,
      provider: data.provider,
      providerUserId: data.providerUserId,
      providerEmail: data.providerEmail ?? null,
    });
    await this.oauthIdentityRepository.save(identity);
  }

  async setRefreshToken(
    userId: string,
    token: string | null,
    client: 'web' | 'app' = 'web',
  ): Promise<void> {
    const hashedRefreshToken = token ? await bcrypt.hash(token, 10) : null;
    await this.usersRepository.update(
      userId,
      client === 'app'
        ? { hashedAppRefreshToken: hashedRefreshToken }
        : { hashedRefreshToken },
    );
  }

  async clearAllRefreshTokens(userId: string): Promise<void> {
    await this.usersRepository.update(userId, {
      hashedRefreshToken: null,
      hashedAppRefreshToken: null,
    });
  }

  async updatePassword(userId: string, newPasswordHash: string): Promise<void> {
    await this.usersRepository.update(userId, {
      passwordHash: newPasswordHash,
      hashedRefreshToken: null,
      hashedAppRefreshToken: null,
    });
  }

  async markEmailVerified(userId: string, email: string): Promise<void> {
    await this.usersRepository.update(userId, {
      email,
      emailVerifiedAt: new Date(),
    });
  }

  async consumeEmailVerificationTokenAndBindEmail(input: {
    tokenId: string;
    userId: string;
    email: string;
  }): Promise<boolean> {
    return this.dataSource.transaction(async (manager) => {
      const updateResult = await manager
        .createQueryBuilder()
        .update(UserSecurityToken)
        .set({ usedAt: new Date() })
        .where('id = :tokenId', { tokenId: input.tokenId })
        .andWhere('"usedAt" IS NULL')
        .execute();

      if ((updateResult.affected ?? 0) === 0) {
        return false;
      }

      await manager.update(User, input.userId, {
        email: input.email,
        emailVerifiedAt: new Date(),
      });

      await manager
        .createQueryBuilder()
        .update(UserSecurityToken)
        .set({ usedAt: new Date() })
        .where('"userId" = :userId', { userId: input.userId })
        .andWhere('type = :type', {
          type: UserSecurityTokenType.EmailVerification,
        })
        .andWhere('"usedAt" IS NULL')
        .execute();

      return true;
    });
  }

  async updateUserStatus(
    userId: string,
    status: UserStatus,
    statusReason?: string | null,
  ): Promise<void> {
    const update: Partial<User> = {
      status,
      statusReason: statusReason ?? null,
    };
    // Revoke refresh token when suspending or banning so the user is
    // immediately signed out rather than waiting for token expiry.
    if (status !== UserStatus.Active) {
      update.hashedRefreshToken = null;
      update.hashedAppRefreshToken = null;
    }
    await this.usersRepository.update(userId, update);
  }

  async updateProfile(
    userId: string,
    input: { name?: string; avatar?: string | null },
  ): Promise<void> {
    const update: Partial<User> = {};
    if (input.name !== undefined) {
      update.name = input.name;
    }
    if ('avatar' in input) {
      update.avatar = input.avatar ?? null;
    }
    if (Object.keys(update).length === 0) {
      return;
    }
    await this.usersRepository.update(userId, update);
  }

  async verifyCurrentPassword(
    userId: string,
    plainPassword: string,
  ): Promise<boolean> {
    const user = await this.findById(userId);
    if (!user?.passwordHash) {
      return false;
    }
    return bcrypt.compare(plainPassword, user.passwordHash);
  }

  async listUsers(input: {
    status?: UserStatus;
    limit?: number;
    offset?: number;
  }): Promise<{ total: number; items: UserListItem[] }> {
    const where = input.status ? { status: input.status } : {};
    const limit = Math.min(Math.max(input.limit ?? 20, 1), 100);
    const offset = Math.max(input.offset ?? 0, 0);

    const [items, total] = await this.usersRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
    return {
      total,
      items: items.map((user) => ({
        id: user.id,
        account: user.account,
        name: user.name,
        avatar: user.avatar,
        status: user.status,
        statusReason: user.statusReason,
        email: user.email,
        emailVerifiedAt: user.emailVerifiedAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      })),
    };
  }

  async invalidateTokensByType(
    userId: string,
    type: UserSecurityTokenType,
  ): Promise<void> {
    await this.userSecurityTokenRepository
      .createQueryBuilder()
      .update(UserSecurityToken)
      .set({ usedAt: new Date() })
      .where('"userId" = :userId', { userId })
      .andWhere('type = :type', { type })
      .andWhere('"usedAt" IS NULL')
      .execute();
  }

  createSecurityToken(data: {
    userId: string;
    type: UserSecurityTokenType;
    tokenHash: string;
    expiresAt: Date;
    targetEmail?: string;
  }): Promise<UserSecurityToken> {
    const token = this.userSecurityTokenRepository.create({
      userId: data.userId,
      type: data.type,
      tokenHash: data.tokenHash,
      expiresAt: data.expiresAt,
      usedAt: null,
      targetEmail: data.targetEmail ?? null,
    });
    return this.userSecurityTokenRepository.save(token);
  }

  findActiveSecurityTokenByHash(
    type: UserSecurityTokenType,
    tokenHash: string,
  ): Promise<UserSecurityToken | null> {
    return this.userSecurityTokenRepository.findOne({
      where: {
        type,
        tokenHash,
        usedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
      relations: { user: true },
    });
  }

  findActiveSecurityTokenByHashForUser(
    userId: string,
    type: UserSecurityTokenType,
    tokenHash: string,
  ): Promise<UserSecurityToken | null> {
    return this.userSecurityTokenRepository.findOne({
      where: {
        userId,
        type,
        tokenHash,
        usedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
      relations: { user: true },
    });
  }

  findLatestActiveSecurityTokenForUser(
    userId: string,
    type: UserSecurityTokenType,
  ): Promise<UserSecurityToken | null> {
    return this.userSecurityTokenRepository.findOne({
      where: {
        userId,
        type,
        usedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
      order: { createdAt: 'DESC' },
    });
  }

  async markSecurityTokenUsed(tokenId: string): Promise<void> {
    await this.userSecurityTokenRepository.update(tokenId, {
      usedAt: new Date(),
    });
  }

  async markSecurityTokenUsedIfUnused(tokenId: string): Promise<boolean> {
    const result = await this.userSecurityTokenRepository
      .createQueryBuilder()
      .update(UserSecurityToken)
      .set({ usedAt: new Date() })
      .where('id = :tokenId', { tokenId })
      .andWhere('"usedAt" IS NULL')
      .execute();

    return (result.affected ?? 0) > 0;
  }
}
