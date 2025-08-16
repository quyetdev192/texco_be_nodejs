const { GoogleGenerativeAI } = require("@google/generative-ai");
const logger = require('../../config/logger.config');
const { availableTools, systemPrompt } = require('./assistant.config');
const toolExecutor = require('./tool.executor');

// Khởi tạo Gemini Client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
// Dùng model 'flash' để cân bằng giữa tốc độ, chi phí và hạn ngạch free-tier
const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    tools: [availableTools.knowledgeBaseSearch, availableTools.databaseQuery]
});

class AssistantService {
    /**
     * Nhận câu hỏi, bắt đầu một cuộc hội thoại với AI Agent,
     * và điều phối việc thực thi các công cụ cho đến khi có câu trả lời cuối cùng.
     */
    async ask(userQuestion) {
        try {
            const chat = model.startChat();

            // BƯỚC 1: Tạo prompt đầy đủ bao gồm chỉ dẫn hệ thống và câu hỏi của người dùng
            const fullPrompt = `${systemPrompt}\n\nCâu hỏi của người dùng: "${userQuestion}"`;

            let response = await chat.sendMessage(fullPrompt);

            // BƯỚC 2: Bắt đầu vòng lặp suy luận và hành động của AI Agent
            while (true) {
                const calls = response.response.functionCalls();

                // Điều kiện dừng: Nếu AI không yêu cầu chạy thêm công cụ nào, nó đã sẵn sàng trả lời
                if (!calls || calls.length === 0) {
                    break;
                }

                logger.info(`Agent requests to call ${calls.length} tools...`);

                // BƯỚC 3: Thực thi các công cụ mà AI yêu cầu
                const toolExecutionResults = await Promise.all(
                    calls.map(async (call) => {
                        const { name, args } = call;
                        let result;

                        logger.info(`Executing tool: ${name}`, { args });

                        if (name === 'knowledgeBaseSearch') {
                            result = await toolExecutor.executeKnowledgeBaseSearch(args.query);
                        } else if (name === 'databaseQuery') {
                            result = await toolExecutor.executeDatabaseQuery(args);
                        } else {
                            result = { error: `Công cụ ${name} không được hỗ trợ.` };
                        }

                        // Định dạng kết quả để gửi lại cho AI
                        return {
                            functionResponse: {
                                name,
                                response: { result },
                            },
                        };
                    })
                );

                // BƯỚC 4: Gửi kết quả từ các công cụ ngược lại cho AI để nó tiếp tục suy luận
                response = await chat.sendMessage(toolExecutionResults);
            }

            // BƯỚC 5: Lấy và trả về câu trả lời cuối cùng bằng văn bản
            const finalAnswer = response.response.text();
            logger.info('Agent returned final answer.', { answer: finalAnswer });

            return { answer: finalAnswer };

        } catch (error) {
            logger.error('Error in AssistantService.ask (Agent)', { error: error.message });
            throw new Error('Đã có lỗi xảy ra khi xử lý yêu cầu của bạn.');
        }
    }
}

module.exports = new AssistantService();