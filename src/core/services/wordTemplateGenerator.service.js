const { Document, Packer, Paragraph, Table, TableRow, TableCell, WidthType, AlignmentType, TextRun, HeadingLevel, BorderStyle } = require('docx');
const fs = require('fs');
const path = require('path');

class WordTemplateGeneratorService {
  /**
   * Tạo bảng kê CTC dạng Word document
   */
  async generateCTCWordDocument(skuData, headerInfo) {
    const { product, nplDetails, conclusion, totalNPLValue, fobExcludingChina, ctcPercentage } = skuData;
    
    // Tạo document
    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          // Header - Tiêu đề chính
          new Paragraph({
            children: [
              new TextRun({
                text: 'BẢNG KÊ KHAI HÀNG HÓA XUẤT KHẨU ĐẠT TIÊU CHÍ "CTC"',
                bold: true,
                size: 28,
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
          }),
          
          // Subtitle
          new Paragraph({
            children: [
              new TextRun({
                text: '(Ban hành theo Thông tư số 05/2018/TT-BCT ngày 03/04/2018 quy định về xuất xứ hàng hóa)',
                size: 20,
                italics: true,
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
          }),

          // Thông tin công ty và tờ khai
          ...this.createCompanyInfoSection(headerInfo),
          
          // Thông tin sản phẩm
          ...this.createProductInfoSection(product),
          
          // Bảng nguyên liệu chính
          this.createNPLTable(nplDetails),
          
          // Kết luận
          ...this.createConclusionSection(conclusion, ctcPercentage),
          
          // Chữ ký
          ...this.createSignatureSection(headerInfo),
        ],
      }],
    });

    return doc;
  }

  /**
   * Tạo section thông tin công ty
   */
  createCompanyInfoSection(headerInfo) {
    const formatDate = (dateStr) => {
      if (!dateStr) return 'ngày 12 tháng 07 năm 2025';
      const date = new Date(dateStr);
      const day = date.getDate();
      const month = date.getMonth() + 1;
      const year = date.getFullYear();
      return `ngày ${day} tháng ${month.toString().padStart(2, '0')} năm ${year}`;
    };

    return [
      new Paragraph({
        children: [
          new TextRun({ text: 'Tên thương nhân: ', bold: true }),
          new TextRun({ text: headerInfo.companyName || 'CÔNG TY TNHH MAI THƠ VIỆT NAM' }),
        ],
        spacing: { after: 100 },
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'Mã số thuế: ', bold: true }),
          new TextRun({ text: headerInfo.taxCode || '3702797777' }),
        ],
        spacing: { after: 100 },
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'Tờ khai hải quan XK số: ', bold: true }),
          new TextRun({ text: `${headerInfo.exportDeclarationNumber || '307569904740/B11'} ${formatDate(headerInfo.exportDeclarationDate)}` }),
        ],
        spacing: { after: 200 },
      }),
    ];
  }

  /**
   * Tạo section thông tin sản phẩm
   */
  createProductInfoSection(product) {
    return [
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: 'Tiêu chí áp dụng:', bold: true })] })],
                width: { size: 30, type: WidthType.PERCENTAGE },
              }),
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: 'CTH' })] })],
                width: { size: 20, type: WidthType.PERCENTAGE },
              }),
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: 'Tên hàng:', bold: true })] })],
                width: { size: 20, type: WidthType.PERCENTAGE },
              }),
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: product.productName || '' })] })],
                width: { size: 30, type: WidthType.PERCENTAGE },
              }),
            ],
          }),
          new TableRow({
            children: [
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: 'Mã HS của hàng hóa:', bold: true })] })],
              }),
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: product.hsCode || '940360' })] })],
              }),
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: 'Số lượng:', bold: true })] })],
              }),
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: `${product.quantity || 0} PCE` })] })],
              }),
            ],
          }),
          new TableRow({
            children: [
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: 'Trị giá FOB:', bold: true })] })],
              }),
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: `${product.fobValueUsd || 0} USD` })] })],
              }),
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: 'Trị giá FOB loại trừ NL NK từ TQ:', bold: true })] })],
              }),
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: `${product.fobValueUsd || 0} USD` })] })],
              }),
            ],
          }),
          new TableRow({
            children: [
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: 'Tỷ giá (USD):', bold: true })] })],
              }),
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: '26,005 (VND/USD)' })] })],
                columnSpan: 3,
              }),
            ],
          }),
        ],
        borders: {
          top: { style: BorderStyle.SINGLE, size: 1 },
          bottom: { style: BorderStyle.SINGLE, size: 1 },
          left: { style: BorderStyle.SINGLE, size: 1 },
          right: { style: BorderStyle.SINGLE, size: 1 },
          insideHorizontal: { style: BorderStyle.SINGLE, size: 1 },
          insideVertical: { style: BorderStyle.SINGLE, size: 1 },
        },
      }),
      new Paragraph({ text: '', spacing: { after: 300 } }),
    ];
  }

  /**
   * Tạo bảng nguyên liệu chính
   */
  createNPLTable(nplDetails) {
    // Header row
    const headerRow = new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'STT', bold: true })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Tên nguyên liệu', bold: true })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Mã HS', bold: true })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Đơn vị tính', bold: true })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Định mức/ sản phẩm kế toán', bold: true })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Tổng lượng NPL sử dụng', bold: true })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Đơn giá (CIF)', bold: true })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Trị giá (USD)', bold: true })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Nước xuất xứ', bold: true })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Tờ khai hải quan nhập khẩu / Hóa đơn giá trị gia tăng', bold: true })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'C/O tư nhân NK / Bản sao chứng nhận SX nhà cung cấp NL trong nước', bold: true })] })] }),
      ],
    });

    // Data rows
    const dataRows = nplDetails.map((npl, index) => {
      return new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: (index + 1).toString() })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: npl.tenNguyenLieu || '' })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: npl.maHS || '' })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: npl.donViTinh || '' })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: npl.dinhMuc?.toString() || '0' })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: npl.tongLuongSuDung?.toString() || '0' })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: npl.donGiaCIF?.toString() || '0' })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: npl.triGia?.toFixed(2) || '0.00' })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: npl.nuocXuatXu || 'MUA VN KRXX' })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: npl.soHoaDon || '' })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: npl.ngayHoaDon ? new Date(npl.ngayHoaDon).toLocaleDateString('vi-VN') : '' })] })] }),
        ],
      });
    });

    // Total row
    const totalValue = nplDetails.reduce((sum, npl) => sum + (npl.triGia || 0), 0);
    const totalRow = new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '', bold: true })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Cộng:', bold: true })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '', bold: true })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '', bold: true })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '', bold: true })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '', bold: true })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '', bold: true })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: totalValue.toFixed(2), bold: true })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '', bold: true })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '', bold: true })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '', bold: true })] })] }),
      ],
    });

    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [headerRow, ...dataRows, totalRow],
      borders: {
        top: { style: BorderStyle.SINGLE, size: 1 },
        bottom: { style: BorderStyle.SINGLE, size: 1 },
        left: { style: BorderStyle.SINGLE, size: 1 },
        right: { style: BorderStyle.SINGLE, size: 1 },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 1 },
        insideVertical: { style: BorderStyle.SINGLE, size: 1 },
      },
    });
  }

  /**
   * Tạo section kết luận
   */
  createConclusionSection(conclusion, ctcPercentage) {
    return [
      new Paragraph({ text: '', spacing: { after: 300 } }),
      new Paragraph({
        children: [
          new TextRun({ text: 'Kết luận: ', bold: true }),
          new TextRun({ text: `Hàng hóa đáp ứng tiêu chí ${conclusion}` }),
        ],
        spacing: { after: 100 },
      }),
      new Paragraph({
        children: [
          new TextRun({ 
            text: 'Công ty cam kết số liệu khai trên là đúng và xin chịu trách nhiệm pháp lý về tính tin cậy số liệu đã khai',
            italics: true 
          }),
        ],
        spacing: { after: 300 },
      }),
    ];
  }

  /**
   * Tạo section chữ ký
   */
  createSignatureSection(headerInfo) {
    const formatDate = (dateStr) => {
      if (!dateStr) return 'ngày 12 tháng 07 năm 2025';
      const date = new Date(dateStr);
      const day = date.getDate();
      const month = date.getMonth() + 1;
      const year = date.getFullYear();
      return `ngày ${day} tháng ${month.toString().padStart(2, '0')} năm ${year}`;
    };

    return [
      new Paragraph({
        children: [
          new TextRun({ text: `TP. Hồ Chí Minh, ${formatDate(headerInfo.exportDeclarationDate)}` }),
        ],
        alignment: AlignmentType.RIGHT,
        spacing: { after: 100 },
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'Người đại diện theo pháp luật thương nhân', bold: true }),
        ],
        alignment: AlignmentType.RIGHT,
        spacing: { after: 100 },
      }),
      new Paragraph({
        children: [
          new TextRun({ text: '(Ký, đóng dấu, ghi rõ họ, tên)', italics: true }),
        ],
        alignment: AlignmentType.RIGHT,
        spacing: { after: 300 },
      }),
    ];
  }

  /**
   * Lưu Word document thành buffer
   */
  async generateWordBuffer(doc) {
    return await Packer.toBuffer(doc);
  }

  /**
   * Lưu Word document thành file
   */
  async saveWordDocument(doc, filePath) {
    const buffer = await this.generateWordBuffer(doc);
    await fs.promises.writeFile(filePath, buffer);
    return buffer;
  }
}

module.exports = WordTemplateGeneratorService;
