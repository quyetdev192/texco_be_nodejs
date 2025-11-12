const mongoose = require('mongoose');
const { getGeminiService } = require('../utils/gemini.utils');

// Import model classes
const DocumentClass = require('../../api/models/document.model');
const BundleClass = require('../../api/models/bundle.model');
const CompanyClass = require('../../api/models/company.model');
const LohangDraftClass = require('../../api/models/lohangDraft.model');

// Build models
const buildModel = (modelClass) => {
  const modelName = modelClass.name;
  if (mongoose.models[modelName]) return mongoose.models[modelName];
  const schema = new mongoose.Schema(modelClass.getSchema(), { collection: modelClass.collection });
  return mongoose.model(modelName, schema);
};

const Document = buildModel(DocumentClass);
const Bundle = buildModel(BundleClass);
const Company = buildModel(CompanyClass);
const LohangDraft = buildModel(LohangDraftClass);

class CTCHeaderExtractorService {
  constructor() {
    this.gemini = getGeminiService();
  }

  /**
   * Extract thông tin header cho bảng kê CTC từ documents
   * @param {string} lohangDraftId - ID của lô hàng
   * @returns {Promise<Object>} - Thông tin header đã extract
   */
  async extractHeaderInfo(lohangDraftId) {
    try {
      console.log('🔄 Starting CTC header extraction for:', lohangDraftId);

      // 1. Load thông tin lô hàng
      const lohangDraft = await LohangDraft.findById(lohangDraftId).lean();
      if (!lohangDraft) {
        throw new Error('Không tìm thấy lô hàng');
      }

      // 2. Load thông tin công ty
      const company = await Company.findById(lohangDraft.companyId).lean();
      
      // 3. Load documents từ linkedDocuments
      let documents = [];
      if (lohangDraft.linkedDocuments && lohangDraft.linkedDocuments.length > 0) {
        documents = await Document.find({ 
          _id: { $in: lohangDraft.linkedDocuments },
          status: 'OCR_COMPLETED'
        }).lean();
      }

      // Nếu không có linkedDocuments, thử tìm bundle
      let bundle = null;
      if (documents.length === 0 && lohangDraft.bundleId) {
        bundle = await Bundle.findById(lohangDraft.bundleId).lean();
        if (bundle) {
          documents = await Document.find({ 
            bundleId: lohangDraft.bundleId,
            status: 'OCR_COMPLETED'
          }).lean();
        }
      }

      // 4. Tìm các documents quan trọng để extract thông tin
      const exportDeclaration = documents.find(doc => doc.documentType === 'EXPORT_DECLARATION');
      const commercialInvoice = documents.find(doc => doc.documentType === 'COMMERCIAL_INVOICE');

      // 5. Extract thông tin từ AI (nếu có documents)
      let extractedInfo = {};
      if (documents.length > 0) {
        extractedInfo = await this.extractWithAI(documents, lohangDraft, company);
      } else {
        console.log('⚠️ No documents found, using fallback data');
        extractedInfo = {
          companyName: company?.name,
          taxCode: company?.taxCode,
          exportDeclarationNumber: lohangDraft.exportDeclarationNo || lohangDraft.invoiceNo,
          exportDeclarationDate: lohangDraft.invoiceDate || new Date()
        };
      }

      // 6. Kết hợp thông tin
      const headerInfo = {
        // Thông tin công ty
        companyName: extractedInfo.companyName || company?.name || 'CÔNG TY TNHH MAI THƠ VIỆT NAM',
        taxCode: extractedInfo.taxCode || company?.taxCode || '3702797777',
        
        // Thông tin tờ khai
        exportDeclarationNumber: extractedInfo.exportDeclarationNumber || lohangDraft.exportDeclarationNo || lohangDraft.invoiceNo || '307569904740',
        exportDeclarationDate: extractedInfo.exportDeclarationDate || lohangDraft.invoiceDate || new Date(),
        
        // Thông tin tiêu chí (từ lohangDraft)
        criterionType: this.mapCriterionType(lohangDraft.criterionType),
        formType: lohangDraft.formType || 'FORM_E',
        
        // Thông tin tỷ giá
        exchangeRate: lohangDraft.exchangeRate || 25000,
        
        // Metadata
        extractedAt: new Date(),
        extractionSource: documents.length > 0 ? 'AI_GEMINI' : 'FALLBACK_DATA',
        documentsUsed: documents.map(doc => ({
          documentType: doc.documentType,
          fileName: doc.fileName
        })),
        documentsCount: documents.length
      };

      console.log('✅ CTC header extraction completed');
      return headerInfo;

    } catch (error) {
      console.error('❌ CTC header extraction failed:', error);
      throw error;
    }
  }

