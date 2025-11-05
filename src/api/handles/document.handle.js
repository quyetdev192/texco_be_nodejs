const mongoose = require('mongoose');
const DocumentModelClass = require('../models/document.model');
const BundleModelClass = require('../models/bundle.model');
const UserModelClass = require('../models/user.model');
const CompanyModelClass = require('../models/company.model');
const constants = require('../../core/utils/constants');
const helpers = require('../../core/utils/helpers');

// OCR concurrency controls (in-memory)
let currentOcrWorkers = 0;
const ocrQueue = [];
const OCR_MAX_CONCURRENCY = parseInt(process.env.OCR_MAX_CONCURRENCY || '3', 10);

function enqueueOcr(documentId) {
    return new Promise((resolve) => {
        ocrQueue.push({ documentId, resolve });
        drainOcrQueue();
    });
}

function drainOcrQueue() {
    while (currentOcrWorkers < OCR_MAX_CONCURRENCY && ocrQueue.length > 0) {
        const job = ocrQueue.shift();
        currentOcrWorkers += 1;
        runOcrJob(job.documentId)
            .catch(() => {})
            .finally(() => {
                currentOcrWorkers -= 1;
                job.resolve();
                setImmediate(drainOcrQueue);
            });
    }
}

function buildModelFromClass(modelClass) {
    const modelName = modelClass.name;
    if (mongoose.models[modelName]) return mongoose.models[modelName];
    const schemaDefinition = modelClass.getSchema();
    const schema = new mongoose.Schema(schemaDefinition, { collection: modelClass.collection });
    return mongoose.model(modelName, schema);
}

const Document = buildModelFromClass(DocumentModelClass);
const Bundle = buildModelFromClass(BundleModelClass);
const User = buildModelFromClass(UserModelClass);
const Company = buildModelFromClass(CompanyModelClass);

// Helper function to calculate and update bundle status from documents
async function updateBundleStatusFromDocuments(bundleId) {
    if (!bundleId) return;
    
    const documents = await Document.find({ bundleId }).select('status').lean();
    if (!documents || documents.length === 0) return;

    const statuses = documents.map(d => d.status);
    const uniqueStatuses = [...new Set(statuses)];
    
    let newBundleStatus;
    
    // Logic: 
    // - Nếu có document REJECTED (do OCR lỗi) → OCR_FAILED
    // - Nếu tất cả OCR_COMPLETED → OCR_COMPLETED
    // - Nếu còn OCR_PROCESSING → OCR_PROCESSING
    // - Nếu còn PENDING_REVIEW → PENDING_REVIEW
    
    if (statuses.includes('REJECTED')) {
        // Có document bị reject (OCR lỗi) → Bundle OCR_FAILED
        newBundleStatus = 'OCR_FAILED';
    } else if (statuses.every(s => s === 'OCR_COMPLETED')) {
        // Tất cả đã OCR thành công
        newBundleStatus = 'OCR_COMPLETED';
    } else if (statuses.includes('OCR_PROCESSING')) {
        // Còn đang xử lý
        newBundleStatus = 'OCR_PROCESSING';
    } else if (statuses.includes('PENDING_REVIEW')) {
        // Còn chờ duyệt
        newBundleStatus = 'PENDING_REVIEW';
    } else {
        // Default
        newBundleStatus = 'PENDING_REVIEW';
    }

    // Cập nhật bundle status nếu khác với status hiện tại
    const bundle = await Bundle.findById(bundleId);
    if (bundle && bundle.status !== newBundleStatus) {
        bundle.status = newBundleStatus;
        bundle.updatedAt = new Date();
        await bundle.save();
    }
}

