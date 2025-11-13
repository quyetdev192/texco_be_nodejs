/**
 * Bảng Tính toán Tiêu hao NPL (Consumption Calculation)
 * Lưu chi tiết NPL cần dùng cho từng SKU
 */
class ConsumptionCalculationClass {
  static collection = 'consumption_calculations';

  static getSchema() {
    return {
      lohangDraftId: { type: 'ObjectId', ref: 'LohangDraft', required: true },
      skuCode: { type: 'String', required: true },
      productName: { type: 'String' },
      
      // NPL Info
      nplCode: { type: 'String' },
      nplName: { type: 'String', required: true },
      hsCodeNpl: { type: 'String' },
      unit: { type: 'String', required: true },
      
      // Định mức
      normPerSku: { type: 'Number', required: true }, // Định mức/1 SKU
      quantitySku: { type: 'Number', required: true }, // Số lượng SKU xuất
      totalQuantityNeeded: { type: 'Number', required: true }, // = normPerSku * quantitySku
      
      // Giá trị
      unitPriceVnd: { type: 'Number' }, // Đơn giá VND (từ VAT Invoice)
      totalValueVnd: { type: 'Number' }, // = totalQuantityNeeded * unitPriceVnd
      unitPriceUsd: { type: 'Number' }, // = unitPriceVnd / exchangeRate
      totalValueUsd: { type: 'Number' }, // = totalQuantityNeeded * unitPriceUsd
      
      exchangeRate: { type: 'Number', default: 24500 },
      
      // Trạng thái
      status: { 
        type: 'String', 
        enum: ['CALCULATED', 'ALLOCATED', 'INSUFFICIENT_STOCK'],
        default: 'CALCULATED'
      },
      
      createdAt: { type: 'Date', default: Date.now },
      updatedAt: { type: 'Date', default: Date.now }
    };
  }
}

module.exports = ConsumptionCalculationClass;
