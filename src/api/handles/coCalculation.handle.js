const mongoose = require('mongoose');
const constants = require('../../constants');
const helpers = require('../../helpers');

const CoApplication = mongoose.model('CoApplication');
const RawInvoiceData = mongoose.model('RawInvoiceData');
const RawBomData = mongoose.model('RawBomData');
const RawNplData = mongoose.model('RawNplData');
const InventoryIn = mongoose.model('InventoryIn');
const InventoryOut = mongoose.model('InventoryOut');
const AllocationDetail = mongoose.model('AllocationDetail');
const BreakdownResult = mongoose.model('BreakdownResult');

// ============================================================================
// PHASE 1: RAW DATA MANAGEMENT
// ============================================================================

/**
 * Get all raw data for a C/O application
 */
async function getRawData(coId) {
  if (!mongoose.isValidObjectId(coId)) {
    const err = new Error('ID không hợp lệ');
    err.status = constants.HTTP_STATUS.BAD_REQUEST;
    throw err;
  }

  const co = await CoApplication.findById(coId);
  if (!co) {
    const err = new Error('Không tìm thấy hồ sơ C/O');
    err.status = constants.HTTP_STATUS.NOT_FOUND;
    throw err;
  }

  const [invoiceData, bomData, nplData] = await Promise.all([
    RawInvoiceData.find({ coApplicationId: coId }).lean(),
    RawBomData.find({ coApplicationId: coId }).lean(),
    RawNplData.find({ coApplicationId: coId }).lean()
  ]);

  return {
    coApplication: co.toObject(),
    invoiceData,
    bomData,
    nplData,
    stats: {
      totalSKUs: invoiceData.length,
      totalBomItems: bomData.length,
      totalNplItems: nplData.length,
      verifiedInvoice: invoiceData.filter(d => d.verified).length,
      verifiedBom: bomData.filter(d => d.verified).length,
      verifiedNpl: nplData.filter(d => d.verified).length
    }
  };
}

/**
 * Update raw invoice data
 */
async function updateRawInvoiceData(coId, dataArray) {
  if (!Array.isArray(dataArray) || dataArray.length === 0) {
    const err = new Error('Dữ liệu không hợp lệ');
    err.status = constants.HTTP_STATUS.BAD_REQUEST;
    throw err;
  }

  const results = [];
  for (const item of dataArray) {
    if (item._id) {
      // Update existing
      const updated = await RawInvoiceData.findByIdAndUpdate(
        item._id,
        { ...item, updatedAt: new Date() },
        { new: true }
      );
      results.push(updated);
    } else {
      // Create new
      const created = await RawInvoiceData.create({
        ...item,
        coApplicationId: coId
      });
      results.push(created);
    }
  }

  return results;
}

/**
 * Update raw BOM data
 */
async function updateRawBomData(coId, dataArray) {
  if (!Array.isArray(dataArray) || dataArray.length === 0) {
    const err = new Error('Dữ liệu không hợp lệ');
    err.status = constants.HTTP_STATUS.BAD_REQUEST;
    throw err;
  }

  const results = [];
  for (const item of dataArray) {
    if (item._id) {
      const updated = await RawBomData.findByIdAndUpdate(
        item._id,
        { ...item, updatedAt: new Date() },
        { new: true }
      );
      results.push(updated);
    } else {
      const created = await RawBomData.create({
        ...item,
        coApplicationId: coId
      });
      results.push(created);
    }
  }

  return results;
}

/**
 * Update raw NPL data
 */
async function updateRawNplData(coId, dataArray) {
  if (!Array.isArray(dataArray) || dataArray.length === 0) {
    const err = new Error('Dữ liệu không hợp lệ');
    err.status = constants.HTTP_STATUS.BAD_REQUEST;
    throw err;
  }

  const results = [];
  for (const item of dataArray) {
    if (item._id) {
      const updated = await RawNplData.findByIdAndUpdate(
        item._id,
        { ...item, updatedAt: new Date() },
        { new: true }
      );
      results.push(updated);
    } else {
      const created = await RawNplData.create({
        ...item,
        coApplicationId: coId
      });
      results.push(created);
    }
  }

  return results;
}

/**
 * Verify and normalize all raw data
 */
