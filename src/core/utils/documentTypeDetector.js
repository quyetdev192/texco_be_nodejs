/**
 * Tự động phát hiện loại chứng từ dựa trên tên file
 * Để tránh lỗi khi user chọn sai loại chứng từ
 */

const DOCUMENT_TYPE_PATTERNS = {
  // NPL - Nhập khẩu nguyên phụ liệu
  'VAT_INVOICE': [
    /h[oó]a?\s*[dđ][oơ]n\s*(vat|gtgt)/i,
    /invoice.*vat/i,
    /vat.*invoice/i,
    /hdvat/i,
    /hd.*vat/i
  ],
  'IMPORT_DECLARATION': [
    /t[oờ]\s*khai\s*nh[aậ]p\s*kh[aả]u/i,
    /import.*declaration/i,
    /customs.*declaration/i,
    /tknk/i,
    /tk.*nk/i,
    /^up.*npl/i,
    /up.*to.*khai/i
  ],
  'PURCHASE_LIST': [
    /purchase.*list/i,
    /packing.*list/i,
    /danh.*s[aá]ch.*mua/i,
    /purchase/i,
    /packing/i
  ],
  'NPL_ORIGIN_CERT': [
    /c[\/\-_]o.*npl/i,
    /certificate.*origin.*npl/i,
    /gi[aấ]y.*ch[uứ]ng.*nh[aậ]n.*xu[aấ]t.*x[uứ].*npl/i,
    /npl.*c[\/\-_]o/i,
    /chung.*tu.*xuat.*xu.*npl/i,
    /ch[uứ]ng.*t[uừ].*xu[aấ]t.*x[uứ].*npl/i
  ],
  
  // Xuất khẩu
  'COMMERCIAL_INVOICE': [
    /commercial.*invoice/i,
    /export.*invoice/i,
    /^up.*invoice/i,
    /invoice(?!.*vat)/i,
    /h[oó]a?\s*[dđ][oơ]n(?!.*vat)/i,
    /^inv[_-]/i
  ],
  'EXPORT_DECLARATION': [
    /t[oờ]\s*khai\s*xu[aấ]t\s*kh[aả]u/i,
    /export.*declaration/i,
    /tkxk/i,
    /tk.*xk/i,
    /tokhai.*hq/i,
    /to.*khai.*hq/i
  ],
  'BOM': [
    /bill.*of.*material/i,
    /^bom[_-]/i,
    /bom/i,
    /[dđ][iị]nh\s*m[uứ]c/i,
    /bang.*[dđ][iị]nh.*m[uứ]c/i,
    /nguy[eê]n.*v[aậ]t.*li[eệ]u/i
  ],
  'BILL_OF_LADING': [
    /bill.*of.*lading/i,
    /^bl$/i,
    /^bl\./i,
    /b[\/\-_]l/i,
    /v[aậ]n.*[dđ][oơ]n/i
  ]
};

/**
 * Detect document type from filename
 * @param {string} fileName - Tên file
 * @returns {string|null} - Document type hoặc null nếu không detect được
 */
function detectDocumentType(fileName) {
  if (!fileName || typeof fileName !== 'string') {
    return null;
  }

  const normalizedName = fileName.toLowerCase().trim();

  // Duyệt qua từng loại document type
  for (const [docType, patterns] of Object.entries(DOCUMENT_TYPE_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(normalizedName)) {
        return docType;
      }
    }
  }

  return null;
}

/**
 * Get suggested document type with confidence score
 * @param {string} fileName 
 * @returns {{type: string|null, confidence: number, suggestions: Array}}
 */
function detectWithConfidence(fileName) {
  if (!fileName || typeof fileName !== 'string') {
    return { type: null, confidence: 0, suggestions: [] };
  }

  const normalizedName = fileName.toLowerCase().trim();
  const scores = {};

  // Tính điểm cho từng loại
  for (const [docType, patterns] of Object.entries(DOCUMENT_TYPE_PATTERNS)) {
    let score = 0;
    for (const pattern of patterns) {
      if (pattern.test(normalizedName)) {
        score += 1;
      }
    }
    if (score > 0) {
      scores[docType] = score;
    }
  }

  // Sắp xếp theo điểm
  const suggestions = Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .map(([type, score]) => ({ type, score }));

  const topType = suggestions.length > 0 ? suggestions[0].type : null;
  const confidence = suggestions.length > 0 ? suggestions[0].score : 0;

  return {
    type: topType,
    confidence,
    suggestions
  };
}

/**
 * Validate if document type matches filename
 * @param {string} fileName 
 * @param {string} documentType 
 * @returns {{valid: boolean, detectedType: string|null, message: string}}
 */
function validateDocumentType(fileName, documentType) {
  const detected = detectDocumentType(fileName);
  
  if (!detected) {
    return {
      valid: true, // Không detect được thì chấp nhận
      detectedType: null,
      message: 'Không thể tự động xác định loại chứng từ từ tên file'
    };
  }

  if (detected === documentType) {
    return {
      valid: true,
      detectedType: detected,
      message: 'Loại chứng từ khớp với tên file'
    };
  }

  return {
    valid: false,
    detectedType: detected,
    message: `Cảnh báo: Tên file gợi ý loại "${detected}" nhưng được chọn là "${documentType}"`
  };
}

module.exports = {
  detectDocumentType,
  detectWithConfidence,
  validateDocumentType,
  DOCUMENT_TYPE_PATTERNS
};
