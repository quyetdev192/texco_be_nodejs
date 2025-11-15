const express = require('express');
const router = express.Router();

const { generateCTCReports, getCTCReports,
  deleteCTCReport
} = require('../controllers/ctcReport.controller');

router.post('/:lohangDraftId/ctc-reports', generateCTCReports);

router.get('/:lohangDraftId/ctc-reports', getCTCReports);

router.delete('/:lohangDraftId/ctc-reports/:skuCode', deleteCTCReport);

module.exports = router;
