const { asyncHandler } = require('../../core/middlewares/error.middleware');
const constants = require('../../core/utils/constants');
const userHandle = require('../handles/user.handle');

const create = asyncHandler(async (req, res) => {
    const { username, email, password, fullName, role, companyId } = req.body || {};
    const user = await userHandle.createUser({ username, email, password, fullName, role, companyId });
    return res.status(constants.HTTP_STATUS.CREATED).json({ success: true, errorCode: 0, message: 'Thành công', data: user });
});

const login = asyncHandler(async (req, res) => {
    const { username, password } = req.body || {};
    const result = await userHandle.login({ username, password });
    return res.status(constants.HTTP_STATUS.OK).json({ success: true, errorCode: 0, message: 'Đăng nhập thành công', data: result });
});

const getProfile = asyncHandler(async (req, res) => {
    const userId = req.userId;
    const result = await userHandle.getProfile(userId);
    return res.status(constants.HTTP_STATUS.OK).json({ success: true, errorCode: 0, message: 'Thành công', data: result });
});

const updateProfile = asyncHandler(async (req, res) => {
    const userId = req.userId;
    const { fullName, phone, avatarUrl, address, email, company } = req.body || {};
    const result = await userHandle.updateProfile(userId, { fullName, phone, avatarUrl, address, email, company });
    return res.status(constants.HTTP_STATUS.OK).json({ success: true, errorCode: 0, message: 'Cập nhật thông tin thành công', data: result });
});

const listUsers = asyncHandler(async (req, res) => {
    const result = await userHandle.listUsers(req.query || {});
    return res.status(constants.HTTP_STATUS.OK).json({ success: true, errorCode: 0, message: 'Thành công', data: result });
});

const createUser = asyncHandler(async (req, res) => {
    const { username, email, password, fullName, role, companyId } = req.body || {};
    const user = await userHandle.createUser({ username, email, password, fullName, role, companyId });
    return res.status(constants.HTTP_STATUS.CREATED).json({ success: true, errorCode: 0, message: 'Thành công', data: user });
});

const updateUser = asyncHandler(async (req, res) => {
    const result = await userHandle.updateUser(req.params.id, req.body || {});
    return res.status(constants.HTTP_STATUS.OK).json({ success: true, errorCode: 0, message: 'Cập nhật thành công', data: result });
});

const deleteUser = asyncHandler(async (req, res) => {
    const result = await userHandle.deleteUser(req.params.id);
    return res.status(constants.HTTP_STATUS.OK).json({ success: true, errorCode: 0, message: 'Xoá thành công', data: result });
});

module.exports = {
    create,
    login,
    getProfile,
    updateProfile,
    listUsers,
    createUser,
    updateUser,
    deleteUser
};

