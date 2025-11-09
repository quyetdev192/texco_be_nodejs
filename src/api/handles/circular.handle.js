const mongoose = require('mongoose');
const axios = require('axios');
const XLSX = require('xlsx');
const CircularBundleModelClass = require('../models/circularBundle.model');
const HsChapterModelClass = require('../models/hsChapter.model');
const OriginRuleModelClass = require('../models/originRule.model');
const constants = require('../../core/utils/constants');
const helpers = require('../../core/utils/helpers');

function buildModelFromClass(modelClass) {
  const modelName = modelClass.name;
  if (mongoose.models[modelName]) return mongoose.models[modelName];
  const schemaDefinition = modelClass.getSchema();
  const schema = new mongoose.Schema(schemaDefinition, { collection: modelClass.collection });
  return mongoose.model(modelName, schema);
}

const CircularBundle = buildModelFromClass(CircularBundleModelClass);
const HsChapter = buildModelFromClass(HsChapterModelClass);
const OriginRule = buildModelFromClass(OriginRuleModelClass);

async function createCircularBundle(payload, userId) {
  const { name, formType, effectiveDate, notes, files } = payload || {};
  if (!name || !formType) {
    const err = new Error('Thiếu trường bắt buộc: name, formType');
    err.status = constants.HTTP_STATUS.UNPROCESSABLE_ENTITY;
    err.code = constants.ERROR_CODES.VALIDATION_REQUIRED_FIELD;
    throw err;
  }
  if (!Array.isArray(files) || files.length === 0) {
    const err = new Error('Thiếu danh sách files');
    err.status = constants.HTTP_STATUS.UNPROCESSABLE_ENTITY;
    err.code = constants.ERROR_CODES.VALIDATION_REQUIRED_FIELD;
    throw err;
  }

  await CircularBundle.updateMany({}, { $set: { isActive: false, updatedAt: new Date() } });

  const doc = await CircularBundle.create({
    name: name.trim(),
    formType: String(formType).trim(),
    files: files.map(f => ({ type: f.type, url: f.url, filename: f.filename })),
    effectiveDate: effectiveDate ? new Date(effectiveDate) : undefined,
    notes: notes || '',
    isActive: true,
    hasImportedPL1: false,
    isRemoved: false,
    uploadedBy: userId || undefined
  });

  return doc.toObject();
}

async function listCircularBundles(query) {
  const { page, limit, skip, sort } = helpers.buildPagination(query, { sort: '-createdAt' });
  const conditions = {};
  const keyword = (query.search || '').trim();
  if (keyword) conditions.$or = [{ name: { $regex: keyword, $options: 'i' } }, { notes: { $regex: keyword, $options: 'i' } }];
  if (query.formType) conditions.formType = String(query.formType).trim();
  if (typeof query.isActive !== 'undefined') {
    const val = String(query.isActive).toLowerCase();
    conditions.isActive = (val === 'true' || val === '1');
  }
  if (!('includeRemoved' in (query || {}))) {
    conditions.isRemoved = false;
  } else if (String(query.includeRemoved).toLowerCase() !== 'true') {
    conditions.isRemoved = false;
  }
  

  const [items, total] = await Promise.all([
    CircularBundle.find(conditions).sort(sort).skip(skip).limit(limit).lean(),
    CircularBundle.countDocuments(conditions)
  ]);
  const mapped = items.map(it => ({
    ...it,
    canUploadPL1: !it.hasImportedPL1 && !it.isRemoved
  }));
  return { items: mapped, pagination: helpers.buildPaginationMeta(total, page, limit) };
}

// removed detail API per optimization

async function activateCircular(id) {
  if (!id || !mongoose.isValidObjectId(id)) {
    const err = new Error('ID không hợp lệ');
    err.status = constants.HTTP_STATUS.BAD_REQUEST;
    err.code = constants.ERROR_CODES.VALIDATION_INVALID_FORMAT;
    throw err;
  }
  await CircularBundle.updateMany({}, { $set: { isActive: false, updatedAt: new Date() } });
  const updated = await CircularBundle.findByIdAndUpdate(id, { $set: { isActive: true, updatedAt: new Date() } }, { new: true, lean: true });
  if (!updated) {
    const err = new Error('Không tìm thấy bundle');
    err.status = constants.HTTP_STATUS.NOT_FOUND;
    err.code = constants.ERROR_CODES.DB_NOT_FOUND;
    throw err;
  }
  return updated;
}

// removed archive per optimization

function normalize(text) {
  return String(text || '').trim();
}

