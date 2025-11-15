const mongoose = require('mongoose');
const constants = require('../../core/utils/constants');
const { getGeminiService } = require('../../core/utils/gemini.utils');
const { getDataExtractorService } = require('../../core/utils/dataExtractor.utils');
const { getBomExcelParser } = require('../../core/utils/bomExcelParser.utils');

// Import models
const LohangDraftClass = require('../models/lohangDraft.model');
const DocumentClass = require('../models/document.model');
const ExtractedProductTableClass = require('../models/extractedProductTable.model');
const ExtractedNplTableClass = require('../models/extractedNplTable.model');
const ExtractedBomTableClass = require('../models/extractedBomTable.model');
const NplConsumptionDetailClass = require('../models/nplConsumptionDetail.model');

function buildModelFromClass(modelClass) {
  const modelName = modelClass.name;
  if (mongoose.models[modelName]) return mongoose.models[modelName];
  const schemaDefinition = modelClass.getSchema();
  const schema = new mongoose.Schema(schemaDefinition, { collection: modelClass.collection });
  return mongoose.model(modelName, schema);
}

const LohangDraft = buildModelFromClass(LohangDraftClass);
const Document = buildModelFromClass(DocumentClass);
const ExtractedProductTable = buildModelFromClass(ExtractedProductTableClass);
const ExtractedNplTable = buildModelFromClass(ExtractedNplTableClass);
const ExtractedBomTable = buildModelFromClass(ExtractedBomTableClass);
const NplConsumptionDetail = buildModelFromClass(NplConsumptionDetailClass);

/**
 * Lấy chi tiết lô hàng
 */
async function getLohangDetail(lohangDraftId) {
  const lohangDraft = await LohangDraft.findById(lohangDraftId).lean();
  if (!lohangDraft) {
    const err = new Error('Lô hàng không tồn tại');
    err.status = constants.HTTP_STATUS.NOT_FOUND;
    throw err;
  }

  // Lấy workflow info
  const workflowInfo = getWorkflowInfo(lohangDraft);

  return {
    lohangDraft,
    workflow: workflowInfo
  };
}

/**
 * Danh sách C/O (draft + hoàn thành)
 * GET /api/v1/co/list
 */
async function listCO(userId, query) {
  const { status, invoiceNo, formType, page = 1, limit = 20 } = query;
  
  const filter = {};
  if (status) filter.status = status;
  if (invoiceNo) filter.invoiceNo = { $regex: invoiceNo, $options: 'i' };
  if (formType) filter.formType = formType;

  const skip = (page - 1) * limit;
  
  const [coList, total] = await Promise.all([
    LohangDraft.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('linkedDocuments', 'fileName documentType')
      .lean(),
    LohangDraft.countDocuments(filter)
  ]);

  // Lấy bundleName từ documents
  const BundleClass = require('../models/bundle.model');
  const Bundle = buildModelFromClass(BundleClass);
  
  for (const co of coList) {
    if (co.linkedDocuments && co.linkedDocuments.length > 0) {
      const firstDoc = await Document.findById(co.linkedDocuments[0]._id).lean();
      if (firstDoc && firstDoc.bundleId) {
        const bundle = await Bundle.findById(firstDoc.bundleId).lean();
        co.bundleName = bundle?.bundleName || 'N/A';
        co.bundleId = firstDoc.bundleId;
      }
    }
    
    // Thêm trạng thái step hiện tại (tiếng Việt)
    co.statusText = constants.CO_STEP_VI[co.currentStep] || `Step ${co.currentStep}`;
  }

  return {
    coList,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / limit)
    }
  };
}

/**
 * Lấy danh sách Form và Tiêu chí được hỗ trợ
 */
function getSupportedCombinations() {
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

  return {
    supportedCombinations,
    currentlySupported: supportedCombinations.filter(c => c.status === 'supported'),
    inDevelopment: supportedCombinations.filter(c => c.status === 'development')
  };
}

/**
 * Cập nhật document trong bundle
 */
async function updateDocument(bundleId, documentId, payload) {
  const { fileName, storagePath, note, documentType, ocrPages } = payload;

  const document = await Document.findOne({ _id: documentId, bundleId }).lean();
  if (!document) {
    const err = new Error('Document không tồn tại trong bundle này');
    err.status = constants.HTTP_STATUS.NOT_FOUND;
    throw err;
  }

  const updated = await Document.findByIdAndUpdate(
    documentId,
    {
      fileName: fileName || document.fileName,
      storagePath: storagePath || document.storagePath,
      note: note || document.note,
      documentType: documentType || document.documentType,
      ocrPages: ocrPages || document.ocrPages,
      status: 'OCR_PROCESSING',
      updatedAt: new Date()
    },
    { new: true }
  ).lean();

  return { document: updated };
}

/**
 * Xoá document khỏi bundle
 */
async function deleteDocument(bundleId, documentId) {
  const document = await Document.findOne({ _id: documentId, bundleId }).lean();
  if (!document) {
    const err = new Error('Document không tồn tại trong bundle này');
    err.status = constants.HTTP_STATUS.NOT_FOUND;
    throw err;
  }

  await Document.findByIdAndDelete(documentId);
  const remainingCount = await Document.countDocuments({ bundleId });

  return {
    bundle: {
      _id: bundleId,
      documentCount: remainingCount
    },
    deletedDocumentId: documentId
  };
}

/**
 * Tạo C/O draft từ bundle (chỉ cần bundleId)
 * POST /api/v1/co/create
 */
async function createCOFromBundle(userId, payload) {
  const { bundleId } = payload;
  
  if (!bundleId) {
    const err = new Error('bundleId là bắt buộc');
    err.status = constants.HTTP_STATUS.BAD_REQUEST;
    throw err;
  }

  // Lấy bundle và documents
  const BundleClass = require('../models/bundle.model');
  const Bundle = buildModelFromClass(BundleClass);
  
  const bundle = await Bundle.findById(bundleId).lean();
  if (!bundle) {
    const err = new Error('Bundle không tồn tại');
    err.status = constants.HTTP_STATUS.NOT_FOUND;
    throw err;
  }

  // Kiểm tra bundle đã OCR xong chưa
  if (bundle.status !== 'OCR_COMPLETED' && bundle.status !== 'APPROVED') {
    const err = new Error('Bundle chưa hoàn thành OCR');
    err.status = constants.HTTP_STATUS.BAD_REQUEST;
    throw err;
  }

  // Lấy tất cả documents trong bundle
  const documents = await Document.find({ bundleId }).lean();
  
  if (!documents || documents.length === 0) {
    const err = new Error('Bundle không có chứng từ nào');
    err.status = constants.HTTP_STATUS.BAD_REQUEST;
    throw err;
  }

  // Tìm invoice document để lấy invoiceNo
  const invoiceDoc = documents.find(d => 
    d.documentType === 'COMMERCIAL_INVOICE' || 
    d.documentType === 'INVOICE'
  );

  let invoiceNo = 'DRAFT-' + Date.now();
  if (invoiceDoc && invoiceDoc.ocrData?.fullText) {
    // Thử trích xuất invoiceNo từ OCR (đơn giản)
    const invoiceMatch = invoiceDoc.ocrData.fullText.match(/Invoice\s*No[.:]?\s*([A-Z0-9-]+)/i);
    if (invoiceMatch) {
      invoiceNo = invoiceMatch[1];
    }
  }

  // Tạo C/O draft - Bắt đầu từ bước 1 (chưa có form data)
  const lohangDraft = await LohangDraft.create({
    companyId: bundle.companyId,
    staffUser: userId,
    status: 'DRAFT',
    currentStep: 1, // Luôn bắt đầu từ bước 1
    invoiceNo,
    linkedDocuments: documents.map(d => d._id),
    // Chưa có formType, exchangeRate, criterionType
    // User sẽ điền ở bước 2
    totalSkuCount: 0,
    processedSkuCount: 0
  });

  return {
    lohangDraft: {
      _id: lohangDraft._id,
      bundleId,
      invoiceNo: lohangDraft.invoiceNo,
      status: lohangDraft.status,
      documentCount: documents.length,
      documents: documents.map(d => ({
        _id: d._id,
        fileName: d.fileName,
        documentType: d.documentType
      })),
      createdAt: lohangDraft.createdAt
    }
  };
}

/**
 * Setup Form E/B và Tiêu chí (sau khi upload bổ sung xong)
 * PUT /api/v1/co/lohang/:id/setup
 * CHỈ lưu cấu hình, KHÔNG extract data
 */
async function setupFormAndCriteria(lohangDraftId, payload) {
  const { formType, criterionType } = payload;
  
  if (!formType || !criterionType) {
    const err = new Error('formType và criterionType là bắt buộc');
    err.status = constants.HTTP_STATUS.BAD_REQUEST;
    throw err;
  }

  const lohangDraft = await LohangDraft.findById(lohangDraftId).lean();
  if (!lohangDraft) {
    const err = new Error('Lô hàng không tồn tại');
    err.status = constants.HTTP_STATUS.NOT_FOUND;
    throw err;
  }

  // Cập nhật cấu hình và workflow
  // Sau khi setup form xong → Tự động chuyển sang bước 3
  await LohangDraft.findByIdAndUpdate(lohangDraftId, {
    formType,
    criterionType,
    status: 'SETUP_COMPLETED',
    currentStep: 3, // Tự động chuyển sang bước 3
    'workflowSteps.step2_selectFormAndCriteria.completed': true,
    'workflowSteps.step2_selectFormAndCriteria.completedAt': new Date(),
    updatedAt: new Date()
  });

  const updated = await LohangDraft.findById(lohangDraftId).lean();

  return {
    _id: updated._id,
    formType: updated.formType,
    exchangeRate: updated.exchangeRate,
    criterionType: updated.criterionType,
    status: updated.status,
    currentStep: updated.currentStep,
    workflowSteps: updated.workflowSteps,
    totalSkuCount: updated.totalSkuCount
  };
}

/**
 * Continue to next step (Chuyển bước) - TỔNG HỢP TẤT CẢ
 * POST /api/v1/co/lohang/:id/continue
 * Body: { formType, exchangeRate, criterionType, tables } (tùy bước)
 */
