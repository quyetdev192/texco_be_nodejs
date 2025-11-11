const mongoose = require('mongoose');
const constants = require('../../core/utils/constants');
const { getGeminiService } = require('../../core/utils/gemini.utils');
const { getDataExtractorService } = require('../../core/utils/dataExtractor.utils');

// Import models
const LohangDraftClass = require('../models/lohangDraft.model');
const SkuDraftClass = require('../models/skuDraft.model');
const TonKhoDetailClass = require('../models/tonKhoDetail.model');
const SuDungDinhMucClass = require('../models/suDungDinhMuc.model');
const PhanBoXuatClass = require('../models/phanBoXuat.model');
const SkuResultClass = require('../models/skuResult.model');
const DocumentClass = require('../models/document.model');
const RawBomDataClass = require('../models/rawBomData.model');
const ExtractedProductTableClass = require('../models/extractedProductTable.model');
const ExtractedNplTableClass = require('../models/extractedNplTable.model');
const ExtractedBomTableClass = require('../models/extractedBomTable.model');

function buildModelFromClass(modelClass) {
  const modelName = modelClass.name;
  if (mongoose.models[modelName]) return mongoose.models[modelName];
  const schemaDefinition = modelClass.getSchema();
  const schema = new mongoose.Schema(schemaDefinition, { collection: modelClass.collection });
  return mongoose.model(modelName, schema);
}

const LohangDraft = buildModelFromClass(LohangDraftClass);
const SkuDraft = buildModelFromClass(SkuDraftClass);
const TonKhoDetail = buildModelFromClass(TonKhoDetailClass);
const SuDungDinhMuc = buildModelFromClass(SuDungDinhMucClass);
const PhanBoXuat = buildModelFromClass(PhanBoXuatClass);
const SkuResult = buildModelFromClass(SkuResultClass);
const Document = buildModelFromClass(DocumentClass);
const RawBomData = buildModelFromClass(RawBomDataClass);
const ExtractedProductTable = buildModelFromClass(ExtractedProductTableClass);
const ExtractedNplTable = buildModelFromClass(ExtractedNplTableClass);
const ExtractedBomTable = buildModelFromClass(ExtractedBomTableClass);

/**
 * GIAI ĐOẠN 1: Upload và trích xuất dữ liệu thô
 * POST /upload/documents
 */
async function uploadDocuments(userId, payload) {
  const { documentIds, documentType } = payload;
  
  if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
    const err = new Error('Danh sách documentIds không hợp lệ');
    err.status = constants.HTTP_STATUS.BAD_REQUEST;
    throw err;
  }

  const gemini = getGeminiService();
  const results = [];

  for (const docId of documentIds) {
    try {
      // Lấy document và OCR text
      const doc = await Document.findById(docId).lean();
      if (!doc) {
        results.push({ documentId: docId, success: false, error: 'Document không tồn tại' });
        continue;
      }

      if (!doc.ocrData || !doc.ocrData.fullText) {
        results.push({ documentId: docId, success: false, error: 'Chưa có dữ liệu OCR' });
        continue;
      }

      // Trích xuất dữ liệu bằng Gemini
      const extractedData = await gemini.extractStructuredData(doc.ocrData.fullText, documentType);
      
      // Lưu vào collection tương ứng
      if (documentType === 'INVOICE') {
        // Lưu vào RawInvoiceData hoặc xử lý trực tiếp
        results.push({ documentId: docId, success: true, data: extractedData });
      } else if (documentType === 'TKNK' || documentType === 'HDVAT_NPL') {
        // Lưu vào TonKhoDetail
        await saveToInventory(extractedData, docId, userId);
        results.push({ documentId: docId, success: true, message: 'Đã lưu vào tồn kho' });
      } else if (documentType === 'BOM') {
        // Lưu vào RawBomData
        await saveBomData(extractedData, docId);
        results.push({ documentId: docId, success: true, message: 'Đã lưu BOM' });
      }
    } catch (error) {
      results.push({ documentId: docId, success: false, error: error.message });
    }
  }

  return { results };
}

/**
 * Lưu dữ liệu NPL vào tồn kho
 */
