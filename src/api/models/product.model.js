const { Schema } = require('mongoose');

class Product {
    static name = 'Product';
    static collection = 'products';
    static IsStandardModel = true;

    static getSchema() {
        // Thành phẩm và Bảng Định Mức (BOM)
        return {
            companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
            name: { type: String, required: true }, // Tên thành phẩm
            modelNo: { type: String, unique: true, sparse: true },
            hsCode: { type: String, required: true }, // Mã HS thành phẩm (Vd: 940360)
            unit: { type: String, required: true },
            bom: [
                {
                    _id: false,
                    materialId: { type: Schema.Types.ObjectId, ref: 'Material' },
                    quantityPerUnit: { type: Number, required: true } // Định mức
                }
            ]
        };
    }
}

module.exports = Product;