async function continueToNextStep(lohangDraftId, payload = {}) {
  const lohangDraft = await LohangDraft.findById(lohangDraftId).lean();
  if (!lohangDraft) {
    const err = new Error('Lô hàng không tồn tại');
    err.status = constants.HTTP_STATUS.NOT_FOUND;
    throw err;
  }

  const currentStep = lohangDraft.currentStep || 1;
  console.log(`📍 Continue from step ${currentStep} (status: ${lohangDraft.status})`);
  console.log('📦 Payload:', payload);
  
  let nextStep = currentStep;
  let updates = { updatedAt: new Date() };

  // Logic chuyển bước
  if (currentStep === 1) {
    // Bước 1 → Bước 2: Upload xong → Hiển thị form để user điền
    nextStep = 2;
    updates.currentStep = 2;
    updates['workflowSteps.step1_uploadDocuments.completed'] = true;
    updates['workflowSteps.step1_uploadDocuments.completedAt'] = new Date();
  } else if (currentStep === 2) {
    // Bước 2 → Bước 3: Lưu form + Trigger extraction
    const { formType, criterionType } = payload;
    
    // Validate payload
    if (!formType || !criterionType) {
      const err = new Error('Thiếu thông tin Form hoặc Tiêu chí');
      err.status = constants.HTTP_STATUS.BAD_REQUEST;
      throw err;
    }
    
    // Validation: Chỉ hỗ trợ FORM_E + CTH
    if (formType !== 'FORM_E' || criterionType !== 'CTH') {
      const err = new Error(`Combination ${formType} + ${criterionType} chưa được phát triển. Hiện tại chỉ hỗ trợ FORM_E + CTH.`);
      err.status = constants.HTTP_STATUS.BAD_REQUEST;
      throw err;
    }

    // Xóa data cũ trước khi extraction lại
    console.log('🗑️ Clearing old extracted tables...');
    await ExtractedProductTable.deleteMany({ lohangDraftId });
    await ExtractedNplTable.deleteMany({ lohangDraftId });
    await ExtractedBomTable.deleteMany({ lohangDraftId });
    console.log('✅ Cleared old tables');

    // Lưu config
    nextStep = 3;
    updates.currentStep = 3;
    updates.status = 'EXTRACTING';
    updates.formType = formType;
    updates.criterionType = criterionType;
    updates['workflowSteps.step2_selectFormAndCriteria.completed'] = true;
    updates['workflowSteps.step2_selectFormAndCriteria.completedAt'] = new Date();
    updates['workflowSteps.step3_extractData.inProgress'] = true;

    // Cập nhật trước
    await LohangDraft.findByIdAndUpdate(lohangDraftId, updates);

    // Tự động trigger extraction
    console.log('🔄 Auto-triggering table extraction...');
    console.log(`📦 Bundle ID: ${lohangDraft.bundleId}, Lohang Draft ID: ${lohangDraftId}`);
    
    try {
      console.log('⏳ Calling extractDataFromDocuments...');
      const extractResult = await extractDataFromDocuments(lohangDraftId);
      console.log('✅ Extraction completed:', extractResult);
      
      const updated = await LohangDraft.findById(lohangDraftId).lean();
      const workflowInfo = getWorkflowInfo(updated);

      // Load 3 bảng để trả về luôn
      const productTable = await ExtractedProductTable.findOne({ lohangDraftId }).lean();
      const nplTable = await ExtractedNplTable.findOne({ lohangDraftId }).lean();
      const bomTable = await ExtractedBomTable.findOne({ lohangDraftId }).lean();

      console.log(`📊 Loaded tables - Product: ${!!productTable}, NPL: ${!!nplTable}, BOM: ${!!bomTable}`);

      return {
        _id: updated._id,
        currentStep: updated.currentStep,
        status: updated.status,
        workflow: workflowInfo,
        tables: {
          productTable,
          nplTable,
          bomTable
        },
        message: 'Đã lưu cấu hình, trích xuất và chuyển sang bước 3'
      };
    } catch (error) {
      console.error('❌ Extraction error:', error);
      await LohangDraft.findByIdAndUpdate(lohangDraftId, {
        status: 'EXTRACTION_FAILED',
        'workflowSteps.step3_extractData.inProgress': false,
        'workflowSteps.step3_extractData.errors': [error.message]
      });

      const updated = await LohangDraft.findById(lohangDraftId).lean();
      const workflowInfo = getWorkflowInfo(updated);

      return {
        _id: updated._id,
        currentStep: updated.currentStep,
        status: updated.status,
        workflow: workflowInfo,
        error: error.message,
        message: 'Đã chuyển sang bước 3 nhưng trích xuất thất bại'
      };
    }
  } else if (currentStep === 3) {
    // Bước 3 → Bước 4: Lưu tables (nếu có edit) + Chuyển sang bước 4 (chưa tính toán)
    const { tables, reExtract } = payload;
    
    // Nếu user muốn tạo lại bảng từ documents (re-extract)
    if (reExtract) {
      console.log('🔄 Step 3: Re-extracting tables from documents...');
      
      // Xóa bảng cũ
      await ExtractedProductTable.deleteMany({ lohangDraftId });
      await ExtractedNplTable.deleteMany({ lohangDraftId });
      await ExtractedBomTable.deleteMany({ lohangDraftId });
      console.log('🗑️ Cleared old extracted tables');
      
      // Gọi extraction lại
      await triggerExtractTables(lohangDraftId);
      console.log('✅ Re-extraction completed');
    } else if (tables) {
      // Nếu user edit tables, lưu lại
      if (tables.productTable) {
        await ExtractedProductTable.findOneAndUpdate(
          { lohangDraftId },
          { ...tables.productTable, updatedAt: new Date() }
        );
      }
      if (tables.nplTable) {
        await ExtractedNplTable.findOneAndUpdate(
          { lohangDraftId },
          { ...tables.nplTable, updatedAt: new Date() }
        );
      }
      if (tables.bomTable) {
        await ExtractedBomTable.findOneAndUpdate(
          { lohangDraftId },
          { ...tables.bomTable, updatedAt: new Date() }
        );
      }
      console.log('✅ Đã lưu tables đã chỉnh sửa');
    }

    // Kiểm tra đã có đủ 3 bảng
    const productTable = await ExtractedProductTable.findOne({ lohangDraftId }).lean();
    const nplTable = await ExtractedNplTable.findOne({ lohangDraftId }).lean();
    const bomTable = await ExtractedBomTable.findOne({ lohangDraftId }).lean();

    if (!productTable || !nplTable || !bomTable) {
      const err = new Error('Chưa hoàn thành trích xuất 3 bảng. Vui lòng hoàn thành bước 3 trước.');
      err.status = constants.HTTP_STATUS.BAD_REQUEST;
      throw err;
    }

    nextStep = 4;
    updates.currentStep = 4;
    updates.status = 'CALCULATING';
    updates['workflowSteps.step3_extractData.completed'] = true;
    updates['workflowSteps.step3_extractData.completedAt'] = new Date();
    updates['workflowSteps.step4_calculate.inProgress'] = true; // Bắt đầu calculation ngay

    // Cập nhật trước khi calculation
    await LohangDraft.findByIdAndUpdate(lohangDraftId, updates);
    
    console.log('🔄 Step 3→4: Clearing old consumption data and auto-running calculation...');
    
    // Xóa data consumption cũ để tạo mới (tránh đè lên)
    await NplConsumptionDetail.deleteMany({ lohangDraftId });
    console.log('🗑️ Cleared old consumption details');
    
    try {
      // Chạy calculation ngay lập tức
      const calculationResult = await calculateConsumptionAndFifo(lohangDraftId);
      
      if (!calculationResult.success) {
        throw new Error(calculationResult.message);
      }
      
      // Cập nhật thành công calculation
      await LohangDraft.findByIdAndUpdate(lohangDraftId, {
        status: 'CALCULATED_WITH_WARNINGS',
        'workflowSteps.step4_calculate.completed': true,
        'workflowSteps.step4_calculate.completedAt': new Date(),
        'workflowSteps.step4_calculate.inProgress': false
      });
      
      const updated = await LohangDraft.findById(lohangDraftId).lean();
      const workflowInfo = getWorkflowInfo(updated);
      
      // Load consumption details để trả về
      const consumptionDetails = await NplConsumptionDetail.find({ lohangDraftId }).lean();

      return {
        _id: updated._id,
        currentStep: updated.currentStep,
        status: updated.status,
        workflow: workflowInfo,
        tables: {
          productTable,
          nplTable,
          bomTable
        },
        calculation: {
          details: consumptionDetails,
          totalDetails: consumptionDetails.length
        },
        message: `Đã chuyển sang bước 4 và hoàn thành tính toán consumption (${consumptionDetails.length} records)`
      };
      
    } catch (calculationError) {
      console.error('❌ Auto-calculation failed:', calculationError);
      
      // Cập nhật lỗi calculation
      await LohangDraft.findByIdAndUpdate(lohangDraftId, {
        status: 'CALCULATION_FAILED',
        'workflowSteps.step4_calculate.inProgress': false,
        'workflowSteps.step4_calculate.errors': [calculationError.message]
      });
      
      const updated = await LohangDraft.findById(lohangDraftId).lean();
      const workflowInfo = getWorkflowInfo(updated);

      return {
        _id: updated._id,
        currentStep: updated.currentStep,
        status: updated.status,
        workflow: workflowInfo,
        tables: {
          productTable,
          nplTable,
          bomTable
        },
        error: calculationError.message,
        message: 'Đã chuyển sang bước 4 nhưng tính toán consumption thất bại'
      };
    }
  } else if (currentStep === 4) {
    const { reCalculate } = payload;
    const details = await NplConsumptionDetail.find({ lohangDraftId }).lean();
    
    // Nếu user muốn tạo lại calculation (re-calculate)
    if (reCalculate) {
      console.log('🔄 Step 4: Re-calculating consumption data...');
      
      // Xóa data cũ
      await NplConsumptionDetail.deleteMany({ lohangDraftId });
      console.log('🗑️ Cleared old consumption details');
      
      // Set inProgress = true
      await LohangDraft.findByIdAndUpdate(lohangDraftId, {
        'workflowSteps.step4_calculate.inProgress': true,
        updatedAt: new Date()
      });
      
      try {
        const calcResult = await calculateConsumptionAndFifo(lohangDraftId);
        console.log('✅ Re-calculation completed');
        
        const updated = await LohangDraft.findById(lohangDraftId).lean();
        const workflowInfo = getWorkflowInfo(updated);
        
        // Load lại bảng sau khi tính toán
        const newDetails = await NplConsumptionDetail.find({ lohangDraftId })
          .sort({ skuCode: 1, tenHang: 1, allocationOrder: 1 })
          .lean();

        return {
          _id: updated._id,
          currentStep: updated.currentStep,
          status: updated.status,
          workflow: workflowInfo,
          calculation: {
            ...calcResult,
            details: newDetails
          },
          message: `Đã tạo lại calculation. Bấm tiếp tục để tạo bảng kê ${updated.criterionType}.`
        };
      } catch (error) {
        console.error('❌ Re-calculation failed:', error);
        throw error;
      }
    } else if (details.length === 0) {
      // Nếu chưa có calculation data, chạy calculation trước
      console.log('🔄 Step 4: Running calculation first...');
      
      // Set inProgress = true trước khi bắt đầu
      await LohangDraft.findByIdAndUpdate(lohangDraftId, {
        'workflowSteps.step4_calculate.inProgress': true,
        updatedAt: new Date()
      });
      
      try {
        const calcResult = await calculateConsumptionAndFifo(lohangDraftId);
        console.log('✅ Calculation completed');
        
        const updated = await LohangDraft.findById(lohangDraftId).lean();
        const workflowInfo = getWorkflowInfo(updated);
        
        // Load lại bảng sau khi tính toán
        const newDetails = await NplConsumptionDetail.find({ lohangDraftId })
          .sort({ skuCode: 1, tenHang: 1, allocationOrder: 1 })
          .lean();

        return {
          _id: updated._id,
          currentStep: updated.currentStep,
          status: updated.status,
          workflow: workflowInfo,
          calculation: {
            ...calcResult,
            details: newDetails
          },
          message: `Đã hoàn thành calculation. Bấm tiếp tục để tạo bảng kê ${updated.criterionType}.`
        };
      } catch (error) {
        console.error('❌ Calculation failed:', error);
        throw error;
      }
    }
    
    // Nếu đã có calculation data → Chuyển sang bước 5 và tạo reports
    console.log('🔄 Step 4→5: Clearing old reports and generating new ones...');
    
    // Lấy thông tin lô hàng để kiểm tra tiêu chí
    const lohangDraft = await LohangDraft.findById(lohangDraftId).lean();
    
    // Xóa reports cũ để tạo mới (tránh đè lên)
    await LohangDraft.findByIdAndUpdate(lohangDraftId, { ctcReports: [] });
    console.log('🗑️ Cleared old reports');
    
    let ctcReportsResult = null;
    
    // Tạo bảng kê cho tất cả tiêu chí
    const supportedCriteria = ['CTC', 'CTH', 'CTSH', 'RVC40', 'RVC50', 'WO', 'PE'];
    if (supportedCriteria.includes(lohangDraft.criterionType)) {
      console.log(`🔄 Generating reports for criterion type: ${lohangDraft.criterionType}`);
      
      try {
        const ReportGeneratorService = require('../../core/services/ReportGenerator.service');
        const reportService = new ReportGeneratorService();
        ctcReportsResult = await reportService.generateReports(lohangDraftId);
        
        console.log(`✅ Generated ${ctcReportsResult.totalReports} reports for ${lohangDraft.criterionType}`);
      } catch (reportError) {
        console.error('❌ Report generation failed:', reportError);
        // Throw error vì đây là bước chính để tạo bảng kê
        throw new Error(`Lỗi tạo bảng kê ${lohangDraft.criterionType}: ${reportError.message}`);
      }
    } else {
      console.log(`ℹ️ Criterion type ${lohangDraft.criterionType} is not supported yet`);
    }
    
    // Cập nhật trạng thái chuyển sang bước 5
    await LohangDraft.findByIdAndUpdate(lohangDraftId, {
      'workflowSteps.step4_calculate.completed': true,
      'workflowSteps.step4_calculate.completedAt': new Date(),
      'workflowSteps.step4_calculate.inProgress': false,
      'workflowSteps.step5_generateReports.inProgress': true,
      currentStep: 5, // Chuyển sang bước 5
      updatedAt: new Date()
    });
    
    const updated = await LohangDraft.findById(lohangDraftId).lean();
    const workflowInfo = getWorkflowInfo(updated);
    
    // Load lại consumption details
    const consumptionDetails = await NplConsumptionDetail.find({ lohangDraftId })
      .sort({ skuCode: 1, tenHang: 1, allocationOrder: 1 })
      .lean();

    return {
      _id: updated._id,
      currentStep: updated.currentStep,
      status: updated.status,
      workflow: workflowInfo,
      calculation: {
        details: consumptionDetails,
        totalDetails: consumptionDetails.length
      },
      ctcReports: ctcReportsResult ? {
        success: true,
        totalReports: ctcReportsResult.totalReports,
        reports: ctcReportsResult.reports
      } : null,
      message: ctcReportsResult 
        ? `Đã chuyển sang bước 5 và tạo ${ctcReportsResult.totalReports} bảng kê ${lohangDraft.criterionType}. Có thể xác nhận hoàn thành.`
        : 'Đã chuyển sang bước 5. Sẵn sàng hoàn thành quy trình.'
    };
  } else if (currentStep === 5) {
    const { reGenerateReports } = payload;
    
    // Nếu user muốn tạo lại reports (re-generate)
    if (reGenerateReports) {
      console.log('🔄 Step 5: Re-generating reports...');
      
      // Xóa reports cũ
      await LohangDraft.findByIdAndUpdate(lohangDraftId, { ctcReports: [] });
      console.log('🗑️ Cleared old reports');
      
      // Lấy thông tin lô hàng
      const lohangDraftForReGen = await LohangDraft.findById(lohangDraftId).lean();
      
      let ctcReportsResult = null;
      const supportedCriteria = ['CTC', 'CTH', 'CTSH', 'RVC40', 'RVC50', 'WO', 'PE'];
      
      if (supportedCriteria.includes(lohangDraftForReGen.criterionType)) {
        console.log(`🔄 Re-generating reports for criterion type: ${lohangDraftForReGen.criterionType}`);
        
        try {
          const ReportGeneratorService = require('../../core/services/ReportGenerator.service');
          const reportService = new ReportGeneratorService();
          ctcReportsResult = await reportService.generateReports(lohangDraftId);
          
          console.log(`✅ Re-generated ${ctcReportsResult.totalReports} reports for ${lohangDraftForReGen.criterionType}`);
        } catch (reportError) {
          console.error('❌ Report re-generation failed:', reportError);
          throw new Error(`Lỗi tạo lại bảng kê ${lohangDraftForReGen.criterionType}: ${reportError.message}`);
        }
      }
      
      const updated = await LohangDraft.findById(lohangDraftId).lean();
      const workflowInfo = getWorkflowInfo(updated);
      
      return {
        _id: updated._id,
        currentStep: updated.currentStep,
        status: updated.status,
        workflow: workflowInfo,
        ctcReports: ctcReportsResult ? {
          success: true,
          totalReports: ctcReportsResult.totalReports,
          reports: ctcReportsResult.reports
        } : null,
        message: `Đã tạo lại ${ctcReportsResult?.totalReports || 0} bảng kê. Có thể xác nhận hoàn thành.`
      };
    } else {
      // Step 5 → 6: User xác nhận hoàn thành step 5
      console.log('✅ Step 5: Confirming report generation completion...');
      
      // Mark step 5 completed và chuyển sang step 6
      await LohangDraft.findByIdAndUpdate(lohangDraftId, {
        'workflowSteps.step5_generateReports.completed': true,
        'workflowSteps.step5_generateReports.completedAt': new Date(),
        'workflowSteps.step5_generateReports.inProgress': false,
        currentStep: 6,
        status: 'REPORTS_GENERATED',
        updatedAt: new Date()
      });
      
      console.log('✅ Step 5 completed, moved to Step 6');
      
      const updated = await LohangDraft.findById(lohangDraftId).lean();
      const workflowInfo = getWorkflowInfo(updated);
      
      return {
        _id: updated._id,
        currentStep: updated.currentStep,
        status: updated.status,
        workflow: workflowInfo,
        ctcReports: updated.ctcReports ? {
          success: true,
          totalReports: updated.ctcReports.length,
          reports: updated.ctcReports
        } : null,
        message: '✅ Đã xác nhận hoàn thành Step 5. Chuyển sang Step 6 - Xem xét Kết quả.'
      };
    }
  } else {
    // Các bước khác
    console.error(`❌ Cannot continue from step ${currentStep}`);
    console.error('LohangDraft status:', lohangDraft.status);
    console.error('WorkflowSteps:', JSON.stringify(lohangDraft.workflowSteps, null, 2));
    
    const err = new Error(`Không thể continue từ bước ${currentStep}. Lô hàng đang ở trạng thái: ${lohangDraft.status}`);
    err.status = constants.HTTP_STATUS.BAD_REQUEST;
    throw err;
  }

  // Cập nhật
  await LohangDraft.findByIdAndUpdate(lohangDraftId, updates);

  const updated = await LohangDraft.findById(lohangDraftId).lean();
  const workflowInfo = getWorkflowInfo(updated);

  return {
    _id: updated._id,
    currentStep: updated.currentStep,
    status: updated.status,
    workflow: workflowInfo,
    message: `Đã chuyển sang bước ${nextStep}`
  };
}

