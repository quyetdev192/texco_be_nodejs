const { asyncHandler } = require('../../core/middlewares/error.middleware');
const constants = require('../../core/utils/constants');
const coProcessHandle = require('../handles/coProcess.handle');


/**
 * Lấy chi tiết lô hàng
 * GET /api/v1/co/lohang/:lohangDraftId
 */
const getLohangDetail = asyncHandler(async (req, res) => {
  const { lohangDraftId } = req.params;
  const result = await coProcessHandle.getLohangDetail(lohangDraftId);
  
  return res.status(constants.HTTP_STATUS.OK).json({
    success: true,
    errorCode: 0,
    message: 'Thành công',
    data: result
  });
});


/**
 * Danh sách C/O (draft + hoàn thành)
 * GET /api/v1/co/list
 */
const listCO = asyncHandler(async (req, res) => {
  const result = await coProcessHandle.listCO(req.userId, req.query);
  return res.status(constants.HTTP_STATUS.OK).json({
    success: true,
    errorCode: 0,
    data: result
  });
});

/**
 * Tạo C/O draft từ bundle
 * POST /api/v1/co/create
 */
const createCO = asyncHandler(async (req, res) => {
  const result = await coProcessHandle.createCOFromBundle(req.userId, req.body);
  return res.status(constants.HTTP_STATUS.CREATED).json({
    success: true,
    errorCode: 0,
    message: 'Đã tạo C/O draft thành công',
    data: result
  });
});

/**
 * Lấy danh sách Form và Tiêu chí được hỗ trợ
 * GET /api/v1/co/supported-combinations
 */
const getSupportedCombinations = asyncHandler(async (req, res) => {
  const result = await coProcessHandle.getSupportedCombinations();
  return res.status(constants.HTTP_STATUS.OK).json({
    success: true,
    errorCode: 0,
    message: 'Danh sách Form và Tiêu chí được hỗ trợ',
    data: result
  });
});

/**
 * Setup Form E/B và Tiêu chí
 * PUT /api/v1/co/lohang/:lohangDraftId/setup
 */
const setupFormAndCriteria = asyncHandler(async (req, res) => {
  const { lohangDraftId } = req.params;
  const { formType, criterionType } = req.body;
  
  // Validation: Chỉ hỗ trợ FORM_E + CTH
  if (formType !== 'FORM_E' || criterionType !== 'CTH') {
    return res.status(constants.HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      errorCode: 1,
      message: `Combination ${formType} + ${criterionType} chưa được phát triển. Hiện tại chỉ hỗ trợ FORM_E + CTH.`,
      supportedCombinations: [
        { formType: 'FORM_E', criterionType: 'CTH', status: 'supported' }
      ]
    });
  }
  
  const result = await coProcessHandle.setupFormAndCriteria(lohangDraftId, req.body);
  return res.status(constants.HTTP_STATUS.OK).json({
    success: true,
    errorCode: 0,
    message: 'Đã cập nhật cấu hình thành công',
    data: result
  });
});

/**
 * Trigger trích xuất và tổng hợp dữ liệu (khi nhân viên bấm "Tiếp tục")
 * POST /api/v1/co/lohang/:lohangDraftId/extract-tables
 */
const triggerExtractTables = asyncHandler(async (req, res) => {
  const { lohangDraftId } = req.params;
  const result = await coProcessHandle.triggerExtractTables(lohangDraftId);
  return res.status(constants.HTTP_STATUS.OK).json({
    success: true,
    errorCode: 0,
    message: result.message,
    data: result
  });
});

/**
 * Cập nhật document trong bundle
 * PUT /api/v1/review/documents/:bundleId/documents/:documentId
 */
const updateDocument = asyncHandler(async (req, res) => {
  const { bundleId, documentId } = req.params;
  const result = await coProcessHandle.updateDocument(bundleId, documentId, req.body);
  
  return res.status(constants.HTTP_STATUS.OK).json({
    success: true,
    errorCode: 0,
    message: 'Đã cập nhật chứng từ và khởi chạy OCR',
    data: result
  });
});

