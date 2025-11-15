const { Schema } = require('mongoose');

class LohangDraft {
  static name = 'LohangDraft';
  static collection = 'lohang_drafts';
  static IsStandardModel = true;

  static getSchema() {
    return {
      companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
      staffUser: { type: Schema.Types.ObjectId, ref: 'User', required: true },
      status: {
        type: String,
        enum: ['DRAFT', 'DATA_EXTRACTING', 'EXTRACTION_FAILED', 'SETUP_COMPLETED', 'DATA_CONFIRMED', 'CALCULATING', 'CALCULATED_WITH_WARNINGS', 'CALCULATION_FAILED', 'REPORTS_GENERATED', 'COMPLETED', 'FAILED'],
        default: 'DRAFT',
        index: true
      },
      currentStep: {
        type: Number,
        default: 1,
        min: 1,
        max: 8
      },
      workflowSteps: {
        step1_uploadDocuments: { 
          completed: { type: Boolean, default: false },
          completedAt: { type: Date }
        },
        step2_selectFormAndCriteria: { 
          completed: { type: Boolean, default: false },
          completedAt: { type: Date }
        },
        step3_extractData: { 
          completed: { type: Boolean, default: false },
          completedAt: { type: Date },
          inProgress: { type: Boolean, default: false }
        },
        step4_calculate: { 
          completed: { type: Boolean, default: false },
          completedAt: { type: Date },
          inProgress: { type: Boolean, default: false },
          errors: [{ type: String }],
          warnings: [{ type: String }]
        },
        step5_generateReports: { 
          completed: { type: Boolean, default: false },
          completedAt: { type: Date },
          inProgress: { type: Boolean, default: false },
          errors: [{ type: String }]
        },
        step6_reviewResults: { 
          completed: { type: Boolean, default: false },
          completedAt: { type: Date }
        },
        step7_exportCO: { 
          completed: { type: Boolean, default: false },
          completedAt: { type: Date }
        }
      },
      extractionErrors: [{
        step: { type: String },
        error: { type: String },
        details: { type: String },
        timestamp: { type: Date, default: Date.now }
      }],
      invoiceNo: { type: String, trim: true },
      invoiceDate: { type: Date },
      exportDeclarationNo: { type: String, trim: true },
      packingListNo: { type: String, trim: true },
      formType: { type: String, enum: ['FORM_E', 'FORM_B'] },
      criterionType: { type: String, enum: ['CTC', 'CTH', 'CTSH', 'RVC40', 'RVC50', 'WO', 'PE'] },
      linkedDocuments: [{ type: Schema.Types.ObjectId, ref: 'Document' }],
      totalSkuCount: { type: Number, default: 0 },
      processedSkuCount: { type: Number, default: 0 },
      ctcReports: [{
        skuCode: { type: String, required: true },
        productName: { type: String },
        excelUrl: { type: String, required: true },
        publicId: { type: String },
        conclusion: { type: String },
        totalNPLValue: { type: Number },
        fobExcludingChina: { type: Number },
        ctcPercentage: { type: Number },
        createdAt: { type: Date, default: Date.now }
      }],
      
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now },
      confirmedAt: { type: Date },
      completedAt: { type: Date }
    };
  }

  static getIndexes() {
    return [
      { companyId: 1, status: 1 },
      { staffUser: 1, createdAt: -1 },
      { invoiceNo: 1 }
    ];
  }
}

module.exports = LohangDraft;