/**
 * Setup Form + Trigger Extract cùng lúc (Tối ưu UX)
 * POST /api/v1/co/lohang/:id/setup-and-extract
 */
async function setupAndExtract(lohangDraftId, payload) {
  const { formType, criterionType } = payload;
  
  if (!formType || !criterionType) {
    const err = new Error('formType và criterionType là bắt buộc');
    err.status = constants.HTTP_STATUS.BAD_REQUEST;
    throw err;
  }

  const lohangDraft = await LohangDraft.findById(lohangDraftId).lean();
  if (!lohangDraft) {
    const err = new Error('Lô hàng không tồn tại');
    err.status = constants.HTTP_STATUS.NOT_FOUND;
    throw err;
  }

  // Kiểm tra đang extract hay chưa (prevent spam)
  if (lohangDraft.workflowSteps?.step3_extractData?.inProgress) {
    const err = new Error('Đang trích xuất dữ liệu, vui lòng đợi');
    err.status = constants.HTTP_STATUS.TOO_MANY_REQUESTS;
    throw err;
  }

  // Cập nhật form + workflow + bắt đầu extract
  await LohangDraft.findByIdAndUpdate(lohangDraftId, {
    formType,
    criterionType,
    status: 'DATA_EXTRACTING',
    currentStep: 3,
    'workflowSteps.step2_selectFormAndCriteria.completed': true,
    'workflowSteps.step2_selectFormAndCriteria.completedAt': new Date(),
    'workflowSteps.step3_extractData.inProgress': true,
    updatedAt: new Date()
  });

  // Bắt đầu trích xuất dữ liệu async
  setImmediate(() => {
    extractDataFromDocuments(lohangDraftId)
      .catch(err => console.error('Extract data error:', err));
  });

  return {
    _id: lohangDraft._id,
    formType,
    exchangeRate,
    criterionType,
    status: 'DATA_EXTRACTING',
    currentStep: 3,
    message: 'Đã setup form và bắt đầu trích xuất dữ liệu'
  };
}

