const ENV = {
    DEVELOPMENT: 'development',
    STAGING: 'staging',
    PRODUCTION: 'production',
    TEST: 'test'
};

const HTTP_STATUS = {
    OK: 200,
    CREATED: 201,
    ACCEPTED: 202,
    NO_CONTENT: 204,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    METHOD_NOT_ALLOWED: 405,
    CONFLICT: 409,
    UNPROCESSABLE_ENTITY: 422,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
    NOT_IMPLEMENTED: 501,
    BAD_GATEWAY: 502,
    SERVICE_UNAVAILABLE: 503
};

const ERROR_CODES = {
    AUTH_INVALID_CREDENTIALS: 'AUTH_001',
    AUTH_TOKEN_EXPIRED: 'AUTH_002',
    AUTH_TOKEN_INVALID: 'AUTH_003',
    AUTH_INSUFFICIENT_PERMISSIONS: 'AUTH_004',
    AUTH_ACCOUNT_LOCKED: 'AUTH_005',
    AUTH_ACCOUNT_DISABLED: 'AUTH_006',
    AUTH_SIGNATURE_INVALID: 'AUTH_007',
    AUTH_SIGNATURE_EXPIRED: 'AUTH_008',
    AUTH_API_KEY_INVALID: 'AUTH_009',
    AUTH_API_KEY_MISSING: 'AUTH_010',

    VALIDATION_REQUIRED_FIELD: 'VAL_001',
    VALIDATION_INVALID_FORMAT: 'VAL_002',
    VALIDATION_INVALID_LENGTH: 'VAL_003',
    VALIDATION_INVALID_RANGE: 'VAL_004',
    VALIDATION_INVALID_TYPE: 'VAL_005',
    VALIDATION_UNIQUE_CONSTRAINT: 'VAL_006',

    DB_CONNECTION_ERROR: 'DB_001',
    DB_QUERY_ERROR: 'DB_002',
    DB_TRANSACTION_ERROR: 'DB_003',
    DB_CONSTRAINT_VIOLATION: 'DB_004',
    DB_RECORD_NOT_FOUND: 'DB_005',
    DB_DUPLICATE_KEY: 'DB_006',

    FILE_UPLOAD_ERROR: 'FILE_001',
    FILE_DELETE_ERROR: 'FILE_002',
    FILE_NOT_FOUND: 'FILE_003',
    FILE_SIZE_EXCEEDED: 'FILE_004',
    FILE_TYPE_NOT_ALLOWED: 'FILE_005',

    EXTERNAL_SERVICE_ERROR: 'EXT_001',
    EXTERNAL_SERVICE_TIMEOUT: 'EXT_002',
    EXTERNAL_SERVICE_UNAVAILABLE: 'EXT_003',
    EXTERNAL_SERVICE_RATE_LIMIT: 'EXT_004',

    INTERNAL_ERROR: 'GEN_001',
    NOT_IMPLEMENTED: 'GEN_002',
    SERVICE_UNAVAILABLE: 'GEN_003',
    RATE_LIMIT_EXCEEDED: 'GEN_004'
};

