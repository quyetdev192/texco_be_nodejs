const express = require('express');
const router = express.Router();
const userController = require('../../controllers/user.controller');
const { verifyToken, requireRole } = require('../../../core/middlewares/auth.middleware');
const documentController = require('../../controllers/document.controller');
const coProcessController = require('../../controllers/coProcess.controller');
const extractedTablesController = require('../../controllers/extractedTables.controller');
const calculationController = require('../../controllers/calculation.controller');
const ctcReportController = require('../../controllers/ctcReport.controller');

router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', version: 'v1' });
});

router.post('/user/register', userController.create);
router.post('/user/login', userController.login);
router.get('/user/profile', verifyToken, userController.getProfile);
router.put('/user/profile', verifyToken, userController.updateProfile);

router.get('/users', verifyToken, requireRole('STAFF'), userController.listUsers);
router.post('/users', verifyToken, requireRole('STAFF'), userController.createUser);
router.put('/users/:id', verifyToken, requireRole('STAFF'), userController.updateUser);
router.delete('/users/:id', verifyToken, requireRole('STAFF'), userController.deleteUser);

router.get('/documents', verifyToken, requireRole('SUPPLIER'), documentController.supplierList);
router.post('/documents', verifyToken, requireRole('SUPPLIER'), documentController.supplierCreate);
router.put('/documents/:bundleId', verifyToken, requireRole('SUPPLIER'), documentController.supplierUpdate);

router.get('/review/documents', verifyToken, requireRole('STAFF'), documentController.staffList);
router.put('/review/documents/:bundleId/review', verifyToken, requireRole('STAFF'), documentController.staffReview);
router.put('/review/documents/:bundleId/ocr-retry/:documentId', verifyToken, requireRole('STAFF'), documentController.staffRetryOcr);
router.put('/review/documents/:bundleId/ocr-retry', verifyToken, requireRole('STAFF'), documentController.staffRetryOcrForBundle);
router.post('/review/documents/:bundleId/add', verifyToken, requireRole('STAFF'), documentController.staffAddDocuments);
router.put('/review/documents/:bundleId/documents/:documentId', verifyToken, requireRole('STAFF'), coProcessController.updateDocument);
router.delete('/review/documents/:bundleId/documents/:documentId', verifyToken, requireRole('STAFF'), coProcessController.deleteDocument);

router.get('/co/list', verifyToken, requireRole('STAFF'), coProcessController.listCO);
router.post('/co/create', verifyToken, requireRole('STAFF'), coProcessController.createCO);
router.get('/co/supported-combinations', verifyToken, requireRole('STAFF'), coProcessController.getSupportedCombinations);

router.post('/co/lohang/:id/continue', verifyToken, requireRole('STAFF'), coProcessController.continueToNextStep);
router.put('/co/lohang/:lohangDraftId/setup', verifyToken, requireRole('STAFF'), coProcessController.setupFormAndCriteria);
router.post('/co/lohang/:id/setup-and-extract', verifyToken, requireRole('STAFF'), coProcessController.setupAndExtract);
router.post('/co/lohang/:id/extract-tables', verifyToken, requireRole('STAFF'), coProcessController.triggerExtractTables);
router.post('/co/lohang/:id/retry-extraction', verifyToken, requireRole('STAFF'), coProcessController.retryExtraction);
router.post('/co/lohang/:id/re-extract-table', verifyToken, requireRole('STAFF'), coProcessController.reExtractTable);
router.post('/co/lohang/:lohangDraftId/calculate-consumption', verifyToken, requireRole('STAFF'), coProcessController.calculateConsumption);
router.get('/co/lohang/:lohangDraftId/consumption', verifyToken, requireRole('STAFF'), calculationController.getConsumptionTable);
router.get('/co/lohang/:lohangDraftId/allocations', verifyToken, requireRole('STAFF'), calculationController.getAllocationTable);
router.get('/co/lohang/:lohangDraftId', verifyToken, requireRole('STAFF'), coProcessController.getLohangDetail);
router.get('/co/lohang/:lohangDraftId/tables', verifyToken, requireRole('STAFF'), extractedTablesController.getAllTables);
router.get('/co/lohang/:lohangDraftId/tables/products', verifyToken, requireRole('STAFF'), extractedTablesController.getProductTable);
router.get('/co/lohang/:lohangDraftId/tables/npl', verifyToken, requireRole('STAFF'), extractedTablesController.getNplTable);
router.get('/co/lohang/:lohangDraftId/tables/bom', verifyToken, requireRole('STAFF'), extractedTablesController.getBomTable);
router.put('/co/lohang/:lohangDraftId/tables/products/:productIndex', verifyToken, requireRole('STAFF'), extractedTablesController.updateProductInTable);
router.put('/co/lohang/:lohangDraftId/tables/npl/:nplIndex', verifyToken, requireRole('STAFF'), extractedTablesController.updateNplInTable);
router.put('/co/lohang/:lohangDraftId/tables/bom/:bomIndex', verifyToken, requireRole('STAFF'), extractedTablesController.updateBomInTable);
router.put('/co/lohang/:lohangDraftId/tables/confirm', verifyToken, requireRole('STAFF'), extractedTablesController.confirmAllTables);
router.post('/co/lohang/:lohangDraftId/ctc-reports', verifyToken, requireRole('STAFF'), ctcReportController.generateCTCReports);
router.post('/co/lohang/:lohangDraftId/ctc-reports/retry', verifyToken, requireRole('STAFF'), ctcReportController.retryCTCReports);
router.get('/co/lohang/:lohangDraftId/ctc-reports', verifyToken, requireRole('STAFF'), ctcReportController.getCTCReports);
router.delete('/co/lohang/:lohangDraftId/ctc-reports/:skuCode', verifyToken, requireRole('STAFF'), ctcReportController.deleteCTCReport);
router.post('/co/lohang/:lohangDraftId/complete', verifyToken, requireRole('STAFF'), ctcReportController.completeCOProcess);
router.post('/co/lohang/:lohangDraftId/back-to-step/:stepNumber', verifyToken, requireRole('STAFF'), ctcReportController.backToStep);
router.get('/co/listbct', verifyToken, requireRole('MOIT'), coProcessController.listCO);


module.exports = router;