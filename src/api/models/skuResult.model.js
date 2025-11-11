const { Schema } = require('mongoose');

class SkuResult {
  static name = 'SkuResult';
  static collection = 'sku_results';
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
      
      // Thông tin SKU
      skuCode: { type: String, required: true, trim: true },
      productName: { type: String, required: true },
      hsCodeProduct: { type: String, required: true, trim: true },
      quantity: { type: Number, required: true },
      unit: { type: String, required: true, trim: true },
      fobValueUsd: { type: Number, required: true },
      
      // Tiêu chí áp dụng
      criterionType: { type: String, required: true },
      
      // Kết quả tính toán
      totalNplValueWithCo: { type: Number, default: 0 },
      totalNplValueWithoutCo: { type: Number, default: 0 },
      totalNplValue: { type: Number, default: 0 }, // Tổng trị giá NPL
      
      // Kết quả CTC
      ctcResult: { type: Boolean, default: false },
      ctcDetails: {
        hsCodeMatched: { type: Boolean, default: false },
        message: { type: String, default: '' }
      },
      
      // Kết quả RVC
      rvcPercentage: { type: Number, default: 0 },
      rvcResult: { type: Boolean, default: false },
      
      // Kết quả cuối cùng
      finalOriginCode: { type: String, default: '' }, // "E.I/CTC", "E.I/RVC 40%"
      finalResult: { 
        type: String, 
        enum: ['ĐẠT', 'KHÔNG ĐẠT', 'PENDING'],
        default: 'PENDING'
      },
      
      // Chi tiết NPL (để xuất Excel)
      nplBreakdown: [{
        stt: { type: Number },
        nplCode: { type: String },
        nplName: { type: String },
        hsCodeNpl: { type: String },
        unit: { type: String },
        normPerProduct: { type: Number },
        totalQuantityUsed: { type: Number },
        unitPriceUsd: { type: Number },
        valueUsd: { type: Number },
        originCountry: { type: String },
        hasCo: { type: Boolean },
        coNumber: { type: String },
        invoiceRef: { type: String }
      }],
      
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now }
    };
  }

  static getIndexes() {
    return [
      { lohangDraftId: 1, skuCode: 1 },
      { finalResult: 1 },
      { criterionType: 1 }
    ];
  }
}

module.exports = SkuResult;
