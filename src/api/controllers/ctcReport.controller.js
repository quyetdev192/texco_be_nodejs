const asyncHandler = require('express-async-handler');
const constants = require('../../core/utils/constants');
const CTCReportGeneratorService = require('../../core/services/ReportGenerator.service');

/**
 * Tạo bảng kê CTC cho tất cả SKU trong lô hàng
 * POST /api/v1/co/lohang/:lohangDraftId/ctc-reports
 */
const generateCTCReports = asyncHandler(async (req, res) => {
  const { lohangDraftId } = req.params;

  if (!lohangDraftId) {
    return res.status(constants.HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      errorCode: 1,
      message: 'Thiếu lohangDraftId'
    });
  }

  try {
    const ctcService = new CTCReportGeneratorService();
    const result = await ctcService.generateReports(lohangDraftId);

    return res.status(constants.HTTP_STATUS.OK).json({
      success: true,
      errorCode: 0,
      message: 'Tạo bảng kê thành công',
      data: result
    });

  } catch (error) {
    console.error('Generate CTC Reports error:', error);
    
    return res.status(constants.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      errorCode: 1,
      message: error.message || 'Lỗi tạo bảng kê',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * Lấy danh sách bảng kê CTC đã tạo
 * GET /api/v1/co/lohang/:lohangDraftId/ctc-reports
 */
const getCTCReports = asyncHandler(async (req, res) => {
  const { lohangDraftId } = req.params;

  try {
    const mongoose = require('mongoose');
    const LohangDraftClass = require('../models/lohangDraft.model');
    
    // Build model
    const buildModel = (modelClass) => {
      const modelName = modelClass.name;
      if (mongoose.models[modelName]) return mongoose.models[modelName];
      const schema = new mongoose.Schema(modelClass.getSchema(), { collection: modelClass.collection });
      return mongoose.model(modelName, schema);
    };
    
    const LohangDraft = buildModel(LohangDraftClass);

    const lohangDraft = await LohangDraft.findById(lohangDraftId)
      .select('ctcReports criterionType')
      .lean();

    if (!lohangDraft) {
      return res.status(constants.HTTP_STATUS.NOT_FOUND).json({
        success: false,
        errorCode: 1,
        message: 'Không tìm thấy lô hàng'
      });
    }

    return res.status(constants.HTTP_STATUS.OK).json({
      success: true,
      errorCode: 0,
      message: 'Thành công',
      data: {
        lohangDraftId,
        criterionType: lohangDraft.criterionType,
        reports: lohangDraft.ctcReports || [],
        totalReports: (lohangDraft.ctcReports || []).length
      }
    });

  } catch (error) {
    console.error('Get CTC Reports error:', error);
    
    return res.status(constants.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      errorCode: 1,
      message: 'Lỗi lấy danh sách bảng kê CTC',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * Retry tạo bảng kê CTC (dùng khi có lỗi ở bước 4)
 * POST /api/v1/co/lohang/:lohangDraftId/ctc-reports/retry
 */
const retryCTCReports = asyncHandler(async (req, res) => {
  const { lohangDraftId } = req.params;

  if (!lohangDraftId) {
    return res.status(constants.HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      errorCode: 1,
      message: 'Thiếu lohangDraftId'
    });
  }

  try {
    const mongoose = require('mongoose');
    const LohangDraftClass = require('../models/lohangDraft.model');
    
    // Build model
    const buildModel = (modelClass) => {
      const modelName = modelClass.name;
      if (mongoose.models[modelName]) return mongoose.models[modelName];
      const schema = new mongoose.Schema(modelClass.getSchema(), { collection: modelClass.collection });
      return mongoose.model(modelName, schema);
    };
    
    const LohangDraft = buildModel(LohangDraftClass);

    const lohangDraft = await LohangDraft.findById(lohangDraftId).lean();

    if (!lohangDraft) {
      return res.status(constants.HTTP_STATUS.NOT_FOUND).json({
        success: false,
        errorCode: 1,
        message: 'Không tìm thấy lô hàng'
      });
    }

    if (lohangDraft.criterionType !== 'CTC') {
      return res.status(constants.HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        errorCode: 1,
        message: 'Lô hàng này không áp dụng tiêu chí CTC'
      });
    }

    // Xóa các bảng kê cũ nếu có
    if (lohangDraft.ctcReports && lohangDraft.ctcReports.length > 0) {
      console.log('🗑️ Cleaning up old CTC reports...');
      
      // Xóa files trên Cloudinary
      const { v2: cloudinary } = require('cloudinary');
      for (const report of lohangDraft.ctcReports) {
        if (report.publicId) {
          try {
            await cloudinary.uploader.destroy(report.publicId, { resource_type: 'raw' });
          } catch (cloudinaryError) {
            console.warn('Failed to delete old file from Cloudinary:', cloudinaryError);
          }
        }
      }

      // Xóa khỏi database
      await LohangDraft.findByIdAndUpdate(lohangDraftId, {
        $unset: { ctcReports: 1 },
        updatedAt: new Date()
      });
    }

    // Tạo lại bảng kê CTC
    const ctcService = new CTCReportGeneratorService();
    const result = await ctcService.generateReports(lohangDraftId);

    return res.status(constants.HTTP_STATUS.OK).json({
      success: true,
      errorCode: 0,
      message: 'Retry tạo bảng kê CTC thành công',
      data: result
    });

  } catch (error) {
    console.error('Retry CTC Reports error:', error);
    
    return res.status(constants.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      errorCode: 1,
      message: error.message || 'Lỗi retry tạo bảng kê CTC',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * Xóa bảng kê CTC
 * DELETE /api/v1/co/lohang/:lohangDraftId/ctc-reports/:skuCode
 */
const deleteCTCReport = asyncHandler(async (req, res) => {
  const { lohangDraftId, skuCode } = req.params;

  try {
    const mongoose = require('mongoose');
    const LohangDraftClass = require('../models/lohangDraft.model');
    
    // Build model
    const buildModel = (modelClass) => {
      const modelName = modelClass.name;
      if (mongoose.models[modelName]) return mongoose.models[modelName];
      const schema = new mongoose.Schema(modelClass.getSchema(), { collection: modelClass.collection });
      return mongoose.model(modelName, schema);
    };
    
    const LohangDraft = buildModel(LohangDraftClass);

    const lohangDraft = await LohangDraft.findById(lohangDraftId);

    if (!lohangDraft) {
      return res.status(constants.HTTP_STATUS.NOT_FOUND).json({
        success: false,
        errorCode: 1,
        message: 'Không tìm thấy lô hàng'
      });
    }

    // Tìm và xóa report của SKU
    const reportIndex = (lohangDraft.ctcReports || []).findIndex(r => r.skuCode === skuCode);
    
    if (reportIndex === -1) {
      return res.status(constants.HTTP_STATUS.NOT_FOUND).json({
        success: false,
        errorCode: 1,
        message: 'Không tìm thấy bảng kê CTC cho SKU này'
      });
    }

    const report = lohangDraft.ctcReports[reportIndex];

    // Xóa file trên Cloudinary nếu có
    if (report.publicId) {
      try {
        const { v2: cloudinary } = require('cloudinary');
        await cloudinary.uploader.destroy(report.publicId, { resource_type: 'raw' });
      } catch (cloudinaryError) {
        console.warn('Failed to delete file from Cloudinary:', cloudinaryError);
      }
    }

    // Xóa khỏi database
    lohangDraft.ctcReports.splice(reportIndex, 1);
    await lohangDraft.save();

    return res.status(constants.HTTP_STATUS.OK).json({
      success: true,
      errorCode: 0,
      message: 'Xóa bảng kê CTC thành công'
    });

  } catch (error) {
    console.error('Delete CTC Report error:', error);
    
    return res.status(constants.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      errorCode: 1,
      message: 'Lỗi xóa bảng kê CTC',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * Xác nhận hoàn thành hồ sơ C/O
 * POST /api/v1/co/lohang/:lohangDraftId/complete
 */
const completeCOProcess = asyncHandler(async (req, res) => {
  const { lohangDraftId } = req.params;

  try {
    const mongoose = require('mongoose');
    const LohangDraftClass = require('../../api/models/lohangDraft.model');
    
    // Build model inline
    const buildModel = (modelClass) => {
      const modelName = modelClass.name;
      if (mongoose.models[modelName]) return mongoose.models[modelName];
      const schema = new mongoose.Schema(modelClass.getSchema(), { collection: modelClass.collection });
      return mongoose.model(modelName, schema);
    };
    
    const LohangDraftModel = buildModel(LohangDraftClass);

    // Kiểm tra lô hàng có tồn tại và đã có bảng kê
    const lohangDraft = await LohangDraftModel.findById(lohangDraftId);
    if (!lohangDraft) {
      return res.status(constants.HTTP_STATUS.NOT_FOUND).json({
        success: false,
        errorCode: 1,
        message: 'Không tìm thấy lô hàng'
      });
    }

    // Kiểm tra đã có bảng kê chưa
    if (!lohangDraft.ctcReports || lohangDraft.ctcReports.length === 0) {
      return res.status(constants.HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        errorCode: 1,
        message: 'Chưa có bảng kê để hoàn thành'
      });
    }

    // Cập nhật trạng thái hoàn thành
    const updatedLohang = await LohangDraftModel.findByIdAndUpdate(
      lohangDraftId,
      {
        status: 'COMPLETED',
        currentStep: 6,
        completedAt: new Date(),
        'steps.step6_complete.completed': true,
        'steps.step6_complete.completedAt': new Date(),
        'steps.step6_complete.inProgress': false,
        updatedAt: new Date()
      },
      { new: true }
    );

    return res.status(constants.HTTP_STATUS.OK).json({
      success: true,
      errorCode: 0,
      message: 'Đã hoàn thành hồ sơ C/O thành công',
      data: {
        _id: updatedLohang._id,
        status: updatedLohang.status,
        currentStep: updatedLohang.currentStep,
        completedAt: updatedLohang.completedAt
      }
    });

  } catch (error) {
    console.error('Complete CO Process error:', error);
    
    return res.status(constants.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      errorCode: 1,
      message: error.message || 'Lỗi hoàn thành hồ sơ C/O',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * Quay lại step trước để chỉnh sửa
 * POST /api/v1/co/lohang/:lohangDraftId/back-to-step/:stepNumber
 */
const backToStep = asyncHandler(async (req, res) => {
  const { lohangDraftId, stepNumber } = req.params;
  const targetStep = parseInt(stepNumber);

  try {
    const mongoose = require('mongoose');
    const LohangDraftClass = require('../../api/models/lohangDraft.model');
    
    // Build model inline
    const buildModel = (modelClass) => {
      const modelName = modelClass.name;
      if (mongoose.models[modelName]) return mongoose.models[modelName];
      const schema = new mongoose.Schema(modelClass.getSchema(), { collection: modelClass.collection });
      return mongoose.model(modelName, schema);
    };
    
    const LohangDraftModel = buildModel(LohangDraftClass);

    // Validate step number
    if (targetStep < 1 || targetStep > 5) {
      return res.status(constants.HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        errorCode: 1,
        message: 'Step number phải từ 1 đến 5'
      });
    }

    const lohangDraft = await LohangDraftModel.findById(lohangDraftId);
    if (!lohangDraft) {
      return res.status(constants.HTTP_STATUS.NOT_FOUND).json({
        success: false,
        errorCode: 1,
        message: 'Không tìm thấy lô hàng'
      });
    }

    // Không cho phép quay lại step hiện tại hoặc step sau
    if (targetStep >= lohangDraft.currentStep) {
      return res.status(constants.HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        errorCode: 1,
        message: `Không thể quay lại step ${targetStep}. Step hiện tại: ${lohangDraft.currentStep}`
      });
    }

    // Reset các step sau targetStep
    const updateData = {
      currentStep: targetStep,
      status: getStatusByStep(targetStep),
      updatedAt: new Date()
    };

    // Reset steps sau targetStep
    for (let i = targetStep + 1; i <= 6; i++) {
      const stepKey = getStepKey(i);
      if (stepKey) {
        updateData[`steps.${stepKey}.completed`] = false;
        updateData[`steps.${stepKey}.completedAt`] = null;
        updateData[`steps.${stepKey}.inProgress`] = false;
        updateData[`steps.${stepKey}.error`] = null;
      }
    }

    // Nếu quay lại step 4 trở về, xóa bảng kê cũ
    if (targetStep <= 4 && lohangDraft.ctcReports && lohangDraft.ctcReports.length > 0) {
      updateData.ctcReports = [];
      console.log('🗑️ Cleared old reports when going back to step', targetStep);
    }

    const updatedLohang = await LohangDraftModel.findByIdAndUpdate(
      lohangDraftId,
      updateData,
      { new: true }
    );

    return res.status(constants.HTTP_STATUS.OK).json({
      success: true,
      errorCode: 0,
      message: `Đã quay lại step ${targetStep} thành công`,
      data: {
        _id: updatedLohang._id,
        currentStep: updatedLohang.currentStep,
        status: updatedLohang.status,
        steps: updatedLohang.steps
      }
    });

  } catch (error) {
    console.error('Back to step error:', error);
    
    return res.status(constants.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      errorCode: 1,
      message: error.message || 'Lỗi quay lại step trước',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Helper methods
const getStatusByStep = (step) => {
  const statusMap = {
    1: 'DRAFT',
    2: 'SETUP_COMPLETED',
    3: 'DATA_CONFIRMED', 
    4: 'CALCULATED_WITH_WARNINGS',
    5: 'REPORTS_GENERATED'
  };
  return statusMap[step] || 'DRAFT';
};

const getStepKey = (step) => {
  const stepMap = {
    1: 'step1_upload',
    2: 'step2_extract', 
    3: 'step3_review',
    4: 'step4_calculate',
    5: 'step5_generateReports',
    6: 'step6_complete'
  };
  return stepMap[step];
};

module.exports = {
  generateCTCReports,
  getCTCReports,
  retryCTCReports,
  deleteCTCReport,
  completeCOProcess,
  backToStep
};
