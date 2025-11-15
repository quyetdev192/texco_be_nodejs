class NplConsumptionDetailClass {
  static collection = 'npl_consumption_details';

  static getSchema() {
    return {
      lohangDraftId: { type: 'ObjectId', ref: 'LohangDraft', required: true },
      skuCode: { type: 'String', required: true },
      productName: { type: 'String' },
      quantitySku: { type: 'Number', required: true },
      maNl: { type: 'String' },
      soHd: { type: 'String', required: true },
      ngayHd: { type: 'Date', required: true },
      tenHang: { type: 'String', required: true },
      donViTinh: { type: 'String', required: true },
      soLuong: { type: 'Number', required: true },
      donGia: { type: 'Number' },
      thanhTien: { type: 'Number' },
      tyGiaVndUsd: { type: 'Number', default: 25000 },
      donGiaUsd: { type: 'Number' },
      soLuongLamCo: { type: 'Number' },
      dvt: { type: 'String' },
      triGiaCifUsd: { type: 'Number' },
      hsCode: { type: 'String' },
      xuatXu: { type: 'String' },
      normPerSku: { type: 'Number' },
      totalQuantityNeeded: { type: 'Number' },
      supplierName: { type: 'String' },
      allocationOrder: { type: 'Number', required: true },
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
