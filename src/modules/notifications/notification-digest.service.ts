import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailService } from '../auth/email.service';
import { User } from '../users/entities/user.entity';
import { UserNotification } from './entities/user-notification.entity';

const DIGEST_PREVIEW_LIMIT = 5;
const DIGEST_HOUR_LOCAL = 9;

interface DigestRecipient {
  id: string;
  email: string;
  unreadCount: string;
}

@Injectable()
export class NotificationDigestService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(NotificationDigestService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    @InjectRepository(UserNotification)
    private readonly notificationRepository: Repository<UserNotification>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly emailService: EmailService,
  ) {}

  onModuleInit(): void {
    this.scheduleNextRun();
  }

  onModuleDestroy(): void {
    if (!this.timer) {
      return;
    }
    clearTimeout(this.timer);
    this.timer = null;
  }

  async sendUnreadDigests(): Promise<void> {
    if (!(await this.notificationTableExists())) {
      this.logger.debug(
        'user_notifications table is not available yet, skip digest cycle',
      );
      return;
    }

    const recipients = await this.userRepository
      .createQueryBuilder('user')
      .innerJoin(
        UserNotification,
        'notification',
        'notification."userId" = user.id AND notification."isRead" = false',
      )
      .select('user.id', 'id')
      .addSelect('user.email', 'email')
      .addSelect('COUNT(notification.id)', 'unreadCount')
      .where('user.email IS NOT NULL')
      .andWhere('user.emailVerifiedAt IS NOT NULL')
      .groupBy('user.id')
      .addGroupBy('user.email')
      .getRawMany<DigestRecipient>();

    for (const recipient of recipients) {
      const unreadCount = parseInt(recipient.unreadCount, 10);
      if (!Number.isFinite(unreadCount) || unreadCount <= 0) {
        continue;
      }

      const items = await this.notificationRepository.find({
        where: {
          userId: recipient.id,
          isRead: false,
        },
        order: { createdAt: 'DESC' },
        take: DIGEST_PREVIEW_LIMIT,
      });

      try {
        await this.emailService.sendUnreadNotificationDigest(recipient.email, {
          unreadCount,
          items: items.map((item) => ({
            title: item.title,
            content: item.content,
            createdAt: item.createdAt,
          })),
        });
      } catch (error) {
        this.logger.error(
          `Failed to send unread notification digest to ${recipient.email}: ${(error as Error).message}`,
        );
      }
    }

    if (recipients.length > 0) {
      this.logger.log(`Sent ${recipients.length} unread notification digests`);
    }
  }

  private scheduleNextRun(): void {
    const delayMs = this.msUntilNextDigestWindow();
    this.timer = setTimeout(() => {
      void this.runAndReschedule();
    }, delayMs);
    this.timer.unref();
  }

  private async runAndReschedule(): Promise<void> {
    try {
      await this.sendUnreadDigests();
    } finally {
      this.scheduleNextRun();
    }
  }

  private msUntilNextDigestWindow(): number {
    const now = new Date();
    const next = new Date(now);
    next.setHours(DIGEST_HOUR_LOCAL, 0, 0, 0);
    if (next.getTime() <= now.getTime()) {
      next.setDate(next.getDate() + 1);
    }
    return next.getTime() - now.getTime();
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
