const { asyncHandler } = require('../../core/middlewares/error.middleware');
const constants = require('../../core/utils/constants');
const calculationHandle = require('../handles/calculation.handle');

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
