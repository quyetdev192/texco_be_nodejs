const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const UserModelClass = require('../models/user.model');
const CompanyModelClass = require('../models/company.model');
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
const Company = buildModelFromClass(CompanyModelClass);

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
    result.role_text = helpers.getRoleText(result.role);
    return result;
}

async function ensureAdminSeed() {
    const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin.texco@texco.local';
    const adminUsername = process.env.SEED_ADMIN_USERNAME || 'admin.texco';
    const adminName = process.env.SEED_ADMIN_NAME || 'Texco Administrator';
    const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Texco123456@';
    const adminRole = 'ADMIN';

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

async function login(payload) {
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
    const crypto = require('crypto');
    const jwtCfg = require('../../core/config/security.config').getJwtConfig();

    const newSessionId = crypto.randomBytes(16).toString('hex');
    await User.findByIdAndUpdate(user._id, { $set: { currentSessionId: newSessionId, updatedAt: new Date() } });

    const payloadToken = {
        userId: user._id?.toString(),
        username: user.username,
        email: user.email,
        roles: [user.role],
        sessionId: newSessionId
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

    const safeUser = {
        _id: user._id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        role_text: helpers.getRoleText(user.role),
        companyId: user.companyId,
        phone: user.phone || '',
        avatarUrl: user.avatarUrl || '',
        address: user.address || '',
        isDisabled: !!user.isDisabled,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
    };

    return { user: safeUser, tokens: { accessToken, refreshToken } };
}

async function getProfile(userId) {
    if (!userId) {
        const err = new Error('Thiếu thông tin người dùng');
        err.status = constants.HTTP_STATUS.BAD_REQUEST;
        err.code = constants.ERROR_CODES.VALIDATION_REQUIRED_FIELD;
        throw err;
    }

    const user = await User.findById(userId)
        .populate('companyId')
        .lean();
    
    if (!user) {
        const err = new Error('Không tìm thấy người dùng');
        err.status = constants.HTTP_STATUS.NOT_FOUND;
        err.code = constants.ERROR_CODES.DB_NOT_FOUND;
        throw err;
    }

    const { password: _pw, ...safeUser } = user;
    safeUser.role_text = helpers.getRoleText(safeUser.role);
    
    return safeUser;
}

async function updateProfile(userId, payload) {
    const { fullName, phone, avatarUrl, address, email, company } = payload || {};

    if (!userId) {
        const err = new Error('Thiếu thông tin người dùng');
        err.status = constants.HTTP_STATUS.BAD_REQUEST;
        err.code = constants.ERROR_CODES.VALIDATION_REQUIRED_FIELD;
        throw err;
    }

    // Lấy user hiện tại để kiểm tra companyId
    const currentUser = await User.findById(userId).lean();
    if (!currentUser) {
        const err = new Error('Không tìm thấy người dùng');
        err.status = constants.HTTP_STATUS.NOT_FOUND;
        err.code = constants.ERROR_CODES.DB_NOT_FOUND;
        throw err;
    }

    // Cập nhật thông tin user
    const updates = {};
    if (typeof fullName === 'string' && fullName.trim()) updates.fullName = fullName.trim();
    if (typeof phone === 'string') updates.phone = phone.trim();
    if (typeof avatarUrl === 'string') updates.avatarUrl = avatarUrl.trim();
    if (typeof address === 'string') updates.address = address.trim();
    if (typeof email === 'string' && email.trim()) {
        const newEmail = email.trim().toLowerCase();
        if (!helpers.isValidEmail(newEmail)) {
            const err = new Error('Email không hợp lệ');
            err.status = constants.HTTP_STATUS.UNPROCESSABLE_ENTITY;
            err.code = constants.ERROR_CODES.VALIDATION_INVALID_FORMAT;
            throw err;
        }

        const exists = await User.findOne({ email: newEmail, _id: { $ne: userId } }).lean();
        if (exists) {
            const err = new Error('Email đã tồn tại');
            err.status = constants.HTTP_STATUS.CONFLICT;
            err.code = constants.ERROR_CODES.DB_DUPLICATE_KEY;
            throw err;
        }

        updates.email = newEmail;
    }
    updates.updatedAt = new Date();

    const updated = await User.findByIdAndUpdate(userId, { $set: updates }, { new: true, lean: true });
    if (!updated) {
        const err = new Error('Không tìm thấy người dùng');
        err.status = constants.HTTP_STATUS.NOT_FOUND;
        err.code = constants.ERROR_CODES.DB_NOT_FOUND;
        throw err;
    }

    // Cập nhật thông tin company nếu có
    let companyData = null;
    if (company && updated.companyId) {
        const companyUpdates = {};
        if (typeof company.name === 'string' && company.name.trim()) {
            companyUpdates.name = company.name.trim();
        }
        if (typeof company.taxCode === 'string' && company.taxCode.trim()) {
            companyUpdates.taxCode = company.taxCode.trim();
        }
        if (typeof company.address === 'string') {
            companyUpdates.address = company.address.trim();
        }
        if (typeof company.type === 'string' && ['EXPORTER', 'SUPPLIER'].includes(company.type)) {
            companyUpdates.type = company.type;
        }

        if (Object.keys(companyUpdates).length > 0) {
            companyUpdates.updatedAt = new Date();
            const updatedCompany = await Company.findByIdAndUpdate(
                updated.companyId,
                { $set: companyUpdates },
                { new: true, lean: true }
            );
            companyData = updatedCompany;
        } else {
            // Nếu không có updates nhưng muốn lấy thông tin company
            companyData = await Company.findById(updated.companyId).lean();
        }
    } else if (updated.companyId) {
        // Lấy thông tin company hiện tại
        companyData = await Company.findById(updated.companyId).lean();
    }

    const { password: _pw, ...safeUser } = updated;
    safeUser.role_text = helpers.getRoleText(safeUser.role);
    return { ...safeUser, company: companyData };
}
async function  listUsers(query) {
    const { page, limit, skip, sort } = helpers.buildPagination(query, { sort: '-createdAt' });
    const keyword = (query.search || '').trim();

    const conditions = {};
    if (keyword) {
        conditions.$or = [
            { username: { $regex: keyword, $options: 'i' } },
            { email: { $regex: keyword, $options: 'i' } },
            { fullName: { $regex: keyword, $options: 'i' } },
            { phone: { $regex: keyword, $options: 'i' } }
        ];
    }

    // Filters: role, companyId, isDisabled, createdAt range
    if (query.role) conditions.role = query.role;
    if (query.companyId && mongoose.isValidObjectId(query.companyId)) conditions.companyId = query.companyId;
    if (typeof query.isDisabled !== 'undefined') {
        const val = String(query.isDisabled).toLowerCase();
        conditions.isDisabled = (val === 'true' || val === '1');
    }
    {
        const range = helpers.buildDateRange(query.fromDate, query.toDate);
        if (range) conditions.createdAt = range;
    }

    const [items, total] = await Promise.all([
        User.find(conditions).sort(sort).skip(skip).limit(limit).lean(),
        User.countDocuments(conditions)
    ]);

    const safeItems = items.map(u => ({
        _id: u._id,
        username: u.username,
        email: u.email,
        fullName: u.fullName,
        role: u.role,
        role_text: helpers.getRoleText(u.role),
        companyId: u.companyId,
        phone: u.phone || '',
        avatarUrl: u.avatarUrl || '',
        address: u.address || '',
        isDisabled: !!u.isDisabled,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt
    }));

    return {
        items: safeItems,
        pagination: helpers.buildPaginationMeta(total, page, limit)
    };
}
async function getUserById(id) {
    if (!id || !mongoose.isValidObjectId(id)) {
        const err = new Error('ID không hợp lệ');
        err.status = constants.HTTP_STATUS.BAD_REQUEST;
        err.code = constants.ERROR_CODES.VALIDATION_INVALID_FORMAT;
        throw err;
    }
    const u = await User.findById(id).lean();
    if (!u) {
        const err = new Error('Không tìm thấy người dùng');
        err.status = constants.HTTP_STATUS.NOT_FOUND;
        err.code = constants.ERROR_CODES.DB_NOT_FOUND;
        throw err;
    }
    return {
        _id: u._id,
        username: u.username,
        email: u.email,
        fullName: u.fullName,
        role: u.role,
        role_text: helpers.getRoleText(u.role),
        companyId: u.companyId,
        phone: u.phone || '',
        avatarUrl: u.avatarUrl || '',
        address: u.address || '',
        isDisabled: !!u.isDisabled,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt
    };
}
async function  updateUser(id, payload) {
    if (!id || !mongoose.isValidObjectId(id)) {
        const err = new Error('ID không hợp lệ');
        err.status = constants.HTTP_STATUS.BAD_REQUEST;
        err.code = constants.ERROR_CODES.VALIDATION_INVALID_FORMAT;
        throw err;
    }

    const { fullName, email, phone, avatarUrl, address, role, companyId, isDisabled } = payload || {};

    const updates = {};
    if (typeof fullName === 'string' && fullName.trim()) updates.fullName = fullName.trim();
    if (typeof phone === 'string') updates.phone = phone.trim();
    if (typeof avatarUrl === 'string') updates.avatarUrl = avatarUrl.trim();
    if (typeof address === 'string') updates.address = address.trim();
    if (typeof isDisabled === 'boolean') updates.isDisabled = isDisabled;

    if (email) {
        const newEmail = String(email).trim().toLowerCase();
        if (!helpers.isValidEmail(newEmail)) {
            const err = new Error('Email không hợp lệ');
            err.status = constants.HTTP_STATUS.UNPROCESSABLE_ENTITY;
            err.code = constants.ERROR_CODES.VALIDATION_INVALID_FORMAT;
            throw err;
        }
        const exists = await User.findOne({ email: newEmail, _id: { $ne: id } }).lean();
        if (exists) {
            const err = new Error('Email đã tồn tại');
            err.status = constants.HTTP_STATUS.CONFLICT;
            err.code = constants.ERROR_CODES.DB_DUPLICATE_KEY;
            throw err;
        }
        updates.email = newEmail;
    }

    if (role) {
        const allowedRoles = UserModelClass.getSchema().role.enum;
        if (!allowedRoles.includes(role)) {
            const err = new Error(`Vai trò không hợp lệ. Cho phép: ${allowedRoles.join(', ')}`);
            err.status = constants.HTTP_STATUS.UNPROCESSABLE_ENTITY;
            err.code = constants.ERROR_CODES.VALIDATION_INVALID_TYPE;
            throw err;
        }
        updates.role = role;
    }

    if (companyId) {
        if (!mongoose.isValidObjectId(companyId)) {
            const err = new Error('companyId không hợp lệ');
            err.status = constants.HTTP_STATUS.UNPROCESSABLE_ENTITY;
            err.code = constants.ERROR_CODES.VALIDATION_INVALID_FORMAT;
            throw err;
        }
        updates.companyId = companyId;
    }

    updates.updatedAt = new Date();

    const updated = await User.findByIdAndUpdate(id, { $set: updates }, { new: true, lean: true });
    if (!updated) {
        const err = new Error('Không tìm thấy người dùng');
        err.status = constants.HTTP_STATUS.NOT_FOUND;
        err.code = constants.ERROR_CODES.DB_NOT_FOUND;
        throw err;
    }

    return {
        _id: updated._id,
        username: updated.username,
        email: updated.email,
        fullName: updated.fullName,
        role: updated.role,
        role_text: helpers.getRoleText(updated.role),
        companyId: updated.companyId,
        phone: updated.phone || '',
        avatarUrl: updated.avatarUrl || '',
        address: updated.address || '',
        isDisabled: !!updated.isDisabled,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt
    };
}
async function  deleteUser(id) {
    if (!id || !mongoose.isValidObjectId(id)) {
        const err = new Error('ID không hợp lệ');
        err.status = constants.HTTP_STATUS.BAD_REQUEST;
        err.code = constants.ERROR_CODES.VALIDATION_INVALID_FORMAT;
        throw err;
    }
    const deleted = await User.findByIdAndDelete(id).lean();
    if (!deleted) {
        const err = new Error('Không tìm thấy người dùng');
        err.status = constants.HTTP_STATUS.NOT_FOUND;
        err.code = constants.ERROR_CODES.DB_NOT_FOUND;
        throw err;
    }
    return { deleted: true };
}

module.exports = {
    createUser,
    ensureAdminSeed,
    login,
    getProfile,
    updateProfile,
    listUsers,
    getUserById,
    updateUser,
    deleteUser
};
