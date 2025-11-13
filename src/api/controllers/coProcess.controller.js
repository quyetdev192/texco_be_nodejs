const { asyncHandler } = require('../../core/middlewares/error.middleware');
const constants = require('../../core/utils/constants');
const coProcessHandle = require('../handles/coProcess.handle');
<<<<<<< HEAD
const { getExcelService } = require('../../core/utils/excel.utils');
=======
>>>>>>> quyetdev


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
<<<<<<< HEAD
=======
 * Lấy danh sách Form và Tiêu chí được hỗ trợ
 * GET /api/v1/co/supported-combinations
 */
const getSupportedCombinations = asyncHandler(async (req, res) => {
  const supportedCombinations = [
    {
      formType: 'FORM_E',
      criterionType: 'CTH',
      status: 'supported',
      description: 'Form E với tiêu chí Change in Tariff Heading'
    },
    {
      formType: 'FORM_E',
      criterionType: 'CTC',
      status: 'development',
      description: 'Form E với tiêu chí Change in Tariff Classification (đang phát triển)'
    },
    {
      formType: 'FORM_B',
      criterionType: 'CTH',
      status: 'development',
      description: 'Form B với tiêu chí Change in Tariff Heading (đang phát triển)'
    },
    {
      formType: 'FORM_B',
      criterionType: 'CTC',
      status: 'development',
      description: 'Form B với tiêu chí Change in Tariff Classification (đang phát triển)'
    }
  ];

  return res.status(constants.HTTP_STATUS.OK).json({
    success: true,
    errorCode: 0,
    message: 'Danh sách Form và Tiêu chí được hỗ trợ',
    data: {
      supportedCombinations,
      currentlySupported: supportedCombinations.filter(c => c.status === 'supported'),
      inDevelopment: supportedCombinations.filter(c => c.status === 'development')
    }
  });
});

/**
>>>>>>> quyetdev
 * Setup Form E/B và Tiêu chí
 * PUT /api/v1/co/lohang/:lohangDraftId/setup
 */
const setupFormAndCriteria = asyncHandler(async (req, res) => {
  const { lohangDraftId } = req.params;
<<<<<<< HEAD
=======
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
  
>>>>>>> quyetdev
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
  const { fileName, storagePath, note, documentType, ocrPages } = req.body;

  const DocumentClass = require('../models/document.model');
  const mongoose = require('mongoose');
  
  const buildModel = (modelClass) => {
    const modelName = modelClass.name;
    if (mongoose.models[modelName]) return mongoose.models[modelName];
    const schema = new mongoose.Schema(modelClass.getSchema(), { collection: modelClass.collection });
    return mongoose.model(modelName, schema);
  };

  const Document = buildModel(DocumentClass);

  const document = await Document.findOne({ _id: documentId, bundleId }).lean();
  if (!document) {
    const err = new Error('Document không tồn tại trong bundle này');
    err.status = constants.HTTP_STATUS.NOT_FOUND;
    throw err;
  }

  // Cập nhật document
  const updated = await Document.findByIdAndUpdate(
    documentId,
    {
      fileName: fileName || document.fileName,
      storagePath: storagePath || document.storagePath,
      note: note || document.note,
      documentType: documentType || document.documentType,
      ocrPages: ocrPages || document.ocrPages,
      status: 'OCR_PROCESSING', // Chạy OCR lại
      updatedAt: new Date()
    },
    { new: true }
  ).lean();

  // TODO: Trigger OCR job here

  return res.status(constants.HTTP_STATUS.OK).json({
    success: true,
    errorCode: 0,
    message: 'Đã cập nhật chứng từ và khởi chạy OCR',
    data: { document: updated }
  });
});

/**
 * Xoá document khỏi bundle
 * DELETE /api/v1/review/documents/:bundleId/documents/:documentId
 */
