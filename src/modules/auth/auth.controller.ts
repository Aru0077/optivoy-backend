import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { Provider } from '../users/entities/user.entity';
import {
  ActionMessageResponse,
  AuthService,
  TokenPair,
  UserProfileView,
} from './auth.service';
import { AdminLoginChallengeResponse } from './admin-two-factor.service';
import { AuthConfig } from '../../config/auth.config';
import { AuthScope } from './decorators/auth-scope.decorator';
import { AdminLoginDto } from './dto/admin-login.dto';
import { ConfirmEmailVerificationDto } from './dto/confirm-email-verification.dto';
import { ConfirmPasswordResetDto } from './dto/confirm-password-reset.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LinkOauthDto } from './dto/link-oauth.dto';
import { RequestEmailVerificationDto } from './dto/request-email-verification.dto';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import { UserLoginDto } from './dto/user-login.dto';
import { UserRegisterDto } from './dto/user-register.dto';
import { VerifyAdminTwoFactorDto } from './dto/verify-admin-two-factor.dto';
import { FacebookAuthGuard } from './guards/facebook-auth.guard';
import { FacebookOAuthEnabledGuard } from './guards/facebook-oauth-enabled.guard';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { GoogleOAuthEnabledGuard } from './guards/google-oauth-enabled.guard';
import { AuthScopeGuard } from './guards/auth-scope.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { OAuthProfile } from './strategies/google.strategy';
import { JwtRefreshPayload } from './strategies/jwt-refresh.strategy';
import { JwtPayload } from './strategies/jwt.strategy';
import { Throttle } from '@nestjs/throttler';

interface AccessTokenResponse {
  accessToken: string;
}