async function saveToInventory(extractedData, documentId, userId) {
  const { invoiceNo, invoiceDate, supplierName, materials } = extractedData;
  
  // Lấy companyId từ user
  const doc = await Document.findById(documentId).populate('uploadedBy').lean();
  const companyId = doc?.uploadedBy?.companyId;

  if (!companyId) {
    throw new Error('Không xác định được companyId');
  }

  const inventoryItems = materials.map(m => ({
    companyId,
    nplCode: m.materialCode,
    nplName: m.materialName,
    hsCodeNpl: m.hsCode,
    unit: m.unit,
    invoiceRef: invoiceNo,
    invoiceDate: new Date(invoiceDate),
    supplierName: supplierName || '',
    unitPriceCifUsd: m.unitPriceCIF,
    quantityImported: m.quantity,
    quantityAvailable: m.quantity,
    originCountry: m.originCountry || 'Không rõ',
    hasCo: false,
    coNumber: '',
    status: 'AVAILABLE',
    linkedDocumentId: documentId
  }));

  await TonKhoDetail.insertMany(inventoryItems);
}

/**
 * Lưu dữ liệu BOM
 */
async function saveBomData(extractedData, documentId) {
  const bomData = {
    documentId,
    productCode: extractedData.productCode,
    productName: extractedData.productName,
    productHsCode: extractedData.productHsCode,
    materials: extractedData.materials,
    status: 'CONFIRMED'
  };

  await RawBomData.findOneAndUpdate(
    { productCode: extractedData.productCode },
    bomData,
    { upsert: true, new: true }
  );
}

/**
 * GIAI ĐOẠN 2: Tạo lô hàng draft và cấu hình
 * POST /process/create-draft
 */
async function createLohangDraft(userId, payload) {
  const {
    invoiceDocumentId,
    packingListDocumentId,
    bomDocumentIds,
    formType,
    exchangeRate,
    criterionType
  } = payload;

  // Validate
  if (!invoiceDocumentId || !formType || !exchangeRate || !criterionType) {
    const err = new Error('Thiếu thông tin bắt buộc');
    err.status = constants.HTTP_STATUS.BAD_REQUEST;
    throw err;
  }

  // Lấy thông tin từ Invoice
  const invoiceDoc = await Document.findById(invoiceDocumentId).populate('uploadedBy').lean();
  if (!invoiceDoc) {
    const err = new Error('Invoice document không tồn tại');
    err.status = constants.HTTP_STATUS.NOT_FOUND;
    throw err;
  }

  const companyId = invoiceDoc.uploadedBy?.companyId;
  if (!companyId) {
    throw new Error('Không xác định được companyId');
  }

  // Trích xuất dữ liệu Invoice bằng Gemini
  const gemini = getGeminiService();
  const invoiceData = await gemini.extractStructuredData(
    invoiceDoc.ocrData?.fullText || '',
    'INVOICE'
  );

  // Tạo LohangDraft
  const lohangDraft = await LohangDraft.create({
    companyId,
    staffUser: userId,
    status: 'DRAFT',
    currentStep: 2, // Bắt đầu từ bước 2 (có thể skip upload)
    invoiceNo: invoiceData.invoiceNo,
    invoiceDate: new Date(invoiceData.invoiceDate),
    formType,
    exchangeRate,
    criterionType,
    linkedDocuments: [invoiceDocumentId, packingListDocumentId, ...bomDocumentIds].filter(Boolean),
    totalSkuCount: invoiceData.items?.length || 0,
    processedSkuCount: 0,
    'workflowSteps.step1_uploadDocuments.completed': true,
    'workflowSteps.step1_uploadDocuments.completedAt': new Date()
  });

  // Tạo SKU Drafts từ Invoice items
  const skuDrafts = [];
  for (const item of invoiceData.items || []) {
    const skuDraft = await SkuDraft.create({
      lohangDraftId: lohangDraft._id,
      skuCode: item.productName, // Hoặc generate SKU code
      productName: item.productName,
      hsCodeProduct: item.hsCode,
      quantity: item.quantity,
      unit: item.unit,
      fobValueUsd: item.totalValue,
      status: 'PENDING'
    });
    skuDrafts.push(skuDraft);
  }

  return {
    lohangDraft,
    skuDrafts,
    message: 'Đã tạo lô hàng draft thành công'
  };
}