// Supplier: Upload một bộ chứng từ (nhiều file)
async function supplierCreate(userId, payload) {
    const { bundleName, documents } = payload || {};
    if (!bundleName || !bundleName.trim()) {
        const err = new Error('Tên bộ chứng từ không được để trống');
        err.status = constants.HTTP_STATUS.UNPROCESSABLE_ENTITY;
        err.code = constants.ERROR_CODES.VALIDATION_REQUIRED_FIELD;
        throw err;
    }
    if (!Array.isArray(documents) || documents.length === 0) {
        const err = new Error('Danh sách chứng từ trống');
        err.status = constants.HTTP_STATUS.UNPROCESSABLE_ENTITY;
        err.code = constants.ERROR_CODES.VALIDATION_REQUIRED_FIELD;
        throw err;
    }

    const user = await User.findById(userId).lean();
    if (!user) {
        const err = new Error('Không tìm thấy người dùng');
        err.status = constants.HTTP_STATUS.UNAUTHORIZED;
        throw err;
    }

    // Tạo Bundle trước
    const bundle = await Bundle.create({
        bundleName: bundleName.trim(),
        status: 'PENDING_REVIEW',
        companyId: user.companyId,
        uploadedBy: userId
    });

    // Tạo Documents
    const docsToInsert = [];
    const failed = [];
    documents.forEach((d, idx) => {
        if (!d || !d.fileName || !d.storagePath || !d.documentType) {
            failed.push({ index: idx, message: 'Thiếu fileName/storagePath/documentType' });
            return;
        }
        const ocrPages = Array.isArray(d.ocrPages)
        ? d.ocrPages.filter(p => p && p.ocrStoragePath) // Lọc các URL ảnh hợp lệ
        : [];

    if (ocrPages.length === 0) {
         failed.push({ index: idx, message: 'Thiếu ocrPages (danh sách URL ảnh OCR cho từng trang)' });
         return;
    }

    docsToInsert.push({
        fileName: d.fileName,
        storagePath: d.storagePath,
        documentType: d.documentType,
        bundleId: bundle._id,
        note: d.note || '',
        ocrPages: ocrPages, 
        companyId: user.companyId,
        uploadedBy: userId,
        status: 'PENDING_REVIEW'
    });
});

if (docsToInsert.length === 0) {
    // Xóa bundle nếu không có document hợp lệ
    await Bundle.findByIdAndDelete(bundle._id);
    const err = new Error('Không có chứng từ hợp lệ để tạo');
    err.status = constants.HTTP_STATUS.UNPROCESSABLE_ENTITY;
    throw err;
}
const inserted = await Document.insertMany(docsToInsert);    
    // Populate và trả về bundle detail
    const bundleDetail = await Bundle.findById(bundle._id)
        .populate('companyId', 'name taxCode type')
        .populate('uploadedBy', 'username email fullName')
        .lean();
    
    // Add text fields
    bundleDetail.status_text = helpers.getStatusText(bundleDetail.status);
    bundleDetail.bundleStatus_text = bundleDetail.status_text;
    
    bundleDetail.documents = inserted.map(doc => {
        const docObj = doc.toObject();
        docObj.status_text = helpers.getStatusText(docObj.status);
        docObj.documentType_text = helpers.getDocumentTypeText(docObj.documentType);
        return docObj;
    });
    
    return { ...bundleDetail, failed };
}

