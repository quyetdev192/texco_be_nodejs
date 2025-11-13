/**
 * Model: Bảng Định mức Nguyên liệu
 * Giai đoạn 3: Xử lý Bảng định mức (BOM)
 */

class ExtractedBomTable {
  static collection = 'extracted_bom_tables';

  static getSchema() {
    return {
      lohangDraftId: { type: String, required: true, index: true },
      bundleId: { type: String, required: true, index: true },
      
      // Metadata
      extractedAt: { type: Date, default: Date.now },
      extractedBy: { type: String }, // userId
      status: { 
        type: String, 
        enum: ['EXTRACTED', 'EDITED', 'CONFIRMED'],
        default: 'EXTRACTED'
      },
      
      // Dữ liệu bảng - Định mức cho từng SKU
      bomData: [{
        stt: { type: Number },
        nplCode: { type: String }, // Mã NPL
        nplName: { type: String }, // Tên NPL
        hsCode: { type: String }, // HS Code
        unit: { type: String }, // ĐVT
        
        // Định mức cho từng SKU (dynamic)
        // Key: skuCode, Value: định mức/1 SP
        normPerSku: { type: Map, of: Number },
        // Ví dụ: { "5022064": 0.027243883, "5022065": 0.033040253 }
        
        // Metadata từ nguồn
        sourceBomId: { type: String }, // Document ID của BOM
        
        // Trạng thái chỉnh sửa
        isEdited: { type: Boolean, default: false },
        editedFields: [{ type: String }],
        editHistory: [{
          editedAt: { type: Date },
          editedBy: { type: String },
          fieldName: { type: String },
          skuCode: { type: String }, // SKU nào được sửa
          oldValue: { type: String },
          newValue: { type: String }
        }]
      }],
      
      // Danh sách SKU trong lô hàng này
      skuList: [{
<<<<<<< HEAD
        stt: { type: String }, // STT của SKU trong Excel BOM
        skuCode: { type: String },
=======
        stt: { type: String }, // STT của SKU
        skuCode: { type: String }, // Product SKU code (5022064, 5022065...)
>>>>>>> quyetdev
        productName: { type: String }
      }],
      
      // Tổng hợp
      totalMaterials: { type: Number },
      totalSkus: { type: Number },
      
      // AI Confidence
      aiConfidence: { type: Number, min: 0, max: 100 },
      aiModel: { type: String },
      aiVersion: { type: String },
      
      // Notes
      notes: { type: String },
      warnings: [{ type: String }],
      
      // BOM Excel URL (nếu upload từ Excel)
      bomExcelUrl: { type: String },
      
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now }
    };
  }
}

module.exports = ExtractedBomTable;