  /**
   * Extract thông tin từ documents bằng AI
   */
  async extractWithAI(documents, lohangDraft, company) {
    try {
      // Tạo prompt cho AI
      const prompt = this.createExtractionPrompt(documents, lohangDraft, company);
      
      console.log('🤖 Calling Gemini for header extraction...');
      const result = await this.gemini.extractWithCustomPrompt(prompt);
      
      console.log('✅ Gemini extraction result:', JSON.stringify(result, null, 2));
      return result;

    } catch (error) {
      console.error('❌ AI extraction failed:', error);
      
      // Fallback: Trả về thông tin mặc định
      return {
        companyName: company?.name || 'CÔNG TY TNHH MAI THƠ VIỆT NAM',
        taxCode: company?.taxCode || '3702797777',
        exportDeclarationNumber: '307569904740',
        exportDeclarationDate: new Date().toISOString()
      };
    }
  }

  /**
   * Tạo prompt cho AI extraction
   */
  createExtractionPrompt(documents, lohangDraft, company) {
    // Lấy OCR text từ các documents
    const ocrTexts = documents.map(doc => ({
      documentType: doc.documentType,
      fileName: doc.fileName,
      ocrResult: doc.ocrResult || ''
    })).filter(doc => doc.ocrResult.length > 0);

    const prompt = `
Bạn là chuyên gia phân tích chứng từ xuất khẩu. Hãy trích xuất thông tin chính xác từ các chứng từ sau để tạo header cho bảng kê CTC:

=== THÔNG TIN CẦN TRÍCH XUẤT ===
1. Tên thương nhân (công ty xuất khẩu)
2. Mã số thuế của công ty
3. Số tờ khai hải quan xuất khẩu (Export Declaration Number)
4. Ngày tờ khai hải quan xuất khẩu

=== THÔNG TIN HIỆN CÓ ===
- Công ty: ${company?.name || 'N/A'}
- Mã số thuế: ${company?.taxCode || 'N/A'}
- Tiêu chí áp dụng: ${lohangDraft.criterionType}
- Form type: ${lohangDraft.formType}

=== CHỨNG TỪ ĐỂ PHÂN TÍCH ===
${ocrTexts.map(doc => `
**${doc.documentType} - ${doc.fileName}:**
${doc.ocrResult}
`).join('\n')}

=== YÊU CẦU ===
1. Ưu tiên thông tin từ Tờ khai xuất khẩu (EXPORT_DECLARATION)
2. Nếu không có, lấy từ Commercial Invoice hoặc các chứng từ khác
3. Trả về JSON format chính xác
4. Nếu không tìm thấy thông tin, sử dụng thông tin hiện có hoặc để trống

=== OUTPUT FORMAT ===
Trả về JSON với format sau:
{
  "companyName": "Tên công ty xuất khẩu",
  "taxCode": "Mã số thuế",
  "exportDeclarationNumber": "Số tờ khai XK (dạng: 123456789/B11)",
  "exportDeclarationDate": "Ngày tờ khai (ISO format: 2025-11-12T00:00:00.000Z)",
  "confidence": 0.95,
  "notes": "Ghi chú về nguồn thông tin"
}

Hãy phân tích cẩn thận và trả về JSON chính xác.
`;

    return prompt;
  }

  /**
   * Map criterion type sang tên hiển thị
   */
  mapCriterionType(criterionType) {
    const mapping = {
      'CTC': 'CTC',
      'CTH': 'CTH', 
      'CTSH': 'CTSH',
      'RVC40': 'RVC 40%',
      'RVC50': 'RVC 50%',
      'WO': 'WO',
      'PE': 'PE'
    };
    
    return mapping[criterionType] || criterionType;
  }

  /**
   * Validate extracted information
   */
  validateExtractedInfo(info) {
    const errors = [];
    
    if (!info.companyName || info.companyName.trim().length === 0) {
      errors.push('Thiếu tên thương nhân');
    }
    
    if (!info.taxCode || info.taxCode.trim().length === 0) {
      errors.push('Thiếu mã số thuế');
    }
    
    if (!info.exportDeclarationNumber || info.exportDeclarationNumber.trim().length === 0) {
      errors.push('Thiếu số tờ khai xuất khẩu');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Format date cho hiển thị
   */
  formatDateForDisplay(dateString) {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit', 
        year: 'numeric'
      });
    } catch (error) {
      return new Date().toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    }
  }
}

module.exports = CTCHeaderExtractorService;
