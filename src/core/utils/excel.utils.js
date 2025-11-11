const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs').promises;

/**
 * Service xuất Excel bảng kê C/O
 */
class ExcelExportService {
  constructor() {
    this.templatesDir = path.join(__dirname, '../../templates');
  }

  /**
   * Tạo file Excel bảng kê cho 1 SKU
   * @param {Object} skuResult - Kết quả tính toán SKU
   * @param {Object} lohangDraft - Thông tin lô hàng
   * @returns {Promise<Buffer>} - Excel file buffer
   */
  async generateBangKe(skuResult, lohangDraft) {
    const workbook = new ExcelJS.Workbook();
    
    // Chọn template theo criterionType
    const templateName = this.getTemplateName(lohangDraft.criterionType);
    const templatePath = path.join(this.templatesDir, templateName);
    
    try {
      // Kiểm tra template có tồn tại không
      await fs.access(templatePath);
      // Load template
      await workbook.xlsx.readFile(templatePath);
    } catch (error) {
      // Nếu không có template, tạo mới
      console.log('Template không tồn tại, tạo mới:', templatePath);
      return await this.generateBangKeFromScratch(skuResult, lohangDraft);
    }

    // Fill dữ liệu vào template
    const worksheet = workbook.getWorksheet(1);
    await this.fillTemplateData(worksheet, skuResult, lohangDraft);

    // Export to buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
  }

  /**
   * Lấy tên template theo criterion
   */
  getTemplateName(criterionType) {
    const templateMap = {
      'CTC': 'bang-ke-ctc.xlsx',
      'CTSH': 'bang-ke-ctc.xlsx',
      'RVC40': 'bang-ke-rvc.xlsx',
      'RVC50': 'bang-ke-rvc.xlsx',
      'WO': 'bang-ke-wo.xlsx',
      'PE': 'bang-ke-pe.xlsx'
    };
    return templateMap[criterionType] || 'bang-ke-ctc.xlsx';
  }

  /**
   * Fill dữ liệu vào template Excel
   */
  async fillTemplateData(worksheet, skuResult, lohangDraft) {
    // Header information
    worksheet.getCell('B2').value = lohangDraft.invoiceNo || '';
    worksheet.getCell('B3').value = lohangDraft.invoiceDate ? 
      new Date(lohangDraft.invoiceDate).toLocaleDateString('vi-VN') : '';
    worksheet.getCell('B4').value = lohangDraft.formType || '';
    
    // Product info
    worksheet.getCell('B6').value = skuResult.productName || '';
    worksheet.getCell('B7').value = skuResult.hsCodeProduct || '';
    worksheet.getCell('B8').value = skuResult.quantity || 0;
    worksheet.getCell('B9').value = skuResult.fobValueUsd || 0;
    
    // Criterion
    worksheet.getCell('B11').value = lohangDraft.criterionType || '';
    worksheet.getCell('B12').value = skuResult.finalOriginCode || '';
    worksheet.getCell('B13').value = skuResult.finalResult || '';
    
    // NPL breakdown - bắt đầu từ row 16
    let startRow = 16;
    for (const npl of skuResult.nplBreakdown || []) {
      const row = worksheet.getRow(startRow);
      row.getCell(1).value = npl.stt;
      row.getCell(2).value = npl.nplCode;
      row.getCell(3).value = npl.nplName;
      row.getCell(4).value = npl.hsCodeNpl;
      row.getCell(5).value = npl.unit;
      row.getCell(6).value = npl.normPerProduct;
      row.getCell(7).value = npl.totalQuantityUsed;
      row.getCell(8).value = npl.unitPriceUsd;
      row.getCell(9).value = npl.valueUsd;
      row.getCell(10).value = npl.originCountry;
      row.getCell(11).value = npl.hasCo ? 'Có C/O' : 'Không C/O';
      row.getCell(12).value = npl.coNumber || '';
      row.getCell(13).value = npl.invoiceRef || '';
      
      startRow++;
    }
    
    // Summary
    const summaryRow = startRow + 1;
    worksheet.getCell(`I${summaryRow}`).value = skuResult.totalNplValue || 0;
    worksheet.getCell(`I${summaryRow + 1}`).value = skuResult.totalNplValueWithCo || 0;
    worksheet.getCell(`I${summaryRow + 2}`).value = skuResult.totalNplValueWithoutCo || 0;
    
    if (lohangDraft.criterionType.startsWith('RVC')) {
      worksheet.getCell(`I${summaryRow + 3}`).value = skuResult.rvcPercentage || 0;
    }
  }

  /**
   * Tạo Excel từ đầu nếu không có template
   */
  async generateBangKeFromScratch(skuResult, lohangDraft) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Bảng Kê');

    // Set column widths
    worksheet.columns = [
      { width: 5 },  // STT
      { width: 15 }, // Mã NPL
      { width: 30 }, // Tên NPL
      { width: 12 }, // Mã HS
      { width: 8 },  // ĐVT
      { width: 10 }, // Định mức
      { width: 12 }, // SL sử dụng
      { width: 12 }, // Đơn giá
      { width: 15 }, // Trị giá
      { width: 15 }, // Xuất xứ
      { width: 12 }, // Phân loại
      { width: 15 }, // Số C/O
      { width: 15 }  // Số HĐ
    ];

