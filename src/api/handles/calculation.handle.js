const mongoose = require('mongoose');
const NplConsumptionDetailClass = require('../models/nplConsumptionDetail.model');

function buildModelFromClass(modelClass) {
  const modelName = modelClass.name;
  if (mongoose.models[modelName]) return mongoose.models[modelName];
  const schemaDefinition = modelClass.getSchema();
  const schema = new mongoose.Schema(schemaDefinition, { collection: modelClass.collection });
  return mongoose.model(modelName, schema);
}

const NplConsumptionDetail = buildModelFromClass(NplConsumptionDetailClass);

/**
 * Lấy bảng Chi tiết Tiêu hao NPL (gộp Consumption + FIFO Allocation)
 * Trả về đúng 15 cột theo yêu cầu
 */
async function getConsumptionTable(lohangDraftId) {
  const details = await NplConsumptionDetail.find({ lohangDraftId })
    .sort({ skuCode: 1, tenHang: 1, allocationOrder: 1 })
    .lean();

  // Format lại data theo 15 cột yêu cầu
  const formattedDetails = details.map(detail => ({
    // === 15 CỘT CHÍNH ===
    // 1. MÃ NL - Mã nguyên phụ liệu
    maNl: detail.maNl || '',
    
    // 2. SỐ HĐ - Số hợp đồng hoặc hóa đơn mua hàng
    soHd: detail.soHd || '',
    
    // 3. NGÀY HĐ - Ngày trên hóa đơn mua hoặc nhập
    ngayHd: detail.ngayHd,
    
    // 4. TÊN HÀNG - Tên nguyên phụ liệu
    tenHang: detail.tenHang || '',
    
    // 5. ĐƠN VỊ TÍNH (ĐVT) - Đơn vị đo của NPL
    donViTinh: detail.donViTinh || '',
    
    // 6. SỐ LƯỢNG - Số lượng thực tế nhập hoặc dùng
    soLuong: Number(detail.soLuong || 0),
    
    // 7. ĐƠN GIÁ (VND) - Giá mua VND / 1 đơn vị
    donGia: Number(detail.donGia || 0),
    
    // 8. THÀNH TIỀN (VND) - = SỐ LƯỢNG × ĐƠN GIÁ
    thanhTien: Number((detail.soLuong || 0) * (detail.donGia || 0)),
    
    // 9. TỶ GIÁ VND/USD - Tỷ giá quy đổi
    tyGiaVndUsd: Number(detail.tyGiaVndUsd || 25000),
    
    // 10. ĐƠN GIÁ USD - = ĐƠN GIÁ (VND) / TỶ GIÁ
    donGiaUsd: Number((detail.donGia || 0) / (detail.tyGiaVndUsd || 25000)),
    
    // 11. SỐ LƯỢNG LÀM CO - Số lượng tính cho chứng nhận CO
    soLuongLamCo: Number(detail.soLuongLamCo || detail.soLuong || 0),
    
    // 12. ĐVT (CO) - Đơn vị tương ứng dùng trong hồ sơ CO
    dvt: detail.dvt || detail.donViTinh || '',
    
    // 13. TRỊ GIÁ CIF (USD) - = SỐ LƯỢNG LÀM CO × ĐƠN GIÁ USD
    triGiaCifUsd: Number((detail.soLuongLamCo || detail.soLuong || 0) * ((detail.donGia || 0) / (detail.tyGiaVndUsd || 25000))),
    
    // 14. HS CODE - Mã HS hàng hóa theo biểu thuế xuất nhập khẩu
    hsCode: detail.hsCode || '',
    
    // 15. XUẤT XỨ - Nguồn gốc nguyên phụ liệu
    xuatXu: detail.xuatXu || ''
  }));

  // Tính summary
  const invoiceMap = new Map();
  details.forEach(detail => {
    const key = detail.soHd;
    if (!invoiceMap.has(key)) {
      invoiceMap.set(key, {
        soHd: detail.soHd,
        ngayHd: detail.ngayHd,
        supplier: detail.supplierName,
        count: 0
      });
    }
    invoiceMap.get(key).count++;
  });

  const summary = {
    totalRecords: formattedDetails.length,
    totalSkus: new Set(formattedDetails.map(d => d.skuCode)).size,
    totalNplTypes: new Set(formattedDetails.map(d => d.tenHang)).size,
    totalInvoices: invoiceMap.size,
    invoices: Array.from(invoiceMap.values()),
    totalThanhTienVnd: formattedDetails.reduce((sum, d) => sum + d.thanhTien, 0),
    totalTriGiaCifUsd: formattedDetails.reduce((sum, d) => sum + d.triGiaCifUsd, 0)
  };

  return {
    lohangDraftId,
    details: formattedDetails,
    summary
  };
}

module.exports = {
  getConsumptionTable
};
