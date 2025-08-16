const express = require('express');
const assistantController = require('./assistant.controller');
const { verifySignature } = require('../../middlewares/signature.middleware');

const router = express.Router();

// Áp dụng các middleware tương tự như các route khác của bạn
router.use(verifySignature);

router.post('/ask', assistantController.ask);

module.exports = router;