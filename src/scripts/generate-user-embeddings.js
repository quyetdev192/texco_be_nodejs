// Tạo thư mục 'scripts' ở gốc dự án nếu chưa có
require('dotenv').config({ path: '.env.dev' });
const mongoose = require('mongoose');
const User = require('../src/modules/user/user.model');
const embeddingService = require('../src/modules/assistant/embedding.service');

async function generateEmbeddingsForExistingUsers() {
    // THAY YOUR_MONGODB_URI BẰNG TÊN BIẾN MÔI TRƯỜNG CỦA BẠN
    if (!process.env.YOUR_MONGODB_URI) {
        console.error("Lỗi: Vui lòng cung cấp chuỗi kết nối MongoDB trong file .env");
        return;
    }

    await mongoose.connect(process.env.YOUR_MONGODB_URI);
    console.log('Đã kết nối tới MongoDB.');

    const usersToUpdate = await User.find({ userVector: { $exists: false } });
    console.log(`Tìm thấy ${usersToUpdate.length} người dùng cần cập nhật vector.`);

    for (const user of usersToUpdate) {
        try {
            const representativeText = `Tên: ${user.firstName} ${user.lastName}, email: ${user.email}`;
            const vector = await embeddingService.generateEmbedding(representativeText);
            user.userVector = vector;
            await user.save();
            console.log(`Đã cập nhật vector cho người dùng ${user.email}`);
        } catch (error) {
            console.error(`Lỗi khi cập nhật cho user ${user.email}:`, error.message);
        }
    }

    console.log('Hoàn thành việc tạo embeddings.');
    await mongoose.disconnect();
}

generateEmbeddingsForExistingUsers().catch(console.error);