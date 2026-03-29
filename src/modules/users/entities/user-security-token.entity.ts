import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';

export enum UserSecurityTokenType {
  EmailVerification = 'email_verification',
  PasswordReset = 'password_reset',
}

@Entity('user_security_tokens')
@Index('IDX_user_security_tokens_token_hash', ['tokenHash'])
@Index('IDX_user_security_tokens_user_type', ['userId', 'type'])
export class UserSecurityToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({
    type: 'enum',
    enum: UserSecurityTokenType,
  })
  type: UserSecurityTokenType;

  @Column()
  tokenHash: string;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  usedAt: Date | null;

  // For email_verification tokens: the email address to bind upon confirmation.
  @Column({ type: 'varchar', length: 254, nullable: true })
  targetEmail: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
