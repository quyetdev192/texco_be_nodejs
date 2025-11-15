class StockAllocationClass {
  static collection = 'stock_allocations';

  static getSchema() {
    return {
      lohangDraftId: { type: 'ObjectId', ref: 'LohangDraft', required: true },
      consumptionId: { type: 'ObjectId', ref: 'ConsumptionCalculation', required: true },
      skuCode: { type: 'String', required: true },
      productName: { type: 'String' },
      nplCode: { type: 'String' },
      nplName: { type: 'String', required: true },
      hsCodeNpl: { type: 'String' },
      unit: { type: 'String', required: true },
      fromInvoiceNo: { type: 'String', required: true },
      fromInvoiceDate: { type: 'Date', required: true },
      fromSupplier: { type: 'String' },
      allocatedQuantity: { type: 'Number', required: true },
      unitPriceVnd: { type: 'Number' },
      totalValueVnd: { type: 'Number' },
      unitPriceUsd: { type: 'Number' },
      totalValueUsd: { type: 'Number' },
      originCountry: { type: 'String' },
      hasCo: { type: 'Boolean', default: false },
      coNumber: { type: 'String' },
      allocationOrder: { type: 'Number', required: true },
      
      exchangeRate: { type: 'Number', default: 24500 },
      
      createdAt: { type: 'Date', default: Date.now },
      updatedAt: { type: 'Date', default: Date.now }
    };
  }
}

module.exports = StockAllocationClass;
