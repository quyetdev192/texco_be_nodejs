const ExcelJS = require('exceljs');
const { v2: cloudinary } = require('cloudinary');
const path = require('path');
const fs = require('fs');
const CTCHeaderExtractorService = require('./HeaderExtractor.service');
const TemplateFactory = require('./templates/TemplateFactory');

const mongoose = require('mongoose');

// Import model classes
const LohangDraftClass = require('../../api/models/lohangDraft.model');
const ExtractedProductTableClass = require('../../api/models/extractedProductTable.model');
const ExtractedNplTableClass = require('../../api/models/extractedNplTable.model');
const ExtractedBomTableClass = require('../../api/models/extractedBomTable.model');
const BundleClass = require('../../api/models/bundle.model');
const CompanyClass = require('../../api/models/company.model');

// Build models
const buildModel = (modelClass) => {
  const modelName = modelClass.name;
  if (mongoose.models[modelName]) return mongoose.models[modelName];
  const schema = new mongoose.Schema(modelClass.getSchema(), { collection: modelClass.collection });
  return mongoose.model(modelName, schema);
};

const LohangDraft = buildModel(LohangDraftClass);
const ExtractedProductTable = buildModel(ExtractedProductTableClass);
const ExtractedNplTable = buildModel(ExtractedNplTableClass);
const ExtractedBomTable = buildModel(ExtractedBomTableClass);
const Bundle = buildModel(BundleClass);
const Company = buildModel(CompanyClass);

class ReportGeneratorService {
  constructor() {
    // Sử dụng Cloudinary nếu có CLOUDINARY_URL
    this.useCloudinary = !!process.env.CLOUDINARY_URL;
    
    if (this.useCloudinary) {
      // Cấu hình Cloudinary SDK với CLOUDINARY_URL
      cloudinary.config({
        cloudinary_url: process.env.CLOUDINARY_URL
      });
      console.log('☁️ Using Cloudinary SDK for Excel reports');
    } else {
      console.log('📁 Using local file storage for Excel reports');
    }
    
    // Initialize header extractor
    this.headerExtractor = new CTCHeaderExtractorService();
  }

  /**
   * Tạo Excel template đẹp với format chuẩn
   */
  createBeautifulExcelTemplate(workbook, skuData, headerInfo, criterionType, formType) {
    const worksheet = workbook.addWorksheet('Bảng kê', {
      properties: { defaultRowHeight: 25, defaultColWidth: 12 }
    });

    let currentRow = 1;

    // HEADER - Tiêu đề chính
    worksheet.mergeCells(`A${currentRow}:K${currentRow}`);
    const titleCell = worksheet.getCell(`A${currentRow}`);
    titleCell.value = `BẢNG KÊ KHAI HÀNG HÓA XUẤT KHẨU ĐẠT TIÊU CHÍ "${criterionType}"`;
    titleCell.font = { name: 'Times New Roman', size: 16, bold: true };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F3FF' } };
    worksheet.getRow(currentRow).height = 35;
    currentRow += 2;

    // Subtitle
    worksheet.mergeCells(`A${currentRow}:K${currentRow}`);
    const subtitleCell = worksheet.getCell(`A${currentRow}`);
    subtitleCell.value = '(Ban hành theo Thông tư số 05/2018/TT-BCT ngày 03/04/2018 quy định về xuất xứ hàng hóa)';
    subtitleCell.font = { name: 'Times New Roman', size: 11, italic: true };
    subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    currentRow += 2;

    // Thông tin công ty
    this.addCompanyInfo(worksheet, currentRow, headerInfo);
    currentRow += 6;

    // Thông tin sản phẩm
    currentRow = this.addProductInfo(worksheet, currentRow, skuData.product, criterionType);
    currentRow += 2;

    // Bảng nguyên liệu
    currentRow = this.addMaterialTable(worksheet, currentRow, skuData.nplDetails);
    currentRow += 2;

    // Kết luận
    this.addConclusion(worksheet, currentRow, skuData.conclusion, skuData.ctcPercentage);

    // Auto-fit columns
    worksheet.columns.forEach(column => {
      column.width = Math.max(column.width || 0, 15);
    });

    return worksheet;
  }

  /**
   * Upload Excel buffer lên Cloudinary
   */
  async uploadExcelToCloudinary(excelBuffer, fileName, options = {}) {
    try {
      const uploadOptions = {
        resource_type: 'raw',
        public_id: options.public_id || `report_${Date.now()}`,
        folder: options.folder || 'reports',
        use_filename: true,
        unique_filename: false,
        overwrite: true
      };

      const result = await cloudinary.uploader.upload(
        `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${excelBuffer.toString('base64')}`,
        uploadOptions
      );

      return result;
    } catch (error) {
      throw new Error(`Cloudinary upload failed: ${error.message}`);
    }
  }

