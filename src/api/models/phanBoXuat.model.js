const { Schema } = require('mongoose');

class PhanBoXuat {
  static name = 'PhanBoXuat';
  static collection = 'phan_bo_xuats';
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
      suDungDinhMucId: { 
        type: Schema.Types.ObjectId, 
        ref: 'SuDungDinhMuc', 
        required: true
      },
      
      // Thông tin SKU
      skuCode: { type: String, required: true, trim: true },
      
      // Thông tin NPL
      nplCode: { type: String, required: true, trim: true },
      nplName: { type: String, required: true },
      hsCodeNpl: { type: String, required: true, trim: true },
      
      // Phân bổ từ lô tồn kho nào
      tonKhoDetailId: { 
        type: Schema.Types.ObjectId, 
        ref: 'TonKhoDetail', 
        required: true,
        index: true
      },
      fromInvoiceRef: { type: String, required: true, trim: true },
      fromInvoiceDate: { type: Date, required: true },
      
      // Số lượng và giá trị phân bổ
      allocatedQuantity: { type: Number, required: true },
      unit: { type: String, required: true, trim: true },
      unitPriceUsd: { type: Number, required: true },
      totalValueUsd: { type: Number, required: true }, // = allocatedQuantity * unitPriceUsd
      
      // Xuất xứ
      originCountry: { type: String, required: true, trim: true },
      hasCo: { type: Boolean, default: false },
      coNumber: { type: String, trim: true, default: '' },
      
      // Thứ tự phân bổ (FIFO)
      allocationOrder: { type: Number, required: true },
      
      createdAt: { type: Date, default: Date.now }
    };
  }

  static getIndexes() {
    return [
      { lohangDraftId: 1, skuDraftId: 1 },
      { skuCode: 1, nplCode: 1 },
      { tonKhoDetailId: 1 },
      { lohangDraftId: 1, skuCode: 1, allocationOrder: 1 }
    ];
  }
}

module.exports = PhanBoXuat;