type BrowserRefreshAudience = 'user' | 'admin';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('admin/login')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @HttpCode(HttpStatus.OK)
  adminLogin(
    @Req() req: Request,
    @Body() dto: AdminLoginDto,
  ): Promise<AdminLoginChallengeResponse> {
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    return this.authService.loginAdmin(dto.email, dto.password, ip);
  }

  @Post('admin/login/verify-2fa')
  @HttpCode(HttpStatus.OK)
  async verifyAdminTwoFactor(
    @Req() req: Request,
    @Body() dto: VerifyAdminTwoFactorDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AccessTokenResponse> {
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    const tokens = await this.authService.verifyAdminTwoFactor(
      dto.challengeToken,
      dto.code,
      ip,
    );
    this.setRefreshTokenCookie(res, tokens.refreshToken, 'admin');
    return { accessToken: tokens.accessToken };
  }

  @Post('user/register')
  @HttpCode(HttpStatus.CREATED)
  async userRegister(
    @Body() dto: UserRegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AccessTokenResponse> {
    const tokens = await this.authService.registerUser(
      dto.account,
      dto.password,
      dto.name,
    );
    this.setRefreshTokenCookie(res, tokens.refreshToken, 'user');
    return { accessToken: tokens.accessToken };
  }

  @Post('user/login')
  @HttpCode(HttpStatus.OK)
  async userLogin(
    @Req() req: Request,
    @Body() dto: UserLoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AccessTokenResponse> {
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    const tokens = await this.authService.loginUser(
      dto.account,
      dto.password,
      ip,
    );
    this.setRefreshTokenCookie(res, tokens.refreshToken, 'user');
    return { accessToken: tokens.accessToken };
  }

  @Post('app/register')
  @HttpCode(HttpStatus.CREATED)
  appRegister(@Body() dto: UserRegisterDto): Promise<TokenPair> {
    return this.authService.registerUser(
      dto.account,
      dto.password,
      dto.name,
      'user-app',
    );
  }

  @Post('app/login')
  @HttpCode(HttpStatus.OK)
  appLogin(@Req() req: Request, @Body() dto: UserLoginDto): Promise<TokenPair> {
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    return this.authService.loginUser(
      dto.account,
      dto.password,
      ip,
      'user-app',
    );
  }

  @Post('user/email-verification/request')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  requestEmailVerification(
    @Req() req: Request & { user: JwtPayload },
    @Body() dto: RequestEmailVerificationDto,
  ): Promise<ActionMessageResponse> {
    return this.authService.requestEmailVerification(
      req.user.sub,
      req.user.role,
      dto.email,
    );
  }

  @Post('user/email-verification/confirm')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  confirmEmailVerification(
    @Req() req: Request & { user: JwtPayload },
    @Body() dto: ConfirmEmailVerificationDto,
  ): Promise<void> {
    return this.authService.confirmEmailVerification(
      req.user.sub,
      req.user.role,
      dto.code,
    );
  }

  @Post('user/password-reset/request')
  @HttpCode(HttpStatus.OK)
  requestPasswordReset(
    @Body() dto: RequestPasswordResetDto,
  ): Promise<ActionMessageResponse> {
    return this.authService.requestPasswordReset(dto.email);
  }

  @Post('user/password-reset/confirm')
  @HttpCode(HttpStatus.NO_CONTENT)
  confirmPasswordReset(@Body() dto: ConfirmPasswordResetDto): Promise<void> {
    return this.authService.confirmPasswordReset(dto.token, dto.newPassword);
  }

  @Get('google')
  @UseGuards(GoogleOAuthEnabledGuard, GoogleAuthGuard)
  googleAuth(): void {
    // Redirects to Google — handled by Passport
  }

  @Get('google/callback')
  @UseGuards(GoogleOAuthEnabledGuard, GoogleAuthGuard)
  async googleCallback(
    @Req() req: Request & { user: OAuthProfile },
    @Res() res: Response,
  ): Promise<void> {
    return this.handleOAuthCallback(Provider.Google, req.user, req, res);
  }

  @Get('facebook')
  @UseGuards(FacebookOAuthEnabledGuard, FacebookAuthGuard)
  facebookAuth(): void {
    // Redirects to Facebook — handled by Passport
  }

  @Get('facebook/callback')
  @UseGuards(FacebookOAuthEnabledGuard, FacebookAuthGuard)
  async facebookCallback(
    @Req() req: Request & { user: OAuthProfile },
    @Res() res: Response,
  ): Promise<void> {
    return this.handleOAuthCallback(Provider.Facebook, req.user, req, res);
  }

  @Post('user/link-oauth')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  linkOAuth(
    @Req() req: Request & { user: JwtPayload },
    @Body() dto: LinkOauthDto,
  ): Promise<void> {
    return this.authService.linkOAuthIdentity(
      req.user.sub,
      req.user.role,
      dto.linkToken,
    );
  }

  @Get('user/profile')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  getUserProfile(
    @Req() req: Request & { user: JwtPayload },
  ): Promise<UserProfileView> {
    return this.authService.getCurrentUserProfile(req.user.sub, req.user.role);
  }

  @Patch('user/profile')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  updateUserProfile(
    @Req() req: Request & { user: JwtPayload },
    @Body() dto: UpdateUserProfileDto,
  ): Promise<UserProfileView> {
    return this.authService.updateCurrentUserProfile(
      req.user.sub,
      req.user.role,
      dto,
    );
  }

  @Patch('user/password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  changeUserPassword(
    @Req() req: Request & { user: JwtPayload },
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    return this.authService.changeCurrentUserPassword(
      req.user.sub,
      req.user.role,
      dto.currentPassword,
      dto.newPassword,
    );
  }

  @Post('user/refresh')
  @UseGuards(JwtRefreshGuard, AuthScopeGuard)
  @AuthScope({ role: 'user', client: 'user-web' })
  @HttpCode(HttpStatus.OK)
  async refreshUserTokens(
    @Req() req: Request & { user: JwtRefreshPayload },
    @Res({ passthrough: true }) res: Response,
  ): Promise<AccessTokenResponse> {
    const tokens = await this.authService.refreshTokens(
      req.user.sub,
      req.user.role,
      req.user.refreshToken,
      'user-web',
    );
    this.setRefreshTokenCookie(res, tokens.refreshToken, 'user');
    return { accessToken: tokens.accessToken };
  }

  @Post('refresh')
  @UseGuards(JwtRefreshGuard, AuthScopeGuard)
  @AuthScope({ role: 'user', client: 'user-web' })
  @HttpCode(HttpStatus.OK)
  refreshTokensAlias(
    @Req() req: Request & { user: JwtRefreshPayload },
    @Res({ passthrough: true }) res: Response,
  ): Promise<AccessTokenResponse> {
    return this.refreshUserTokens(req, res);
  }

  @Post('admin/refresh')
  @UseGuards(JwtRefreshGuard, AuthScopeGuard)
  @AuthScope({ role: 'admin', client: 'admin-web' })
  @HttpCode(HttpStatus.OK)
  async refreshAdminTokens(
    @Req() req: Request & { user: JwtRefreshPayload },
    @Res({ passthrough: true }) res: Response,
  ): Promise<AccessTokenResponse> {
    const tokens = await this.authService.refreshTokens(
      req.user.sub,
      req.user.role,
      req.user.refreshToken,
      'admin-web',
    );
    this.setRefreshTokenCookie(res, tokens.refreshToken, 'admin');
    return { accessToken: tokens.accessToken };
  }

  @Post('app/refresh')
  @UseGuards(JwtRefreshGuard, AuthScopeGuard)
  @AuthScope({ role: 'user', client: 'user-app' })
  @HttpCode(HttpStatus.OK)
  refreshAppTokens(
    @Req() req: Request & { user: JwtRefreshPayload },
  ): Promise<TokenPair> {
    return this.authService.refreshTokens(
      req.user.sub,
      req.user.role,
      req.user.refreshToken,
      'user-app',
    );
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard, AuthScopeGuard)
  @AuthScope({ role: 'user', client: 'user-web' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() req: Request & { user: JwtPayload },
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.authService.logout(
      req.user.sub,
      req.user.role,
      'user-web',
      req.user.jti,
      req.user.exp,
    );
    this.clearRefreshTokenCookie(res, 'user');
  }

  @Post('user/logout')
  @UseGuards(JwtAuthGuard, AuthScopeGuard)
  @AuthScope({ role: 'user', client: 'user-web' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async logoutUser(
    @Req() req: Request & { user: JwtPayload },
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.logout(req, res);
  }

  @Post('admin/logout')
  @UseGuards(JwtAuthGuard, AuthScopeGuard)
  @AuthScope({ role: 'admin', client: 'admin-web' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async logoutAdmin(
    @Req() req: Request & { user: JwtPayload },
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.authService.logout(
      req.user.sub,
      req.user.role,
      'admin-web',
      req.user.jti,
      req.user.exp,
    );
    this.clearRefreshTokenCookie(res, 'admin');
  }

  @Post('app/logout')
  @UseGuards(JwtAuthGuard, AuthScopeGuard)
  @AuthScope({ role: 'user', client: 'user-app' })
  @HttpCode(HttpStatus.NO_CONTENT)
  logoutApp(@Req() req: Request & { user: JwtPayload }): Promise<void> {
    return this.authService.logout(
      req.user.sub,
      req.user.role,
      'user-app',
      req.user.jti,
      req.user.exp,
    );
  }

  private async handleOAuthCallback(
    provider: Provider,
    profile: OAuthProfile,
    req: Request,
    res: Response,
  ): Promise<void> {
    try {
      const linkingUserId = await this.resolveOAuthLinkingUserId(req);
      const tokens = await this.authService.authenticateOAuth(
        provider,
        profile,
        { linkingUserId },
      );
      this.setRefreshTokenCookie(res, tokens.refreshToken, 'user');

      const redirectUrl = this.buildOAuthRedirectUrl({
        status: 'success',
        provider,
      });
      if (redirectUrl) {
        res.redirect(redirectUrl);
        return;
      }

      res.status(HttpStatus.OK).json({
        status: 'success',
        provider,
        accessToken: tokens.accessToken,
      });
      return;
    } catch (error) {
      const status =
        error instanceof HttpException
          ? error.getStatus()
          : HttpStatus.INTERNAL_SERVER_ERROR;
      const response =
        error instanceof HttpException ? error.getResponse() : undefined;
      const payload =
        typeof response === 'object' && response ? response : undefined;
      const message =
        typeof payload === 'object' &&
        payload &&
        'message' in payload &&
        typeof payload.message === 'string'
          ? payload.message
          : error instanceof Error
            ? error.message
            : 'OAuth authentication failed.';
      const code =
        typeof payload === 'object' &&
        payload &&
        'code' in payload &&
        typeof payload.code === 'string'
          ? payload.code
          : 'OAUTH_CALLBACK_FAILED';

      const redirectUrl = this.buildOAuthRedirectUrl({
        status: code === 'ACCOUNT_LINK_REQUIRED' ? 'link_required' : 'error',
        provider,
        code,
        message,
        email:
          typeof payload === 'object' &&
          payload &&
          'email' in payload &&
          typeof payload.email === 'string'
            ? payload.email
            : undefined,
        linkToken:
          typeof payload === 'object' &&
          payload &&
          'linkToken' in payload &&
          typeof payload.linkToken === 'string'
            ? payload.linkToken
            : undefined,
      });
      if (redirectUrl) {
        res.redirect(redirectUrl);
        return;
      }

      res.status(status).json({
        status: code === 'ACCOUNT_LINK_REQUIRED' ? 'link_required' : 'error',
        provider,
        code,
        message,
        email:
          typeof payload === 'object' &&
          payload &&
          'email' in payload &&
          typeof payload.email === 'string'
            ? payload.email
            : undefined,
        linkToken:
          typeof payload === 'object' &&
          payload &&
          'linkToken' in payload &&
          typeof payload.linkToken === 'string'
            ? payload.linkToken
            : undefined,
      });
    }
  }

  private async resolveOAuthLinkingUserId(
    req: Request,
  ): Promise<string | null> {
    const auth = this.configService.get<AuthConfig>('auth');
    const cookieName = auth?.refreshCookie?.user?.name;
    if (!cookieName) {
      return null;
    }

    const cookies = (req as Request & { cookies?: unknown }).cookies;
    const rawToken =
      typeof cookies === 'object' && cookies !== null
        ? (cookies as Record<string, unknown>)[cookieName]
        : undefined;
    if (typeof rawToken !== 'string' || !rawToken.trim()) {
      return null;
    }

    return this.authService.resolveActiveWebUserIdFromRefreshToken(rawToken);
  }

  private setRefreshTokenCookie(
    res: Response,
    refreshToken: string,
    audience: BrowserRefreshAudience,
  ): void {
    const auth = this.configService.get<AuthConfig>('auth')!;
    const cookieConfig =
      audience === 'admin' ? auth.refreshCookie.admin : auth.refreshCookie.user;
    const expiresAt = this.readTokenExpiry(refreshToken);
    res.cookie(cookieConfig.name, refreshToken, {
      httpOnly: true,
      secure: cookieConfig.secure,
      sameSite: cookieConfig.sameSite,
      path: cookieConfig.path,
      domain: cookieConfig.domain || undefined,
      expires: expiresAt,
    });
  }

  private clearRefreshTokenCookie(
    res: Response,
    audience: BrowserRefreshAudience,
  ): void {
    const auth = this.configService.get<AuthConfig>('auth')!;
    const cookieConfig =
      audience === 'admin' ? auth.refreshCookie.admin : auth.refreshCookie.user;
    res.clearCookie(cookieConfig.name, {
      httpOnly: true,
      secure: cookieConfig.secure,
      sameSite: cookieConfig.sameSite,
      path: cookieConfig.path,
      domain: cookieConfig.domain || undefined,
    });
  }

  private readTokenExpiry(token: string): Date | undefined {
    const parts = token.split('.');
    if (parts.length < 2) {
      return undefined;
    }

    try {
      const payload = JSON.parse(
        Buffer.from(parts[1], 'base64url').toString('utf8'),
      ) as { exp?: number };
      return typeof payload.exp === 'number'
        ? new Date(payload.exp * 1000)
        : undefined;
    } catch {
      return undefined;
    }
  }

  private buildOAuthRedirectUrl(
    params: Record<string, string | undefined>,
  ): string | null {
    const auth = this.configService.get<AuthConfig>('auth');
    const baseUrl = auth?.webAppBaseUrl?.trim();
    if (!baseUrl) {
      return null;
    }

    let normalizedBase = baseUrl;
    while (normalizedBase.endsWith('/')) {
      normalizedBase = normalizedBase.slice(0, -1);
    }

    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value) {
        search.set(key, value);
      }
    }

    return `${normalizedBase}/#/oauth/callback?${search.toString()}`;
  }
}
