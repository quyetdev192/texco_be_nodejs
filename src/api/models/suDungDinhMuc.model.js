const { Schema } = require('mongoose');

class SuDungDinhMuc {
  static name = 'SuDungDinhMuc';
  static collection = 'su_dung_dinh_mucs';
  static IsStandardModel = true;

  static getSchema() {
    return {
      lohangDraftId: { 
        type: Schema.Types.ObjectId, 
        ref: 'LohangDraft', 
        required: true,
        index: true
      },
      skuDraftId: { 
        type: Schema.Types.ObjectId, 
        ref: 'SkuDraft', 
        required: true,
        index: true
      },
      skuCode: { type: String, required: true, trim: true },
      
      // Thông tin NPL
      nplCode: { type: String, required: true, trim: true },
      nplName: { type: String, required: true },
      hsCodeNpl: { type: String, required: true, trim: true },
      unit: { type: String, required: true, trim: true },
      
      // Định mức và tổng nhu cầu
      normPerProduct: { type: Number, required: true }, // Định mức NPL/1 TP
      quantityProduct: { type: Number, required: true }, // Số lượng TP
      totalQuantityNeeded: { type: Number, required: true }, // = normPerProduct * quantityProduct
      
      // Trạng thái phân bổ
      quantityAllocated: { type: Number, default: 0 }, // Đã phân bổ
      quantityRemaining: { type: Number, required: true }, // Còn lại cần phân bổ
      
      status: {
        type: String,
        enum: ['PENDING', 'ALLOCATING', 'COMPLETED', 'FAILED'],
        default: 'PENDING',
        index: true
      },
      
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now }
    };
  }

  static getIndexes() {
    return [
      { lohangDraftId: 1, skuDraftId: 1 },
      { skuCode: 1, nplCode: 1 },
      { status: 1 }
    ];
  }
}

module.exports = SuDungDinhMuc;