/**
 * GIAI ĐOẠN 3: Tính toán phân bổ FIFO
 * POST /process/calculate-sku
 */
async function calculateSkuAllocation(lohangDraftId) {
  const lohangDraft = await LohangDraft.findById(lohangDraftId).lean();
  if (!lohangDraft) {
    const err = new Error('Lô hàng không tồn tại');
    err.status = constants.HTTP_STATUS.NOT_FOUND;
    throw err;
  }

  // Lấy tất cả SKU cần xử lý
  const skuDrafts = await SkuDraft.find({
    lohangDraftId,
    status: 'PENDING'
  }).lean();

  // Cập nhật status lô hàng
  await LohangDraft.findByIdAndUpdate(lohangDraftId, {
    status: 'CALCULATING',
    updatedAt: new Date()
  });

  // Xử lý từng SKU
  for (const sku of skuDrafts) {
    try {
      await processSingleSku(lohangDraft, sku);
      
      // Cập nhật SKU status
      await SkuDraft.findByIdAndUpdate(sku._id, {
        status: 'COMPLETED',
        updatedAt: new Date()
      });

      // Cập nhật progress
      await LohangDraft.findByIdAndUpdate(lohangDraftId, {
        $inc: { processedSkuCount: 1 },
        updatedAt: new Date()
      });
    } catch (error) {
      console.error(`Error processing SKU ${sku.skuCode}:`, error);
      await SkuDraft.findByIdAndUpdate(sku._id, {
        status: 'FAILED',
        updatedAt: new Date()
      });
    }
  }

  // Cập nhật status lô hàng
  await LohangDraft.findByIdAndUpdate(lohangDraftId, {
    status: 'COMPLETED',
    completedAt: new Date(),
    updatedAt: new Date()
  });

  return { message: 'Hoàn thành tính toán', lohangDraftId };
}

/**
 * Xử lý 1 SKU: Tính định mức, phân bổ FIFO, tính kết quả
 */
async function processSingleSku(lohangDraft, sku) {
  // 1. Lấy BOM (định mức) cho SKU này
  const bomData = await RawBomData.findOne({
    productHsCode: sku.hsCodeProduct
  }).lean();

  if (!bomData || !bomData.materials) {
    throw new Error(`Không tìm thấy BOM cho sản phẩm ${sku.hsCodeProduct}`);
  }

  // 2. Tính tổng nhu cầu NPL
  const suDungDinhMucs = [];
  for (const material of bomData.materials) {
    const totalNeeded = material.normPerProduct * sku.quantity;
    
    const suDungDinhMuc = await SuDungDinhMuc.create({
      lohangDraftId: lohangDraft._id,
      skuDraftId: sku._id,
      skuCode: sku.skuCode,
      nplCode: material.materialCode,
      nplName: material.materialName,
      hsCodeNpl: material.hsCode,
      unit: material.unit,
      normPerProduct: material.normPerProduct,
      quantityProduct: sku.quantity,
      totalQuantityNeeded: totalNeeded,
      quantityAllocated: 0,
      quantityRemaining: totalNeeded,
      status: 'PENDING'
    });
    
    suDungDinhMucs.push(suDungDinhMuc);
  }

  // 3. Phân bổ FIFO cho từng NPL
  for (const suDungDinhMuc of suDungDinhMucs) {
    await allocateFifo(lohangDraft, sku, suDungDinhMuc);
  }

  // 4. Tính kết quả xuất xứ
  await calculateOriginResult(lohangDraft, sku);
}

/**
 * Phân bổ FIFO cho 1 NPL
 */