function isHeaderRow(c1, c2, c3, c4) {
  const s1 = normalize(c1).toLowerCase();
  const s2 = normalize(c2).toLowerCase();
  const s3 = normalize(c3).toLowerCase();
  const s4 = normalize(c4).toLowerCase();
  return (
    s1.includes('mã hs') ||
    s2.includes('phân nhóm') ||
    s3.includes('mô tả') ||
    s4.includes('tiêu chí')
  );
}

function detectChapter(row1, row3) {
  const a = normalize(row1).toUpperCase();
  const b = normalize(row3); // Lấy tên Chương từ cột 3
  if (a.startsWith('CHƯƠNG')) {
    const parts = a.split(/[\s:]+/); // Tách bằng space hoặc dấu :
    const chapterNumber = parts[1] || '';
    return { chapterNumber: chapterNumber.padStart(2, '0'), name: b };
  }
  return null;
}

async function importPL1FromExcel(circularId, fileUrl, formType) {
  // --- Phần kiểm tra (validation) đầu vào của bạn là tốt, giữ nguyên ---
  if (!circularId || !mongoose.isValidObjectId(circularId)) {
    const err = new Error('circularId không hợp lệ');
    err.status = constants.HTTP_STATUS.BAD_REQUEST;
    err.code = constants.ERROR_CODES.VALIDATION_INVALID_FORMAT;
    throw err;
  }
  if (!fileUrl) {
    const err = new Error('Thiếu fileUrl');
    err.status = constants.HTTP_STATUS.UNPROCESSABLE_ENTITY;
    err.code = constants.ERROR_CODES.VALIDATION_REQUIRED_FIELD;
    throw err;
  }
  const circular = await CircularBundle.findById(circularId).lean();
  if (!circular) {
    const err = new Error('Không tìm thấy circular');
    err.status = constants.HTTP_STATUS.NOT_FOUND;
    err.code = constants.ERROR_CODES.DB_NOT_FOUND;
    throw err;
  }

  // --- Phần đọc Excel/CSV của bạn là tốt, giữ nguyên ---
  const res = await axios.get(fileUrl, { responseType: 'arraybuffer' });
  const workbook = XLSX.read(res.data, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });

  // Validate bundle and single-import rule
  const bundle = await CircularBundle.findById(circularId).lean();
  if (!bundle) {
    const err = new Error('Không tìm thấy circular');
    err.status = constants.HTTP_STATUS.NOT_FOUND;
    err.code = constants.ERROR_CODES.DB_NOT_FOUND;
    throw err;
  }
  if (bundle.isRemoved) {
    const err = new Error('Circular đã bị xoá');
    err.status = constants.HTTP_STATUS.BAD_REQUEST;
    err.code = constants.ERROR_CODES.VALIDATION_INVALID_STATE;
    throw err;
  }
  if (bundle.hasImportedPL1) {
    const err = new Error('Circular đã import Phụ lục I');
    err.status = constants.HTTP_STATUS.BAD_REQUEST;
    err.code = constants.ERROR_CODES.VALIDATION_INVALID_STATE;
    throw err;
  }

  // Prefetch existing chapters to reduce queries
  const existingChapters = await HsChapter.find({ circularId, formType }).lean();
  const chapterCache = new Map(existingChapters.map(c => [String(c.chapterNumber).padStart(2, '0'), c]));

  // State across rows
  let currentChapter = null;
  let currentHsGroup = "";
  let currentHsGroupDescription = "";
  let hasSeenChapter = false;

  let createdChapters = 0;
  let createdRules = 0;
  const errors = [];
  const rulesBuffer = [];
  const FLUSH_SIZE = 1000;

  // Lặp qua từng dòng trong file excel
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    
    // Bỏ qua nếu là dòng trống (undefined, null, hoặc mảng rỗng)
    if (!row || row.length === 0) continue;

    const c1 = normalize(row[0]); // Cột "Nhóm" (hoặc "CHƯƠNG")
    const c2 = normalize(row[1]); // Cột "Phân nhóm"
    const c3 = normalize(row[2]); // Cột "Mô tả"
    const c4 = normalize(row[3]); // Cột "Tiêu chí"

    
    const ch = detectChapter(c1, c3); // Dùng hàm detectChapter đã sửa (lấy c1, c3)
    if (ch && ch.chapterNumber) {
      const key = ch.chapterNumber;
      let chapterDoc = chapterCache.get(key);
      if (!chapterDoc) {
        const created = await HsChapter.create({ circularId, chapterNumber: key, name: ch.name, formType });
        chapterDoc = created.toObject();
        chapterCache.set(key, chapterDoc);
        createdChapters++;
      }
      currentChapter = chapterDoc; // Cập nhật trạng thái "Chương"
      hasSeenChapter = true;
      
      // Khi sang Chương mới, reset "Nhóm"
      currentHsGroup = "";
      currentHsGroupDescription = "";
      continue; // Đã xử lý xong dòng này, chuyển sang dòng tiếp theo
    }

    
    if (c1 && !c2 && !c4 && c3) {
      currentHsGroup = c1.replace(/\./g, ''); // Cập nhật trạng thái "Nhóm" (VD: "101")
      currentHsGroupDescription = c3; // Cập nhật mô tả "Nhóm"
      continue; // Đã xử lý xong dòng này, chuyển sang dòng tiếp theo
    }

    
    if (c2 && c4) {
      if (!currentChapter) {
        if (!isHeaderRow(c1, c2, c3, c4) && hasSeenChapter) {
          errors.push({ row: i + 1, code: 'NO_CHAPTER', message: 'Thiếu dòng CHƯƠNG trước khi khai quy tắc' });
        }
        continue;
      }

      let hsGroup = currentHsGroup;
      // Giữ nguyên dấu phẩy, chỉ bỏ dấu chấm và khoảng trắng
      const hsSubgroup = String(c2 || '').replace(/\./g, '').replace(/\s/g, '').trim();
      if (!hsGroup && hsSubgroup) {
        // Lấy 4 ký tự đầu (trước dấu phẩy nếu có)
        const beforeComma = hsSubgroup.split(',')[0];
        if (beforeComma.length >= 4) {
          hsGroup = beforeComma.substring(0, 4);
        }
      }
      if (!hsGroup) {
        errors.push({ row: i + 1, code: 'HS_GROUP_MISSING', message: 'Thiếu Mã HS Nhóm (4 số)' });
        continue;
      }

      rulesBuffer.push({
        circularId,
        chapterId: currentChapter._id,
        formType,
        hsGroup,
        hsGroupDescription: currentHsGroupDescription,
        hsSubgroup,
        description: c3,
        criteria: c4,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      if (rulesBuffer.length >= FLUSH_SIZE) {
        const inserted = await OriginRule.insertMany(rulesBuffer, { ordered: false });
        createdRules += inserted.length;
        rulesBuffer.length = 0;
      }
    }

    // Các dòng trống, dòng tiêu đề CSV, hoặc dòng rác khác sẽ tự động bị bỏ qua
    // vì không khớp với 1 trong 3 trường hợp trên.
  }

  if (rulesBuffer.length) {
    const inserted = await OriginRule.insertMany(rulesBuffer, { ordered: false });
    createdRules += inserted.length;
  }
  // mark hasImportedPL1=true
  await CircularBundle.findByIdAndUpdate(circularId, { $set: { hasImportedPL1: true, updatedAt: new Date() } });
  return { createdChapters, createdRules, errors };
}

