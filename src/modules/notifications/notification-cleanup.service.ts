import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { UserNotification } from './entities/user-notification.entity';

const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000;
const READ_NOTIFICATION_RETENTION_DAYS = 30;

@Injectable()
export class NotificationCleanupService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(NotificationCleanupService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    @InjectRepository(UserNotification)
    private readonly notificationRepository: Repository<UserNotification>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.cleanupExpiredNotifications();
    this.timer = setInterval(() => {
      void this.cleanupExpiredNotifications();
    }, CLEANUP_INTERVAL_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (!this.timer) {
      return;
    }
    clearInterval(this.timer);
    this.timer = null;
  }

  async cleanupExpiredNotifications(): Promise<void> {
    if (!(await this.notificationTableExists())) {
      this.logger.debug(
        'user_notifications table is not available yet, skip cleanup cycle',
      );
      return;
    }

    const cutoff = new Date(
      Date.now() - READ_NOTIFICATION_RETENTION_DAYS * 24 * 60 * 60 * 1000,
    );
    const result = await this.notificationRepository.delete({
      isRead: true,
      readAt: LessThan(cutoff),
    });

    if ((result.affected ?? 0) > 0) {
      this.logger.log(`Cleaned ${result.affected} expired notifications`);
    }
  }

  private async notificationTableExists(): Promise<boolean> {
    const rawResult: unknown = await this.notificationRepository.query(
      `SELECT to_regclass('public.user_notifications') AS "tableName"`,
    );
    if (!Array.isArray(rawResult)) {
      return false;
    }

    const first = (rawResult as unknown[])[0];
    if (!first || typeof first !== 'object') {
      return false;
    }

    const tableName =
      'tableName' in first
        ? (first as { tableName?: unknown }).tableName
        : undefined;

    return typeof tableName === 'string' && tableName.length > 0;
  }
}
