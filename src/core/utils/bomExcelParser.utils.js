/**
 * BOM Excel Parser
 * Parse BOM Excel file và transform sang format ExtractedBomTable
 */

const XLSX = require('xlsx');
const axios = require('axios');

class BomExcelParser {
  /**
   * Parse BOM Excel từ URL hoặc buffer
   * @param {string|Buffer} source - URL hoặc Buffer của file Excel
   * @returns {Promise<Object>} BOM data đã parse
   */
  async parseBomExcel(source) {
    try {
      console.log('\n========== PARSE BOM EXCEL ==========');
      
      let workbook;
      
      // Nếu source là URL, download file trước
      if (typeof source === 'string' && (source.startsWith('http://') || source.startsWith('https://'))) {
        console.log('Downloading BOM Excel from URL:', source);
        const response = await axios.get(source, { responseType: 'arraybuffer' });
        workbook = XLSX.read(response.data, { type: 'buffer' });
      } else if (Buffer.isBuffer(source)) {
        console.log('Parsing BOM Excel from buffer');
        workbook = XLSX.read(source, { type: 'buffer' });
      } else {
        throw new Error('Source phải là URL hoặc Buffer');
      }

      // Lấy sheet đầu tiên
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      
      console.log('Sheet name:', sheetName);
      console.log('Sheet range:', sheet['!ref']);

      // Convert sheet sang JSON
      const rawData = XLSX.utils.sheet_to_json(sheet, { 
        header: 1, // Lấy dạng array of arrays
        defval: null, // Default value cho cell rỗng
<<<<<<< HEAD
        raw: false // Convert số sang string để xử lý dễ hơn
=======
        raw: true // Giữ nguyên giá trị số để bảo toàn độ chính xác thập phân
>>>>>>> quyetdev
      });

      console.log('Total rows:', rawData.length);
      console.log('First 3 rows:', JSON.stringify(rawData.slice(0, 3), null, 2));

      // Parse BOM data
      const bomData = this.parseBomData(rawData);
      
      console.log('Parsed BOM materials:', bomData.materials.length);
      console.log('SKU list:', bomData.skuList);
      console.log('========================================\n');

      return bomData;
    } catch (error) {
      console.error('Parse BOM Excel error:', error);
      throw new Error(`Lỗi parse BOM Excel: ${error.message}`);
    }
  }

  /**
   * Parse BOM data từ raw Excel data
   * @param {Array<Array>} rawData - Raw data từ Excel
   * @returns {Object} Parsed BOM data
   */
  parseBomData(rawData) {
    if (!rawData || rawData.length < 4) {
      throw new Error('Excel file rỗng hoặc không đủ dữ liệu (cần ít nhất 4 rows)');
    }

    // Row 1: STT của SKU (1, 2, 3, 4, ...)
    // Row 2: Mã SKU (E-31, C-31, C-37, ...)
    // Row 3: Mã sản phẩm (5022040, 5022052, ...) - HEADER THẬT
    // Row 4+: Data NPL
    const sttRow = rawData[0];
    const skuCodeRow = rawData[1];
    const headerRow = rawData[2]; // Row này mới là header thật!
    
    console.log('STT Row:', sttRow);
    console.log('SKU Code Row:', skuCodeRow);
    console.log('Header Row:', headerRow);

    // Xác định các cột cố định (dựa vào row 3 - header thật)
    const fixedColumns = {
      maNL: this.findColumnIndex(headerRow, ['MA NL', 'MÃ NL', 'NPL CODE', 'MA NPL', 'VanMDF']),
      hsCode: this.findColumnIndex(headerRow, ['HS CODE', 'HSCODE', 'HS']),
      tenNL: this.findColumnIndex(headerRow, ['TEN NL', 'TÊN NL', 'NPL NAME', 'TEN NPL']),
      quyCach: this.findColumnIndex(headerRow, ['QUY CACH', 'QUY CÁCH', 'SPEC', 'SPECIFICATION']),
      dvt: this.findColumnIndex(headerRow, ['DVT', 'ĐVT', 'UNIT', 'DON VI'])
    };

    console.log('Fixed columns:', fixedColumns);

    // Xác định các cột SKU (các cột sau DVT)
    const skuColumns = [];
    const dvtIndex = fixedColumns.dvt;
    
    if (dvtIndex !== -1) {
      for (let i = dvtIndex + 1; i < headerRow.length; i++) {
        const stt = sttRow[i] ? sttRow[i].toString().trim() : '';
        const skuCode = skuCodeRow[i] ? skuCodeRow[i].toString().trim() : '';
        const productCode = headerRow[i] ? headerRow[i].toString().trim() : '';
        
        // Chỉ lấy cột có SKU code hoặc product code
        if ((skuCode && skuCode !== '') || (productCode && productCode !== '')) {
          skuColumns.push({
            index: i,
            stt: stt,
            skuCode: skuCode || productCode, // Ưu tiên SKU code, fallback sang product code
            productCode: productCode
          });
        }
      }
    }

    console.log('SKU columns:', skuColumns);

    if (skuColumns.length === 0) {
      throw new Error('Không tìm thấy cột SKU trong Excel');
    }

    // Parse từng row (bắt đầu từ row 4 - index 3)
    const materials = [];
    
    for (let rowIndex = 3; rowIndex < rawData.length; rowIndex++) {
      const row = rawData[rowIndex];
      
      // Skip row rỗng
      if (!row || row.every(cell => !cell || cell.toString().trim() === '')) {
        continue;
      }
      
      // Skip row header phụ (nếu có)
      const firstCell = this.getCellValue(row, 0);
      if (firstCell && (firstCell.includes('STT') || firstCell.includes('Số TT') || firstCell.includes('MA NL'))) {
        continue;
      }

      // Lấy thông tin NPL
      const maNL = this.getCellValue(row, fixedColumns.maNL);
      const tenNL = this.getCellValue(row, fixedColumns.tenNL);
      const hsCode = this.getCellValue(row, fixedColumns.hsCode);
      const quyCach = this.getCellValue(row, fixedColumns.quyCach);
      const dvt = this.getCellValue(row, fixedColumns.dvt);

      // Tên NPL là bắt buộc
      if (!tenNL) {
        console.warn(`Row ${rowIndex + 1}: Bỏ qua vì không có tên NPL`);
        continue;
      }

      // Lấy định mức cho từng SKU
      const normPerSku = {};
      let hasNorm = false;

      for (const skuCol of skuColumns) {
        const normValue = this.getCellValue(row, skuCol.index);
        const normNumber = this.parseNumber(normValue);
        
        normPerSku[skuCol.skuCode] = normNumber;
        
        if (normNumber > 0) {
          hasNorm = true;
        }
      }

      // Chỉ thêm material nếu có ít nhất 1 định mức > 0
      if (hasNorm) {
        materials.push({
          nplCode: maNL || '',
          nplName: tenNL,
          hsCode: hsCode || null,
          quyCach: quyCach || '',
          unit: dvt || 'PCS',
          normPerSku: normPerSku
        });
      }
    }

    console.log(`Parsed ${materials.length} materials with norms`);

    return {
      materials: materials,
      skuList: skuColumns.map(col => ({
        stt: col.stt,
        skuCode: col.skuCode
      })),
      totalMaterials: materials.length,
      totalSkus: skuColumns.length
    };
  }

