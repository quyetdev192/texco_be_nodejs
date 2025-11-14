const BaseTemplate = require('./BaseTemplate');

/**
 * Template cho tiêu chí CTH (Change in Tariff Heading)
 * Format theo mẫu CTC chuẩn của Bộ Công Thương
 */
class CTHTemplate extends BaseTemplate {
  constructor() {
    super();
    this.criterionType = 'CTH';
  }

  /**
   * Tạo worksheet cho CTH - theo format ảnh tham khảo
   */
  createWorksheet(workbook, skuData, headerInfo, lohangDraft) {
    const worksheet = workbook.addWorksheet('Bảng kê', {
      pageSetup: { paperSize: 'A4', orientation: 'landscape' }
    });

    let currentRow = 1;

    // 1. Tiêu đề chính
    worksheet.mergeCells(`A${currentRow}:N${currentRow}`);
    const titleCell = worksheet.getCell(`A${currentRow}`);
    titleCell.value = `BẢNG KÊ KHAI HÀNG HÓA XUẤT KHẨU ĐẠT TIÊU CHÍ "CTH"`;
    titleCell.font = { name: 'Times New Roman', size: 12, bold: true };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(currentRow).height = 20;
    currentRow++;

    // 2. Subtitle
    worksheet.mergeCells(`A${currentRow}:N${currentRow}`);
    const subtitleCell = worksheet.getCell(`A${currentRow}`);
    subtitleCell.value = `(Ban hành theo Thông tư số 05/2018/TT-BCT ngày 03/04/2018 quy định về xuất xứ hàng hóa)`;
    subtitleCell.font = { name: 'Times New Roman', size: 9, italic: true };
    subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(currentRow).height = 15;
    currentRow += 2;

    // 3. Thông tin công ty (2 cột)
    this.addCompanyInfoCompact(worksheet, currentRow, headerInfo, skuData);
    currentRow += 5;

    // 4. Bảng nguyên liệu chính (theo ảnh)
    currentRow = this.addMainMaterialTable(worksheet, currentRow, skuData.nplDetails);

    // 5. Kết luận
    currentRow += 2;
    this.addConclusionCompact(worksheet, currentRow, skuData);

    return worksheet;
  }

