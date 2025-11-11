const { Schema } = require('mongoose');

class InventoryIn {
  static name = 'InventoryIn';
  static collection = 'inventory_in';
  static IsStandardModel = true;

  static getSchema() {
    return {
      coApplicationId: { 
        type: Schema.Types.ObjectId, 
        ref: 'CoApplication', 
        required: true,
        index: true
      },
      nplCode: { type: String, required: true, trim: true, index: true },
      nplName: { type: String, required: true },
      
      // Nhập kho
      quantityIn: { type: Number, required: true },
      unit: { type: String, required: true },
      unitPriceUsd: { type: Number, required: true },
      totalValueUsd: { type: Number, required: true },
      
      // Invoice reference
      invoiceRef: { type: String, required: true }, // "HĐ VAT 00000197"
      invoiceNumber: { type: String, default: '' },
      invoiceDate: { type: Date, required: true },
      
      // Origin
      originCountry: { type: String, required: true },
      hasCo: { type: Boolean, default: false },
      coNumber: { type: String, default: '' },
      
      // Tồn kho (FIFO tracking)
      remainingStock: { type: Number, required: true }, // Khởi tạo = quantityIn
      
      // Link to raw data
      rawNplDataId: { type: Schema.Types.ObjectId, ref: 'RawNplData' },
      
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now }
    };
  }

  static getIndexes() {
    return [
      { coApplicationId: 1, nplCode: 1 },
      { coApplicationId: 1, invoiceDate: 1 }, // For FIFO
      { remainingStock: 1 }
    ];
  }
}

module.exports = InventoryIn;
