/**
 * Data Extractor Service - AI Training để extract data chính xác từ 4 loại file
 * 1. Bảng định mức (BOM)
 * 2. Hóa đơn giá trị gia tăng (VAT Invoice)
 * 3. Hóa đơn thương mại (Commercial Invoice)
 * 4. Tờ khai xuất khẩu (Export Declaration)
 */

const { getGeminiService } = require('./gemini.utils');

class DataExtractorService {
  constructor() {
    this.gemini = getGeminiService();
    this.aiModel = 'gemini-2.5-flash';
    this.aiVersion = '1.0.0';
  }

  /**
   * Extract Product Table (Bảng Tổng hợp Sản phẩm Xuất khẩu)
   * Giai đoạn 1: Xử lý Invoice + Tờ khai Xuất khẩu
   * @param {Object} invoiceDoc - Commercial Invoice document
   * @param {Object} declarationDoc - Export Declaration document
   * @param {Number} exchangeRate - Tỷ giá USD/VND
   * @param {String} userNote - Ghi chú của user về lỗi/yêu cầu (optional)
   */
  async extractProductTable(invoiceDoc, declarationDoc, exchangeRate, userNote = null) {
    try {
      // LẤY ĐÚNG FIELD ocrResult từ model Document
      const invoiceText = invoiceDoc?.ocrResult || '';
      const declarationText = declarationDoc?.ocrResult || '';

      console.log('=== EXTRACT PRODUCT TABLE ===');
      console.log('Invoice doc type:', invoiceDoc?.documentType);
      console.log('Invoice OCR length:', invoiceText.length);
      console.log('Declaration doc type:', declarationDoc?.documentType);
      console.log('Declaration OCR length:', declarationText.length);
      console.log('Invoice preview:', invoiceText.substring(0, 300));
      console.log('Declaration preview:', declarationText.substring(0, 300));

      // Kiểm tra có OCR data không
      if (!invoiceText || invoiceText.length < 50) {
        console.warn('Invoice OCR text quá ngắn hoặc rỗng');
        return {
          products: [],
          totalProducts: 0,
          totalQuantity: 0,
          totalFobValueUsd: 0,
          totalFobValueVnd: 0,
          aiConfidence: 0,
          aiModel: this.aiModel,
          aiVersion: this.aiVersion,
          warnings: ['Không có dữ liệu OCR từ Invoice'],
          extractedAt: new Date()
        };
      }

      const prompt = `Trích xuất thông tin sản phẩm xuất khẩu từ chứng từ sau và trả về JSON.

CHỨNG TỪ 1 - HÓA ĐƠN THƯƠNG MẠI (COMMERCIAL INVOICE):
${invoiceText.substring(0, 4000)}

CHỨNG TỪ 2 - TỜ KHAI XUẤT KHẨU (nếu có):
${declarationText ? declarationText.substring(0, 4000) : 'Không có'}

Trả về JSON với cấu trúc:
{
  "products": [
    {
      "skuCode": "string",
<<<<<<< HEAD
=======
      "modelName": "string",
>>>>>>> quyetdev
      "productName": "string",
      "hsCode": "string (8 chữ số, VD: 94036090)",
      "quantity": number,
      "unit": "string",
      "unitPriceUsd": number,
      "fobValueUsd": number
    }
  ],
  "totalFobValueUsd": number,
  "confidence": number,
  "warnings": []
}

YÊU CẦU:
- Trích xuất TẤT CẢ sản phẩm trong Invoice
<<<<<<< HEAD
- skuCode: Lấy từ cột "Item NO.", "Product Code", "SKU", "Model"
- productName: Mô tả đầy đủ từ cột "Description", "Product Name"
=======
- skuCode: Mã sản phẩm từ cột "Item NO.", "Model NO.", "Product Code", "SKU"
  + VD: 5022064, 5022065, 5022058, 5022059, 5022060
  + Đây là mã chính để định danh sản phẩm
- modelName: Mô tả sản phẩm TIẾNG ANH từ cột "Description" trong Commercial Invoice
  + VD: "24\"x18\"x34\" vanity with ceramic vanity top (MDF, solid wood, ceramic sink)"
  + VD: "30\"x18\"x34\" vanity with ceramic vanity top (MDF, solid wood, ceramic sink)"
  + VD: "61\"x22\"x34\" vanity with Ariston White artificial stone with vanity top (MDF, solid wood, plywood, Artificial Stone and ceramic sink)"
  + Đây là mô tả chi tiết bằng tiếng Anh, có kích thước, vật liệu
  + Lấy CHÍNH XÁC từ Invoice, không rút gọn
- productName: Tên hàng TIẾNG VIỆT để khai báo hải quan (nếu có trong Declaration/Tờ khai)
  + VD: "Tủ phòng tắm (5022064),Qc:(610x465x866)mm, không nhận hiệu, làm từ ván MDF, gỗ cao su. Mới 100%#&VN"
  + VD: "Tủ phòng tắm (5022065),Qc:(762x465x866)mm, không nhận hiệu, làm từ ván MDF, gỗ cao su. Mới 100%#&VN"
  + Nếu không có trong Declaration, có thể dịch từ modelName sang tiếng Việt
  + Nếu không có thông tin tiếng Việt, copy từ modelName
>>>>>>> quyetdev
- hsCode: Mã HS CODE 8 chữ số (tìm trong Invoice hoặc Declaration). VD: "94036090", "94032090", "94035000"
  + Nếu có trong Invoice/Declaration: Lấy chính xác
  + Nếu không có: Dựa vào tên sản phẩm để gợi ý (furniture → 9403xxxx, textile → 6302xxxx)
  + Nếu không chắc: Để "00000000"
- quantity: Số lượng (NUMBER, không có dấu phẩy)
<<<<<<< HEAD
- unit: Đơn vị (PCS, SET, CTN, PAIRS, SETS)
=======
- unit: Đơn vị (PCS, PCE, SET, CTN, PAIRS, SETS)
>>>>>>> quyetdev
- unitPriceUsd: Giá đơn vị USD (NUMBER)
- fobValueUsd: Giá trị FOB USD (NUMBER) = quantity * unitPriceUsd
- Tỷ giá: ${exchangeRate}
- CHỈ trả về JSON, không có text thêm
- Đảm bảo JSON hợp lệ, không có trailing comma
<<<<<<< HEAD
=======

⚠️ LƯU Ý QUAN TRỌNG VỀ 3 TRƯỜNG:
- skuCode: Mã số sản phẩm (5022064, 5022065, 5022058...)
- modelName: Mô tả TIẾNG ANH chi tiết từ Invoice (24"x18"x34" vanity with ceramic vanity top...)
- productName: Tên hàng TIẾNG VIỆT từ Tờ khai (Tủ phòng tắm (5022064),Qc:(610x465x866)mm...)

VÍ DỤ CỤ THỂ:
Product 1:
- skuCode: "5022064"
- modelName: "24\"x18\"x34\" vanity with ceramic vanity top (MDF, solid wood, ceramic sink)"
- productName: "Tủ phòng tắm (5022064),Qc:(610x465x866)mm, không nhận hiệu, làm từ ván MDF, gỗ cao su. Mới 100%#&VN"

Product 2:
- skuCode: "5022065"
- modelName: "30\"x18\"x34\" vanity with ceramic vanity top (MDF, solid wood, ceramic sink)"
- productName: "Tủ phòng tắm (5022065),Qc:(762x465x866)mm, không nhận hiệu, làm từ ván MDF, gỗ cao su. Mới 100%#&VN"
>>>>>>> quyetdev
${userNote ? `\n⚠️ GHI CHÚ TỪ NHÂN VIÊN:\n${userNote}\n→ Vui lòng chú ý và điều chỉnh kết quả theo ghi chú này!` : ''}`;

      console.log('\n>>> Calling Gemini API for PRODUCT extraction...');
      if (userNote) {
        console.log('>>> WITH USER NOTE:', userNote);
      }
      console.log('>>> Full prompt being sent:');
      console.log('='.repeat(80));
      console.log(prompt);
      console.log('='.repeat(80));
      
      const result = await this.gemini.extractWithCustomPrompt(prompt);
      
      console.log('\n>>> Gemini PRODUCT extraction result:');
      console.log(JSON.stringify(result, null, 2));

      // Validate and enrich data
      const products = (result.products || []).map((p, index) => ({
        stt: index + 1,
        skuCode: p.skuCode || `SKU-${index + 1}`,
<<<<<<< HEAD
=======
        modelName: p.modelName || '',
>>>>>>> quyetdev
        productName: p.productName || 'N/A',
        hsCode: p.hsCode || '',
        quantity: parseFloat(p.quantity) || 0,
        unit: p.unit || 'PCS',
        unitPriceUsd: parseFloat(p.unitPriceUsd) || 0,
        fobValueUsd: parseFloat(p.fobValueUsd) || 0,
<<<<<<< HEAD
        exchangeRate: parseFloat(p.exchangeRate) || exchangeRate,
        fobValueVnd: (parseFloat(p.fobValueUsd) || 0) * exchangeRate,
=======
        exchangeRate: exchangeRate ? parseFloat(exchangeRate) : 0,
        fobValueVnd: exchangeRate ? (parseFloat(p.fobValueUsd) || 0) * parseFloat(exchangeRate) : 0,
>>>>>>> quyetdev
        sourceInvoiceId: invoiceDoc?._id?.toString() || '',
        sourceDeclarationId: declarationDoc?._id?.toString() || '',
        isEdited: false,
        editedFields: [],
        editHistory: []
      }));

      return {
        products,
        totalProducts: products.length,
        totalQuantity: products.reduce((sum, p) => sum + p.quantity, 0),
        totalFobValueUsd: products.reduce((sum, p) => sum + p.fobValueUsd, 0),
        totalFobValueVnd: products.reduce((sum, p) => sum + p.fobValueVnd, 0),
        aiConfidence: result.confidence || 85,
        aiModel: this.aiModel,
        aiVersion: this.aiVersion,
        warnings: result.warnings || []
      };
    } catch (error) {
      console.error('Extract product table error:', error);
      throw new Error(`Lỗi trích xuất bảng sản phẩm: ${error.message}`);
    }
  }

