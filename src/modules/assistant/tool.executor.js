const mongoose = require('mongoose');
const embeddingService = require('./embedding.service');
const { allowedSchema } = require('./assistant.config'); // Import thêm allowedSchema

// Import tất cả các model bạn muốn AI có thể truy cập ở đây
// Việc này đảm bảo Mongoose đã đăng ký schema trước khi tool được chạy
require('../user/user.model');
// require('../product/product.model'); // Ví dụ

class ToolExecutor {
    /**
     * Thực thi công cụ RAG - Semantic Search
     */
    async executeKnowledgeBaseSearch(query) {
        // ... code của hàm này giữ nguyên
        
        const User = mongoose.model('User');
        const queryVector = await embeddingService.generateEmbedding(query);
        const userResults = await User.aggregate([
            { $vectorSearch: { index: 'vector_index_users', path: 'userVector', queryVector, numCandidates: 50, limit: 3 } },
            { $project: { _id: 0, firstName: 1, lastName: 1, email: 1, score: { $meta: "vectorSearchScore" } } }
        ]);
        return { userResults };
    }

    /**
     * Thực thi truy vấn MongoDB trực tiếp và chính xác
     */
    async executeDatabaseQuery({ collection, filter, projection, sort, limit }) {
        // SỬA LẠI LOGIC Ở ĐÂY
        // 1. Tra cứu cấu hình an toàn từ tên collection mà AI gửi

        const config = allowedSchema[collection];
        if (!config) {
            throw new Error(`Collection '${collection}' không được phép truy vấn.`);
        }

        // 2. Lấy tên Model chính xác từ config
        const model = mongoose.model(config.collectionName);

        // 3. Thực thi truy vấn như cũ
        const results = await model
            .find(filter || {})
            .select(projection || {})
            .sort(sort || {})
            .limit(limit || 5);

        return results;
    }
}

module.exports = new ToolExecutor();