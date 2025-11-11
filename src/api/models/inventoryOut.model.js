const { Schema } = require('mongoose');

class InventoryOut {
  static name = 'InventoryOut';
  static collection = 'inventory_out';
  static IsStandardModel = true;

  static getSchema() {
    return {
      coApplicationId: { 
        type: Schema.Types.ObjectId, 
        ref: 'CoApplication', 
        required: true,
        index: true
      },
      sku: { type: String, required: true, trim: true, index: true },
      nplCode: { type: String, required: true, trim: true, index: true },
      nplName: { type: String, required: true },
      
      // Xuất kho
      quantityOut: { type: Number, required: true },
      unit: { type: String, required: true },
      
      // FIFO allocation
      fromInvoiceRef: { type: String, required: true }, // Xuất từ HĐ nào
      fromInventoryInId: { type: Schema.Types.ObjectId, ref: 'InventoryIn', required: true },
      exportDate: { type: Date, default: Date.now },
      
      // Pricing
      unitPriceUsd: { type: Number, required: true },
      valueUsd: { type: Number, required: true },
      
      // Origin
      originCountry: { type: String, required: true },
      hasCo: { type: Boolean, default: false },
      
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now }
    };
  }

  static getIndexes() {
    return [
      { coApplicationId: 1, sku: 1 },
      { coApplicationId: 1, nplCode: 1 },
      { fromInventoryInId: 1 }
    ];
  }
}

module.exports = InventoryOut;
