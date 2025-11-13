const mongoose = require('mongoose');
const axios = require('axios');
const ejs = require('ejs');
const puppeteer = require('puppeteer');
const FormData = require('form-data');
const path = require('path');
const fs = require('fs').promises;
const CoApplicationModelClass = require('../models/coApplication.model');
const DocumentModelClass = require('../models/document.model');
const BundleModelClass = require('../models/bundle.model');
const OriginRuleModelClass = require('../models/originRule.model');
const HsChapterModelClass = require('../models/hsChapter.model');
const UserModelClass = require('../models/user.model');
const constants = require('../../core/utils/constants');
const helpers = require('../../core/utils/helpers');
const { startOcrJob } = require('./document.handle');

function buildModelFromClass(modelClass) {
  const modelName = modelClass.name;
  if (mongoose.models[modelName]) return mongoose.models[modelName];
  const schemaDefinition = modelClass.getSchema();
  const schema = new mongoose.Schema(schemaDefinition, { collection: modelClass.collection });
  return mongoose.model(modelName, schema);
}

const CoApplication = buildModelFromClass(CoApplicationModelClass);
const Document = buildModelFromClass(DocumentModelClass);
const Bundle = buildModelFromClass(BundleModelClass);
const OriginRule = buildModelFromClass(OriginRuleModelClass);
const HsChapter = buildModelFromClass(HsChapterModelClass);
const User = buildModelFromClass(UserModelClass);

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_UPLOAD_PRESET = process.env.CLOUDINARY_UPLOAD_PRESET;

// Helper: Normalize HS Code để giữ dấu phẩy, CHỈ LẤY 6 SỐ ĐẦU
function normalizeHsCode(hsCode) {
  // Bỏ dấu chấm và khoảng trắng, giữ dấu phẩy
  let normalized = String(hsCode || '').replace(/\./g, '').replace(/\s/g, '').trim();
  
  // Nếu không có dấu phẩy và dài hơn 6 số → cắt lấy 6 số đầu
  if (!normalized.includes(',') && normalized.length > 6) {
    normalized = normalized.substring(0, 6);
  }
  
  return normalized;
}

// Helper: Chuyển HS Code sang format có dấu phẩy (XXXX,YY)
function formatHsCodeWithComma(hsCode) {
  const normalized = normalizeHsCode(hsCode);
  if (normalized.length >= 6 && !normalized.includes(',')) {
    return normalized.substring(0, 4) + ',' + normalized.substring(4);
  }
  return normalized;
}

