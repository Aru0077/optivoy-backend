import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../../app.module';
import { AdminSeed } from './admin.seed';

async function runAdminSeed(): Promise<void> {
  const logger = new Logger('AdminSeedRunner');
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const adminSeed = app.get(AdminSeed);
    await adminSeed.seed();
    logger.log('Admin seed finished');
  } finally {
    await app.close();
  }
}

void runAdminSeed();