const deleteDocument = asyncHandler(async (req, res) => {
  const { bundleId, documentId } = req.params;

  const DocumentClass = require('../models/document.model');
  const BundleClass = require('../models/bundle.model');
  const mongoose = require('mongoose');
  
  const buildModel = (modelClass) => {
    const modelName = modelClass.name;
    if (mongoose.models[modelName]) return mongoose.models[modelName];
    const schema = new mongoose.Schema(modelClass.getSchema(), { collection: modelClass.collection });
    return mongoose.model(modelName, schema);
  };

  const Document = buildModel(DocumentClass);
  const Bundle = buildModel(BundleClass);

  const document = await Document.findOne({ _id: documentId, bundleId }).lean();
  if (!document) {
    const err = new Error('Document không tồn tại trong bundle này');
    err.status = constants.HTTP_STATUS.NOT_FOUND;
    throw err;
  }

  // Xoá document
  await Document.findByIdAndDelete(documentId);

  // Cập nhật bundle (đếm lại số documents)
  const remainingCount = await Document.countDocuments({ bundleId });

  return res.status(constants.HTTP_STATUS.OK).json({
    success: true,
    errorCode: 0,
    message: 'Đã xoá chứng từ khỏi bundle',
    data: {
      bundle: {
        _id: bundleId,
        documentCount: remainingCount
      },
      deletedDocumentId: documentId
    }
  });
});

/**
 * Retry extraction khi có lỗi
 */
const retryExtraction = async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await coProcessHandle.retryExtraction(id);
    
    res.status(constants.HTTP_STATUS.OK).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Retry extraction error:', error);
    res.status(error.status || constants.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Re-extract một bảng cụ thể với user note
 * POST /api/v1/co/lohang/:id/re-extract-table
 */
const reExtractTable = async (req, res) => {
  try {
    const { id } = req.params;
    const { tableType, userNote } = req.body;
    
    if (!tableType) {
      return res.status(constants.HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'tableType là bắt buộc (PRODUCT, NPL, BOM)'
      });
    }

    if (!userNote || userNote.trim() === '') {
      return res.status(constants.HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'userNote là bắt buộc - vui lòng mô tả vấn đề cần sửa'
      });
    }
    
    const result = await coProcessHandle.reExtractTable(id, tableType, userNote);
    
    res.status(constants.HTTP_STATUS.OK).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Re-extract table error:', error);
    res.status(error.status || constants.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message
    });
  }
};

/**
<<<<<<< HEAD
 * Continue to next step
 * POST /api/v1/co/lohang/:id/continue
=======
 * Continue to next step - TỔNG HỢP TẤT CẢ
 * POST /api/v1/co/lohang/:id/continue
 * Body: { formType, exchangeRate, criterionType, tables } (tùy bước)
>>>>>>> quyetdev
 */
const continueToNextStep = async (req, res) => {
  try {
    const { id } = req.params;
<<<<<<< HEAD
    
    const result = await coProcessHandle.continueToNextStep(id);
=======
    const payload = req.body; // Nhận data từ FE
    
    const result = await coProcessHandle.continueToNextStep(id, payload);
>>>>>>> quyetdev
    
    res.status(constants.HTTP_STATUS.OK).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Continue to next step error:', error);
    res.status(error.status || constants.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Setup Form + Trigger Extract cùng lúc (Tối ưu UX)
 * POST /api/v1/co/lohang/:id/setup-and-extract
 */
const setupAndExtract = async (req, res) => {
  try {
    const { id } = req.params;
<<<<<<< HEAD
    const { formType, exchangeRate, criterionType } = req.body;
    
    const result = await coProcessHandle.setupAndExtract(id, {
      formType,
      exchangeRate,
=======
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
    
    const result = await coProcessHandle.setupAndExtract(id, {
      formType,
>>>>>>> quyetdev
      criterionType
    });
    
    res.status(constants.HTTP_STATUS.OK).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Setup and extract error:', error);
    res.status(error.status || constants.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message
    });
  }
};

<<<<<<< HEAD
=======
/**
 * Tính toán tiêu hao và phân bổ FIFO (Bước 4)
 * POST /api/v1/co/lohang/:lohangDraftId/calculate-consumption
 */
const calculateConsumption = asyncHandler(async (req, res) => {
  const { lohangDraftId } = req.params;
  const result = await coProcessHandle.calculateConsumptionAndFifo(lohangDraftId);
  
  return res.status(constants.HTTP_STATUS.OK).json({
    success: result.success,
    errorCode: result.success ? 0 : 1,
    message: result.message,
    data: result
  });
});

>>>>>>> quyetdev
module.exports = {
  getLohangDetail,
  listCO,
  createCO,
<<<<<<< HEAD
=======
  getSupportedCombinations,
>>>>>>> quyetdev
  setupFormAndCriteria,
  continueToNextStep,
  setupAndExtract,
  triggerExtractTables,
  retryExtraction,
  reExtractTable,
<<<<<<< HEAD
=======
  calculateConsumption,
>>>>>>> quyetdev
  updateDocument,
  deleteDocument
};
