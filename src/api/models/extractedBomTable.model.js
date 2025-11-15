class ExtractedBomTable {
  static collection = "extracted_bom_tables";

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
      bomData: [
        {
          stt: { type: Number },
          nplCode: { type: String },
          nplName: { type: String },
          hsCode: { type: String },
          unit: { type: String },
          normPerSku: { type: Map, of: Number },
          sourceBomId: { type: String },
          isEdited: { type: Boolean, default: false },
          editedFields: [{ type: String }],
          editHistory: [
            {
              editedAt: { type: Date },
              editedBy: { type: String },
              fieldName: { type: String },
              skuCode: { type: String },
              oldValue: { type: String },
              newValue: { type: String },
            },
          ],
        },
      ],
      skuList: [
        {
          stt: { type: String },
          skuCode: { type: String },
          productName: { type: String },
        },
      ],
      totalMaterials: { type: Number },
      totalSkus: { type: Number },
      aiConfidence: { type: Number, min: 0, max: 100 },
      aiModel: { type: String },
      aiVersion: { type: String },
      notes: { type: String },
      warnings: [{ type: String }],
      bomExcelUrl: { type: String },
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now },
    };
  }
}

module.exports = ExtractedBomTable;