async function verifyRawData(coId, userId, exchangeRate) {
  const co = await CoApplication.findById(coId);
  if (!co) {
    const err = new Error('Không tìm thấy hồ sơ C/O');
    err.status = constants.HTTP_STATUS.NOT_FOUND;
    throw err;
  }

  if (!exchangeRate || exchangeRate <= 0) {
    const err = new Error('Tỷ giá VND→USD không hợp lệ');
    err.status = constants.HTTP_STATUS.BAD_REQUEST;
    throw err;
  }

  // Update exchange rate
  co.exchangeRateVndUsd = exchangeRate;

  // Verify all invoice data
  await RawInvoiceData.updateMany(
    { coApplicationId: coId },
    { 
      verified: true, 
      verifiedBy: userId, 
      verifiedAt: new Date() 
    }
  );

  // Verify all BOM data
  await RawBomData.updateMany(
    { coApplicationId: coId },
    { 
      verified: true, 
      verifiedBy: userId, 
      verifiedAt: new Date() 
    }
  );

  // Verify and convert NPL data VND→USD
  const nplData = await RawNplData.find({ coApplicationId: coId });
  for (const npl of nplData) {
    if (npl.unitPriceVnd > 0 && npl.unitPriceUsd === 0) {
      npl.unitPriceUsd = npl.unitPriceVnd / exchangeRate;
    }
    npl.verified = true;
    npl.verifiedBy = userId;
    npl.verifiedAt = new Date();
    await npl.save();
  }

  // Create InventoryIn records from verified NPL data
  await createInventoryInFromNpl(coId);

  // Update CO status
  co.calculationStatus = 'DATA_VERIFIED';
  await co.save();

  return {
    message: 'Dữ liệu đã được xác nhận và chuẩn hóa',
    exchangeRate,
    inventoryCreated: true
  };
}

/**
 * Create InventoryIn records from RawNplData
 */
async function createInventoryInFromNpl(coId) {
  const nplData = await RawNplData.find({ 
    coApplicationId: coId, 
    verified: true 
  }).sort({ invoiceDate: 1 }); // FIFO: Sort by date

  const inventoryRecords = [];
  for (const npl of nplData) {
    const totalValue = npl.quantity * npl.unitPriceUsd;
    
    const invIn = await InventoryIn.create({
      coApplicationId: coId,
      nplCode: npl.nplCode,
      nplName: npl.nplName,
      quantityIn: npl.quantity,
      unit: npl.unit,
      unitPriceUsd: npl.unitPriceUsd,
      totalValueUsd: totalValue,
      invoiceRef: npl.sourceDocumentRef,
      invoiceNumber: npl.invoiceNumber,
      invoiceDate: npl.invoiceDate,
      originCountry: npl.originCountry,
      hasCo: npl.hasOriginCert,
      coNumber: npl.coNplNumber,
      remainingStock: npl.quantity, // Initial stock
      rawNplDataId: npl._id
    });
    
    inventoryRecords.push(invIn);
  }

  return inventoryRecords;
}

// ============================================================================
// PHASE 2: FORM & CRITERION SELECTION
// ============================================================================

/**
 * Select criterion for calculation
 */
async function selectCriterion(coId, criterion) {
  const co = await CoApplication.findById(coId);
  if (!co) {
    const err = new Error('Không tìm thấy hồ sơ C/O');
    err.status = constants.HTTP_STATUS.NOT_FOUND;
    throw err;
  }

  if (co.calculationStatus !== 'DATA_VERIFIED') {
    const err = new Error('Dữ liệu chưa được xác nhận. Vui lòng xác nhận dữ liệu trước.');
    err.status = constants.HTTP_STATUS.BAD_REQUEST;
    throw err;
  }

  const validCriteria = ['CTC', 'CTSH', 'RVC40', 'RVC50', 'WO', 'PE'];
  if (!validCriteria.includes(criterion)) {
    const err = new Error('Tiêu chí không hợp lệ');
    err.status = constants.HTTP_STATUS.BAD_REQUEST;
    throw err;
  }

  co.criterionSelected = criterion;
  co.formType = 'FORM_E'; // Chỉ xử lý Form E
  await co.save();

  return {
    message: 'Đã chọn tiêu chí thành công',
    criterion,
    formType: 'FORM_E'
  };
}

// ============================================================================
// PHASE 3: CALCULATION ENGINE (FIFO + RVC/CTC)
// ============================================================================

