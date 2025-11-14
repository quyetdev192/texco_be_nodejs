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
   * Bảng nguyên liệu chính - theo format ảnh (header 3 tầng)
   */
  addMainMaterialTable(worksheet, startRow, nplDetails) {
    let row = startRow;

    // Header tầng 1 - Các nhóm cột chính
    const mainHeaders = [
      { col: 1, span: 1, text: 'STT' },
      { col: 2, span: 1, text: 'Tên nguyên liệu' },
      { col: 3, span: 1, text: 'Mã HS' },
      { col: 4, span: 1, text: 'Đơn vị tính' },
      { col: 5, span: 1, text: 'Định mức / sản phẩm kế toán' },
      { col: 6, span: 3, text: 'Nhu cầu nguyên liệu sử dụng cho lô hàng' },
      { col: 9, span: 1, text: 'Nước xuất xứ' },
      { col: 10, span: 2, text: 'Tờ khai hải quan nhập khẩu / Hóa đơn giá trị gia tăng' },
      { col: 12, span: 2, text: 'C/O ưu đãi NK / Bản khai báo của nhà SX/nhà cung cấp NL trong nước' }
    ];

    // Vẽ header tầng 1
    mainHeaders.forEach((header) => {
      if (header.span > 1) {
        worksheet.mergeCells(row, header.col, row, header.col + header.span - 1);
      }
      const cell = worksheet.getCell(row, header.col);
      cell.value = header.text;
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

    // Merge "Trị giá (USD)" cho 2 cột (CÓ XX + KHÔNG CÓ XX)
    worksheet.mergeCells(row, 7, row, 8);
    
    // Header duy nhất - không lặp
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
        left: { style: 'thin' },
        bottom: { style: 'medium' },
        right: { style: 'thin' }
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
        npl.donGiaCIF || '', // Đơn giá (CIF)
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
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };

        // Format số
        if (colIndex === 4) cell.numFmt = '0.00000000'; // Định mức
        if (colIndex === 5) cell.numFmt = '0.00'; // Đơn giá
        if ([6, 7].includes(colIndex)) cell.numFmt = '0.00'; // Trị giá
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
        left: { style: 'thin' },
        bottom: { style: 'medium' },
        right: { style: 'thin' }
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

    // Ngày lập (trên trái) + Người đại diện (trên phải) - cùng hàng
    const today = new Date();
    const day = today.getDate();
    const month = today.getMonth() + 1;
    const year = today.getFullYear();
    const dateStr = `TP. Hồ Chí Minh, ngày ${day} tháng ${month} năm ${year}`;

    worksheet.mergeCells(`A${row}:D${row}`);
    const dateCell = worksheet.getCell(`A${row}`);
    dateCell.value = dateStr;
    dateCell.font = { name: 'Times New Roman', size: 9 };
    dateCell.alignment = { horizontal: 'left', vertical: 'middle' };

    worksheet.mergeCells(`J${row}:N${row}`);
    const repCell = worksheet.getCell(`J${row}`);
    repCell.value = 'Người đại diện theo pháp luật thương nhân';
    repCell.font = { name: 'Times New Roman', size: 9 };
    repCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(row).height = 16;
    row += 2;

    // Chữ ký và dấu (dưới phải)
    worksheet.mergeCells(`J${row}:N${row}`);
    const signCell = worksheet.getCell(`J${row}`);
    signCell.value = '(Ký, dấu dấu, ghi rõ họ tên)';
    signCell.font = { name: 'Times New Roman', size: 9, italic: true };
    signCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(row).height = 14;
  }

}

module.exports = CTHTemplate;
