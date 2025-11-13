const { asyncHandler } = require('../../core/middlewares/error.middleware');
const constants = require('../../core/utils/constants');
const coHandle = require('../handles/co.handle');

const listBundles = asyncHandler(async (req, res) => {
  const userId = req.user._id || req.userId;
  const result = await coHandle.listAvailableBundles(req.query || {}, userId);
  return res.status(constants.HTTP_STATUS.OK).json({ success: true, errorCode: 0, message: 'Thành công', data: result });
});

// STEP 3.1: Create C/O from Bundle (DRAFT status, no formType yet)
const createCo = asyncHandler(async (req, res) => {
  const userId = req.user._id || req.userId;
  const { bundleId } = req.body || {};
  const result = await coHandle.createCoApplication({ bundleId }, userId);
  return res.status(constants.HTTP_STATUS.CREATED).json({ success: true, errorCode: 0, message: 'Tạo hồ sơ C/O thành công', data: result });
});

const listCos = asyncHandler(async (req, res) => {
  const userId = req.user._id || req.userId;
  const result = await coHandle.listCoApplications(req.query || {}, userId);
  return res.status(constants.HTTP_STATUS.OK).json({ success: true, errorCode: 0, message: 'Thành công', data: result });
});

const getCo = asyncHandler(async (req, res) => {
  const result = await coHandle.getCoApplication(req.params.id);
  return res.status(constants.HTTP_STATUS.OK).json({ success: true, errorCode: 0, message: 'Thành công', data: result });
});

const uploadAndOCR = asyncHandler(async (req, res) => {
  let documents = req.body;
  
  // Handle both formats: { documents: [...] } or documents array directly
  if (!Array.isArray(documents) && req.body.documents) {
    documents = req.body.documents;
  }
  
  if (!Array.isArray(documents)) {
    return res.status(constants.HTTP_STATUS.UNPROCESSABLE_ENTITY).json({ 
      success: false, 
      errorCode: 1, 
      message: 'Danh sách chứng từ không hợp lệ',
      data: null 
    });
  }
  
  const result = await coHandle.uploadDocumentsAndOCR(req.params.id, documents);
  return res.status(constants.HTTP_STATUS.OK).json({ success: true, errorCode: 0, message: 'Upload và phân tích thành công', data: result });
});

const matchRules = asyncHandler(async (req, res) => {
  const { formType } = req.body || {};
  const result = await coHandle.matchOriginRules(req.params.id, formType);
  return res.status(constants.HTTP_STATUS.OK).json({ success: true, errorCode: 0, message: 'Tra cứu quy tắc thành công', data: result });
});

const applyCriterion = asyncHandler(async (req, res) => {
  const { criterion, reAnalyze } = req.body || {};
  const result = await coHandle.applyLogicEngine(req.params.id, criterion, reAnalyze);
  return res.status(constants.HTTP_STATUS.OK).json({ success: true, errorCode: 0, message: 'Áp dụng tiêu chí thành công', data: result });
});

const exportPDF = asyncHandler(async (req, res) => {
  const result = await coHandle.generatePDF(req.params.id);
  return res.status(constants.HTTP_STATUS.OK).json({ success: true, errorCode: 0, message: 'Xuất PDF thành công', data: result });
});

// STEP 3.3: Select Form Type
const selectFormType = asyncHandler(async (req, res) => {
  const { formType } = req.body || {};
  const result = await coHandle.selectFormType(req.params.id, formType);
  return res.status(constants.HTTP_STATUS.OK).json({ success: true, errorCode: 0, message: 'Chọn loại Form thành công', data: result });
});

// STEP 3.4 (FORM_B): Auto-fill basic info
const autoFillFormB = asyncHandler(async (req, res) => {
  const result = await coHandle.autoFillFormB(req.params.id);
  return res.status(constants.HTTP_STATUS.OK).json({ success: true, errorCode: 0, message: 'Tự động điền thông tin FORM_B thành công', data: result });
});

// STEP 3.4 (FORM_E): AI lookup rules
const aiLookupRules = asyncHandler(async (req, res) => {
  const result = await coHandle.aiLookupRules(req.params.id);
  return res.status(constants.HTTP_STATUS.OK).json({ success: true, errorCode: 0, message: 'Tra cứu luật xuất xứ thành công', data: result });
});

// STEP 3.5 (FORM_E): Select criteria
const selectCriteria = asyncHandler(async (req, res) => {
  const { criterion } = req.body || {};
  const result = await coHandle.selectCriteria(req.params.id, criterion);
  return res.status(constants.HTTP_STATUS.OK).json({ success: true, errorCode: 0, message: 'Chọn tiêu chí thành công', data: result });
});

// STEP 3.6 (FORM_E): AI generate materials breakdown
const aiGenerateMaterialsBreakdown = asyncHandler(async (req, res) => {
  const { correctionNotes } = req.body || {};
  const result = await coHandle.aiGenerateMaterialsBreakdown(req.params.id, correctionNotes);
  return res.status(constants.HTTP_STATUS.OK).json({ success: true, errorCode: 0, message: 'Tạo Bảng kê tự động thành công', data: result });
});

// Retry OCR for failed document
const retryOcr = asyncHandler(async (req, res) => {
  const { documentId } = req.body || {};
  const result = await coHandle.retryOcrForDocument(req.params.id, documentId);
  return res.status(constants.HTTP_STATUS.OK).json({ success: true, errorCode: 0, message: 'Đã khởi động lại OCR', data: result });
});

// Check OCR status
const checkOcrStatus = asyncHandler(async (req, res) => {
  const result = await coHandle.checkOcrStatus(req.params.id);
  return res.status(constants.HTTP_STATUS.OK).json({ success: true, errorCode: 0, message: 'Kiểm tra trạng thái OCR thành công', data: result });
});

module.exports = {
  listBundles,
  createCo,
  listCos,
  getCo,
  uploadAndOCR,
  matchRules,
  applyCriterion,
  exportPDF,
  // New workflow controllers
  selectFormType,
  autoFillFormB,
  aiLookupRules,
  selectCriteria,
  aiGenerateMaterialsBreakdown,
  retryOcr,
  checkOcrStatus
};