  /**
   * Thông tin công ty - format 2 cột + thông tin sản phẩm
   */
  addCompanyInfoCompact(worksheet, startRow, headerInfo, skuData) {
    let row = startRow;

    // Cột trái: Thông tin công ty
    worksheet.getCell(`A${row}`).value = 'Tên thương nhân:';
    worksheet.getCell(`A${row}`).font = { name: 'Times New Roman', size: 10 };
    worksheet.getCell(`B${row}`).value = headerInfo.companyName || 'CÔNG TY TNHH MAI THƠ VIỆT NAM';
    worksheet.getCell(`B${row}`).font = { name: 'Times New Roman', size: 10 };
    row++;

    worksheet.getCell(`A${row}`).value = 'Mã số thuế:';
    worksheet.getCell(`A${row}`).font = { name: 'Times New Roman', size: 10 };
    worksheet.getCell(`B${row}`).value = headerInfo.taxCode || '3702797777';
    worksheet.getCell(`B${row}`).font = { name: 'Times New Roman', size: 10 };
    row++;

    worksheet.getCell(`A${row}`).value = 'Tờ khai hải quan XK số:';
    worksheet.getCell(`A${row}`).font = { name: 'Times New Roman', size: 10 };
    worksheet.getCell(`B${row}`).value = headerInfo.exportDeclarationNumber || '';
    worksheet.getCell(`B${row}`).font = { name: 'Times New Roman', size: 10 };
    row++;

    // Cột phải: Thông tin sản phẩm chi tiết
    const productRow = startRow;
    worksheet.getCell(`H${productRow}`).value = 'Tiêu chí áp dụng:';
    worksheet.getCell(`H${productRow}`).font = { name: 'Times New Roman', size: 10 };
    worksheet.getCell(`I${productRow}`).value = 'CTH';
    worksheet.getCell(`I${productRow}`).font = { name: 'Times New Roman', size: 10, bold: true };

    worksheet.getCell(`H${productRow + 1}`).value = 'Tên hàng:';
    worksheet.getCell(`H${productRow + 1}`).font = { name: 'Times New Roman', size: 10 };
    worksheet.getCell(`I${productRow + 1}`).value = skuData.product?.productName || '';
    worksheet.getCell(`I${productRow + 1}`).font = { name: 'Times New Roman', size: 10 };

    worksheet.getCell(`H${productRow + 2}`).value = 'Mã HS:';
    worksheet.getCell(`H${productRow + 2}`).font = { name: 'Times New Roman', size: 10 };
    worksheet.getCell(`I${productRow + 2}`).value = skuData.product?.hsCode || '';
    worksheet.getCell(`I${productRow + 2}`).font = { name: 'Times New Roman', size: 10 };

    // Thêm thông tin sản phẩm bổ sung (hàng 4-7)
    worksheet.getCell(`H${productRow + 3}`).value = 'Số lượng:';
    worksheet.getCell(`H${productRow + 3}`).font = { name: 'Times New Roman', size: 10 };
    worksheet.getCell(`I${productRow + 3}`).value = skuData.product?.quantity || '';
    worksheet.getCell(`I${productRow + 3}`).font = { name: 'Times New Roman', size: 10 };

    worksheet.getCell(`H${productRow + 4}`).value = 'Trị giá FOB:';
    worksheet.getCell(`H${productRow + 4}`).font = { name: 'Times New Roman', size: 10 };
    worksheet.getCell(`I${productRow + 4}`).value = skuData.product?.fobValue ? `${skuData.product.fobValue} USD` : '';
    worksheet.getCell(`I${productRow + 4}`).font = { name: 'Times New Roman', size: 10 };

    worksheet.getCell(`H${productRow + 5}`).value = 'Trị giá FOB loại trừ:';
    worksheet.getCell(`H${productRow + 5}`).font = { name: 'Times New Roman', size: 10 };
    worksheet.getCell(`I${productRow + 5}`).value = skuData.product?.fobExcluding ? `${skuData.product.fobExcluding} USD` : '';
    worksheet.getCell(`I${productRow + 5}`).font = { name: 'Times New Roman', size: 10 };
  }

  /**
   * Bảng nguyên liệu chính - theo format ảnh (11 cột)
   */
  addMainMaterialTable(worksheet, startRow, nplDetails) {
    let row = startRow;

    // Header
    const headers = [
      'STT',
      'Tên nguyên liệu',
      'Mã HS',
      'Đơn vị tính',
      'Định mức / sản phẩm kế toán',
      'Tổng lượng NPL sử dụng',
      'Đơn giá (CIF)',
      'Trị giá (USD)',
      'CÓ XX / KHÔNG CÓ XX',
      'Nước xuất xứ',
      'Hóa đơn / Chứng nhận'
    ];

    // Tạo header
    headers.forEach((header, index) => {
      const cell = worksheet.getCell(row, index + 1);
      cell.value = header;
      cell.font = { name: 'Times New Roman', size: 9, bold: true };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });
    worksheet.getRow(row).height = 30;
    row++;

    // Data rows
    let totalValue = 0;
    nplDetails.forEach((npl, index) => {
      const rowData = [
        index + 1,
        npl.tenNguyenLieu || '',
        npl.maHS || '',
        npl.donViTinh || '',
        npl.dinhMuc ? npl.dinhMuc.toFixed(8) : '',
        npl.tongLuongSuDung ? npl.tongLuongSuDung.toFixed(8) : '',
        npl.donGiaCIF || '',
        npl.triGia ? npl.triGia.toFixed(2) : '',
        npl.xuatXu ? 'CÓ XX' : 'KHÔNG CÓ XX',
        npl.xuatXu || '',
        npl.soHoaDon ? `${npl.soHoaDon} / ${npl.ngayHoaDon || ''}` : ''
      ];

      rowData.forEach((data, colIndex) => {
        const cell = worksheet.getCell(row, colIndex + 1);
        cell.value = data;
        cell.font = { name: 'Times New Roman', size: 9 };
        cell.alignment = {
          horizontal: [1, 9, 10].includes(colIndex) ? 'left' : 'center',
          vertical: 'middle',
          wrapText: true
        };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };

        if ([4, 5].includes(colIndex)) {
          cell.numFmt = '0.00000000';
        } else if (colIndex === 7) {
          cell.numFmt = '0.00';
        }
      });

      if (npl.triGia) totalValue += npl.triGia;
      worksheet.getRow(row).height = 18;
      row++;
    });