async function analyzeWithGemini(ocrText, formType, criterion) {
  console.log('---------------------------[analyzeWithGemini] Analyzing OCR text:', ocrText);
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured in environment variables');
  }
  
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`;
  
  let prompt = `Phân tích nội dung OCR sau đây và trích xuất thông tin:\n\n`;
  prompt += `Loại form: ${formType}\n`;
  prompt += `Tiêu chí xuất xứ: ${criterion}\n\n`;
  prompt += `Nội dung OCR từ các chứng từ:\n`;
  prompt += `${ocrText}\n\n`;
  
  if (criterion === 'WO') {
    prompt += `Trích xuất thông tin về:\n`;
    prompt += `1. Thông tin xuất khẩu: Tên công ty, MST, số hóa đơn, ngày, số tờ khai XK\n`;
    prompt += `2. Thông tin sản phẩm: Tên, mã HS, số lượng, trọng lượng, trị giá FOB\n`;
    prompt += `3. Nguyên phụ liệu nội địa (nếu có VAT): Ngày mua, tên người bán, địa chỉ, CMND/CCCD, tên NVL, mã HS, địa điểm, tổng giá trị\n`;
    prompt += `4. Nguyên phụ liệu sản xuất tại Việt Nam: Tên, mã HS, xuất xứ, giá trị\n`;
  } else if (criterion.includes('RVC') || criterion.includes('LVC')) {
    prompt += `Trích xuất:\n`;
    prompt += `1. Thông tin xuất khẩu cơ bản\n`;
    prompt += `2. Thông tin sản phẩm với trị giá FOB\n`;
    prompt += `3. Chi tiết nguyên phụ liệu:\n`;
    prompt += `   - Tên NVL, mã HS\n`;
    prompt += `   - Có xuất xứ (isOriginating): true/false\n`;
    prompt += `   - Giá trị (value)\n`;
    prompt += `   - Quốc gia xuất xứ, địa điểm\n`;
    prompt += `   - Tên và địa chỉ nhà cung cấp\n`;
    prompt += `   - Số chứng từ (HĐ/TK), ngày\n`;
    prompt += `   - Số C/O xuất xứ và ngày (nếu có)\n`;
  } else if (criterion.includes('CTC') || criterion.includes('CTSH') || criterion.includes('CTH')) {
    prompt += `Trích xuất:\n`;
    prompt += `1. Thông tin xuất khẩu\n`;
    prompt += `2. Sản phẩm (mã HS đầy đủ)\n`;
    prompt += `3. NVL không có xuất xứ với mã HS để kiểm tra thay đổi phân loại\n`;
  } else if (criterion === 'PE') {
    prompt += `Trích xuất:\n`;
    prompt += `1. Thông tin xuất khẩu\n`;
    prompt += `2. Thông tin sản phẩm\n`;
    prompt += `3. NVL nhập khẩu ưu đãi: Tên, mã HS, xuất xứ, giá trị, số C/O, ngày C/O\n`;
  }
  
  prompt += `\nLƯU Ý QUAN TRỌNG:\n`;
  prompt += `- Mã HS (productHsCode, hsCode) CHỈ LẤY 6 SỐ ĐẦU TIÊN (VD: "610510" thay vì "61051000")\n`;
  prompt += `- Nếu có dấu chấm/phẩy, giữ nguyên (VD: "6105.10" hoặc "6105,10")\n\n`;
  
  prompt += `Trả về JSON với cấu trúc:\n`;
  prompt += `{\n`;
  prompt += `  "exporterName": "...",\n`;
  prompt += `  "taxCode": "...",\n`;
  prompt += `  "invoiceNo": "...",\n`;
  prompt += `  "invoiceDate": "YYYY-MM-DD",\n`;
  prompt += `  "exportDeclarationNo": "...",\n`;
  prompt += `  "productName": "...",\n`;
  prompt += `  "productHsCode": "... (6 số đầu)",\n`;
  prompt += `  "quantity": 0,\n`;
  prompt += `  "grossWeight": 0,\n`;
  prompt += `  "fobValue": 0,\n`;
  prompt += `  "materialsBreakdown": [\n`;
  prompt += `    {\n`;
  prompt += `      "name": "...",\n`;
  prompt += `      "hsCode": "... (6 số đầu)",\n`;
  prompt += `      "isOriginating": true/false,\n`;
  prompt += `      "value": 0,\n`;
  prompt += `      "originCountry": "...",\n`;
  prompt += `      "originLocation": "...",\n`;
  prompt += `      "supplierName": "...",\n`;
  prompt += `      "supplierAddress": "...",\n`;
  prompt += `      "sourceRef": "HĐ/TK số",\n`;
  prompt += `      "sourceDate": "YYYY-MM-DD",\n`;
  prompt += `      "originatingCertRef": "C/O số (nếu có)",\n`;
  prompt += `      "originatingCertDate": "YYYY-MM-DD"\n`;
  prompt += `    }\n`;
  prompt += `  ],\n`;
  prompt += `  "domesticPurchases": [ ... ] // chỉ cho WO không VAT\n`;
  prompt += `}`;
  
  const payload = {
    contents: [{
      role: 'user',
      parts: [
        { text: prompt }
      ]
    }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 20000,
      responseMimeType: 'application/json'
    }
  };
  
  try {
    const res = await axios.post(url, payload, { 
      headers: { 'Content-Type': 'application/json' },
      timeout: 120000 // 120 seconds for text processing
    });
    
    if (!res.data || !res.data.candidates || res.data.candidates.length === 0) {
      console.error('[Gemini] No candidates in response:', JSON.stringify(res.data));
      throw new Error('Gemini returned no candidates');
    }
    
    const text = res.data.candidates[0]?.content?.parts?.[0]?.text;
    if (!text) {
      console.error('[Gemini] No text in response:', JSON.stringify(res.data));
      throw new Error('Gemini returned no text content');
    }
    
    console.log('[Gemini] Raw response text:', text.substring(0, 500) + '...');
    
    // Clean the JSON response by removing control characters
    const cleanedText = text.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
    
    const parsed = JSON.parse(cleanedText);
    return parsed;
  } catch (error) {
    if (error.response) {
      console.error('[Gemini API Error] Status:', error.response.status);
      console.error('[Gemini API Error] Data:', JSON.stringify(error.response.data));
      throw new Error(`Gemini API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
    }
    throw error;
  }
}

async function uploadToCloudinary(buffer, filename) {
  const form = new FormData();
  form.append('file', buffer, filename);
  form.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  const resourceType = filename.endsWith('.pdf') ? 'raw' : 'image';
  const uploadUrl = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`;
  const res = await axios.post(uploadUrl, form, { headers: form.getHeaders() });
  return res.data.secure_url;
}

// STEP 3.1: Create C/O Application from Bundle (DRAFT status)
async function createCoApplication(payload, userId) {
  const { bundleId } = payload || {};
  if (!bundleId) {
    const err = new Error('Thiếu trường bắt buộc: bundleId');
    err.status = constants.HTTP_STATUS.UNPROCESSABLE_ENTITY;
    err.code = constants.ERROR_CODES.VALIDATION_REQUIRED_FIELD;
    throw err;
  }

  // Kiểm tra Bundle tồn tại
  const bundle = await Bundle.findById(bundleId)
    .populate('companyId', 'name taxCode')
    .lean();
  if (!bundle) {
    const err = new Error('Không tìm thấy bộ chứng từ');
    err.status = constants.HTTP_STATUS.NOT_FOUND;
    err.code = constants.ERROR_CODES.DB_NOT_FOUND;
    throw err;
  }

  // Lấy danh sách documents từ Bundle (nếu có)
  const documents = await Document.find({ bundleId: bundle._id }).lean();
  
  // Cho phép tạo C/O ngay cả khi chưa có documents (sẽ upload sau ở Step 3.2)
  
  // Xác định ocrStatus dựa trên bundle status
  let ocrStatus = 'PENDING';
  if (bundle.status === 'OCR_COMPLETED') {
    ocrStatus = 'COMPLETED';
  } else if (bundle.status === 'OCR_PROCESSING') {
    ocrStatus = 'PROCESSING';
  }

  // Tạo CoApplication với status DRAFT (chưa có formType)
  const co = await CoApplication.create({
    companyId: bundle.companyId._id || bundle.companyId,
    staffUser: userId,
    bundleId: bundle._id,
    status: 'DRAFT',
    linkedDocuments: documents.map(d => d._id),
    ocrStatus: ocrStatus,
    items: [{
      productName: '',
      productHsCode: '',
      quantity: 0,
      grossWeight: 0,
      fobValue: 0,
      materialsBreakdown: [],
      domesticPurchases: []
    }]
  });

  // Prefill thông tin xuất khẩu từ Company (đã được populate)
  const company = bundle.companyId;
  if (company && company.name) {
    co.exporterName = company.name;
    co.taxCode = company.taxCode || '';
  }

  await co.save();
  
  console.log(`[Step 3.1] Created CoApplication ${co._id} from Bundle ${bundle._id} with ${documents.length} documents`);

  return {
    coApplication: co.toObject(),
    bundle: bundle,
    documents: documents
  };
}

async function listAvailableBundles(query = {}, userId) {
  const { page = 1, limit = 10, sort = '-createdAt' } = query;
  const skip = (page - 1) * limit;
  
  // Lấy TẤT CẢ Bundle (không giới hạn status) - chỉ cần chưa tạo C/O
  const conditions = { uploadedBy: userId };
  
  const keyword = (query.search || '').trim();
  if (keyword) conditions.bundleName = { $regex: keyword, $options: 'i' };

  // Lấy các Bundle đã có C/O
  const existingCoApps = await CoApplication.find({}).distinct('bundleId');
  
  // Loại trừ các Bundle đã tạo C/O
  if (existingCoApps.length > 0) {
    conditions._id = { $nin: existingCoApps };
  }

  const [items, total] = await Promise.all([
    Bundle.find(conditions)
      .populate('companyId', 'name taxCode')
      .populate('uploadedBy', 'username fullName')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    Bundle.countDocuments(conditions)
  ]);
  
  // Đếm số documents trong mỗi bundle
  for (const bundle of items) {
    const docCount = await Document.countDocuments({ bundleId: bundle._id });
    bundle.documentCount = docCount;
  }
  
  return { items, pagination: helpers.buildPaginationMeta(total, page, limit) };
}

async function listCoApplications(query, userId) {
  const { page, limit, skip, sort } = helpers.buildPagination(query, { sort: '-createdAt' });
  const conditions = { staffUser: userId };
  if (query.status) conditions.status = String(query.status).trim();
  if (query.formType) conditions.formType = String(query.formType).trim();
  const keyword = (query.search || '').trim();
  if (keyword) conditions.$or = [{ exporterName: { $regex: keyword, $options: 'i' } }, { invoiceNo: { $regex: keyword, $options: 'i' } }];

  const [items, total] = await Promise.all([
    CoApplication
      .find(conditions)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('companyId', 'name taxCode')
      .populate('staffUser', 'username fullName email')
      .lean(),
    CoApplication.countDocuments(conditions)
  ]);

  // Bổ sung số lượng chứng từ để hiển thị nhanh ở danh sách
  for (const it of items) {
    if (Array.isArray(it.linkedDocuments)) {
      it.linkedDocumentsCount = it.linkedDocuments.length;
    } else {
      it.linkedDocumentsCount = 0;
    }
  }

  return { items, pagination: helpers.buildPaginationMeta(total, page, limit) };
}

async function getCoApplication(id) {
  if (!id || !mongoose.isValidObjectId(id)) {
    const err = new Error('ID không hợp lệ');
    err.status = constants.HTTP_STATUS.BAD_REQUEST;
    err.code = constants.ERROR_CODES.VALIDATION_INVALID_FORMAT;
    throw err;
  }
  const doc = await CoApplication
    .findById(id)
    .populate('companyId', 'name taxCode')
    .populate('staffUser', 'username fullName email role')
    .populate({
      path: 'linkedDocuments',
      populate: [
        { path: 'uploadedBy', select: 'username fullName email role' },
        { path: 'approvedBy', select: 'username fullName email role' }
      ]
    })
    .lean();
  if (!doc) {
    const err = new Error('Không tìm thấy hồ sơ');
    err.status = constants.HTTP_STATUS.NOT_FOUND;
    err.code = constants.ERROR_CODES.DB_NOT_FOUND;
    throw err;
  }
  return doc;
}

// STEP 3.2: Upload Additional Documents with Real-time OCR
async function uploadDocumentsAndOCR(coId, documents) {
  console.log('[Step 3.2] Starting upload with coId:', coId, 'documents length:', documents ? documents.length : 'undefined');
  
  const co = await CoApplication.findById(coId);
  if (!co) {
    const err = new Error('Không tìm thấy hồ sơ');
    err.status = constants.HTTP_STATUS.NOT_FOUND;
    err.code = constants.ERROR_CODES.DB_NOT_FOUND;
    throw err;
  }

  if (!Array.isArray(documents) || documents.length === 0) {
    const err = new Error('Danh sách chứng từ trống');
    err.status = constants.HTTP_STATUS.UNPROCESSABLE_ENTITY;
    throw err;
  }

  // Tạo Documents và link với bundleId và coApplicationId
  const docsToInsert = [];
  let hasDocumentsWithOcr = false;
  
  documents.forEach((d, idx) => {
    const ocrPages = Array.isArray(d.ocrPages)
      ? d.ocrPages.filter(p => p && p.ocrStoragePath)
      : [];

    if (ocrPages.length > 0) {
      hasDocumentsWithOcr = true;
    }

    const docData = {
      fileName: d.fileName || `document_${idx + 1}`,
      storagePath: d.storagePath || '',
      documentType: d.documentType || 'COMMERCIAL_INVOICE',
      bundleId: co.bundleId, // Link to original bundle
      coApplicationId: co._id, // Link to C/O application
      note: d.note || '',
      ocrPages: ocrPages,
      companyId: co.companyId,
      uploadedBy: co.staffUser,
      status: 'PENDING_REVIEW'
    };
    
    docsToInsert.push(docData);
  });

  if (docsToInsert.length === 0) {
    const err = new Error('Không có chứng từ hợp lệ');
    err.status = constants.HTTP_STATUS.UNPROCESSABLE_ENTITY;
    throw err;
  }

  const inserted = await Document.insertMany(docsToInsert);
  console.log('[Step 3.2] Documents inserted:', inserted.length);

  // Update document statuses and start real-time OCR
  const updatePromises = [];
  const ocrJobs = [];
  const failedDocs = [];
  
  inserted.forEach(doc => {
    const hasOcrPages = Array.isArray(doc.ocrPages) && doc.ocrPages.length > 0;
    
    if (hasOcrPages) {
      updatePromises.push(
        Document.findByIdAndUpdate(doc._id, { 
          status: 'OCR_PROCESSING',
          approvedBy: co.staffUser,
          approvedAt: new Date()
        })
      );
      ocrJobs.push(doc._id);
    } else {
      updatePromises.push(
        Document.findByIdAndUpdate(doc._id, { 
          status: 'OCR_COMPLETED',
          approvedBy: co.staffUser,
          approvedAt: new Date(),
          ocrResult: 'No OCR required - document uploaded without image pages'
        })
      );
    }
  });

  await Promise.all(updatePromises);

  // Start real-time OCR jobs
  if (ocrJobs.length > 0) {
    co.ocrStatus = 'PROCESSING';
    console.log(`[Step 3.2] Starting real-time OCR for ${ocrJobs.length} documents`);
    
    // Start OCR jobs immediately
    ocrJobs.forEach(docId => {
      setImmediate(() => startOcrJob(docId).catch((err) => {
        console.error(`[Step 3.2] OCR failed for document ${docId}:`, err);
        failedDocs.push(docId);
      }));
    });
  } else {
    co.ocrStatus = 'COMPLETED';
  }

  // Append new documents to linkedDocuments
  const existingDocs = co.linkedDocuments || [];
  const newDocIds = inserted.map(d => d._id);
  co.linkedDocuments = [...existingDocs, ...newDocIds];
  
  await co.save();
  
  console.log(`[Step 3.2] Uploaded ${inserted.length} documents to CoApplication ${co._id}`);
  
  // Populate uploadedBy để response đầy đủ thông tin
  const populatedDocs = await Document.find({ _id: { $in: newDocIds } })
    .populate('uploadedBy', 'username fullName email role')
    .populate('approvedBy', 'username fullName email role')
    .lean();
  
  return {
    coApplication: co.toObject(),
    documents: populatedDocs,
    ocrStatus: co.ocrStatus
  };
}

async function matchOriginRules(coId, formType) {
  const co = await CoApplication.findById(coId);
  if (!co) {
    const err = new Error('Không tìm thấy hồ sơ');
    err.status = constants.HTTP_STATUS.NOT_FOUND;
    err.code = constants.ERROR_CODES.DB_NOT_FOUND;
    throw err;
  }

  if (!co.items || co.items.length === 0) {
    const err = new Error('Chưa có thông tin mặt hàng');
    err.status = constants.HTTP_STATUS.BAD_REQUEST;
    err.code = constants.ERROR_CODES.VALIDATION_INVALID_STATE;
    throw err;
  }

  // Loop qua TẤT CẢ items để match rules
  for (let i = 0; i < co.items.length; i++) {
    const item = co.items[i];
    const rawHsCode = item.productHsCode;
    
    console.log(`[Match Rules] Processing item ${i + 1}/${co.items.length}: ${rawHsCode}`);
    
    // Normalize hsCode
    const hsCode = normalizeHsCode(rawHsCode);
    
    // Thử match chính xác trước (không dấu phẩy: "940340")
    let rule = await OriginRule.findOne({ formType, hsSubgroup: hsCode }).lean();
    console.log(`[Match Rules] Exact match for "${hsCode}":`, rule ? 'FOUND' : 'NOT FOUND');
    
    // Nếu không có, thử format có dấu phẩy (format: "9403,40")
    if (!rule) {
      const hsCodeWithComma = formatHsCodeWithComma(hsCode);
      if (hsCodeWithComma !== hsCode) {
        rule = await OriginRule.findOne({ formType, hsSubgroup: hsCodeWithComma }).lean();
        console.log(`[Match Rules] With comma "${hsCodeWithComma}":`, rule ? 'FOUND' : 'NOT FOUND');
      }
    }
    
    // Nếu vẫn không có, thử match theo hsGroup (4 số đầu)
    if (!rule && hsCode.length >= 4) {
      const hsGroup = hsCode.substring(0, 4);
      rule = await OriginRule.findOne({ 
        formType, 
        hsGroup,
        hsSubgroup: { $regex: `^${hsGroup}` }
      }).sort({ hsSubgroup: 1 }).lean();
      console.log(`[Match Rules] By hsGroup "${hsGroup}":`, rule ? 'FOUND' : 'NOT FOUND');
    }
    
    if (!rule) {
      // Sử dụng set() để gán subdocument
      item.set('appliedRule', { type: 'UNKNOWN', rvcPercent: 0 });
      item.originCriterionDisplay = 'Không tìm thấy quy tắc';
      console.log(`[Match Rules] Item ${i + 1}: No rule found`);
    } else {
      const criteria = String(rule.criteria || '').trim().toUpperCase();
      
      let rvcPercent = 0;
      if (criteria.includes('RVC')) {
        const match = criteria.match(/RVC\s*(\d+)/);
        rvcPercent = match ? parseInt(match[1]) : 40;
        item.set('appliedRule', { type: criteria, rvcPercent });
        item.originCriterionDisplay = `RVC ${rvcPercent}%`;
      } else if (criteria.includes('LVC')) {
        const match = criteria.match(/LVC\s*(\d+)/);
        rvcPercent = match ? parseInt(match[1]) : 40;
        item.set('appliedRule', { type: criteria, rvcPercent });
        item.originCriterionDisplay = `LVC ${rvcPercent}%`;
      } else {
        item.set('appliedRule', { type: criteria, rvcPercent: 0 });
        item.originCriterionDisplay = criteria;
      }
      console.log(`[Match Rules] Item ${i + 1}: Matched rule "${criteria}"`);
    }
  }

  co.markModified('items');
  await co.save();
  console.log(`[Match Rules] Saved ${co.items.length} items with rules`);
  return co.toObject();
}

async function applyLogicEngine(coId, criterion, reAnalyze = false) {
  const co = await CoApplication.findById(coId);
  if (!co) {
    const err = new Error('Không tìm thấy hồ sơ');
    err.status = constants.HTTP_STATUS.NOT_FOUND;
    err.code = constants.ERROR_CODES.DB_NOT_FOUND;
    throw err;
  }

  const item = co.items[0];
  if (!item) {
    const err = new Error('Chưa có thông tin mặt hàng');
    err.status = constants.HTTP_STATUS.BAD_REQUEST;
    err.code = constants.ERROR_CODES.VALIDATION_INVALID_STATE;
    throw err;
  }

  const criterionUpper = String(criterion).toUpperCase();
  
  // Nếu reAnalyze = true và có linkedDocuments, gọi lại Gemini với tiêu chí mới
  if (reAnalyze && co.linkedDocuments && co.linkedDocuments.length > 0) {
    const docs = await Document.find({ _id: { $in: co.linkedDocuments } }).select('documentType ocrResult').lean();
    const ocrTexts = docs
      .filter(d => d.ocrResult && d.ocrResult.trim())
      .map(d => `[${d.documentType || 'DOCUMENT'}]\n${d.ocrResult}`);
    
    if (ocrTexts.length > 0) {
      const allOcrText = ocrTexts.join('\n\n---\n\n');
      try {
        const data = await analyzeWithGemini(allOcrText, co.formType, criterion);
        
        // Cập nhật materialsBreakdown với dữ liệu mới
        if (Array.isArray(data.materialsBreakdown) && data.materialsBreakdown.length > 0) {
          item.materialsBreakdown = data.materialsBreakdown.map(m => ({
            name: m.name || '',
            hsCode: normalizeHsCode(m.hsCode),  // Normalize: chỉ lấy 6 số đầu
            isOriginating: m.isOriginating === true,
            value: m.value || 0,
            originCountry: m.originCountry || '',
            originLocation: m.originLocation || '',
            supplierName: m.supplierName || '',
            supplierAddress: m.supplierAddress || '',
            sourceRef: m.sourceRef || '',
            sourceDate: m.sourceDate ? new Date(m.sourceDate) : undefined,
            originatingCertRef: m.originatingCertRef || '',
            originatingCertDate: m.originatingCertDate ? new Date(m.originatingCertDate) : undefined
          }));
        }
        
        // Cập nhật domesticPurchases cho WO
        if (criterionUpper === 'WO' && Array.isArray(data.domesticPurchases)) {
          item.domesticPurchases = data.domesticPurchases.map(p => ({
            date: p.date ? new Date(p.date) : undefined,
            sellerName: p.sellerName || '',
            sellerAddress: p.sellerAddress || '',
            sellerIdCard: p.sellerIdCard || '',
            materialName: p.materialName || '',
            materialHsCode: String(p.materialHsCode || '').replace(/\./g, ''),
            location: p.location || '',
            totalValue: p.totalValue || 0
          }));
        }
      } catch (err) {
        console.error('Re-analysis with Gemini failed:', err.message);
      }
    }
  }

  // Thực hiện logic check
  if (criterionUpper === 'WO') {
    const allOriginating = (item.materialsBreakdown || []).every(m => m.isOriginating);
    item.logicCheck = { 
      pass: allOriginating, 
      message: allOriginating ? 'Hàng hóa hoàn toàn có xuất xứ Việt Nam' : 'Có NVL không có xuất xứ VN' 
    };
  } else if (criterionUpper.startsWith('CTC') || criterionUpper.includes('CTSH') || criterionUpper.includes('CTH')) {
    const productHs4 = item.productHsCode.substring(0, 4);
    const nonOriginatingMaterials = (item.materialsBreakdown || []).filter(m => !m.isOriginating);
    let pass = true;
    for (const mat of nonOriginatingMaterials) {
      const matHs4 = String(mat.hsCode || '').substring(0, 4);
      if (matHs4 === productHs4) {
        pass = false;
        break;
      }
    }
    item.logicCheck = { pass, message: pass ? 'Đạt tiêu chí CTSH' : 'Không đạt CTSH do NPL không XX cùng nhóm HS' };
  } else if (criterionUpper.includes('RVC') || criterionUpper.includes('LVC')) {
    let totalOrig = 0;
    let totalNonOrig = 0;
    for (const mat of (item.materialsBreakdown || [])) {
      if (mat.isOriginating) totalOrig += mat.value || 0;
      else totalNonOrig += mat.value || 0;
    }
    item.totalValueOriginating = totalOrig;
    item.totalValueNonOriginating = totalNonOrig;
    const fob = item.fobValue || 1;
    const rvc = ((fob - totalNonOrig) / fob) * 100;
    item.rvcPercent = rvc;

    const requiredRvc = item.appliedRule?.rvcPercent || 40;
    const pass = rvc >= requiredRvc;
    item.logicCheck = { pass, message: pass ? `Đạt RVC ${rvc.toFixed(2)}%` : `Không đạt RVC: ${rvc.toFixed(2)}% < ${requiredRvc}%` };
  } else if (criterionUpper === 'PE') {
    const hasFtaCert = (item.materialsBreakdown || []).some(m => m.originatingCertRef);
    item.logicCheck = { 
      pass: hasFtaCert, 
      message: hasFtaCert ? 'Hàng hóa tích lũy từ các nước FTA' : 'Chưa có chứng từ C/O ưu đãi' 
    };
  }

  item.originCriterionDisplay = criterion;
  co.markModified('items');
  await co.save();
  return co.toObject();
}

async function generatePDF(coId) {
  const co = await CoApplication.findById(coId).lean();
  if (!co) {
    const err = new Error('Không tìm thấy hồ sơ');
    err.status = constants.HTTP_STATUS.NOT_FOUND;
    err.code = constants.ERROR_CODES.DB_NOT_FOUND;
    throw err;
  }

  const item = co.items[0];
  if (!item) {
    const err = new Error('Chưa có thông tin mặt hàng');
    err.status = constants.HTTP_STATUS.BAD_REQUEST;
    err.code = constants.ERROR_CODES.VALIDATION_INVALID_STATE;
    throw err;
  }

  const criterion = String(item.originCriterionDisplay || '').toUpperCase();
  let templateName = 'bang-ke-ctc.ejs';
  
  if (criterion.includes('RVC')) templateName = 'bang-ke-rvc.ejs';
  else if (criterion.includes('LVC')) templateName = 'bang-ke-lvc.ejs';
  else if (criterion === 'WO') {
    const hasVAT = (item.materialsBreakdown || []).some(m => m.sourceRef && m.sourceRef.includes('HĐ'));
    templateName = hasVAT ? 'bang-ke-wo-vat.ejs' : 'bang-ke-wo-no-vat.ejs';
  } else if (criterion === 'PE') templateName = 'bang-ke-pe.ejs';

  const templatePath = path.join(__dirname, '../../templates', templateName);
  const html = await ejs.renderFile(templatePath, { coApp: co });

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
  await browser.close();

  const filename = `BKE_${criterion}_${co.exportDeclarationNo || Date.now()}.pdf`;
  const pdfUrl = await uploadToCloudinary(pdfBuffer, filename);

  return { pdfUrl, filename };
}

// STEP 3.3: Select Form Type (FORM_B or FORM_E)
async function selectFormType(coId, formType) {
  if (!['FORM_B', 'FORM_E'].includes(formType)) {
    const err = new Error('Form type không hợp lệ. Chỉ chấp nhận FORM_B hoặc FORM_E');
    err.status = constants.HTTP_STATUS.BAD_REQUEST;
    throw err;
  }

  const co = await CoApplication.findById(coId);
  if (!co) {
    const err = new Error('Không tìm thấy hồ sơ');
    err.status = constants.HTTP_STATUS.NOT_FOUND;
    throw err;
  }

  co.formType = formType;
  await co.save();

  console.log(`[Step 3.3] Selected form type ${formType} for CoApplication ${coId}`);
  
  return co.toObject();
}

// STEP 3.4 (FORM_B): Auto-fill basic info from shipment documents
async function autoFillFormB(coId) {
  const co = await CoApplication.findById(coId).populate('linkedDocuments');
  if (!co) {
    const err = new Error('Không tìm thấy hồ sơ');
    err.status = constants.HTTP_STATUS.NOT_FOUND;
    throw err;
  }

  if (co.formType !== 'FORM_B') {
    const err = new Error('Hồ sơ này không phải FORM_B');
    err.status = constants.HTTP_STATUS.BAD_REQUEST;
    throw err;
  }

  // Collect OCR results from shipment documents
  const documents = await Document.find({ 
    _id: { $in: co.linkedDocuments },
    coApplicationId: co._id // Only documents uploaded in Step 3.2
  }).lean();

  if (!documents || documents.length === 0) {
    console.warn('[Step 3.4 FORM_B] No additional documents found');
    return co.toObject();
  }

  // Build OCR text from shipment documents
  const ocrText = documents
    .filter(d => d.ocrResult && d.ocrResult.trim())
    .map(d => `[${d.documentType || 'DOCUMENT'}]\n${d.ocrResult}`)
    .join('\n\n---\n\n');

  if (!ocrText.trim()) {
    console.warn('[Step 3.4 FORM_B] No OCR results available');
    return co.toObject();
  }

  // Use Gemini to extract basic info for FORM_B
  if (GEMINI_API_KEY) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`;
      
      const prompt = `Bạn là chuyên gia về C/O Form B (không ưu đãi). Phân tích các chứng từ sau và trích xuất thông tin cơ bản:

${ocrText}

Trả về JSON với cấu trúc:
{
  "invoiceNo": "Số hóa đơn thương mại",
  "invoiceDate": "YYYY-MM-DD",
  "exportDeclarationNo": "Số tờ khai xuất khẩu",
  "consigneeInfo": "Thông tin người nhận (tên, địa chỉ)",
  "transportInfo": "Thông tin vận chuyển (phương tiện, số chuyến)"
}`;

      const payload = {
        contents: [{
          role: 'user',
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 5000,
          responseMimeType: 'application/json'
        }
      };

      const res = await axios.post(url, payload, { 
        headers: { 'Content-Type': 'application/json' },
        timeout: 60000
      });

      const text = res.data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        const data = JSON.parse(text.replace(/[\x00-\x1F\x7F-\x9F]/g, ''));
        
        // Update CoApplication with basic info
        if (data.invoiceNo) co.invoiceNo = data.invoiceNo;
        if (data.invoiceDate) co.invoiceDate = new Date(data.invoiceDate);
        if (data.exportDeclarationNo) co.exportDeclarationNo = data.exportDeclarationNo;
        if (data.consigneeInfo) co.consigneeInfo = data.consigneeInfo;
        if (data.transportInfo) co.transportInfo = data.transportInfo;

        await co.save();
        console.log('[Step 3.4 FORM_B] Auto-filled basic info successfully');
      }
    } catch (err) {
      console.error('[Step 3.4 FORM_B] Gemini analysis failed:', err.message);
    }
  }

  return co.toObject();
}

// STEP 3.4 (FORM_E): AI lookup rules from HS code
async function aiLookupRules(coId) {
  const co = await CoApplication.findById(coId);
  if (!co) {
    const err = new Error('Không tìm thấy hồ sơ');
    err.status = constants.HTTP_STATUS.NOT_FOUND;
    throw err;
  }

  if (co.formType !== 'FORM_E') {
    const err = new Error('Hồ sơ này không phải FORM_E');
    err.status = constants.HTTP_STATUS.BAD_REQUEST;
    throw err;
  }

  // Get all documents (both from bundle and additional uploads)
  const documents = await Document.find({ 
    _id: { $in: co.linkedDocuments }
  }).lean();

  if (!documents || documents.length === 0) {
    const err = new Error('Không có chứng từ để phân tích');
    err.status = constants.HTTP_STATUS.BAD_REQUEST;
    throw err;
  }

  // Build OCR text from ALL documents
  const allOcrText = documents
    .filter(d => d.ocrResult && d.ocrResult.trim())
    .map(d => `[${d.documentType || 'DOCUMENT'}]\n${d.ocrResult}`)
    .join('\n\n---\n\n');

  if (!allOcrText.trim()) {
    const err = new Error('Không có dữ liệu OCR để phân tích');
    err.status = constants.HTTP_STATUS.BAD_REQUEST;
    throw err;
  }

  // Use Gemini to extract HS code from export declaration
  if (!GEMINI_API_KEY) {
    const err = new Error('GEMINI_API_KEY not configured');
    err.status = constants.HTTP_STATUS.INTERNAL_SERVER_ERROR;
    throw err;
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`;
    
    const prompt = `Bạn là chuyên gia về C/O. Từ các chứng từ sau (đặc biệt là Tờ khai Xuất khẩu), hãy xác định:
1. Tên sản phẩm thành phẩm
2. Mã HS (6 số đầu tiên) của sản phẩm thành phẩm

${allOcrText}

LƯU Ý: Mã HS CHỈ LẤY 6 SỐ ĐẦU TIÊN (VD: "940360" thay vì "94036000")

Trả về JSON:
{
  "productName": "Tên sản phẩm",
  "hsCode": "6 số HS code"
}`;

    const payload = {
      contents: [{
        role: 'user',
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 5000,
        responseMimeType: 'application/json'
      }
    };

    const res = await axios.post(url, payload, { 
      headers: { 'Content-Type': 'application/json' },
      timeout: 60000
    });

    const text = res.data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error('Gemini returned no response');
    }

    const data = JSON.parse(text.replace(/[\x00-\x1F\x7F-\x9F]/g, ''));
    const hsCode = normalizeHsCode(data.hsCode);

    console.log(`[Step 3.4 FORM_E] Extracted HS code: ${hsCode} for product: ${data.productName}`);

    // Lookup origin rules from database
    let rule = await OriginRule.findOne({ formType: 'FORM_E', hsSubgroup: hsCode }).lean();
    
    if (!rule) {
      const hsCodeWithComma = formatHsCodeWithComma(hsCode);
      if (hsCodeWithComma !== hsCode) {
        rule = await OriginRule.findOne({ formType: 'FORM_E', hsSubgroup: hsCodeWithComma }).lean();
      }
    }

    if (!rule && hsCode.length >= 4) {
      const hsGroup = hsCode.substring(0, 4);
      rule = await OriginRule.findOne({ 
        formType: 'FORM_E', 
        hsGroup,
        hsSubgroup: { $regex: `^${hsGroup}` }
      }).sort({ hsSubgroup: 1 }).lean();
    }

    // Update CoApplication with product info and suggested rules
    if (!co.items || co.items.length === 0) {
      co.items = [{}];
    }

    co.items[0].productName = data.productName || '';
    co.items[0].productHsCode = hsCode;

    if (rule) {
      const criteria = String(rule.criteria || '').trim().toUpperCase();
      co.items[0].appliedRule = { type: criteria, rvcPercent: 0 };
      co.items[0].originCriterionDisplay = criteria;
      
      console.log(`[Step 3.4 FORM_E] Found rule: ${criteria} for HS ${hsCode}`);
    } else {
      co.items[0].appliedRule = { type: 'UNKNOWN', rvcPercent: 0 };
      co.items[0].originCriterionDisplay = 'Không tìm thấy quy tắc';
      console.warn(`[Step 3.4 FORM_E] No rule found for HS ${hsCode}`);
    }

    co.markModified('items');
    await co.save();

    return {
      coApplication: co.toObject(),
      suggestedCriteria: rule ? rule.criteria : null,
      hsCode: hsCode,
      productName: data.productName
    };

  } catch (err) {
    console.error('[Step 3.4 FORM_E] Error:', err);
    throw err;
  }
}

// STEP 3.5 (FORM_E): Select criteria
async function selectCriteria(coId, criterion) {
  const co = await CoApplication.findById(coId);
  if (!co) {
    const err = new Error('Không tìm thấy hồ sơ');
    err.status = constants.HTTP_STATUS.NOT_FOUND;
    throw err;
  }

  if (co.formType !== 'FORM_E') {
    const err = new Error('Hồ sơ này không phải FORM_E');
    err.status = constants.HTTP_STATUS.BAD_REQUEST;
    throw err;
  }

  if (!co.items || co.items.length === 0) {
    const err = new Error('Chưa có thông tin sản phẩm');
    err.status = constants.HTTP_STATUS.BAD_REQUEST;
    throw err;
  }

  const criterionUpper = String(criterion).toUpperCase();
  
  // Parse RVC/LVC percentage if applicable
  let rvcPercent = 0;
  if (criterionUpper.includes('RVC')) {
    const match = criterionUpper.match(/RVC\s*(\d+)/);
    rvcPercent = match ? parseInt(match[1]) : 40;
  } else if (criterionUpper.includes('LVC')) {
    const match = criterionUpper.match(/LVC\s*(\d+)/);
    rvcPercent = match ? parseInt(match[1]) : 40;
  }

  co.items[0].appliedRule = { type: criterionUpper, rvcPercent };
  co.items[0].originCriterionDisplay = criterion;
  
  co.markModified('items');
  await co.save();

  console.log(`[Step 3.5 FORM_E] Selected criterion: ${criterion} for CoApplication ${coId}`);

  return co.toObject();
}

// STEP 3.6 (FORM_E): AI auto-generate materials breakdown
async function aiGenerateMaterialsBreakdown(coId, correctionNotes = null) {
  const co = await CoApplication.findById(coId);
  if (!co) {
    const err = new Error('Không tìm thấy hồ sơ');
    err.status = constants.HTTP_STATUS.NOT_FOUND;
    throw err;
  }

  if (co.formType !== 'FORM_E') {
    const err = new Error('Hồ sơ này không phải FORM_E');
    err.status = constants.HTTP_STATUS.BAD_REQUEST;
    throw err;
  }

  if (!co.items || co.items.length === 0 || !co.items[0].appliedRule) {
    const err = new Error('Chưa chọn tiêu chí xuất xứ');
    err.status = constants.HTTP_STATUS.BAD_REQUEST;
    throw err;
  }

  const item = co.items[0];
  const criterion = item.appliedRule.type;

  // Get all documents
  const documents = await Document.find({ 
    _id: { $in: co.linkedDocuments }
  }).lean();

  const allOcrText = documents
    .filter(d => d.ocrResult && d.ocrResult.trim())
    .map(d => `[${d.documentType || 'DOCUMENT'}]\n${d.ocrResult}`)
    .join('\n\n---\n\n');

  if (!allOcrText.trim()) {
    const err = new Error('Không có dữ liệu OCR để phân tích');
    err.status = constants.HTTP_STATUS.BAD_REQUEST;
    throw err;
  }

  if (!GEMINI_API_KEY) {
    const err = new Error('GEMINI_API_KEY not configured');
    err.status = constants.HTTP_STATUS.INTERNAL_SERVER_ERROR;
    throw err;
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`;
    
    let prompt = `Bạn là chuyên gia lập Bảng kê C/O Form E. Dựa trên toàn bộ chứng từ sau (BOM, Tờ khai XK, HĐTM, Tờ khai NK, HĐ VAT...), hãy lập Bảng Kê Khai chi tiết cho tiêu chí ${criterion}.

${allOcrText}

Yêu cầu:
1. Liên kết NPL trong BOM với chứng từ gốc (Tờ khai NK/HĐ VAT)
2. Xác định xuất xứ của từng NPL (isOriginating: true/false)
3. Lấy đầy đủ thông tin: tên, mã HS (6 số), giá trị, nhà cung cấp, số chứng từ, ngày

`;

    if (correctionNotes) {
      prompt += `\nGHI CHÚ SỬA LỖI TỪ NHÂN VIÊN:\n${correctionNotes}\n\nHãy sửa các lỗi này trong Bảng kê.\n`;
      item.aiCorrectionCount = (item.aiCorrectionCount || 0) + 1;
      item.aiCorrectionNotes = correctionNotes;
    }

    prompt += `
Trả về JSON với cấu trúc:
{
  "materialsBreakdown": [
    {
      "name": "Tên NPL",
      "hsCode": "6 số HS",
      "isOriginating": true/false,
      "value": 0,
      "originCountry": "Quốc gia",
      "originLocation": "Địa điểm",
      "supplierName": "Nhà cung cấp",
      "supplierAddress": "Địa chỉ",
      "sourceRef": "Số HĐ/TK",
      "sourceDate": "YYYY-MM-DD",
      "originatingCertRef": "Số C/O (nếu có)",
      "originatingCertDate": "YYYY-MM-DD (nếu có)"
    }
  ]
}`;

    const payload = {
      contents: [{
        role: 'user',
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 20000,
        responseMimeType: 'application/json'
      }
    };

    const res = await axios.post(url, payload, { 
      headers: { 'Content-Type': 'application/json' },
      timeout: 120000
    });

    const text = res.data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error('Gemini returned no response');
    }

    const data = JSON.parse(text.replace(/[\x00-\x1F\x7F-\x9F]/g, ''));

    if (Array.isArray(data.materialsBreakdown) && data.materialsBreakdown.length > 0) {
      item.materialsBreakdown = data.materialsBreakdown.map(m => ({
        name: m.name || '',
        hsCode: normalizeHsCode(m.hsCode),
        isOriginating: m.isOriginating === true,
        value: m.value || 0,
        originCountry: m.originCountry || '',
        originLocation: m.originLocation || '',
        supplierName: m.supplierName || '',
        supplierAddress: m.supplierAddress || '',
        sourceRef: m.sourceRef || '',
        sourceDate: m.sourceDate ? new Date(m.sourceDate) : undefined,
        originatingCertRef: m.originatingCertRef || '',
        originatingCertDate: m.originatingCertDate ? new Date(m.originatingCertDate) : undefined
      }));

      // Run logic check automatically
      await runLogicCheck(co, item, criterion);

      co.markModified('items');
      await co.save();

      console.log(`[Step 3.6 FORM_E] Generated materials breakdown with ${item.materialsBreakdown.length} items`);
      
      return {
        coApplication: co.toObject(),
        materialsBreakdown: item.materialsBreakdown,
        logicCheck: item.logicCheck
      };
    } else {
      throw new Error('Gemini không trả về dữ liệu Bảng kê hợp lệ');
    }

  } catch (err) {
    console.error('[Step 3.6 FORM_E] Error:', err);
    throw err;
  }
}

// Helper: Run logic check for materials breakdown
async function runLogicCheck(co, item, criterion) {
  const criterionUpper = String(criterion).toUpperCase();
  
  if (criterionUpper === 'WO') {
    const allOriginating = (item.materialsBreakdown || []).every(m => m.isOriginating);
    item.logicCheck = { 
      pass: allOriginating, 
      message: allOriginating ? 'Hàng hóa hoàn toàn có xuất xứ Việt Nam' : 'Có NVL không có xuất xứ VN' 
    };
  } else if (criterionUpper.startsWith('CTC') || criterionUpper.includes('CTSH') || criterionUpper.includes('CTH')) {
    const productHs4 = item.productHsCode.substring(0, 4);
    const nonOriginatingMaterials = (item.materialsBreakdown || []).filter(m => !m.isOriginating);
    let pass = true;
    for (const mat of nonOriginatingMaterials) {
      const matHs4 = String(mat.hsCode || '').substring(0, 4);
      if (matHs4 === productHs4) {
        pass = false;
        break;
      }
    }
    item.logicCheck = { pass, message: pass ? 'Đạt tiêu chí CTSH' : 'Không đạt CTSH do NPL không XX cùng nhóm HS' };
  } else if (criterionUpper.includes('RVC') || criterionUpper.includes('LVC')) {
    let totalOrig = 0;
    let totalNonOrig = 0;
    for (const mat of (item.materialsBreakdown || [])) {
      if (mat.isOriginating) totalOrig += mat.value || 0;
      else totalNonOrig += mat.value || 0;
    }
    item.totalValueOriginating = totalOrig;
    item.totalValueNonOriginating = totalNonOrig;
    const fob = item.fobValue || 1;
    const rvc = ((fob - totalNonOrig) / fob) * 100;
    item.rvcPercent = rvc;

    const requiredRvc = item.appliedRule?.rvcPercent || 40;
    const pass = rvc >= requiredRvc;
    item.logicCheck = { pass, message: pass ? `Đạt RVC ${rvc.toFixed(2)}%` : `Không đạt RVC: ${rvc.toFixed(2)}% < ${requiredRvc}%` };
  } else if (criterionUpper === 'PE') {
    const hasFtaCert = (item.materialsBreakdown || []).some(m => m.originatingCertRef);
    item.logicCheck = { 
      pass: hasFtaCert, 
      message: hasFtaCert ? 'Hàng hóa tích lũy từ các nước FTA' : 'Chưa có chứng từ C/O ưu đãi' 
    };
  }
}

// Retry OCR for failed documents
async function retryOcrForDocument(coId, documentId) {
  const co = await CoApplication.findById(coId);
  if (!co) {
    const err = new Error('Không tìm thấy hồ sơ');
    err.status = constants.HTTP_STATUS.NOT_FOUND;
    throw err;
  }

  const doc = await Document.findById(documentId);
  if (!doc) {
    const err = new Error('Không tìm thấy chứng từ');
    err.status = constants.HTTP_STATUS.NOT_FOUND;
    throw err;
  }

  if (doc.coApplicationId.toString() !== coId) {
    const err = new Error('Chứng từ không thuộc hồ sơ này');
    err.status = constants.HTTP_STATUS.BAD_REQUEST;
    throw err;
  }

  // Reset document status and retry OCR
  doc.status = 'OCR_PROCESSING';
  doc.ocrResult = '';
  await doc.save();

  // Start OCR job
  setImmediate(() => startOcrJob(documentId).catch((err) => {
    console.error(`[Retry OCR] Failed for document ${documentId}:`, err);
  }));

  console.log(`[Retry OCR] Retrying OCR for document ${documentId}`);

  return { message: 'OCR retry started', documentId };
}

// Check OCR status for CoApplication
async function checkOcrStatus(coId) {
  const co = await CoApplication.findById(coId);
  if (!co) {
    const err = new Error('Không tìm thấy hồ sơ');
    err.status = constants.HTTP_STATUS.NOT_FOUND;
    throw err;
  }

  // Get documents uploaded in Step 3.2
  const documents = await Document.find({ 
    coApplicationId: co._id 
  }).select('_id fileName status ocrResult').lean();

  const processing = documents.filter(d => d.status === 'OCR_PROCESSING');
  const completed = documents.filter(d => d.status === 'OCR_COMPLETED');
  const failed = documents.filter(d => d.status === 'REJECTED' || d.status === 'OCR_FAILED');

  let ocrStatus = 'COMPLETED';
  if (processing.length > 0) {
    ocrStatus = 'PROCESSING';
  } else if (failed.length > 0) {
    ocrStatus = 'FAILED';
    co.ocrFailedDocuments = failed.map(d => d._id);
  }

  co.ocrStatus = ocrStatus;
  await co.save();

  return {
    ocrStatus,
    total: documents.length,
    processing: processing.length,
    completed: completed.length,
    failed: failed.length,
    failedDocuments: failed.map(d => ({ id: d._id, fileName: d.fileName }))
  };
}

module.exports = {
  listAvailableBundles,
  createCoApplication,
  listCoApplications,
  getCoApplication,
  uploadDocumentsAndOCR,
  matchOriginRules,
  applyLogicEngine,
  generatePDF,
  // New workflow functions
  selectFormType,
  autoFillFormB,
  aiLookupRules,
  selectCriteria,
  aiGenerateMaterialsBreakdown,
  retryOcrForDocument,
  checkOcrStatus
}