// removed separate chapters list; unified search via listOriginRules

async function listOriginRules(query) {
  const { page, limit, skip, sort } = helpers.buildPagination(query, { sort: 'hsSubgroup' });
  const conditions = {};
  if (query.formType) conditions.formType = String(query.formType).trim();
  if (query.circularId && mongoose.isValidObjectId(query.circularId)) conditions.circularId = query.circularId;
  if (query.chapterId && mongoose.isValidObjectId(query.chapterId)) conditions.chapterId = query.chapterId;
  if (query.chapterNumber) {
    const chapter = await HsChapter.findOne({ chapterNumber: String(query.chapterNumber).padStart(2, '0'), formType: conditions.formType }).lean();
    if (chapter) conditions.chapterId = chapter._id;
  }
  if (query.hsGroup) conditions.hsGroup = String(query.hsGroup).trim();
  if (query.hsSubgroup) conditions.hsSubgroup = String(query.hsSubgroup).trim();
  if (query.criteria) conditions.criteria = String(query.criteria).trim();
  const keyword = (query.search || '').trim();
  if (keyword) conditions.description = { $regex: keyword, $options: 'i' };

  const [items, total] = await Promise.all([
    OriginRule.find(conditions).sort(sort).skip(skip).limit(limit).lean(),
    OriginRule.countDocuments(conditions)
  ]);
  const chapterIds = [...new Set(items.map(i => String(i.chapterId)))];
  const chapters = await HsChapter.find({ _id: { $in: chapterIds } }).lean();
  const chapterMap = new Map(chapters.map(c => [String(c._id), c]));
  const enriched = items.map(i => {
    const ch = chapterMap.get(String(i.chapterId));
    return {
      ...i,
      chapterNumber: ch?.chapterNumber || '',
      chapterName: ch?.name || ''
    };
  });
  return { items: enriched, pagination: helpers.buildPaginationMeta(total, page, limit) };
}
// removed detail rule per optimization