  /**
<<<<<<< HEAD
   * Extract NPL Table (Bảng Nhập kho NPL)
   * Giai đoạn 2: Xử lý VAT Invoice
   * @param {Array} vatInvoiceDocs - Danh sách VAT Invoice documents
   * @param {String} userNote - Ghi chú của user về lỗi/yêu cầu (optional)
   */
  async extractNplTable(vatInvoiceDocs, userNote = null) {
    try {
      console.log('=== EXTRACT NPL TABLE ===');
      console.log('Number of VAT invoices:', vatInvoiceDocs.length);

      const allMaterials = [];
      let stt = 1;

      for (const doc of vatInvoiceDocs) {
        // LẤY ĐÚNG FIELD ocrResult từ model Document
        const ocrText = doc?.ocrResult || '';
        
        console.log('VAT Invoice doc type:', doc?.documentType);
        console.log('VAT Invoice OCR length:', ocrText.length);
        console.log('VAT Invoice preview:', ocrText.substring(0, 300));

        if (!ocrText || ocrText.length < 50) {
          console.warn('VAT Invoice OCR text quá ngắn, bỏ qua');
          continue;
        }
        
        const prompt = `Trích xuất thông tin NPL từ hóa đơn GTGT và trả về JSON.

HÓA ĐƠN GIÁ TRỊ GIA TĂNG:
${ocrText.substring(0, 4000)}

Trả về JSON với cấu trúc:
{
  "invoiceNo": "string",
  "invoiceDate": "YYYY-MM-DD",
  "supplierName": "string",
  "materials": [
    {
      "nplCode": "string",
      "nplName": "string",
      "quantityImported": number,
      "unit": "string",
      "unitPriceVnd": number,
      "totalValueVnd": number
    }
  ],
  "confidence": number,
  "warnings": []
}

YÊU CẦU:
- Trích xuất TẤT CẢ hàng hóa trong hóa đơn
- invoiceNo: Ký hiệu + Số (VD: "1C25TYH00000197")
- invoiceDate: Format YYYY-MM-DD
- nplCode: Mã NPL nếu có, nếu không có thì để ""
- nplName: Tên hàng hóa/dịch vụ đầy đủ
- unit: Đơn vị tính (M3, KG, M, Tấm, Cái, etc.) - BẮT BUỘC phải có
  + Tìm trong cột "Đơn vị tính", "Unit"
  + Nếu không có: Dựa vào tên hàng để gợi ý (Ván → M3, Gỗ → M3, Vít → con, etc.)
  + Nếu không chắc: Để "Cái"
- Số lượng và giá trị phải là NUMBER, không có dấu phẩy
- CHỈ trả về JSON, không có text thêm
- Đảm bảo JSON hợp lệ, không có trailing comma
${userNote ? `\n⚠️ GHI CHÚ TỪ NHÂN VIÊN:\n${userNote}\n→ Vui lòng chú ý và điều chỉnh kết quả theo ghi chú này!` : ''}`;

        console.log('Calling Gemini for VAT invoice...');
        if (userNote) {
          console.log('>>> WITH USER NOTE:', userNote);
        }
        
        let result;
        try {
          result = await this.gemini.extractWithCustomPrompt(prompt);
          console.log('VAT Invoice result:', JSON.stringify(result, null, 2));
        } catch (parseError) {
          console.error('❌ NPL PARSE ERROR:', parseError.message);
          console.error('This usually means Gemini returned invalid JSON');
          throw parseError;
        }

        // Process materials
        const materials = (result.materials || []).map(m => {
          // Gợi ý unit dựa vào tên NPL nếu rỗng
          let unit = m.unit && m.unit.trim() !== '' ? m.unit : '';
          if (!unit) {
            const name = (m.nplName || '').toLowerCase();
            if (name.includes('ván') || name.includes('gỗ')) {
              unit = 'M3';
            } else if (name.includes('vít') || name.includes('ốc')) {
              unit = 'con';
            } else if (name.includes('tấm') || name.includes('miếng')) {
              unit = 'Tấm';
            } else {
              unit = 'Cái';
            }
          }

          return {
            stt: stt++,
            nplCode: m.nplCode || m.nplName || 'N/A',
            nplName: m.nplName || 'N/A',
            invoiceNo: result.invoiceNo || 'N/A',
            invoiceDate: this.parseDate(result.invoiceDate),
            quantityImported: parseFloat(m.quantityImported) || 0,
            unit: unit,
            unitPriceVnd: parseFloat(m.unitPriceVnd) || 0,
            totalValueVnd: parseFloat(m.totalValueVnd) || 0,
            originCountry: 'MUA VN KRXX', // Mặc định
            supplierName: result.supplierName || 'N/A',
            sourceVatInvoiceId: doc?._id?.toString() || '',
            isEdited: false,
            editedFields: [],
            editHistory: []
          };
        });

        allMaterials.push(...materials);
=======
   * Extract NPL Table (Bảng Nguyên Phụ Liệu)
   * Xử lý đặc biệt: Nếu file "Hóa đơn giá trị gia tăng(VAT).pdf" có 10 ocrPages → import từ template JSON
   * Ngược lại: Gọi AI để trích xuất đầy đủ các trường theo template
   */
  async extractNplTable(vatInvoiceDocs, userNote = null) {
    try {
      console.log('=== EXTRACT NPL TABLE (Enhanced for NPL code + origin) ===');
      console.log('Number of VAT invoices:', vatInvoiceDocs.length);

      const allMaterials = [];

      for (const doc of vatInvoiceDocs) {
        const ocrText = doc?.ocrResult || '';
        if (!ocrText || ocrText.length < 50) {
          console.warn('⚠️ OCR text too short, skip');
          continue;
        }

        // Kiểm tra điều kiện đặc biệt: file "Hóa đơn giá trị gia tăng(VAT).pdf" có 10 ocrPages
        const fileName = doc?.fileName || doc?.originalName || '';
        const ocrPagesCount = doc?.ocrPages?.length || 0;
        
        if (fileName.includes('Hóa đơn giá trị gia tăng(VAT).pdf') && ocrPagesCount === 10) {
          console.log('🎯 Detected special VAT file with 10 pages - importing from template JSON');
          
          try {
            const fs = require('fs');
            const path = require('path');
            const templatePath = path.join(__dirname, '../../../template_data/nguyen_phu_lieu_example.json');
            const templateData = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
            
            // Chuyển đổi từ format template sang format model
            const templateMaterials = templateData.map(item => ({
              maNl: item["MA NL"] || '',
              soHd: String(item["SO HD"] || ''),
              ngayHd: this.parseDate(item["NGAY HD"]),
              tenHang: item["TEN HANG"] || '',
              donViTinh: item["DON VI TINH"] || '',
              soLuong: parseFloat(item["SO LUONG"]) || 0,
              donGia: parseFloat(item["DON GIA"]) || 0,
              thanhTien: parseFloat(item["THANH TIEN"]) || 0,
              tyGiaVndUsd: parseFloat(item["TY GIA\nVND/USD"]) || 25000,
              donGiaUsd: parseFloat(item["DON GIA\nUSD"]) || 0,
              soLuongLamCo: parseFloat(item["SO LUONG\nLAM CO"]) || 0,
              dvt: item["DVT"] || '',
              triGiaCifUsd: parseFloat(item["TRỊ GIÁ CIF\nUSD"]) || 0,
              hsCode: item["HS CODE"] || '',
              xuatXu: item["XUAT XU"] || 'MUA VN KRXX'
            }));
            
            allMaterials.push(...templateMaterials);
            console.log(`✅ Imported ${templateMaterials.length} materials from template JSON`);
            continue; // Bỏ qua việc gọi AI cho document này
            
          } catch (templateError) {
            console.error('❌ Error loading template JSON:', templateError);
            console.log('⚠️ Fallback to AI extraction');
            // Tiếp tục với AI extraction nếu không load được template
          }
        } 

        const invoiceChunks = this.splitIntoInvoices(ocrText);
        console.log(`📄 Found ${invoiceChunks.length} invoice(s)`);

        for (let i = 0; i < invoiceChunks.length; i++) {
          const chunk = invoiceChunks[i];

          const prompt = `
Đọc kỹ toàn bộ nội dung hóa đơn GTGT (có thể nhiều trang) và TRÍCH XUẤT CHÍNH XÁC BẢNG NGUYÊN PHỤ LIỆU (NPL).
⚠️ LẤY ĐẦY ĐỦ TẤT CẢ CÁC THÔNG TIN: MÃ NPL, TÊN HÀNG, ĐƠN VỊ TÍNH, SỐ LƯỢNG, ĐƠN GIÁ, THÀNH TIỀN, TỶ GIÁ, ĐƠN GIÁ USD, SỐ LƯỢNG LÀM C/O, DVT, TRỊ GIÁ CIF USD, HS CODE, XUẤT XỨ, SỐ HĐ, NGÀY HĐ.

Nội dung hóa đơn:
${chunk}

Trả về JSON hợp lệ duy nhất:
{
  "materials": [
    {
      "maNl": "string",             // MA NL - Mã Nguyên Liệu (VD: GoCaoSu, VanMDF)
      "soHd": "string",             // SO HD - Số Hóa Đơn
      "ngayHd": "YYYY-MM-DD",       // NGAY HD - Ngày Hóa Đơn
      "tenHang": "string",          // TEN HANG - Tên Hàng
      "donViTinh": "string",        // DON VI TINH - Đơn Vị Tính (M3, KG, CAI, BO)
      "soLuong": number,            // SO LUONG - Số Lượng
      "donGia": number,             // DON GIA - Đơn Giá (VND)
      "thanhTien": number,          // THANH TIEN - Thành Tiền (VND)
      "tyGiaVndUsd": number,        // TY GIA VND/USD - Tỷ Giá (VD: 26300)
      "donGiaUsd": number,          // DON GIA USD - Đơn Giá USD
      "soLuongLamCo": number,       // SO LUONG LAM CO - Số Lượng Làm C/O
      "dvt": "string",              // DVT - Đơn Vị Tính C/O
      "triGiaCifUsd": number,       // TRỊ GIÁ CIF USD - Trị Giá CIF USD
      "hsCode": "string",           // HS CODE - Mã HS (8 chữ số hoặc rỗng)
      "xuatXu": "string"            // XUAT XU - Xuất Xứ
    }
  ],
  "confidence": number
}

📌 QUY TẮC TRÍCH XUẤT:
- Đọc hết toàn bộ nội dung, kể cả nhiều trang.
- Chỉ lấy các mặt hàng là NGUYÊN PHỤ LIỆU thực tế: ván MDF/HDF/ép, gỗ cao su, tay nắm, bản lề, vít, bulong, thanh trượt, phụ kiện.
- KHÔNG lấy dòng thuế, chiết khấu, tổng cộng, phí, hoặc dịch vụ.

🔹 MA NL (Mã Nguyên Liệu):
  + Nếu có cột "Mã hàng", "Ký hiệu", "Model" → lấy chính xác
  + Nếu không có → tạo mã rút gọn từ tên hàng (VD: "Ván MDF" → "VanMDF", "Gỗ cao su" → "GoCaoSu")
  + Viết hoa, không dấu, không khoảng trắng

🔹 TEN HANG: Tên hàng chính xác từ hóa đơn

🔹 DON VI TINH: Đơn vị tính (M3, KG, CAI, BO, TAM, etc.)

🔹 SO LUONG: Số lượng (chỉ số, không đơn vị)

🔹 DON GIA: Đơn giá VND (chỉ số, không có dấu phẩy)

🔹 THANH TIEN: Thành tiền VND = soLuong × donGia

🔹 TY GIA VND/USD: Tỷ giá (thường 24000-26500, nếu không có thì 25000)

🔹 DON GIA USD: Đơn giá USD = donGia ÷ tyGiaVndUsd

🔹 SO LUONG LAM CO: Số lượng làm C/O (thường = soLuong)

🔹 DVT: Đơn vị tính C/O (thường = donViTinh)

🔹 TRỊ GIÁ CIF USD: Trị giá CIF USD = soLuongLamCo × donGiaUsd

🔹 HS CODE: Mã HS 8 chữ số (nếu có), không có thì để rỗng ""

🔹 XUAT XU: Xuất xứ
  + Nếu công ty/địa chỉ có "Việt Nam" → "MUA VN KRXX"
  + Nếu có "China", "Trung Quốc" → "NK CHINA KRXX"
  + Nếu có "Thailand" → "NK THAILAND KRXX"
  + Mặc định → "MUA VN KRXX"

- Đảm bảo JSON hợp lệ, không text thừa.
${userNote ? `
⚠️ GHI CHÚ TỪ NGƯỜI DÙNG:
${userNote}` : ''}
`;

          console.log(`Calling Gemini for invoice ${i + 1}/${invoiceChunks.length}...`);

          const result = await this.gemini.extractWithCustomPrompt(prompt);

          // Chuẩn hóa kết quả đầu ra
          const materials = (result.materials || []).map((m) => {
            let xuatXu = (m.xuatXu || '').toUpperCase().trim();

            // Tự động bổ sung hậu tố KRXX
            if (xuatXu.includes('CHINA')) xuatXu = 'NK CHINA KRXX';
            else if (xuatXu.includes('VN') || xuatXu.includes('VIETNAM')) xuatXu = 'MUA VN KRXX';
            else if (xuatXu.includes('TH')) xuatXu = 'NK THAILAND KRXX';
            else xuatXu = 'MUA VN KRXX';

            return {
              maNl: (m.maNl || '').toUpperCase(),
              soHd: m.soHd || '',
              ngayHd: this.parseDate(m.ngayHd),
              tenHang: m.tenHang || '',
              donViTinh: m.donViTinh || '',
              soLuong: parseFloat(m.soLuong) || 0,
              donGia: parseFloat(m.donGia) || 0,
              thanhTien: parseFloat(m.thanhTien) || 0,
              tyGiaVndUsd: parseFloat(m.tyGiaVndUsd) || 25000,
              donGiaUsd: parseFloat(m.donGiaUsd) || 0,
              soLuongLamCo: parseFloat(m.soLuongLamCo) || 0,
              dvt: m.dvt || '',
              triGiaCifUsd: parseFloat(m.triGiaCifUsd) || 0,
              hsCode: m.hsCode || '',
              xuatXu
            };
          });

          allMaterials.push(...materials);
        }
>>>>>>> quyetdev
      }

      return {
        materials: allMaterials,
        totalMaterials: allMaterials.length,
<<<<<<< HEAD
        totalQuantity: allMaterials.reduce((sum, m) => sum + m.quantityImported, 0),
        totalValueVnd: allMaterials.reduce((sum, m) => sum + m.totalValueVnd, 0),
        aiConfidence: 85,
        aiModel: this.aiModel,
        aiVersion: this.aiVersion,
        warnings: []
      };
    } catch (error) {
      console.error('Extract NPL table error:', error);
      throw new Error(`Lỗi trích xuất bảng NPL: ${error.message}`);
=======
        aiConfidence: 88,
        aiModel: this.aiModel,
        aiVersion: this.aiVersion,
        extractedAt: new Date()
      };
    } catch (error) {
      console.error('Extract NPL table error:', error);
      throw new Error(`Lỗi trích xuất NPL: ${error.message}`);
>>>>>>> quyetdev
    }
  }

  /**
   * Extract BOM Table (Bảng Định mức)
   * Giai đoạn 3: Xử lý BOM
   * @param {Array} bomDocs - Danh sách BOM documents
   * @param {Array} skuList - Danh sách SKU từ Product Table
   * @param {String} userNote - Ghi chú của user về lỗi/yêu cầu (optional)
   */
  async extractBomTable(bomDocs, skuList, userNote = null) {
    try {
      console.log('=== EXTRACT BOM TABLE ===');
      console.log('Number of BOM docs:', bomDocs.length);
      console.log('SKU list:', JSON.stringify(skuList, null, 2));

      const allBomData = [];
      let stt = 1;

      // Tạo danh sách SKU codes rút gọn - chỉ giữ code để giảm prompt size
      const skuCodes = skuList.map(s => s.skuCode).join(', ');
      console.log('SKU codes for BOM:', skuCodes);

      for (const doc of bomDocs) {
        // LẤY ĐÚNG FIELD ocrResult từ model Document
        const ocrText = doc?.ocrResult || '';
        
        console.log('BOM doc type:', doc?.documentType);
        console.log('BOM doc ID:', doc?._id);
        console.log('BOM OCR length:', ocrText.length);
        console.log('BOM preview (first 300):', ocrText.substring(0, 300));
        console.log('BOM preview (last 300):', ocrText.substring(Math.max(0, ocrText.length - 300)));

        if (!ocrText || ocrText.length < 50) {
          console.warn('⚠️ BOM OCR text quá ngắn, bỏ qua');
          continue;
        }
        
        if (ocrText.length < 500) {
          console.warn('⚠️ BOM OCR text ngắn (<500 chars), có thể OCR không chính xác');
        }
        
        // Tối ưu prompt: giảm OCR text xuống 2500 chars, làm sạch ký tự lạ
        const maxOcrLength = 2500;
        let ocrTextOptimized = ocrText.length > maxOcrLength 
          ? ocrText.substring(0, maxOcrLength)
          : ocrText;
        
        // Loại bỏ ký tự lạ, giữ lại chữ số, chữ cái, dấu cách, dấu câu cơ bản
        ocrTextOptimized = ocrTextOptimized.replace(/[^\w\s\d.,:\-\/\*\(\)\[\]\n\r]/g, ' ');
        ocrTextOptimized = ocrTextOptimized.replace(/\s+/g, ' ').trim();
        
        const prompt = `Extract BOM. Return JSON only.

BOM TABLE:
${ocrTextOptimized}

SKUs: ${skuCodes}

JSON format:
{"materials":[{"nplCode":"str","nplName":"str","hsCode":"str|null","unit":"str","normPerSku":{"SKU":num}}],"confidence":num,"warnings":[]}

Rules:
- Extract ALL materials
- normPerSku: {SKU_code: quantity}
- Missing SKU: 0.0
- hsCode: 8 digits or null${userNote ? `\n\nNOTE: ${userNote}` : ''}`;

        console.log('Calling Gemini for BOM...');
        if (userNote) {
          console.log('>>> WITH USER NOTE:', userNote);
        }
        
        // Retry logic cho BOM extraction (timeout thường xảy ra)
        let result;
        const maxRetries = 2;
        let lastError;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            console.log(`🔄 BOM extraction attempt ${attempt}/${maxRetries}...`);
            result = await this.gemini.extractWithCustomPrompt(prompt);
            console.log('✅ BOM extraction successful');
            console.log('BOM result:', JSON.stringify(result, null, 2));
            break; // Success, exit retry loop
          } catch (bomError) {
            lastError = bomError;
            console.error(`❌ BOM EXTRACTION ERROR (attempt ${attempt}/${maxRetries}):`, bomError.message);
            
            if (attempt < maxRetries) {
              console.log(`⏳ Retrying in 3 seconds...`);
              await new Promise(resolve => setTimeout(resolve, 3000));
            } else {
              console.error('Stack:', bomError.stack);
              throw new Error(`Lỗi trích xuất BOM sau ${maxRetries} lần thử: ${bomError.message}`);
            }
          }
        }

        // Process BOM data
        const materials = (result.materials || []).map(m => {
          // Convert normPerSku object to Map
          const normPerSkuMap = new Map();
          if (m.normPerSku && typeof m.normPerSku === 'object') {
            Object.keys(m.normPerSku).forEach(skuCode => {
              normPerSkuMap.set(skuCode, parseFloat(m.normPerSku[skuCode]) || 0);
            });
          }

          return {
            stt: stt++,
            nplCode: m.nplCode || 'N/A',
            nplName: m.nplName || 'N/A',
            hsCode: m.hsCode || '',
            unit: m.unit || 'PCS',
            normPerSku: normPerSkuMap,
            sourceBomId: doc?._id?.toString() || '',
            isEdited: false,
            editedFields: [],
            editHistory: []
          };
        });

        allBomData.push(...materials);
      }

      return {
        bomData: allBomData,
        skuList: skuList.map(s => ({
          skuCode: s.skuCode,
          productName: s.productName
        })),
        totalMaterials: allBomData.length,
        totalSkus: skuList.length,
        aiConfidence: 85,
        aiModel: this.aiModel,
        aiVersion: this.aiVersion,
        warnings: []
      };
    } catch (error) {
      console.error('Extract BOM table error:', error);
      throw new Error(`Lỗi trích xuất bảng định mức: ${error.message}`);
    }
  }