/**
 * Main calculation function - Process all SKUs
 */
async function calculateInventory(coId) {
  const co = await CoApplication.findById(coId);
  if (!co) {
    const err = new Error('Không tìm thấy hồ sơ C/O');
    err.status = constants.HTTP_STATUS.NOT_FOUND;
    throw err;
  }

  if (!co.criterionSelected) {
    const err = new Error('Chưa chọn tiêu chí. Vui lòng chọn tiêu chí trước.');
    err.status = constants.HTTP_STATUS.BAD_REQUEST;
    throw err;
  }

  co.calculationStatus = 'CALCULATING';
  await co.save();

  try {
    // Get all SKUs from invoice data
    const invoiceData = await RawInvoiceData.find({ 
      coApplicationId: coId, 
      verified: true 
    });

    if (invoiceData.length === 0) {
      throw new Error('Không có dữ liệu Invoice để tính toán');
    }

    const results = [];

    // Loop through each SKU
    for (const invoice of invoiceData) {
      console.log(`[Calculation] Processing SKU: ${invoice.sku}`);
      
      // Calculate for this SKU
      const skuResult = await calculateSingleSKU(coId, invoice, co.criterionSelected);
      results.push(skuResult);
    }

    // Update CO status
    co.calculationStatus = 'COMPLETED';
    co.calculationError = '';
    await co.save();

    return {
      message: 'Tính toán hoàn tất',
      totalSKUs: results.length,
      results
    };

  } catch (error) {
    co.calculationStatus = 'ERROR';
    co.calculationError = error.message;
    await co.save();
    throw error;
  }
}

/**
 * Calculate for a single SKU
 */
async function calculateSingleSKU(coId, invoiceItem, criterion) {
  const sku = invoiceItem.sku;
  
  // 1. Get BOM for this SKU
  const bomItems = await RawBomData.find({ 
    coApplicationId: coId, 
    sku, 
    verified: true 
  });

  if (bomItems.length === 0) {
    throw new Error(`Không có BOM cho SKU ${sku}`);
  }

  // 2. Calculate total NPL usage and allocate (FIFO)
  const nplDetails = [];
  let totalWithCo = 0;
  let totalWithoutCo = 0;

  for (const bomItem of bomItems) {
    const totalQuantityNeeded = bomItem.normPerProduct * invoiceItem.quantity;
    
    // FIFO allocation
    const allocations = await allocateNplFIFO(
      coId, 
      sku, 
      bomItem.nplCode, 
      totalQuantityNeeded,
      bomItem.unit
    );

    // Sum up values
    for (const alloc of allocations) {
      if (alloc.hasCo) {
        totalWithCo += alloc.valueUsd;
      } else {
        totalWithoutCo += alloc.valueUsd;
      }

      // Add to NPL details
      nplDetails.push({
        stt: nplDetails.length + 1,
        nplCode: bomItem.nplCode,
        nplName: bomItem.nplName,
        hsCodeNpl: alloc.hsCodeNpl || '',
        unit: bomItem.unit,
        normPerProduct: bomItem.normPerProduct,
        totalQuantityUsed: alloc.allocatedQuantity,
        unitPriceUsd: alloc.unitPriceUsd,
        valueUsd: alloc.valueUsd,
        originCountry: alloc.originCountry,
        originClassification: alloc.hasCo ? 'Có C/O' : 'Không C/O',
        invoiceRef: alloc.fromInvoiceRef,
        coNumber: alloc.coNumber || ''
      });
    }
  }

  // 3. Calculate result based on criterion
  let finalResult = 'KHÔNG ĐẠT';
  let finalOriginCode = '';
  let rvcPercentage = 0;
  let ctcResult = false;

  if (criterion === 'CTC' || criterion === 'CTSH') {
    // Check CTC/CTSH
    ctcResult = checkCTC(invoiceItem.hsCodeProduct, nplDetails, criterion);
    if (ctcResult) {
      finalResult = 'ĐẠT';
      finalOriginCode = `E.I/${criterion}`;
    }
  } else if (criterion === 'RVC40' || criterion === 'RVC50') {
    // Calculate RVC
    const threshold = criterion === 'RVC40' ? 40 : 50;
    rvcPercentage = (totalWithCo / invoiceItem.fobValueUsd) * 100;
    
    if (rvcPercentage >= threshold) {
      finalResult = 'ĐẠT';
      finalOriginCode = `E.I/RVC ${threshold}%`;
    }
  }

  // 4. Save result to BreakdownResult
  const breakdownResult = await BreakdownResult.create({
    coApplicationId: coId,
    sku,
    productName: invoiceItem.productName,
    hsCodeProduct: invoiceItem.hsCodeProduct,
    quantity: invoiceItem.quantity,
    unit: invoiceItem.unit,
    fobValueUsd: invoiceItem.fobValueUsd,
    criterion,
    totalNplValueWithCo: totalWithCo,
    totalNplValueWithoutCo: totalWithoutCo,
    rvcPercentage,
    ctcResult,
    finalOriginCode,
    finalResult,
    nplDetails
  });

  return breakdownResult.toObject();
}

