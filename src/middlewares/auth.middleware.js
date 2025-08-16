const jwt = require('jsonwebtoken');
const securityConfig = require('../config/security.config');
const logger = require('../config/logger.config');
const constants = require('../utils/constants');

const verifyToken = (req, res, next) => {
    try {
        const token = extractToken(req);

        if (!token) {
            logger.warn('Missing JWT token', {
                path: req.path,
                method: req.method,
                ip: req.ip
            });

            return res.status(constants.HTTP_STATUS.UNAUTHORIZED).json({
                success: false,
                error: {
                    code: constants.ERROR_CODES.AUTH_TOKEN_INVALID,
                    message: req.t ? req.t('auth.token.missing') : 'Access token is required'
                }
            });
        }

        const jwtConfig = securityConfig.getJwtConfig();
        jwt.verify(token, jwtConfig.secret, {
            issuer: jwtConfig.issuer,
            audience: jwtConfig.audience
        }, (err, decoded) => {
            if (err) {
                let errorCode = constants.ERROR_CODES.AUTH_TOKEN_INVALID;
                let errorMessage = req.t ? req.t('auth.token.invalid') : 'Invalid access token';

                if (err.name === 'TokenExpiredError') {
                    errorCode = constants.ERROR_CODES.AUTH_TOKEN_EXPIRED;
                    errorMessage = req.t ? req.t('auth.token.expired') : 'Access token has expired';
                }

                logger.warn('JWT verification failed', {
                    path: req.path,
                    method: req.method,
                    ip: req.ip,
                    error: err.message
                });

                return res.status(constants.HTTP_STATUS.UNAUTHORIZED).json({
                    success: false,
                    error: {
                        code: errorCode,
                        message: errorMessage
                    }
                });
            }

            req.user = decoded;
            req.userId = decoded.userId || decoded.id;

            logger.debug('JWT verification successful', {
                path: req.path,
                method: req.method,
                ip: req.ip,
                userId: req.userId
            });

            next();
        });
    } catch (error) {
        logger.error('JWT verification error', {
            path: req.path,
            method: req.method,
            ip: req.ip,
            error: error.message
        });

        return res.status(constants.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            error: {
                code: constants.ERROR_CODES.INTERNAL_ERROR,
                message: req.t ? req.t('auth.token.error') : 'Token verification error'
            }
        });
    }
};


const extractToken = (req) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.substring(7);
    }

    if (req.query.token) {
        return req.query.token;
    }

    if (req.cookies && req.cookies.token) {
        return req.cookies.token;
    }

    return null;
};


const requireAuth = (req, res, next) => {
    if (!req.user) {
        logger.warn('Authentication required', {
            path: req.path,
            method: req.method,
            ip: req.ip
        });

        return res.status(constants.HTTP_STATUS.UNAUTHORIZED).json({
            success: false,
            error: {
                code: constants.ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
                message: req.t ? req.t('auth.required') : 'Authentication required'
            }
        });
    }

    next();
};


const requireRole = (roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(constants.HTTP_STATUS.UNAUTHORIZED).json({
                success: false,
                error: {
                    code: constants.ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
                    message: req.t ? req.t('auth.required') : 'Authentication required'
                }
            });
        }

        const userRoles = req.user.roles || [];
        const requiredRoles = Array.isArray(roles) ? roles : [roles];

        const hasRole = requiredRoles.some(role => userRoles.includes(role));

        if (!hasRole) {
            logger.warn('Insufficient permissions', {
                path: req.path,
                method: req.method,
                ip: req.ip,
                userId: req.userId,
                userRoles,
                requiredRoles
            });

            return res.status(constants.HTTP_STATUS.FORBIDDEN).json({
                success: false,
                error: {
                    code: constants.ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
                    message: req.t ? req.t('auth.insufficientPermissions') : 'Insufficient permissions'
                }
            });
        }

        next();
    };
};


const requirePermission = (permissions) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(constants.HTTP_STATUS.UNAUTHORIZED).json({
                success: false,
                error: {
                    code: constants.ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
                    message: req.t ? req.t('auth.required') : 'Authentication required'
                }
            });
        }

        const userPermissions = req.user.permissions || [];
        const requiredPermissions = Array.isArray(permissions) ? permissions : [permissions];

        const hasPermission = requiredPermissions.some(permission => userPermissions.includes(permission));

        if (!hasPermission) {
            logger.warn('Insufficient permissions', {
                path: req.path,
                method: req.method,
                ip: req.ip,
                userId: req.userId,
                userPermissions,
                requiredPermissions
            });

            return res.status(constants.HTTP_STATUS.FORBIDDEN).json({
                success: false,
                error: {
                    code: constants.ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
                    message: req.t ? req.t('auth.insufficientPermissions') : 'Insufficient permissions'
                }
            });
        }

        next();
    };
};


const requireOwnership = (getResourceUserId) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(constants.HTTP_STATUS.UNAUTHORIZED).json({
                success: false,
                error: {
                    code: constants.ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
                    message: req.t ? req.t('auth.required') : 'Authentication required'
                }
            });
        }

        const resourceUserId = getResourceUserId(req);

        if (req.userId !== resourceUserId && !isAdmin(req.user)) {
            logger.warn('Resource ownership required', {
                path: req.path,
                method: req.method,
                ip: req.ip,
                userId: req.userId,
                resourceUserId
            });

            return res.status(constants.HTTP_STATUS.FORBIDDEN).json({
                success: false,
                error: {
                    code: constants.ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
                    message: req.t ? req.t('auth.ownershipRequired') : 'Resource ownership required'
                }
            });
        }

        next();
    };
};


const isAdmin = (user) => {
    return user.roles && user.roles.includes('admin');
};


const refreshToken = (req, res, next) => {
    try {
        const refreshToken = req.body.refreshToken || req.cookies?.refreshToken;

        if (!refreshToken) {
            return res.status(constants.HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: {
                    code: constants.ERROR_CODES.AUTH_TOKEN_INVALID,
                    message: req.t ? req.t('auth.refreshToken.missing') : 'Refresh token is required'
                }
            });
        }

        const jwtConfig = securityConfig.getJwtConfig();
        jwt.verify(refreshToken, jwtConfig.secret, {
            issuer: jwtConfig.issuer,
            audience: jwtConfig.audience
        }, (err, decoded) => {
            if (err) {
                logger.warn('Refresh token verification failed', {
                    ip: req.ip,
                    error: err.message
                });

                return res.status(constants.HTTP_STATUS.UNAUTHORIZED).json({
                    success: false,
                    error: {
                        code: constants.ERROR_CODES.AUTH_TOKEN_INVALID,
                        message: req.t ? req.t('auth.refreshToken.invalid') : 'Invalid refresh token'
                    }
                });
            }

            const newAccessToken = jwt.sign(
                {
                    userId: decoded.userId,
                    email: decoded.email,
                    roles: decoded.roles
                },
                jwtConfig.secret,
                {
                    expiresIn: jwtConfig.expiresIn,
                    issuer: jwtConfig.issuer,
                    audience: jwtConfig.audience
                }
            );

            req.newAccessToken = newAccessToken;
            next();
        });
    } catch (error) {
        logger.error('Token refresh error', {
            ip: req.ip,
            error: error.message
        });

        return res.status(constants.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            error: {
                code: constants.ERROR_CODES.INTERNAL_ERROR,
                message: req.t ? req.t('auth.refreshToken.error') : 'Token refresh error'
            }
        });
    }
};

module.exports = {
    verifyToken,
    requireAuth,
    requireRole,
    requirePermission,
    requireOwnership,
    refreshToken,
    extractToken
}; 