// Supplier: Cập nhật bộ chứng từ (có thể thêm/sửa/xóa file, cập nhật bundleName)
async function supplierUpdate(userId, bundleId, payload) {
    if (!bundleId || !mongoose.isValidObjectId(bundleId)) {
        const err = new Error('BundleId không hợp lệ');
        err.status = constants.HTTP_STATUS.BAD_REQUEST;
        throw err;
    }

    // Kiểm tra bundle thuộc về user
    const bundle = await Bundle.findOne({ _id: bundleId, uploadedBy: new mongoose.Types.ObjectId(userId) });
    if (!bundle) {
        const err = new Error('Không tìm thấy bộ chứng từ');
        err.status = constants.HTTP_STATUS.NOT_FOUND;
        throw err;
    }

    // Kiểm tra bundle status - không cho sửa khi đang/đã OCR
    if (bundle.status === 'OCR_PROCESSING' || bundle.status === 'OCR_COMPLETED') {
        const err = new Error('Không thể sửa khi bộ chứng từ đang/đã OCR');
        err.status = constants.HTTP_STATUS.CONFLICT;
        throw err;
    }

    const { bundleName, documents } = payload || {};

    // Cập nhật bundleName nếu có
    if (bundleName !== undefined && bundleName.trim()) {
        bundle.bundleName = bundleName.trim();
        bundle.updatedAt = new Date();
        await bundle.save();
    }

    // Xử lý documents: thêm mới, cập nhật, xóa
    if (Array.isArray(documents)) {
        const user = await User.findById(userId).lean();
        if (!user) {
            const err = new Error('Không tìm thấy người dùng');
            err.status = constants.HTTP_STATUS.UNAUTHORIZED;
            throw err;
        }

        const existingDocs = await Document.find({ bundleId: bundle._id }).lean();
        const existingIds = existingDocs.map(d => d._id.toString());
        const providedIds = documents.filter(d => d._id && mongoose.isValidObjectId(d._id)).map(d => d._id.toString());
        const idsToDelete = existingIds.filter(id => !providedIds.includes(id));

        // Xóa các documents không còn trong danh sách
        if (idsToDelete.length > 0) {
            await Document.deleteMany({ _id: { $in: idsToDelete.map(id => new mongoose.Types.ObjectId(id)) } });
        }

        // Cập nhật hoặc thêm mới
        for (const doc of documents) {
            if (doc._id && mongoose.isValidObjectId(doc._id)) {
                // Cập nhật document existing
                const updateData = {};
                if (doc.fileName !== undefined) updateData.fileName = doc.fileName;
                if (doc.storagePath !== undefined) updateData.storagePath = doc.storagePath;
                if (doc.documentType !== undefined) updateData.documentType = doc.documentType;
                if (doc.note !== undefined) updateData.note = doc.note;
                // Chuẩn hóa cập nhật ảnh
                let normalizedImagesUpdate = [];
                if (Array.isArray(doc.base64Images)) {
                    normalizedImagesUpdate = doc.base64Images
                        .filter(it => it && typeof it.content === 'string' && it.content.trim().length > 0)
                        .map((it, i) => ({ content: it.content, mimeType: it.mimeType || doc.mimeType || 'image/png', page: it.page ?? (i + 1) }));
                } else if (Array.isArray(doc.base64ContentPages)) {
                    normalizedImagesUpdate = doc.base64ContentPages
                        .filter(s => typeof s === 'string' && s.trim().length > 0)
                        .map((content, i) => ({ content, mimeType: doc.mimeType || 'image/png', page: i + 1 }));
                } else if (doc.base64Content !== undefined) {
                    if (doc.base64Content) {
                        normalizedImagesUpdate = [{ content: doc.base64Content, mimeType: doc.mimeType || 'image/png', page: 1 }];
                    } else {
                        normalizedImagesUpdate = [];
                    }
                }
                if (normalizedImagesUpdate.length > 0) {
                    updateData.base64Images = normalizedImagesUpdate;
                    updateData.base64Content = normalizedImagesUpdate[0].content;
                    updateData.mimeType = normalizedImagesUpdate[0].mimeType;
                } else {
                    if (doc.mimeType !== undefined) updateData.mimeType = doc.mimeType;
                    if (doc.base64Content !== undefined) updateData.base64Content = doc.base64Content;
                }
                updateData.updatedAt = new Date();

                await Document.findByIdAndUpdate(doc._id, { $set: updateData });
            } else {
                // Thêm document mới
                if (!doc.fileName || !doc.storagePath || !doc.documentType) {
                    continue; // Skip invalid documents
                }
                let normalizedImagesNew = [];
                if (Array.isArray(doc.base64Images)) {
                    normalizedImagesNew = doc.base64Images
                        .filter(it => it && typeof it.content === 'string' && it.content.trim().length > 0)
                        .map((it, i) => ({ content: it.content, mimeType: it.mimeType || doc.mimeType || 'image/png', page: it.page ?? (i + 1) }));
                } else if (Array.isArray(doc.base64ContentPages)) {
                    normalizedImagesNew = doc.base64ContentPages
                        .filter(s => typeof s === 'string' && s.trim().length > 0)
                        .map((content, i) => ({ content, mimeType: doc.mimeType || 'image/png', page: i + 1 }));
                } else if (doc.base64Content) {
                    normalizedImagesNew = [{ content: doc.base64Content, mimeType: doc.mimeType || 'image/png', page: 1 }];
                }
                const firstNew = normalizedImagesNew[0];
                await Document.create({
                    fileName: doc.fileName,
                    storagePath: doc.storagePath,
                    documentType: doc.documentType,
                    bundleId: bundle._id,
                    note: doc.note || '',
                    base64Images: normalizedImagesNew.length > 0 ? normalizedImagesNew : undefined,
                    base64Content: firstNew ? firstNew.content : undefined,
                    mimeType: firstNew ? firstNew.mimeType : (doc.mimeType || undefined),
                    companyId: user.companyId,
                    uploadedBy: userId,
                    status: 'PENDING_REVIEW'
                });
            }
        }
    }

    // Trả về bundle detail sau khi cập nhật (đã có status_text và documentType_text)
    return await getBundleDetail(userId, bundleId.toString(), false);
}

