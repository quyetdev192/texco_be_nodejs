const { Schema } = require('mongoose');

class Document {
    static name = 'Document';
    static collection = 'documents';
    static IsStandardModel = true;

    static getSchema() {
        // Tủ hồ sơ số (Xử lý Giai đoạn 1 & 2)
        return {
            fileName: { type: String, required: true },
            storagePath: { type: String, required: true }, // Đường dẫn S3/GCS
            documentType: {
                type: String,
                required: true,
                enum: [
                    "VAT_INVOICE", "IMPORT_DECLARATION", "PURCHASE_LIST", "NPL_ORIGIN_CERT",
                    "EXPORT_DECLARATION", "COMMERCIAL_INVOICE", "BILL_OF_LADING", "BOM"
                ]
            },
            status: {
                type: String,
                required: true,
                enum: ["PENDING_REVIEW", "REJECTED", "OCR_PROCESSING", "OCR_COMPLETED", "ARCHIVED"],
                default: "PENDING_REVIEW"
            },
            rejectionReason: String,
            ocrResult: { type: Object }, // Kết quả JSON thô từ OCR
            
            // --- Tracking & Security (Xử lý "không gian riêng") ---
            companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
            uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
            approvedBy: { type: Schema.Types.ObjectId, ref: 'User' }, // NV Staff duyệt
            
            createdAt: { type: Date, default: Date.now },
            approvedAt: Date
        };
    }
}

module.exports = Document;