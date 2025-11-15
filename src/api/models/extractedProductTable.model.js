class ExtractedProductTable {
  static collection = "extracted_product_tables";

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

      products: [
        {
          stt: { type: Number },
          skuCode: { type: String },
          modelName: { type: String },
          productName: { type: String },
          hsCode: { type: String },
          quantity: { type: Number },
          unit: { type: String },
          unitPriceUsd: { type: Number },
          fobValueUsd: { type: Number },
          exchangeRate: { type: Number },
          fobValueVnd: { type: Number },

          sourceInvoiceId: { type: String },
          sourceDeclarationId: { type: String },

          isEdited: { type: Boolean, default: false },
          editedFields: [{ type: String }],
          editHistory: [
            {
              editedAt: { type: Date },
              editedBy: { type: String },
              fieldName: { type: String },
              oldValue: { type: String },
              newValue: { type: String },
            },
          ],
        },
      ],

      totalProducts: { type: Number },
      totalQuantity: { type: Number },
      totalFobValueUsd: { type: Number },
      totalFobValueVnd: { type: Number },

      aiConfidence: { type: Number, min: 0, max: 100 },
      aiModel: { type: String },
      aiVersion: { type: String },

      notes: { type: String },
      warnings: [{ type: String }],

      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now },
    };
  }
}

module.exports = ExtractedProductTable;
