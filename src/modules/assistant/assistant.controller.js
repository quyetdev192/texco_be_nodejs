const assistantService = require('./assistant.service');
const { asyncHandler } = require('../../middlewares/error.middleware');
const constants = require('../../utils/constants');

class AssistantController {
    ask = asyncHandler(async (req, res) => {
        const { question } = req.body;

        if (!question) {
            return res.status(constants.HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: 'Câu hỏi không được để trống.'
            });
        }

        const result = await assistantService.ask(question);

        res.status(constants.HTTP_STATUS.OK).json({
            success: true,
            data: result
        });
    });
}

module.exports = new AssistantController();