/**
 * FIFO Allocation Logic
 */
async function allocateNplFIFO(coId, sku, nplCode, quantityNeeded, unit) {
  // Get inventory sorted by date (FIFO)
  const inventoryIns = await InventoryIn.find({
    coApplicationId: coId,
    nplCode,
    remainingStock: { $gt: 0 }
  }).sort({ invoiceDate: 1 });

  if (inventoryIns.length === 0) {
    throw new Error(`Không đủ tồn kho cho NPL ${nplCode}`);
  }

  const allocations = [];
  let remaining = quantityNeeded;

  for (const invIn of inventoryIns) {
    if (remaining <= 0) break;

    const allocateQty = Math.min(remaining, invIn.remainingStock);
    const allocateValue = allocateQty * invIn.unitPriceUsd;

    // Create allocation record
    const allocation = await AllocationDetail.create({
      coApplicationId: coId,
      sku,
      nplCode: invIn.nplCode,
      nplName: invIn.nplName,
      allocatedQuantity: allocateQty,
      unit,
      fromInvoiceRef: invIn.invoiceRef,
      fromInventoryInId: invIn._id,
      unitPriceUsd: invIn.unitPriceUsd,
      valueUsd: allocateValue,
      originCountry: invIn.originCountry,
      hasCo: invIn.hasCo,
      coNumber: invIn.coNumber
    });

    // Create inventory out record
    const invOut = await InventoryOut.create({
      coApplicationId: coId,
      sku,
      nplCode: invIn.nplCode,
      nplName: invIn.nplName,
      quantityOut: allocateQty,
      unit,
      fromInvoiceRef: invIn.invoiceRef,
      fromInventoryInId: invIn._id,
      unitPriceUsd: invIn.unitPriceUsd,
      valueUsd: allocateValue,
      originCountry: invIn.originCountry,
      hasCo: invIn.hasCo
    });

    // Update remaining stock
    invIn.remainingStock -= allocateQty;
    await invIn.save();

    // Get HS code from raw NPL data
    const rawNpl = await RawNplData.findById(invIn.rawNplDataId);
    
    allocations.push({
      ...allocation.toObject(),
      hsCodeNpl: rawNpl ? rawNpl.hsCodeNpl : '',
      inventoryOutId: invOut._id
    });

    remaining -= allocateQty;
  }

  if (remaining > 0) {
    throw new Error(`Không đủ tồn kho cho NPL ${nplCode}. Còn thiếu: ${remaining} ${unit}`);
  }

  return allocations;
}

/**
 * Check CTC/CTSH criterion
 */
function checkCTC(hsCodeProduct, nplDetails, criterion) {
  const productPrefix = hsCodeProduct.substring(0, 6); // First 6 digits for CTC
  
  for (const npl of nplDetails) {
    if (!npl.hsCodeNpl) continue;
    
    const nplPrefix = npl.hsCodeNpl.substring(0, 6);
    
    if (criterion === 'CTC') {
      // CTC: 6 số đầu phải khác nhau
      if (productPrefix === nplPrefix) {
        return false; // Không đạt CTC
      }
    } else if (criterion === 'CTSH') {
      // CTSH: 4 số đầu phải khác nhau
      const productPrefix4 = hsCodeProduct.substring(0, 4);
      const nplPrefix4 = npl.hsCodeNpl.substring(0, 4);
      if (productPrefix4 === nplPrefix4) {
        return false; // Không đạt CTSH
      }
    }
  }
  
  return true; // Đạt tiêu chí
}

