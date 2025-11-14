const express = require('express');
const router = express.Router();
const userController = require('../../controllers/user.controller');
const { verifyToken, requireRole } = require('../../../core/middlewares/auth.middleware');
const documentController = require('../../controllers/document.controller');
const coProcessController = require('../../controllers/coProcess.controller');
const extractedTablesController = require('../../controllers/extractedTables.controller');
const calculationController = require('../../controllers/calculation.controller');

router.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', version: 'v1' });
});

router.post('/user/register', userController.create);
router.post('/user/login', userController.login);
router.get('/user/profile', verifyToken, userController.getProfile);
router.put('/user/profile', verifyToken, userController.updateProfile);

// User management (STAFF only)
router.get('/users', verifyToken, requireRole('STAFF'), userController.listUsers);
router.post('/users', verifyToken, requireRole('STAFF'), userController.createUser);
router.put('/users/:id', verifyToken, requireRole('STAFF'), userController.updateUser);
router.delete('/users/:id', verifyToken, requireRole('STAFF'), userController.deleteUser);

// Documents - Giai đoạn 1 & 2
// Supplier (NCC) - 3 APIs
router.get('/documents', verifyToken, requireRole('SUPPLIER'), documentController.supplierList);
router.post('/documents', verifyToken, requireRole('SUPPLIER'), documentController.supplierCreate);
router.put('/documents/:bundleId', verifyToken, requireRole('SUPPLIER'), documentController.supplierUpdate);

// Staff (C/O) - 5 APIs
router.get('/review/documents', verifyToken, requireRole('STAFF'), documentController.staffList);
router.put('/review/documents/:bundleId/review', verifyToken, requireRole('STAFF'), documentController.staffReview);
// Retry OCR for a specific document in a bundle
router.put('/review/documents/:bundleId/ocr-retry/:documentId', verifyToken, requireRole('STAFF'), documentController.staffRetryOcr);
// Retry OCR for all failed documents (REJECTED) in a bundle
router.put('/review/documents/:bundleId/ocr-retry', verifyToken, requireRole('STAFF'), documentController.staffRetryOcrForBundle);
// STAFF bổ sung thêm file vào bundle (kể cả sau khi đã duyệt)
router.post('/review/documents/:bundleId/add', verifyToken, requireRole('STAFF'), documentController.staffAddDocuments);

// Document Management - Update/Delete
router.put('/review/documents/:bundleId/documents/:documentId', verifyToken, requireRole('STAFF'), coProcessController.updateDocument);
router.delete('/review/documents/:bundleId/documents/:documentId', verifyToken, requireRole('STAFF'), coProcessController.deleteDocument);

// C/O Processing - Luồng mới
// BƯỚC 1: Xem danh sách C/O (draft + hoàn thành)
router.get('/co/list', verifyToken, requireRole('STAFF'), coProcessController.listCO);

// BƯỚC 2: Tạo C/O draft từ bundle (chỉ cần bundleId)
router.post('/co/create', verifyToken, requireRole('STAFF'), coProcessController.createCO);

// BƯỚC 3: Upload bổ sung file vào bundle (đã có ở trên - staffAddDocuments)
// BƯỚC 4: Chọn Form E/B và Tiêu chí// Continue to next step (Chuyển bước)
router.post('/co/lohang/:id/continue',
  verifyToken,
  requireRole('STAFF'),
  coProcessController.continueToNextStep
);

// BƯỚC 2: Lấy danh sách Form và Tiêu chí được hỗ trợ
router.get('/co/supported-combinations', verifyToken, requireRole('STAFF'), coProcessController.getSupportedCombinations);

// BƯỚC 3: Chọn Form và Tiêu chí
router.put('/co/lohang/:lohangDraftId/setup', verifyToken, requireRole('STAFF'), coProcessController.setupFormAndCriteria);

// BƯỚC 3 (Tối ưu): Setup Form + Extract cùng lúc - CHỈ CẦN 1 NÚT BẤM
router.post('/co/lohang/:id/setup-and-extract',
  verifyToken,
  requireRole('STAFF'),
  coProcessController.setupAndExtract
);

// BƯỚC 4: Trigger trích xuất và tổng hợp dữ liệu
router.post('/co/lohang/:id/extract-tables',
  verifyToken,
  requireRole('STAFF'),
  coProcessController.triggerExtractTables
);

// Retry extraction khi có lỗi
router.post('/co/lohang/:id/retry-extraction',
  verifyToken,
  requireRole('STAFF'),
  coProcessController.retryExtraction
);

