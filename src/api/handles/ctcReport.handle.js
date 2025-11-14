const mongoose = require('mongoose');
const constants = require('../../core/utils/constants');
const CTCReportGeneratorService = require('../../core/services/ReportGenerator.service');
const { v2: cloudinary } = require('cloudinary');
const axios = require('axios');

// Import models
const LohangDraftClass = require('../models/lohangDraft.model');

function buildModelFromClass(modelClass) {
  const modelName = modelClass.name;
  if (mongoose.models[modelName]) return mongoose.models[modelName];
  const schemaDefinition = modelClass.getSchema();
  const schema = new mongoose.Schema(schemaDefinition, { collection: modelClass.collection });
  return mongoose.model(modelName, schema);
}

const LohangDraft = buildModelFromClass(LohangDraftClass);

/**
 * Tạo bảng kê CTC cho tất cả SKU trong lô hàng
 */
async function generateCTCReports(lohangDraftId) {
  const ctcService = new CTCReportGeneratorService();
  const result = await ctcService.generateReports(lohangDraftId);
  return result;
}

/**
 * Lấy danh sách bảng kê CTC đã tạo
 */
async function getCTCReports(lohangDraftId) {
  const lohangDraft = await LohangDraft.findById(lohangDraftId)
    .select('ctcReports criterionType')
    .lean();

  if (!lohangDraft) {
    const err = new Error('Không tìm thấy lô hàng');
    err.status = constants.HTTP_STATUS.NOT_FOUND;
    throw err;
  }

  return {
    lohangDraftId,
    criterionType: lohangDraft.criterionType,
    reports: lohangDraft.ctcReports || [],
    totalReports: (lohangDraft.ctcReports || []).length
  };
}

/**
 * Retry tạo bảng kê CTC (xóa cũ, tạo lại)
 */
