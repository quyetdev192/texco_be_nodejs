const { asyncHandler } = require('../../core/middlewares/error.middleware');
const constants = require('../../core/utils/constants');
const docHandle = require('../handles/document.handle');

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

const staffList = asyncHandler(async (req, res) => {
    const result = await docHandle.staffList(req.query || {});
    return res.status(constants.HTTP_STATUS.OK).json({ success: true, errorCode: 0, message: 'Thành công', data: result });
});

const staffReview = asyncHandler(async (req, res) => {
    const result = await docHandle.staffReview(req.userId, req.params.bundleId, req.body || {});
    return res.status(constants.HTTP_STATUS.OK).json({ success: true, errorCode: 0, message: 'Cập nhật trạng thái bộ chứng từ thành công', data: result });
});

const staffRetryOcr = asyncHandler(async (req, res) => {
    const result = await docHandle.staffRetryOcr(req.userId, req.params.bundleId, req.params.documentId);
    return res.status(constants.HTTP_STATUS.OK).json({ success: true, errorCode: 0, message: 'Đã khởi chạy lại OCR cho chứng từ', data: result });
});

const staffRetryOcrForBundle = asyncHandler(async (req, res) => {
    const result = await docHandle.staffRetryOcrForBundle(req.userId, req.params.bundleId);
    return res.status(constants.HTTP_STATUS.OK).json({ success: true, errorCode: 0, message: 'Đã khởi chạy lại OCR cho các chứng từ lỗi trong bộ', data: result });
});

const staffAddDocuments = asyncHandler(async (req, res) => {
    const result = await docHandle.staffAddDocuments(req.userId, req.params.bundleId, req.body || {});
    return res.status(constants.HTTP_STATUS.OK).json({ success: true, errorCode: 0, message: 'Đã bổ sung chứng từ và khởi chạy OCR', data: result });
});

module.exports = {
    supplierCreate,
    supplierUpdate,
    supplierList,
    staffList,
    staffReview,
    staffRetryOcr,
    staffRetryOcrForBundle,
    staffAddDocuments
};


