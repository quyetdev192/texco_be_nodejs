const express = require('express');
const router = express.Router();
const userController = require('../../controllers/user.controller');

router.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', version: 'v1' });
});

router.post('/user/register', userController.create);
router.post('/user/login', userController.login);

module.exports = router;