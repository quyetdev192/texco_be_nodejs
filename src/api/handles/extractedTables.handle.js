/**
 * Handle functions cho Extracted Tables (Bảng tổng hợp dữ liệu)
 * Nhân viên có thể xem và chỉnh sửa các bảng này
 */

const mongoose = require('mongoose');
const constants = require('../../core/utils/constants');

// Import models
const ExtractedProductTableClass = require('../models/extractedProductTable.model');
const ExtractedNplTableClass = require('../models/extractedNplTable.model');
const ExtractedBomTableClass = require('../models/extractedBomTable.model');

function buildModelFromClass(modelClass) {
  const modelName = modelClass.name;
  if (mongoose.models[modelName]) return mongoose.models[modelName];
  const schemaDefinition = modelClass.getSchema();
  const schema = new mongoose.Schema(schemaDefinition, { collection: modelClass.collection });
  return mongoose.model(modelName, schema);
}

const ExtractedProductTable = buildModelFromClass(ExtractedProductTableClass);
const ExtractedNplTable = buildModelFromClass(ExtractedNplTableClass);
const ExtractedBomTable = buildModelFromClass(ExtractedBomTableClass);

/**
 * Lấy Bảng Tổng hợp Sản phẩm Xuất khẩu
 * GET /api/v1/co/lohang/:lohangDraftId/tables/products
 */
async function getProductTable(lohangDraftId) {
  const table = await ExtractedProductTable.findOne({ lohangDraftId }).lean();
  
  if (!table) {
    const err = new Error('Chưa có bảng tổng hợp sản phẩm');
    err.status = constants.HTTP_STATUS.NOT_FOUND;
    throw err;
  }

  return table;
}

/**
 * Lấy Bảng Nhập kho NPL
 * GET /api/v1/co/lohang/:lohangDraftId/tables/npl
 */
async function getNplTable(lohangDraftId) {
  const table = await ExtractedNplTable.findOne({ lohangDraftId }).lean();
  
  if (!table) {
    const err = new Error('Chưa có bảng nhập kho NPL');
    err.status = constants.HTTP_STATUS.NOT_FOUND;
    throw err;
  }

  return table;
}

/**
 * Lấy Bảng Định mức (BOM)
 * GET /api/v1/co/lohang/:lohangDraftId/tables/bom
 */
async function getBomTable(lohangDraftId) {
  const table = await ExtractedBomTable.findOne({ lohangDraftId }).lean();
  
  if (!table) {
    const err = new Error('Chưa có bảng định mức');
    err.status = constants.HTTP_STATUS.NOT_FOUND;
    throw err;
  }

  return table;
}

/**
 * Lấy tất cả bảng tổng hợp
 * GET /api/v1/co/lohang/:lohangDraftId/tables
 */
async function getAllTables(lohangDraftId) {
  const [productTable, nplTable, bomTable] = await Promise.all([
    ExtractedProductTable.findOne({ lohangDraftId }).lean(),
    ExtractedNplTable.findOne({ lohangDraftId }).lean(),
    ExtractedBomTable.findOne({ lohangDraftId }).lean()
  ]);

  return {
    productTable: productTable || null,
    nplTable: nplTable || null,
    bomTable: bomTable || null,
    hasProductTable: !!productTable,
    hasNplTable: !!nplTable,
    hasBomTable: !!bomTable
  };
}

/**
 * Cập nhật 1 sản phẩm trong bảng sản phẩm
 * PUT /api/v1/co/lohang/:lohangDraftId/tables/products/:productIndex
 */
