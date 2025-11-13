/**
<<<<<<< HEAD
 * Model: Bảng Nhập kho Nguyên phụ liệu
 * Giai đoạn 2: Xử lý Hóa đơn GTGT (VAT Invoice)
=======
 * Model: Bảng Nguyên Phụ Liệu (NPL) - Chỉ lưu 5 cột chính
 * Giai đoạn 2: Xử lý Hóa đơn GTGT (VAT Invoice)
 * CHỈ LƯU: nplCode, invoiceNo, invoiceDate, quantity, origin
>>>>>>> quyetdev
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
      
<<<<<<< HEAD
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
=======
      // Dữ liệu bảng - Đầy đủ các cột theo template
      materials: [{
        stt: { type: Number },            // STT - Số thứ tự (được thêm tự động khi lưu DB)
        maNl: { type: String },           // MA NL - Mã Nguyên Liệu
        soHd: { type: String },           // SO HD - Số Hóa Đơn
        ngayHd: { type: Date },           // NGAY HD - Ngày Hóa Đơn
        tenHang: { type: String },        // TEN HANG - Tên Hàng
        donViTinh: { type: String },      // DON VI TINH - Đơn Vị Tính
        soLuong: { type: Number },        // SO LUONG - Số Lượng
        donGia: { type: Number },         // DON GIA - Đơn Giá (VND)
        thanhTien: { type: Number },      // THANH TIEN - Thành Tiền (VND)
        tyGiaVndUsd: { type: Number },    // TY GIA VND/USD - Tỷ Giá
        donGiaUsd: { type: Number },      // DON GIA USD - Đơn Giá USD
        soLuongLamCo: { type: Number },   // SO LUONG LAM CO - Số Lượng Làm C/O
        dvt: { type: String },            // DVT - Đơn Vị Tính (C/O)
        triGiaCifUsd: { type: Number },   // TRỊ GIÁ CIF USD - Trị Giá CIF USD
        hsCode: { type: String },         // HS CODE - Mã HS
        xuatXu: { type: String }          // XUAT XU - Xuất Xứ
>>>>>>> quyetdev
      }],
      
      // Tổng hợp
      totalMaterials: { type: Number },
<<<<<<< HEAD
      totalQuantity: { type: Number },
      totalValueVnd: { type: Number },
=======
>>>>>>> quyetdev
      
      // AI Confidence
      aiConfidence: { type: Number, min: 0, max: 100 },
      aiModel: { type: String },
      aiVersion: { type: String },
      
<<<<<<< HEAD
      // Notes
      notes: { type: String },
      warnings: [{ type: String }],
      
=======
>>>>>>> quyetdev
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now }
    };
  }
}

module.exports = ExtractedNplTable;