  /**
   * Tìm index của column dựa vào danh sách tên có thể
   * @param {Array} headers - Header row
   * @param {Array<string>} possibleNames - Các tên có thể của column
   * @returns {number} Index của column, hoặc -1 nếu không tìm thấy
   */
  findColumnIndex(headers, possibleNames) {
    for (let i = 0; i < headers.length; i++) {
      const header = (headers[i] || '').toString().toUpperCase().trim();
      
      for (const name of possibleNames) {
        if (header === name.toUpperCase() || header.includes(name.toUpperCase())) {
          return i;
        }
      }
    }
    return -1;
  }

  /**
<<<<<<< HEAD
   * Lấy giá trị cell
   * @param {Array} row - Row data
   * @param {number} index - Column index
   * @returns {string} Cell value
   */
  getCellValue(row, index) {
    if (index === -1 || !row || !row[index]) {
      return '';
    }
    return row[index].toString().trim();
  }

  /**
   * Parse string sang number
   * @param {string} value - String value
   * @returns {number} Number value
=======
   * Lấy giá trị cell (giữ nguyên type để bảo toàn độ chính xác số)
   * @param {Array} row - Row data
   * @param {number} index - Column index
   * @returns {any} Cell value (giữ nguyên type)
   */
  getCellValue(row, index) {
    if (index === -1 || !row || row[index] === undefined || row[index] === null) {
      return '';
    }
    
    const value = row[index];
    
    // Nếu là số, giữ nguyên để bảo toàn độ chính xác
    if (typeof value === 'number') {
      return value;
    }
    
    // Nếu là string, trim và return
    return value.toString().trim();
  }

  /**
   * Parse string sang number với độ chính xác cao
   * @param {string} value - String value
   * @returns {number} Number value (giữ nguyên độ chính xác thập phân)
>>>>>>> quyetdev
   */
  parseNumber(value) {
    if (!value || value === '') {
      return 0;
    }

<<<<<<< HEAD
    // Remove commas và spaces
    const cleaned = value.toString().replace(/,/g, '').replace(/\s/g, '');
    const number = parseFloat(cleaned);

    return isNaN(number) ? 0 : number;
=======
    // Nếu đã là số, trả về ngay để bảo toàn độ chính xác
    if (typeof value === 'number') {
      return isNaN(value) || !isFinite(value) ? 0 : value;
    }

    // Remove commas và spaces, giữ nguyên dấu chấm thập phân
    const cleaned = value.toString().replace(/,/g, '').replace(/\s/g, '');
    
    // Sử dụng Number() thay vì parseFloat() để giữ độ chính xác cao hơn
    const number = Number(cleaned);

    // Kiểm tra nếu là số hợp lệ
    if (isNaN(number) || !isFinite(number)) {
      return 0;
    }

    // Giữ nguyên số thập phân, không làm tròn
    return number;
  }

