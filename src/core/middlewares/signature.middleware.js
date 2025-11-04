const hmacUtils = require('../utils/hmac.utils');
const logger = require('../config/logger.config');
const constants = require('../utils/constants');


const verifySignature = (req, res, next) => {
    try {
        if (shouldSkipSignature(req.path)) {
            return next();
        }

        const validation = hmacUtils.validateRequest(req);

        if (!validation.valid) {
            logger.warn('Signature verification failed', {
                path: req.path,
                originalUrl: req.originalUrl,
                method: req.method,
                ip: req.ip,
                error: validation.error
            });

            return res.status(constants.HTTP_STATUS.UNAUTHORIZED).json({
                success: false,
                errorCode: 1,
                message: 'Invalid request signature',
                data: null
            });
        }

        logger.debug('Signature verification successful', {
            path: req.path,
            originalUrl: req.originalUrl,
            method: req.method,
            ip: req.ip
        });

        next();
    } catch (error) {
        logger.error('Signature verification error', {
            path: req.path,
            originalUrl: req.originalUrl,
            method: req.method,
            ip: req.ip,
            error: error.message
        });

        return res.status(constants.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            errorCode: 1,
            message: 'Signature verification error',
            data: null
        });
    }
};


const shouldSkipSignature = (path) => {
    const skipPaths = [
        '/health',
        '/api/health',
        '/api/v1/health',
        '/docs',
        '/docs/swagger.json',
        '/docs/swagger-ui-init.js',
        '/docs/swagger-ui.css',
        '/docs/swagger-ui-standalone-preset.js',
        '/docs/swagger-ui-bundle.js',
        '/favicon.ico',
        '/robots.txt'
    ];

    return skipPaths.some(skipPath =>
        path.startsWith(skipPath) ||
        path.replace('/api', '').startsWith(skipPath.replace('/api', ''))
    );
};


const addSignatureHeaders = (req, res, next) => {
    res.set('X-Signature-Verified', 'true');
    res.set('X-Request-Timestamp', req.headers['x-signature-nonce'] ?
        hmacUtils.extractSignatureComponents(req.headers['x-signature-nonce'])?.timestamp || '' : '');

    next();
};


const validateApiKey = (req, res, next) => {
    if (shouldSkipSignature(req.path)) {
        return next();
    }

    next();
};


const validateTimestamp = (req, res, next) => {
    try {
        // Always allow preflight and whitelisted paths
        if (req.method === 'OPTIONS' || shouldSkipSignature(req.path)) {
            return next();
        }

        const signatureNonce = req.headers['x-signature-nonce'];

        if (!signatureNonce) {
            logger.warn('Missing signature nonce', {
                path: req.path,
                method: req.method,
                ip: req.ip
            });

        return res.status(constants.HTTP_STATUS.UNAUTHORIZED).json({
            success: false,
            errorCode: 1,
            message: 'Request signature nonce is required',
            data: null
        });
        }

        const components = hmacUtils.extractSignatureComponents(signatureNonce);
        if (!components) {
            logger.warn('Invalid signature nonce format', {
                path: req.path,
                method: req.method,
                ip: req.ip,
                signatureNonce
            });

            return res.status(constants.HTTP_STATUS.UNAUTHORIZED).json({
                success: false,
                errorCode: 1,
                message: 'Invalid signature nonce format',
                data: null
            });
        }

        if (!hmacUtils.validateTimestamp(components.timestamp)) {
            logger.warn('Request timestamp expired', {
                path: req.path,
                method: req.method,
                ip: req.ip,
                timestamp: components.timestamp,
                currentTime: Date.now()
            });

            return res.status(constants.HTTP_STATUS.UNAUTHORIZED).json({
                success: false,
                errorCode: 1,
                message: 'Request timestamp has expired',
                data: null
            });
        }

        next();
    } catch (error) {
        logger.error('Timestamp validation error', {
            path: req.path,
            method: req.method,
            ip: req.ip,
            error: error.message
        });

        return res.status(constants.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            errorCode: 1,
            message: 'Timestamp validation error',
            data: null
        });
    }
};

module.exports = {
    verifySignature,
    addSignatureHeaders,
    validateApiKey,
    validateTimestamp
}; 