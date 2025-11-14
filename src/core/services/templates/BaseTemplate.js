/**
 * Base Template class cho tất cả các loại bảng kê
 */
class BaseTemplate {
  constructor() {
    this.criterionType = '';
    this.formType = '';
  }

  /**
   * Tạo Excel workbook với template cụ thể
   * @param {Object} skuData - Dữ liệu SKU
   * @param {Object} headerInfo - Thông tin header
   * @param {Object} lohangDraft - Thông tin lô hàng
   * @returns {Object} Excel workbook
   */
  async createWorkbook(skuData, headerInfo, lohangDraft) {
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    
    // Metadata
    workbook.creator = 'Texco System';
    workbook.lastModifiedBy = 'Texco System';
    workbook.created = new Date();
    workbook.modified = new Date();

    // Tạo worksheet với template cụ thể
    const worksheet = this.createWorksheet(workbook, skuData, headerInfo, lohangDraft);
    
    return workbook;
  }

  /**
   * Tạo worksheet - method này sẽ được override bởi các template con
   */
  createWorksheet(workbook, skuData, headerInfo, lohangDraft) {
    throw new Error('createWorksheet method must be implemented by subclass');
  }

  /**
   * Lấy tên file cho template
   */
  getFileName(skuCode) {
    return `${this.criterionType}_${skuCode}_${Date.now()}.xlsx`;
  }

  /**
   * Tạo header chung cho tất cả template
   */
  createHeader(worksheet, criterionType, currentRow = 1) {
    // Tiêu đề chính
    worksheet.mergeCells(`A${currentRow}:K${currentRow}`);
    const titleCell = worksheet.getCell(`A${currentRow}`);
    titleCell.value = `BẢNG KÊ KHAI HÀNG HÓA XUẤT KHẨU ĐẠT TIÊU CHÍ "${criterionType}"`;
    titleCell.font = { name: 'Times New Roman', size: 14, bold: true };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(currentRow).height = 30;
    currentRow += 2;

    // Subtitle
    worksheet.mergeCells(`A${currentRow}:K${currentRow}`);
    const subtitleCell = worksheet.getCell(`A${currentRow}`);
    subtitleCell.value = '(Ban hành theo Thông tư số 05/2018/TT-BCT ngày 03/04/2018 quy định về xuất xứ hàng hóa)';
    subtitleCell.font = { name: 'Times New Roman', size: 11, italic: true };
    subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    
    return currentRow + 2;
  }

  /**
   * Thêm thông tin công ty
   */
  addCompanyInfo(worksheet, startRow, headerInfo) {
    const formatDate = (dateStr) => {
      if (!dateStr) return 'ngày 12 tháng 07 năm 2025';
      const date = new Date(dateStr);
      const day = date.getDate();
      const month = date.getMonth() + 1;
      const year = date.getFullYear();
      return `ngày ${day} tháng ${month.toString().padStart(2, '0')} năm ${year}`;
    };

    let row = startRow;
    
    // Tên thương nhân
    worksheet.getCell(`A${row}`).value = 'Tên thương nhân:';
    worksheet.getCell(`A${row}`).font = { name: 'Times New Roman', size: 11 };
    worksheet.getCell(`C${row}`).value = headerInfo.companyName || 'CÔNG TY TNHH MAI THƠ VIỆT NAM';
    worksheet.getCell(`C${row}`).font = { name: 'Times New Roman', size: 11 };
    row++;

    // Mã số thuế
    worksheet.getCell(`A${row}`).value = 'Mã số thuế:';
    worksheet.getCell(`A${row}`).font = { name: 'Times New Roman', size: 11 };
    worksheet.getCell(`C${row}`).value = headerInfo.taxCode || '3702797777';
    worksheet.getCell(`C${row}`).font = { name: 'Times New Roman', size: 11 };
    row++;

    // Tờ khai hải quan
    worksheet.getCell(`A${row}`).value = 'Tờ khai hải quan XK số:';
    worksheet.getCell(`A${row}`).font = { name: 'Times New Roman', size: 11 };
    worksheet.getCell(`C${row}`).value = `${headerInfo.exportDeclarationNumber || '307569904740/B11'} ${formatDate(headerInfo.exportDeclarationDate)}`;
    worksheet.getCell(`C${row}`).font = { name: 'Times New Roman', size: 11 };
    
    return row + 2;
  }