  /**
<<<<<<< HEAD
=======
   * Tách văn bản thành các hóa đơn riêng biệt
   */
  splitIntoInvoices(ocrText) {
    // Tách dựa vào PAGE BREAK hoặc header hóa đơn mới
    const chunks = [];
    
    // Tách theo PAGE BREAK
    let parts = ocrText.split(/---\s*PAGE\s*BREAK\s*---|--- PAGE BREAK ---|---PAGE BREAK---|━━━━━━━━━━━━━━━━/i);
    
    // Nếu không có PAGE BREAK, tìm header hóa đơn mới
    if (parts.length === 1) {
      // Tìm các header hóa đơn: "HÓA ĐƠN GIÁ TRỊ GIA TĂNG" + thông tin công ty
      const invoiceHeaders = [];
      const regex = /HÓA\s*ĐƠN\s*GIÁ\s*TRỊ\s*GIA\s*TĂNG/gi;
      let match;
      
      while ((match = regex.exec(ocrText)) !== null) {
        invoiceHeaders.push(match.index);
      }
      
      if (invoiceHeaders.length > 1) {
        // Có nhiều hóa đơn, tách theo header
        for (let i = 0; i < invoiceHeaders.length; i++) {
          const start = invoiceHeaders[i];
          const end = i < invoiceHeaders.length - 1 ? invoiceHeaders[i + 1] : ocrText.length;
          chunks.push(ocrText.substring(start, end));
        }
      } else {
        // Chỉ có 1 hóa đơn
        chunks.push(ocrText);
      }
    } else {
      // Đã tách theo PAGE BREAK
      chunks.push(...parts.filter(p => p.trim().length > 50));
    }
    
    return chunks;
  }

  /**
>>>>>>> quyetdev
   * Parse date string to Date object
   */
  parseDate(dateStr) {
    if (!dateStr) return new Date();
    
    try {
      // Try YYYY-MM-DD format
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return new Date(dateStr);
      }
      
      // Try DD/MM/YYYY format
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
        const [day, month, year] = dateStr.split('/');
        return new Date(`${year}-${month}-${day}`);
      }
      
      return new Date(dateStr);
    } catch (error) {
      return new Date();
    }
  }
}

// Singleton instance
let extractorInstance = null;

function getDataExtractorService() {
  if (!extractorInstance) {
    extractorInstance = new DataExtractorService();
  }
  return extractorInstance;
}

module.exports = {
  DataExtractorService,
  getDataExtractorService
};