async function allocateFifo(lohangDraft, sku, suDungDinhMuc) {
  let remainingQty = suDungDinhMuc.totalQuantityNeeded;
  let allocationOrder = 1;

  // Lấy tồn kho theo FIFO (ngày cũ nhất trước)
  const inventoryLots = await TonKhoDetail.find({
    companyId: lohangDraft.companyId,
    nplCode: suDungDinhMuc.nplCode,
    status: 'AVAILABLE',
    quantityAvailable: { $gt: 0 }
  })
    .sort({ invoiceDate: 1 }) // FIFO: Ngày cũ nhất trước
    .lean();

  if (inventoryLots.length === 0) {
    throw new Error(`Không đủ tồn kho cho NPL ${suDungDinhMuc.nplCode}`);
  }

  for (const lot of inventoryLots) {
    if (remainingQty <= 0) break;

    const allocateQty = Math.min(remainingQty, lot.quantityAvailable);
    
    // Tạo bản ghi phân bổ
    await PhanBoXuat.create({
      lohangDraftId: lohangDraft._id,
      skuDraftId: sku._id,
      suDungDinhMucId: suDungDinhMuc._id,
      skuCode: sku.skuCode,
      nplCode: suDungDinhMuc.nplCode,
      nplName: suDungDinhMuc.nplName,
      hsCodeNpl: suDungDinhMuc.hsCodeNpl,
      tonKhoDetailId: lot._id,
      fromInvoiceRef: lot.invoiceRef,
      fromInvoiceDate: lot.invoiceDate,
      allocatedQuantity: allocateQty,
      unit: lot.unit,
      unitPriceUsd: lot.unitPriceCifUsd,
      totalValueUsd: allocateQty * lot.unitPriceCifUsd,
      originCountry: lot.originCountry,
      hasCo: lot.hasCo,
      coNumber: lot.coNumber,
      allocationOrder: allocationOrder++
    });

    // Trừ tồn kho
    await TonKhoDetail.findByIdAndUpdate(lot._id, {
      $inc: { quantityAvailable: -allocateQty },
      updatedAt: new Date()
    });

    // Cập nhật status nếu hết tồn
    const updatedLot = await TonKhoDetail.findById(lot._id).lean();
    if (updatedLot.quantityAvailable <= 0) {
      await TonKhoDetail.findByIdAndUpdate(lot._id, {
        status: 'DEPLETED',
        updatedAt: new Date()
      });
    }

    remainingQty -= allocateQty;
  }

  // Cập nhật SuDungDinhMuc
  await SuDungDinhMuc.findByIdAndUpdate(suDungDinhMuc._id, {
    quantityAllocated: suDungDinhMuc.totalQuantityNeeded - remainingQty,
    quantityRemaining: remainingQty,
    status: remainingQty <= 0 ? 'COMPLETED' : 'FAILED',
    updatedAt: new Date()
  });

  if (remainingQty > 0) {
    throw new Error(`Không đủ tồn kho cho NPL ${suDungDinhMuc.nplCode}. Còn thiếu: ${remainingQty}`);
  }
}

/**
 * Tính kết quả xuất xứ cho SKU
 */
