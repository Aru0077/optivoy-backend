import { registerAs } from '@nestjs/config';

export interface OssConfig {
  enabled: boolean;
  region: string;
  bucket: string;
  accessKeyId: string;
  accessKeySecret: string;
  publicBaseUrl: string;
  uploadPrefix: string;
  maxFileSizeMb: number;
  maxFilesPerRequest: number;
  allowedImageFormats: string[];
  minImageWidth: number;
  minImageHeight: number;
  maxImageWidth: number;
  maxImageHeight: number;
  homeBannerMinImageWidth: number;
  homeBannerMinImageHeight: number;
  homeBannerMaxImageWidth: number;
  homeBannerMaxImageHeight: number;
  stsRoleArn: string;
  stsTokenExpiresSeconds: number;
  stsUserPrefix: string;
  stsAdminPrefix: string;
  moderationEnabled: boolean;
  moderationAccessKeyId: string;
  moderationAccessKeySecret: string;
  moderationEndpoint: string;
  moderationRegionId: string;
  moderationService: string;
  moderationFailOpen: boolean;
  uploadObjectAcl: 'public-read' | 'private' | 'inherit';
}

export const ossConfig = registerAs(
  'oss',
  (): OssConfig => ({
    enabled: (process.env.OSS_ENABLED ?? 'false').toLowerCase() === 'true',
    region: process.env.OSS_REGION ?? '',
    bucket: process.env.OSS_BUCKET ?? '',
    accessKeyId: process.env.OSS_ACCESS_KEY_ID ?? '',
    accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET ?? '',
    publicBaseUrl: process.env.OSS_PUBLIC_BASE_URL ?? '',
    uploadPrefix: process.env.OSS_UPLOAD_PREFIX ?? 'spots',
    maxFileSizeMb: parseInt(process.env.OSS_MAX_FILE_SIZE_MB ?? '10', 10),
    maxFilesPerRequest: parseInt(
      process.env.OSS_MAX_FILES_PER_REQUEST ?? '10',
      10,
    ),
    allowedImageFormats: (
      process.env.OSS_ALLOWED_IMAGE_FORMATS ?? 'jpg,jpeg,png,webp'
    )
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
    minImageWidth: parseInt(process.env.OSS_MIN_IMAGE_WIDTH ?? '200', 10),
    minImageHeight: parseInt(process.env.OSS_MIN_IMAGE_HEIGHT ?? '200', 10),
    maxImageWidth: parseInt(process.env.OSS_MAX_IMAGE_WIDTH ?? '8192', 10),
    maxImageHeight: parseInt(process.env.OSS_MAX_IMAGE_HEIGHT ?? '8192', 10),
    homeBannerMinImageWidth: parseInt(
      process.env.OSS_HOME_BANNER_MIN_IMAGE_WIDTH ?? '1',
      10,
    ),
    homeBannerMinImageHeight: parseInt(
      process.env.OSS_HOME_BANNER_MIN_IMAGE_HEIGHT ?? '1',
      10,
    ),
    homeBannerMaxImageWidth: parseInt(
      process.env.OSS_HOME_BANNER_MAX_IMAGE_WIDTH ?? '20000',
      10,
    ),
    homeBannerMaxImageHeight: parseInt(
      process.env.OSS_HOME_BANNER_MAX_IMAGE_HEIGHT ?? '20000',
      10,
    ),
    stsRoleArn: process.env.OSS_STS_ROLE_ARN ?? '',
    stsTokenExpiresSeconds: parseInt(
      process.env.OSS_STS_TOKEN_EXPIRES_SECONDS ?? '900',
      10,
    ),
    stsUserPrefix: process.env.OSS_STS_USER_PREFIX ?? 'uploads/users',
    stsAdminPrefix: process.env.OSS_STS_ADMIN_PREFIX ?? 'uploads/admin',
    moderationEnabled:
      (process.env.OSS_MODERATION_ENABLED ?? 'false').toLowerCase() === 'true',
    moderationAccessKeyId:
      process.env.OSS_MODERATION_ACCESS_KEY_ID ??
      process.env.OSS_ACCESS_KEY_ID ??
      '',
    moderationAccessKeySecret:
      process.env.OSS_MODERATION_ACCESS_KEY_SECRET ??
      process.env.OSS_ACCESS_KEY_SECRET ??
      '',
    moderationEndpoint:
      process.env.OSS_MODERATION_ENDPOINT ??
      'green-cip.cn-shanghai.aliyuncs.com',
    moderationRegionId: process.env.OSS_MODERATION_REGION_ID ?? 'cn-shanghai',
    moderationService: process.env.OSS_MODERATION_SERVICE ?? 'baselineCheck_cb',
    moderationFailOpen:
      (process.env.OSS_MODERATION_FAIL_OPEN ?? 'false').toLowerCase() ===
      'true',
    uploadObjectAcl: (process.env.OSS_UPLOAD_OBJECT_ACL ?? 'public-read')
      .trim()
      .toLowerCase() as OssConfig['uploadObjectAcl'],
  }),
);
