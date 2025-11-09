const express = require('express');
const router = express.Router();
const userController = require('../../controllers/user.controller');
const { verifyToken, requireRole } = require('../../../core/middlewares/auth.middleware');
const documentController = require('../../controllers/document.controller');
const circularController = require('../../controllers/circular.controller');
const coController = require('../../controllers/co.controller');

router.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', version: 'v1' });
});

router.post('/user/register', userController.create);
router.post('/user/login', userController.login);
router.get('/user/profile', verifyToken, userController.getProfile);
router.put('/user/profile', verifyToken, userController.updateProfile);

// Circular bundles (ADMIN)
router.post('/circulars', verifyToken, requireRole('ADMIN'), circularController.createCircular);
router.get('/circulars', verifyToken, requireRole('ADMIN'), circularController.listCirculars);
router.get('/circulars/:id', verifyToken, requireRole('ADMIN'), circularController.getCircular);
router.put('/circulars/:id/activate', verifyToken, requireRole('ADMIN'), circularController.activateCircular);
router.put('/circulars/:id/archive', verifyToken, requireRole('ADMIN'), circularController.archiveCircular);
router.post('/circulars/:id/import-pl1', verifyToken, requireRole('ADMIN'), circularController.importPL1);
router.post('/circulars/:id/pl1-errors', verifyToken, requireRole('ADMIN'), circularController.exportPL1Errors);

// Search (any logged-in user)
router.get('/hs-chapters', verifyToken, circularController.listChapters);
router.get('/origin-rules', verifyToken, circularController.listOriginRules);
router.get('/origin-rules/:id', verifyToken, circularController.getOriginRule);

// User management (ADMIN only)
router.get('/users', verifyToken, requireRole('ADMIN'), userController.listUsers);
router.get('/users/:id', verifyToken, requireRole('ADMIN'), userController.getUser);
router.post('/users', verifyToken, requireRole('ADMIN'), userController.createUser);
router.put('/users/:id', verifyToken, requireRole('ADMIN'), userController.updateUser);
router.delete('/users/:id', verifyToken, requireRole('ADMIN'), userController.deleteUser);

// Documents - Giai đoạn 1 & 2
// Supplier (NCC) - 3 APIs
router.get('/documents', verifyToken, requireRole('SUPPLIER'), documentController.supplierList);
router.post('/documents', verifyToken, requireRole('SUPPLIER'), documentController.supplierCreate);
router.put('/documents/:bundleId', verifyToken, requireRole('SUPPLIER'), documentController.supplierUpdate);

// Staff (C/O) - 2 APIs
router.get('/review/documents', verifyToken, requireRole('STAFF'), documentController.staffList);
router.put('/review/documents/:bundleId/review', verifyToken, requireRole('STAFF'), documentController.staffReview);
// Retry OCR for a specific document in a bundle
router.put('/review/documents/:bundleId/ocr-retry/:documentId', verifyToken, requireRole('STAFF'), documentController.staffRetryOcr);
// Retry OCR for all failed documents (REJECTED) in a bundle
router.put('/review/documents/:bundleId/ocr-retry', verifyToken, requireRole('STAFF'), documentController.staffRetryOcrForBundle);

// C/O Application Workflow (STAFF) - New Flow
// Step 3.1: Create C/O from Bundle (DRAFT status)
router.get('/co-bundles', verifyToken, requireRole('STAFF'), coController.listBundles);
router.post('/co-applications', verifyToken, requireRole('STAFF'), coController.createCo);
router.get('/co-applications', verifyToken, requireRole('STAFF'), coController.listCos);
router.get('/co-applications/:id', verifyToken, requireRole('STAFF'), coController.getCo);

// Step 3.2: Upload additional documents with real-time OCR
router.post('/co-applications/:id/upload-ocr', verifyToken, requireRole('STAFF'), coController.uploadAndOCR);
router.get('/co-applications/:id/ocr-status', verifyToken, requireRole('STAFF'), coController.checkOcrStatus);
router.post('/co-applications/:id/retry-ocr', verifyToken, requireRole('STAFF'), coController.retryOcr);

// Step 3.3: Select Form Type (FORM_B or FORM_E)
router.post('/co-applications/:id/select-form-type', verifyToken, requireRole('STAFF'), coController.selectFormType);

// Step 3.4 FORM_B: Auto-fill basic info
router.post('/co-applications/:id/auto-fill-form-b', verifyToken, requireRole('STAFF'), coController.autoFillFormB);

// Step 3.4 FORM_E: AI lookup rules from HS code
router.post('/co-applications/:id/ai-lookup-rules', verifyToken, requireRole('STAFF'), coController.aiLookupRules);

// Step 3.5 FORM_E: Select criteria
router.post('/co-applications/:id/select-criteria', verifyToken, requireRole('STAFF'), coController.selectCriteria);

// Step 3.6 FORM_E: AI generate materials breakdown (with optional correction notes for Step 3.7)
router.post('/co-applications/:id/ai-generate-breakdown', verifyToken, requireRole('STAFF'), coController.aiGenerateMaterialsBreakdown);

// Legacy endpoints (kept for backward compatibility)
router.post('/co-applications/:id/match-rules', verifyToken, requireRole('STAFF'), coController.matchRules);
router.post('/co-applications/:id/apply-criterion', verifyToken, requireRole('STAFF'), coController.applyCriterion);

// Step 4: Export PDF
router.post('/co-applications/:id/export-pdf', verifyToken, requireRole('STAFF'), coController.exportPDF);

module.exports = router;