async function updateProductInTable(lohangDraftId, productIndex, updatedProduct, userId) {
  const table = await ExtractedProductTable.findOne({ lohangDraftId });
  
  if (!table) {
    const err = new Error('Không tìm thấy bảng sản phẩm');
    err.status = constants.HTTP_STATUS.NOT_FOUND;
    throw err;
  }

  const index = parseInt(productIndex);
  if (index < 0 || index >= table.products.length) {
    const err = new Error('Index sản phẩm không hợp lệ');
    err.status = constants.HTTP_STATUS.BAD_REQUEST;
    throw err;
  }

  const oldProduct = table.products[index];
  const editedFields = [];

  // So sánh và ghi lại các field đã sửa
  Object.keys(updatedProduct).forEach(key => {
    if (oldProduct[key] !== updatedProduct[key]) {
      editedFields.push(key);
      
      // Thêm vào edit history
      if (!table.products[index].editHistory) {
        table.products[index].editHistory = [];
      }
      
      table.products[index].editHistory.push({
        editedAt: new Date(),
        editedBy: userId,
        fieldName: key,
        oldValue: String(oldProduct[key]),
        newValue: String(updatedProduct[key])
      });
    }
  });

  // Cập nhật product
  Object.assign(table.products[index], updatedProduct);
  table.products[index].isEdited = true;
  table.products[index].editedFields = [...new Set([...(table.products[index].editedFields || []), ...editedFields])];
  
  // Cập nhật status của table
  table.status = 'EDITED';
  table.updatedAt = new Date();

  // Tính lại tổng
  table.totalQuantity = table.products.reduce((sum, p) => sum + (p.quantity || 0), 0);
  table.totalFobValueUsd = table.products.reduce((sum, p) => sum + (p.fobValueUsd || 0), 0);
  table.totalFobValueVnd = table.products.reduce((sum, p) => sum + (p.fobValueVnd || 0), 0);

  await table.save();

  return table;
}

/**
 * Cập nhật 1 NPL trong bảng NPL
 * PUT /api/v1/co/lohang/:lohangDraftId/tables/npl/:nplIndex
 */
async function updateNplInTable(lohangDraftId, nplIndex, updatedNpl, userId) {
  const table = await ExtractedNplTable.findOne({ lohangDraftId });
  
  if (!table) {
    const err = new Error('Không tìm thấy bảng NPL');
    err.status = constants.HTTP_STATUS.NOT_FOUND;
    throw err;
  }

  const index = parseInt(nplIndex);
  if (index < 0 || index >= table.materials.length) {
    const err = new Error('Index NPL không hợp lệ');
    err.status = constants.HTTP_STATUS.BAD_REQUEST;
    throw err;
  }

<<<<<<< HEAD
  const oldNpl = table.materials[index];
  const editedFields = [];

  // So sánh và ghi lại các field đã sửa
  Object.keys(updatedNpl).forEach(key => {
    if (oldNpl[key] !== updatedNpl[key]) {
      editedFields.push(key);
      
      if (!table.materials[index].editHistory) {
        table.materials[index].editHistory = [];
      }
      
      table.materials[index].editHistory.push({
        editedAt: new Date(),
        editedBy: userId,
        fieldName: key,
        oldValue: String(oldNpl[key]),
        newValue: String(updatedNpl[key])
      });
    }
  });

  // Cập nhật NPL
  Object.assign(table.materials[index], updatedNpl);
  table.materials[index].isEdited = true;
  table.materials[index].editedFields = [...new Set([...(table.materials[index].editedFields || []), ...editedFields])];
=======
  // Cập nhật NPL - chỉ cho phép sửa 5 cột: nplCode, invoiceNo, invoiceDate, quantity, origin
  const allowedFields = ['nplCode', 'invoiceNo', 'invoiceDate', 'quantity', 'origin'];
  const filteredUpdate = {};
  
  Object.keys(updatedNpl).forEach(key => {
    if (allowedFields.includes(key)) {
      filteredUpdate[key] = updatedNpl[key];
    }
  });
  
  Object.assign(table.materials[index], filteredUpdate);
>>>>>>> quyetdev
  
  table.status = 'EDITED';
  table.updatedAt = new Date();

<<<<<<< HEAD
  // Tính lại tổng
  table.totalQuantity = table.materials.reduce((sum, m) => sum + (m.quantityImported || 0), 0);
  table.totalValueVnd = table.materials.reduce((sum, m) => sum + (m.totalValueVnd || 0), 0);

=======
>>>>>>> quyetdev
  await table.save();

  return table;
}

