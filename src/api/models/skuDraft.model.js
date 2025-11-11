const { Schema } = require('mongoose');

class SkuDraft {
  static name = 'SkuDraft';
  static collection = 'sku_drafts';
  static IsStandardModel = true;

  static getSchema() {
    return {
      lohangDraftId: { 
        type: Schema.Types.ObjectId, 
        ref: 'LohangDraft', 
        required: true,
        index: true
      },
      
      // Thông tin SKU (từ OCR Invoice/PL)
      skuCode: { type: String, required: true, trim: true },
      productName: { type: String, required: true },
      hsCodeProduct: { type: String, required: true, trim: true },
      quantity: { type: Number, required: true },
      unit: { type: String, required: true, trim: true },
      fobValueUsd: { type: Number, required: true },
      grossWeight: { type: Number },
      
      // Trạng thái xử lý
      status: {
        type: String,
        enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'],
        default: 'PENDING',
        index: true
      },
      
      // Kết quả tính toán (sẽ được cập nhật sau)
      calculationResult: {
        totalNplValueWithCo: { type: Number, default: 0 },
        totalNplValueWithoutCo: { type: Number, default: 0 },
        rvcPercentage: { type: Number, default: 0 },
        ctcResult: { type: Boolean, default: false },
        finalOriginCode: { type: String, default: '' },
        finalResult: { 
          type: String, 
          enum: ['ĐẠT', 'KHÔNG ĐẠT', 'PENDING'],
          default: 'PENDING'
        }
      },
      
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now }
    };
  }

  static getIndexes() {
    return [
      { lohangDraftId: 1, skuCode: 1 },
      { lohangDraftId: 1, status: 1 },
      { hsCodeProduct: 1 }
    ];
  }
}

module.exports = SkuDraft;