    // Total row
    const totalRowData = ['', 'Cộng:', '', '', '', '', '', totalValue.toFixed(2), '', '', ''];
    totalRowData.forEach((data, colIndex) => {
      const cell = worksheet.getCell(row, colIndex + 1);
      cell.value = data;
      cell.font = { name: 'Times New Roman', size: 9, bold: colIndex === 1 || colIndex === 7 };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };

      if (colIndex === 7) {
        cell.numFmt = '0.00';
      }
    });

    worksheet.getRow(row).height = 18;

    // Set column widths
    const columnWidths = [5, 25, 12, 10, 15, 15, 12, 12, 15, 15, 20];
    columnWidths.forEach((width, index) => {
      worksheet.getColumn(index + 1).width = width;
    });

    return row + 2;
  }

  /**
   * Kết luận + Footer với người đại diện và ngày lập
   */
  addConclusionCompact(worksheet, startRow, skuData) {
    let row = startRow;

    // Kết luận
    worksheet.mergeCells(`A${row}:N${row}`);
    const conclusionCell = worksheet.getCell(`A${row}`);
    conclusionCell.value = `Kết luận: Hàng hóa đạt tiêu chí CTH`;
    conclusionCell.font = { name: 'Times New Roman', size: 10, bold: true };
    conclusionCell.alignment = { horizontal: 'left', vertical: 'middle' };
    worksheet.getRow(row).height = 18;
    row += 2;

    // Footer: Ngày lập (trái) + Người đại diện (phải)
    const today = new Date();
    const day = today.getDate();
    const month = today.getMonth() + 1;
    const year = today.getFullYear();
    const dateStr = `TP. Hồ Chí Minh, ngày ${day} tháng ${month} năm ${year}`;

    // Ngày lập (cột trái A-D)
    worksheet.mergeCells(`A${row}:D${row}`);
    const dateCell = worksheet.getCell(`A${row}`);
    dateCell.value = dateStr;
    dateCell.font = { name: 'Times New Roman', size: 9 };
    dateCell.alignment = { horizontal: 'left', vertical: 'middle' };
    worksheet.getRow(row).height = 16;

    // Người đại diện (cột phải J-N)
    worksheet.mergeCells(`J${row}:N${row}`);
    const repCell = worksheet.getCell(`J${row}`);
    repCell.value = 'Người đại diện theo pháp luật thương nhân';
    repCell.font = { name: 'Times New Roman', size: 9 };
    repCell.alignment = { horizontal: 'center', vertical: 'middle' };
    row += 2;

    // Chữ ký và dấu (cột phải J-N)
    worksheet.mergeCells(`J${row}:N${row}`);
    const signCell = worksheet.getCell(`J${row}`);
    signCell.value = '(Ký, dấu dấu, ghi rõ họ tên)';
    signCell.font = { name: 'Times New Roman', size: 9, italic: true };
    signCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(row).height = 14;
  }

}

module.exports = CTHTemplate;
