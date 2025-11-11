class GeminiService {
  constructor() {
    // Load balancing với 3 API keys
    this.apiKeys = [
      process.env.GEMINI_API_KEY,
      process.env.GEMINI_API_KEY1,
      process.env.GEMINI_API_KEY2
    ].filter(key => key); // Loại bỏ key undefined
    
    if (this.apiKeys.length === 0) {
      throw new Error('No Gemini API keys configured. Please set GEMINI_API_KEY, GEMINI_API_KEY1, or GEMINI_API_KEY2');
    }
    
    console.log(`✅ Loaded ${this.apiKeys.length} Gemini API key(s) for load balancing`);
    
    this.currentKeyIndex = 0; // Round-robin index
    this.apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
  }
  
  /**
   * Get next API key using round-robin
   */
  getNextApiKey() {
    const key = this.apiKeys[this.currentKeyIndex];
    this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
    return key;
  }

  /**
   * Phân tích OCR text để xác định loại chứng từ
   * @param {string} ocrText - Text từ OCR
   * @returns {Promise<{documentType: string, confidence: number, reasoning: string}>}
   */
  async detectDocumentType(ocrText) {
    try {
      const prompt = `Bạn là chuyên gia phân tích chứng từ xuất nhập khẩu Việt Nam. Hãy phân tích văn bản OCR sau và xác định loại chứng từ.

Các loại chứng từ hợp lệ:
- VAT_INVOICE: Hóa đơn VAT (có chữ "VAT", "GTGT", "Hóa đơn giá trị gia tăng")
- IMPORT_DECLARATION: Tờ khai nhập khẩu (có "Tờ khai hàng hóa nhập khẩu", "TKHK", mã tờ khai)
- PURCHASE_LIST: Danh sách mua hàng
- NPL_ORIGIN_CERT: Giấy chứng nhận xuất xứ NPL (C/O cho nguyên phụ liệu)
- COMMERCIAL_INVOICE: Hóa đơn thương mại xuất khẩu (Invoice không có VAT, có "Commercial Invoice", "Exporter")
- EXPORT_DECLARATION: Tờ khai xuất khẩu (có "Tờ khai hàng hóa xuất khẩu")
- BOM: Bill of Materials - Định mức nguyên vật liệu (có bảng định mức, danh sách NVL)
- BILL_OF_LADING: Vận đơn (có "Bill of Lading", "B/L", thông tin vận chuyển)

Văn bản OCR:
"""
${ocrText.substring(0, 2000)}
"""

Trả về JSON với format:
{
  "documentType": "VAT_INVOICE",
  "confidence": 0.95,
  "reasoning": "Văn bản có chữ 'HÓA ĐƠN GIÁ TRỊ GIA TĂNG' và mã số thuế"
}`;

      const apiKey = this.getNextApiKey();
      console.log(`🔑 detectDocumentType - Using API key #${this.currentKeyIndex === 0 ? this.apiKeys.length : this.currentKeyIndex}/${this.apiKeys.length}`);
      
      const response = await fetch(`${this.apiUrl}?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: prompt }]
            }
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 10000,
            topP: 0.9
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return {
          documentType: null,
          confidence: 0,
          reasoning: 'Không thể phân tích'
        };
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        documentType: parsed.documentType || null,
        confidence: parsed.confidence || 0,
        reasoning: parsed.reasoning || ''
      };
    } catch (error) {
      console.error('Gemini document type detection error:', error);
      return {
        documentType: null,
        confidence: 0,
        reasoning: `Lỗi phân tích: ${error.message}`
      };
    }
  }

  /**
   * Trích xuất dữ liệu từ text OCR sử dụng Gemini
   * @param {string} ocrText - Text từ OCR
   * @param {string} documentType - Loại chứng từ (INVOICE, TKNK, BOM, PACKING_LIST, etc.)
   * @returns {Promise<Object>} - Dữ liệu đã trích xuất
   */
  async extractStructuredData(ocrText, documentType) {
    try {
      const prompt = this.buildPromptByDocumentType(ocrText, documentType);
      
      const apiKey = this.getNextApiKey();
      console.log(`🔑 extractStructuredData - Using API key #${this.currentKeyIndex === 0 ? this.apiKeys.length : this.currentKeyIndex}/${this.apiKeys.length}`);
      
      const response = await fetch(`${this.apiUrl}?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: prompt }]
            }
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 10000,
            topP: 0.9
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      // Parse JSON từ response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Không thể parse JSON từ Gemini response');
      }
      
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error('Gemini extraction error:', error);
      throw new Error(`Lỗi trích xuất dữ liệu: ${error.message}`);
    }
  }

  /**
   * Call Gemini API với custom prompt (dùng cho trường hợp đặc biệt)
   * @param {string} customPrompt - Prompt tùy chỉnh
   * @returns {Promise<Object>} - Dữ liệu đã trích xuất
   */
  async extractWithCustomPrompt(customPrompt) {
    try {
      console.log('\n========== GEMINI API REQUEST ==========');
      const apiKey = this.getNextApiKey();
      console.log('API URL:', `${this.apiUrl}?key=${apiKey.substring(0, 10)}...`);
      console.log(`🔑 Using API key #${this.currentKeyIndex === 0 ? this.apiKeys.length : this.currentKeyIndex}/${this.apiKeys.length}`);
      console.log('Prompt length:', customPrompt.length);
      console.log('Prompt preview (first 500 chars):\n', customPrompt.substring(0, 500));
      console.log('Prompt preview (last 500 chars):\n', customPrompt.substring(customPrompt.length - 500));

      const requestBody = {
        contents: [
          {
            role: 'user',
            parts: [{ text: customPrompt }]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 100000,
          topP: 0.9,
          responseMimeType: 'application/json'
        }
      };

      console.log('Request config:', JSON.stringify(requestBody.generationConfig, null, 2));

      // Tạo timeout controller - tăng lên 180s cho BOM phức tạp
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.error('⏱️ Gemini API timeout after 180 seconds');
        controller.abort();
      }, 180000); // 180 seconds timeout

      let response;
      try {
        response = await fetch(`${this.apiUrl}?key=${apiKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
      } catch (fetchError) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          throw new Error('Gemini API timeout sau 180 giây. Bảng BOM quá phức tạp, vui lòng thử lại hoặc chia nhỏ dữ liệu.');
        }
        throw fetchError;
      }

      console.log('Response status:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Gemini API error response:', errorText);
        throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('\n========== GEMINI API RESPONSE ==========');
      console.log('Full response:', JSON.stringify(data, null, 2));

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      console.log('Extracted text length:', text.length);
      console.log('Extracted text:\n', text);
      
      // Parse JSON từ response - xử lý cả markdown code blocks
      let jsonText = text.trim();
      
      // Loại bỏ markdown code blocks nếu có
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/^```json\s*/i, '').replace(/```\s*$/, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```\s*/, '').replace(/```\s*$/, '');
      }
      
      // Tìm JSON object
      const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('Cannot find JSON in response. Text:', text);
        throw new Error('Không thể parse JSON từ Gemini response');
      }
      
      let jsonString = jsonMatch[0];
      
      // Clean up JSON string để tránh lỗi parse
      try {
        // Loại bỏ trailing commas (,} hoặc ,])
        jsonString = jsonString.replace(/,(\s*[}\]])/g, '$1');
        
        // Loại bỏ comments (// hoặc /* */)
        jsonString = jsonString.replace(/\/\/.*$/gm, '');
        jsonString = jsonString.replace(/\/\*[\s\S]*?\*\//g, '');
        
        // Fix lỗi Gemini: thiếu } trước dấu phẩy
        // Pattern: } \n    , → },
        jsonString = jsonString.replace(/\}\s+,/g, '},');
        
        // Thử parse
        const parsedJson = JSON.parse(jsonString);
        console.log('Parsed JSON successfully!');
        console.log('Parsed JSON preview:', JSON.stringify(parsedJson).substring(0, 500) + '...');
        console.log('========================================\n');
        
        return parsedJson;
      } catch (parseError) {
        console.error('❌ JSON Parse Error:', parseError.message);
        console.error('Problematic JSON string (first 1000 chars):\n', jsonString.substring(0, 1000));
        
        // Extract error position from error message
        const posMatch = parseError.message.match(/position (\d+)/);
        const errorPos = posMatch ? parseInt(posMatch[1]) : 354;
        console.error(`Problematic JSON string (around position ${errorPos}):\n`, jsonString.substring(Math.max(0, errorPos - 100), errorPos + 100));
        console.error(`Character at error position: "${jsonString[errorPos]}" (code: ${jsonString.charCodeAt(errorPos)})`);
        
        // Thử fix một số lỗi phổ biến
        try {
          // Fix single quotes thành double quotes
          jsonString = jsonString.replace(/'/g, '"');
          
          // Fix unquoted keys
          jsonString = jsonString.replace(/(\{|,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
          
          // Fix lỗi: } \n , { → }, {  (lần 2 sau khi clean)
          jsonString = jsonString.replace(/\}\s*,\s*\{/g, '},\n{');
          
          const fixedJson = JSON.parse(jsonString);
          console.log('Fixed and parsed JSON successfully!');
          return fixedJson;
        } catch (fixError) {
          console.error('Cannot fix JSON. Original error:', parseError.message);
          throw new Error(`Không thể parse JSON từ Gemini response: ${parseError.message}`);
        }
      }
    } catch (error) {
      console.error('\n========== GEMINI API ERROR ==========');
      console.error('Error:', error);
      console.error('Error stack:', error.stack);
      console.error('======================================\n');
      throw new Error(`Lỗi trích xuất dữ liệu: ${error.message}`);
    }
  }

  /**
   * Xây dựng prompt theo loại chứng từ
   */
  buildPromptByDocumentType(ocrText, documentType) {
    const baseInstruction = `Bạn là chuyên gia phân tích chứng từ xuất nhập khẩu. Hãy trích xuất thông tin từ văn bản OCR sau và trả về CHÍNH XÁC dưới dạng JSON.`;

    switch (documentType) {
      case 'INVOICE':
        return `${baseInstruction}

Văn bản OCR:
${ocrText}

Hãy trích xuất thông tin sau và trả về JSON:
{
  "invoiceNo": "Số hóa đơn",
  "invoiceDate": "Ngày hóa đơn (YYYY-MM-DD)",
  "exporterInfo": "Thông tin người xuất khẩu",
  "consigneeInfo": "Thông tin người nhận",
  "items": [
    {
      "productName": "Tên sản phẩm",
      "hsCode": "Mã HS",
      "quantity": số_lượng,
      "unit": "Đơn vị",
      "unitPrice": giá_đơn_vị_USD,
      "totalValue": tổng_giá_trị_USD
    }
  ],
  "totalFobValue": tổng_FOB_USD
}

Lưu ý: 
- Chỉ trả về JSON, không thêm text giải thích
- Số lượng và giá trị phải là số, không có dấu phẩy
- Ngày phải theo format YYYY-MM-DD`;

      case 'TKNK':
      case 'HDVAT_NPL':
        return `${baseInstruction}

Văn bản OCR:
${ocrText}

Hãy trích xuất thông tin NPL (Nguyên phụ liệu) và trả về JSON:
{
  "invoiceNo": "Số hóa đơn/TKNK",
  "invoiceDate": "Ngày (YYYY-MM-DD)",
  "supplierName": "Tên nhà cung cấp",
  "materials": [
    {
      "materialCode": "Mã NPL",
      "materialName": "Tên NPL",
      "hsCode": "Mã HS",
      "quantity": số_lượng,
      "unit": "Đơn vị",
      "unitPriceCIF": giá_CIF_USD,
      "totalValue": tổng_giá_trị_USD,
      "originCountry": "Xuất xứ"
    }
  ]
}

Lưu ý:
- Chỉ trả về JSON
- Giá phải là CIF USD
- Xuất xứ là tên quốc gia (VD: "Trung Quốc", "Việt Nam")`;

      case 'BOM':
        return `${baseInstruction}

Văn bản OCR:
${ocrText}

Hãy trích xuất định mức BOM và trả về JSON:
{
  "productCode": "Mã thành phẩm",
  "productName": "Tên thành phẩm",
  "productHsCode": "Mã HS thành phẩm",
  "materials": [
    {
      "materialCode": "Mã NPL",
      "materialName": "Tên NPL",
      "hsCode": "Mã HS NPL",
      "normPerProduct": định_mức_trên_1_TP,
      "unit": "Đơn vị"
    }
  ]
}

Lưu ý:
- Định mức là số lượng NPL cần cho 1 đơn vị thành phẩm
- Chỉ trả về JSON`;

      case 'PACKING_LIST':
        return `${baseInstruction}

Văn bản OCR:
${ocrText}

Hãy trích xuất thông tin Packing List và trả về JSON:
{
  "packingListNo": "Số PL",
  "date": "Ngày (YYYY-MM-DD)",
  "items": [
    {
      "productName": "Tên sản phẩm",
      "productCode": "Mã sản phẩm",
      "quantity": số_lượng,
      "unit": "Đơn vị",
      "grossWeight": trọng_lượng_kg,
      "cartons": số_thùng
    }
  ]
}`;

      case 'CAM_KET_XUAT_XU':
        return `${baseInstruction}

Văn bản OCR:
${ocrText}

Hãy trích xuất thông tin Cam kết xuất xứ và trả về JSON:
{
  "documentNo": "Số văn bản",
  "date": "Ngày (YYYY-MM-DD)",
  "supplierName": "Tên NCC",
  "materials": [
    {
      "materialName": "Tên NPL",
      "hsCode": "Mã HS",
      "originCountry": "Xuất xứ",
      "hasCO": true/false,
      "coNumber": "Số C/O (nếu có)"
    }
  ]
}`;

      default:
        return `${baseInstruction}

Văn bản OCR:
${ocrText}

Hãy trích xuất tất cả thông tin quan trọng và trả về dưới dạng JSON có cấu trúc hợp lý.`;
    }
  }

  /**
   * Phân tích và gợi ý tiêu chí xuất xứ (CTC/RVC)
   * @param {Object} productInfo - Thông tin sản phẩm
   * @param {Array} materials - Danh sách NPL
   * @returns {Promise<Object>} - Gợi ý tiêu chí
   */
  async suggestOriginCriterion(productInfo, materials) {
    try {
      const prompt = `Bạn là chuyên gia về quy tắc xuất xứ hàng hóa (Rules of Origin).

Thông tin thành phẩm:
- Mã HS: ${productInfo.hsCode}
- Tên: ${productInfo.name}

Danh sách NPL:
${materials.map((m, i) => `${i + 1}. ${m.name} - Mã HS: ${m.hsCode} - Xuất xứ: ${m.origin}`).join('\n')}

Hãy phân tích và gợi ý tiêu chí xuất xứ phù hợp (CTC, CTSH, RVC40, RVC50) và trả về JSON:
{
  "suggestedCriterion": "CTC hoặc CTSH hoặc RVC40 hoặc RVC50",
  "reasoning": "Lý do gợi ý",
  "ctcAnalysis": {
    "productChapter": "2 số đầu mã HS TP",
    "hasNonOriginatingMaterials": true/false,
    "materialChapters": ["Danh sách chapter của NPL"],
    "ctcMet": true/false
  },
  "rvcEstimate": {
    "estimatedRVC": phần_trăm_ước_tính,
    "recommendation": "Gợi ý"
  }
}`;

      const apiKey = this.getNextApiKey();
      console.log(`🔑 analyzeOriginCompliance - Using API key #${this.currentKeyIndex === 0 ? this.apiKeys.length : this.currentKeyIndex}/${this.apiKeys.length}`);
      
      const response = await fetch(`${this.apiUrl}?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: prompt }]
            }
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 10000,
            topP: 0.9
          }
        })
      });

      if (!response.ok) {
        return { suggestedCriterion: 'CTC', reasoning: 'Lỗi API' };
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return { suggestedCriterion: 'CTC', reasoning: 'Mặc định' };
      }
      
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error('Gemini criterion suggestion error:', error);
      return { suggestedCriterion: 'CTC', reasoning: 'Lỗi phân tích, dùng mặc định' };
    }
  }
}

// Singleton instance
let geminiServiceInstance = null;

function getGeminiService() {
  if (!geminiServiceInstance) {
    geminiServiceInstance = new GeminiService();
  }
  return geminiServiceInstance;
}

module.exports = {
  GeminiService,
  getGeminiService
};
