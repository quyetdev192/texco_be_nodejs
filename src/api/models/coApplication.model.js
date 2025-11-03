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
            status: {
                type: String,
                enum: ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED"],
                default: "DRAFT"
            },
            formType: { type: String, enum: ["FORM_B", "FORM_E"], required: true },
            
            // --- Thông tin chung của lô hàng (Lấy từ OCR) ---
            invoiceNo: String, // HĐTM (Box 10)
            invoiceDate: Date,
            exportDeclarationNo: String, // Tờ khai XK
            exporterInfo: String, // Box 1
            consigneeInfo: String, // Box 2
            transportInfo: String, // Box 3

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
                    appliedRule: { // "Luật" đã được áp dụng
                        type: String, 
                        rvcPercent: Number
                    },
                    originCriterionDisplay: String, // "CTSH" hoặc "RVC 45%"
                    
                    logicCheck: {
                        pass: Boolean,
                        message: String
                    },

                    // --- Bảng kê NPL điện tử (Trái tim của hệ thống) ---
                    materialsBreakdown: [
                        {
                            _id: false,
                            name: String,
                            hsCode: String,
                            isOriginating: Boolean,
                            value: Number,
                            sourceRef: String, // "HĐ 00000197"
                            sourceDate: Date
                        }
                    ]
                }
            ],
            
            createdAt: { type: Date, default: Date.now },
            submittedAt: Date // Ngày nộp cho BCT
        };
    }
}

module.exports = CoApplication;