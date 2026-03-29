import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { Strategy } from 'passport-local';
import { Admin } from '../../admin/entities/admin.entity';
import { AuthService } from '../auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy, 'local') {
  constructor(private readonly authService: AuthService) {
    super({ usernameField: 'email', passReqToCallback: true });
  }

  async validate(
    req: Request,
    email: string,
    password: string,
  ): Promise<Admin> {
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    const admin = await this.authService.validateAdminCredentials(
      email,
      password,
      ip,
    );
    if (!admin) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return admin;
  }
}