async function supplierList(userId, query) {
    const { page, limit, skip, sort } = helpers.buildPagination(query, { sort: '-createdAt' });
    const conditions = { uploadedBy: new mongoose.Types.ObjectId(userId) };
    if (query.status) conditions.status = query.status;
    if (query.bundleName) conditions.bundleName = { $regex: query.bundleName, $options: 'i' };
    if (query.bundleId && mongoose.isValidObjectId(query.bundleId)) {
        conditions._id = new mongoose.Types.ObjectId(query.bundleId);
    }
    const range = helpers.buildDateRange(query.fromDate, query.toDate);
    if (range) conditions.createdAt = range;

    // Query từ Bundle model
    const [bundles, total] = await Promise.all([
        Bundle.find(conditions)
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .populate('companyId', 'name taxCode type')
            .populate('uploadedBy', 'username email fullName')
            .populate('approvedBy', 'username email fullName phone')
            .lean(),
        Bundle.countDocuments(conditions)
    ]);

    // Lấy documents cho từng bundle
    const bundleIds = bundles.map(b => b._id);
    let allDocuments = [];
    if (bundleIds.length > 0) {
        allDocuments = await Document.find({ bundleId: { $in: bundleIds } })
            .select('_id fileName storagePath documentType status note ocrResult rejectionReason createdAt updatedAt bundleId')
            .lean();
    }

    // Group documents theo bundleId
    const docsByBundle = {};
    allDocuments.forEach(doc => {
        if (!doc.bundleId) return; // Skip documents without bundleId (shouldn't happen, but safety check)
        const bundleIdStr = doc.bundleId.toString();
        if (!docsByBundle[bundleIdStr]) {
            docsByBundle[bundleIdStr] = [];
        }
        docsByBundle[bundleIdStr].push(doc);
    });

    // Attach documents to bundles
    const items = bundles.map(bundle => {
        const bundleIdStr = bundle._id.toString();
        const bundleStatusText = helpers.getStatusText(bundle.status);
        const documents = (docsByBundle[bundleIdStr] || []).map(doc => ({
            ...doc,
            status_text: helpers.getStatusText(doc.status),
            documentType_text: helpers.getDocumentTypeText(doc.documentType)
        }));
        
        return {
            _id: bundle._id,
            bundleName: bundle.bundleName,
            status: bundle.status,
            status_text: bundleStatusText,
            bundleStatus: bundle.status,
            bundleStatus_text: bundleStatusText,
            rejectionReason: bundle.rejectionReason,
            reviewNotes: bundle.reviewNotes || [],
            companyId: bundle.companyId,
            uploadedBy: bundle.uploadedBy,
            approvedBy: bundle.approvedBy, // populated with username, email, fullName, phone
            approvedAt: bundle.approvedAt,
            createdAt: bundle.createdAt,
            updatedAt: bundle.updatedAt,
            documents: documents
        };
    });

    return { items, pagination: helpers.buildPaginationMeta(total, page, limit) };
}


