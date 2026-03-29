import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';
import {
  UserNotification,
  UserNotificationType,
} from './entities/user-notification.entity';

interface NotificationData {
  [key: string]: string | number | boolean | null;
}

export interface NotificationView {
  id: string;
  type: UserNotificationType;
  title: string;
  content: string;
  data: NotificationData;
  isRead: boolean;
  readAt: Date | null;
  createdAt: Date;
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(UserNotification)
    private readonly notificationRepository: Repository<UserNotification>,
  ) {}

  async listUserNotifications(
    userId: string,
    query: ListNotificationsQueryDto,
  ): Promise<{
    total: number;
    unreadCount: number;
    items: NotificationView[];
  }> {
    const where = query.unreadOnly ? { userId, isRead: false } : { userId };

    const [items, total, unreadCount] = await Promise.all([
      this.notificationRepository.find({
        where,
        order: { createdAt: 'DESC' },
        take: query.limit,
        skip: query.offset,
      }),
      this.notificationRepository.count({ where }),
      this.notificationRepository.count({
        where: { userId, isRead: false },
      }),
    ]);

    return {
      total,
      unreadCount,
      items: items.map((item) => this.mapNotification(item)),
    };
  }

  async getUnreadCount(userId: string): Promise<{ unreadCount: number }> {
    const unreadCount = await this.notificationRepository.count({
      where: { userId, isRead: false },
    });
    return { unreadCount };
  }

  async markAsRead(userId: string, notificationId: string): Promise<void> {
    const target = await this.notificationRepository.findOneBy({
      id: notificationId,
      userId,
    });
    if (!target) {
      throw new NotFoundException({
        code: 'NOTIFICATION_NOT_FOUND',
        message: 'Notification not found.',
      });
    }

    if (!target.isRead) {
      target.isRead = true;
      target.readAt = new Date();
      await this.notificationRepository.save(target);
    }
  }

  async markAllAsRead(userId: string): Promise<{ updated: number }> {
    const result = await this.notificationRepository
      .createQueryBuilder()
      .update(UserNotification)
      .set({
        isRead: true,
        readAt: () => 'NOW()',
      })
      .where('"userId" = :userId', { userId })
      .andWhere('"isRead" = false')
      .execute();

    return { updated: result.affected ?? 0 };
  }

  async createNotification(input: {
    userId: string;
    type: UserNotificationType;
    title: string;
    content: string;
    data?: NotificationData;
  }): Promise<NotificationView> {
    const created = this.notificationRepository.create({
      userId: input.userId,
      type: input.type,
      title: input.title.trim(),
      content: input.content.trim(),
      data: input.data ?? {},
      isRead: false,
      readAt: null,
    });
    const saved = await this.notificationRepository.save(created);
    return this.mapNotification(saved);
  }

  private mapNotification(item: UserNotification): NotificationView {
    return {
      id: item.id,
      type: item.type,
      title: item.title,
      content: item.content,
      data: (item.data ?? {}) as NotificationData,
      isRead: item.isRead,
      readAt: item.readAt,
      createdAt: item.createdAt,
    };
  }
}
