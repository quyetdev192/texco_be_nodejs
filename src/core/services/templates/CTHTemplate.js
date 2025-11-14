const BaseTemplate = require('./BaseTemplate');

/**
 * Template cho tiêu chí CTH (Change in Tariff Heading)
 */
class CTHTemplate extends BaseTemplate {
  constructor() {
    super();
    this.criterionType = 'CTH';
  }

  /**
   * Tạo worksheet cho CTH
   */
  createWorksheet(workbook, skuData, headerInfo, lohangDraft) {
    const worksheet = workbook.addWorksheet('Bảng kê CTH', {
      properties: { defaultRowHeight: 25, defaultColWidth: 12 }
    });

    let currentRow = 1;

    // Header
    currentRow = this.createHeader(worksheet, this.criterionType, currentRow);

    // Thông tin công ty
    currentRow = this.addCompanyInfo(worksheet, currentRow, headerInfo);

    // Thông tin sản phẩm
    currentRow = this.addProductInfo(worksheet, currentRow, skuData.product, this.criterionType);

    // Bảng nguyên liệu CTH
    currentRow = this.addCTHMaterialTable(worksheet, currentRow, skuData.nplDetails);

    // Kết luận
    this.addConclusion(worksheet, currentRow, skuData.conclusion, skuData.ctcPercentage);

    // Auto-fit columns
    this.autoFitColumns(worksheet);

    return worksheet;
  }

  /**
   * Tạo bảng nguyên liệu CTH - Compact, chỉ nội dung cần thiết
   */
  addCTHMaterialTable(worksheet, startRow, nplDetails) {
    let row = startRow;

    // Header - 8 cột chính
    const headers = [
      'STT',
      'Tên nguyên liệu', 
      'Mã HS',
      'Đơn vị tính',
      'Số lượng',
      'Đơn giá (USD)',
      'Trị giá (USD)',
      'Xuất xứ'
    ];

    // Tạo header row
    headers.forEach((header, index) => {
      const cell = worksheet.getCell(row, index + 1);
      cell.value = header;
      cell.font = { name: 'Times New Roman', size: 10, bold: true };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = {
        top: { style: 'thin' }, left: { style: 'thin' },
        bottom: { style: 'thin' }, right: { style: 'thin' }
      };
    });
    worksheet.getRow(row).height = 25;
    row++;

    // Data rows - 8 cột, compact
    let totalValue = 0;
    nplDetails.forEach((npl, index) => {
      const rowData = [
        index + 1, // STT
        npl.tenNguyenLieu || '', // Tên nguyên liệu
        npl.maHS || '', // Mã HS
        npl.donViTinh || '', // Đơn vị tính
        npl.tongLuongSuDung ? npl.tongLuongSuDung.toFixed(4) : '', // Số lượng
        npl.donGiaUsd ? npl.donGiaUsd.toFixed(2) : '', // Đơn giá USD
        npl.triGia ? npl.triGia.toFixed(2) : '', // Trị giá USD
        npl.xuatXu || '' // Xuất xứ
      ];

      rowData.forEach((data, colIndex) => {
        const cell = worksheet.getCell(row, colIndex + 1);
        cell.value = data;
        cell.font = { name: 'Times New Roman', size: 9 };
        cell.alignment = { 
          horizontal: colIndex === 1 ? 'left' : 'center', 
          vertical: 'middle',
          wrapText: colIndex === 1 
        };
        cell.border = {
          top: { style: 'thin' }, left: { style: 'thin' },
          bottom: { style: 'thin' }, right: { style: 'thin' }
        };
        
        // Format số
        if ([4, 5, 6].includes(colIndex)) {
          cell.numFmt = '0.00';
        }
      });

      if (npl.triGia) totalValue += npl.triGia;
      worksheet.getRow(row).height = 18;
      row++;
    });

    // Total row
    const totalRowData = ['', 'Cộng:', '', '', '', '', totalValue.toFixed(2), ''];
    totalRowData.forEach((data, colIndex) => {
      const cell = worksheet.getCell(row, colIndex + 1);
      cell.value = data;
      cell.font = { name: 'Times New Roman', size: 9, bold: colIndex === 1 || colIndex === 6 };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin' }, left: { style: 'thin' },
        bottom: { style: 'thin' }, right: { style: 'thin' }
      };
      
      if (colIndex === 6) {
        cell.numFmt = '0.00';
      }
    });

    worksheet.getRow(row).height = 18;

    // Set column widths - compact
    const columnWidths = [5, 25, 12, 8, 12, 12, 12, 15];
    columnWidths.forEach((width, index) => {
      worksheet.getColumn(index + 1).width = width;
    });

    return row + 2;
  }
}

module.exports = CTHTemplate;