/**
 * Trigger trích xuất và tổng hợp dữ liệu (khi nhân viên bấm "Tiếp tục")
 * POST /api/v1/co/lohang/:id/extract-tables
 */
async function triggerExtractTables(lohangDraftId) {
  const lohangDraft = await LohangDraft.findById(lohangDraftId).lean();
  if (!lohangDraft) {
    const err = new Error('Lô hàng không tồn tại');
    err.status = constants.HTTP_STATUS.NOT_FOUND;
    throw err;
  }

  // Kiểm tra đã setup form chưa (bước 2)
  if (!lohangDraft.formType || !lohangDraft.exchangeRate || !lohangDraft.criterionType) {
    const err = new Error('Vui lòng chọn Form và Tiêu chí trước (Bước 2)');
    err.status = constants.HTTP_STATUS.BAD_REQUEST;
    throw err;
  }

  // Kiểm tra đang extract hay chưa (prevent spam)
  if (lohangDraft.workflowSteps?.step3_extractData?.inProgress) {
    const err = new Error('Đang trích xuất dữ liệu, vui lòng đợi');
    err.status = constants.HTTP_STATUS.TOO_MANY_REQUESTS;
    throw err;
  }

  // Cập nhật status và workflow
  await LohangDraft.findByIdAndUpdate(lohangDraftId, {
    status: 'DATA_EXTRACTING',
    'workflowSteps.step3_extractData.inProgress': true,
    updatedAt: new Date()
  });

  // Bắt đầu trích xuất dữ liệu async
  setImmediate(() => {
    extractDataFromDocuments(lohangDraftId)
      .catch(err => console.error('Extract data error:', err));
  });

  return {
    _id: lohangDraft._id,
    status: 'DATA_EXTRACTING',
    currentStep: 3,
    message: 'Đã bắt đầu trích xuất và tổng hợp dữ liệu'
  };
}

/**
 * Trích xuất dữ liệu từ documents (Invoice, BOM, VAT Invoice, Export Declaration)
 * Sử dụng AI để tổng hợp dữ liệu dạng bảng
 */
async function extractDataFromDocuments(lohangDraftId) {
  const errors = [];
  let currentStep = '';

  try {
    const lohangDraft = await LohangDraft.findById(lohangDraftId).lean();
    if (!lohangDraft) return;

    console.log('LohangDraft linkedDocuments:', lohangDraft.linkedDocuments?.length || 0);
    console.log('LinkedDocument IDs:', lohangDraft.linkedDocuments?.map(id => id.toString()));

    // ✅ REFRESH: Query tất cả documents từ bundle để đảm bảo có BOM mới upload
    let bundleId = lohangDraft.linkedDocuments?.[0] 
      ? (await Document.findById(lohangDraft.linkedDocuments[0]).lean())?.bundleId
      : null;

    let documents = [];
    
    if (bundleId) {
      // Query tất cả documents trong bundle (bao gồm cả BOM mới upload)
      documents = await Document.find({ bundleId: bundleId }).lean();
      console.log('📦 Refreshed documents from bundle:', documents.length);
    } else {
      // Fallback: Dùng linkedDocuments từ lohangDraft
      documents = await Document.find({
        _id: { $in: lohangDraft.linkedDocuments }
      }).lean();
      console.log('Found documents from linkedDocuments:', documents.length);
      
      // Lấy bundleId từ document đầu tiên
      const firstDoc = documents[0];
      bundleId = firstDoc?.bundleId;
    }

    const extractor = getDataExtractorService();
    const BundleClass = require('../models/bundle.model');
    const Bundle = buildModelFromClass(BundleClass);

    // Phân loại documents theo đúng enum trong model
    console.log('Documents:', documents.map(d => ({ id: d._id, type: d.documentType, hasOcr: !!d.ocrResult, isExcel: !!d.isExcelFile })));

    const invoiceDoc = documents.find(d => 
      d.documentType === 'COMMERCIAL_INVOICE'
    );
    
    const declarationDoc = documents.find(d => 
      d.documentType === 'EXPORT_DECLARATION'
    );
    
    const vatInvoiceDocs = documents.filter(d => 
      d.documentType === 'VAT_INVOICE'
    );
    
    const bomDocs = documents.filter(d => d.documentType === 'BOM');

    console.log('Classified documents:', {
      hasInvoice: !!invoiceDoc,
      hasDeclaration: !!declarationDoc,
      vatInvoiceCount: vatInvoiceDocs.length,
      bomCount: bomDocs.length
    });

    // ✅ GIAI ĐOẠN 0: Parse BOM Excel trước (nếu có) - Không cần SKU list
    let parsedBomData = null;
    let bomExcelUrl = null;
    
    if (bomDocs.length > 0) {
      const bomDoc = bomDocs[0];
      bomExcelUrl = bomDoc.storagePath;
      
      if (bomExcelUrl && (bomExcelUrl.endsWith('.xlsx') || bomExcelUrl.endsWith('.xls'))) {
        try {
          currentStep = 'PARSE_BOM_EXCEL';
          console.log('🔄 Step 0: Parsing BOM Excel first...');
          console.log('Excel URL:', bomExcelUrl);
          
          const bomParser = getBomExcelParser();
          parsedBomData = await bomParser.parseBomExcel(bomExcelUrl);
          
          console.log('✅ BOM Excel parsed:', {
            totalMaterials: parsedBomData.totalMaterials,
            totalSkus: parsedBomData.totalSkus
          });
        } catch (error) {
          console.error('Parse BOM Excel error:', error);
          errors.push({
            step: 'PARSE_BOM_EXCEL',
            error: error.message,
            details: error.stack
          });
        }
      }
    }

    // GIAI ĐOẠN 1: Extract Bảng Tổng hợp Sản phẩm Xuất khẩu
    if (invoiceDoc) {
      try {
        currentStep = 'EXTRACT_PRODUCT_TABLE';
        console.log('Extracting product table...');
        const productTableData = await extractor.extractProductTable(
          invoiceDoc,
          declarationDoc,
          lohangDraft.exchangeRate
        );

      // Lưu vào DB
      await ExtractedProductTable.findOneAndUpdate(
        { lohangDraftId: lohangDraft._id },
        {
          lohangDraftId: lohangDraft._id,
          bundleId,
          extractedBy: lohangDraft.staffUser,
          status: 'EXTRACTED',
          ...productTableData,
          updatedAt: new Date()
        },
        { upsert: true, new: true }
      );

      console.log(`Extracted ${productTableData.products.length} products`);
      } catch (error) {
        console.error('Extract product table error:', error);
        errors.push({
          step: 'EXTRACT_PRODUCT_TABLE',
          error: error.message,
          details: error.stack
        });
      }
    }

    // GIAI ĐOẠN 2: Extract Bảng Nhập kho NPL
    if (vatInvoiceDocs.length > 0) {
      try {
        currentStep = 'EXTRACT_NPL_TABLE';
        console.log('Extracting NPL table...');
        const nplTableData = await extractor.extractNplTable(vatInvoiceDocs);

        // Thêm stt cho từng item trong materials array trước khi lưu vào DB
        if (nplTableData.materials && Array.isArray(nplTableData.materials)) {
          nplTableData.materials = nplTableData.materials.map((material, index) => ({
            stt: index + 1,
            ...material
          }));
        }

        // Lưu vào DB
        await ExtractedNplTable.findOneAndUpdate(
          { lohangDraftId: lohangDraft._id },
          {
            lohangDraftId: lohangDraft._id,
            bundleId,
            extractedBy: lohangDraft.staffUser,
            status: 'EXTRACTED',
            ...nplTableData,
            updatedAt: new Date()
          },
          { upsert: true, new: true }
        );

        console.log(`Extracted ${nplTableData.materials.length} NPL items`);
      } catch (error) {
        console.error('Extract NPL table error:', error);
        errors.push({
          step: 'EXTRACT_NPL_TABLE',
          error: error.message,
          details: error.stack
        });
      }
    }

    // GIAI ĐOẠN 3: Transform BOM data với SKU list từ Product Table
    if (bomDocs.length > 0) {
      try {
        currentStep = 'EXTRACT_BOM_TABLE';
        console.log('Step 3: Processing BOM table...');
        
        // Lấy danh sách SKU từ product table 
        const productTable = await ExtractedProductTable.findOne({ 
          lohangDraftId: lohangDraft._id 
        }).lean();
        
        const skuList = (productTable?.products || []).map(p => ({
          skuCode: p.skuCode,
          productName: p.productName
        }));

        if (skuList.length > 0) {
          let bomTableData;
          
          if (parsedBomData) {
            // ✅ Đã parse Excel ở Step 0 → Chỉ cần transform với SKU list
            console.log('🔄 Transforming BOM Excel data with SKU list...');
            
            const bomParser = getBomExcelParser();
            bomTableData = bomParser.transformToBomTable(parsedBomData, skuList);
            
            // Thêm bomExcelUrl vào data
            bomTableData.bomExcelUrl = bomExcelUrl;
            bomTableData.aiModel = 'EXCEL_UPLOAD';
            bomTableData.aiConfidence = 100;
            
            console.log('✅ BOM data transformed successfully');
          } else {
            // ❌ BOM là PDF/Image → Dùng AI OCR (legacy)
            console.log('⚠️ BOM is not Excel, using AI OCR (legacy)...');
            bomTableData = await extractor.extractBomTable(bomDocs, skuList);
          }

          // Lưu vào DB
          await ExtractedBomTable.findOneAndUpdate(
            { lohangDraftId: lohangDraft._id },
            {
              lohangDraftId: lohangDraft._id,
              bundleId,
              extractedBy: lohangDraft.staffUser,
              status: 'EXTRACTED',
              ...bomTableData,
              updatedAt: new Date()
            },
            { upsert: true, new: true }
          );

          console.log(`✅ Saved BOM: ${bomTableData.totalMaterials} materials, ${bomTableData.totalSkus} SKUs`);
        }
      } catch (error) {
        console.error('Extract BOM table error:', error);
        errors.push({
          step: 'EXTRACT_BOM_TABLE',
          error: error.message,
          details: error.stack
        });
      }
    }

    // Cập nhật status lô hàng
    const productTable = await ExtractedProductTable.findOne({ lohangDraftId: lohangDraft._id }).lean();
    const skuCount = productTable?.products?.length || 0;
    
    if (errors.length > 0) {
      // Có lỗi trong quá trình extract
      await LohangDraft.findByIdAndUpdate(lohangDraftId, {
        totalSkuCount: skuCount,
        status: 'EXTRACTION_FAILED',
        extractionErrors: errors,
        'workflowSteps.step3_extractData.inProgress': false,
        updatedAt: new Date()
      });
      console.log('Data extraction completed with errors:', errors);
    } else {
      // Thành công hoàn toàn - Hoàn thành bước 3, chờ user bấm tiếp tục
      await LohangDraft.findByIdAndUpdate(lohangDraftId, {
        totalSkuCount: skuCount,
        status: 'EXTRACTED', // Hoàn thành extraction, chưa ready to calculate
        currentStep: 3, // Vẫn ở bước 3, chờ user bấm tiếp tục
        extractionErrors: [],
        'workflowSteps.step3_extractData.completed': true,
        'workflowSteps.step3_extractData.completedAt': new Date(),
        'workflowSteps.step3_extractData.inProgress': false,
        updatedAt: new Date()
      });
      
      console.log('Data extraction completed successfully');
      console.log('✅ Ready for step 4 - User can now continue to calculation');
    }

  } catch (error) {
    console.error('Extract data error:', error);
    
    // Lỗi nghiêm trọng (không catch được)
    await LohangDraft.findByIdAndUpdate(lohangDraftId, {
      status: 'EXTRACTION_FAILED',
      extractionErrors: [{
        step: currentStep || 'UNKNOWN',
        error: error.message,
        details: error.stack
      }],
      updatedAt: new Date()
    });
  }
}