async function retryCTCReports(lohangDraftId) {
  const lohangDraft = await LohangDraft.findById(lohangDraftId).lean();

  if (!lohangDraft) {
    const err = new Error('Không tìm thấy lô hàng');
    err.status = constants.HTTP_STATUS.NOT_FOUND;
    throw err;
  }

  if (lohangDraft.criterionType !== 'CTC') {
    const err = new Error('Lô hàng này không áp dụng tiêu chí CTC');
    err.status = constants.HTTP_STATUS.BAD_REQUEST;
    throw err;
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
  return result;
}

/**
 * Xóa bảng kê CTC của một SKU
 */
async function deleteCTCReport(lohangDraftId, skuCode) {
  const lohangDraft = await LohangDraft.findById(lohangDraftId);

  if (!lohangDraft) {
    const err = new Error('Không tìm thấy lô hàng');
    err.status = constants.HTTP_STATUS.NOT_FOUND;
    throw err;
  }

  // Tìm và xóa report của SKU
  const reportIndex = (lohangDraft.ctcReports || []).findIndex(r => r.skuCode === skuCode);
  
  if (reportIndex === -1) {
    const err = new Error('Không tìm thấy bảng kê CTC cho SKU này');
    err.status = constants.HTTP_STATUS.NOT_FOUND;
    throw err;
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
}

/**
 * Xác nhận hoàn thành hồ sơ C/O
 */
async function completeCOProcess(lohangDraftId) {
  const lohangDraft = await LohangDraft.findById(lohangDraftId);

  if (!lohangDraft) {
    const err = new Error('Không tìm thấy lô hàng');
    err.status = constants.HTTP_STATUS.NOT_FOUND;
    throw err;
  }

  // Kiểm tra đã có bảng kê chưa
  if (!lohangDraft.ctcReports || lohangDraft.ctcReports.length === 0) {
    const err = new Error('Chưa có bảng kê để hoàn thành');
    err.status = constants.HTTP_STATUS.BAD_REQUEST;
    throw err;
  }

  // Cập nhật trạng thái hoàn thành
  const updatedLohang = await LohangDraft.findByIdAndUpdate(
    lohangDraftId,
    {
      status: 'COMPLETED',
      currentStep: 6,
      completedAt: new Date(),
      'workflowSteps.step6_reviewResults.completed': true,
      'workflowSteps.step6_reviewResults.completedAt': new Date(),
      updatedAt: new Date()
    },
    { new: true }
  );

  return {
    _id: updatedLohang._id,
    status: updatedLohang.status,
    currentStep: updatedLohang.currentStep,
    completedAt: updatedLohang.completedAt
  };
}

/**
 * Quay lại step trước để chỉnh sửa
 */
async function backToStep(lohangDraftId, targetStep) {
  const lohangDraft = await LohangDraft.findById(lohangDraftId);

  if (!lohangDraft) {
    const err = new Error('Không tìm thấy lô hàng');
    err.status = constants.HTTP_STATUS.NOT_FOUND;
    throw err;
  }

  // Không cho phép quay lại step hiện tại hoặc step sau
  if (targetStep >= lohangDraft.currentStep) {
    const err = new Error(`Không thể quay lại step ${targetStep}. Step hiện tại: ${lohangDraft.currentStep}`);
    err.status = constants.HTTP_STATUS.BAD_REQUEST;
    throw err;
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
      updateData[`workflowSteps.${stepKey}.completed`] = false;
      updateData[`workflowSteps.${stepKey}.completedAt`] = null;
      updateData[`workflowSteps.${stepKey}.inProgress`] = false;
    }
  }

  // Nếu quay lại step 4 trở về, xóa bảng kê cũ
  if (targetStep <= 4 && lohangDraft.ctcReports && lohangDraft.ctcReports.length > 0) {
    updateData.ctcReports = [];
    console.log('🗑️ Cleared old reports when going back to step', targetStep);
  }

  const updatedLohang = await LohangDraft.findByIdAndUpdate(
    lohangDraftId,
    updateData,
    { new: true }
  );

  return {
    _id: updatedLohang._id,
    currentStep: updatedLohang.currentStep,
    status: updatedLohang.status,
    workflowSteps: updatedLohang.workflowSteps
  };
}

// Helper methods
function getStatusByStep(step) {
  const statusMap = {
    1: 'DRAFT',
    2: 'SETUP_COMPLETED',
    3: 'EXTRACTED',
    4: 'CALCULATED',
    5: 'REPORTS_GENERATED'
  };
  return statusMap[step] || 'DRAFT';
}

function getStepKey(step) {
  const stepMap = {
    1: 'step1_uploadDocuments',
    2: 'step2_selectFormAndCriteria',
    3: 'step3_extractData',
    4: 'step4_calculate',
    5: 'step5_generateReports',
    6: 'step6_reviewResults'
  };
  return stepMap[step];
}

/**
 * Download Excel report từ Cloudinary
 */
async function downloadExcelReport(publicId) {
  try {
    // Lấy URL của file từ Cloudinary
    const resource = await cloudinary.api.resource(publicId, {
      resource_type: 'raw'
    });

    if (!resource || !resource.secure_url) {
      const err = new Error('Không tìm thấy file trên Cloudinary');
      err.status = constants.HTTP_STATUS.NOT_FOUND;
      throw err;
    }

    // Download file từ Cloudinary URL
    const response = await axios.get(resource.secure_url, {
      responseType: 'arraybuffer'
    });

    // Lấy tên file từ public_id
    // public_id format: "reports/cth_SKU-1_1763086276124"
    const fileNameFromPublicId = resource.public_id?.split('/').pop() || 'report';
    
    // Đảm bảo có extension .xlsx
    const fileName = fileNameFromPublicId.endsWith('.xlsx') 
      ? fileNameFromPublicId 
      : `${fileNameFromPublicId}.xlsx`;

    return {
      buffer: response.data,
      fileName: fileName
    };
  } catch (error) {
    if (error.status) throw error;
    const err = new Error(`Lỗi download file: ${error.message}`);
    err.status = constants.HTTP_STATUS.INTERNAL_SERVER_ERROR;
    throw err;
  }
}

module.exports = {
  generateCTCReports,
  getCTCReports,
  retryCTCReports,
  deleteCTCReport,
  completeCOProcess,
  backToStep,
  downloadExcelReport
};
