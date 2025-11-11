/**
 * Controller cho Extracted Tables APIs
 * Nhân viên xem và chỉnh sửa các bảng tổng hợp dữ liệu
 */

const { asyncHandler } = require('../../core/middlewares/error.middleware');
const constants = require('../../core/utils/constants');
const extractedTablesHandle = require('../handles/extractedTables.handle');

/**
 * Lấy Bảng Tổng hợp Sản phẩm Xuất khẩu
 * GET /api/v1/co/lohang/:lohangDraftId/tables/products
 */
const getProductTable = asyncHandler(async (req, res) => {
  const { lohangDraftId } = req.params;
  const result = await extractedTablesHandle.getProductTable(lohangDraftId);
  
  return res.status(constants.HTTP_STATUS.OK).json({
    success: true,
    errorCode: 0,
    message: 'Lấy bảng sản phẩm thành công',
    data: result
  });
});

/**
 * Lấy Bảng Nhập kho NPL
 * GET /api/v1/co/lohang/:lohangDraftId/tables/npl
 */
const getNplTable = asyncHandler(async (req, res) => {
  const { lohangDraftId } = req.params;
  const result = await extractedTablesHandle.getNplTable(lohangDraftId);
  
  return res.status(constants.HTTP_STATUS.OK).json({
    success: true,
    errorCode: 0,
    message: 'Lấy bảng NPL thành công',
    data: result
  });
});

/**
 * Lấy Bảng Định mức (BOM)
 * GET /api/v1/co/lohang/:lohangDraftId/tables/bom
 */
const getBomTable = asyncHandler(async (req, res) => {
  const { lohangDraftId } = req.params;
  const result = await extractedTablesHandle.getBomTable(lohangDraftId);
  
  return res.status(constants.HTTP_STATUS.OK).json({
    success: true,
    errorCode: 0,
    message: 'Lấy bảng BOM thành công',
    data: result
  });
});

/**
 * Lấy tất cả bảng tổng hợp
 * GET /api/v1/co/lohang/:lohangDraftId/tables
 */
const getAllTables = asyncHandler(async (req, res) => {
  const { lohangDraftId } = req.params;
  const result = await extractedTablesHandle.getAllTables(lohangDraftId);
  
  return res.status(constants.HTTP_STATUS.OK).json({
    success: true,
    errorCode: 0,
    message: 'Lấy tất cả bảng tổng hợp thành công',
    data: result
  });
});

/**
 * Cập nhật 1 sản phẩm trong bảng sản phẩm
 * PUT /api/v1/co/lohang/:lohangDraftId/tables/products/:productIndex
 */
const updateProductInTable = asyncHandler(async (req, res) => {
  const { lohangDraftId, productIndex } = req.params;
  const updatedProduct = req.body;
  const userId = req.userId;
  
  const result = await extractedTablesHandle.updateProductInTable(
    lohangDraftId,
    productIndex,
    updatedProduct,
    userId
  );
  
  return res.status(constants.HTTP_STATUS.OK).json({
    success: true,
    errorCode: 0,
    message: 'Cập nhật sản phẩm thành công',
    data: result
  });
});

/**
 * Cập nhật 1 NPL trong bảng NPL
 * PUT /api/v1/co/lohang/:lohangDraftId/tables/npl/:nplIndex
 */
const updateNplInTable = asyncHandler(async (req, res) => {
  const { lohangDraftId, nplIndex } = req.params;
  const updatedNpl = req.body;
  const userId = req.userId;
  
  const result = await extractedTablesHandle.updateNplInTable(
    lohangDraftId,
    nplIndex,
    updatedNpl,
    userId
  );
  
  return res.status(constants.HTTP_STATUS.OK).json({
    success: true,
    errorCode: 0,
    message: 'Cập nhật NPL thành công',
    data: result
  });
});

/**
 * Cập nhật định mức trong bảng BOM
 * PUT /api/v1/co/lohang/:lohangDraftId/tables/bom/:bomIndex
 */
const updateBomInTable = asyncHandler(async (req, res) => {
  const { lohangDraftId, bomIndex } = req.params;
  const updatedBom = req.body;
  const userId = req.userId;
  
  const result = await extractedTablesHandle.updateBomInTable(
    lohangDraftId,
    bomIndex,
    updatedBom,
    userId
  );
  
  return res.status(constants.HTTP_STATUS.OK).json({
    success: true,
    errorCode: 0,
    message: 'Cập nhật BOM thành công',
    data: result
  });
});

/**
 * Xác nhận tất cả bảng tổng hợp
 * PUT /api/v1/co/lohang/:lohangDraftId/tables/confirm
 */
const confirmAllTables = asyncHandler(async (req, res) => {
  const { lohangDraftId } = req.params;
  const result = await extractedTablesHandle.confirmAllTables(lohangDraftId);
  
  return res.status(constants.HTTP_STATUS.OK).json({
    success: true,
    errorCode: 0,
    message: result.message,
    data: result
  });
});

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
