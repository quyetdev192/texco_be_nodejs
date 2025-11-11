const { Schema } = require('mongoose');

class RawBomData {
  static name = 'RawBomData';
  static collection = 'raw_bom_data';
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
      nplCode: { type: String, required: true, trim: true }, // Mã NPL
      nplName: { type: String, required: true },
      normPerProduct: { type: Number, required: true }, // Định mức/SP
      unit: { type: String, required: true }, // KG, M, PCS, etc.
      
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
      { coApplicationId: 1, nplCode: 1 },
      { verified: 1 }
    ];
  }
}

module.exports = RawBomData;
