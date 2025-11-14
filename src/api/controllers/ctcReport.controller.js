const { asyncHandler } = require('../../core/middlewares/error.middleware');
const constants = require('../../core/utils/constants');
const ctcReportHandle = require('../handles/ctcReport.handle');

/**
 * Tạo bảng kê CTC cho tất cả SKU trong lô hàng
 * POST /api/v1/co/lohang/:lohangDraftId/ctc-reports
 */
const generateCTCReports = asyncHandler(async (req, res) => {
  const { lohangDraftId } = req.params;

  if (!lohangDraftId) {
    const err = new Error('Thiếu lohangDraftId');
    err.status = constants.HTTP_STATUS.BAD_REQUEST;
    throw err;
  }

  const result = await ctcReportHandle.generateCTCReports(lohangDraftId);

  return res.status(constants.HTTP_STATUS.OK).json({
    success: true,
    errorCode: 0,
    message: 'Tạo bảng kê thành công',
    data: result
  });
});

/**
 * Lấy danh sách bảng kê CTC đã tạo
 * GET /api/v1/co/lohang/:lohangDraftId/ctc-reports
 */
const getCTCReports = asyncHandler(async (req, res) => {
  const { lohangDraftId } = req.params;
  const result = await ctcReportHandle.getCTCReports(lohangDraftId);

  return res.status(constants.HTTP_STATUS.OK).json({
    success: true,
    errorCode: 0,
    message: 'Thành công',
    data: result
  });
});

/**
 * Retry tạo bảng kê CTC (dùng khi có lỗi ở bước 4)
 * POST /api/v1/co/lohang/:lohangDraftId/ctc-reports/retry
 */
const retryCTCReports = asyncHandler(async (req, res) => {
  const { lohangDraftId } = req.params;

  if (!lohangDraftId) {
    const err = new Error('Thiếu lohangDraftId');
    err.status = constants.HTTP_STATUS.BAD_REQUEST;
    throw err;
  }

  const result = await ctcReportHandle.retryCTCReports(lohangDraftId);

  return res.status(constants.HTTP_STATUS.OK).json({
    success: true,
    errorCode: 0,
    message: 'Retry tạo bảng kê CTC thành công',
    data: result
  });
});

/**
 * Xóa bảng kê CTC
 * DELETE /api/v1/co/lohang/:lohangDraftId/ctc-reports/:skuCode
 */
const deleteCTCReport = asyncHandler(async (req, res) => {
  const { lohangDraftId, skuCode } = req.params;
  await ctcReportHandle.deleteCTCReport(lohangDraftId, skuCode);

  return res.status(constants.HTTP_STATUS.OK).json({
    success: true,
    errorCode: 0,
    message: 'Xóa bảng kê CTC thành công'
  });
});

/**
 * Xác nhận hoàn thành hồ sơ C/O
 * POST /api/v1/co/lohang/:lohangDraftId/complete
 */
const completeCOProcess = asyncHandler(async (req, res) => {
  const { lohangDraftId } = req.params;
  const result = await ctcReportHandle.completeCOProcess(lohangDraftId);

  return res.status(constants.HTTP_STATUS.OK).json({
    success: true,
    errorCode: 0,
    message: 'Đã hoàn thành hồ sơ C/O thành công',
    data: result
  });
});

/**
 * Quay lại step trước để chỉnh sửa
 * POST /api/v1/co/lohang/:lohangDraftId/back-to-step/:stepNumber
 */
const backToStep = asyncHandler(async (req, res) => {
  const { lohangDraftId, stepNumber } = req.params;
  const targetStep = parseInt(stepNumber);

  if (targetStep < 1 || targetStep > 5) {
    const err = new Error('Step number phải từ 1 đến 5');
    err.status = constants.HTTP_STATUS.BAD_REQUEST;
    throw err;
  }

  const result = await ctcReportHandle.backToStep(lohangDraftId, targetStep);

  return res.status(constants.HTTP_STATUS.OK).json({
    success: true,
    errorCode: 0,
    message: `Đã quay lại step ${targetStep} thành công`,
    data: result
  });
});

/**
 * Download Excel report từ Cloudinary với đúng MIME type
 * GET /api/v1/co/reports/download/:publicId
 */
const downloadExcelReport = asyncHandler(async (req, res) => {
  const { publicId } = req.params;

  if (!publicId) {
    const err = new Error('Thiếu publicId');
    err.status = constants.HTTP_STATUS.BAD_REQUEST;
    throw err;
  }

  const result = await ctcReportHandle.downloadExcelReport(publicId);

  // Set headers để browser tải về đúng file Excel
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  return res.status(constants.HTTP_STATUS.OK).send(result.buffer);
});

module.exports = {
  generateCTCReports,
  getCTCReports,
  retryCTCReports,
  deleteCTCReport,
  completeCOProcess,
  backToStep,
  downloadExcelReport
};
