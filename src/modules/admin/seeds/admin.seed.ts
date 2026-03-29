import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { AuthConfig } from '../../../config/auth.config';
import { AdminService } from '../admin.service';

@Injectable()
export class AdminSeed {
  private readonly logger = new Logger(AdminSeed.name);

  constructor(
    private readonly adminService: AdminService,
    private readonly configService: ConfigService,
  ) {}

  async seed(): Promise<void> {
    const auth = this.configService.get<AuthConfig>('auth')!;
    const existing = await this.adminService.findByEmail(auth.admin.email);

    if (existing) {
      this.logger.log('Admin already exists');
      return;
    }

    const password = await bcrypt.hash(auth.admin.password, 10);

    await this.adminService.create({
      email: auth.admin.email,
      passwordHash: password,
    });

    this.logger.log('Super admin created');
  }
}
