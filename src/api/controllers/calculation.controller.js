const { asyncHandler } = require('../../core/middlewares/error.middleware');
const constants = require('../../core/utils/constants');
const calculationHandle = require('../handles/calculation.handle');

/**
 * Lấy bảng Chi tiết Tiêu hao NPL (gộp Consumption + FIFO Allocation)
 * Trả về đúng 15 cột theo yêu cầu
 * GET /api/v1/co/lohang/:lohangDraftId/consumption
 */
const getConsumptionTable = asyncHandler(async (req, res) => {
  const { lohangDraftId } = req.params;
  const result = await calculationHandle.getConsumptionTable(lohangDraftId);

  return res.status(constants.HTTP_STATUS.OK).json({
    success: true,
    errorCode: 0,
    message: 'Thành công',
    data: result
  });
});

/**
 * Lấy bảng Phân bổ FIFO (Stock Allocation Table) - Giữ lại để backward compatible
 * GET /api/v1/co/lohang/:lohangDraftId/allocations
 */
const getAllocationTable = asyncHandler(async (req, res) => {
  const { lohangDraftId } = req.params;
  const result = await calculationHandle.getConsumptionTable(lohangDraftId);

  return res.status(constants.HTTP_STATUS.OK).json({
    success: true,
    errorCode: 0,
    message: 'Thành công',
    data: result
  });
});

module.exports = {
  getConsumptionTable,
  getAllocationTable
};
