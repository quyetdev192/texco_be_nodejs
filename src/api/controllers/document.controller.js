const { asyncHandler } = require('../../core/middlewares/error.middleware');
const constants = require('../../core/utils/constants');
const docHandle = require('../handles/document.handle');

// Supplier APIs
const supplierCreate = asyncHandler(async (req, res) => {
    const result = await docHandle.supplierCreate(req.userId, req.body || {});
    return res.status(constants.HTTP_STATUS.CREATED).json({ success: true, errorCode: 0, message: 'Tải bộ chứng từ thành công', data: result });
});

const supplierUpdate = asyncHandler(async (req, res) => {
    const result = await docHandle.supplierUpdate(req.userId, req.params.bundleId, req.body || {});
    return res.status(constants.HTTP_STATUS.OK).json({ success: true, errorCode: 0, message: 'Cập nhật bộ chứng từ thành công', data: result });
});

const supplierList = asyncHandler(async (req, res) => {
    const result = await docHandle.supplierList(req.userId, req.query || {});
    return res.status(constants.HTTP_STATUS.OK).json({ success: true, errorCode: 0, message: 'Thành công', data: result });
});

// Staff APIs
const staffList = asyncHandler(async (req, res) => {
    const result = await docHandle.staffList(req.query || {});
    return res.status(constants.HTTP_STATUS.OK).json({ success: true, errorCode: 0, message: 'Thành công', data: result });
});

const staffReview = asyncHandler(async (req, res) => {
    const result = await docHandle.staffReview(req.userId, req.params.bundleId, req.body || {});
    return res.status(constants.HTTP_STATUS.OK).json({ success: true, errorCode: 0, message: 'Cập nhật trạng thái bộ chứng từ thành công', data: result });
});

module.exports = {
    supplierCreate,
    supplierUpdate,
    supplierList,
    staffList,
    staffReview
};


