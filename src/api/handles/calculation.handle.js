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

async function getConsumptionTable(lohangDraftId) {
  const details = await NplConsumptionDetail.find({ lohangDraftId })
    .sort({ skuCode: 1, tenHang: 1, allocationOrder: 1 })
    .lean();

  const formattedDetails = details.map(detail => ({
    maNl: detail.maNl || '',
    soHd: detail.soHd || '',
    ngayHd: detail.ngayHd,
    tenHang: detail.tenHang || '',
    donViTinh: detail.donViTinh || '',
    soLuong: Number(detail.soLuong || 0),
    donGia: Number(detail.donGia || 0),
    thanhTien: Number((detail.soLuong || 0) * (detail.donGia || 0)),
    tyGiaVndUsd: Number(detail.tyGiaVndUsd || 25000),
    donGiaUsd: Number((detail.donGia || 0) / (detail.tyGiaVndUsd || 25000)),
    soLuongLamCo: Number(detail.soLuongLamCo || detail.soLuong || 0),
    dvt: detail.dvt || detail.donViTinh || '',
    triGiaCifUsd: Number((detail.soLuongLamCo || detail.soLuong || 0) * ((detail.donGia || 0) / (detail.tyGiaVndUsd || 25000))),
    hsCode: detail.hsCode || '',
    xuatXu: detail.xuatXu || ''
  }));

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
