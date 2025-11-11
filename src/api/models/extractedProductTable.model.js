/**
 * Model: Bảng Tổng hợp Sản phẩm Xuất khẩu
 * Giai đoạn 1: Xử lý Invoice + Tờ khai Xuất khẩu
 */

class ExtractedProductTable {
  static collection = 'extracted_product_tables';

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
      products: [{
        stt: { type: Number },
        skuCode: { type: String }, // Mã SP
        productName: { type: String }, // Tên sản phẩm (Mô tả)
        hsCode: { type: String }, // HS Code
        quantity: { type: Number }, // QTY (Số lượng)
        unit: { type: String }, // Đơn vị
        unitPriceUsd: { type: Number }, // Đơn giá (USD)
        fobValueUsd: { type: Number }, // Trị giá FOB (USD)
        exchangeRate: { type: Number }, // Tỷ giá (VND/USD)
        fobValueVnd: { type: Number }, // Trị giá FOB (VND) = fobValueUsd * exchangeRate
        
        // Metadata từ nguồn
        sourceInvoiceId: { type: String }, // Document ID của Invoice
        sourceDeclarationId: { type: String }, // Document ID của Tờ khai
        
        // Trạng thái chỉnh sửa
        isEdited: { type: Boolean, default: false },
        editedFields: [{ type: String }], // Danh sách field đã sửa
        editHistory: [{
          editedAt: { type: Date },
          editedBy: { type: String },
          fieldName: { type: String },
          oldValue: { type: String },
          newValue: { type: String }
        }]
      }],
      
      // Tổng hợp
      totalProducts: { type: Number },
      totalQuantity: { type: Number },
      totalFobValueUsd: { type: Number },
      totalFobValueVnd: { type: Number },
      
      // AI Confidence
      aiConfidence: { type: Number, min: 0, max: 100 }, // % độ tin cậy
      aiModel: { type: String }, // Tên model AI đã dùng
      aiVersion: { type: String },
      
      // Notes
      notes: { type: String },
      warnings: [{ type: String }],
      
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now }
    };
  }
}

module.exports = ExtractedProductTable;