const ERROR_MESSAGES_EN = {
    [ERROR_CODES.AUTH_INVALID_CREDENTIALS]: 'Invalid email or password',
    [ERROR_CODES.AUTH_TOKEN_EXPIRED]: 'Authentication token has expired',
    [ERROR_CODES.AUTH_TOKEN_INVALID]: 'Invalid authentication token',
    [ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS]: 'Insufficient permissions to access this resource',
    [ERROR_CODES.AUTH_ACCOUNT_LOCKED]: 'Account has been locked due to multiple failed attempts',
    [ERROR_CODES.AUTH_ACCOUNT_DISABLED]: 'Account has been disabled',
    [ERROR_CODES.AUTH_SIGNATURE_INVALID]: 'Invalid request signature',
    [ERROR_CODES.AUTH_SIGNATURE_EXPIRED]: 'Request signature has expired',
    [ERROR_CODES.AUTH_API_KEY_INVALID]: 'Invalid API key',
    [ERROR_CODES.AUTH_API_KEY_MISSING]: 'API key is required',

    [ERROR_CODES.VALIDATION_REQUIRED_FIELD]: 'This field is required',
    [ERROR_CODES.VALIDATION_INVALID_FORMAT]: 'Invalid format',
    [ERROR_CODES.VALIDATION_INVALID_LENGTH]: 'Invalid length',
    [ERROR_CODES.VALIDATION_INVALID_RANGE]: 'Value is out of valid range',
    [ERROR_CODES.VALIDATION_INVALID_TYPE]: 'Invalid data type',
    [ERROR_CODES.VALIDATION_UNIQUE_CONSTRAINT]: 'Value must be unique',

    [ERROR_CODES.DB_CONNECTION_ERROR]: 'Database connection error',
    [ERROR_CODES.DB_QUERY_ERROR]: 'Database query error',
    [ERROR_CODES.DB_TRANSACTION_ERROR]: 'Database transaction error',
    [ERROR_CODES.DB_CONSTRAINT_VIOLATION]: 'Database constraint violation',
    [ERROR_CODES.DB_RECORD_NOT_FOUND]: 'Record not found',
    [ERROR_CODES.DB_DUPLICATE_KEY]: 'Duplicate key violation',

    [ERROR_CODES.FILE_UPLOAD_ERROR]: 'File upload failed',
    [ERROR_CODES.FILE_DELETE_ERROR]: 'File deletion failed',
    [ERROR_CODES.FILE_NOT_FOUND]: 'File not found',
    [ERROR_CODES.FILE_SIZE_EXCEEDED]: 'File size exceeds limit',
    [ERROR_CODES.FILE_TYPE_NOT_ALLOWED]: 'File type not allowed',

    [ERROR_CODES.EXTERNAL_SERVICE_ERROR]: 'External service error',
    [ERROR_CODES.EXTERNAL_SERVICE_TIMEOUT]: 'External service timeout',
    [ERROR_CODES.EXTERNAL_SERVICE_UNAVAILABLE]: 'External service unavailable',
    [ERROR_CODES.EXTERNAL_SERVICE_RATE_LIMIT]: 'External service rate limit exceeded',

    [ERROR_CODES.INTERNAL_ERROR]: 'Internal server error',
    [ERROR_CODES.NOT_IMPLEMENTED]: 'Feature not implemented',
    [ERROR_CODES.SERVICE_UNAVAILABLE]: 'Service temporarily unavailable',
    [ERROR_CODES.RATE_LIMIT_EXCEEDED]: 'Rate limit exceeded'
};

const ERROR_MESSAGES_VI = {
    [ERROR_CODES.AUTH_INVALID_CREDENTIALS]: 'Email hoặc mật khẩu không đúng',
    [ERROR_CODES.AUTH_TOKEN_EXPIRED]: 'Token xác thực đã hết hạn',
    [ERROR_CODES.AUTH_TOKEN_INVALID]: 'Token xác thực không hợp lệ',
    [ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS]: 'Không đủ quyền truy cập tài nguyên này',
    [ERROR_CODES.AUTH_ACCOUNT_LOCKED]: 'Tài khoản đã bị khóa do nhiều lần đăng nhập thất bại',
    [ERROR_CODES.AUTH_ACCOUNT_DISABLED]: 'Tài khoản đã bị vô hiệu hóa',
    [ERROR_CODES.AUTH_SIGNATURE_INVALID]: 'Chữ ký yêu cầu không hợp lệ',
    [ERROR_CODES.AUTH_SIGNATURE_EXPIRED]: 'Chữ ký yêu cầu đã hết hạn',
    [ERROR_CODES.AUTH_API_KEY_INVALID]: 'API key không hợp lệ',
    [ERROR_CODES.AUTH_API_KEY_MISSING]: 'API key là bắt buộc',

    [ERROR_CODES.VALIDATION_REQUIRED_FIELD]: 'Trường này là bắt buộc',
    [ERROR_CODES.VALIDATION_INVALID_FORMAT]: 'Định dạng không hợp lệ',
    [ERROR_CODES.VALIDATION_INVALID_LENGTH]: 'Độ dài không hợp lệ',
    [ERROR_CODES.VALIDATION_INVALID_RANGE]: 'Giá trị nằm ngoài phạm vi cho phép',
    [ERROR_CODES.VALIDATION_INVALID_TYPE]: 'Kiểu dữ liệu không hợp lệ',
    [ERROR_CODES.VALIDATION_UNIQUE_CONSTRAINT]: 'Giá trị phải là duy nhất',

    [ERROR_CODES.DB_CONNECTION_ERROR]: 'Lỗi kết nối cơ sở dữ liệu',
    [ERROR_CODES.DB_QUERY_ERROR]: 'Lỗi truy vấn cơ sở dữ liệu',
    [ERROR_CODES.DB_TRANSACTION_ERROR]: 'Lỗi giao dịch cơ sở dữ liệu',
    [ERROR_CODES.DB_CONSTRAINT_VIOLATION]: 'Vi phạm ràng buộc cơ sở dữ liệu',
    [ERROR_CODES.DB_RECORD_NOT_FOUND]: 'Không tìm thấy bản ghi',
    [ERROR_CODES.DB_DUPLICATE_KEY]: 'Vi phạm khóa duy nhất',

    [ERROR_CODES.FILE_UPLOAD_ERROR]: 'Tải file lên thất bại',
    [ERROR_CODES.FILE_DELETE_ERROR]: 'Xóa file thất bại',
    [ERROR_CODES.FILE_NOT_FOUND]: 'Không tìm thấy file',
    [ERROR_CODES.FILE_SIZE_EXCEEDED]: 'Kích thước file vượt quá giới hạn',
    [ERROR_CODES.FILE_TYPE_NOT_ALLOWED]: 'Loại file không được phép',

    [ERROR_CODES.EXTERNAL_SERVICE_ERROR]: 'Lỗi dịch vụ bên ngoài',
    [ERROR_CODES.EXTERNAL_SERVICE_TIMEOUT]: 'Dịch vụ bên ngoài quá thời gian chờ',
    [ERROR_CODES.EXTERNAL_SERVICE_UNAVAILABLE]: 'Dịch vụ bên ngoài không khả dụng',
    [ERROR_CODES.EXTERNAL_SERVICE_RATE_LIMIT]: 'Vượt quá giới hạn tốc độ dịch vụ bên ngoài',

    [ERROR_CODES.INTERNAL_ERROR]: 'Lỗi máy chủ nội bộ',
    [ERROR_CODES.NOT_IMPLEMENTED]: 'Tính năng chưa được triển khai',
    [ERROR_CODES.SERVICE_UNAVAILABLE]: 'Dịch vụ tạm thời không khả dụng',
    [ERROR_CODES.RATE_LIMIT_EXCEEDED]: 'Vượt quá giới hạn tốc độ'
};

