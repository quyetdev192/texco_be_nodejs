/**
 * Bảng Chi tiết Tiêu hao NPL (Gộp Consumption + FIFO Allocation)
 * Chứa đầy đủ thông tin: MA NL, SO HD, NGAY HD, TEN HANG, DON VI TINH, SO LUONG, 
 * DON GIA, THANH TIEN, TY GIA VND/USD, DON GIA USD, SO LUONG LAM CO, DVT, 
 * TRỊ GIÁ CIF USD, HS CODE, XUAT XU
 */
class NplConsumptionDetailClass {
  static collection = 'npl_consumption_details';

  static getSchema() {
    return {
      lohangDraftId: { type: 'ObjectId', ref: 'LohangDraft', required: true },
      
      // Thông tin SKU (để group by)
      skuCode: { type: 'String', required: true },
      productName: { type: 'String' },
      quantitySku: { type: 'Number', required: true }, // Số lượng SKU xuất
      
      // === 15 CỘT CHÍNH THEO BẢNG YÊU CẦU ===
      
      // 1. MÃ NL - Mã nguyên phụ liệu
      maNl: { type: 'String' },
      
      // 2. SỐ HĐ - Số hợp đồng hoặc hóa đơn mua hàng
      soHd: { type: 'String', required: true },
      
      // 3. NGÀY HĐ - Ngày trên hóa đơn mua hoặc nhập
      ngayHd: { type: 'Date', required: true },
      
      // 4. TÊN HÀNG - Tên nguyên phụ liệu
      tenHang: { type: 'String', required: true },
      
      // 5. ĐƠN VỊ TÍNH (ĐVT) - Đơn vị đo của NPL
      donViTinh: { type: 'String', required: true },
      
      // 6. SỐ LƯỢNG - Số lượng thực tế nhập hoặc dùng
      soLuong: { type: 'Number', required: true },
      
      // 7. ĐƠN GIÁ (VND) - Giá mua VND / 1 đơn vị
      donGia: { type: 'Number' },
      
      // 8. THÀNH TIỀN (VND) - Giá trị tổng của NPL theo VND
      thanhTien: { type: 'Number' },
      
      // 9. TỶ GIÁ VND/USD - Tỷ giá quy đổi
      tyGiaVndUsd: { type: 'Number', default: 25000 },
      
      // 10. ĐƠN GIÁ USD - Giá USD/đơn vị
      donGiaUsd: { type: 'Number' },
      
      // 11. SỐ LƯỢNG LÀM CO - Số lượng tính cho chứng nhận CO
      soLuongLamCo: { type: 'Number' },
      
      // 12. ĐVT (CO) - Đơn vị tương ứng dùng trong hồ sơ CO
      dvt: { type: 'String' },
      
      // 13. TRỊ GIÁ CIF (USD) - Giá trị tính theo điều kiện CIF
      triGiaCifUsd: { type: 'Number' },
      
      // 14. HS CODE - Mã HS hàng hóa theo biểu thuế xuất nhập khẩu
      hsCode: { type: 'String' },
      
      // 15. XUẤT XỨ - Nguồn gốc nguyên phụ liệu
      xuatXu: { type: 'String' },
      
      // Metadata bổ sung
      normPerSku: { type: 'Number' }, // Định mức/1 SKU
      totalQuantityNeeded: { type: 'Number' }, // Tổng số lượng cần dùng
      supplierName: { type: 'String' }, // Nhà cung cấp
      
      // Thứ tự FIFO (nếu 1 NPL được phân bổ từ nhiều hóa đơn)
      allocationOrder: { type: 'Number', required: true },
      
      // Trạng thái
      status: { 
        type: 'String', 
        enum: ['ALLOCATED', 'INSUFFICIENT_STOCK'],
        default: 'ALLOCATED'
      },
      
      createdAt: { type: 'Date', default: Date.now },
      updatedAt: { type: 'Date', default: Date.now }
    };
  }
}

module.exports = NplConsumptionDetailClass;