/**
 * Retry extraction khi có lỗi - Chỉ retry các bảng bị lỗi
 * Nếu có nhiều bảng bị lỗi, sẽ retry từng bảng một
 */
async function retryExtraction(lohangDraftId) {
  const lohangDraft = await LohangDraft.findById(lohangDraftId).lean();
  
  if (!lohangDraft) {
    const err = new Error('Lô hàng không tồn tại');
    err.status = constants.HTTP_STATUS.NOT_FOUND;
    throw err;
  }

  if (lohangDraft.status !== 'EXTRACTION_FAILED') {
    const err = new Error('Chỉ có thể retry khi status là EXTRACTION_FAILED');
    err.status = constants.HTTP_STATUS.BAD_REQUEST;
    throw err;
  }

  // Lấy danh sách bảng bị lỗi từ extractionErrors
  const failedTables = (lohangDraft.extractionErrors || [])
    .map(e => e.step)
    .filter(step => ['EXTRACT_PRODUCT_TABLE', 'EXTRACT_NPL_TABLE', 'EXTRACT_BOM_TABLE'].includes(step));

  if (failedTables.length === 0) {
    const err = new Error('Không tìm thấy bảng nào bị lỗi để retry');
    err.status = constants.HTTP_STATUS.BAD_REQUEST;
    throw err;
  }

  console.log(`Retrying failed tables: ${failedTables.join(', ')}`);

  // Reset errors và status
  await LohangDraft.findByIdAndUpdate(lohangDraftId, {
    status: 'DATA_EXTRACTING',
    extractionErrors: [],
    updatedAt: new Date()
  });

  // Trigger retry extraction async - chỉ retry các bảng bị lỗi
  setImmediate(() => {
    retryFailedTablesExtraction(lohangDraftId, failedTables)
      .catch(err => console.error('Retry extraction error:', err));
  });

  return {
    _id: lohangDraftId,
    status: 'DATA_EXTRACTING',
    message: `Đang retry trích xuất ${failedTables.length} bảng bị lỗi`,
    failedTables: failedTables.map(step => {
      if (step === 'EXTRACT_PRODUCT_TABLE') return 'PRODUCT';
      if (step === 'EXTRACT_NPL_TABLE') return 'NPL';
      if (step === 'EXTRACT_BOM_TABLE') return 'BOM';
      return step;
    })
  };
}

/**
 * Retry các bảng bị lỗi (được gọi từ retryExtraction)
 * Chỉ re-extract những bảng trong danh sách failedTables
 */
async function retryFailedTablesExtraction(lohangDraftId, failedTables) {
  const errors = [];
  
  try {
    const lohangDraft = await LohangDraft.findById(lohangDraftId).lean();
    if (!lohangDraft) return;

    const documents = await Document.find({
      _id: { $in: lohangDraft.linkedDocuments }
    }).lean();

    const extractor = getDataExtractorService();
    const BundleClass = require('../models/bundle.model');
    const Bundle = buildModelFromClass(BundleClass);

    let bundleId = lohangDraft.linkedDocuments?.[0] 
      ? (await Document.findById(lohangDraft.linkedDocuments[0]).lean())?.bundleId
      : null;

    if (!bundleId && documents.length > 0) {
      bundleId = documents[0].bundleId;
    }

    console.log(`Retrying ${failedTables.length} failed tables...`);

    // RETRY: EXTRACT_PRODUCT_TABLE
    if (failedTables.includes('EXTRACT_PRODUCT_TABLE')) {
      try {
        console.log('Retrying PRODUCT table...');
        const invoiceDoc = documents.find(d => d.documentType === 'COMMERCIAL_INVOICE');
        const declarationDoc = documents.find(d => d.documentType === 'EXPORT_DECLARATION');

        if (!invoiceDoc) {
          throw new Error('Không tìm thấy Commercial Invoice');
        }

        const productTableData = await extractor.extractProductTable(
          invoiceDoc,
          declarationDoc,
          lohangDraft.exchangeRate
        );

        await ExtractedProductTable.findOneAndUpdate(
          { lohangDraftId: lohangDraft._id },
          {
            lohangDraftId: lohangDraft._id,
            bundleId,
            extractedBy: lohangDraft.staffUser,
            status: 'EXTRACTED',
            ...productTableData,
            updatedAt: new Date()
          },
          { upsert: true, new: true }
        );

        console.log(`✅ Retried PRODUCT table: ${productTableData.products?.length || 0} products`);
      } catch (error) {
        console.error('Retry PRODUCT table error:', error);
        errors.push({
          step: 'EXTRACT_PRODUCT_TABLE',
          error: error.message,
          details: error.stack
        });
      }
    }

    // RETRY: EXTRACT_NPL_TABLE
    if (failedTables.includes('EXTRACT_NPL_TABLE')) {
      try {
        console.log('Retrying NPL table...');
        const vatInvoiceDocs = documents.filter(d => d.documentType === 'VAT_INVOICE');

        if (vatInvoiceDocs.length === 0) {
          throw new Error('Không tìm thấy VAT Invoice');
        }

        const nplTableData = await extractor.extractNplTable(vatInvoiceDocs);

        if (nplTableData.materials && Array.isArray(nplTableData.materials)) {
          nplTableData.materials = nplTableData.materials.map((material, index) => ({
            stt: index + 1,
            ...material
          }));
        }

        await ExtractedNplTable.findOneAndUpdate(
          { lohangDraftId: lohangDraft._id },
          {
            lohangDraftId: lohangDraft._id,
            bundleId,
            extractedBy: lohangDraft.staffUser,
            status: 'EXTRACTED',
            ...nplTableData,
            updatedAt: new Date()
          },
          { upsert: true, new: true }
        );

        console.log(`✅ Retried NPL table: ${nplTableData.materials?.length || 0} items`);
      } catch (error) {
        console.error('Retry NPL table error:', error);
        errors.push({
          step: 'EXTRACT_NPL_TABLE',
          error: error.message,
          details: error.stack
        });
      }
    }

    // RETRY: EXTRACT_BOM_TABLE
    if (failedTables.includes('EXTRACT_BOM_TABLE')) {
      try {
        console.log('Retrying BOM table...');
        const bomDocs = documents.filter(d => d.documentType === 'BOM');

        if (bomDocs.length === 0) {
          throw new Error('Không tìm thấy BOM document');
        }

        const productTable = await ExtractedProductTable.findOne({ 
          lohangDraftId: lohangDraft._id 
        }).lean();
        
        const skuList = (productTable?.products || []).map(p => ({
          skuCode: p.skuCode,
          productName: p.productName
        }));

        if (skuList.length === 0) {
          throw new Error('Chưa có bảng Sản phẩm, không thể extract BOM');
        }

        const bomTableData = await extractor.extractBomTable(bomDocs, skuList);

        await ExtractedBomTable.findOneAndUpdate(
          { lohangDraftId: lohangDraft._id },
          {
            lohangDraftId: lohangDraft._id,
            bundleId,
            extractedBy: lohangDraft.staffUser,
            status: 'EXTRACTED',
            ...bomTableData,
            updatedAt: new Date()
          },
          { upsert: true, new: true }
        );

        console.log(`✅ Retried BOM table: ${bomTableData.totalMaterials} materials`);
      } catch (error) {
        console.error('Retry BOM table error:', error);
        errors.push({
          step: 'EXTRACT_BOM_TABLE',
          error: error.message,
          details: error.stack
        });
      }
    }

    // Cập nhật status lohangDraft
    const productTable = await ExtractedProductTable.findOne({ lohangDraftId: lohangDraft._id }).lean();
    const skuCount = productTable?.products?.length || 0;
    
    if (errors.length > 0) {
      // Vẫn có lỗi
      await LohangDraft.findByIdAndUpdate(lohangDraftId, {
        totalSkuCount: skuCount,
        status: 'EXTRACTION_FAILED',
        extractionErrors: errors,
        'workflowSteps.step3_extractData.inProgress': false,
        updatedAt: new Date()
      });
      console.log('Retry extraction completed with errors:', errors);
    } else {
      // Thành công - tất cả bảng đã được retry thành công
      await LohangDraft.findByIdAndUpdate(lohangDraftId, {
        totalSkuCount: skuCount,
        status: 'EXTRACTED',
        currentStep: 3,
        extractionErrors: [],
        'workflowSteps.step3_extractData.completed': true,
        'workflowSteps.step3_extractData.completedAt': new Date(),
        'workflowSteps.step3_extractData.inProgress': false,
        updatedAt: new Date()
      });
      console.log('✅ Retry extraction completed successfully');
    }

  } catch (error) {
    console.error('Retry failed tables extraction error:', error);
    
    await LohangDraft.findByIdAndUpdate(lohangDraftId, {
      status: 'EXTRACTION_FAILED',
      extractionErrors: [{
        step: 'RETRY_EXTRACTION',
        error: error.message,
        details: error.stack
      }],
      updatedAt: new Date()
    });
  }
}

