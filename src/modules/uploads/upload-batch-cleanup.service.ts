import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { UploadBatch } from './entities/upload-batch.entity';

const CLEANUP_INTERVAL_MS = 15 * 60 * 1000;

@Injectable()
export class UploadBatchCleanupService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(UploadBatchCleanupService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    @InjectRepository(UploadBatch)
    private readonly uploadBatchRepository: Repository<UploadBatch>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.cleanupExpiredBatches();
    this.timer = setInterval(() => {
      void this.cleanupExpiredBatches();
    }, CLEANUP_INTERVAL_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async cleanupExpiredBatches(): Promise<void> {
    if (!(await this.uploadBatchTableExists())) {
      this.logger.debug(
        'upload_batches table is not available yet, skip cleanup cycle',
      );
      return;
    }

    const result = await this.uploadBatchRepository.delete({
      expiresAt: LessThan(new Date()),
    });
    if ((result.affected ?? 0) > 0) {
      this.logger.log(`Cleaned ${result.affected} expired upload batches`);
    }
  }

  private async uploadBatchTableExists(): Promise<boolean> {
    const result = (await this.uploadBatchRepository.query(
      `SELECT to_regclass('public.upload_batches') AS "tableName"`,
    )) as unknown as Array<{ tableName?: string | null }>;

    return Boolean(result[0]?.tableName);
  }
}
