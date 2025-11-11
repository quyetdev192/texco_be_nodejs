const { Schema } = require('mongoose');

class BreakdownResult {
  static name = 'BreakdownResult';
  static collection = 'breakdown_results';
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
      
      // Product info
      productName: { type: String, required: true },
      hsCodeProduct: { type: String, required: true },
      quantity: { type: Number, required: true },
      unit: { type: String, required: true },
      fobValueUsd: { type: Number, required: true },
      
      // Criterion applied
      criterion: { 
        type: String, 
        required: true,
        enum: ['CTC', 'CTSH', 'RVC40', 'RVC50', 'WO', 'PE']
      },
      
      // Calculation results
      totalNplValueWithCo: { type: Number, default: 0 },
      totalNplValueWithoutCo: { type: Number, default: 0 },
      rvcPercentage: { type: Number, default: 0 }, // For RVC criterion
      ctcResult: { type: Boolean, default: false }, // For CTC criterion
      
      // Final result
      finalOriginCode: { type: String, default: '' }, // "E.I/CTC", "E.I/RVC 40%"
      finalResult: { 
        type: String, 
        enum: ['ĐẠT', 'KHÔNG ĐẠT', 'PENDING'],
        default: 'PENDING'
      },
      
      // NPL details (JSON array)
      nplDetails: [{
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
        originClassification: { type: String }, // "Có C/O" / "Không C/O"
        invoiceRef: { type: String },
        coNumber: { type: String }
      }],
      
      // QA
      qaApproved: { type: Boolean, default: false },
      qaApprovedBy: { type: Schema.Types.ObjectId, ref: 'User' },
      qaApprovedAt: { type: Date },
      qaComments: { type: String, default: '' },
      
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now }
    };
  }

  static getIndexes() {
    return [
      { coApplicationId: 1, sku: 1 },
      { qaApproved: 1 },
      { finalResult: 1 }
    ];
  }
}

module.exports = BreakdownResult;