    // Title
    worksheet.mergeCells('A1:M1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = `BẢNG KÊ NGUYÊN PHỤ LIỆU - ${lohangDraft.criterionType}`;
    titleCell.font = { size: 16, bold: true };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Header info
    worksheet.getCell('A3').value = 'Số Invoice:';
    worksheet.getCell('B3').value = lohangDraft.invoiceNo || '';
    worksheet.getCell('A4').value = 'Ngày:';
    worksheet.getCell('B4').value = lohangDraft.invoiceDate ? 
      new Date(lohangDraft.invoiceDate).toLocaleDateString('vi-VN') : '';
    worksheet.getCell('A5').value = 'Form:';
    worksheet.getCell('B5').value = lohangDraft.formType || '';

    // Product info
    worksheet.getCell('A7').value = 'Sản phẩm:';
    worksheet.getCell('B7').value = skuResult.productName || '';
    worksheet.getCell('A8').value = 'Mã HS:';
    worksheet.getCell('B8').value = skuResult.hsCodeProduct || '';
    worksheet.getCell('A9').value = 'Số lượng:';
    worksheet.getCell('B9').value = skuResult.quantity || 0;
    worksheet.getCell('A10').value = 'FOB (USD):';
    worksheet.getCell('B10').value = skuResult.fobValueUsd || 0;

    // Table header
    const headerRow = 12;
    const headers = [
      'STT', 'Mã NPL', 'Tên NPL', 'Mã HS', 'ĐVT', 
      'Định mức', 'SL sử dụng', 'Đơn giá (USD)', 'Trị giá (USD)',
      'Xuất xứ', 'Phân loại', 'Số C/O', 'Số HĐ/TKNK'
    ];
    
    headers.forEach((header, index) => {
      const cell = worksheet.getRow(headerRow).getCell(index + 1);
      cell.value = header;
      cell.font = { bold: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD3D3D3' }
      };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    // Data rows
    let currentRow = headerRow + 1;
    for (const npl of skuResult.nplBreakdown || []) {
      const row = worksheet.getRow(currentRow);
      
      row.getCell(1).value = npl.stt;
      row.getCell(2).value = npl.nplCode;
      row.getCell(3).value = npl.nplName;
      row.getCell(4).value = npl.hsCodeNpl;
      row.getCell(5).value = npl.unit;
      row.getCell(6).value = npl.normPerProduct;
      row.getCell(7).value = npl.totalQuantityUsed;
      row.getCell(8).value = npl.unitPriceUsd;
      row.getCell(9).value = npl.valueUsd;
      row.getCell(10).value = npl.originCountry;
      row.getCell(11).value = npl.hasCo ? 'Có C/O' : 'Không C/O';
      row.getCell(12).value = npl.coNumber || '';
      row.getCell(13).value = npl.invoiceRef || '';

      // Apply borders
      for (let i = 1; i <= 13; i++) {
        row.getCell(i).border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      }

      currentRow++;
    }

    // Summary
    currentRow += 1;
    worksheet.getCell(`H${currentRow}`).value = 'Tổng trị giá NPL:';
    worksheet.getCell(`I${currentRow}`).value = skuResult.totalNplValue || 0;
    
    currentRow++;
    worksheet.getCell(`H${currentRow}`).value = 'NPL có C/O:';
    worksheet.getCell(`I${currentRow}`).value = skuResult.totalNplValueWithCo || 0;
    
    currentRow++;
    worksheet.getCell(`H${currentRow}`).value = 'NPL không C/O:';
    worksheet.getCell(`I${currentRow}`).value = skuResult.totalNplValueWithoutCo || 0;

    if (lohangDraft.criterionType.startsWith('RVC')) {
      currentRow++;
      worksheet.getCell(`H${currentRow}`).value = 'RVC (%):';
      worksheet.getCell(`I${currentRow}`).value = skuResult.rvcPercentage?.toFixed(2) || 0;
    }

    // Result
    currentRow += 2;
    worksheet.getCell(`A${currentRow}`).value = 'Kết quả:';
    worksheet.getCell(`B${currentRow}`).value = skuResult.finalResult || '';
    worksheet.getCell(`B${currentRow}`).font = { 
      bold: true, 
      color: { argb: skuResult.finalResult === 'ĐẠT' ? 'FF00FF00' : 'FFFF0000' }
    };
    
    currentRow++;
    worksheet.getCell(`A${currentRow}`).value = 'Mã xuất xứ:';
    worksheet.getCell(`B${currentRow}`).value = skuResult.finalOriginCode || '';

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
  }

  /**
   * Tạo nhiều file Excel cho tất cả SKU trong lô hàng
   */
  async generateAllBangKe(lohangDraftId) {
    const SkuResultClass = require('../../api/models/skuResult.model');
    const LohangDraftClass = require('../../api/models/lohangDraft.model');
    const mongoose = require('mongoose');
    
    const buildModel = (modelClass) => {
      const modelName = modelClass.name;
      if (mongoose.models[modelName]) return mongoose.models[modelName];
      const schema = new mongoose.Schema(modelClass.getSchema(), { collection: modelClass.collection });
      return mongoose.model(modelName, schema);
    };

    const SkuResult = buildModel(SkuResultClass);
    const LohangDraft = buildModel(LohangDraftClass);

    const lohangDraft = await LohangDraft.findById(lohangDraftId).lean();
    const skuResults = await SkuResult.find({ lohangDraftId }).lean();

    const files = [];
    for (const skuResult of skuResults) {
      const buffer = await this.generateBangKe(skuResult, lohangDraft);
      const fileName = `${skuResult.skuCode}_${lohangDraft.criterionType}.xlsx`;
      files.push({
        fileName,
        buffer,
        skuCode: skuResult.skuCode
      });
    }

    return files;
  }
}

// Singleton
let excelServiceInstance = null;

function getExcelService() {
  if (!excelServiceInstance) {
    excelServiceInstance = new ExcelExportService();
  }
  return excelServiceInstance;
}

module.exports = {
  ExcelExportService,
  getExcelService
};
