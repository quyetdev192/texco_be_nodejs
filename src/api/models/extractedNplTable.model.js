/**
 * Model: Bảng Nguyên Phụ Liệu (NPL) - Chỉ lưu 5 cột chính
 * Giai đoạn 2: Xử lý Hóa đơn GTGT (VAT Invoice)
 * CHỈ LƯU: nplCode, invoiceNo, invoiceDate, quantity, origin
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
      }],
      
      // Tổng hợp
      totalMaterials: { type: Number },
      
      // AI Confidence
      aiConfidence: { type: Number, min: 0, max: 100 },
      aiModel: { type: String },
      aiVersion: { type: String },
      
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now }
    };
  }
}

module.exports = ExtractedNplTable;
