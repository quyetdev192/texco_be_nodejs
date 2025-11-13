const express = require('express');
const router = express.Router();

const {
  generateCTCReports,
  getCTCReports,
  deleteCTCReport
} = require('../controllers/ctcReport.controller');

// Middleware xác thực (nếu có)
// const { authenticate } = require('../middlewares/auth.middleware');

/**
 * @route POST /api/v1/co/lohang/:lohangDraftId/ctc-reports
 * @desc Tạo bảng kê CTC cho tất cả SKU trong lô hàng
 * @access Private
 */
router.post('/:lohangDraftId/ctc-reports', generateCTCReports);

/**
 * @route GET /api/v1/co/lohang/:lohangDraftId/ctc-reports
 * @desc Lấy danh sách bảng kê CTC đã tạo
 * @access Private
 */
router.get('/:lohangDraftId/ctc-reports', getCTCReports);

/**
 * @route DELETE /api/v1/co/lohang/:lohangDraftId/ctc-reports/:skuCode
 * @desc Xóa bảng kê CTC của một SKU
 * @access Private
 */
router.delete('/:lohangDraftId/ctc-reports/:skuCode', deleteCTCReport);

module.exports = router;