/**
 * Re-extract một bảng cụ thể với user note
 * @param {string} lohangDraftId 
 * @param {string} tableType - 'PRODUCT' | 'NPL' | 'BOM'
 * @param {string} userNote - Ghi chú của user về lỗi/yêu cầu
 */
async function reExtractTable(lohangDraftId, tableType, userNote) {
  const lohangDraft = await LohangDraft.findById(lohangDraftId).lean();
  
  if (!lohangDraft) {
    const err = new Error('Lô hàng không tồn tại');
    err.status = constants.HTTP_STATUS.NOT_FOUND;
    throw err;
  }

  const documents = await Document.find({
    _id: { $in: lohangDraft.linkedDocuments }
  }).lean();

  const extractor = getDataExtractorService();
  const BundleClass = require('../models/bundle.model');
  const Bundle = buildModelFromClass(BundleClass);

  const firstDoc = documents[0];
  const bundleId = firstDoc?.bundleId;

  console.log(`Re-extracting ${tableType} table with user note: ${userNote}`);
  console.log('Available documents:', documents.map(d => ({
    id: d._id,
    type: d.documentType,
    fileName: d.fileName,
    hasOcr: !!d.ocrResult,
    ocrLength: d.ocrResult?.length || 0
  })));

  try {
    if (tableType === 'PRODUCT') {
      // Re-extract Product Table
      const invoiceDoc = documents.find(d => d.documentType === 'COMMERCIAL_INVOICE');
      const declarationDoc = documents.find(d => d.documentType === 'EXPORT_DECLARATION');

      if (!invoiceDoc) {
        throw new Error('Không tìm thấy Commercial Invoice');
      }

      const productTableData = await extractor.extractProductTable(
        invoiceDoc,
        declarationDoc,
        lohangDraft.exchangeRate,
        userNote // Truyền user note vào prompt
      );

      // Cập nhật DB với note
      await ExtractedProductTable.findOneAndUpdate(
        { lohangDraftId: lohangDraft._id },
        {
          lohangDraftId: lohangDraft._id,
          bundleId,
          extractedBy: lohangDraft.staffUser,
          status: 'EXTRACTED',
          notes: userNote,
          ...productTableData,
          updatedAt: new Date()
        },
        { upsert: true, new: true }
      );

      return {
        tableType: 'PRODUCT',
        status: 'SUCCESS',
        message: 'Đã re-extract bảng Sản phẩm thành công',
        totalProducts: productTableData.products?.length || 0
      };

    } else if (tableType === 'NPL') {
      // Re-extract NPL Table
      const vatInvoiceDocs = documents.filter(d => d.documentType === 'VAT_INVOICE');

      if (vatInvoiceDocs.length === 0) {
        throw new Error('Không tìm thấy VAT Invoice');
      }

      const nplTableData = await extractor.extractNplTable(vatInvoiceDocs, userNote);

      // Thêm stt cho từng item trong materials array trước khi lưu vào DB
      if (nplTableData.materials && Array.isArray(nplTableData.materials)) {
        nplTableData.materials = nplTableData.materials.map((material, index) => ({
          stt: index + 1,
          ...material
        }));
      }

      await ExtractedNplTable.findOneAndUpdate(
        { lohangDraftId: lohangDraft._id },
        {
          lohangDraftId: lohangDraft._id,
          bundleId,
          extractedBy: lohangDraft.staffUser,
          status: 'EXTRACTED',
          notes: userNote,
          ...nplTableData,
          updatedAt: new Date()
        },
        { upsert: true, new: true }
      );

      return {
        tableType: 'NPL',
        status: 'SUCCESS',
        message: 'Đã re-extract bảng NPL thành công',
        totalMaterials: nplTableData.materials?.length || 0
      };

    } else if (tableType === 'BOM') {
      // Re-extract BOM Table
      const bomDocs = documents.filter(d => d.documentType === 'BOM');

      if (bomDocs.length === 0) {
        const availableTypes = [...new Set(documents.map(d => d.documentType))];
        throw new Error(
          `Không tìm thấy BOM document trong lô hàng này. ` +
          `Các loại chứng từ hiện có: ${availableTypes.join(', ')}. ` +
          `Vui lòng upload file BOM trước khi re-extract.`
        );
      }

      const productTable = await ExtractedProductTable.findOne({ 
        lohangDraftId: lohangDraft._id 
      }).lean();
      
      const skuList = (productTable?.products || []).map(p => ({
        skuCode: p.skuCode,
        productName: p.productName
      }));

      if (skuList.length === 0) {
        throw new Error('Chưa có bảng Sản phẩm, không thể extract BOM');
      }

      const bomTableData = await extractor.extractBomTable(bomDocs, skuList, userNote);

      await ExtractedBomTable.findOneAndUpdate(
        { lohangDraftId: lohangDraft._id },
        {
          lohangDraftId: lohangDraft._id,
          bundleId,
          extractedBy: lohangDraft.staffUser,
          status: 'EXTRACTED',
          notes: userNote,
          ...bomTableData,
          updatedAt: new Date()
        },
        { upsert: true, new: true }
      );

      return {
        tableType: 'BOM',
        status: 'SUCCESS',
        message: 'Đã re-extract bảng BOM thành công',
        totalMaterials: bomTableData.totalMaterials || 0
      };

    } else {
      throw new Error('Table type không hợp lệ. Chỉ chấp nhận: PRODUCT, NPL, BOM');
    }

  } catch (error) {
    console.error(`Re-extract ${tableType} error:`, error);
    throw error;
  }
}

/**
 * Get workflow info và next action cho FE
 */
