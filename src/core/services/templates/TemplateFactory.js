const CTHTemplate = require('./CTHTemplate');
// Import các template khác khi cần
// const CTCTemplate = require('./CTCTemplate');
// const RVCTemplate = require('./RVCTemplate');
// const WOTemplate = require('./WOTemplate');
// const PETemplate = require('./PETemplate');

/**
 * Factory để tạo template phù hợp theo tiêu chí
 */
class TemplateFactory {
  /**
   * Tạo template instance dựa trên criterionType
   * @param {string} criterionType - Loại tiêu chí (CTH, CTC, RVC40, RVC50, WO, PE)
   * @param {string} formType - Loại form (FORM_E, FORM_D, etc.)
   * @returns {BaseTemplate} Template instance
   */
  static createTemplate(criterionType, formType = '') {
    switch (criterionType.toUpperCase()) {
      case 'CTH':
        return new CTHTemplate();
      
      // Các template khác sẽ được thêm sau
      case 'CTC':
        // Tạm thời dùng CTH template cho CTC
        return new CTHTemplate();
      
      case 'RVC40':
      case 'RVC50':
        // return new RVCTemplate(criterionType);
        throw new Error(`Template cho tiêu chí ${criterionType} chưa được triển khai`);
      
      case 'WO':
        // return new WOTemplate();
        throw new Error(`Template cho tiêu chí ${criterionType} chưa được triển khai`);
      
      case 'PE':
        // return new PETemplate();
        throw new Error(`Template cho tiêu chí ${criterionType} chưa được triển khai`);
      
      default:
        throw new Error(`Không hỗ trợ tiêu chí: ${criterionType}`);
    }
  }

  /**
   * Lấy danh sách các tiêu chí được hỗ trợ
   * @returns {Array} Danh sách tiêu chí
   */
  static getSupportedCriteria() {
    return [
      { code: 'CTH', name: 'Change in Tariff Heading', supported: true },
      { code: 'CTC', name: 'Change in Tariff Classification', supported: true },
      { code: 'RVC40', name: 'Regional Value Content 40%', supported: false },
      { code: 'RVC50', name: 'Regional Value Content 50%', supported: false },
      { code: 'WO', name: 'Wholly Obtained', supported: false },
      { code: 'PE', name: 'Processing Exception', supported: false }
    ];
  }

  /**
   * Kiểm tra xem tiêu chí có được hỗ trợ không
   * @param {string} criterionType - Loại tiêu chí
   * @returns {boolean} True nếu được hỗ trợ
   */
  static isSupported(criterionType) {
    const supportedCriteria = this.getSupportedCriteria();
    const criterion = supportedCriteria.find(c => c.code === criterionType.toUpperCase());
    return criterion ? criterion.supported : false;
  }
}

module.exports = TemplateFactory;