async function getBundleDetail(userId, bundleId, allowAnyOwner = false) {
    if (!bundleId || !mongoose.isValidObjectId(bundleId)) {
        const err = new Error('BundleId không hợp lệ');
        err.status = 400;
        throw err;
    }
    
    const conditions = { _id: new mongoose.Types.ObjectId(bundleId) };
    if (!allowAnyOwner) {
        conditions.uploadedBy = new mongoose.Types.ObjectId(userId);
    }
    
    const bundle = await Bundle.findOne(conditions)
        .populate('companyId', 'name taxCode type')
        .populate('uploadedBy', 'username email fullName')
        .populate('approvedBy', 'username email fullName')
        .lean();
    
    if (!bundle) {
        const err = new Error('Không tìm thấy bộ chứng từ');
        err.status = 404;
        throw err;
    }
    
    // Lấy documents của bundle
    const documents = await Document.find({ bundleId: bundle._id })
        .select('_id fileName storagePath documentType status note ocrResult rejectionReason createdAt updatedAt')
        .lean();
    
    const bundleStatusText = helpers.getStatusText(bundle.status);
    const documentsWithText = documents.map(doc => ({
        ...doc,
        status_text: helpers.getStatusText(doc.status),
        documentType_text: helpers.getDocumentTypeText(doc.documentType)
    }));
    
    return {
        _id: bundle._id,
        bundleName: bundle.bundleName,
        status: bundle.status,
        status_text: bundleStatusText,
        bundleStatus: bundle.status,
        bundleStatus_text: bundleStatusText,
        rejectionReason: bundle.rejectionReason,
        reviewNotes: bundle.reviewNotes || [],
        companyId: bundle.companyId,
        uploadedBy: bundle.uploadedBy,
        approvedBy: bundle.approvedBy,
        approvedAt: bundle.approvedAt,
        createdAt: bundle.createdAt,
        updatedAt: bundle.updatedAt,
        documents: documentsWithText
    };
}

async function staffList(query) {
    const { page, limit, skip, sort } = helpers.buildPagination(query, { sort: '-createdAt' });
    const conditions = {};
    if (query.status) conditions.status = query.status;
    if (query.companyId && mongoose.isValidObjectId(query.companyId)) {
        conditions.companyId = new mongoose.Types.ObjectId(query.companyId);
    }
    if (query.bundleName) conditions.bundleName = { $regex: query.bundleName, $options: 'i' };
    if (query.bundleId && mongoose.isValidObjectId(query.bundleId)) {
        conditions._id = new mongoose.Types.ObjectId(query.bundleId);
    }
    const range = helpers.buildDateRange(query.fromDate, query.toDate);
    if (range) conditions.createdAt = range;

    // Query từ Bundle model
    const [bundles, total] = await Promise.all([
        Bundle.find(conditions)
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .populate('companyId', 'name taxCode type')
            .populate('uploadedBy', 'username email fullName')
            .populate('approvedBy', 'username email fullName')
            .lean(),
        Bundle.countDocuments(conditions)
    ]);

    // Lấy documents cho từng bundle
    const bundleIds = bundles.map(b => b._id);
    let allDocuments = [];
    if (bundleIds.length > 0) {
        allDocuments = await Document.find({ bundleId: { $in: bundleIds } })
            .select('_id fileName storagePath documentType status note ocrResult rejectionReason createdAt updatedAt bundleId')
            .lean();
    }

    // Group documents theo bundleId
    const docsByBundle = {};
    allDocuments.forEach(doc => {
        if (!doc.bundleId) return; // Skip documents without bundleId (shouldn't happen, but safety check)
        const bundleIdStr = doc.bundleId.toString();
        if (!docsByBundle[bundleIdStr]) {
            docsByBundle[bundleIdStr] = [];
        }
        docsByBundle[bundleIdStr].push(doc);
    });

    // Attach documents to bundles
    const items = bundles.map(bundle => {
        const bundleIdStr = bundle._id.toString();
        const bundleStatusText = helpers.getStatusText(bundle.status);
        const documents = (docsByBundle[bundleIdStr] || []).map(doc => ({
            ...doc,
            status_text: helpers.getStatusText(doc.status),
            documentType_text: helpers.getDocumentTypeText(doc.documentType)
        }));
        
        return {
            _id: bundle._id,
            bundleName: bundle.bundleName,
            status: bundle.status,
            status_text: bundleStatusText,
            bundleStatus: bundle.status,
            bundleStatus_text: bundleStatusText,
            rejectionReason: bundle.rejectionReason,
            reviewNotes: bundle.reviewNotes || [],
            companyId: bundle.companyId,
            uploadedBy: bundle.uploadedBy,
            approvedBy: bundle.approvedBy,
            approvedAt: bundle.approvedAt,
            createdAt: bundle.createdAt,
            updatedAt: bundle.updatedAt,
            documents: documents
        };
    });

    return { items, pagination: helpers.buildPaginationMeta(total, page, limit) };
}

