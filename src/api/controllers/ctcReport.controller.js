const { asyncHandler } = require('../../core/middlewares/error.middleware');
const constants = require('../../core/utils/constants');
const ctcReportHandle = require('../handles/ctcReport.handle');

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
    message: 'Retry tạo bảng kê thành công',
    data: result
  });
});

const deleteCTCReport = asyncHandler(async (req, res) => {
  const { lohangDraftId, skuCode } = req.params;
  await ctcReportHandle.deleteCTCReport(lohangDraftId, skuCode);

  return res.status(constants.HTTP_STATUS.OK).json({
    success: true,
    errorCode: 0,
    message: 'Xóa bảng kê CTC thành công'
  });
});

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

module.exports = {
  generateCTCReports,
  getCTCReports,
  retryCTCReports,
  deleteCTCReport,
  completeCOProcess,
  backToStep
};
