import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { UploadBatch } from './upload-batch.entity';

export type UploadBatchItemStatus = 'processing' | 'completed';
export type UploadModerationStatus = 'pass' | 'skipped';

@Entity('upload_batch_items')
@Unique('UQ_upload_batch_items_batch_key', ['batchId', 'objectKey'])
@Index('IDX_upload_batch_items_batch_created_at', ['batchId', 'createdAt'])
export class UploadBatchItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  batchId: string;

  @ManyToOne(() => UploadBatch, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'batchId' })
  batch: UploadBatch;

  @Column({ type: 'varchar', length: 512 })
  objectKey: string;

  @Column({ type: 'varchar', length: 16 })
  status: UploadBatchItemStatus;

  @Column({ type: 'integer', nullable: true })
  size: number | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  mimeType: string | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  moderationStatus: UploadModerationStatus | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  moderationRequestId: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  moderationRiskLevel: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
