import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Admin } from './entities/admin.entity';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(Admin)
    private readonly adminsRepository: Repository<Admin>,
  ) {}

  findById(id: string): Promise<Admin | null> {
    return this.adminsRepository.findOneBy({ id });
  }

  findByEmail(email: string): Promise<Admin | null> {
    return this.adminsRepository.findOneBy({ email });
  }

  create(data: { email: string; passwordHash: string }): Promise<Admin> {
    const admin = this.adminsRepository.create(data);
    return this.adminsRepository.save(admin);
  }

  async validatePassword(
    email: string,
    plainPassword: string,
  ): Promise<Admin | null> {
    const admin = await this.findByEmail(email);
    if (!admin) return null;
    const matches = await bcrypt.compare(plainPassword, admin.passwordHash);
    return matches ? admin : null;
  }

  async setRefreshToken(adminId: string, token: string | null): Promise<void> {
    const hashedRefreshToken = token ? await bcrypt.hash(token, 10) : null;
    await this.adminsRepository.update(adminId, { hashedRefreshToken });
  }
}
