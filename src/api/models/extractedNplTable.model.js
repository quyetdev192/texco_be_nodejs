/**
 * Model: Bảng Nhập kho Nguyên phụ liệu
 * Giai đoạn 2: Xử lý Hóa đơn GTGT (VAT Invoice)
 */

class ExtractedNplTable {
  static collection = 'extracted_npl_tables';

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
      
      // Dữ liệu bảng
      materials: [{
        stt: { type: Number },
        nplCode: { type: String }, // Mã NPL (Tên hàng)
        nplName: { type: String }, // Tên NPL
        // hsCode: { type: String }, // HS Code - KHÔNG CẦN cho bảng NPL
        invoiceNo: { type: String }, // SO HD
        invoiceDate: { type: Date }, // Ngày HD
        quantityImported: { type: Number }, // SL Nhập Kho
        unit: { type: String }, // Đơn vị
        unitPriceVnd: { type: Number }, // Đơn giá (VND)
        totalValueVnd: { type: Number }, // Thành tiền (VND)
        originCountry: { type: String, default: 'MUA VN KRXX' }, // Xuất xứ
        supplierName: { type: String }, // Tên nhà cung cấp
        
        // Metadata từ nguồn
        sourceVatInvoiceId: { type: String }, // Document ID của VAT Invoice
        
        // Trạng thái chỉnh sửa
        isEdited: { type: Boolean, default: false },
        editedFields: [{ type: String }],
        editHistory: [{
          editedAt: { type: Date },
          editedBy: { type: String },
          fieldName: { type: String },
          oldValue: { type: String },
          newValue: { type: String }
        }]
      }],
      
      // Tổng hợp
      totalMaterials: { type: Number },
      totalQuantity: { type: Number },
      totalValueVnd: { type: Number },
      
      // AI Confidence
      aiConfidence: { type: Number, min: 0, max: 100 },
      aiModel: { type: String },
      aiVersion: { type: String },
      
      // Notes
      notes: { type: String },
      warnings: [{ type: String }],
      
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now }
    };
  }
}

module.exports = ExtractedNplTable;
