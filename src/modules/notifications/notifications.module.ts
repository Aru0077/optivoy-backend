import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthModule } from '../auth/auth.module';
import { User } from '../users/entities/user.entity';
import { UsersModule } from '../users/users.module';
import { NotificationCleanupService } from './notification-cleanup.service';
import { NotificationDigestService } from './notification-digest.service';
import { UserNotification } from './entities/user-notification.entity';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([UserNotification, User]),
    UsersModule,
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationCleanupService,
    NotificationDigestService,
    RolesGuard,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