function getWorkflowInfo(lohangDraft) {
  const { currentStep, workflowSteps, status } = lohangDraft;
  
  const steps = [
    {
      step: 1,
      name: 'Upload Documents',
      key: 'step1_uploadDocuments',
      completed: workflowSteps?.step1_uploadDocuments?.completed || false,
      completedAt: workflowSteps?.step1_uploadDocuments?.completedAt
    },
    {
      step: 2,
      name: 'Select Form & Criteria',
      key: 'step2_selectFormAndCriteria',
      completed: workflowSteps?.step2_selectFormAndCriteria?.completed || false,
      completedAt: workflowSteps?.step2_selectFormAndCriteria?.completedAt
    },
    {
      step: 3,
      name: 'Extract & Analyze Data',
      key: 'step3_extractData',
      completed: workflowSteps?.step3_extractData?.completed || false,
      completedAt: workflowSteps?.step3_extractData?.completedAt,
      inProgress: workflowSteps?.step3_extractData?.inProgress || false
    },
    {
      step: 4,
      name: 'Calculate Allocation',
      key: 'step4_calculate',
      completed: workflowSteps?.step4_calculate?.completed || false,
      completedAt: workflowSteps?.step4_calculate?.completedAt,
      inProgress: workflowSteps?.step4_calculate?.inProgress || false,
      errors: workflowSteps?.step4_calculate?.errors || [],
      warnings: workflowSteps?.step4_calculate?.warnings || []
    },
    {
      step: 5,
      name: 'Generate Reports',
      key: 'step5_generateReports',
      completed: workflowSteps?.step5_generateReports?.completed || false,
      completedAt: workflowSteps?.step5_generateReports?.completedAt,
      inProgress: workflowSteps?.step5_generateReports?.inProgress || false,
      errors: workflowSteps?.step5_generateReports?.errors || []
    },
    {
      step: 6,
      name: 'Review Results',
      key: 'step6_reviewResults',
      completed: workflowSteps?.step6_reviewResults?.completed || false,
      completedAt: workflowSteps?.step6_reviewResults?.completedAt
    },
    {
      step: 7,
      name: 'Export C/O',
      key: 'step7_exportCO',
      completed: workflowSteps?.step7_exportCO?.completed || false,
      completedAt: workflowSteps?.step7_exportCO?.completedAt
    }
  ];

  // Xác định next action
  let nextAction = null;
  let canProceed = true;
  let message = '';

  if (status === 'EXTRACTION_FAILED') {
    nextAction = {
      type: 'RETRY_EXTRACTION',
      endpoint: `/api/v1/co/lohang/${lohangDraft._id}/retry-extraction`,
      method: 'POST',
      label: 'Retry Extraction'
    };
    canProceed = false;
    message = 'Extraction failed. Please retry.';
  } else if (currentStep === 1) {
    // Bước 1: Upload documents → Continue to step 2
    nextAction = {
      type: 'CONTINUE',
      endpoint: `/api/v1/co/lohang/${lohangDraft._id}/continue`,
      method: 'POST',
      label: 'Continue',
      description: 'Continue to Step 2'
    };
  } else if (currentStep === 2 && !workflowSteps?.step2_selectFormAndCriteria?.completed) {
    nextAction = {
      type: 'SETUP_AND_EXTRACT',
      endpoint: `/api/v1/co/lohang/${lohangDraft._id}/setup-and-extract`,
      method: 'POST',
      label: 'Continue',
      description: 'Setup Form & Start Extraction',
      requiredFields: ['formType', 'exchangeRate', 'criterionType'],
      // API cũ (nếu muốn tách riêng)
      alternativeEndpoint: `/api/v1/co/lohang/${lohangDraft._id}/setup`
    };
  } else if (currentStep === 3 && !workflowSteps?.step3_extractData?.completed && !workflowSteps?.step3_extractData?.inProgress) {
    nextAction = {
      type: 'TRIGGER_EXTRACT',
      endpoint: `/api/v1/co/lohang/${lohangDraft._id}/extract-tables`,
      method: 'POST',
      label: 'Start Data Extraction'
    };
  } else if (currentStep === 3 && workflowSteps?.step3_extractData?.inProgress) {
    nextAction = {
      type: 'WAIT',
      label: 'Extracting Data...',
      polling: true,
      pollingInterval: 5000
    };
    canProceed = false;
    message = 'Data extraction in progress. Please wait...';
  } else if (currentStep === 4 && !workflowSteps?.step4_calculate?.completed && !workflowSteps?.step4_calculate?.inProgress) {
    nextAction = {
      type: 'CALCULATE',
      endpoint: `/api/v1/co/lohang/${lohangDraft._id}/continue`,
      method: 'POST',
      label: 'Start Calculation',
      description: 'Calculate Allocation & Generate Warnings'
    };
  } else if (currentStep === 4 && workflowSteps?.step4_calculate?.inProgress) {
    nextAction = {
      type: 'WAIT',
      label: 'Calculating...',
      polling: true,
      pollingInterval: 3000
    };
    canProceed = false;
    message = 'Calculation in progress. Please wait...';
  } else if (currentStep === 5 && !workflowSteps?.step5_generateReports?.completed && !workflowSteps?.step5_generateReports?.inProgress) {
    nextAction = {
      type: 'GENERATE_REPORTS',
      endpoint: `/api/v1/co/lohang/${lohangDraft._id}/continue`,
      method: 'POST',
      label: 'Generate Reports',
      description: 'Generate CTC Reports for all SKUs'
    };
  } else if (currentStep === 5 && workflowSteps?.step5_generateReports?.inProgress) {
    nextAction = {
      type: 'WAIT',
      label: 'Generating Reports...',
      polling: true,
      pollingInterval: 3000
    };
    canProceed = false;
    message = 'Report generation in progress. Please wait...';
  } else if (currentStep === 6) {
    nextAction = {
      type: 'REVIEW_RESULTS',
      endpoint: `/api/v1/co/lohang/${lohangDraft._id}/ctc-reports`,
      method: 'GET',
      label: 'Review CTC Reports'
    };
  } else if (currentStep === 7) {
    nextAction = {
      type: 'EXPORT_CO',
      endpoint: `/api/v1/co/lohang/${lohangDraft._id}/complete`,
      method: 'POST',
      label: 'Complete & Export C/O'
    };
  }

  return {
    currentStep,
    steps,
    nextAction,
    canProceed,
    message,
    status
  };
}

/**
 * BƯỚC 4: Tính toán Định mức Tiêu hao và Phân bổ FIFO
 * POST /api/v1/co/lohang/:id/calculate-consumption
 */
