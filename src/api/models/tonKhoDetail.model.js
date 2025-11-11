const { Schema } = require('mongoose');

class TonKhoDetail {
  static name = 'TonKhoDetail';
  static collection = 'ton_kho_details';
  static IsStandardModel = true;

  static getSchema() {
    return {
      companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
      
      // Thông tin NPL
      nplCode: { type: String, required: true, trim: true, index: true },
      nplName: { type: String, required: true },
      hsCodeNpl: { type: String, required: true, trim: true, index: true },
      unit: { type: String, required: true, trim: true },
      
      // Thông tin lô nhập (từ HĐ VAT/TKNK NPL)
      invoiceRef: { type: String, required: true, trim: true }, // Số HĐ/TKNK
      invoiceDate: { type: Date, required: true, index: true }, // Ngày nhập (cho FIFO)
      supplierName: { type: String, trim: true },
      
      // Giá trị và số lượng
      unitPriceCifUsd: { type: Number, required: true }, // Đơn giá CIF USD
      quantityImported: { type: Number, required: true }, // SL nhập ban đầu
      quantityAvailable: { type: Number, required: true }, // SL tồn hiện tại (trừ dần)
      
      // Xuất xứ
      originCountry: { type: String, required: true, trim: true },
      hasCo: { type: Boolean, default: false },
      coNumber: { type: String, trim: true, default: '' },
      
      // Trạng thái
      status: {
        type: String,
        enum: ['AVAILABLE', 'DEPLETED', 'LOCKED'],
        default: 'AVAILABLE',
        index: true
      },
      
      // Liên kết chứng từ gốc
      linkedDocumentId: { type: Schema.Types.ObjectId, ref: 'Document' },
      
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now }
    };
  }

  static getIndexes() {
    return [
      { companyId: 1, nplCode: 1, status: 1 },
      { companyId: 1, invoiceDate: 1 }, // Cho FIFO
      { hsCodeNpl: 1 },
      { invoiceRef: 1 }
    ];
  }
}

module.exports = TonKhoDetail;
