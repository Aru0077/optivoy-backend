import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum Provider {
  Google = 'google',
  Facebook = 'facebook',
}

export enum UserStatus {
  Active = 'active',
  Suspended = 'suspended',
  Banned = 'banned',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Login account: can be email/username/phone.
  @Column({ unique: true })
  account: string;

  @Column()
  name: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  avatar: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  passwordHash: string | null;

  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.Active })
  status: UserStatus;

  @Column({ type: 'varchar', length: 255, nullable: true })
  statusReason: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  emailVerifiedAt: Date | null;

  // Verified email address for password reset and notifications.
  @Column({ type: 'varchar', length: 254, nullable: true, unique: true })
  email: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  hashedRefreshToken: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  hashedAppRefreshToken: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
