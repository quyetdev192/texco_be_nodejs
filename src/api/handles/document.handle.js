const mongoose = require('mongoose');
const DocumentModelClass = require('../models/document.model');
const BundleModelClass = require('../models/bundle.model');
const UserModelClass = require('../models/user.model');
const CompanyModelClass = require('../models/company.model');
const constants = require('../../core/utils/constants');
const helpers = require('../../core/utils/helpers');

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
        docsToInsert.push({
            fileName: d.fileName,
            storagePath: d.storagePath,
            documentType: d.documentType,
            bundleId: bundle._id,
            note: d.note || '',
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
                updateData.updatedAt = new Date();

                await Document.findByIdAndUpdate(doc._id, { $set: updateData });
            } else {
                // Thêm document mới
                if (!doc.fileName || !doc.storagePath || !doc.documentType) {
                    continue; // Skip invalid documents
                }
                await Document.create({
                    fileName: doc.fileName,
                    storagePath: doc.storagePath,
                    documentType: doc.documentType,
                    bundleId: bundle._id,
                    note: doc.note || '',
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
            createdAt: bundle.createdAt,
            updatedAt: bundle.updatedAt,
            approvedBy: bundle.approvedBy,
            approvedAt: bundle.approvedAt,
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
            // Start OCR for each document
            setImmediate(() => startOcrJob(doc._id, doc.storagePath).catch(() => {}));
        });
        await Promise.all(updatePromises);
    } else {
        const err = new Error('Action không hợp lệ. Phải là APPROVE hoặc REJECT');
        err.status = constants.HTTP_STATUS.BAD_REQUEST;
        throw err;
    }

    // Return bundle detail với đầy đủ thông tin
    return await getBundleDetail(staffUserId, bundleId.toString(), true);
}
async function startOcrJob(documentId, fileUrl) {
    try {
        const GOOGLE_VISION_API_KEY = process.env.GOOGLE_VISION_API_KEY;
        if (!GOOGLE_VISION_API_KEY) throw new Error('Missing GOOGLE_VISION_API_KEY');

        const imageResponse = await fetch(fileUrl);
        if (!imageResponse.ok) {
            throw new Error(`Failed to fetch image from URL: ${imageResponse.statusText}`);
        }
        
        const arrayBuffer = await imageResponse.arrayBuffer(); 
        const imageBuffer = Buffer.from(arrayBuffer); 
        const base64Image = imageBuffer.toString('base64');
        
        const body = {
            requests: [
                {
                    image: { content: base64Image },
                    features: [{ type: 'DOCUMENT_TEXT_DETECTION' }]
                }
            ]
        };

        const resp = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        
        const json = await resp.json();
        
        if (json.error) {
            throw new Error(`Vision API Error: ${json.error.message || JSON.stringify(json.error)}`);
        }
        
        const responseData = json.responses && json.responses[0];
        const responseError = responseData && responseData.error;
        
        if (responseError) {
             throw new Error(`Image processing failed: Code ${responseError.code}, Message: ${responseError.message}`);
        }

        const rawOcrText = responseData && 
                           responseData.fullTextAnnotation && 
                           responseData.fullTextAnnotation.text;
                           
        const finalOcrData = rawOcrText || '';

        const updatedDoc = await Document.findByIdAndUpdate(documentId, {
            $set: { ocrResult: finalOcrData, status: 'OCR_COMPLETED', updatedAt: new Date() }
        }, { new: true });

        // Cập nhật bundle status sau khi OCR thành công
        if (updatedDoc && updatedDoc.bundleId) {
            await updateBundleStatusFromDocuments(updatedDoc.bundleId);
        }
    } catch (err) {
        console.error("OCR Job Failed:", err.message);
        const failedDoc = await Document.findByIdAndUpdate(documentId, {
            $set: { status: 'REJECTED', rejectionReason: `OCR error: ${err.message}`, updatedAt: new Date() }
        }, { new: true });

        // Cập nhật bundle status sau khi OCR thất bại
        if (failedDoc && failedDoc.bundleId) {
            await updateBundleStatusFromDocuments(failedDoc.bundleId);
        }
    }
}
module.exports = {
    supplierCreate,
    supplierUpdate,
    supplierList,
    getBundleDetail,
    staffList,
    staffReview
};


