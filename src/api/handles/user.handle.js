const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const UserModelClass = require('../models/user.model');
const constants = require('../../core/utils/constants');
const helpers = require('../../core/utils/helpers');

function buildModelFromClass(modelClass) {
    const modelName = modelClass.name;
    if (mongoose.models[modelName]) return mongoose.models[modelName];

    const schemaDefinition = modelClass.getSchema();
    const schema = new mongoose.Schema(schemaDefinition, { collection: modelClass.collection });
    return mongoose.model(modelName, schema);
}

const User = buildModelFromClass(UserModelClass);

async function createUser(payload) {
    const { username, email, password, fullName, role, companyId } = payload || {};

    if (!username || typeof username !== 'string' || username.trim().length < 3) {
        const err = new Error('Tên đăng nhập không hợp lệ');
        err.status = constants.HTTP_STATUS.UNPROCESSABLE_ENTITY;
        err.code = constants.ERROR_CODES.VALIDATION_INVALID_FORMAT;
        throw err;
    }

    if (!email || !helpers.isValidEmail(email)) {
        const err = new Error('Email không hợp lệ');
        err.status = constants.HTTP_STATUS.UNPROCESSABLE_ENTITY;
        err.code = constants.ERROR_CODES.VALIDATION_INVALID_FORMAT;
        throw err;
    }

    const passwordPolicy = require('../../core/config/security.config').getPasswordPolicy();
    const passwordValidation = helpers.validatePassword(password || '', passwordPolicy);
    if (!password || !passwordValidation.isValid) {
        const err = new Error(passwordValidation.errors[0] || 'Mật khẩu không hợp lệ');
        err.status = constants.HTTP_STATUS.UNPROCESSABLE_ENTITY;
        err.code = constants.ERROR_CODES.VALIDATION_INVALID_FORMAT;
        throw err;
    }

    if (!fullName || typeof fullName !== 'string') {
        const err = new Error('Họ tên không hợp lệ');
        err.status = constants.HTTP_STATUS.UNPROCESSABLE_ENTITY;
        err.code = constants.ERROR_CODES.VALIDATION_REQUIRED_FIELD;
        throw err;
    }

    const allowedRoles = UserModelClass.getSchema().role.enum;
    if (!role || !allowedRoles.includes(role)) {
        const err = new Error(`Vai trò không hợp lệ. Cho phép: ${allowedRoles.join(', ')}`);
        err.status = constants.HTTP_STATUS.UNPROCESSABLE_ENTITY;
        err.code = constants.ERROR_CODES.VALIDATION_INVALID_TYPE;
        throw err;
    }

    const existingByUsername = await User.findOne({ username: username.toLowerCase() }).lean();
    if (existingByUsername) {
        const err = new Error('Tên đăng nhập đã tồn tại');
        err.status = constants.HTTP_STATUS.CONFLICT;
        err.code = constants.ERROR_CODES.DB_DUPLICATE_KEY;
        throw err;
    }

    const existingByEmail = await User.findOne({ email: email.toLowerCase() }).lean();
    if (existingByEmail) {
        const err = new Error('Email đã tồn tại');
        err.status = constants.HTTP_STATUS.CONFLICT;
        err.code = constants.ERROR_CODES.DB_DUPLICATE_KEY;
        throw err;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const userDoc = new User({
        username: username.toLowerCase(),
        email: email.toLowerCase(),
        password: hashedPassword,
        fullName,
        role,
        companyId: companyId || undefined
    });

    const saved = await userDoc.save();
    const result = saved.toObject();
    delete result.password;
    return result;
}

async function ensureAdminSeed() {
    const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@texco.local';
    const adminUsername = process.env.SEED_ADMIN_USERNAME || 'admin';
    const adminName = process.env.SEED_ADMIN_NAME || 'System Administrator';
    const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin@12345';
    const adminRole = 'STAFF';

    const exists = await User.findOne({ $or: [ { email: adminEmail.toLowerCase() }, { username: adminUsername.toLowerCase() } ] }).lean();
    if (exists) return { seeded: false, username: exists.username, email: exists.email };

    const hashed = await bcrypt.hash(adminPassword, 10);
    await User.create({
        username: adminUsername.toLowerCase(),
        email: adminEmail.toLowerCase(),
        password: hashed,
        fullName: adminName,
        role: adminRole
    });

    return { seeded: true, username: adminUsername, email: adminEmail };
}

module.exports = {
    createUser,
    ensureAdminSeed,
    login: async function(payload) {
        const { username, password } = payload || {};

        if (!username || typeof username !== 'string') {
            const err = new Error('Tên đăng nhập không hợp lệ');
            err.status = constants.HTTP_STATUS.UNPROCESSABLE_ENTITY;
            err.code = constants.ERROR_CODES.VALIDATION_INVALID_FORMAT;
            throw err;
        }

        if (!password || typeof password !== 'string') {
            const err = new Error('Mật khẩu không hợp lệ');
            err.status = constants.HTTP_STATUS.UNPROCESSABLE_ENTITY;
            err.code = constants.ERROR_CODES.VALIDATION_INVALID_FORMAT;
            throw err;
        }

        const user = await User.findOne({ username: username.toLowerCase() }).lean();
        if (!user) {
            const err = new Error('Tài khoản hoặc mật khẩu không đúng');
            err.status = constants.HTTP_STATUS.UNAUTHORIZED;
            err.code = constants.ERROR_CODES.AUTH_INVALID_CREDENTIALS;
            throw err;
        }

        if (user.isDisabled) {
            const err = new Error('Tài khoản đã bị vô hiệu hóa');
            err.status = constants.HTTP_STATUS.FORBIDDEN;
            err.code = constants.ERROR_CODES.AUTH_ACCOUNT_DISABLED;
            throw err;
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            const err = new Error('Tài khoản hoặc mật khẩu không đúng');
            err.status = constants.HTTP_STATUS.UNAUTHORIZED;
            err.code = constants.ERROR_CODES.AUTH_INVALID_CREDENTIALS;
            throw err;
        }

        const jwt = require('jsonwebtoken');
        const jwtCfg = require('../../core/config/security.config').getJwtConfig();

        const payloadToken = {
            userId: user._id?.toString(),
            username: user.username,
            email: user.email,
            roles: [user.role]
        };

        const accessToken = jwt.sign(payloadToken, jwtCfg.secret, {
            expiresIn: jwtCfg.expiresIn,
            issuer: jwtCfg.issuer,
            audience: jwtCfg.audience
        });

        const refreshToken = jwt.sign(payloadToken, jwtCfg.secret, {
            expiresIn: jwtCfg.refreshExpiresIn,
            issuer: jwtCfg.issuer,
            audience: jwtCfg.audience
        });

        const { password: _pw, ...safeUser } = user;
        return { user: safeUser, tokens: { accessToken, refreshToken } };
    }
};