/**
 * Xoá document khỏi bundle
 * DELETE /api/v1/review/documents/:bundleId/documents/:documentId
 */
const deleteDocument = asyncHandler(async (req, res) => {
  const { bundleId, documentId } = req.params;
  const result = await coProcessHandle.deleteDocument(bundleId, documentId);
  
  return res.status(constants.HTTP_STATUS.OK).json({
    success: true,
    errorCode: 0,
    message: 'Đã xoá chứng từ khỏi bundle',
    data: result
  });
});

/**
 * Retry extraction khi có lỗi
 * POST /api/v1/co/lohang/:id/retry-extraction
 */
const retryExtraction = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = await coProcessHandle.retryExtraction(id);
  
  return res.status(constants.HTTP_STATUS.OK).json({
    success: true,
    errorCode: 0,
    data: result
  });
});

/**
 * Re-extract một bảng cụ thể với user note
 * POST /api/v1/co/lohang/:id/re-extract-table
 */
const reExtractTable = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { tableType, userNote } = req.body;
  
  if (!tableType) {
    const err = new Error('tableType là bắt buộc (PRODUCT, NPL, BOM)');
    err.status = constants.HTTP_STATUS.BAD_REQUEST;
    throw err;
  }

  if (!userNote || userNote.trim() === '') {
    const err = new Error('userNote là bắt buộc - vui lòng mô tả vấn đề cần sửa');
    err.status = constants.HTTP_STATUS.BAD_REQUEST;
    throw err;
  }
  
  const result = await coProcessHandle.reExtractTable(id, tableType, userNote);
  
  return res.status(constants.HTTP_STATUS.OK).json({
    success: true,
    errorCode: 0,
    data: result
  });
});

/**
 * Continue to next step - TỔNG HỢP TẤT CẢ
 * POST /api/v1/co/lohang/:id/continue
 * Body: { formType, exchangeRate, criterionType, tables } (tùy bước)
 */
const continueToNextStep = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const payload = req.body;
  
  const result = await coProcessHandle.continueToNextStep(id, payload);
  
  return res.status(constants.HTTP_STATUS.OK).json({
    success: true,
    errorCode: 0,
    data: result
  });
});

/**
 * Setup Form + Trigger Extract cùng lúc (Tối ưu UX)
 * POST /api/v1/co/lohang/:id/setup-and-extract
 */
const setupAndExtract = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { formType, criterionType } = req.body;
  
  // Validation: Chỉ hỗ trợ FORM_E + CTH
  if (formType !== 'FORM_E' || criterionType !== 'CTH') {
    const err = new Error(`Combination ${formType} + ${criterionType} chưa được phát triển. Hiện tại chỉ hỗ trợ FORM_E + CTH.`);
    err.status = constants.HTTP_STATUS.BAD_REQUEST;
    err.errorCode = 1;
    err.supportedCombinations = [{ formType: 'FORM_E', criterionType: 'CTH', status: 'supported' }];
    throw err;
  }
  
  const result = await coProcessHandle.setupAndExtract(id, { formType, criterionType });
  
  return res.status(constants.HTTP_STATUS.OK).json({
    success: true,
    errorCode: 0,
    data: result
  });
});

/**
 * Tính toán tiêu hao và phân bổ FIFO (Bước 4)
 * POST /api/v1/co/lohang/:lohangDraftId/calculate-consumption
 */
const calculateConsumption = asyncHandler(async (req, res) => {
  const { lohangDraftId } = req.params;
  const result = await coProcessHandle.calculateConsumptionAndFifo(lohangDraftId);
  
  return res.status(constants.HTTP_STATUS.OK).json({
    success: true,
    errorCode: 0,
    message: result.message || 'Tính toán thành công',
    data: result
  });
});

module.exports = {
  getLohangDetail,
  listCO,
  createCO,
  getSupportedCombinations,
  setupFormAndCriteria,
  continueToNextStep,
  setupAndExtract,
  triggerExtractTables,
  retryExtraction,
  reExtractTable,
  calculateConsumption,
  updateDocument,
  deleteDocument
};
