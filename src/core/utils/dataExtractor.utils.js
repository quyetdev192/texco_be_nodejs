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
- skuCode: Lấy từ cột "Item NO.", "Product Code", "SKU", "Model"
- productName: Mô tả đầy đủ từ cột "Description", "Product Name"
- hsCode: Mã HS CODE 8 chữ số (tìm trong Invoice hoặc Declaration). VD: "94036090", "94032090", "94035000"
  + Nếu có trong Invoice/Declaration: Lấy chính xác
  + Nếu không có: Dựa vào tên sản phẩm để gợi ý (furniture → 9403xxxx, textile → 6302xxxx)
  + Nếu không chắc: Để "00000000"
- quantity: Số lượng (NUMBER, không có dấu phẩy)
- unit: Đơn vị (PCS, SET, CTN, PAIRS, SETS)
- unitPriceUsd: Giá đơn vị USD (NUMBER)
- fobValueUsd: Giá trị FOB USD (NUMBER) = quantity * unitPriceUsd
- Tỷ giá: ${exchangeRate}
- CHỈ trả về JSON, không có text thêm
- Đảm bảo JSON hợp lệ, không có trailing comma
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
        productName: p.productName || 'N/A',
        hsCode: p.hsCode || '',
        quantity: parseFloat(p.quantity) || 0,
        unit: p.unit || 'PCS',
        unitPriceUsd: parseFloat(p.unitPriceUsd) || 0,
        fobValueUsd: parseFloat(p.fobValueUsd) || 0,
        exchangeRate: parseFloat(p.exchangeRate) || exchangeRate,
        fobValueVnd: (parseFloat(p.fobValueUsd) || 0) * exchangeRate,
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
      }

      return {
        materials: allMaterials,
        totalMaterials: allMaterials.length,
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
