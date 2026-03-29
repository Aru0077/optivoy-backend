import { UploadsService } from './uploads.service';
import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { UploadBatch } from './entities/upload-batch.entity';
import { UploadBatchItem } from './entities/upload-batch-item.entity';

const makeConfigService = (overrides: Record<string, unknown> = {}) => ({
  get: jest.fn().mockReturnValue({
    enabled: false,
    moderationEnabled: false,
    moderationFailOpen: false,
    maxFileSizeMb: 10,
    maxFilesPerRequest: 5,
    allowedImageFormats: ['jpg', 'jpeg', 'png', 'webp'],
    minImageWidth: 200,
    minImageHeight: 200,
    maxImageWidth: 8192,
    maxImageHeight: 8192,
    stsUserPrefix: 'uploads/users',
    stsAdminPrefix: 'uploads/admin',
    uploadPrefix: 'spots',
    ...overrides,
  }),
});

const makeRepository = () => ({
  create: jest.fn((value: Record<string, unknown>) => value),
  save: jest.fn((value: Record<string, unknown>) => Promise.resolve(value)),
  update: jest.fn(() => Promise.resolve({ affected: 1 })),
  delete: jest.fn(() => Promise.resolve({ affected: 1 })),
});

const makeDataSource = () => ({
  transaction: jest.fn(),
});

describe('UploadsService', () => {
  it('should throw when OSS is disabled and STS is requested', async () => {
    const service = new UploadsService(
      makeConfigService({ enabled: false }) as never,
      makeRepository() as never,
      makeRepository() as never,
      makeDataSource() as never,
    );
    try {
      await service.createStsCredential({ role: 'user', userId: 'u1' });
      fail('Expected createStsCredential to throw when OSS is disabled');
    } catch (error) {
      expect(error).toBeInstanceOf(ServiceUnavailableException);
      const exception = error as ServiceUnavailableException;
      expect(exception.message).toContain('disabled');
    }
  });

  it('should return upload limits', () => {
    const service = new UploadsService(
      makeConfigService({
        enabled: true,
        maxFileSizeMb: 8,
        maxFilesPerRequest: 3,
      }) as never,
      makeRepository() as never,
      makeRepository() as never,
      makeDataSource() as never,
    );
    expect(service.getLimits()).toEqual({
      maxFileSizeMb: 8,
      maxFilesPerRequest: 3,
    });
  });

  it('should issue batch-aware sts credential', async () => {
    const batchRepository = makeRepository();
    const service = new UploadsService(
      makeConfigService({
        enabled: true,
        region: 'cn-hangzhou',
        bucket: 'test-bucket',
        accessKeyId: 'ak',
        accessKeySecret: 'sk',
        stsRoleArn: 'acs:ram::123:role/test',
        stsTokenExpiresSeconds: 900,
      }) as never,
      batchRepository as never,
      makeRepository() as never,
      makeDataSource() as never,
    );

    (service as unknown as { stsClient: { assumeRole: jest.Mock } }).stsClient =
      {
        assumeRole: jest.fn().mockResolvedValue({
          credentials: {
            AccessKeyId: 'tmp-ak',
            AccessKeySecret: 'tmp-sk',
            SecurityToken: 'token',
            Expiration: '2026-03-16T12:00:00.000Z',
          },
        }),
      };

    const result = await service.createStsCredential({
      role: 'user',
      userId: '16fcae17-3179-4566-b85d-61c53b7ac7a0',
      folder: 'spots',
    });

    expect(result.batchId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(result.dir).toContain(`/${result.batchId}`);
    expect(batchRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: result.batchId,
        dir: result.dir,
        allowedCount: 5,
      }),
    );
  });

  it('should reject upload key outside reserved batch directory', async () => {
    const batchRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 'batch-1',
        actorRole: 'user',
        actorId: 'user-1',
        dir: 'uploads/users/user-1/2026/03/17/batch-1',
        allowedCount: 2,
        expiresAt: new Date(Date.now() + 60_000),
      }),
    };
    const batchItemRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn((value: Record<string, unknown>) => value),
      save: jest.fn(),
    };
    const dataSource = {
      transaction: jest.fn((callback: (manager: unknown) => unknown) =>
        callback({
          getRepository: (entity: unknown) => {
            if (entity === UploadBatch) {
              return batchRepository;
            }
            if (entity === UploadBatchItem) {
              return batchItemRepository;
            }
            throw new Error('Unexpected repository');
          },
        }),
      ),
    };
    const service = new UploadsService(
      makeConfigService({ enabled: true }) as never,
      makeRepository() as never,
      makeRepository() as never,
      dataSource as never,
    );

    await expect(
      (
        service as unknown as {
          reserveUploadSlot: (input: {
            batchId: string;
            role: 'user' | 'admin';
            userId: string;
            key: string;
          }) => Promise<unknown>;
        }
      ).reserveUploadSlot({
        batchId: 'batch-1',
        role: 'user',
        userId: 'user-1',
        key: 'uploads/users/user-1/other-batch/image.jpg',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('should reject unsupported image format from OSS metadata', async () => {
    const service = new UploadsService(
      makeConfigService({
        enabled: true,
        allowedImageFormats: ['jpg', 'png'],
      }) as never,
      makeRepository() as never,
      makeRepository() as never,
      makeDataSource() as never,
    );

    (service as unknown as { client: { get: jest.Mock } }).client = {
      get: jest.fn().mockResolvedValue({
        content: Buffer.from(
          JSON.stringify({
            ImageWidth: { value: '1024' },
            ImageHeight: { value: '768' },
            Format: { value: 'webp' },
          }),
        ),
      }),
    };
    (service as unknown as { safeDeleteObject: jest.Mock }).safeDeleteObject =
      jest.fn().mockResolvedValue(undefined);

    await expect(
      (
        service as unknown as {
          validateUploadedImageOrThrow: (
            key: string,
            mimeType: string,
          ) => Promise<void>;
        }
      ).validateUploadedImageOrThrow('spots/test.webp', 'image/webp'),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(
      (service as unknown as { safeDeleteObject: jest.Mock }).safeDeleteObject,
    ).toHaveBeenCalledWith('spots/test.webp');
  });
});