  /**
   * Thêm thông tin sản phẩm theo format ảnh CTH
   */
  addProductInfo(worksheet, startRow, product, criterionType) {
    let row = startRow;

    // Tạo layout 2 cột như trong ảnh
    // Cột trái: Tiêu chí áp dụng, Mã HS, Trị giá FOB, Tỷ giá
    // Cột phải: Tên hàng, Số lượng, Trị giá FOB loại trừ

    // Row 1: Tiêu chí áp dụng | Tên hàng
    worksheet.getCell(`A${row}`).value = 'Tiêu chí áp dụng:';
    worksheet.getCell(`A${row}`).font = { name: 'Times New Roman', size: 10 };
    worksheet.getCell(`B${row}`).value = criterionType;
    worksheet.getCell(`B${row}`).font = { name: 'Times New Roman', size: 10 };
    
    worksheet.getCell(`G${row}`).value = 'Tên hàng:';
    worksheet.getCell(`G${row}`).font = { name: 'Times New Roman', size: 10 };
    worksheet.mergeCells(`H${row}:N${row}`);
    worksheet.getCell(`H${row}`).value = product.productName || 'Tủ phòng tắm (5022064),Qc:(610x465x866)mm, không nhãn hiệu, làm từ ván MDF, gỗ cao su. Mới 100%#&VN';
    worksheet.getCell(`H${row}`).font = { name: 'Times New Roman', size: 10 };
    worksheet.getCell(`H${row}`).alignment = { wrapText: true, vertical: 'middle' };
    worksheet.getRow(row).height = 35;
    row++;

    // Row 2: Mã HS | Số lượng
    worksheet.getCell(`A${row}`).value = 'Mã HS của hàng hóa:';
    worksheet.getCell(`A${row}`).font = { name: 'Times New Roman', size: 10 };
    worksheet.getCell(`B${row}`).value = product.hsCode || '940360';
    worksheet.getCell(`B${row}`).font = { name: 'Times New Roman', size: 10 };
    
    worksheet.getCell(`G${row}`).value = 'Số lượng:';
    worksheet.getCell(`G${row}`).font = { name: 'Times New Roman', size: 10 };
    worksheet.getCell(`H${row}`).value = `${product.quantity || 14.00} PCE`;
    worksheet.getCell(`H${row}`).font = { name: 'Times New Roman', size: 10 };
    row++;

    // Row 3: Trị giá FOB | Trị giá FOB loại trừ
    worksheet.getCell(`A${row}`).value = 'Trị giá FOB:';
    worksheet.getCell(`A${row}`).font = { name: 'Times New Roman', size: 10 };
    worksheet.getCell(`B${row}`).value = `${product.fobValueUsd || '1,885.94'} USD`;
    worksheet.getCell(`B${row}`).font = { name: 'Times New Roman', size: 10 };
    
    worksheet.getCell(`G${row}`).value = 'Trị giá FOB loại trừ NL NK từ TQ:';
    worksheet.getCell(`G${row}`).font = { name: 'Times New Roman', size: 10 };
    worksheet.getCell(`H${row}`).value = `${product.fobValueUsd || '1,703.94'} USD`;
    worksheet.getCell(`H${row}`).font = { name: 'Times New Roman', size: 10 };
    row++;
    return row + 3;
  }

  /**
   * Thêm kết luận theo format ảnh CTH
   */
  addConclusion(worksheet, startRow, conclusion, percentage) {
    let row = startRow;

    // Kết luận
    worksheet.getCell(`A${row}`).value = 'Kết luận: Hàng hóa đáp ứng tiêu chí CTH';
    worksheet.getCell(`A${row}`).font = { name: 'Times New Roman', size: 10 };
    row += 1;

    // Cam kết
    worksheet.mergeCells(`A${row}:N${row}`);
    const commitmentCell = worksheet.getCell(`A${row}`);
    commitmentCell.value = 'Công ty cam kết số liệu khai trên là đúng và xin chịu trách nhiệm pháp lý về tính tin cậy số liệu đã khai';
    commitmentCell.font = { name: 'Times New Roman', size: 10 };
    commitmentCell.alignment = { horizontal: 'center', vertical: 'middle' };
    row += 3;

    // Chữ ký - căn phải như trong ảnh
    worksheet.getCell(`L${row}`).value = 'TP. Hồ Chí Minh, ngày 12 tháng 07 năm 2025';
    worksheet.getCell(`L${row}`).font = { name: 'Times New Roman', size: 10 };
    worksheet.getCell(`L${row}`).alignment = { horizontal: 'right' };
    row++;

    worksheet.getCell(`L${row}`).value = 'Người đại diện theo pháp luật thương nhân';
    worksheet.getCell(`L${row}`).font = { name: 'Times New Roman', size: 10 };
    worksheet.getCell(`L${row}`).alignment = { horizontal: 'center' };
    row++;

    worksheet.getCell(`L${row}`).value = '(Ký, đóng dấu, ghi rõ họ, tên)';
    worksheet.getCell(`L${row}`).font = { name: 'Times New Roman', size: 9, italic: true };
    worksheet.getCell(`L${row}`).alignment = { horizontal: 'center' };

    return row + 3;
  }

  /**
   * Auto-fit columns
   */
  autoFitColumns(worksheet) {
    worksheet.columns.forEach((column, index) => {
      let maxLength = 0;
      column.eachCell({ includeEmpty: true }, (cell) => {
        const columnLength = cell.value ? cell.value.toString().length : 10;
        if (columnLength > maxLength) {
          maxLength = columnLength;
        }
      });
      column.width = Math.max(maxLength + 2, 12);
    });
  }
}

module.exports = BaseTemplate;