/**
 * Cập nhật định mức trong bảng BOM
 * PUT /api/v1/co/lohang/:lohangDraftId/tables/bom/:bomIndex
 */
async function updateBomInTable(lohangDraftId, bomIndex, updatedBom, userId) {
  const table = await ExtractedBomTable.findOne({ lohangDraftId });
  
  if (!table) {
    const err = new Error('Không tìm thấy bảng BOM');
    err.status = constants.HTTP_STATUS.NOT_FOUND;
    throw err;
  }

  const index = parseInt(bomIndex);
  if (index < 0 || index >= table.bomData.length) {
    const err = new Error('Index BOM không hợp lệ');
    err.status = constants.HTTP_STATUS.BAD_REQUEST;
    throw err;
  }

  const oldBom = table.bomData[index];
  const editedFields = [];

  // Cập nhật normPerSku nếu có
  if (updatedBom.normPerSku) {
    Object.keys(updatedBom.normPerSku).forEach(skuCode => {
      const oldValue = table.bomData[index].normPerSku.get(skuCode);
      const newValue = updatedBom.normPerSku[skuCode];
      
      if (oldValue !== newValue) {
        editedFields.push(`normPerSku.${skuCode}`);
        
        if (!table.bomData[index].editHistory) {
          table.bomData[index].editHistory = [];
        }
        
        table.bomData[index].editHistory.push({
          editedAt: new Date(),
          editedBy: userId,
          fieldName: 'normPerSku',
          skuCode: skuCode,
          oldValue: String(oldValue),
          newValue: String(newValue)
        });
        
        table.bomData[index].normPerSku.set(skuCode, newValue);
      }
    });
  }

  // Cập nhật các field khác
  ['nplCode', 'nplName', 'hsCode', 'unit'].forEach(key => {
    if (updatedBom[key] && oldBom[key] !== updatedBom[key]) {
      editedFields.push(key);
      table.bomData[index][key] = updatedBom[key];
    }
  });

  if (editedFields.length > 0) {
    table.bomData[index].isEdited = true;
    table.bomData[index].editedFields = [...new Set([...(table.bomData[index].editedFields || []), ...editedFields])];
    table.status = 'EDITED';
    table.updatedAt = new Date();
  }

  await table.save();

  return table;
}

/**
 * Xác nhận tất cả bảng tổng hợp
 * PUT /api/v1/co/lohang/:lohangDraftId/tables/confirm
 */
async function confirmAllTables(lohangDraftId) {
  const [productTable, nplTable, bomTable] = await Promise.all([
    ExtractedProductTable.findOne({ lohangDraftId }),
    ExtractedNplTable.findOne({ lohangDraftId }),
    ExtractedBomTable.findOne({ lohangDraftId })
  ]);

  const updates = [];

  if (productTable) {
    productTable.status = 'CONFIRMED';
    productTable.updatedAt = new Date();
    updates.push(productTable.save());
  }

  if (nplTable) {
    nplTable.status = 'CONFIRMED';
    nplTable.updatedAt = new Date();
    updates.push(nplTable.save());
  }

  if (bomTable) {
    bomTable.status = 'CONFIRMED';
    bomTable.updatedAt = new Date();
    updates.push(bomTable.save());
  }

  await Promise.all(updates);

  return {
    productTableConfirmed: !!productTable,
    nplTableConfirmed: !!nplTable,
    bomTableConfirmed: !!bomTable,
    message: 'Đã xác nhận tất cả bảng tổng hợp'
  };
}

module.exports = {
  getProductTable,
  getNplTable,
  getBomTable,
  getAllTables,
  updateProductInTable,
  updateNplInTable,
  updateBomInTable,
  confirmAllTables
};
