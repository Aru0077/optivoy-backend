import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserOauthIdentity } from './entities/user-oauth-identity.entity';
import { UserSecurityToken } from './entities/user-security-token.entity';
import { User } from './entities/user.entity';
import { UserStatusCacheService } from './user-status-cache.service';
import { UsersService } from './users.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserOauthIdentity, UserSecurityToken]),
  ],
  providers: [UsersService, UserStatusCacheService],
  exports: [UsersService, UserStatusCacheService],
})
export class UsersModule {}
