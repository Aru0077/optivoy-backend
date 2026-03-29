import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum UserNotificationType {
  ReviewReply = 'review_reply',
  ReplyReply = 'reply_reply',
}

@Entity('user_notifications')
@Index('IDX_user_notifications_user_is_read_created_at', [
  'userId',
  'isRead',
  'createdAt',
])
@Index('IDX_user_notifications_user_created_at', ['userId', 'createdAt'])
export class UserNotification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({
    type: 'enum',
    enum: UserNotificationType,
  })
  type: UserNotificationType;

  @Column({ type: 'varchar', length: 160 })
  title: string;

  @Column({ type: 'varchar', length: 500 })
  content: string;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  data: Record<string, string | number | boolean | null>;

  @Column({ type: 'boolean', default: false })
  isRead: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  readAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
