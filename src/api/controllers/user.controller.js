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

module.exports = {
    create,
    login
};

