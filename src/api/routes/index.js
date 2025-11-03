const express = require('express');
const router = express.Router();

const v1Routes = require('./v1');
const v2Routes = require('./v2');

router.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

router.use('/v1', v1Routes);
router.use('/v2', v2Routes);

router.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        errorCode: 1,
        message: 'API không tồn tại! Vui lòng kiểm tra lại đường dẫn.',
        data: null
    });
});

module.exports = router;