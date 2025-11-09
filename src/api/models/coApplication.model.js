const { Schema } = require('mongoose');

class CoApplication {
    static name = 'CoApplication';
    static collection = 'co_applications';
    static IsStandardModel = true;

    static getSchema() {
        // Collection chính: Hồ sơ xin cấp C/O (Kết quả GĐ 3 & 4)
        return {
            companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
            staffUser: { type: Schema.Types.ObjectId, ref: 'User', required: true },
            bundleId: { type: Schema.Types.ObjectId, ref: 'Bundle', required: true }, // Bundle được chọn để tạo C/O
            status: {
                type: String,
                enum: ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED"],
                default: "DRAFT"
            },
            formType: { type: String, enum: ["FORM_B", "FORM_E"] },
            
            // --- Thông tin chung của lô hàng (Lấy từ OCR) ---
            invoiceNo: String,
            invoiceDate: Date,
            exportDeclarationNo: String,
            exporterInfo: String,
            exporterName: String,
            taxCode: String,
            consigneeInfo: String,
            transportInfo: String,
            purchaseLocation: String,
            purchaseManager: String,

            // Cờ đặc biệt (Box 13 Form E)
            box13_Flags: {
                isIssuedRetroactively: { type: Boolean, default: false },
                isThirdPartyInvoicing: { type: Boolean, default: false }
            },

            // Liên kết tất cả chứng từ (để BCT xem)
            linkedDocuments: [{ type: Schema.Types.ObjectId, ref: 'Document' }],

            // Chi tiết hàng hóa & Bảng kê tự động
            items: [
                {
                    _id: false,
                    productName: String,
                    productHsCode: String,
                    quantity: Number,
                    grossWeight: Number, // Box 9
                    fobValue: Number, // Box 9 (cho RVC)
                    
                    // --- Kết quả xử lý logic (GĐ 3) ---
                    appliedRule: { 
                        _id: false,
                        type: { type: String },  // Phải wrap trong { type: String } vì "type" là reserved keyword
                        rvcPercent: { type: Number }
                    },
                    originCriterionDisplay: String,
                    
                    logicCheck: {
                        pass: Boolean,
                        message: String
                    },
                    
                    // AI correction tracking
                    aiCorrectionNotes: String, // Ghi chú của NV yêu cầu AI sửa
                    aiCorrectionCount: { type: Number, default: 0 }, // Số lần AI đã làm lại

                    totalValueOriginating: { type: Number, default: 0 },
                    totalValueNonOriginating: { type: Number, default: 0 },
                    rvcPercent: { type: Number, default: 0 },

                    // --- Bảng kê NPL điện tử (Trái tim của hệ thống) ---
                    materialsBreakdown: [
                        {
                            _id: false,
                            name: String,
                            hsCode: String,
                            isOriginating: Boolean,
                            value: Number,
                            originCountry: String,
                            originLocation: String,
                            supplierName: String,
                            supplierAddress: String,
                            sourceRef: String,
                            sourceDate: Date,
                            originatingCertRef: String,
                            originatingCertDate: Date
                        }
                    ],

                    domesticPurchases: [
                        {
                            _id: false,
                            date: Date,
                            sellerName: String,
                            sellerAddress: String,
                            sellerIdCard: String,
                            materialName: String,
                            materialHsCode: String,
                            location: String,
                            totalValue: Number
                        }
                    ]
                }
            ],
            
            // OCR status tracking for additional documents
            ocrStatus: {
                type: String,
                enum: ["PENDING", "PROCESSING", "COMPLETED", "FAILED"],
                default: "COMPLETED"
            },
            ocrFailedDocuments: [{ type: Schema.Types.ObjectId, ref: 'Document' }], // Documents that failed OCR
            
            createdAt: { type: Date, default: Date.now },
            submittedAt: Date // Ngày nộp cho BCT
        };
    }
}

module.exports = CoApplication;