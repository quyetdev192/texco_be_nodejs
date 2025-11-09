const { asyncHandler } = require('../../core/middlewares/error.middleware');
const constants = require('../../core/utils/constants');
const circularHandle = require('../handles/circular.handle');

const createCircular = asyncHandler(async (req, res) => {
  const userId = req.userId;
  const { name, formType, effectiveDate, notes, files } = req.body || {};
  const result = await circularHandle.createCircularBundle({ name, formType, effectiveDate, notes, files }, userId);
  return res.status(constants.HTTP_STATUS.CREATED).json({ success: true, errorCode: 0, message: 'Thành công', data: result });
});

const listCirculars = asyncHandler(async (req, res) => {
  const result = await circularHandle.listCircularBundles(req.query || {});
  return res.status(constants.HTTP_STATUS.OK).json({ success: true, errorCode: 0, message: 'Thành công', data: result });
});

const getCircular = asyncHandler(async (req, res) => {
  const result = await circularHandle.getCircularBundle(req.params.id);
  return res.status(constants.HTTP_STATUS.OK).json({ success: true, errorCode: 0, message: 'Thành công', data: result });
});

const activateCircular = asyncHandler(async (req, res) => {
  const result = await circularHandle.activateCircular(req.params.id);
  return res.status(constants.HTTP_STATUS.OK).json({ success: true, errorCode: 0, message: 'Kích hoạt thành công', data: result });
});

const archiveCircular = asyncHandler(async (req, res) => {
  const result = await circularHandle.archiveCircular(req.params.id);
  return res.status(constants.HTTP_STATUS.OK).json({ success: true, errorCode: 0, message: 'Đã lưu trữ', data: result });
});

const importPL1 = asyncHandler(async (req, res) => {
  const { fileUrl, formType } = req.body || {};
  const result = await circularHandle.importPL1FromExcel(req.params.id, fileUrl, formType);
  return res.status(constants.HTTP_STATUS.OK).json({ success: true, errorCode: 0, message: 'Import thành công', data: result });
});

const exportPL1Errors = asyncHandler(async (req, res) => {
  const { fileUrl, formType } = req.body || {};
  const { filename, buffer, contentType } = await circularHandle.exportPL1ErrorsExcel(req.params.id, fileUrl, formType);
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.status(constants.HTTP_STATUS.OK).send(buffer);
});

const listChapters = asyncHandler(async (req, res) => {
  const result = await circularHandle.listChapters(req.query || {});
  return res.status(constants.HTTP_STATUS.OK).json({ success: true, errorCode: 0, message: 'Thành công', data: result });
});

const listOriginRules = asyncHandler(async (req, res) => {
  const result = await circularHandle.listOriginRules(req.query || {});
  return res.status(constants.HTTP_STATUS.OK).json({ success: true, errorCode: 0, message: 'Thành công', data: result });
});

const getOriginRule = asyncHandler(async (req, res) => {
  const result = await circularHandle.getOriginRuleById(req.params.id);
  return res.status(constants.HTTP_STATUS.OK).json({ success: true, errorCode: 0, message: 'Thành công', data: result });
});

module.exports = {
  createCircular,
  listCirculars,
  getCircular,
  activateCircular,
  archiveCircular,
  importPL1,
  exportPL1Errors,
  listChapters,
  listOriginRules,
  getOriginRule
};
