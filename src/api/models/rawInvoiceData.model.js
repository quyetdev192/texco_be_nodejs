const { Schema } = require('mongoose');

class RawInvoiceData {
  static name = 'RawInvoiceData';
  static collection = 'raw_invoice_data';
  static IsStandardModel = true;

  static getSchema() {
    return {
      coApplicationId: { 
        type: Schema.Types.ObjectId, 
        ref: 'CoApplication', 
        required: true,
        index: true
      },
      sku: { type: String, required: true, trim: true },
      productName: { type: String, required: true },
      hsCodeProduct: { type: String, required: true, trim: true }, // 8-10 số
      quantity: { type: Number, required: true },
      unit: { type: String, required: true }, // PCS, KG, M3, etc.
      fobValueUsd: { type: Number, required: true },
      
      // Metadata
      verified: { type: Boolean, default: false },
      verifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
      verifiedAt: { type: Date },
      
      // Source tracking
      sourceDocumentId: { type: Schema.Types.ObjectId, ref: 'Document' },
      extractedByAI: { type: Boolean, default: true },
      
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now }
    };
  }

  static getIndexes() {
    return [
      { coApplicationId: 1, sku: 1 },
      { verified: 1 }
    ];
  }
}

module.exports = RawInvoiceData;