async function calculateOriginResult(lohangDraft, sku) {
  // Lấy tất cả phân bổ của SKU này
  const allocations = await PhanBoXuat.find({
    lohangDraftId: lohangDraft._id,
    skuDraftId: sku._id
  }).lean();

  // Tính tổng trị giá NPL
  let totalNplValueWithCo = 0;
  let totalNplValueWithoutCo = 0;

  const nplBreakdown = [];
  const nplMap = new Map();

  for (const alloc of allocations) {
    const key = alloc.nplCode;
    
    if (!nplMap.has(key)) {
      nplMap.set(key, {
        nplCode: alloc.nplCode,
        nplName: alloc.nplName,
        hsCodeNpl: alloc.hsCodeNpl,
        unit: alloc.unit,
        totalQuantityUsed: 0,
        totalValueUsd: 0,
        allocations: []
      });
    }

    const nplInfo = nplMap.get(key);
    nplInfo.totalQuantityUsed += alloc.allocatedQuantity;
    nplInfo.totalValueUsd += alloc.totalValueUsd;
    nplInfo.allocations.push(alloc);

    if (alloc.hasCo) {
      totalNplValueWithCo += alloc.totalValueUsd;
    } else {
      totalNplValueWithoutCo += alloc.totalValueUsd;
    }
  }

  // Tạo breakdown chi tiết
  let stt = 1;
  for (const [_, nplInfo] of nplMap) {
    // Lấy thông tin từ allocation đầu tiên (hoặc tổng hợp)
    const firstAlloc = nplInfo.allocations[0];
    
    nplBreakdown.push({
      stt: stt++,
      nplCode: nplInfo.nplCode,
      nplName: nplInfo.nplName,
      hsCodeNpl: nplInfo.hsCodeNpl,
      unit: nplInfo.unit,
      normPerProduct: nplInfo.totalQuantityUsed / sku.quantity,
      totalQuantityUsed: nplInfo.totalQuantityUsed,
      unitPriceUsd: nplInfo.totalValueUsd / nplInfo.totalQuantityUsed,
      valueUsd: nplInfo.totalValueUsd,
      originCountry: firstAlloc.originCountry,
      hasCo: firstAlloc.hasCo,
      coNumber: firstAlloc.coNumber,
      invoiceRef: firstAlloc.fromInvoiceRef
    });
  }

  // Tính kết quả theo tiêu chí
  let finalResult = 'PENDING';
  let finalOriginCode = '';
  let ctcResult = false;
  let rvcPercentage = 0;

  if (lohangDraft.criterionType === 'CTC' || lohangDraft.criterionType === 'CTSH') {
    // Kiểm tra CTC: Mã HS NPL khác chapter với TP
    ctcResult = checkCTC(sku.hsCodeProduct, nplBreakdown);
    finalResult = ctcResult ? 'ĐẠT' : 'KHÔNG ĐẠT';
    finalOriginCode = ctcResult ? `E.I/${lohangDraft.criterionType}` : '';
  } else if (lohangDraft.criterionType.startsWith('RVC')) {
    // Tính RVC
    const rvcThreshold = parseInt(lohangDraft.criterionType.replace('RVC', ''));
    rvcPercentage = ((sku.fobValueUsd - totalNplValueWithoutCo) / sku.fobValueUsd) * 100;
    finalResult = rvcPercentage >= rvcThreshold ? 'ĐẠT' : 'KHÔNG ĐẠT';
    finalOriginCode = finalResult === 'ĐẠT' ? `E.I/${lohangDraft.criterionType}` : '';
  }

  // Lưu kết quả
  await SkuResult.create({
    lohangDraftId: lohangDraft._id,
    skuDraftId: sku._id,
    skuCode: sku.skuCode,
    productName: sku.productName,
    hsCodeProduct: sku.hsCodeProduct,
    quantity: sku.quantity,
    unit: sku.unit,
    fobValueUsd: sku.fobValueUsd,
    criterionType: lohangDraft.criterionType,
    totalNplValueWithCo,
    totalNplValueWithoutCo,
    totalNplValue: totalNplValueWithCo + totalNplValueWithoutCo,
    ctcResult,
    rvcPercentage,
    finalOriginCode,
    finalResult,
    nplBreakdown
  });

  // Cập nhật SKU Draft
  await SkuDraft.findByIdAndUpdate(sku._id, {
    'calculationResult.totalNplValueWithCo': totalNplValueWithCo,
    'calculationResult.totalNplValueWithoutCo': totalNplValueWithoutCo,
    'calculationResult.rvcPercentage': rvcPercentage,
    'calculationResult.ctcResult': ctcResult,
    'calculationResult.finalOriginCode': finalOriginCode,
    'calculationResult.finalResult': finalResult,
    updatedAt: new Date()
  });
}

/**
 * Kiểm tra CTC: Mã HS NPL phải khác chapter (2 số đầu) với TP
 */
