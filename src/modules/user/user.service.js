const User = require('./user.model');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const securityConfig = require('../../config/security.config');
const logger = require('../../config/logger.config');
const constants = require('../../utils/constants');
const helpers = require('../../utils/helpers');

class UserService {

    async createUser(userData) {
        try {
            const existingUser = await User.findByEmail(userData.email);
            if (existingUser) {
                throw new Error('User with this email already exists');
            }

            const passwordValidation = helpers.validatePassword(userData.password);
            if (!passwordValidation.isValid) {
                throw new Error(`Password validation failed: ${passwordValidation.errors.join(', ')}`);
            }

            const user = new User(userData);
            await user.save();

            logger.info('User created successfully', {
                userId: user._id,
                email: user.email
            });

            return user;
        } catch (error) {
            logger.error('Error creating user', {
                email: userData.email,
                error: error.message
            });
            throw error;
        }
    }

    async getUserById(userId) {
        try {
            const user = await User.findById(userId);
            if (!user) {
                throw new Error('User not found');
            }
            return user;
        } catch (error) {
            logger.error('Error getting user by ID', {
                userId,
                error: error.message
            });
            throw error;
        }
    }

    async getUserByEmail(email) {
        try {
            const user = await User.findByEmail(email);
            if (!user) {
                throw new Error('User not found');
            }
            return user;
        } catch (error) {
            logger.error('Error getting user by email', {
                email,
                error: error.message
            });
            throw error;
        }
    }

    async getUsers(options = {}) {
        try {
            const {
                page = constants.PAGINATION.DEFAULT_PAGE,
                limit = constants.PAGINATION.DEFAULT_LIMIT,
                search,
                role,
                isActive,
                sortBy = 'createdAt',
                sortOrder = 'desc'
            } = options;

            const query = {};

            if (search) {
                query.$or = [
                    { firstName: { $regex: search, $options: 'i' } },
                    { lastName: { $regex: search, $options: 'i' } },
                    { email: { $regex: search, $options: 'i' } }
                ];
            }

            if (role) {
                query.roles = role;
            }

            if (typeof isActive === 'boolean') {
                query.isActive = isActive;
            }

            const sort = {};
            sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

            const skip = (page - 1) * limit;
            const users = await User.find(query)
                .sort(sort)
                .skip(skip)
                .limit(limit)
                .select('-password -emailVerificationToken -passwordResetToken');

            const total = await User.countDocuments(query);

            logger.info('Users retrieved successfully', {
                count: users.length,
                total,
                page,
                limit
            });

            return {
                users,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            };
        } catch (error) {
            logger.error('Error getting users', {
                options,
                error: error.message
            });
            throw error;
        }
    }

    async updateUser(userId, updateData) {
        try {
            const { password, email, roles, ...safeUpdateData } = updateData;

            const user = await User.findByIdAndUpdate(
                userId,
                { $set: safeUpdateData },
                { new: true, runValidators: true }
            );

            if (!user) {
                throw new Error('User not found');
            }

            logger.info('User updated successfully', {
                userId,
                updatedFields: Object.keys(safeUpdateData)
            });

            return user;
        } catch (error) {
            logger.error('Error updating user', {
                userId,
                error: error.message
            });
            throw error;
        }
    }

    async changePassword(userId, currentPassword, newPassword) {
        try {
            const user = await User.findById(userId);
            if (!user) {
                throw new Error('User not found');
            }

            const isCurrentPasswordValid = await user.comparePassword(currentPassword);
            if (!isCurrentPasswordValid) {
                throw new Error('Current password is incorrect');
            }

            const passwordValidation = helpers.validatePassword(newPassword);
            if (!passwordValidation.isValid) {
                throw new Error(`Password validation failed: ${passwordValidation.errors.join(', ')}`);
            }

            user.password = newPassword;
            await user.save();

            logger.info('Password changed successfully', {
                userId
            });

            return true;
        } catch (error) {
            logger.error('Error changing password', {
                userId,
                error: error.message
            });
            throw error;
        }
    }

    async deleteUser(userId) {
        try {
            const user = await User.findByIdAndDelete(userId);
            if (!user) {
                throw new Error('User not found');
            }

            logger.info('User deleted successfully', {
                userId,
                email: user.email
            });

            return true;
        } catch (error) {
            logger.error('Error deleting user', {
                userId,
                error: error.message
            });
            throw error;
        }
    }

    async authenticateUser(email, password) {
        try {
            const user = await User.findByEmail(email);
            if (!user) {
                throw new Error('Invalid credentials');
            }

            

            const isPasswordValid = await user.comparePassword(password);
            if (!isPasswordValid) {
                await user.incLoginAttempts();
                throw new Error('Invalid credentials');
            }

           
            const tokens = await this.generateTokens(user);

            logger.info('User authenticated successfully', {
                userId: user._id,
                email: user.email
            });

            return {
                user,
                tokens
            };
        } catch (error) {
            logger.error('Authentication failed', {
                email,
                error: error.message
            });
            throw error;
        }
    }

