import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import OSS from 'ali-oss';
import GreenClient, { ImageModerationRequest } from '@alicloud/green20220302';
import { $OpenApiUtil } from '@alicloud/openapi-core';
import { randomUUID } from 'crypto';
import { DataSource, Repository } from 'typeorm';
import { OssConfig } from '../../config/oss.config';
import { UploadBatchItem } from './entities/upload-batch-item.entity';
import { UploadBatch } from './entities/upload-batch.entity';

type AppRole = 'admin' | 'user';

interface ModerationDecision {
  status: 'pass' | 'review' | 'reject' | 'skipped';
  requestId: string | null;
  riskLevel: string | null;
}

export interface UploadedFileItem {
  key: string;
  url: string;
  mimeType: string;
  size: number;
  moderation: {
    status: 'pass' | 'skipped';
    requestId: string | null;
    riskLevel: string | null;
  };
}

export interface StsCredentialOutput {
  batchId: string;
  region: string;
  bucket: string;
  endpoint: string;
  dir: string;
  accessKeyId: string;
  accessKeySecret: string;
  securityToken: string;
  expiration: string;
  maxFileSizeMb: number;
  maxFilesPerRequest: number;
}

interface CompletedUploadRecord {
  key: string;
  size: number;
  mimeType: string;
  moderation: {
    status: 'pass' | 'skipped';
    requestId: string | null;
    riskLevel: string | null;
  };
}

interface ImageMetadata {
  width: number;
  height: number;
  format: string;
}

interface ImageDimensionLimits {
  profile: 'default' | 'home-banner';
  minWidth: number;
  minHeight: number;
  maxWidth: number;
  maxHeight: number;
}