// Re-extract một bảng cụ thể với user note
router.post('/co/lohang/:id/re-extract-table',
  verifyToken,
  requireRole('STAFF'),
  coProcessController.reExtractTable
);

// BƯỚC 4: Tính toán tiêu hao và phân bổ FIFO
router.post('/co/lohang/:lohangDraftId/calculate-consumption',
  verifyToken,
  requireRole('STAFF'),
  coProcessController.calculateConsumption
);

// Lấy bảng Tiêu hao (Consumption Table)
router.get('/co/lohang/:lohangDraftId/consumption',
  verifyToken,
  requireRole('STAFF'),
  calculationController.getConsumptionTable
);

// Lấy bảng Phân bổ FIFO (Allocation Table)
router.get('/co/lohang/:lohangDraftId/allocations',
  verifyToken,
  requireRole('STAFF'),
  calculationController.getAllocationTable
);

// Lấy chi tiết lô hàng (dùng cho nút "Tiếp tục")
router.get('/co/lohang/:lohangDraftId', verifyToken, requireRole('STAFF'), coProcessController.getLohangDetail);

// ===== EXTRACTED TABLES APIs - Xem và chỉnh sửa bảng tổng hợp =====
// Lấy tất cả bảng tổng hợp
router.get('/co/lohang/:lohangDraftId/tables', verifyToken, requireRole('STAFF'), extractedTablesController.getAllTables);

// Lấy từng bảng riêng lẻ
router.get('/co/lohang/:lohangDraftId/tables/products', verifyToken, requireRole('STAFF'), extractedTablesController.getProductTable);
router.get('/co/lohang/:lohangDraftId/tables/npl', verifyToken, requireRole('STAFF'), extractedTablesController.getNplTable);
router.get('/co/lohang/:lohangDraftId/tables/bom', verifyToken, requireRole('STAFF'), extractedTablesController.getBomTable);

// Cập nhật từng item trong bảng
router.put('/co/lohang/:lohangDraftId/tables/products/:productIndex', verifyToken, requireRole('STAFF'), extractedTablesController.updateProductInTable);
router.put('/co/lohang/:lohangDraftId/tables/npl/:nplIndex', verifyToken, requireRole('STAFF'), extractedTablesController.updateNplInTable);
router.put('/co/lohang/:lohangDraftId/tables/bom/:bomIndex', verifyToken, requireRole('STAFF'), extractedTablesController.updateBomInTable);

// Xác nhận tất cả bảng
router.put('/co/lohang/:lohangDraftId/tables/confirm', verifyToken, requireRole('STAFF'), extractedTablesController.confirmAllTables);

// ===== CTC REPORTS APIs - Bảng kê CTC =====
const ctcReportController = require('../../controllers/ctcReport.controller');

// Tạo bảng kê CTC cho tất cả SKU
router.post('/co/lohang/:lohangDraftId/ctc-reports', 
  verifyToken, 
  requireRole('STAFF'), 
  ctcReportController.generateCTCReports
);

// Retry tạo bảng kê CTC (khi có lỗi ở bước 4)
router.post('/co/lohang/:lohangDraftId/ctc-reports/retry', 
  verifyToken, 
  requireRole('STAFF'), 
  ctcReportController.retryCTCReports
);

// Lấy danh sách bảng kê CTC đã tạo
router.get('/co/lohang/:lohangDraftId/ctc-reports', 
  verifyToken, 
  requireRole('STAFF'), 
  ctcReportController.getCTCReports
);

// Xóa bảng kê CTC của một SKU
router.delete('/co/lohang/:lohangDraftId/ctc-reports/:skuCode', 
  verifyToken, 
  requireRole('STAFF'), 
  ctcReportController.deleteCTCReport
);

// Xác nhận hoàn thành hồ sơ C/O
router.post('/co/lohang/:lohangDraftId/complete', 
  verifyToken, 
  requireRole('STAFF'), 
  ctcReportController.completeCOProcess
);

// Quay lại step trước để chỉnh sửa
router.post('/co/lohang/:lohangDraftId/back-to-step/:stepNumber', 
  verifyToken, 
  requireRole('STAFF'), 
  ctcReportController.backToStep
);

// Download Excel report từ Cloudinary với đúng MIME type
router.get('/co/reports/download/:publicId', 
  verifyToken, 
  requireRole('STAFF'), 
  ctcReportController.downloadExcelReport
);

module.exports = router;