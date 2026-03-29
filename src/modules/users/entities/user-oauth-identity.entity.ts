import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Provider, User } from './user.entity';

@Entity('user_oauth_identities')
@Unique('UQ_provider_provider_user_id', ['provider', 'providerUserId'])
@Unique('UQ_user_provider', ['userId', 'provider'])
export class UserOauthIdentity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'enum', enum: Provider })
  provider: Provider;

  @Column()
  providerUserId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  providerEmail: string | null;
}
