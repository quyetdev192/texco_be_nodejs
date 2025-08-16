const express = require('express');
const userController = require('./user.controller');
const { verifyToken, requireAuth, requireRole } = require('../../middlewares/auth.middleware');
const { verifySignature } = require('../../middlewares/signature.middleware');
const { setLanguage, addLanguageInfo } = require('../../middlewares/i18n.middleware');

const router = express.Router();

router.use(setLanguage);
router.use(addLanguageInfo);
router.use(verifySignature);

router.post('/register', userController.createUser);
router.post('/login', userController.login);


router.use(verifyToken);
router.use(requireAuth);


router.get('/', userController.getUsers);


router.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'User service is healthy',
        timestamp: new Date().toISOString(),
    });
});

module.exports = router; 