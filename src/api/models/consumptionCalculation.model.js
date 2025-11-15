class ConsumptionCalculationClass {
  static collection = "consumption_calculations";

  static getSchema() {
    return {
      lohangDraftId: { type: "ObjectId", ref: "LohangDraft", required: true },
      skuCode: { type: "String", required: true },
      productName: { type: "String" },
      nplCode: { type: "String" },
      nplName: { type: "String", required: true },
      hsCodeNpl: { type: "String" },
      unit: { type: "String", required: true },
      normPerSku: { type: "Number", required: true },
      quantitySku: { type: "Number", required: true },
      totalQuantityNeeded: { type: "Number", required: true },
      unitPriceVnd: { type: "Number" },
      totalValueVnd: { type: "Number" },
      unitPriceUsd: { type: "Number" },
      totalValueUsd: { type: "Number" },
      exchangeRate: { type: "Number", default: 24500 },
      status: {
        type: "String",
        enum: ["CALCULATED", "ALLOCATED", "INSUFFICIENT_STOCK"],
        default: "CALCULATED",
      },
      createdAt: { type: "Date", default: Date.now },
      updatedAt: { type: "Date", default: Date.now },
    };
  }
}

module.exports = ConsumptionCalculationClass;
