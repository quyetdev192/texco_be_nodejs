class ExtractedNplTable {
  static collection = "extracted_npl_tables";

  static getSchema() {
    return {
      lohangDraftId: { type: String, required: true, index: true },
      bundleId: { type: String, required: true, index: true },

      extractedAt: { type: Date, default: Date.now },
      extractedBy: { type: String },
      status: {
        type: String,
        enum: ["EXTRACTED", "EDITED", "CONFIRMED"],
        default: "EXTRACTED",
      },
      materials: [
        {
          stt: { type: Number },
          maNl: { type: String },
          soHd: { type: String },
          ngayHd: { type: Date },
          tenHang: { type: String },
          donViTinh: { type: String },
          soLuong: { type: Number },
          donGia: { type: Number },
          thanhTien: { type: Number },
          tyGiaVndUsd: { type: Number },
          donGiaUsd: { type: Number },
          soLuongLamCo: { type: Number },
          dvt: { type: String },
          triGiaCifUsd: { type: Number },
          hsCode: { type: String },
          xuatXu: { type: String },
        },
      ],
      totalMaterials: { type: Number },
      aiConfidence: { type: Number, min: 0, max: 100 },
      aiModel: { type: String },
      aiVersion: { type: String },
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now },
    };
  }
}

module.exports = ExtractedNplTable;
