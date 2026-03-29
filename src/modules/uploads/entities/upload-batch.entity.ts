import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('upload_batches')
@Index('IDX_upload_batches_actor_expires_at', [
  'actorRole',
  'actorId',
  'expiresAt',
])
export class UploadBatch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 16 })
  actorRole: 'admin' | 'user';

  @Column({ type: 'uuid' })
  actorId: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  folder: string | null;

  @Column({ type: 'varchar', length: 255 })
  dir: string;

  @Column({ type: 'integer' })
  allowedCount: number;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
