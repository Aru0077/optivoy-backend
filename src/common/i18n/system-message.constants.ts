export interface ValidationIssueDetail {
  field: string;
  constraint: string;
  message: string;
  value?: unknown;
}

export const RAW_MESSAGE_KEY_MAP: Record<string, string> = {
  'Access token has been revoked': 'ACCESS_TOKEN_REVOKED',
  'Account is inactive or not found': 'ACCOUNT_INACTIVE_OR_NOT_FOUND',
  'Account is required': 'ACCOUNT_REQUIRED',
  'Admin 2FA storage unavailable': 'ADMIN_2FA_STORAGE_UNAVAILABLE',
  'Airport is referenced by spots and cannot be deleted.':
    'LOCATION_AIRPORT_IN_USE',
  'Airport not found.': 'LOCATION_AIRPORT_NOT_FOUND',
  'Authentication required': 'AUTHENTICATION_REQUIRED',
  'CSV does not contain any valid airport rows.':
    'LOCATION_CSV_NO_VALID_AIRPORTS',
  'CSV does not contain any valid country rows.':
    'LOCATION_CSV_NO_VALID_COUNTRIES',
  'CSV does not contain any valid region rows.':
    'LOCATION_CSV_NO_VALID_REGIONS',
  'CSV is empty.': 'LOCATION_CSV_EMPTY',
  'City not found.': 'LOCATION_CITY_NOT_FOUND',
  'Current password is incorrect': 'CURRENT_PASSWORD_INCORRECT',
  'Email is required': 'EMAIL_REQUIRED',
  'Facebook OAuth is disabled on this server.': 'OAUTH_PROVIDER_DISABLED',
  'Failed to create STS credential.': 'OSS_STS_ASSUME_ROLE_FAILED',
  'Failed to finalize uploaded file.': 'UPLOAD_BATCH_FINALIZE_FAILED',
  'Failed to set uploaded object access policy.':
    'UPLOAD_OBJECT_ACL_UPDATE_FAILED',
  'Google OAuth is disabled on this server.': 'OAUTH_PROVIDER_DISABLED',
  'Hotel not found.': 'HOTEL_NOT_FOUND',
  'If the email exists, a password reset email has been sent.':
    'PASSWORD_RESET_EMAIL_SENT',
  'Image failed content moderation.': 'IMAGE_MODERATION_REJECTED',
  'Image moderation service is unavailable.': 'IMAGE_MODERATION_UNAVAILABLE',
  'Internal server error': 'INTERNAL_SERVER_ERROR',
  'Invalid OAuth profile': 'INVALID_OAUTH_PROFILE',
  'Invalid credentials': 'INVALID_CREDENTIALS',
  'Invalid link token': 'INVALID_LINK_TOKEN',
  'Invalid or expired link token': 'INVALID_OR_EXPIRED_LINK_TOKEN',
  'Invalid or expired token': 'INVALID_OR_EXPIRED_TOKEN',
  'Invalid or expired verification code':
    'INVALID_OR_EXPIRED_VERIFICATION_CODE',
  'Link token does not belong to this user': 'LINK_TOKEN_USER_MISMATCH',
  'Matrix point recompute job queued.': 'MATRIX_POINT_RECOMPUTE_JOB_QUEUED',
  'Matrix recompute job queued.': 'MATRIX_RECOMPUTE_JOB_QUEUED',
  'Matrix recompute job not found.': 'MATRIX_RECOMPUTE_JOB_NOT_FOUND',
  'Running or pending matrix jobs cannot be deleted.':
    'MATRIX_RECOMPUTE_JOB_DELETE_FORBIDDEN',
  'Matrix recompute jobs table is unavailable.':
    'MATRIX_RECOMPUTE_JOB_TABLE_UNAVAILABLE',
  'Matrix recompute job failed.': 'MATRIX_RECOMPUTE_JOB_FAILED',
  'Matrix recompute job completed.': 'MATRIX_RECOMPUTE_JOB_COMPLETED',
  'Name is required': 'NAME_REQUIRED',
  'No airport code is configured for the target city.':
    'TRIP_PLANNER_CITY_AIRPORT_NOT_FOUND',
  'No published hotels found in target city.': 'TRIP_PLANNER_HOTELS_NOT_FOUND',
  'Notification not found.': 'NOTIFICATION_NOT_FOUND',
  'OAuth provider did not return an email address.': 'OAUTH_EMAIL_REQUIRED',
  'OSS upload is disabled on this server.': 'OSS_DISABLED',
  'Only user accounts can bind email': 'ONLY_USER_CAN_BIND_EMAIL',
  'Only user accounts can change password': 'ONLY_USER_CAN_CHANGE_PASSWORD',
  'Only user accounts can update profile': 'ONLY_USER_CAN_UPDATE_PROFILE',
  'Only user accounts can view profile': 'ONLY_USER_CAN_VIEW_PROFILE',
  'Password must be at least 8 characters': 'PASSWORD_TOO_SHORT',
  'Please upload a CSV file or provide csvContent.':
    'LOCATION_CSV_MISSING_CONTENT',
  'Point coordinates are required for recompute.':
    'MATRIX_POINT_COORDINATE_REQUIRED',
  'Point not found.': 'MATRIX_POINT_NOT_FOUND',
  'Processing...': 'MATRIX_JOB_PROCESSING',
  'Request payload validation failed': 'VALIDATION_FAILED',
  'STS role is not configured.': 'OSS_STS_MISCONFIGURED',
  'STS upload is disabled on this server.': 'OSS_STS_DISABLED',
  'Shopping place not found.': 'SHOPPING_NOT_FOUND',
  'Some selected points are not found or unpublished.':
    'TRIP_PLANNER_POINTS_NOT_FOUND',
  'Spot not found.': 'SPOT_NOT_FOUND',
  'This OAuth identity is already linked to another account.':
    'OAUTH_IDENTITY_ALREADY_LINKED',
  'This account is already in use.': 'ACCOUNT_ALREADY_IN_USE',
  'This email has already been bound to another account.':
    'EMAIL_ALREADY_BOUND',
  'This file is already being finalized.': 'UPLOAD_ALREADY_PROCESSING',
  'This provider is already linked with a different account.':
    'PROVIDER_ALREADY_LINKED',
  'Token client mismatch': 'TOKEN_CLIENT_MISMATCH',
  'Token role mismatch': 'TOKEN_ROLE_MISMATCH',
  'Too many login attempts. Please try again later.': 'LOGIN_RATE_LIMITED',
  Unauthorized: 'UNAUTHORIZED',
  'Upload batch item is incomplete.': 'UPLOAD_BATCH_ITEM_INCOMPLETE',
  'Upload batch not found.': 'UPLOAD_BATCH_NOT_FOUND',
  'Upload folder is invalid.': 'INVALID_UPLOAD_FOLDER',
  'Uploaded image MIME type does not match object metadata.':
    'UPLOAD_IMAGE_MIME_MISMATCH',
  'Uploaded image dimensions are outside the allowed range.':
    'UPLOAD_IMAGE_DIMENSIONS_INVALID',
  'Uploaded image format is not allowed.': 'UPLOAD_IMAGE_FORMAT_NOT_ALLOWED',
  'Uploaded key is invalid.': 'INVALID_UPLOAD_KEY',
  'Uploaded key is not allowed for current batch.': 'INVALID_UPLOAD_KEY',
  'Uploaded object inspection failed. Please retry later.':
    'UPLOAD_OBJECT_INSPECTION_FAILED',
  'User not found': 'USER_NOT_FOUND',
  'User not found.': 'USER_NOT_FOUND',
  'Verification code sent to admin email address.':
    'ADMIN_VERIFICATION_CODE_SENT',
  'Verification code sent to your email address.':
    'EMAIL_VERIFICATION_CODE_SENT',
  'reservationUrl is required when reservationRequired is true.':
    'SPOT_RESERVATION_URL_REQUIRED',
  'selectedPointIds is required.': 'TRIP_PLANNER_POINTS_REQUIRED',
  'Bad Request': 'BAD_REQUEST',
  Forbidden: 'FORBIDDEN',
  'Not Found': 'NOT_FOUND',
  Conflict: 'CONFLICT',
  'Too Many Requests': 'TOO_MANY_REQUESTS',
  'Service Unavailable': 'SERVICE_UNAVAILABLE',
  'Unprocessable Entity': 'UNPROCESSABLE_ENTITY',
};

export const VALIDATION_KEY_MAP: Record<string, string> = {
  isNotEmpty: 'REQUIRED',
  isString: 'STRING',
  maxLength: 'MAX_LENGTH',
  minLength: 'MIN_LENGTH',
  length: 'LENGTH',
  min: 'MIN',
  max: 'MAX',
  matches: 'PATTERN',
  isIn: 'ENUM',
  isEnum: 'ENUM',
  isBoolean: 'BOOLEAN',
  isLongitude: 'LONGITUDE',
  isLatitude: 'LATITUDE',
  isNumber: 'NUMBER',
  isInt: 'INTEGER',
  isArray: 'ARRAY',
  arrayMaxSize: 'ARRAY_MAX_SIZE',
  arrayUnique: 'ARRAY_UNIQUE',
  isUUID: 'UUID',
  isEmail: 'EMAIL',
  isUrl: 'URL',
  isDateString: 'DATE_STRING',
};