    async generateTokens(user) {
        try {
            const jwtConfig = securityConfig.getJwtConfig();

            const payload = {
                userId: user._id,
                email: user.email,
                roles: user.roles,
                permissions: user.permissions
            };

            const accessToken = jwt.sign(payload, jwtConfig.secret, {
                expiresIn: jwtConfig.expiresIn,
                issuer: jwtConfig.issuer,
                audience: jwtConfig.audience
            });

            const refreshToken = jwt.sign(payload, jwtConfig.secret, {
                expiresIn: jwtConfig.refreshExpiresIn,
                issuer: jwtConfig.issuer,
                audience: jwtConfig.audience
            });

            return {
                accessToken,
                refreshToken
            };
        } catch (error) {
            logger.error('Error generating tokens', {
                userId: user._id,
                error: error.message
            });
            throw error;
        }
    }

    async refreshAccessToken(refreshToken) {
        try {
            const jwtConfig = securityConfig.getJwtConfig();

            const decoded = jwt.verify(refreshToken, jwtConfig.secret, {
                issuer: jwtConfig.issuer,
                audience: jwtConfig.audience
            });

            const user = await User.findById(decoded.userId);
            if (!user || !user.isActive) {
                throw new Error('User not found or inactive');
            }

            const newAccessToken = jwt.sign(
                {
                    userId: user._id,
                    email: user.email,
                    roles: user.roles,
                    permissions: user.permissions
                },
                jwtConfig.secret,
                {
                    expiresIn: jwtConfig.expiresIn,
                    issuer: jwtConfig.issuer,
                    audience: jwtConfig.audience
                }
            );

            logger.info('Access token refreshed successfully', {
                userId: user._id
            });

            return {
                accessToken: newAccessToken
            };
        } catch (error) {
            logger.error('Error refreshing access token', {
                error: error.message
            });
            throw error;
        }
    }

    async generatePasswordResetToken(email) {
        try {
            const user = await User.findByEmail(email);
            if (!user) {
                throw new Error('User not found');
            }

            const resetToken = user.generatePasswordResetToken();
            await user.save();

            logger.info('Password reset token generated', {
                userId: user._id,
                email: user.email
            });

            return {
                email: user.email,
                resetToken,
                expiresAt: user.passwordResetExpires
            };
        } catch (error) {
            logger.error('Error generating password reset token', {
                email,
                error: error.message
            });
            throw error;
        }
    }

    async resetPassword(resetToken, newPassword) {
        try {
            const user = await User.findOne({
                passwordResetToken: resetToken,
                passwordResetExpires: { $gt: Date.now() }
            });

            if (!user) {
                throw new Error('Invalid or expired reset token');
            }

            const passwordValidation = helpers.validatePassword(newPassword);
            if (!passwordValidation.isValid) {
                throw new Error(`Password validation failed: ${passwordValidation.errors.join(', ')}`);
            }

            user.password = newPassword;
            user.passwordResetToken = undefined;
            user.passwordResetExpires = undefined;
            await user.save();

            logger.info('Password reset successfully', {
                userId: user._id
            });

            return true;
        } catch (error) {
            logger.error('Error resetting password', {
                error: error.message
            });
            throw error;
        }
    }

    async verifyEmail(verificationToken) {
        try {
            const user = await User.findOne({
                emailVerificationToken: verificationToken,
                emailVerificationExpires: { $gt: Date.now() }
            });

            if (!user) {
                throw new Error('Invalid or expired verification token');
            }

            user.isEmailVerified = true;
            user.emailVerificationToken = undefined;
            user.emailVerificationExpires = undefined;
            await user.save();

            logger.info('Email verified successfully', {
                userId: user._id
            });

            return true;
        } catch (error) {
            logger.error('Error verifying email', {
                error: error.message
            });
            throw error;
        }
    }


    async getUserStatistics() {
        try {
            const totalUsers = await User.countDocuments();
            const activeUsers = await User.countDocuments({ isActive: true });
            const verifiedUsers = await User.countDocuments({ isEmailVerified: true });
            const adminUsers = await User.countDocuments({ roles: 'admin' });

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const newUsersToday = await User.countDocuments({
                createdAt: { $gte: today }
            });

            return {
                total: totalUsers,
                active: activeUsers,
                verified: verifiedUsers,
                admins: adminUsers,
                newToday: newUsersToday
            };
        } catch (error) {
            logger.error('Error getting user statistics', {
                error: error.message
            });
            throw error;
        }
    }
}

module.exports = new UserService(); 