// Staff: Cập nhật trạng thái/ghi chú cho bộ chứng từ (approve/reject)
async function staffReview(staffUserId, bundleId, payload) {
    const { action, note } = payload || {}; // action: 'APPROVE' | 'REJECT'
    if (!bundleId || !mongoose.isValidObjectId(bundleId)) {
        const err = new Error('BundleId không hợp lệ');
        err.status = constants.HTTP_STATUS.BAD_REQUEST;
        throw err;
    }

    // Kiểm tra bundle tồn tại
    const bundle = await Bundle.findById(bundleId);
    if (!bundle) {
        const err = new Error('Không tìm thấy bộ chứng từ');
        err.status = constants.HTTP_STATUS.NOT_FOUND;
        throw err;
    }

    // Lấy documents của bundle
    const docs = await Document.find({ bundleId: bundle._id }).lean();
    if (!docs || docs.length === 0) {
        const err = new Error('Bộ chứng từ không có file nào');
        err.status = constants.HTTP_STATUS.NOT_FOUND;
        throw err;
    }

    // Lấy thông tin C/O (staff) đầy đủ
    const staffUser = await User.findById(staffUserId).lean();
    if (!staffUser) {
        const err = new Error('Không tìm thấy thông tin nhân viên');
        err.status = constants.HTTP_STATUS.UNAUTHORIZED;
        throw err;
    }

    const reviewNote = {
        by: new mongoose.Types.ObjectId(staffUserId),
        byUsername: staffUser.username || '',
        byFullName: staffUser.fullName || '',
        byEmail: staffUser.email || '',
        note: note || '',
        action: action,
        createdAt: new Date()
    };

    if (action === 'REJECT') {
        // Cập nhật Bundle
        bundle.status = 'REJECTED';
        bundle.rejectionReason = note || 'Không hợp lệ';
        bundle.reviewNotes = [...(bundle.reviewNotes || []), reviewNote];
        bundle.updatedAt = new Date();
        await bundle.save();

        // Cập nhật tất cả Documents
        await Document.updateMany(
            { bundleId: bundle._id },
            {
                $set: {
                    status: 'REJECTED',
                    rejectionReason: note || 'Không hợp lệ',
                    updatedAt: new Date()
                }
            }
        );
    } else if (action === 'APPROVE') {
        // Cập nhật Bundle
        bundle.status = 'OCR_PROCESSING';
        bundle.approvedBy = staffUserId;
        bundle.approvedAt = new Date();
        bundle.reviewNotes = [...(bundle.reviewNotes || []), reviewNote];
        bundle.updatedAt = new Date();
        await bundle.save();

        // APPROVE - update all documents to OCR_PROCESSING
        const updatePromises = [];
        docs.forEach(doc => {
            updatePromises.push(
                Document.findByIdAndUpdate(
                    doc._id,
                    {
                        $set: {
                            status: 'OCR_PROCESSING',
                            approvedBy: staffUserId,
                            approvedAt: new Date(),
                            updatedAt: new Date()
                        }
                    },
                    { new: true, lean: true }
                )
            );
            // Start OCR từng document với đầy đủ danh sách ảnh
            setImmediate(() => startOcrJob(doc._id).catch(() => {}));        });
        await Promise.all(updatePromises);
    } else {
        const err = new Error('Action không hợp lệ. Phải là APPROVE hoặc REJECT');
        err.status = constants.HTTP_STATUS.BAD_REQUEST;
        throw err;
    }

    // Return bundle detail với đầy đủ thông tin
    return await getBundleDetail(staffUserId, bundleId.toString(), true);
}

async function startOcrJob(documentId) {
    await enqueueOcr(documentId);
}

