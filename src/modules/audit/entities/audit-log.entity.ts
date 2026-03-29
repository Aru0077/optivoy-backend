import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum AuditActorType {
  Admin = 'admin',
  User = 'user',
  System = 'system',
}

@Entity('audit_logs')
@Index('IDX_audit_logs_created_at', ['createdAt'])
@Index('IDX_audit_logs_action', ['action'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: AuditActorType,
  })
  actorType: AuditActorType;

  @Column({ type: 'uuid', nullable: true })
  actorId: string | null;

  @Column()
  action: string;

  @Column()
  targetType: string;

  @Column({ type: 'uuid', nullable: true })
  targetId: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;
}
