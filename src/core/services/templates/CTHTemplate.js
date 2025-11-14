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
    worksheet.mergeCells(`A${currentRow}:M${currentRow}`);
    const titleCell = worksheet.getCell(`A${currentRow}`);
    titleCell.value = `BẢNG KÊ KHAI HÀNG HÓA XUẤT KHẨU ĐẠT TIÊU CHÍ "CTH"`;
    titleCell.font = { name: 'Times New Roman', size: 13, bold: true };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(currentRow).height = 22;
    currentRow++;

    // 2. Subtitle
    worksheet.mergeCells(`A${currentRow}:M${currentRow}`);
    const subtitleCell = worksheet.getCell(`A${currentRow}`);
    subtitleCell.value = `(Ban hành theo Thông tư số 05/2018/TT-BCT ngày 03/04/2018 quy định về xuất xứ hàng hóa)`;
    subtitleCell.font = { name: 'Times New Roman', size: 9, italic: true };
    subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(currentRow).height = 15;
    currentRow += 3;

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

    // Cột trái: Thông tin công ty (căn trái)
    worksheet.getCell(`A${row}`).value = 'Tên thương nhân:';
    worksheet.getCell(`A${row}`).font = { name: 'Times New Roman', size: 10 };
    worksheet.getCell(`A${row}`).alignment = { horizontal: 'left', vertical: 'middle' };
    worksheet.mergeCells(`B${row}:D${row}`);
    worksheet.getCell(`B${row}`).value = headerInfo.companyName || 'CÔNG TY TNHH MAI THƠ VIỆT NAM';
    worksheet.getCell(`B${row}`).font = { name: 'Times New Roman', size: 10 };
    worksheet.getCell(`B${row}`).alignment = { horizontal: 'left', vertical: 'middle' };
    row++;

    worksheet.getCell(`A${row}`).value = 'Mã số thuế:';
    worksheet.getCell(`A${row}`).font = { name: 'Times New Roman', size: 10 };
    worksheet.getCell(`A${row}`).alignment = { horizontal: 'left', vertical: 'middle' };
    worksheet.mergeCells(`B${row}:D${row}`);
    worksheet.getCell(`B${row}`).value = headerInfo.taxCode || '3702797777';
    worksheet.getCell(`B${row}`).font = { name: 'Times New Roman', size: 10 };
    worksheet.getCell(`B${row}`).alignment = { horizontal: 'left', vertical: 'middle' };
    row++;

    worksheet.getCell(`A${row}`).value = 'Tờ khai hải quan XK số:';
    worksheet.getCell(`A${row}`).font = { name: 'Times New Roman', size: 10 };
    worksheet.getCell(`A${row}`).alignment = { horizontal: 'left', vertical: 'middle' };
    worksheet.mergeCells(`B${row}:D${row}`);
    worksheet.getCell(`B${row}`).value = headerInfo.exportDeclarationNumber || '';
    worksheet.getCell(`B${row}`).font = { name: 'Times New Roman', size: 10 };
    worksheet.getCell(`B${row}`).alignment = { horizontal: 'left', vertical: 'middle' };
    row++;

    // Cột phải: Thông tin sản phẩm chi tiết
    const productRow = startRow;
    worksheet.getCell(`H${productRow}`).value = 'Tiêu chí áp dụng:';
    worksheet.getCell(`H${productRow}`).font = { name: 'Times New Roman', size: 10 };
    worksheet.getCell(`H${productRow}`).alignment = { horizontal: 'left', vertical: 'middle' };
    worksheet.mergeCells(`I${productRow}:M${productRow}`);
    worksheet.getCell(`I${productRow}`).value = 'CTH';
    worksheet.getCell(`I${productRow}`).font = { name: 'Times New Roman', size: 10, bold: true };
    worksheet.getCell(`I${productRow}`).alignment = { horizontal: 'left', vertical: 'middle' };

    worksheet.getCell(`H${productRow + 1}`).value = 'Tên hàng:';
    worksheet.getCell(`H${productRow + 1}`).font = { name: 'Times New Roman', size: 10 };
    worksheet.getCell(`H${productRow + 1}`).alignment = { horizontal: 'left', vertical: 'middle' };
    worksheet.mergeCells(`I${productRow + 1}:M${productRow + 1}`);
    worksheet.getCell(`I${productRow + 1}`).value = skuData.product?.productName || '';
    worksheet.getCell(`I${productRow + 1}`).font = { name: 'Times New Roman', size: 10 };
    worksheet.getCell(`I${productRow + 1}`).alignment = { horizontal: 'left', vertical: 'middle' };

    worksheet.getCell(`H${productRow + 2}`).value = 'Mã HS:';
    worksheet.getCell(`H${productRow + 2}`).font = { name: 'Times New Roman', size: 10 };
    worksheet.getCell(`H${productRow + 2}`).alignment = { horizontal: 'left', vertical: 'middle' };
    worksheet.mergeCells(`I${productRow + 2}:M${productRow + 2}`);
    worksheet.getCell(`I${productRow + 2}`).value = skuData.product?.hsCode || '';
    worksheet.getCell(`I${productRow + 2}`).font = { name: 'Times New Roman', size: 10 };
    worksheet.getCell(`I${productRow + 2}`).alignment = { horizontal: 'left', vertical: 'middle' };

    worksheet.getCell(`H${productRow + 3}`).value = 'Số lượng:';
    worksheet.getCell(`H${productRow + 3}`).font = { name: 'Times New Roman', size: 10 };
    worksheet.getCell(`H${productRow + 3}`).alignment = { horizontal: 'left', vertical: 'middle' };
    worksheet.mergeCells(`I${productRow + 3}:M${productRow + 3}`);
    worksheet.getCell(`I${productRow + 3}`).value = skuData.product?.quantity || '';
    worksheet.getCell(`I${productRow + 3}`).font = { name: 'Times New Roman', size: 10 };
    worksheet.getCell(`I${productRow + 3}`).alignment = { horizontal: 'left', vertical: 'middle' };

    worksheet.getCell(`H${productRow + 4}`).value = 'Trị giá FOB:';
    worksheet.getCell(`H${productRow + 4}`).font = { name: 'Times New Roman', size: 10 };
    worksheet.getCell(`H${productRow + 4}`).alignment = { horizontal: 'left', vertical: 'middle' };
    worksheet.mergeCells(`I${productRow + 4}:M${productRow + 4}`);
    worksheet.getCell(`I${productRow + 4}`).value = skuData.product?.fobValue ? `${skuData.product.fobValue} USD` : '';
    worksheet.getCell(`I${productRow + 4}`).font = { name: 'Times New Roman', size: 10 };
    worksheet.getCell(`I${productRow + 4}`).alignment = { horizontal: 'left', vertical: 'middle' };

    worksheet.getCell(`H${productRow + 5}`).value = 'Trị giá FOB loại trừ:';
    worksheet.getCell(`H${productRow + 5}`).font = { name: 'Times New Roman', size: 10 };
    worksheet.getCell(`H${productRow + 5}`).alignment = { horizontal: 'left', vertical: 'middle' };
    worksheet.mergeCells(`I${productRow + 5}:M${productRow + 5}`);
    worksheet.getCell(`I${productRow + 5}`).value = skuData.product?.fobExcluding ? `${skuData.product.fobExcluding} USD` : '';
    worksheet.getCell(`I${productRow + 5}`).font = { name: 'Times New Roman', size: 10 };
    worksheet.getCell(`I${productRow + 5}`).alignment = { horizontal: 'left', vertical: 'middle' };
  }

  /**
   * Bảng nguyên liệu chính - 1 dòng header duy nhất
   */
  addMainMaterialTable(worksheet, startRow, nplDetails) {
    let row = startRow;

    // Merge "Trị giá (USD)" cho 2 cột (CÓ XX + KHÔNG CÓ XX)
    worksheet.mergeCells(row, 7, row, 8);
    
    // Header duy nhất - KHÔNG lặp
    const headers = [
      { col: 1, text: 'STT', align: 'center' },
      { col: 2, text: 'Tên nguyên liệu', align: 'left' },
      { col: 3, text: 'Mã HS', align: 'center' },
      { col: 4, text: 'Đơn vị tính', align: 'center' },
      { col: 5, text: 'Định mức', align: 'right' },
      { col: 6, text: 'Đơn giá (CIF)', align: 'right' },
      { col: 7, text: 'Trị giá (USD)', align: 'center' },
      { col: 9, text: 'Nước xuất xứ', align: 'left' },
      { col: 10, text: 'Số', align: 'center' },
      { col: 11, text: 'Ngày', align: 'center' },
      { col: 12, text: 'Số', align: 'center' },
      { col: 13, text: 'Ngày', align: 'center' }
    ];

    headers.forEach((header) => {
      const cell = worksheet.getCell(row, header.col);
      cell.value = header.text;
      cell.font = { name: 'Times New Roman', size: 9, bold: true };
      cell.alignment = { horizontal: header.align, vertical: 'middle', wrapText: true };
      cell.border = {
        top: { style: 'medium' },
        left: { style: 'thin' },
        bottom: { style: 'medium' },
        right: { style: 'thin' }
      };
    });
    worksheet.getRow(row).height = 25;
    row++;

    // Sub-header: CÓ XX / KHÔNG CÓ XX (chỉ dưới cột 7-8)
    const subHeaders = [
      '', '', '', '', '', '', 'CÓ XX', 'KHÔNG CÓ XX', '', '', '', '', ''
    ];

    subHeaders.forEach((header, index) => {
      const cell = worksheet.getCell(row, index + 1);
      if (header) {
        cell.value = header;
        cell.font = { name: 'Times New Roman', size: 9, bold: true };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'medium' },
        bottom: { style: 'medium' },
        right: { style: 'medium' }
      };
    });
    worksheet.getRow(row).height = 20;
    row++;

    // Data rows - 13 cột (Trị giá chia CÓ XX / KHÔNG CÓ XX)
    let totalValueCoXX = 0;
    let totalValueKhongCoXX = 0;
    nplDetails.forEach((npl, index) => {
      const coXXValue = npl.xuatXu && npl.triGia ? npl.triGia : 0;
      const khongCoXXValue = !npl.xuatXu && npl.triGia ? npl.triGia : 0;
      
      const rowData = [
        index + 1, // STT
        npl.tenNguyenLieu || '', // Tên nguyên liệu
        npl.maHS || '', // Mã HS
        npl.donViTinh || '', // Đơn vị tính
        npl.dinhMuc ? npl.dinhMuc.toFixed(8) : '', // Định mức
        npl.donGiaCIF ? parseFloat(npl.donGiaCIF).toFixed(8) : '', // Đơn giá (CIF) - 8 chữ số
        coXXValue ? coXXValue.toFixed(2) : '', // Trị giá CÓ XX
        khongCoXXValue ? khongCoXXValue.toFixed(2) : '', // Trị giá KHÔNG CÓ XX
        npl.xuatXu || '', // Nước xuất xứ
        npl.soHoaDon || '', // Số tờ khai/hóa đơn
        npl.ngayHoaDon ? new Date(npl.ngayHoaDon).toLocaleDateString('vi-VN') : '', // Ngày
        npl.soChungNhan || '', // Số C/O
        npl.ngayChungNhan ? new Date(npl.ngayChungNhan).toLocaleDateString('vi-VN') : '' // Ngày C/O
      ];
      
      totalValueCoXX += coXXValue;
      totalValueKhongCoXX += khongCoXXValue;

      rowData.forEach((data, colIndex) => {
        const cell = worksheet.getCell(row, colIndex + 1);
        cell.value = data;
        cell.font = { name: 'Times New Roman', size: 9 };
        
        // Căn lề đúng theo cột
        let alignment = 'center';
        if (colIndex === 1) alignment = 'left'; // Tên nguyên liệu
        if (colIndex === 8) alignment = 'left'; // Nước xuất xứ
        if ([4, 5, 6].includes(colIndex)) alignment = 'right'; // Định mức, Đơn giá, Trị giá
        
        cell.alignment = {
          horizontal: alignment,
          vertical: 'middle',
          wrapText: true
        };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'medium' },
          bottom: { style: 'thin' },
          right: { style: 'medium' }
        };

        // Format số
        if (colIndex === 4) cell.numFmt = '0.00000000'; // Định mức - 8 chữ số
        if (colIndex === 5) cell.numFmt = '0.00000000'; // Đơn giá (CIF) - 8 chữ số
        if ([6, 7].includes(colIndex)) cell.numFmt = '0.00'; // Trị giá - 2 chữ số
      });

      worksheet.getRow(row).height = 18;
      row++;
    });

    // Total row - 13 cột (tính tổng riêng CÓ XX và KHÔNG CÓ XX)
    const totalRowData = ['', 'Cộng:', '', '', '', '', totalValueCoXX.toFixed(2), totalValueKhongCoXX.toFixed(2), '', '', '', '', ''];
    totalRowData.forEach((data, colIndex) => {
      const cell = worksheet.getCell(row, colIndex + 1);
      cell.value = data;
      cell.font = { name: 'Times New Roman', size: 9, bold: true };
      
      let alignment = 'center';
      if (colIndex === 1) alignment = 'left'; // Cộng
      if ([6, 7].includes(colIndex)) alignment = 'right'; // Trị giá
      
      cell.alignment = { horizontal: alignment, vertical: 'middle' };
      cell.border = {
        top: { style: 'medium' },
        left: { style: 'medium' },
        bottom: { style: 'medium' },
        right: { style: 'medium' }
      };

      if ([6, 7].includes(colIndex)) {
        cell.numFmt = '0.00';
      }
    });

    worksheet.getRow(row).height = 18;

    // Set column widths - 13 cột (match template)
    const columnWidths = [4, 22, 10, 10, 12, 12, 11, 11, 14, 8, 10, 8, 10];
    columnWidths.forEach((width, index) => {
      worksheet.getColumn(index + 1).width = width;
    });

    return row + 2;
  }

  /**
   * Kết luận + Footer - ngày lập trên trái, người đại diện trên phải, chữ ký dưới
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

    // Ngày lập (trên trái) - căn trái đúng vị trí
    const today = new Date();
    const day = today.getDate();
    const month = today.getMonth() + 1;
    const year = today.getFullYear();
    const dateStr = `TP. Hồ Chí Minh, ngày ${day} tháng ${month} năm ${year}`;

    worksheet.mergeCells(`A${row}:C${row}`);
    const dateCell = worksheet.getCell(`A${row}`);
    dateCell.value = dateStr;
    dateCell.font = { name: 'Times New Roman', size: 9 };
    dateCell.alignment = { horizontal: 'left', vertical: 'middle' };

    // Người đại diện (trên phải)
    worksheet.mergeCells(`J${row}:M${row}`);
    const repCell = worksheet.getCell(`J${row}`);
    repCell.value = 'Người đại diện theo pháp luật thương nhân';
    repCell.font = { name: 'Times New Roman', size: 9 };
    repCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(row).height = 16;
    row += 2;

    // Chữ ký và dấu (dưới phải)
    worksheet.mergeCells(`J${row}:M${row}`);
    const signCell = worksheet.getCell(`J${row}`);
    signCell.value = '(Ký, dấu dấu, ghi rõ họ tên)';
    signCell.font = { name: 'Times New Roman', size: 9, italic: true };
    signCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(row).height = 14;
  }

}

module.exports = CTHTemplate;