  /**
   * Tạo bảng kê cho tất cả SKU trong lô hàng (hỗ trợ tất cả tiêu chí)
   * @param {string} lohangDraftId - ID của lô hàng
   * @returns {Promise<Object>} - Kết quả với links đến các file Excel
   */
  async generateReports(lohangDraftId) {
    try {
      console.log('🔄 Starting Report Generation for:', lohangDraftId);

      // 1. Load dữ liệu từ các bảng
      const data = await this.loadAllData(lohangDraftId);
      
      // 2. Validate tiêu chí (hỗ trợ tất cả loại)
      const supportedCriteria = ['CTC', 'CTH', 'CTSH', 'RVC40', 'RVC50', 'WO', 'PE'];
      if (!supportedCriteria.includes(data.lohangDraft.criterionType)) {
        throw new Error(`Tiêu chí ${data.lohangDraft.criterionType} chưa được hỗ trợ`);
      }

      // 3. Extract header information từ documents bằng AI
      console.log('🤖 Extracting header information from documents...');
      const headerInfo = await this.headerExtractor.extractHeaderInfo(lohangDraftId);
      data.headerInfo = headerInfo;

      // 4. Tạo bảng kê cho từng SKU
      const reports = [];
      for (const product of data.productTable.products) {
        const report = await this.generateSingleSKUReport(product, data);
        reports.push(report);
      }

      // 4. Lưu thông tin vào database
      await this.saveReportsToDatabase(lohangDraftId, reports);

      console.log('✅ Report Generation completed');
      return {
        success: true,
        totalReports: reports.length,
        reports: reports.map(r => ({
          skuCode: r.skuCode,
          productName: r.productName,
          excelUrl: r.excelUrl,
          conclusion: r.conclusion
        }))
      };

    } catch (error) {
      console.error('❌ Report Generation failed:', error);
      throw error;
    }
  }

  /**
   * Load tất cả dữ liệu cần thiết
   */
  async loadAllData(lohangDraftId) {
    const [lohangDraft, productTable, nplTable, bomTable] = await Promise.all([
      LohangDraft.findById(lohangDraftId).lean(),
      ExtractedProductTable.findOne({ lohangDraftId }).lean(),
      ExtractedNplTable.findOne({ lohangDraftId }).lean(),
      ExtractedBomTable.findOne({ lohangDraftId }).lean()
    ]);

    if (!lohangDraft || !productTable || !nplTable || !bomTable) {
      throw new Error('Thiếu dữ liệu cần thiết để tạo bảng kê CTC');
    }

    // Load thông tin công ty
    const company = await Company.findById(lohangDraft.companyId).lean();
    
    // Load bundle để lấy thông tin documents
    const bundle = await Bundle.findById(lohangDraft.bundleId).lean();

    return {
      lohangDraft,
      productTable,
      nplTable,
      bomTable,
      company,
      bundle
    };
  }

  /**
   * Tạo bảng kê cho 1 SKU
   */
  async generateSingleSKUReport(product, data) {
    const criterionType = data.lohangDraft.criterionType;
    const formType = data.lohangDraft.formType;
    
    console.log(`📊 Generating ${criterionType} report for SKU: ${product.skuCode}`);

    // 1. Kiểm tra template có được hỗ trợ không
    if (!TemplateFactory.isSupported(criterionType)) {
      throw new Error(`Template cho tiêu chí ${criterionType} chưa được triển khai`);
    }

    // 2. Tính toán dữ liệu cho SKU này
    const skuData = this.calculateSKUData(product, data);
    
    // 3. Tạo template instance
    const template = TemplateFactory.createTemplate(criterionType, formType);
    
    // 4. Tạo Excel workbook
    const workbook = await template.createWorkbook(skuData, data.headerInfo, data.lohangDraft);

    // 5. Tạo Excel buffer và upload
    const fileName = template.getFileName(product.skuCode);
    let excelUrl, publicId;
    
    if (this.useCloudinary) {
      // Tạo Excel buffer trực tiếp
      console.log('📊 Creating Excel buffer...');
      const excelBuffer = await workbook.xlsx.writeBuffer();
      
      console.log('☁️ Uploading Excel to Cloudinary...');
      const uploadResult = await this.uploadExcelToCloudinary(excelBuffer, fileName, {
        folder: 'reports',
        public_id: `${criterionType.toLowerCase()}_${product.skuCode}_${Date.now()}`
      });
      
      excelUrl = uploadResult.secure_url;
      publicId = uploadResult.public_id;
      
      console.log('✅ Cloudinary upload successful:', excelUrl);
      console.log(`📊 Excel size: ${(excelBuffer.length / 1024).toFixed(2)} KB`);
    } else {
      // Lưu local với buffer (tối ưu)
      console.log('📊 Creating Excel buffer...');
      const excelBuffer = await workbook.xlsx.writeBuffer();
      
      const reportsDir = path.join(__dirname, '../../../reports');
      if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
      }
      
      const finalPath = path.join(reportsDir, fileName);
      await fs.promises.writeFile(finalPath, excelBuffer);
      
      // Tạo relative path thay vì absolute URL với localhost
      // Frontend sẽ tự động thêm base URL khi download
      excelUrl = `/reports/${fileName}`;
      publicId = fileName;
      
      console.log(`📁 Excel file saved locally: ${finalPath}`);
      console.log(`📊 Excel size: ${(excelBuffer.length / 1024).toFixed(2)} KB`);
      console.log(`🔗 Download URL: ${excelUrl}`);
    }

