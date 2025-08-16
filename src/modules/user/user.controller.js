const userService = require('./user.service');
const logger = require('../../config/logger.config');
const constants = require('../../utils/constants');
const { asyncHandler } = require('../../middlewares/error.middleware');

class UserController {

    createUser = asyncHandler(async (req, res) => {
        try {
            const userData = req.body;

            if (!userData.email || !userData.password || !userData.firstName || !userData.lastName) {
                return res.status(constants.HTTP_STATUS.BAD_REQUEST).json({
                    success: false,
                    error: {
                        code: constants.ERROR_CODES.VALIDATION_REQUIRED_FIELD,
                        message: req.t ? req.t('user.validation.requiredFields') : 'Email, password, first name, and last name are required'
                    }
                });
            }

            const user = await userService.createUser(userData);

            res.status(constants.HTTP_STATUS.CREATED).json({
                success: true,
                message: req.t ? req.t('user.created') : 'User created successfully',
                data: user
            });
        } catch (error) {
            logger.error('Error in createUser controller', {
                error: error.message,
                body: req.body
            });

            if (error.message.includes('already exists')) {
                return res.status(constants.HTTP_STATUS.CONFLICT).json({
                    success: false,
                    error: {
                        code: constants.ERROR_CODES.DB_DUPLICATE_KEY,
                        message: req.t ? req.t('user.error.emailExists') : 'User with this email already exists'
                    }
                });
            }

            if (error.message.includes('Password validation failed')) {
                return res.status(constants.HTTP_STATUS.BAD_REQUEST).json({
                    success: false,
                    error: {
                        code: constants.ERROR_CODES.VALIDATION_REQUIRED_FIELD,
                        message: error.message
                    }
                });
            }

            res.status(constants.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
                success: false,
                error: {
                    code: constants.ERROR_CODES.INTERNAL_ERROR,
                    message: req.t ? req.t('user.error.createFailed') : 'Failed to create user'
                }
            });
        }
    });

 

    getUsers = asyncHandler(async (req, res) => {
        try {
            const {
                page = constants.PAGINATION.DEFAULT_PAGE,
                limit = constants.PAGINATION.DEFAULT_LIMIT,
                search,
                role,
                isActive,
                sortBy = 'createdAt',
                sortOrder = 'desc'
            } = req.query;

            const options = {
                page: parseInt(page),
                limit: Math.min(parseInt(limit), constants.PAGINATION.MAX_LIMIT),
                search,
                role,
                isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
                sortBy,
                sortOrder
            };

            const result = await userService.getUsers(options);

            res.status(constants.HTTP_STATUS.OK).json({
                success: true,
                data: result.users,
                pagination: result.pagination
            });
        } catch (error) {
            logger.error('Error in getUsers controller', {
                query: req.query,
                error: error.message
            });

            res.status(constants.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
                success: false,
                error: {
                    code: constants.ERROR_CODES.INTERNAL_ERROR,
                    message: req.t ? req.t('user.error.getFailed') : 'Failed to get users'
                }
            });
        }
    });

 
    login = asyncHandler(async (req, res) => {
        try {
            const { email, password } = req.body;

            if (!email || !password) {
                return res.status(constants.HTTP_STATUS.BAD_REQUEST).json({
                    success: false,
                    error: {
                        code: constants.ERROR_CODES.VALIDATION_REQUIRED_FIELD,
                        message: req.t ? req.t('user.validation.loginRequired') : 'Email and password are required'
                    }
                });
            }

            const result = await userService.authenticateUser(email, password);

            res.status(constants.HTTP_STATUS.OK).json({
                success: true,
                message: req.t ? req.t('user.loginSuccess') : 'Login successful',
                data: {
                    user: result.user,
                    tokens: result.tokens
                }
            });
        } catch (error) {
            logger.error('Error in login controller', {
                email: req.body.email,
                error: error.message
            });

            if (error.message === 'Invalid credentials') {
                return res.status(constants.HTTP_STATUS.UNAUTHORIZED).json({
                    success: false,
                    error: {
                        code: constants.ERROR_CODES.AUTH_INVALID_CREDENTIALS,
                        message: req.t ? req.t('user.error.invalidCredentials') : 'Invalid email or password'
                    }
                });
            }


            res.status(constants.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
                success: false,
                error: {
                    code: constants.ERROR_CODES.INTERNAL_ERROR,
                    message: req.t ? req.t('user.error.loginFailed') : 'Login failed'
                }
            });
        }
    });

  
}

module.exports = new UserController(); 