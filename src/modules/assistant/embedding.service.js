const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
// Dùng model embedding mới nhất và hiệu quả nhất của Google
const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });

class EmbeddingService {
    /**
     * Chuyển một chuỗi văn bản thành vector.
     */
    async generateEmbedding(text) {
        try {
            const result = await embeddingModel.embedContent(text);
            return result.embedding.values;
        } catch (error) {
            console.error('Lỗi khi tạo embedding:', error);
            throw new Error('Không thể tạo embedding.');
        }
    }
}

module.exports = new EmbeddingService();