  /**
   * Tạo mapping thông minh giữa BOM SKU codes và Product SKU codes
   * @param {Array} bomSkuList - SKU list từ BOM Excel (E-31, C-31, D-24...)
   * @param {Array} productSkuList - SKU list từ Product Table (5022064, 5022065...)
   * @returns {Object} Mapping object { bomSku: productSku }
   */
  createSkuMapping(bomSkuList, productSkuList) {
    const mapping = {};
    
    // Sắp xếp theo thứ tự STT để mapping 1-1
    const sortedBomSkus = bomSkuList.sort((a, b) => parseInt(a.stt) - parseInt(b.stt));
    const sortedProductSkus = productSkuList.sort((a, b) => a.stt - b.stt);
    
    console.log('Creating SKU mapping:');
    console.log('BOM SKUs:', sortedBomSkus.map(s => `${s.stt}:${s.skuCode}`));
    console.log('Product SKUs:', sortedProductSkus.map(s => `${s.stt}:${s.skuCode}`));
    
    // Mapping theo thứ tự STT
    for (let i = 0; i < Math.min(sortedBomSkus.length, sortedProductSkus.length); i++) {
      const bomSku = sortedBomSkus[i].skuCode;
      const productSku = sortedProductSkus[i].skuCode;
      mapping[bomSku] = productSku;
      
      console.log(`Mapping: ${bomSku} → ${productSku}`);
    }
    
    return mapping;
>>>>>>> quyetdev
  }

  /**
   * Transform parsed BOM data sang format ExtractedBomTable
   * @param {Object} parsedData - Parsed BOM data
   * @param {Array<Object>} skuList - SKU list từ Product Table
   * @returns {Object} Transformed BOM data
   */
  transformToBomTable(parsedData, skuListFromProductTable) {
<<<<<<< HEAD
    const bomData = parsedData.materials.map((material, index) => {
      // Convert normPerSku object sang Map
      const normPerSkuMap = new Map();
      
      for (const [skuCode, norm] of Object.entries(material.normPerSku)) {
        normPerSkuMap.set(skuCode, norm);
=======
    // Tạo mapping thông minh giữa BOM SKU và Product SKU
    const bomToProductMapping = this.createSkuMapping(parsedData.skuList, skuListFromProductTable);
    
    const bomData = parsedData.materials.map((material, index) => {
      // Convert normPerSku từ BOM SKU sang Product SKU
      const normPerSkuMap = new Map();
      
      for (const [bomSkuCode, norm] of Object.entries(material.normPerSku)) {
        // Convert BOM SKU (E-31) sang Product SKU (5022064)
        const productSkuCode = bomToProductMapping[bomSkuCode];
        if (productSkuCode) {
          normPerSkuMap.set(productSkuCode, norm);
        }
>>>>>>> quyetdev
      }

      return {
        stt: index + 1,
        nplCode: material.nplCode,
        nplName: material.nplName,
        hsCode: material.hsCode,
        unit: material.unit,
<<<<<<< HEAD
        normPerSku: normPerSkuMap,
=======
        normPerSku: normPerSkuMap, // Giờ đây chứa Product SKU codes
>>>>>>> quyetdev
        isEdited: false,
        editedFields: [],
        editHistory: []
      };
    });

<<<<<<< HEAD
    // Merge SKU list từ Excel BOM với Product Table
    // Excel BOM có: { stt, skuCode }
    // Product Table có: { skuCode, productName }
    const mergedSkuList = parsedData.skuList.map(excelSku => {
      const productSku = skuListFromProductTable.find(p => p.skuCode === excelSku.skuCode);
      return {
        stt: excelSku.stt,
        skuCode: excelSku.skuCode,
        productName: productSku ? productSku.productName : ''
      };
    });
=======
    // SKU list chỉ chứa Product SKU codes
    const mergedSkuList = skuListFromProductTable.map(productSku => ({
      stt: productSku.stt,
      skuCode: productSku.skuCode, // Chỉ Product SKU code (5022064, 5022065...)
      productName: productSku.productName
    }));
>>>>>>> quyetdev

    return {
      bomData: bomData,
      skuList: mergedSkuList,
      totalMaterials: bomData.length,
      totalSkus: mergedSkuList.length,
      aiConfidence: 100, // Excel upload = 100% confidence
      aiModel: 'EXCEL_UPLOAD',
      aiVersion: '1.0',
      warnings: []
    };
  }
}

// Singleton instance
let bomExcelParserInstance = null;

function getBomExcelParser() {
  if (!bomExcelParserInstance) {
    bomExcelParserInstance = new BomExcelParser();
  }
  return bomExcelParserInstance;
}

module.exports = {
  BomExcelParser,
  getBomExcelParser
};
