import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { AuditActorType, AuditLog } from './entities/audit-log.entity';

export interface CreateAuditLogInput {
  actorType: AuditActorType;
  actorId?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface AuditLogQuery {
  actorType?: AuditActorType;
  action?: string;
  targetType?: string;
  limit?: number;
  offset?: number;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  async create(input: CreateAuditLogInput): Promise<AuditLog> {
    const log = this.auditLogRepository.create({
      actorType: input.actorType,
      actorId: input.actorId ?? null,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId ?? null,
      metadata: input.metadata ?? null,
    });
    return this.auditLogRepository.save(log);
  }

  async findMany(
    query: AuditLogQuery,
  ): Promise<{ total: number; items: AuditLog[] }> {
    const where: FindOptionsWhere<AuditLog> = {};
    if (query.actorType) where.actorType = query.actorType;
    if (query.action) where.action = query.action;
    if (query.targetType) where.targetType = query.targetType;

    const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
    const offset = Math.max(query.offset ?? 0, 0);

    const [items, total] = await this.auditLogRepository.findAndCount({
      where,
      take: limit,
      skip: offset,
      order: { createdAt: 'DESC' },
    });

    return { total, items };
  }
}
