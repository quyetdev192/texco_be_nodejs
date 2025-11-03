const { Schema } = require('mongoose');

class Material {
    static name = 'Material';
    static collection = 'materials';
    static IsStandardModel = true;

    static getSchema() {
        // Kho Nguyên phụ liệu (NPL) đã được chuẩn hóa
        return {
            name: { type: String, required: true },
            hsCode: { type: String, required: true }, // Mã HS của NPL
            unit: { type: String, required: true },
            originCountry: { type: String, required: true }, // Vd: "VN", "CN"
            isOriginating: { type: Boolean, required: true }, // Có XX (true) / Không có XX (false)
            supplierId: { type: Schema.Types.ObjectId, ref: 'Company' },
            sourceDocumentId: { type: Schema.Types.ObjectId, ref: 'Document' }, // Link tới HĐ/TK gốc
            
            // Trị giá chuẩn hóa (đã quy đổi USD)
            cifValue: {
                value: { type: Number, default: 0 },
                currency: { type: String, default: 'USD' }
            }
        };
    }
}

module.exports = Material;