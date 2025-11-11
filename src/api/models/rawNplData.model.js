const { Schema } = require('mongoose');

class RawNplData {
  static name = 'RawNplData';
  static collection = 'raw_npl_data';
  static IsStandardModel = true;

  static getSchema() {
    return {
      coApplicationId: { 
        type: Schema.Types.ObjectId, 
        ref: 'CoApplication', 
        required: true,
        index: true
      },
      nplCode: { type: String, required: true, trim: true },
      nplName: { type: String, required: true },
      hsCodeNpl: { type: String, required: true, trim: true }, // 8-10 số
      quantity: { type: Number, required: true },
      unit: { type: String, required: true },
      
      // Pricing
      unitPriceVnd: { type: Number, default: 0 },
      unitPriceUsd: { type: Number, required: true }, // Sau khi quy đổi
      
      // Invoice info
      invoiceNumber: { type: String, default: '' },
      invoiceDate: { type: Date, required: true },
      
      // Origin info
      originCountry: { type: String, required: true },
      originLocation: { type: String, default: '' },
      supplierName: { type: String, default: '' },
      supplierAddress: { type: String, default: '' },
      
      // C/O info
      coNplNumber: { type: String, default: '' }, // Số C/O NPL
      hasOriginCert: { type: Boolean, default: false },
      originCertDate: { type: Date },
      
      // Source reference
      sourceDocumentRef: { type: String, default: '' }, // "HĐ VAT 00000197", "TK 107260069999"
      sourceDocumentId: { type: Schema.Types.ObjectId, ref: 'Document' },
      
      // Metadata
      verified: { type: Boolean, default: false },
      verifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
      verifiedAt: { type: Date },
      extractedByAI: { type: Boolean, default: true },
      
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now }
    };
  }

  static getIndexes() {
    return [
      { coApplicationId: 1, nplCode: 1 },
      { coApplicationId: 1, invoiceDate: 1 }, // For FIFO
      { verified: 1 },
      { hasOriginCert: 1 }
    ];
  }
}

module.exports = RawNplData;