async function runOcrJob(documentId) {
    try {
        const GOOGLE_VISION_API_KEY = process.env.GOOGLE_VISION_API_KEY;
        if (!GOOGLE_VISION_API_KEY) throw new Error('Missing GOOGLE_VISION_API_KEY');

        // 1) Lấy danh sách URL ảnh OCR
        const doc = await Document.findById(documentId).select('ocrPages').lean();
        const ocrPages = doc?.ocrPages || [];
        if (ocrPages.length === 0) throw new Error('No OCR image URLs found for this document.');

        // 2) Tải ảnh song song với giới hạn
        const FETCH_CONCURRENCY = parseInt(process.env.OCR_FETCH_CONCURRENCY || '5', 10);
        const fetchedBase64 = new Array(ocrPages.length).fill(null);
        let inFlight = 0;
        let idx = 0;
        await new Promise((resolve) => {
            const pump = () => {
                while (inFlight < FETCH_CONCURRENCY && idx < ocrPages.length) {
                    const pageIndex = idx++;
                    const page = ocrPages[pageIndex];
                    inFlight += 1;
                    fetch(page.ocrStoragePath)
                        .then(r => {
                            if (!r.ok) throw new Error(`Fetch failed for page ${page.page}: ${r.statusText}`);
                            return r.arrayBuffer();
                        })
                        .then(ab => Buffer.from(ab).toString('base64'))
                        .then(base64 => { fetchedBase64[pageIndex] = base64; })
                        .catch(() => { fetchedBase64[pageIndex] = null; })
                        .finally(() => {
                            inFlight -= 1;
                            if (idx >= ocrPages.length && inFlight === 0) resolve();
                            else pump();
                        });
                }
            };
            pump();
        });

        // 3) Chia batch gọi Vision API để tránh limit
        const BATCH_SIZE = parseInt(process.env.OCR_BATCH_SIZE || '10', 10);
        const requests = fetchedBase64
            .map(b64 => (b64 ? { image: { content: b64 }, features: [{ type: 'DOCUMENT_TEXT_DETECTION' }] } : null))
            .filter(Boolean);

        const pageTexts = [];
        for (let i = 0; i < requests.length; i += BATCH_SIZE) {
            const slice = requests.slice(i, i + BATCH_SIZE);
            if (slice.length === 0) continue;
            const body = { requests: slice };
            try {
                const resp = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_API_KEY}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });
                const json = await resp.json();
                if (json.error) {
                    continue; // bỏ qua batch lỗi
                }
                const responses = Array.isArray(json.responses) ? json.responses : [];
                for (const r of responses) {
                    if (r && r.error) { pageTexts.push(''); continue; }
                    const text = r && r.fullTextAnnotation && r.fullTextAnnotation.text ? r.fullTextAnnotation.text : '';
                    pageTexts.push(text);
                }
            } catch (_) {
                continue; // bỏ qua batch lỗi
            }
        }

        const finalOcrData = pageTexts.filter(Boolean).join('\n\n--- PAGE BREAK ---\n\n');
        if (!finalOcrData) throw new Error('No OCR text extracted from any page');

        const updatedDoc = await Document.findByIdAndUpdate(
            documentId,
            { $set: { ocrResult: finalOcrData, status: 'OCR_COMPLETED', updatedAt: new Date() } },
            { new: true }
        );
        if (updatedDoc && updatedDoc.bundleId) {
            await updateBundleStatusFromDocuments(updatedDoc.bundleId);
        }
    } catch (err) {
        console.error('OCR Job Failed:', err.message);
        const failedDoc = await Document.findByIdAndUpdate(
            documentId,
            { $set: { status: 'REJECTED', rejectionReason: `OCR error: ${err.message}`, updatedAt: new Date() } },
            { new: true }
        );
        if (failedDoc && failedDoc.bundleId) {
            await updateBundleStatusFromDocuments(failedDoc.bundleId);
        }
    }
}