module.exports = {
  createCircularBundle,
  listCircularBundles,
  activateCircular,
  importPL1FromExcel,
  listOriginRules,
  
};

async function deleteCircular(id) {
  if (!id || !mongoose.isValidObjectId(id)) {
    const err = new Error('ID không hợp lệ');
    err.status = constants.HTTP_STATUS.BAD_REQUEST;
    err.code = constants.ERROR_CODES.VALIDATION_INVALID_FORMAT;
    throw err;
  }
  const updated = await CircularBundle.findByIdAndUpdate(id, { $set: { isRemoved: true, isActive: false, updatedAt: new Date() } }, { new: true, lean: true });
  if (!updated) {
    const err = new Error('Không tìm thấy bundle');
    err.status = constants.HTTP_STATUS.NOT_FOUND;
    err.code = constants.ERROR_CODES.DB_NOT_FOUND;
    throw err;
  }
  return updated;
}

module.exports.deleteCircular = deleteCircular;

async function validatePL1AndCollectErrors(circularId, fileUrl, formType) {
  if (!circularId || !mongoose.isValidObjectId(circularId)) {
    const err = new Error('circularId không hợp lệ');
    err.status = constants.HTTP_STATUS.BAD_REQUEST;
    err.code = constants.ERROR_CODES.VALIDATION_INVALID_FORMAT;
    throw err;
  }
  if (!fileUrl) {
    const err = new Error('Thiếu fileUrl');
    err.status = constants.HTTP_STATUS.UNPROCESSABLE_ENTITY;
    err.code = constants.ERROR_CODES.VALIDATION_REQUIRED_FIELD;
    throw err;
  }
  const res = await axios.get(fileUrl, { responseType: 'arraybuffer' });
  const workbook = XLSX.read(res.data, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });

  let currentChapter = null;
  let currentHsGroup = '';
  let hasSeenChapter = false;
  const errors = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] || [];
    const c1 = normalize(row[0]);
    const c2 = normalize(row[1]);
    const c3 = normalize(row[2]);
    const c4 = normalize(row[3]);

    const ch = detectChapter(c1, c3);
    if (ch && ch.chapterNumber) {
      currentChapter = ch;
      currentHsGroup = '';
      hasSeenChapter = true;
      continue;
    }

    if (c1 && !c2 && !c4 && c3) {
      currentHsGroup = c1.replace(/\./g, '');
      continue;
    }

    if (c2 && c4) {
      if (!currentChapter) {
        if (!isHeaderRow(c1, c2, c3, c4) && hasSeenChapter) {
          errors.push({ row: i + 1, code: 'NO_CHAPTER', message: 'Thiếu CHƯƠNG', data: { c1, c2, c3, c4 } });
        }
        continue;
      }
      let hsGroup = currentHsGroup;
      // Giữ nguyên dấu phẩy, chỉ bỏ dấu chấm và khoảng trắng
      const hsSubgroup = String(c2 || '').replace(/\./g, '').replace(/\s/g, '').trim();
      if (!hsGroup && hsSubgroup) {
        const beforeComma = hsSubgroup.split(',')[0];
        if (beforeComma.length >= 4) hsGroup = beforeComma.substring(0, 4);
      }
      if (!hsGroup) {
        errors.push({ row: i + 1, code: 'HS_GROUP_MISSING', message: 'Thiếu HS Nhóm (4 số)', data: { c1, c2, c3, c4 } });
      }
    }
  }

  return { totalRows: rows.length, errors };
}

async function exportPL1ErrorsExcel(circularId, fileUrl, formType) {
  const { errors } = await validatePL1AndCollectErrors(circularId, fileUrl, formType);
  const headers = ['Row', 'Code', 'Message', 'C1_Nhom', 'C2_PhanNhom', 'C3_MoTa', 'C4_TieuChi'];
  const data = [headers];
  for (const e of errors) {
    data.push([
      e.row || '',
      e.code || '',
      e.message || '',
      e.data?.c1 || '',
      e.data?.c2 || '',
      e.data?.c3 || '',
      e.data?.c4 || ''
    ]);
  }
  if (data.length === 1) data.push(['', '', 'Không phát hiện lỗi', '', '', '', '']);
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, 'Errors');
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const filename = 'pl1-errors.xlsx';
  return { filename, buffer, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
}

module.exports.exportPL1ErrorsExcel = exportPL1ErrorsExcel;