@Injectable()
export class UploadsService {
  private readonly config: OssConfig;
  private readonly client: OSS | null;
  private readonly stsClient: OSS.STS | null;
  private readonly greenClient: GreenClient | null;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(UploadBatch)
    private readonly uploadBatchRepository: Repository<UploadBatch>,
    @InjectRepository(UploadBatchItem)
    private readonly uploadBatchItemRepository: Repository<UploadBatchItem>,
    private readonly dataSource: DataSource,
  ) {
    this.config = this.configService.get<OssConfig>('oss') as OssConfig;
    this.client = this.createClient(this.config);
    this.stsClient = this.createStsClient(this.config);
    this.greenClient = this.createGreenClient(this.config);
  }

  async createStsCredential(input: {
    role: AppRole;
    userId: string;
    folder?: string;
  }): Promise<StsCredentialOutput> {
    if (!this.config.enabled || !this.stsClient) {
      throw new ServiceUnavailableException({
        code: 'OSS_STS_DISABLED',
        message: 'STS upload is disabled on this server.',
      });
    }
    if (!this.config.stsRoleArn) {
      throw new ServiceUnavailableException({
        code: 'OSS_STS_MISCONFIGURED',
        message: 'STS role is not configured.',
      });
    }

    const batchId = randomUUID();
    const normalizedFolder = input.folder
      ? this.resolvePrefix(input.folder)
      : null;
    const dir = this.buildStsObjectDir(
      input.role,
      input.userId,
      batchId,
      normalizedFolder,
    );
    const policy = {
      Version: '1',
      Statement: [
        {
          Effect: 'Allow',
          Action: [
            'oss:PutObject',
            'oss:PutObjectAcl',
            'oss:AbortMultipartUpload',
            'oss:ListParts',
          ],
          Resource: [`acs:oss:*:*:${this.config.bucket}/${dir}/*`],
        },
      ],
    };

    const sessionName = `optivoy-${input.role}-${input.userId}`
      .replace(/[^A-Za-z0-9-=,.@_]/g, '-')
      .slice(0, 64);

    try {
      const { credentials } = await this.stsClient.assumeRole(
        this.config.stsRoleArn,
        policy,
        this.config.stsTokenExpiresSeconds,
        sessionName,
      );

      await this.uploadBatchRepository.save(
        this.uploadBatchRepository.create({
          id: batchId,
          actorRole: input.role,
          actorId: input.userId,
          folder: normalizedFolder,
          dir,
          allowedCount: this.config.maxFilesPerRequest,
          expiresAt: new Date(credentials.Expiration),
        }),
      );

      return {
        batchId,
        region: this.config.region,
        bucket: this.config.bucket,
        endpoint: this.buildOssHost(),
        dir,
        accessKeyId: credentials.AccessKeyId,
        accessKeySecret: credentials.AccessKeySecret,
        securityToken: credentials.SecurityToken,
        expiration: credentials.Expiration,
        maxFileSizeMb: this.config.maxFileSizeMb,
        maxFilesPerRequest: this.config.maxFilesPerRequest,
      };
    } catch (error) {
      throw new ServiceUnavailableException({
        code: 'OSS_STS_ASSUME_ROLE_FAILED',
        message: 'Failed to create STS credential.',
        details:
          error instanceof Error
            ? error.message
            : 'Unknown STS assume-role error',
      });
    }
  }

  async completeDirectUpload(input: {
    batchId: string;
    role: AppRole;
    userId: string;
    key: string;
  }): Promise<UploadedFileItem> {
    if (!this.config.enabled || !this.client) {
      throw new ServiceUnavailableException({
        code: 'OSS_DISABLED',
        message: 'OSS upload is disabled on this server.',
      });
    }

    const key = this.normalizeUploadedKey(input.key);
    const reservation = await this.reserveUploadSlot({
      batchId: input.batchId,
      role: input.role,
      userId: input.userId,
      key,
    }).catch(async (error: unknown) => {
      const code = this.extractErrorCode(error);
      if (
        code === 'UPLOAD_BATCH_EXPIRED' ||
        code === 'UPLOAD_BATCH_LIMIT_EXCEEDED'
      ) {
        await this.safeDeleteObject(key);
      }
      throw error;
    });

    if (reservation.kind === 'existing') {
      return this.toUploadedFileItem(reservation.record);
    }

    const url = this.buildFallbackPublicUrl(key);
    try {
      const inspection = await this.inspectUploadedObjectOrThrow(key);
      await this.validateUploadedImageOrThrow(key, inspection.mimeType);
      await this.ensureUploadedObjectAclOrThrow(key);
      const moderation = await this.moderateUploadedObjectOrThrow(key, url);

      const completedRecord: CompletedUploadRecord = {
        key,
        size: inspection.size,
        mimeType: inspection.mimeType,
        moderation: {
          status: moderation.status,
          requestId: moderation.requestId,
          riskLevel: moderation.riskLevel,
        },
      };

      await this.finalizeUploadSlot(reservation.batchItemId, completedRecord);

      return this.toUploadedFileItem(completedRecord);
    } catch (error) {
      await this.releaseUploadSlot(reservation.batchItemId);
      throw error;
    }
  }

  getLimits(): { maxFileSizeMb: number; maxFilesPerRequest: number } {
    return {
      maxFileSizeMb: this.config.maxFileSizeMb,
      maxFilesPerRequest: this.config.maxFilesPerRequest,
    };
  }

  private createClient(config: OssConfig): OSS | null {
    if (
      !config.enabled ||
      !config.region ||
      !config.bucket ||
      !config.accessKeyId ||
      !config.accessKeySecret
    ) {
      return null;
    }

    return new OSS({
      region: config.region,
      bucket: config.bucket,
      accessKeyId: config.accessKeyId,
      accessKeySecret: config.accessKeySecret,
      secure: true,
      timeout: '30s',
    });
  }

  private createStsClient(config: OssConfig): OSS.STS | null {
    if (
      !config.enabled ||
      !config.accessKeyId ||
      !config.accessKeySecret ||
      !config.bucket
    ) {
      return null;
    }
    return new OSS.STS({
      accessKeyId: config.accessKeyId,
      accessKeySecret: config.accessKeySecret,
    });
  }

  private createGreenClient(config: OssConfig): GreenClient | null {
    if (
      !config.moderationEnabled ||
      !config.moderationAccessKeyId ||
      !config.moderationAccessKeySecret ||
      !config.moderationRegionId ||
      !config.moderationEndpoint
    ) {
      return null;
    }

    const greenConfig = new $OpenApiUtil.Config({
      accessKeyId: config.moderationAccessKeyId,
      accessKeySecret: config.moderationAccessKeySecret,
      regionId: config.moderationRegionId,
      endpoint: config.moderationEndpoint,
    });
    return new GreenClient(greenConfig);
  }

  private resolvePrefix(folder?: string): string {
    const fallback = this.config.uploadPrefix;
    const input = (folder ?? fallback).trim();
    if (!input) {
      return fallback.replace(/^\/+|\/+$/g, '');
    }
    if (input.includes('..')) {
      throw new BadRequestException({
        code: 'INVALID_UPLOAD_FOLDER',
        message: 'Upload folder is invalid.',
      });
    }
    const normalized = input.replace(/^\/+|\/+$/g, '').replace(/\/{2,}/g, '/');
    if (!/^[A-Za-z0-9/_-]+$/.test(normalized)) {
      throw new BadRequestException({
        code: 'INVALID_UPLOAD_FOLDER',
        message: 'Upload folder is invalid.',
      });
    }
    return normalized;
  }

  private buildFallbackPublicUrl(key: string): string {
    const customBase = this.config.publicBaseUrl.trim();
    if (customBase) {
      return `${customBase.replace(/\/+$/, '')}/${key}`;
    }
    return `${this.buildOssHost()}/${key}`;
  }

  private buildOssHost(): string {
    return `https://${this.config.bucket}.${this.config.region}.aliyuncs.com`;
  }

  private buildStsObjectDir(
    role: AppRole,
    userId: string,
    batchId: string,
    folder?: string | null,
  ): string {
    const base = this.resolveStsBasePrefix(role, userId);
    const date = new Date();
    const yyyy = date.getUTCFullYear();
    const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(date.getUTCDate()).padStart(2, '0');
    const safeFolder = folder?.trim() ?? '';
    const folderPart = safeFolder ? `${safeFolder}/` : '';
    return `${base}/${folderPart}${yyyy}/${mm}/${dd}/${batchId}`;
  }

  private resolveStsBasePrefix(role: AppRole, userId: string): string {
    const normalizedUserId = userId.replace(/[^A-Za-z0-9-]/g, '');
    const basePrefix =
      role === 'admin' ? this.config.stsAdminPrefix : this.config.stsUserPrefix;
    return `${this.resolvePrefix(basePrefix)}/${normalizedUserId}`;
  }

  private normalizeUploadedKey(key: string): string {
    const normalized = key
      .trim()
      .replace(/^\/+/, '')
      .replace(/\/{2,}/g, '/');
    if (!normalized || normalized.includes('..')) {
      throw new BadRequestException({
        code: 'INVALID_UPLOAD_KEY',
        message: 'Uploaded key is invalid.',
      });
    }
    if (!/^[A-Za-z0-9/_\-.]+$/.test(normalized)) {
      throw new BadRequestException({
        code: 'INVALID_UPLOAD_KEY',
        message: 'Uploaded key is invalid.',
      });
    }
    return normalized;
  }

  private async reserveUploadSlot(input: {
    batchId: string;
    role: AppRole;
    userId: string;
    key: string;
  }): Promise<
    | { kind: 'existing'; record: CompletedUploadRecord }
    | { kind: 'reserved'; batchItemId: string }
  > {
    return this.dataSource.transaction(async (manager) => {
      const batchRepository = manager.getRepository(UploadBatch);
      const batchItemRepository = manager.getRepository(UploadBatchItem);

      const batch = await batchRepository.findOne({
        where: {
          id: input.batchId,
          actorRole: input.role,
          actorId: input.userId,
        },
        lock: { mode: 'pessimistic_write' },
      });
      if (!batch) {
        throw new BadRequestException({
          code: 'UPLOAD_BATCH_NOT_FOUND',
          message: 'Upload batch not found.',
        });
      }
      if (batch.expiresAt.getTime() <= Date.now()) {
        throw new BadRequestException({
          code: 'UPLOAD_BATCH_EXPIRED',
          message:
            'Upload batch has expired. Please request a new upload credential.',
        });
      }
      if (!input.key.startsWith(`${batch.dir}/`)) {
        throw new BadRequestException({
          code: 'INVALID_UPLOAD_KEY',
          message: 'Uploaded key is not allowed for current batch.',
        });
      }

      const existingItem = await batchItemRepository.findOne({
        where: {
          batchId: batch.id,
          objectKey: input.key,
        },
      });
      if (existingItem?.status === 'completed') {
        return {
          kind: 'existing',
          record: this.mapCompletedBatchItem(existingItem),
        };
      }
      if (existingItem) {
        throw new ConflictException({
          code: 'UPLOAD_ALREADY_PROCESSING',
          message: 'This file is already being finalized.',
        });
      }

      const usedCount = await batchItemRepository.count({
        where: { batchId: batch.id },
      });
      if (usedCount >= batch.allowedCount) {
        throw new BadRequestException({
          code: 'UPLOAD_BATCH_LIMIT_EXCEEDED',
          message: `Upload batch supports at most ${batch.allowedCount} files.`,
          details: {
            batchId: batch.id,
            allowedCount: batch.allowedCount,
          },
        });
      }

      const batchItem = await batchItemRepository.save(
        batchItemRepository.create({
          batchId: batch.id,
          objectKey: input.key,
          status: 'processing',
        }),
      );

      return {
        kind: 'reserved',
        batchItemId: batchItem.id,
      };
    });
  }

  private async finalizeUploadSlot(
    batchItemId: string,
    record: CompletedUploadRecord,
  ): Promise<void> {
    const updateResult = await this.uploadBatchItemRepository.update(
      {
        id: batchItemId,
        status: 'processing',
      },
      {
        status: 'completed',
        size: record.size,
        mimeType: record.mimeType,
        moderationStatus: record.moderation.status,
        moderationRequestId: record.moderation.requestId,
        moderationRiskLevel: record.moderation.riskLevel,
      },
    );

    if (!updateResult.affected) {
      throw new InternalServerErrorException({
        code: 'UPLOAD_BATCH_FINALIZE_FAILED',
        message: 'Failed to finalize uploaded file.',
      });
    }
  }

  private async releaseUploadSlot(batchItemId: string): Promise<void> {
    await this.uploadBatchItemRepository.delete({
      id: batchItemId,
      status: 'processing',
    });
  }

  private async inspectUploadedObjectOrThrow(key: string): Promise<{
    size: number;
    mimeType: string;
  }> {
    const maxFileSizeBytes = this.config.maxFileSizeMb * 1024 * 1024;

    try {
      const headResult = await this.client!.head(key);
      const headers = headResult.res.headers as Record<
        string,
        string | undefined
      >;
      const rawSize = headers['content-length'];
      const size = rawSize ? parseInt(rawSize, 10) || 0 : 0;

      if (size > maxFileSizeBytes) {
        await this.safeDeleteObject(key);
        throw new BadRequestException({
          code: 'UPLOAD_FILE_TOO_LARGE',
          message: `Uploaded file exceeds ${this.config.maxFileSizeMb}MB limit.`,
          details: {
            actualBytes: size,
            maxBytes: maxFileSizeBytes,
          },
        });
      }

      return {
        size,
        mimeType:
          headers['content-type']?.split(';')[0]?.trim() ||
          this.guessMimeTypeByKey(key),
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      const code = (error as { code?: string }).code;
      if (code === 'NoSuchKey' || code === 'Not Found') {
        throw new BadRequestException({
          code: 'OBJECT_NOT_FOUND',
          message:
            'The uploaded object was not found. Please upload the file first.',
        });
      }
      throw new ServiceUnavailableException({
        code: 'UPLOAD_OBJECT_INSPECTION_FAILED',
        message: 'Uploaded object inspection failed. Please retry later.',
      });
    }
  }

  private async validateUploadedImageOrThrow(
    key: string,
    mimeType: string,
  ): Promise<void> {
    let metadata: ImageMetadata;
    try {
      metadata = await this.readImageMetadataOrThrow(key);
    } catch (error) {
      if (
        error instanceof BadRequestException &&
        this.extractErrorCode(error) === 'UPLOAD_IMAGE_METADATA_INVALID'
      ) {
        await this.safeDeleteObject(key);
      }
      throw error;
    }
    const normalizedFormat = metadata.format.toLowerCase();
    const allowedFormats = new Set(
      this.config.allowedImageFormats.map((item) => item.toLowerCase()),
    );

    if (!allowedFormats.has(normalizedFormat)) {
      await this.safeDeleteObject(key);
      throw new BadRequestException({
        code: 'UPLOAD_IMAGE_FORMAT_NOT_ALLOWED',
        message: 'Uploaded image format is not allowed.',
        details: {
          actualFormat: normalizedFormat,
          allowedFormats: Array.from(allowedFormats),
        },
      });
    }

    const limits = this.resolveImageDimensionLimitsByKey(key);
    if (
      metadata.width < limits.minWidth ||
      metadata.height < limits.minHeight ||
      metadata.width > limits.maxWidth ||
      metadata.height > limits.maxHeight
    ) {
      await this.safeDeleteObject(key);
      throw new BadRequestException({
        code: 'UPLOAD_IMAGE_DIMENSIONS_INVALID',
        message: 'Uploaded image dimensions are outside the allowed range.',
        details: {
          profile: limits.profile,
          width: metadata.width,
          height: metadata.height,
          minWidth: limits.minWidth,
          minHeight: limits.minHeight,
          maxWidth: limits.maxWidth,
          maxHeight: limits.maxHeight,
        },
      });
    }

    const expectedMimeType = this.mapMimeTypeByFormat(normalizedFormat);
    if (mimeType && expectedMimeType && mimeType !== expectedMimeType) {
      await this.safeDeleteObject(key);
      throw new BadRequestException({
        code: 'UPLOAD_IMAGE_MIME_MISMATCH',
        message: 'Uploaded image MIME type does not match object metadata.',
        details: {
          mimeType,
          format: normalizedFormat,
          expectedMimeType,
        },
      });
    }
  }

  private async readImageMetadataOrThrow(key: string): Promise<ImageMetadata> {
    try {
      const result = await this.client!.get(key, undefined, {
        process: 'image/info',
      });
      const payload = this.parseImageInfoPayload(result.content);
      const width = this.readNumericImageField(payload, [
        'ImageWidth',
        'Width',
        'width',
      ]);
      const height = this.readNumericImageField(payload, [
        'ImageHeight',
        'Height',
        'height',
      ]);
      const format = this.readStringImageField(payload, [
        'Format',
        'format',
        'ImageFormat',
      ]);

      if (!width || !height || !format) {
        throw new Error('Incomplete image metadata response');
      }

      return {
        width,
        height,
        format,
      };
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === 'NoSuchKey' || code === 'Not Found') {
        throw new BadRequestException({
          code: 'OBJECT_NOT_FOUND',
          message:
            'The uploaded object was not found. Please upload the file first.',
        });
      }

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException({
        code: 'UPLOAD_IMAGE_METADATA_INVALID',
        message:
          'Uploaded object is not a valid image or its metadata cannot be read.',
      });
    }
  }

  private parseImageInfoPayload(content: unknown): Record<string, unknown> {
    if (Buffer.isBuffer(content)) {
      const raw = content.toString('utf8').trim();
      if (!raw) {
        throw new Error('Empty image metadata payload');
      }
      return JSON.parse(raw) as Record<string, unknown>;
    }

    if (typeof content === 'object' && content !== null) {
      return content as Record<string, unknown>;
    }

    if (content === null || content === undefined) {
      throw new Error('Empty image metadata payload');
    }

    let raw = '';
    if (typeof content === 'string') {
      raw = content.trim();
    } else if (
      typeof content === 'number' ||
      typeof content === 'boolean' ||
      typeof content === 'bigint'
    ) {
      raw = String(content).trim();
    } else {
      throw new Error('Unsupported image metadata payload type');
    }

    if (!raw) {
      throw new Error('Empty image metadata payload');
    }

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return parsed;
  }

  private readNumericImageField(
    payload: Record<string, unknown>,
    keys: string[],
  ): number | null {
    const value = this.readImageField(payload, keys);
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = parseInt(value, 10);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }

  private readStringImageField(
    payload: Record<string, unknown>,
    keys: string[],
  ): string | null {
    const value = this.readImageField(payload, keys);
    if (typeof value !== 'string') {
      return null;
    }
    const normalized = value.trim().toLowerCase();
    return normalized || null;
  }

  private readImageField(
    payload: Record<string, unknown>,
    keys: string[],
  ): unknown {
    for (const key of keys) {
      const value = payload[key];
      if (
        typeof value === 'object' &&
        value !== null &&
        'value' in value &&
        typeof (value as { value?: unknown }).value !== 'undefined'
      ) {
        return (value as { value: unknown }).value;
      }
      if (typeof value !== 'undefined') {
        return value;
      }
    }
    return undefined;
  }

  private mapMimeTypeByFormat(format: string): string | null {
    switch (format) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'webp':
        return 'image/webp';
      case 'gif':
        return 'image/gif';
      default:
        return null;
    }
  }

  private resolveImageDimensionLimitsByKey(key: string): ImageDimensionLimits {
    const normalizedKey = key.toLowerCase();
    if (/(^|\/)home-banner\//.test(normalizedKey)) {
      return {
        profile: 'home-banner',
        minWidth: this.config.homeBannerMinImageWidth,
        minHeight: this.config.homeBannerMinImageHeight,
        maxWidth: this.config.homeBannerMaxImageWidth,
        maxHeight: this.config.homeBannerMaxImageHeight,
      };
    }
    return {
      profile: 'default',
      minWidth: this.config.minImageWidth,
      minHeight: this.config.minImageHeight,
      maxWidth: this.config.maxImageWidth,
      maxHeight: this.config.maxImageHeight,
    };
  }

  private async moderateUploadedObjectOrThrow(
    key: string,
    url: string,
  ): Promise<{
    status: 'pass' | 'skipped';
    requestId: string | null;
    riskLevel: string | null;
  }> {
    const moderation = await this.moderateByUrl(url, key);
    if (moderation.status === 'pass' || moderation.status === 'skipped') {
      return { ...moderation, status: moderation.status };
    }

    await this.safeDeleteObject(key);
    throw new BadRequestException({
      code: 'IMAGE_MODERATION_REJECTED',
      message: 'Image failed content moderation.',
      details: {
        moderationStatus: moderation.status,
        riskLevel: moderation.riskLevel,
        requestId: moderation.requestId,
      },
    });
  }

  private async ensureUploadedObjectAclOrThrow(key: string): Promise<void> {
    if (!this.client) {
      return;
    }
    const acl = this.config.uploadObjectAcl;
    if (acl === 'inherit') {
      return;
    }

    try {
      await this.client.putACL(key, acl);
    } catch (error) {
      await this.safeDeleteObject(key);
      throw new ServiceUnavailableException({
        code: 'UPLOAD_OBJECT_ACL_UPDATE_FAILED',
        message: 'Failed to set uploaded object access policy.',
        details:
          error instanceof Error
            ? error.message
            : 'Unknown object ACL update error',
      });
    }
  }

  private async moderateByUrl(
    imageUrl: string,
    dataId: string,
  ): Promise<ModerationDecision> {
    if (!this.config.moderationEnabled) {
      return { status: 'skipped', requestId: null, riskLevel: null };
    }
    if (!this.greenClient) {
      if (this.config.moderationFailOpen) {
        return { status: 'skipped', requestId: null, riskLevel: null };
      }
      throw new ServiceUnavailableException({
        code: 'IMAGE_MODERATION_UNAVAILABLE',
        message: 'Image moderation service is unavailable.',
      });
    }

    try {
      const request = new ImageModerationRequest({
        service: this.config.moderationService,
        serviceParameters: JSON.stringify({ imageUrl, dataId }),
      });
      const response = await this.retryOnTransient(
        () => this.greenClient!.imageModeration(request),
        2,
      );
      const body = response.body;
      if (!body || body.code !== 200) {
        throw new Error(body?.msg ?? 'Moderation API returned non-200 result');
      }

      const riskLevel = (body.data?.riskLevel ?? '').toLowerCase();
      if (riskLevel === 'high') {
        return {
          status: 'reject',
          requestId: body.requestId ?? null,
          riskLevel: body.data?.riskLevel ?? null,
        };
      }
      if (riskLevel === 'medium') {
        return {
          status: 'review',
          requestId: body.requestId ?? null,
          riskLevel: body.data?.riskLevel ?? null,
        };
      }
      return {
        status: 'pass',
        requestId: body.requestId ?? null,
        riskLevel: body.data?.riskLevel ?? null,
      };
    } catch (error) {
      if (this.config.moderationFailOpen) {
        return { status: 'skipped', requestId: null, riskLevel: null };
      }
      throw new ServiceUnavailableException({
        code: 'IMAGE_MODERATION_UNAVAILABLE',
        message: 'Image moderation service is unavailable.',
        details:
          error instanceof Error
            ? error.message
            : 'Unknown image moderation error',
      });
    }
  }

  private async safeDeleteObject(key: string): Promise<void> {
    if (!this.client) {
      return;
    }
    try {
      await this.client.delete(key);
    } catch {
      // Ignore cleanup errors and return moderation rejection to the caller.
    }
  }

  private async retryOnTransient<T>(
    fn: () => Promise<T>,
    maxRetries: number,
  ): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        // Only retry on network-level errors, not on API errors
        const isTransient =
          error instanceof Error &&
          (error.message.includes('ECONNRESET') ||
            error.message.includes('ETIMEDOUT') ||
            error.message.includes('ECONNREFUSED') ||
            error.message.includes('socket hang up'));
        if (!isTransient || attempt === maxRetries) {
          throw error;
        }
        await new Promise((resolve) =>
          setTimeout(resolve, 300 * (attempt + 1)),
        );
      }
    }
    throw lastError;
  }

  private guessMimeTypeByKey(key: string): string {
    const lower = key.toLowerCase();
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.webp')) return 'image/webp';
    if (lower.endsWith('.gif')) return 'image/gif';
    return 'image/jpeg';
  }

  private mapCompletedBatchItem(
    batchItem: UploadBatchItem,
  ): CompletedUploadRecord {
    if (
      batchItem.status !== 'completed' ||
      batchItem.size === null ||
      !batchItem.mimeType ||
      !batchItem.moderationStatus
    ) {
      throw new InternalServerErrorException({
        code: 'UPLOAD_BATCH_ITEM_INCOMPLETE',
        message: 'Upload batch item is incomplete.',
      });
    }

    return {
      key: batchItem.objectKey,
      size: batchItem.size,
      mimeType: batchItem.mimeType,
      moderation: {
        status: batchItem.moderationStatus,
        requestId: batchItem.moderationRequestId,
        riskLevel: batchItem.moderationRiskLevel,
      },
    };
  }

  private toUploadedFileItem(record: CompletedUploadRecord): UploadedFileItem {
    return {
      key: record.key,
      url: this.buildFallbackPublicUrl(record.key),
      mimeType: record.mimeType,
      size: record.size,
      moderation: record.moderation,
    };
  }

  private extractErrorCode(error: unknown): string | undefined {
    if (typeof error !== 'object' || error === null) {
      return undefined;
    }
    const response = (error as { response?: { code?: string } }).response;
    if (response?.code) {
      return response.code;
    }
    return (error as { code?: string }).code;
  }
}