// Staff: Thử lại OCR cho 1 chứng từ bị lỗi trong 1 bundle
async function staffRetryOcr(staffUserId, bundleId, documentId) {
    if (!bundleId || !mongoose.isValidObjectId(bundleId)) {
        const err = new Error('BundleId không hợp lệ');
        err.status = constants.HTTP_STATUS.BAD_REQUEST;
        throw err;
    }
    if (!documentId || !mongoose.isValidObjectId(documentId)) {
        const err = new Error('DocumentId không hợp lệ');
        err.status = constants.HTTP_STATUS.BAD_REQUEST;
        throw err;
    }

    // Kiểm tra bundle tồn tại
    const bundle = await Bundle.findById(bundleId);
    if (!bundle) {
        const err = new Error('Không tìm thấy bộ chứng từ');
        err.status = constants.HTTP_STATUS.NOT_FOUND;
        throw err;
    }

    // Kiểm tra document thuộc bundle
    const doc = await Document.findOne({ _id: documentId, bundleId: bundle._id });
    if (!doc) {
        const err = new Error('Không tìm thấy chứng từ trong bộ này');
        err.status = constants.HTTP_STATUS.NOT_FOUND;
        throw err;
    }

    // Chỉ cho retry khi đang lỗi (REJECTED) hoặc đã OCR_FAILED ở mức bundle
    if (doc.status === 'OCR_COMPLETED') {
        const err = new Error('Chứng từ đã OCR thành công, không thể thử lại');
        err.status = constants.HTTP_STATUS.CONFLICT;
        throw err;
    }
    if (doc.status === 'OCR_PROCESSING') {
        const err = new Error('Chứng từ đang được OCR');
        err.status = constants.HTTP_STATUS.CONFLICT;
        throw err;
    }

    // Cập nhật trạng thái document về OCR_PROCESSING và xoá lý do lỗi trước đó
    doc.status = 'OCR_PROCESSING';
    doc.rejectionReason = undefined;
    // Xoá kết quả cũ nếu muốn làm sạch
    doc.ocrResult = '';
    doc.updatedAt = new Date();
    await doc.save();

    // Nếu bundle không ở OCR_PROCESSING, chuyển về OCR_PROCESSING để phản ánh đang xử lý lại
    if (bundle.status !== 'OCR_PROCESSING') {
        bundle.status = 'OCR_PROCESSING';
        bundle.updatedAt = new Date();
        await bundle.save();
    }

    // Khởi chạy lại OCR async
    setImmediate(() => startOcrJob(doc._id).catch(() => {}));

    // Trả về chi tiết bundle cho STAFF
    return await getBundleDetail(staffUserId, bundleId.toString(), true);
}

// Staff: Thử lại OCR cho tất cả chứng từ lỗi (REJECTED) trong 1 bundle
async function staffRetryOcrForBundle(staffUserId, bundleId) {
    if (!bundleId || !mongoose.isValidObjectId(bundleId)) {
        const err = new Error('BundleId không hợp lệ');
        err.status = constants.HTTP_STATUS.BAD_REQUEST;
        throw err;
    }

    const bundle = await Bundle.findById(bundleId);
    if (!bundle) {
        const err = new Error('Không tìm thấy bộ chứng từ');
        err.status = constants.HTTP_STATUS.NOT_FOUND;
        throw err;
    }

    // Lấy danh sách chứng từ đang lỗi OCR
    const failedDocs = await Document.find({ bundleId: bundle._id, status: 'REJECTED' }).lean();
    if (!failedDocs || failedDocs.length === 0) {
        const err = new Error('Không có chứng từ nào ở trạng thái lỗi để retry');
        err.status = constants.HTTP_STATUS.CONFLICT;
        throw err;
    }

    // Đặt lại trạng thái và khởi chạy lại OCR cho từng chứng từ lỗi
    const ids = failedDocs.map(d => d._id);
    await Document.updateMany(
        { _id: { $in: ids } },
        { $set: { status: 'OCR_PROCESSING', ocrResult: '', rejectionReason: undefined, updatedAt: new Date() } }
    );

    if (bundle.status !== 'OCR_PROCESSING') {
        bundle.status = 'OCR_PROCESSING';
        bundle.updatedAt = new Date();
        await bundle.save();
    }

    // Khởi chạy lại OCR async cho từng document
    for (const d of failedDocs) {
        setImmediate(() => startOcrJob(d._id).catch(() => {}));
    }

    return await getBundleDetail(staffUserId, bundleId.toString(), true);
}
module.exports = {
    supplierCreate,
    supplierUpdate,
    supplierList,
    getBundleDetail,
    staffList,
    staffReview,
    staffRetryOcr,
    staffRetryOcrForBundle
};