async function calculateConsumptionAndFifo(lohangDraftId) {
  const lohangDraft = await LohangDraft.findById(lohangDraftId).lean();
  if (!lohangDraft) {
    const err = new Error('Lô hàng không tồn tại');
    err.status = constants.HTTP_STATUS.NOT_FOUND;
    throw err;
  }

  console.log('=== BƯỚC 4: TÍNH TOÁN TIÊU HAO VÀ FIFO ===');

  // Lấy 3 bảng đã extract
  const productTable = await ExtractedProductTable.findOne({ lohangDraftId }).lean();
  const nplTable = await ExtractedNplTable.findOne({ lohangDraftId }).lean();
  const bomTable = await ExtractedBomTable.findOne({ lohangDraftId }).lean();

  if (!productTable || !nplTable || !bomTable) {
    throw new Error('Chưa có đủ dữ liệu 3 bảng. Vui lòng hoàn thành bước 3 trước.');
  }

  const exchangeRate = lohangDraft.exchangeRate || 24500;
  const errors = [];
  const warnings = [];

  // Xóa dữ liệu cũ (nếu có)
  await NplConsumptionDetail.deleteMany({ lohangDraftId });

  console.log('📊 Data loaded:', {
    products: productTable.products?.length || 0,
    materials: nplTable.materials?.length || 0,
    bomData: bomTable.bomData?.length || 0,
    bomSkus: bomTable.skuList?.length || 0,
    bomMaterials: bomTable.totalMaterials || 0
  });
  
  // Debug: Log tên NPL trong BOM
  console.log('\n🔍 NPL names in BOM:');
  (bomTable.bomData || []).slice(0, 5).forEach(bom => {
    console.log(`  - "${bom.nplName}"`);
  });
  
  // Debug: Log tên NPL trong VAT Invoice
  console.log('\n🔍 NPL names in VAT Invoice:');
  (nplTable.materials || []).slice(0, 5).forEach(npl => {
    console.log(`  - "${npl.tenHang}" (maNl: ${npl.maNl})`);
  });

  // ========================================
  // BƯỚC 4: TÍNH TOÁN TIÊU HAO VÀ PHÂN BỔ FIFO (GỘP 1 BẢNG)
  // ========================================
  console.log('\n📐 Step 4: Calculating consumption and FIFO allocation...');
  
  // Bước 1: Thu thập thông tin consumption cho mỗi SKU-NPL
  const consumptionMap = new Map(); // key: nplName, value: [{skuCode, quantityNeeded, ...}]

  for (const product of productTable.products || []) {
    const skuCode = product.skuCode;
    const quantitySku = product.quantity;
    const stt = product.stt;

    // Bây giờ BOM skuList đã chứa Product SKU codes (5022064, 5022065...)
    const bomSku = (bomTable.skuList || []).find(s => s.skuCode === skuCode);

    if (!bomSku) {
      warnings.push(`SKU ${skuCode} (STT ${stt}): Không tìm thấy trong BOM skuList`);
      console.log(`\n  ⚠️ SKU: ${skuCode} (STT ${stt}) - No BOM mapping`);
      continue;
    }

    console.log(`\n  📦 SKU: ${skuCode} (SL: ${quantitySku})`);

    for (const bomMaterial of bomTable.bomData || []) {
      const nplName = bomMaterial.nplName;
      const normPerSkuObj = bomMaterial.normPerSku;
      const normPerSku = normPerSkuObj?.[skuCode]; // Sử dụng Product SKU code trực tiếp
      
      if (!normPerSku || normPerSku === 0) continue;
      
      const totalQuantityNeeded = normPerSku * quantitySku;

      // Match NPL với VAT Invoice - Cải thiện logic matching
      let nplInfo = null;
      
      // 1. Thử match trực tiếp theo mã NPL
      if (bomMaterial.nplCode) {
        nplInfo = (nplTable.materials || []).find(m => 
          m.maNl && m.maNl.trim().toLowerCase() === bomMaterial.nplCode.trim().toLowerCase()
        );
      }
      
      // 2. Thử match theo tên hàng chính xác
      if (!nplInfo) {
        nplInfo = (nplTable.materials || []).find(m => 
          m.tenHang.trim().toLowerCase() === nplName.trim().toLowerCase()
        );
      }

      // 3. Thử match theo keywords (loại bỏ ký tự Trung Quốc và từ ngắn)
      if (!nplInfo) {
        const bomKeywords = nplName
          .replace(/\(.*?\)/g, '') // Loại bỏ nội dung trong ngoặc
          .replace(/[\u4e00-\u9fa5]/g, '') // Loại bỏ ký tự Trung Quốc
          .replace(/[^\w\s]/g, ' ') // Thay thế ký tự đặc biệt bằng space
          .trim()
          .toLowerCase()
          .split(/\s+/)
          .filter(w => w.length > 2); // Chỉ lấy từ dài hơn 2 ký tự

        if (bomKeywords.length > 0) {
          nplInfo = (nplTable.materials || []).find(m => {
            const vatName = m.tenHang.toLowerCase();
            return bomKeywords.some(keyword => vatName.includes(keyword));
          });
        }
      }
      
      // 4. Thử match theo một số mapping đặc biệt
      if (!nplInfo) {
        const specialMappings = {
          'ván mdf': ['ván mdf', 'mdf'],
          'gỗ thông': ['gỗ thông', 'thanh gỗ'],
          'gỗ cao su': ['gỗ cao su'],
          'ván ép': ['ván ép'],
          'tay nắm': ['tay nắm'],
          'bản lề': ['bản lề'],
          'thanh trượt': ['thanh trượt'],
          'vít': ['vít'],
          'cản nước': ['cản nước', 'thanh chắn nước'],
          'mặt đá': ['mặt đá nhân tạo'],
          'chậu': ['chậu rửa']
        };
        
        const nplNameLower = nplName.toLowerCase();
        for (const [key, patterns] of Object.entries(specialMappings)) {
          if (nplNameLower.includes(key)) {
            nplInfo = (nplTable.materials || []).find(m => {
              const vatName = m.tenHang.toLowerCase();
              return patterns.some(pattern => vatName.includes(pattern));
            });
            if (nplInfo) break;
          }
        }
      }

      if (!nplInfo) {
        console.log(`    ⚠️ NPL "${nplName}" không tìm thấy trong VAT Invoice`);
        warnings.push(`SKU ${skuCode} - NPL "${nplName}": Không tìm thấy trong VAT Invoice`);
        continue;
      }

      const key = nplInfo.tenHang.trim().toLowerCase();
      if (!consumptionMap.has(key)) {
        consumptionMap.set(key, []);
      }

      consumptionMap.get(key).push({
        skuCode,
        productName: product.productName,
        quantitySku,
        nplCode: bomMaterial.nplCode || nplInfo.maNl || '',
        nplName: nplInfo.tenHang,
        hsCodeNpl: bomMaterial.hsCode || nplInfo.hsCode || '',
        unit: bomMaterial.unit || nplInfo.donViTinh,
        normPerSku,
        totalQuantityNeeded
      });

      console.log(`    ✓ ${nplName}: ${totalQuantityNeeded.toFixed(4)} ${bomMaterial.unit || nplInfo.donViTinh}`);
    }
  }

  // Bước 2: Phân bổ FIFO và tạo records
  const detailRecords = [];
  let insufficientStockErrors = [];

  for (const [nplKey, consumptions] of consumptionMap) {
    const firstConsumption = consumptions[0];
    const nplName = firstConsumption.nplName;
    const totalNeeded = consumptions.reduce((sum, c) => sum + c.totalQuantityNeeded, 0);

    console.log(`\n  📦 NPL: ${nplName}`);
    console.log(`     Total needed: ${totalNeeded.toFixed(4)} ${firstConsumption.unit}`);

    // Lấy tồn kho FIFO
    const stockLots = (nplTable.materials || [])
      .filter(m => m.tenHang.trim().toLowerCase() === nplKey)
      .sort((a, b) => new Date(a.ngayHd) - new Date(b.ngayHd));

    if (stockLots.length === 0) {
      insufficientStockErrors.push(`NPL "${nplName}": Không tìm thấy trong tồn kho`);
      continue;
    }

    const totalStock = stockLots.reduce((sum, lot) => sum + (lot.soLuong || 0), 0);
    console.log(`     Total stock: ${totalStock.toFixed(4)} ${firstConsumption.unit}`);

    if (totalStock < totalNeeded) {
      insufficientStockErrors.push(
        `NPL "${nplName}": Không đủ tồn kho (Cần: ${totalNeeded.toFixed(4)}, Có: ${totalStock.toFixed(4)} ${firstConsumption.unit})`
      );
      continue;
    }

    // Phân bổ FIFO
    let remainingToAllocate = totalNeeded;
    let allocationOrder = 1;

    for (const lot of stockLots) {
      if (remainingToAllocate <= 0) break;

      const availableInLot = lot.soLuong || 0;
      const allocateQty = Math.min(remainingToAllocate, availableInLot);

      // Tạo detail record cho từng SKU
      for (const consumption of consumptions) {
        const ratio = consumption.totalQuantityNeeded / totalNeeded;
        const allocatedForThis = allocateQty * ratio;

        if (allocatedForThis <= 0) continue;

        const unitPriceVnd = lot.donGia || 0;
        const totalValueVnd = allocatedForThis * unitPriceVnd;
        const unitPriceUsd = unitPriceVnd / exchangeRate;
        const totalValueUsd = allocatedForThis * unitPriceUsd;

        // Tính toán các giá trị theo công thức
        const soLuong = allocatedForThis; // Số lượng phân bổ
        const donGiaVnd = lot.donGia || 0; // Đơn giá VND
        const thanhTienVnd = soLuong * donGiaVnd; // Thành tiền VND
        const tyGiaVndUsd = lot.tyGiaVndUsd || exchangeRate; // Tỷ giá
        const donGiaUsd = donGiaVnd / tyGiaVndUsd; // Đơn giá USD
        const soLuongLamCo = soLuong; // Số lượng làm CO (thường = số lượng)
        const dvtCo = consumption.unit; // DVT CO (cùng với đơn vị tính)
        const triGiaCifUsd = soLuongLamCo * donGiaUsd; // Trị giá CIF USD

        detailRecords.push({
          lohangDraftId,
          
          // Thông tin SKU (để group by)
          skuCode: consumption.skuCode,
          productName: consumption.productName,
          quantitySku: consumption.quantitySku,
          
          // 15 cột chính theo bảng yêu cầu:
          // 1. MÃ NL
          maNl: consumption.nplCode || lot.maNl || '',
          
          // 2. SỐ HĐ
          soHd: lot.soHd || '',
          
          // 3. NGÀY HĐ
          ngayHd: new Date(lot.ngayHd),
          
          // 4. TÊN HÀNG
          tenHang: consumption.nplName,
          
          // 5. ĐƠN VỊ TÍNH (ĐVT)
          donViTinh: consumption.unit,
          
          // 6. SỐ LƯỢNG
          soLuong: soLuong,
          
          // 7. ĐƠN GIÁ (VND)
          donGia: donGiaVnd,
          
          // 8. THÀNH TIỀN (VND)
          thanhTien: thanhTienVnd,
          
          // 9. TỶ GIÁ VND/USD
          tyGiaVndUsd: tyGiaVndUsd,
          
          // 10. ĐƠN GIÁ USD
          donGiaUsd: donGiaUsd,
          
          // 11. SỐ LƯỢNG LÀM CO
          soLuongLamCo: soLuongLamCo,
          
          // 12. ĐVT (CO)
          dvt: dvtCo,
          
          // 13. TRỊ GIÁ CIF (USD)
          triGiaCifUsd: triGiaCifUsd,
          
          // 14. HS CODE
          hsCode: consumption.hsCodeNpl || lot.hsCode || '',
          
          // 15. XUẤT XỨ
          xuatXu: lot.xuatXu || 'MUA VN KRXX',
          
          // Metadata bổ sung
          normPerSku: consumption.normPerSku,
          totalQuantityNeeded: consumption.totalQuantityNeeded,
          supplierName: lot.supplierName || '',
          allocationOrder,
          status: 'ALLOCATED'
        });
      }

      remainingToAllocate -= allocateQty;
      allocationOrder++;

      console.log(`     ✓ Allocated ${allocateQty.toFixed(4)} from invoice ${lot.soHd || ''} (${new Date(lot.ngayHd).toLocaleDateString()})`);
    }
  }

  // Lưu vào DB
  if (detailRecords.length > 0) {
    await NplConsumptionDetail.insertMany(detailRecords);
    console.log(`\n✅ Saved ${detailRecords.length} NPL consumption detail records`);
  }

  // ========================================
  // CẬP NHẬT TRẠNG THÁI LÔ HÀNG
  // ========================================
  
  if (insufficientStockErrors.length > 0) {
    // Có lỗi thiếu tồn kho - nhưng vẫn cho phép hoàn thành với warnings
    await LohangDraft.findByIdAndUpdate(lohangDraftId, {
      status: 'CALCULATED_WITH_WARNINGS',
      currentStep: 4,
      'workflowSteps.step4_calculate.completed': true,
      'workflowSteps.step4_calculate.completedAt': new Date(),
      'workflowSteps.step4_calculate.inProgress': false,
      'workflowSteps.step4_calculate.warnings': insufficientStockErrors,
      updatedAt: new Date()
    });

    console.log('\n⚠️ Calculation completed with insufficient stock warnings');
    
    return {
      success: true,
      status: 'INSUFFICIENT_STOCK',
      message: 'Không đủ tồn kho NPL',
      errors: insufficientStockErrors,
      warnings,
      totalDetails: detailRecords.length
    };
  }

  // ✅ Thành công
  await LohangDraft.findByIdAndUpdate(lohangDraftId, {
    status: 'CALCULATED',
    currentStep: 4,
    'workflowSteps.step4_calculate.completed': true,
    'workflowSteps.step4_calculate.completedAt': new Date(),
    'workflowSteps.step4_calculate.inProgress': false,
    updatedAt: new Date()
  });

  console.log('\n✅ Calculation completed successfully!');

  return {
    success: true,
    status: 'SUCCESS',
    message: 'Tính toán tiêu hao và phân bổ FIFO thành công',
    warnings,
    totalDetails: detailRecords.length,
    summary: {
      totalSkus: productTable.products?.length || 0,
      totalNplTypes: consumptionMap.size,
      totalDetailRecords: detailRecords.length
    }
  };
}


async function listCOBCT(userId, query) {
  const { status, invoiceNo, formType, page = 1, limit = 20 } = query;
  
  const filter = {};
  if (status) filter.status = status;
  if (invoiceNo) filter.invoiceNo = { $regex: invoiceNo, $options: 'i' };
  if (formType) filter.formType = formType;

  const skip = (page - 1) * limit;
  
  const [coList, total] = await Promise.all([
    LohangDraft.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('linkedDocuments', 'fileName documentType')
      .lean(),
    LohangDraft.countDocuments(filter)
  ]);

  const BundleClass = require('../models/bundle.model');
  const Bundle = buildModelFromClass(BundleClass);
  
  for (const co of coList) {
    if (co.linkedDocuments && co.linkedDocuments.length > 0) {
      const firstDoc = await Document.findById(co.linkedDocuments[0]._id).lean();
      if (firstDoc && firstDoc.bundleId) {
        const bundle = await Bundle.findById(firstDoc.bundleId).lean();
        co.bundleName = bundle?.bundleName || 'N/A';
        co.bundleId = firstDoc.bundleId;
      }
    }
    
    co.statusText = constants.CO_STEP_VI[co.currentStep] || `Step ${co.currentStep}`;
  }

  return {
    coList,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / limit)
    }
  };
}


module.exports = {
  getLohangDetail,
  listCO,
  getSupportedCombinations,
  updateDocument,
  deleteDocument,
  createCOFromBundle,
  retryExtraction,
  reExtractTable,
  setupFormAndCriteria,
  continueToNextStep,
  setupAndExtract,
  triggerExtractTables,
  calculateConsumptionAndFifo,
  getWorkflowInfo,
  listCOBCT
};
