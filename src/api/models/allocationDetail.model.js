const { Schema } = require('mongoose');

class AllocationDetail {
  static name = 'AllocationDetail';
  static collection = 'allocation_details';
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
      nplCode: { type: String, required: true, trim: true },
      nplName: { type: String, required: true },
      
      // Phân bổ
      allocatedQuantity: { type: Number, required: true },
      unit: { type: String, required: true },
      
      // From which invoice
      fromInvoiceRef: { type: String, required: true },
      fromInventoryInId: { type: Schema.Types.ObjectId, ref: 'InventoryIn', required: true },
      
      // Pricing
      unitPriceUsd: { type: Number, required: true },
      valueUsd: { type: Number, required: true },
      
      // Origin classification
      originCountry: { type: String, required: true },
      hasCo: { type: Boolean, default: false },
      coNumber: { type: String, default: '' },
      
      // Link to inventory out
      inventoryOutId: { type: Schema.Types.ObjectId, ref: 'InventoryOut' },
      
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

module.exports = AllocationDetail;
