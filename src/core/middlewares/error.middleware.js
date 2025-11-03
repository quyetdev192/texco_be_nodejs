const logger = require('../config/logger.config');
const constants = require('../utils/constants');


const errorHandler = (err, req, res, next) => {
    logger.error('Unhandled error', {
        path: req.path,
        method: req.method,
        ip: req.ip,
        userId: req.userId,
        error: {
            message: err.message,
            stack: err.stack,
            name: err.name
        }
    });

    let statusCode = constants.HTTP_STATUS.INTERNAL_SERVER_ERROR;
    let errorCode = constants.ERROR_CODES.INTERNAL_ERROR;
    let message = req.t ? req.t('error.internal') : 'Internal server error';
    let details = null;

    if (err.name === 'ValidationError') {
        statusCode = constants.HTTP_STATUS.UNPROCESSABLE_ENTITY;
        errorCode = constants.ERROR_CODES.VALIDATION_REQUIRED_FIELD;
        message = req.t ? req.t('error.validation') : 'Validation error';
        details = err.details || err.message;
    } else if (err.name === 'CastError') {
        statusCode = constants.HTTP_STATUS.BAD_REQUEST;
        errorCode = constants.ERROR_CODES.VALIDATION_INVALID_TYPE;
        message = req.t ? req.t('error.invalidId') : 'Invalid ID format';
    } else if (err.name === 'MongoError' || err.name === 'MongoServerError') {
        if (err.code === 11000) {
            statusCode = constants.HTTP_STATUS.CONFLICT;
            errorCode = constants.ERROR_CODES.DB_DUPLICATE_KEY;
            message = req.t ? req.t('error.duplicate') : 'Duplicate key error';
        } else {
            statusCode = constants.HTTP_STATUS.INTERNAL_SERVER_ERROR;
            errorCode = constants.ERROR_CODES.DB_QUERY_ERROR;
            message = req.t ? req.t('error.database') : 'Database error';
        }
    } else if (err.name === 'JsonWebTokenError') {
        statusCode = constants.HTTP_STATUS.UNAUTHORIZED;
        errorCode = constants.ERROR_CODES.AUTH_TOKEN_INVALID;
        message = req.t ? req.t('auth.token.invalid') : 'Invalid token';
    } else if (err.name === 'TokenExpiredError') {
        statusCode = constants.HTTP_STATUS.UNAUTHORIZED;
        errorCode = constants.ERROR_CODES.AUTH_TOKEN_EXPIRED;
        message = req.t ? req.t('auth.token.expired') : 'Token expired';
    } else if (err.name === 'MulterError') {
        if (err.code === 'LIMIT_FILE_SIZE') {
            statusCode = constants.HTTP_STATUS.BAD_REQUEST;
            errorCode = constants.ERROR_CODES.FILE_SIZE_EXCEEDED;
            message = req.t ? req.t('error.fileSizeExceeded') : 'File size too large';
        } else if (err.code === 'LIMIT_FILE_COUNT') {
            statusCode = constants.HTTP_STATUS.BAD_REQUEST;
            errorCode = constants.ERROR_CODES.FILE_UPLOAD_ERROR;
            message = req.t ? req.t('error.fileCountExceeded') : 'Too many files';
        } else {
            statusCode = constants.HTTP_STATUS.BAD_REQUEST;
            errorCode = constants.ERROR_CODES.FILE_UPLOAD_ERROR;
            message = req.t ? req.t('error.fileUpload') : 'File upload error';
        }
    } else if (err.status) {
        statusCode = err.status;
        errorCode = err.code || constants.ERROR_CODES.INTERNAL_ERROR;
        message = err.message || message;
        details = err.details;
    }

    const response = {
        success: false,
        errorCode: 1,
        message: message,
        data: null
    };

    res.status(statusCode).json(response);
};


const notFoundHandler = (req, res) => {
    logger.warn('Route not found', {
        path: req.path,
        method: req.method,
        ip: req.ip
    });

    res.status(constants.HTTP_STATUS.NOT_FOUND).json({
        success: false,
        errorCode: 1,
        message: req.t ? req.t('error.notFound') : 'Route not found',
        data: null
    });
};


const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};


const validationErrorHandler = (err, req, res, next) => {
    if (err.name === 'ValidationError') {
        const validationErrors = [];

        if (err.details) {
            err.details.forEach(detail => {
                validationErrors.push({
                    field: detail.path.join('.'),
                    message: detail.message,
                    value: detail.context?.value
                });
            });
        }

        logger.warn('Validation error', {
            path: req.path,
            method: req.method,
            ip: req.ip,
            errors: validationErrors
        });

        return res.status(constants.HTTP_STATUS.UNPROCESSABLE_ENTITY).json({
            success: false,
            error: {
                code: constants.ERROR_CODES.VALIDATION_REQUIRED_FIELD,
                message: req.t ? req.t('error.validation') : 'Validation error',
                details: validationErrors
            }
        });
    }

    next(err);
};


const rateLimitErrorHandler = (err, req, res, next) => {
    if (err.status === 429) {
        logger.warn('Rate limit exceeded', {
            path: req.path,
            method: req.method,
            ip: req.ip
        });

        return res.status(constants.HTTP_STATUS.TOO_MANY_REQUESTS).json({
            success: false,
            error: {
                code: constants.ERROR_CODES.RATE_LIMIT_EXCEEDED,
                message: req.t ? req.t('error.rateLimit') : 'Too many requests, please try again later'
            }
        });
    }

    next(err);
};


const databaseErrorHandler = (err, req, res, next) => {
    if (err.name === 'MongoNetworkError' ||
        err.name === 'MongooseServerSelectionError' ||
        err.code === 'ECONNREFUSED') {

        logger.error('Database connection error', {
            path: req.path,
            method: req.method,
            ip: req.ip,
            error: err.message
        });

        return res.status(constants.HTTP_STATUS.SERVICE_UNAVAILABLE).json({
            success: false,
            error: {
                code: constants.ERROR_CODES.DB_CONNECTION_ERROR,
                message: req.t ? req.t('error.databaseConnection') : 'Database connection error'
            }
        });
    }

    next(err);
};

module.exports = {
    errorHandler,
    notFoundHandler,
    asyncHandler,
    validationErrorHandler,
    rateLimitErrorHandler,
    databaseErrorHandler
}; 