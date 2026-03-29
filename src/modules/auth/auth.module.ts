import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AdminModule } from '../admin/admin.module';
import { AuditModule } from '../audit/audit.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AccessTokenBlacklistService } from './access-token-blacklist.service';
import { AdminTwoFactorService } from './admin-two-factor.service';
import { EmailService } from './email.service';
import { AuthService } from './auth.service';
import { AuthScopeGuard } from './guards/auth-scope.guard';
import { FacebookAuthGuard } from './guards/facebook-auth.guard';
import { FacebookOAuthEnabledGuard } from './guards/facebook-oauth-enabled.guard';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { GoogleOAuthEnabledGuard } from './guards/google-oauth-enabled.guard';
import { RateLimitService } from './rate-limit/rate-limit.service';
import { FacebookStrategy } from './strategies/facebook.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({}),
    UsersModule,
    AdminModule,
    AuditModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    EmailService,
    AccessTokenBlacklistService,
    AdminTwoFactorService,
    RateLimitService,
    AuthScopeGuard,
    GoogleAuthGuard,
    FacebookAuthGuard,
    GoogleOAuthEnabledGuard,
    FacebookOAuthEnabledGuard,
    LocalStrategy,
    JwtStrategy,
    JwtRefreshStrategy,
    GoogleStrategy,
    FacebookStrategy,
  ],
  exports: [EmailService],
})
export class AuthModule {}