function checkCTC(hsCodeProduct, nplBreakdown) {
  const productChapter = hsCodeProduct.substring(0, 2);
  
  for (const npl of nplBreakdown) {
    if (!npl.hasCo) {
      const nplChapter = npl.hsCodeNpl.substring(0, 2);
      if (nplChapter === productChapter) {
        return false; // Không đạt CTC
      }
    }
  }
  
  return true; // Đạt CTC
}

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

  const skuDrafts = await SkuDraft.find({ lohangDraftId }).lean();
  const skuResults = await SkuResult.find({ lohangDraftId }).lean();

  // Lấy workflow info
  const workflowInfo = getWorkflowInfo(lohangDraft);

  return {
    lohangDraft,
    skuDrafts,
    skuResults,
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
  const { formType, exchangeRate, criterionType } = payload;
  
  if (!formType || !exchangeRate || !criterionType) {
    const err = new Error('formType, exchangeRate, criterionType là bắt buộc');
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
    exchangeRate,
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
 * Continue to next step (Chuyển bước)
 * POST /api/v1/co/lohang/:id/continue
 */
async function continueToNextStep(lohangDraftId) {
  const lohangDraft = await LohangDraft.findById(lohangDraftId).lean();
  if (!lohangDraft) {
    const err = new Error('Lô hàng không tồn tại');
    err.status = constants.HTTP_STATUS.NOT_FOUND;
    throw err;
  }

  const currentStep = lohangDraft.currentStep || 1;
  let nextStep = currentStep;
  let updates = { updatedAt: new Date() };

  // Logic chuyển bước
  if (currentStep === 1) {
    // Bước 1 → Bước 2: Upload xong → Hiển thị form để user điền
    nextStep = 2;
    updates.currentStep = 2;
    updates['workflowSteps.step1_uploadDocuments.completed'] = true;
    updates['workflowSteps.step1_uploadDocuments.completedAt'] = new Date();
  } else {
    // Bước 2 trở đi không dùng API continue
    // Dùng API setup-and-extract hoặc các API khác
    const err = new Error('Không thể continue từ bước này. Vui lòng sử dụng API phù hợp.');
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
  const { formType, exchangeRate, criterionType } = payload;
  
  if (!formType || !exchangeRate || !criterionType) {
    const err = new Error('formType, exchangeRate, criterionType là bắt buộc');
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
    exchangeRate,
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

    const documents = await Document.find({
      _id: { $in: lohangDraft.linkedDocuments }
    }).lean();

    const extractor = getDataExtractorService();
    const BundleClass = require('../models/bundle.model');
    const Bundle = buildModelFromClass(BundleClass);

    // Lấy bundleId từ document đầu tiên
    const firstDoc = documents[0];
    const bundleId = firstDoc?.bundleId;

    // Phân loại documents theo đúng enum trong model
    console.log('Documents:', documents.map(d => ({ id: d._id, type: d.documentType, hasOcr: !!d.ocrResult })));

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

      // Tạo SKU Drafts từ product table
      const skuDrafts = [];
      for (const product of productTableData.products || []) {
        // Nếu hsCode rỗng, để giá trị mặc định "00000000"
        const hsCode = product.hsCode && product.hsCode.trim() !== '' 
          ? product.hsCode 
          : '00000000';

        const skuDraft = await SkuDraft.create({
          lohangDraftId: lohangDraft._id,
          skuCode: product.skuCode,
          productName: product.productName,
          hsCodeProduct: hsCode,
          quantity: product.quantity,
          unit: product.unit,
          fobValueUsd: product.fobValueUsd,
          status: 'PENDING'
        });
        skuDrafts.push(skuDraft);
      }

        console.log(`Created ${skuDrafts.length} SKU drafts`);
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

    // GIAI ĐOẠN 3: Extract Bảng Định mức (BOM)
    if (bomDocs.length > 0) {
      try {
        currentStep = 'EXTRACT_BOM_TABLE';
        console.log('Extracting BOM table...');
        
        // Lấy danh sách SKU từ product table
        const productTable = await ExtractedProductTable.findOne({ 
          lohangDraftId: lohangDraft._id 
        }).lean();
        
        const skuList = (productTable?.products || []).map(p => ({
          skuCode: p.skuCode,
          productName: p.productName
        }));

        if (skuList.length > 0) {
          const bomTableData = await extractor.extractBomTable(bomDocs, skuList);

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

          console.log(`Extracted BOM for ${bomTableData.totalMaterials} materials`);
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
    const skuCount = await SkuDraft.countDocuments({ lohangDraftId: lohangDraft._id });
    
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
      // Thành công hoàn toàn
      await LohangDraft.findByIdAndUpdate(lohangDraftId, {
        totalSkuCount: skuCount,
        status: 'DRAFT',
        currentStep: 4, // Chuyển sang bước 4: Review tables
        extractionErrors: [],
        'workflowSteps.step3_extractData.completed': true,
        'workflowSteps.step3_extractData.completedAt': new Date(),
        'workflowSteps.step3_extractData.inProgress': false,
        updatedAt: new Date()
      });
      console.log('Data extraction completed successfully');
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
 * Retry extraction khi có lỗi
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

  // Reset errors và status
  await LohangDraft.findByIdAndUpdate(lohangDraftId, {
    status: 'DATA_EXTRACTING',
    extractionErrors: [],
    updatedAt: new Date()
  });

  // Trigger extraction lại
  setImmediate(() => {
    extractDataFromDocuments(lohangDraftId)
      .catch(err => console.error('Retry extraction error:', err));
  });

  return {
    _id: lohangDraftId,
    status: 'DATA_EXTRACTING',
    message: 'Đang retry trích xuất dữ liệu'
  };
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

      // Cập nhật SKU Drafts
      await SkuDraft.deleteMany({ lohangDraftId: lohangDraft._id });
      for (const product of productTableData.products || []) {
        const hsCode = product.hsCode && product.hsCode.trim() !== '' 
          ? product.hsCode 
          : '00000000';

        await SkuDraft.create({
          lohangDraftId: lohangDraft._id,
          skuCode: product.skuCode,
          productName: product.productName,
          hsCodeProduct: hsCode,
          quantity: product.quantity,
          unit: product.unit,
          fobValueUsd: product.fobValueUsd,
          status: 'PENDING'
        });
      }

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
      name: 'Review Tables',
      key: 'step4_reviewTables',
      completed: workflowSteps?.step4_reviewTables?.completed || false,
      completedAt: workflowSteps?.step4_reviewTables?.completedAt
    },
    {
      step: 5,
      name: 'Confirm Data',
      key: 'step5_confirmData',
      completed: workflowSteps?.step5_confirmData?.completed || false,
      completedAt: workflowSteps?.step5_confirmData?.completedAt
    },
    {
      step: 6,
      name: 'Calculate Allocation',
      key: 'step6_calculate',
      completed: workflowSteps?.step6_calculate?.completed || false,
      completedAt: workflowSteps?.step6_calculate?.completedAt,
      inProgress: workflowSteps?.step6_calculate?.inProgress || false
    },
    {
      step: 7,
      name: 'Review Results',
      key: 'step7_reviewResults',
      completed: workflowSteps?.step7_reviewResults?.completed || false,
      completedAt: workflowSteps?.step7_reviewResults?.completedAt
    },
    {
      step: 8,
      name: 'Export C/O',
      key: 'step8_exportCO',
      completed: workflowSteps?.step8_exportCO?.completed || false,
      completedAt: workflowSteps?.step8_exportCO?.completedAt
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
  } else if (currentStep === 4) {
    nextAction = {
      type: 'REVIEW_TABLES',
      endpoint: `/api/v1/co/lohang/${lohangDraft._id}/tables`,
      method: 'GET',
      label: 'Review Extracted Tables'
    };
  } else if (currentStep === 5) {
    nextAction = {
      type: 'CONFIRM_DATA',
      endpoint: `/api/v1/co/lohang/${lohangDraft._id}/tables/confirm`,
      method: 'PUT',
      label: 'Confirm All Tables'
    };
  } else if (currentStep === 6 && !workflowSteps?.step6_calculate?.inProgress) {
    nextAction = {
      type: 'CALCULATE',
      endpoint: `/api/v1/co/calculate/${lohangDraft._id}`,
      method: 'POST',
      label: 'Calculate Allocation'
    };
  } else if (currentStep === 6 && workflowSteps?.step6_calculate?.inProgress) {
    nextAction = {
      type: 'WAIT',
      label: 'Calculating...',
      polling: true,
      pollingInterval: 3000
    };
    canProceed = false;
    message = 'Calculation in progress. Please wait...';
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

module.exports = {
  uploadDocuments,
  createLohangDraft,
  calculateSkuAllocation,
  getLohangDetail,
  listCO,
  createCOFromBundle,
  retryExtraction,
  reExtractTable,
  setupFormAndCriteria,
  continueToNextStep,
  setupAndExtract,
  triggerExtractTables,
  getWorkflowInfo
};