const PAGINATION = {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 10,
    MAX_LIMIT: 100
};

const FILE_UPLOAD = {
    MAX_SIZE: 5 * 1024 * 1024, 
    ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],
    UPLOAD_PATH: './uploads'
};

const CACHE = {
    TTL: 300, 
    MAX_KEYS: 1000
};

const RATE_LIMIT = {
    WINDOW_MS: 15 * 60 * 1000, 
    MAX_REQUESTS: 100
};

const JWT = {
    ALGORITHM: 'HS256',
    EXPIRES_IN: '24h',
    REFRESH_EXPIRES_IN: '7d'
};

const DATABASE = {
    TYPES: {
        MONGODB: 'mongodb',
        POSTGRESQL: 'postgresql',
        MYSQL: 'mysql'
    },
    DEFAULT_TYPE: 'mongodb'
};

const LOGGING = {
    LEVELS: {
        ERROR: 'error',
        WARN: 'warn',
        INFO: 'info',
        DEBUG: 'debug'
    },
    DEFAULT_LEVEL: 'info'
};

const API_VERSIONS = {
    V1: 'v1',
    V2: 'v2'
};

const RESPONSE_FORMATS = {
    JSON: 'json',
    XML: 'xml'
};

const CO_STEP_VI = {
    1: 'Step 1 - Upload Chứng từ',
    2: 'Step 2 - Chọn Form & Tiêu chí',
    3: 'Step 3 - Trích xuất Dữ liệu',
    4: 'Step 4 - Tính toán Phân bổ',
    5: 'Step 5 - Tạo Bảng kê CTC',
    6: 'Step 6 - Xem xét Kết quả',
    7: 'Step 7 - Xuất C/O'
};

const CO_STATUS_VI = {
    DRAFT: 'Nháp',
    DATA_EXTRACTING: 'Đang trích xuất dữ liệu',
    EXTRACTION_FAILED: 'Trích xuất thất bại',
    SETUP_COMPLETED: 'Cấu hình hoàn thành',
    DATA_CONFIRMED: 'Dữ liệu đã xác nhận',
    CALCULATING: 'Đang tính toán',
    CALCULATED_WITH_WARNINGS: 'Tính toán hoàn thành (có cảnh báo)',
    CALCULATION_FAILED: 'Tính toán thất bại',
    REPORTS_GENERATED: 'Báo cáo đã tạo',
    COMPLETED: 'Hoàn thành',
    FAILED: 'Thất bại'
};

module.exports = {
    ENV,
    HTTP_STATUS,
    ERROR_CODES,
    ERROR_MESSAGES_EN,
    ERROR_MESSAGES_VI,
    PAGINATION,
    FILE_UPLOAD,
    CACHE,
    RATE_LIMIT,
    JWT,
    DATABASE,
    LOGGING,
    API_VERSIONS,
    RESPONSE_FORMATS,
    CO_STEP_VI,
    CO_STATUS_VI
}; 