// ============================================================================
// PHASE 4: OUTPUT & QA
// ============================================================================

/**
 * Get calculation results (all breakdown results)
 */
async function getCalculationResult(coId) {
  const co = await CoApplication.findById(coId);
  if (!co) {
    const err = new Error('Không tìm thấy hồ sơ C/O');
    err.status = constants.HTTP_STATUS.NOT_FOUND;
    throw err;
  }

  const results = await BreakdownResult.find({ coApplicationId: coId })
    .sort({ sku: 1 })
    .lean();

  return {
    coApplication: co.toObject(),
    breakdownResults: results,
    totalSKUs: results.length,
    passedSKUs: results.filter(r => r.finalResult === 'ĐẠT').length,
    failedSKUs: results.filter(r => r.finalResult === 'KHÔNG ĐẠT').length
  };
}

/**
 * Get preview for a single SKU breakdown
 */
async function getBreakdownPreview(coId, sku) {
  const co = await CoApplication.findById(coId);
  if (!co) {
    const err = new Error('Không tìm thấy hồ sơ C/O');
    err.status = constants.HTTP_STATUS.NOT_FOUND;
    throw err;
  }

  const breakdown = await BreakdownResult.findOne({ 
    coApplicationId: coId, 
    sku 
  }).lean();

  if (!breakdown) {
    const err = new Error(`Không tìm thấy bảng kê cho SKU ${sku}`);
    err.status = constants.HTTP_STATUS.NOT_FOUND;
    throw err;
  }

  // Format theo template bang_ke_ctc
  const preview = {
    header_info: {
      ten_thuong_nhan: co.exporterName || '',
      ma_so_thue: co.taxCode || '',
      ma_sku: sku,
      ten_hang: breakdown.productName,
      ma_hs_thanh_pham: breakdown.hsCodeProduct,
      to_khai_xk_so: co.exportDeclarationNo || '',
      to_khai_xk_ngay: co.invoiceDate || null,
      so_luong_xk: breakdown.quantity,
      dvt_thanh_pham: breakdown.unit,
      tri_gia_fob: breakdown.fobValueUsd,
      ty_gia_vnd_usd: co.exchangeRateVndUsd,
      tieu_chi_ap_dung: breakdown.criterion
    },
    result_summary: {
      tong_tri_gia_npl_khong_co_xx: breakdown.totalNplValueWithoutCo,
      tong_tri_gia_npl_co_xx: breakdown.totalNplValueWithCo,
      ty_le_npl_khong_co_xx_fob: (breakdown.totalNplValueWithoutCo / breakdown.fobValueUsd) * 100,
      ket_qua_tieu_chi: breakdown.finalResult,
      ma_xuat_xu_cuoi: breakdown.finalOriginCode
    },
    npl_details: breakdown.nplDetails
  };

  return preview;
}

/**
 * QA Approve breakdown results
 */
async function qaApprove(coId, userId, comments = '') {
  const co = await CoApplication.findById(coId);
  if (!co) {
    const err = new Error('Không tìm thấy hồ sơ C/O');
    err.status = constants.HTTP_STATUS.NOT_FOUND;
    throw err;
  }

  if (co.calculationStatus !== 'COMPLETED') {
    const err = new Error('Tính toán chưa hoàn tất. Không thể QA.');
    err.status = constants.HTTP_STATUS.BAD_REQUEST;
    throw err;
  }

  // Update CO
  co.qaApproved = true;
  co.qaApprovedBy = userId;
  co.qaApprovedAt = new Date();
  await co.save();

  // Update all breakdown results
  await BreakdownResult.updateMany(
    { coApplicationId: coId },
    {
      qaApproved: true,
      qaApprovedBy: userId,
      qaApprovedAt: new Date(),
      qaComments: comments
    }
  );

  return {
    message: 'QA đã xác nhận bảng kê',
    qaApprovedAt: co.qaApprovedAt
  };
}

module.exports = {
  // Phase 1
  getRawData,
  updateRawInvoiceData,
  updateRawBomData,
  updateRawNplData,
  verifyRawData,
  
  // Phase 2
  selectCriterion,
  
  // Phase 3
  calculateInventory,
  getCalculationResult,
  
  // Phase 4
  getBreakdownPreview,
  qaApprove
};
