/**
 * Bảng Chi tiết Phân bổ Xuất kho (Stock Allocation - FIFO)
 * Ghi lại NPL xuất từ hóa đơn nhập nào để truy xuất nguồn gốc
 */
class StockAllocationClass {
  static collection = 'stock_allocations';

  static getSchema() {
    return {
      lohangDraftId: { type: 'ObjectId', ref: 'LohangDraft', required: true },
      consumptionId: { type: 'ObjectId', ref: 'ConsumptionCalculation', required: true },
      
      // SKU Info
      skuCode: { type: 'String', required: true },
      productName: { type: 'String' },
      
      // NPL Info
      nplCode: { type: 'String' },
      nplName: { type: 'String', required: true },
      hsCodeNpl: { type: 'String' },
      unit: { type: 'String', required: true },
      
      // Phân bổ từ hóa đơn nhập kho (FIFO)
      fromInvoiceNo: { type: 'String', required: true }, // Số hóa đơn nhập
      fromInvoiceDate: { type: 'Date', required: true }, // Ngày hóa đơn nhập
      fromSupplier: { type: 'String' }, // Nhà cung cấp
      
      // Số lượng phân bổ
      allocatedQuantity: { type: 'Number', required: true }, // SL xuất từ hóa đơn này
      unitPriceVnd: { type: 'Number' },
      totalValueVnd: { type: 'Number' },
      unitPriceUsd: { type: 'Number' },
      totalValueUsd: { type: 'Number' },
      
      // Xuất xứ
      originCountry: { type: 'String' }, // Xuất xứ NPL
      hasCo: { type: 'Boolean', default: false }, // Có C/O không
      coNumber: { type: 'String' }, // Số C/O (nếu có)
      
      // Thứ tự FIFO
      allocationOrder: { type: 'Number', required: true }, // 1, 2, 3... (FIFO order)
      
      exchangeRate: { type: 'Number', default: 24500 },
      
      createdAt: { type: 'Date', default: Date.now },
      updatedAt: { type: 'Date', default: Date.now }
    };
  }
}

module.exports = StockAllocationClass;