    return {
      skuCode: product.skuCode,
      productName: product.productName,
      excelUrl: excelUrl, // Excel URL cho database
      publicId: publicId, 
      conclusion: skuData.conclusion,
      totalNPLValue: skuData.totalNPLValue,
      fobExcludingChina: skuData.fobExcludingChina,
      ctcPercentage: skuData.ctcPercentage
    };
  }

  /**
   * Tính toán dữ liệu cho 1 SKU
   */
  calculateSKUData(product, data) {
    const { bomTable, nplTable, lohangDraft } = data;
    const skuCode = product.skuCode;
    const quantity = product.quantity;
    const fobValueUsd = product.fobValueUsd;

    // Tìm các NPL liên quan đến SKU này từ BOM
    const nplDetails = [];
    let totalNPLValue = 0;
    let chinaOriginValue = 0;

    for (const bomMaterial of bomTable.bomData || []) {
      const normPerSku = bomMaterial.normPerSku?.[skuCode];
      if (!normPerSku || normPerSku === 0) continue;

      // Tìm NPL tương ứng trong NPL table
      const nplInfo = (nplTable.materials || []).find(m => 
        this.matchNPLName(m.tenHang, bomMaterial.nplName)
      );

      if (nplInfo) {
        const totalUsage = normPerSku * quantity;
        const nplValue = totalUsage * (nplInfo.donGiaUsd || 0);
        
        nplDetails.push({
          stt: nplDetails.length + 1,
          tenNguyenLieu: nplInfo.tenHang,
          maHS: nplInfo.hsCode || bomMaterial.hsCode || '',
          donViTinh: nplInfo.donViTinh || bomMaterial.unit || '',
          dinhMuc: normPerSku,
          tongLuongSuDung: totalUsage,
          nhuCauSuDung: totalUsage, // Giống tổng lượng sử dụng
          donGiaCIF: nplInfo.donGiaUsd || 0,
          triGia: nplValue,
          nuocXuatXu: nplInfo.xuatXu || 'MUA VN KRXX',
          soHoaDon: nplInfo.soHd || '',
          ngayHoaDon: nplInfo.ngayHd ? new Date(nplInfo.ngayHd) : null
        });

        totalNPLValue += nplValue;

        // Nếu xuất xứ từ Trung Quốc
        if (nplInfo.xuatXu && nplInfo.xuatXu.includes('CHINA')) {
          chinaOriginValue += nplValue;
        }
      }
    }

    // Tính FOB loại trừ nguyên liệu từ Trung Quốc
    const fobExcludingChina = fobValueUsd - chinaOriginValue;
    
    // Tính tỷ lệ CTC (%)
    const ctcPercentage = fobValueUsd > 0 ? (fobExcludingChina / fobValueUsd) * 100 : 0;
    
    // Kết luận đạt tiêu chí CTC hay không (≥ 40%)
    const conclusion = ctcPercentage >= 40 ? 'ĐẠT TIÊU CHÍ CTC' : 'KHÔNG ĐẠT TIÊU CHÍ CTC';

    return {
      product,
      nplDetails,
      totalNPLValue,
      chinaOriginValue,
      fobExcludingChina,
      ctcPercentage,
      conclusion,
      exchangeRate: lohangDraft.exchangeRate || 25000
    };
  }

  /**
   * Match NPL name giữa BOM và NPL table
   */
  matchNPLName(nplName, bomNplName) {
    if (!nplName || !bomNplName) return false;
    
    const nplLower = nplName.toLowerCase().trim();
    const bomLower = bomNplName.toLowerCase().trim();
    
    // Exact match
    if (nplLower === bomLower) return true;
    
    // Keyword match
    const bomKeywords = bomLower
      .replace(/\(.*?\)/g, '')
      .replace(/[\u4e00-\u9fa5]/g, '')
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2);
    
    return bomKeywords.some(keyword => nplLower.includes(keyword));
  }

  /**
   * Tạo header Excel
   */
  createExcelHeader(worksheet, skuData, data) {
    const { headerInfo, lohangDraft } = data;
    const { product } = skuData;

    // Title với tiêu chí động
    worksheet.mergeCells('A1:L1');
    const criterionDisplay = headerInfo.criterionType || lohangDraft.criterionType || 'CTC';
    worksheet.getCell('A1').value = `BẢNG KÊ KHAI HÀNG HÓA XUẤT KHẨU ĐẠT TIÊU CHÍ "${criterionDisplay}"`;
    worksheet.getCell('A1').font = { bold: true, size: 14 };
    worksheet.getCell('A1').alignment = { horizontal: 'center' };

    // Subtitle
    worksheet.mergeCells('A2:L2');
    worksheet.getCell('A2').value = '(Ban hành theo Thông tư số 05/2018/TT-BCT ngày 03/04/2018 quy định về xuất xứ hàng hóa)';
    worksheet.getCell('A2').font = { italic: true, size: 10 };
    worksheet.getCell('A2').alignment = { horizontal: 'center' };

    // Company info từ AI extraction
    let row = 4;
    worksheet.getCell(`A${row}`).value = 'Tên thương nhân:';
    worksheet.getCell(`B${row}`).value = headerInfo.companyName;
    worksheet.getCell(`H${row}`).value = 'Tiêu chí áp dụng:';
    worksheet.getCell(`I${row}`).value = criterionDisplay;

    row++;
    worksheet.getCell(`A${row}`).value = 'Mã số thuế:';
    worksheet.getCell(`B${row}`).value = headerInfo.taxCode;

    row++;
    worksheet.getCell(`A${row}`).value = 'Tờ khai hải quan XK số:';
    worksheet.getCell(`B${row}`).value = headerInfo.exportDeclarationNumber;
    worksheet.getCell(`D${row}`).value = '/B11';
    
    // Format ngày từ extracted date
    const formattedDate = headerInfo.exportDeclarationDate ? 
      this.formatDateForExcel(headerInfo.exportDeclarationDate) : 
      'ngày 12 tháng 07 năm 2025';
    worksheet.getCell(`F${row}`).value = formattedDate;

    // Product info
    row += 2;
    worksheet.getCell(`H${row}`).value = 'Tên hàng:';
    
    row++;
    // Hiển thị tên sản phẩm với SKU code
    const productDescription = `${product.productName} (${product.skuCode})`;
    worksheet.getCell(`H${row}`).value = productDescription;
    
    row++;
    worksheet.getCell(`H${row}`).value = 'Mã HS của hàng hóa:';
    worksheet.getCell(`I${row}`).value = product.hsCode || '94036090';
    
    row++;
    worksheet.getCell(`H${row}`).value = 'Số lượng:';
    worksheet.getCell(`I${row}`).value = `${product.quantity} PCE`;
    
    row++;
    worksheet.getCell(`H${row}`).value = 'Trị giá FOB:';
    worksheet.getCell(`I${row}`).value = `${product.fobValueUsd} USD`;
    
    row++;
    worksheet.getCell(`H${row}`).value = 'Trị giá FOB loại trừ NL NK từ TQ:';
    worksheet.getCell(`I${row}`).value = `${skuData.fobExcludingChina.toFixed(2)} USD`;
    
    row++;
    worksheet.getCell(`H${row}`).value = 'Tỷ giá (USD):';
    worksheet.getCell(`I${row}`).value = `${headerInfo.exchangeRate} (VND/USD)`;

    return row + 2;
  }

  /**
   * Tạo bảng chi tiết NPL
   */
  createNPLDetailTable(worksheet, skuData) {
    const startRow = 15;
    
    // Headers
    const headers = [
      'STT', 'Tên nguyên liệu', 'Mã HS', 'Đơn vị tính',
      'Định mức / sản phẩm (cả hao hụt)', 'Tổng lượng NPL sử dụng',
      'Đơn giá', 'Trị giá (USD)', 'Nước xuất xứ',
      'Tờ khai hải quan nhập khẩu / Hóa đơn mua hàng', 'Số', 'ngày'
    ];

    headers.forEach((header, index) => {
      const cell = worksheet.getCell(startRow, index + 1);
      cell.value = header;
      cell.font = { bold: true };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });

    // Data rows
    let currentRow = startRow + 1;
    skuData.nplDetails.forEach(npl => {
      worksheet.getCell(currentRow, 1).value = npl.stt;
      worksheet.getCell(currentRow, 2).value = npl.tenNguyenLieu;
      worksheet.getCell(currentRow, 3).value = npl.maHS;
      worksheet.getCell(currentRow, 4).value = npl.donViTinh;
      worksheet.getCell(currentRow, 5).value = npl.dinhMuc;
      worksheet.getCell(currentRow, 6).value = npl.tongLuongSuDung;
      worksheet.getCell(currentRow, 7).value = npl.donGiaCIF;
      worksheet.getCell(currentRow, 8).value = npl.triGia.toFixed(2);
      worksheet.getCell(currentRow, 9).value = npl.nuocXuatXu;
      worksheet.getCell(currentRow, 10).value = npl.soHoaDon;
      worksheet.getCell(currentRow, 11).value = npl.ngayHoaDon ? npl.ngayHoaDon.toLocaleDateString('vi-VN') : '';

      // Add borders
      for (let col = 1; col <= 12; col++) {
        worksheet.getCell(currentRow, col).border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      }
      
      currentRow++;
    });

    return currentRow;
  }

  /**
   * Tạo phần tổng cộng và kết luận
   */
  createSummaryAndConclusion(worksheet, skuData, headerInfo) {
    const startRow = 15 + skuData.nplDetails.length + 2;
    
    // Tổng cộng
    worksheet.getCell(startRow, 7).value = 'Cộng:';
    worksheet.getCell(startRow, 8).value = skuData.totalNPLValue.toFixed(2);
    worksheet.getCell(startRow, 7).font = { bold: true };
    worksheet.getCell(startRow, 8).font = { bold: true };

    // Kết luận
    const conclusionRow = startRow + 2;
    worksheet.mergeCells(`A${conclusionRow}:L${conclusionRow}`);
    const criterionDisplay = headerInfo.criterionType || 'CTC';
    worksheet.getCell(`A${conclusionRow}`).value = 
      `Kết luận: Hàng hóa đáp ứng quy tắc xuất xứ ưu đãi theo tiêu chí ${criterionDisplay} với tỷ lệ ${skuData.ctcPercentage.toFixed(1)}% ≥ 40%`;
    worksheet.getCell(`A${conclusionRow}`).font = { bold: true };

    // Chữ ký với ngày từ extracted info
    const signatureRow = conclusionRow + 3;
    const signatureDate = headerInfo.exportDeclarationDate ? 
      this.formatDateForExcel(headerInfo.exportDeclarationDate) : 
      'ngày 12 tháng 07 năm 2025';
    worksheet.getCell(`A${signatureRow}`).value = `TP. Hồ Chí Minh, ${signatureDate}`;
    worksheet.getCell(`A${signatureRow + 1}`).value = 'Người đại diện theo pháp luật thương nhân';
    worksheet.getCell(`A${signatureRow + 2}`).value = '(Ký, đóng dấu, ghi rõ họ, tên)';
  }

  /**
   * Format date cho Excel display
   */
  formatDateForExcel(dateString) {
    try {
      const date = new Date(dateString);
      const day = date.getDate();
      const month = date.getMonth() + 1;
      const year = date.getFullYear();
      
      return `ngày ${day} tháng ${month.toString().padStart(2, '0')} năm ${year}`;
    } catch (error) {
      console.warn('Date formatting error:', error);
      return 'ngày 12 tháng 07 năm 2025';
    }
  }

  /**
   * Lưu thông tin reports vào database
   */
  async saveReportsToDatabase(lohangDraftId, reports) {
    const reportData = reports.map(report => ({
      skuCode: report.skuCode,
      productName: report.productName,
      excelUrl: report.excelUrl,
      publicId: report.publicId,
      conclusion: report.conclusion,
      createdAt: new Date()
    }));

    await LohangDraft.findByIdAndUpdate(lohangDraftId, {
      ctcReports: reportData,
      updatedAt: new Date()
    });
  }
}

module.exports = ReportGeneratorService;
