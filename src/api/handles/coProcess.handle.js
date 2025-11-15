const mongoose = require('mongoose');
const constants = require('../../core/utils/constants');
const { getGeminiService } = require('../../core/utils/gemini.utils');
const { getDataExtractorService } = require('../../core/utils/dataExtractor.utils');
const { getBomExcelParser } = require('../../core/utils/bomExcelParser.utils');

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

async function getLohangDetail(lohangDraftId) {
  const lohangDraft = await LohangDraft.findById(lohangDraftId).lean();
  if (!lohangDraft) {
    const err = new Error('Lô hàng không tồn tại');
    err.status = constants.HTTP_STATUS.NOT_FOUND;
    throw err;
  }

  const workflowInfo = getWorkflowInfo(lohangDraft);

  return {
    lohangDraft,
    workflow: workflowInfo
  };
}

async function listCO(userId, query) {
  const { 
    status, 
    invoiceNo, 
    formType, 
    exportDeclarationNo,
    fromDate,
    toDate,
    page = 1, 
    limit = 20 
  } = query;
  
  const filter = {};
  if (status) filter.status = status;
  if (invoiceNo) filter.invoiceNo = { $regex: invoiceNo, $options: 'i' };
  if (formType) filter.formType = formType;
  if (exportDeclarationNo) filter.exportDeclarationNo = { $regex: exportDeclarationNo, $options: 'i' };
  
  // Search theo ngày hóa đơn (invoiceDate)
  if (fromDate || toDate) {
    filter.invoiceDate = {};
    if (fromDate) {
      const from = new Date(fromDate);
      from.setHours(0, 0, 0, 0);
      filter.invoiceDate.$gte = from;
    }
    if (toDate) {
      const to = new Date(toDate);
      to.setHours(23, 59, 59, 999);
      filter.invoiceDate.$lte = to;
    }
  }

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
    
    // Thêm thông tin chi tiết để trả về
    co.statusText = constants.CO_STEP_VI[co.currentStep] || `Step ${co.currentStep}`;
    co.invoiceNo = co.invoiceNo || 'N/A';
    co.exportDeclarationNo = co.exportDeclarationNo || 'N/A';
    co.invoiceDate = co.invoiceDate ? new Date(co.invoiceDate).toLocaleDateString('vi-VN') : 'N/A';
    co.formType = co.formType || 'N/A';
    co.criterionType = co.criterionType || 'N/A';
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

async function createCOFromBundle(userId, payload) {
  const { bundleId } = payload;
  
  if (!bundleId) {
    const err = new Error('bundleId là bắt buộc');
    err.status = constants.HTTP_STATUS.BAD_REQUEST;
    throw err;
  }

  const BundleClass = require('../models/bundle.model');
  const Bundle = buildModelFromClass(BundleClass);
  
  const bundle = await Bundle.findById(bundleId).lean();
  if (!bundle) {
    const err = new Error('Bundle không tồn tại');
    err.status = constants.HTTP_STATUS.NOT_FOUND;
    throw err;
  }

  if (bundle.status !== 'OCR_COMPLETED' && bundle.status !== 'APPROVED') {
    const err = new Error('Bundle chưa hoàn thành OCR');
    err.status = constants.HTTP_STATUS.BAD_REQUEST;
    throw err;
  }

  const documents = await Document.find({ bundleId }).lean();
  
  if (!documents || documents.length === 0) {
    const err = new Error('Bundle không có chứng từ nào');
    err.status = constants.HTTP_STATUS.BAD_REQUEST;
    throw err;
  }

  const invoiceDoc = documents.find(d => 
    d.documentType === 'COMMERCIAL_INVOICE' || 
    d.documentType === 'INVOICE'
  );

  const exportDeclarationDoc = documents.find(d => 
    d.documentType === 'EXPORT_DECLARATION'
  );

  // Extract invoiceNo
  let invoiceNo = 'DRAFT-' + Date.now();
  let invoiceDate = null;
  if (invoiceDoc && invoiceDoc.ocrResult) {
    const invoiceMatch = invoiceDoc.ocrResult.match(/Invoice\s*No[.:]?\s*([A-Z0-9-]+)/i);
    if (invoiceMatch) {
      invoiceNo = invoiceMatch[1];
    }
    
    // Extract invoiceDate (try multiple patterns)
    const datePatterns = [
      /Date[.:]?\s*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i,
      /(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/,
      /Invoice\s*Date[.:]?\s*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i
    ];
    
    for (const pattern of datePatterns) {
      const dateMatch = invoiceDoc.ocrResult.match(pattern);
      if (dateMatch) {
        try {
          invoiceDate = new Date(dateMatch[1]);
          if (!isNaN(invoiceDate.getTime())) break;
        } catch (e) {
          // Continue to next pattern
        }
      }
    }
  }

  // Extract exportDeclarationNo
  let exportDeclarationNo = null;
  if (exportDeclarationDoc && exportDeclarationDoc.ocrResult) {
    console.log('=== DEBUG EXPORT DECLARATION ===');
    console.log('OCR Result length:', exportDeclarationDoc.ocrResult.length);
    console.log('OCR Result preview:', exportDeclarationDoc.ocrResult.substring(0, 500));
    
    const declarationPatterns = [
      /Số\s*khai\s*xuất\s*khẩu[.:]?\s*([A-Z0-9\-\/]+)/i,
      /Export\s*Declaration\s*No[.:]?\s*([A-Z0-9\-\/]+)/i,
      /Khai\s*xuất\s*khẩu[.:]?\s*([A-Z0-9\-\/]+)/i,
      /khai\s*xuất[.:]?\s*([A-Z0-9\-\/]+)/i,
      /declaration[.:]?\s*([A-Z0-9\-\/]+)/i,
      /([A-Z0-9]{2,}[-\/]\d{4,})/
    ];
    
    for (let i = 0; i < declarationPatterns.length; i++) {
      const pattern = declarationPatterns[i];
      const declMatch = exportDeclarationDoc.ocrResult.match(pattern);
      console.log(`Pattern ${i}:`, pattern, '=> Match:', declMatch ? declMatch[1] : 'NO MATCH');
      if (declMatch) {
        exportDeclarationNo = declMatch[1];
        console.log('Found exportDeclarationNo:', exportDeclarationNo);
        break;
      }
    }
  } else {
    console.log('=== NO EXPORT DECLARATION DOC ===');
    console.log('exportDeclarationDoc:', exportDeclarationDoc);
  }

  const lohangDraft = await LohangDraft.create({
    companyId: bundle.companyId,
    staffUser: userId,
    status: 'DRAFT',
    currentStep: 1, 
    invoiceNo,
    invoiceDate,
    exportDeclarationNo,
    linkedDocuments: documents.map(d => d._id),
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

  await LohangDraft.findByIdAndUpdate(lohangDraftId, {
    formType,
    criterionType,
    status: 'SETUP_COMPLETED',
    currentStep: 3, 
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

async function continueToNextStep(lohangDraftId, payload = {}) {
  const lohangDraft = await LohangDraft.findById(lohangDraftId).lean();
  if (!lohangDraft) {
    const err = new Error('Lô hàng không tồn tại');
    err.status = constants.HTTP_STATUS.NOT_FOUND;
    throw err;
  }

  const currentStep = lohangDraft.currentStep || 1;
  
  let nextStep = currentStep;
  let updates = { updatedAt: new Date() };

  if (currentStep === 1) {
    nextStep = 2;
    updates.currentStep = 2;
    updates['workflowSteps.step1_uploadDocuments.completed'] = true;
    updates['workflowSteps.step1_uploadDocuments.completedAt'] = new Date();
  } else if (currentStep === 2) {
    const { formType, criterionType } = payload;
    
    if (!formType || !criterionType) {
      const err = new Error('Thiếu thông tin Form hoặc Tiêu chí');
      err.status = constants.HTTP_STATUS.BAD_REQUEST;
      throw err;
    }
    
    if (formType !== 'FORM_E' || criterionType !== 'CTH') {
      const err = new Error(`Combination ${formType} + ${criterionType} chưa được phát triển. Hiện tại chỉ hỗ trợ FORM_E + CTH.`);
      err.status = constants.HTTP_STATUS.BAD_REQUEST;
      throw err;
    }

    await ExtractedProductTable.deleteMany({ lohangDraftId });
    await ExtractedNplTable.deleteMany({ lohangDraftId });
    await ExtractedBomTable.deleteMany({ lohangDraftId });

    nextStep = 3;
    updates.currentStep = 3;
    updates.status = 'EXTRACTING';
    updates.formType = formType;
    updates.criterionType = criterionType;
    updates['workflowSteps.step2_selectFormAndCriteria.completed'] = true;
    updates['workflowSteps.step2_selectFormAndCriteria.completedAt'] = new Date();
    updates['workflowSteps.step3_extractData.inProgress'] = true;

    await LohangDraft.findByIdAndUpdate(lohangDraftId, updates);


    try {
      const extractResult = await extractDataFromDocuments(lohangDraftId);
      
      const updated = await LohangDraft.findById(lohangDraftId).lean();
      const workflowInfo = getWorkflowInfo(updated);

      const productTable = await ExtractedProductTable.findOne({ lohangDraftId }).lean();
      const nplTable = await ExtractedNplTable.findOne({ lohangDraftId }).lean();
      const bomTable = await ExtractedBomTable.findOne({ lohangDraftId }).lean();

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
    const { tables, reExtract } = payload;
    
    if (reExtract) {      
      await ExtractedProductTable.deleteMany({ lohangDraftId });
      await ExtractedNplTable.deleteMany({ lohangDraftId });
      await ExtractedBomTable.deleteMany({ lohangDraftId });      
      await triggerExtractTables(lohangDraftId);
    } else if (tables) {
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
    }

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
    updates['workflowSteps.step4_calculate.inProgress'] = true; 

    await LohangDraft.findByIdAndUpdate(lohangDraftId, updates);
        
    await NplConsumptionDetail.deleteMany({ lohangDraftId });
    
    try {
      const calculationResult = await calculateConsumptionAndFifo(lohangDraftId);
      
      if (!calculationResult.success) {
        throw new Error(calculationResult.message);
      }
      
      await LohangDraft.findByIdAndUpdate(lohangDraftId, {
        status: 'CALCULATED_WITH_WARNINGS',
        'workflowSteps.step4_calculate.completed': true,
        'workflowSteps.step4_calculate.completedAt': new Date(),
        'workflowSteps.step4_calculate.inProgress': false
      });
      
      const updated = await LohangDraft.findById(lohangDraftId).lean();
      const workflowInfo = getWorkflowInfo(updated);
      
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
    
    if (reCalculate) {      
      await NplConsumptionDetail.deleteMany({ lohangDraftId });
      
      await LohangDraft.findByIdAndUpdate(lohangDraftId, {
        'workflowSteps.step4_calculate.inProgress': true,
        updatedAt: new Date()
      });
      
      try {
        const calcResult = await calculateConsumptionAndFifo(lohangDraftId);
        
        const updated = await LohangDraft.findById(lohangDraftId).lean();
        const workflowInfo = getWorkflowInfo(updated);
        
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
      
      await LohangDraft.findByIdAndUpdate(lohangDraftId, {
        'workflowSteps.step4_calculate.inProgress': true,
        updatedAt: new Date()
      });
      
      try {
        const calcResult = await calculateConsumptionAndFifo(lohangDraftId);
        
        const updated = await LohangDraft.findById(lohangDraftId).lean();
        const workflowInfo = getWorkflowInfo(updated);
        
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
    
    
    const lohangDraft = await LohangDraft.findById(lohangDraftId).lean();
    
    await LohangDraft.findByIdAndUpdate(lohangDraftId, { ctcReports: [] });
    
    let ctcReportsResult = null;
    
    const supportedCriteria = ['CTC', 'CTH', 'CTSH', 'RVC40', 'RVC50', 'WO', 'PE'];
    try {
        const ReportGeneratorService = require('../../core/services/ReportGenerator.service');
        const reportService = new ReportGeneratorService();
        ctcReportsResult = await reportService.generateReports(lohangDraftId);
        
      } catch (reportError) {
        console.error('❌ Report generation failed:', reportError);
        throw new Error(`Lỗi tạo bảng kê ${lohangDraft.criterionType}: ${reportError.message}`);
      }
    
    await LohangDraft.findByIdAndUpdate(lohangDraftId, {
      'workflowSteps.step4_calculate.completed': true,
      'workflowSteps.step4_calculate.completedAt': new Date(),
      'workflowSteps.step4_calculate.inProgress': false,
      'workflowSteps.step5_generateReports.inProgress': true,
      currentStep: 5, 
      updatedAt: new Date()
    });
    
    const updated = await LohangDraft.findById(lohangDraftId).lean();
    const workflowInfo = getWorkflowInfo(updated);
    
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
    
    if (reGenerateReports) {
      
      await LohangDraft.findByIdAndUpdate(lohangDraftId, { ctcReports: [] });
      
      const lohangDraftForReGen = await LohangDraft.findById(lohangDraftId).lean();
      
      let ctcReportsResult = null;
      const supportedCriteria = ['CTC', 'CTH', 'CTSH', 'RVC40', 'RVC50', 'WO', 'PE'];
      
      if (supportedCriteria.includes(lohangDraftForReGen.criterionType)) {
        
        try {
          const ReportGeneratorService = require('../../core/services/ReportGenerator.service');
          const reportService = new ReportGeneratorService();
          ctcReportsResult = await reportService.generateReports(lohangDraftId);
          
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
      
      await LohangDraft.findByIdAndUpdate(lohangDraftId, {
        'workflowSteps.step5_generateReports.completed': true,
        'workflowSteps.step5_generateReports.completedAt': new Date(),
        'workflowSteps.step5_generateReports.inProgress': false,
        currentStep: 6,
        status: 'REPORTS_GENERATED',
        updatedAt: new Date()
      });
            
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
    console.error(`❌ Cannot continue from step ${currentStep}`);
    console.error('LohangDraft status:', lohangDraft.status);
    console.error('WorkflowSteps:', JSON.stringify(lohangDraft.workflowSteps, null, 2));
    
    const err = new Error(`Không thể continue từ bước ${currentStep}. Lô hàng đang ở trạng thái: ${lohangDraft.status}`);
    err.status = constants.HTTP_STATUS.BAD_REQUEST;
    throw err;
  }

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

  if (lohangDraft.workflowSteps?.step3_extractData?.inProgress) {
    const err = new Error('Đang trích xuất dữ liệu, vui lòng đợi');
    err.status = constants.HTTP_STATUS.TOO_MANY_REQUESTS;
    throw err;
  }

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

async function triggerExtractTables(lohangDraftId) {
  const lohangDraft = await LohangDraft.findById(lohangDraftId).lean();
  if (!lohangDraft) {
    const err = new Error('Lô hàng không tồn tại');
    err.status = constants.HTTP_STATUS.NOT_FOUND;
    throw err;
  }

  if (!lohangDraft.formType || !lohangDraft.exchangeRate || !lohangDraft.criterionType) {
    const err = new Error('Vui lòng chọn Form và Tiêu chí trước (Bước 2)');
    err.status = constants.HTTP_STATUS.BAD_REQUEST;
    throw err;
  }

  if (lohangDraft.workflowSteps?.step3_extractData?.inProgress) {
    const err = new Error('Đang trích xuất dữ liệu, vui lòng đợi');
    err.status = constants.HTTP_STATUS.TOO_MANY_REQUESTS;
    throw err;
  }

  await LohangDraft.findByIdAndUpdate(lohangDraftId, {
    status: 'DATA_EXTRACTING',
    'workflowSteps.step3_extractData.inProgress': true,
    updatedAt: new Date()
  });

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

async function extractDataFromDocuments(lohangDraftId) {
  const errors = [];
  let currentStep = '';

  try {
    const lohangDraft = await LohangDraft.findById(lohangDraftId).lean();
    if (!lohangDraft) return;

    let bundleId = lohangDraft.linkedDocuments?.[0] 
      ? (await Document.findById(lohangDraft.linkedDocuments[0]).lean())?.bundleId
      : null;

    let documents = [];
    
    if (bundleId) {
      documents = await Document.find({ bundleId: bundleId }).lean();
    } else {
      documents = await Document.find({
        _id: { $in: lohangDraft.linkedDocuments }
      }).lean();
      
      const firstDoc = documents[0];
      bundleId = firstDoc?.bundleId;
    }

    const extractor = getDataExtractorService();
    const BundleClass = require('../models/bundle.model');
    const Bundle = buildModelFromClass(BundleClass);

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

    let parsedBomData = null;
    let bomExcelUrl = null;
    
    if (bomDocs.length > 0) {
      const bomDoc = bomDocs[0];
      bomExcelUrl = bomDoc.storagePath;
      
      if (bomExcelUrl && (bomExcelUrl.endsWith('.xlsx') || bomExcelUrl.endsWith('.xls'))) {
        try {
          currentStep = 'PARSE_BOM_EXCEL';
          
          const bomParser = getBomExcelParser();
          parsedBomData = await bomParser.parseBomExcel(bomExcelUrl);
          
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

    if (invoiceDoc) {
      try {
        currentStep = 'EXTRACT_PRODUCT_TABLE';
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

      } catch (error) {
        console.error('Extract product table error:', error);
        errors.push({
          step: 'EXTRACT_PRODUCT_TABLE',
          error: error.message,
          details: error.stack
        });
      }
    }

    if (vatInvoiceDocs.length > 0) {
      try {
        currentStep = 'EXTRACT_NPL_TABLE';
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

      } catch (error) {
        console.error('Extract NPL table error:', error);
        errors.push({
          step: 'EXTRACT_NPL_TABLE',
          error: error.message,
          details: error.stack
        });
      }
    }

    if (bomDocs.length > 0) {
      try {
        currentStep = 'EXTRACT_BOM_TABLE';
        
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
            
            const bomParser = getBomExcelParser();
            bomTableData = bomParser.transformToBomTable(parsedBomData, skuList);
            bomTableData.bomExcelUrl = bomExcelUrl;
            bomTableData.aiModel = 'EXCEL_UPLOAD';
            bomTableData.aiConfidence = 100;
            
          } else {
            bomTableData = await extractor.extractBomTable(bomDocs, skuList);
          }

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

    const productTable = await ExtractedProductTable.findOne({ lohangDraftId: lohangDraft._id }).lean();
    const skuCount = productTable?.products?.length || 0;
    
    if (errors.length > 0) {
      await LohangDraft.findByIdAndUpdate(lohangDraftId, {
        totalSkuCount: skuCount,
        status: 'EXTRACTION_FAILED',
        extractionErrors: errors,
        'workflowSteps.step3_extractData.inProgress': false,
        updatedAt: new Date()
      });
    } else {
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
      
    }

  } catch (error) {
    console.error('Extract data error:', error);
    
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

  const failedTables = (lohangDraft.extractionErrors || [])
    .map(e => e.step)
    .filter(step => ['EXTRACT_PRODUCT_TABLE', 'EXTRACT_NPL_TABLE', 'EXTRACT_BOM_TABLE'].includes(step));

  if (failedTables.length === 0) {
    const err = new Error('Không tìm thấy bảng nào bị lỗi để retry');
    err.status = constants.HTTP_STATUS.BAD_REQUEST;
    throw err;
  }


  await LohangDraft.findByIdAndUpdate(lohangDraftId, {
    status: 'DATA_EXTRACTING',
    extractionErrors: [],
    updatedAt: new Date()
  });

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

    if (failedTables.includes('EXTRACT_PRODUCT_TABLE')) {
      try {
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

      } catch (error) {
        console.error('Retry PRODUCT table error:', error);
        errors.push({
          step: 'EXTRACT_PRODUCT_TABLE',
          error: error.message,
          details: error.stack
        });
      }
    }

    if (failedTables.includes('EXTRACT_NPL_TABLE')) {
      try {
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

      } catch (error) {
        console.error('Retry NPL table error:', error);
        errors.push({
          step: 'EXTRACT_NPL_TABLE',
          error: error.message,
          details: error.stack
        });
      }
    }

    if (failedTables.includes('EXTRACT_BOM_TABLE')) {
      try {
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

      } catch (error) {
        console.error('Retry BOM table error:', error);
        errors.push({
          step: 'EXTRACT_BOM_TABLE',
          error: error.message,
          details: error.stack
        });
      }
    }

    const productTable = await ExtractedProductTable.findOne({ lohangDraftId: lohangDraft._id }).lean();
    const skuCount = productTable?.products?.length || 0;
    
    if (errors.length > 0) {
      await LohangDraft.findByIdAndUpdate(lohangDraftId, {
        totalSkuCount: skuCount,
        status: 'EXTRACTION_FAILED',
        extractionErrors: errors,
        'workflowSteps.step3_extractData.inProgress': false,
        updatedAt: new Date()
      });
    } else {
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

  try {
    if (tableType === 'PRODUCT') {
      const invoiceDoc = documents.find(d => d.documentType === 'COMMERCIAL_INVOICE');
      const declarationDoc = documents.find(d => d.documentType === 'EXPORT_DECLARATION');

      if (!invoiceDoc) {
        throw new Error('Không tìm thấy Commercial Invoice');
      }

      const productTableData = await extractor.extractProductTable(
        invoiceDoc,
        declarationDoc,
        lohangDraft.exchangeRate,
        userNote 
      );

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
      const vatInvoiceDocs = documents.filter(d => d.documentType === 'VAT_INVOICE');

      if (vatInvoiceDocs.length === 0) {
        throw new Error('Không tìm thấy VAT Invoice');
      }

      const nplTableData = await extractor.extractNplTable(vatInvoiceDocs, userNote);

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

async function calculateConsumptionAndFifo(lohangDraftId) {
  const lohangDraft = await LohangDraft.findById(lohangDraftId).lean();
  if (!lohangDraft) {
    const err = new Error('Lô hàng không tồn tại');
    err.status = constants.HTTP_STATUS.NOT_FOUND;
    throw err;
  }

  const productTable = await ExtractedProductTable.findOne({ lohangDraftId }).lean();
  const nplTable = await ExtractedNplTable.findOne({ lohangDraftId }).lean();
  const bomTable = await ExtractedBomTable.findOne({ lohangDraftId }).lean();

  if (!productTable || !nplTable || !bomTable) {
    throw new Error('Chưa có đủ dữ liệu 3 bảng. Vui lòng hoàn thành bước 3 trước.');
  }

  const exchangeRate = lohangDraft.exchangeRate || 24500;
  const errors = [];
  const warnings = [];

  await NplConsumptionDetail.deleteMany({ lohangDraftId });

  const consumptionMap = new Map(); 

  for (const product of productTable.products || []) {
    const skuCode = product.skuCode;
    const quantitySku = product.quantity;
    const stt = product.stt;

    const bomSku = (bomTable.skuList || []).find(s => s.skuCode === skuCode);

    if (!bomSku) {
      warnings.push(`SKU ${skuCode} (STT ${stt}): Không tìm thấy trong BOM skuList`);
      continue;
    }

    for (const bomMaterial of bomTable.bomData || []) {
      const nplName = bomMaterial.nplName;
      const normPerSkuObj = bomMaterial.normPerSku;
      const normPerSku = normPerSkuObj?.[skuCode]; 
      if (!normPerSku || normPerSku === 0) continue;
      
      const totalQuantityNeeded = normPerSku * quantitySku;

      let nplInfo = null;
      
      if (bomMaterial.nplCode) {
        nplInfo = (nplTable.materials || []).find(m => 
          m.maNl && m.maNl.trim().toLowerCase() === bomMaterial.nplCode.trim().toLowerCase()
        );
      }
      
      if (!nplInfo) {
        nplInfo = (nplTable.materials || []).find(m => 
          m.tenHang.trim().toLowerCase() === nplName.trim().toLowerCase()
        );
      }

      if (!nplInfo) {
        const bomKeywords = nplName
          .replace(/\(.*?\)/g, '') 
          .replace(/[\u4e00-\u9fa5]/g, '') 
          .replace(/[^\w\s]/g, ' ') 
          .trim()
          .toLowerCase()
          .split(/\s+/)
          .filter(w => w.length > 2); 

        if (bomKeywords.length > 0) {
          nplInfo = (nplTable.materials || []).find(m => {
            const vatName = m.tenHang.toLowerCase();
            return bomKeywords.some(keyword => vatName.includes(keyword));
          });
        }
      }
      
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
    }
  }

  const detailRecords = [];
  let insufficientStockErrors = [];

  for (const [nplKey, consumptions] of consumptionMap) {
    const firstConsumption = consumptions[0];
    const nplName = firstConsumption.nplName;
    const totalNeeded = consumptions.reduce((sum, c) => sum + c.totalQuantityNeeded, 0);

    const stockLots = (nplTable.materials || [])
      .filter(m => m.tenHang.trim().toLowerCase() === nplKey)
      .sort((a, b) => new Date(a.ngayHd) - new Date(b.ngayHd));

    if (stockLots.length === 0) {
      insufficientStockErrors.push(`NPL "${nplName}": Không tìm thấy trong tồn kho`);
      continue;
    }

    const totalStock = stockLots.reduce((sum, lot) => sum + (lot.soLuong || 0), 0);

    if (totalStock < totalNeeded) {
      insufficientStockErrors.push(
        `NPL "${nplName}": Không đủ tồn kho (Cần: ${totalNeeded.toFixed(4)}, Có: ${totalStock.toFixed(4)} ${firstConsumption.unit})`
      );
      continue;
    }

    let remainingToAllocate = totalNeeded;
    let allocationOrder = 1;

    for (const lot of stockLots) {
      if (remainingToAllocate <= 0) break;

      const availableInLot = lot.soLuong || 0;
      const allocateQty = Math.min(remainingToAllocate, availableInLot);

      for (const consumption of consumptions) {
        const ratio = consumption.totalQuantityNeeded / totalNeeded;
        const allocatedForThis = allocateQty * ratio;

        if (allocatedForThis <= 0) continue;

        const unitPriceVnd = lot.donGia || 0;
        const totalValueVnd = allocatedForThis * unitPriceVnd;
        const unitPriceUsd = unitPriceVnd / exchangeRate;
        const totalValueUsd = allocatedForThis * unitPriceUsd;

        const soLuong = allocatedForThis; 
        const donGiaVnd = lot.donGia || 0; 
        const thanhTienVnd = soLuong * donGiaVnd; 
        const tyGiaVndUsd = lot.tyGiaVndUsd || exchangeRate; 
        const donGiaUsd = donGiaVnd / tyGiaVndUsd;
        const soLuongLamCo = soLuong; 
        const dvtCo = consumption.unit; 
        const triGiaCifUsd = soLuongLamCo * donGiaUsd; 

        detailRecords.push({
          lohangDraftId,
          skuCode: consumption.skuCode,
          productName: consumption.productName,
          quantitySku: consumption.quantitySku,
          maNl: consumption.nplCode || lot.maNl || '',
          soHd: lot.soHd || '',
          ngayHd: new Date(lot.ngayHd),
          tenHang: consumption.nplName,
          donViTinh: consumption.unit,
          soLuong: soLuong,
          donGia: donGiaVnd,
          thanhTien: thanhTienVnd,
          tyGiaVndUsd: tyGiaVndUsd,
          donGiaUsd: donGiaUsd,
          soLuongLamCo: soLuongLamCo,
          dvt: dvtCo,
          triGiaCifUsd: triGiaCifUsd,
          hsCode: consumption.hsCodeNpl || lot.hsCode || '',
          xuatXu: lot.xuatXu || 'MUA VN KRXX',
          normPerSku: consumption.normPerSku,
          totalQuantityNeeded: consumption.totalQuantityNeeded,
          supplierName: lot.supplierName || '',
          allocationOrder,
          status: 'ALLOCATED'
        });
      }

      remainingToAllocate -= allocateQty;
      allocationOrder++;
    }
  }

  if (detailRecords.length > 0) {
    await NplConsumptionDetail.insertMany(detailRecords);
  }


  if (insufficientStockErrors.length > 0) {
    await LohangDraft.findByIdAndUpdate(lohangDraftId, {
      status: 'CALCULATED_WITH_WARNINGS',
      currentStep: 4,
      'workflowSteps.step4_calculate.completed': true,
      'workflowSteps.step4_calculate.completedAt': new Date(),
      'workflowSteps.step4_calculate.inProgress': false,
      'workflowSteps.step4_calculate.warnings': insufficientStockErrors,
      updatedAt: new Date()
    });

    
    return {
      success: true,
      status: 'INSUFFICIENT_STOCK',
      message: 'Không đủ tồn kho NPL',
      errors: insufficientStockErrors,
      warnings,
      totalDetails: detailRecords.length
    };
  }

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
