// File này sẽ là trung tâm cấu hình cho AI Agent

// 1. Định nghĩa các collection và trường an toàn mà AI được phép truy cập
const allowedSchema = {
    users: {
        collectionName: 'User', // Tên Model trong Mongoose (chữ hoa)
        fields: ['firstName', 'lastName', 'email', 'createdAt'],
        description: 'Lưu trữ thông tin người dùng trong hệ thống.'
    }
    // Thêm các collection khác ở đây, ví dụ: 'products'
};

// 2. Helper function để tạo mô tả schema cho prompt
function buildSchemaForPrompt() {
    let schemaText = '';
    for (const collName in allowedSchema) {
        const config = allowedSchema[collName];
        schemaText += `- Collection '${collName}': ${config.description}\n`;
    }
    return schemaText;
}

// 3. Prompt hệ thống, sử dụng thông tin schema ở trên
const systemPrompt = `
Bạn là một trợ lý AI thông minh và chủ động. Nhiệm vụ của bạn là trả lời câu hỏi của người dùng một cách tốt nhất bằng cách sử dụng các công cụ được cung cấp.

QUY TẮC QUAN TRỌNG:
1.  Hãy luôn cố gắng tự suy luận và sử dụng các công cụ để tìm câu trả lời.
2.  Chỉ hỏi lại người dùng để làm rõ khi bạn thật sự không thể tìm thấy thông tin sau khi đã thử các công cụ.
3.  Sử dụng thông tin dưới đây để biết về các tài nguyên có sẵn trong database.

THÔNG TIN DATABASE CÓ SẴN:
${buildSchemaForPrompt()}
`;

// 4. Định nghĩa các công cụ mà AI Agent có thể sử dụng
const availableTools = {
    knowledgeBaseSearch: {
        functionDeclarations: [{
            name: "knowledgeBaseSearch",
            description: "Tìm kiếm thông tin ngữ nghĩa trong cơ sở kiến thức (văn bản, mô tả sản phẩm, thông tin người dùng) để trả lời các câu hỏi chung hoặc yêu cầu tóm tắt.",
            parameters: { type: "OBJECT", properties: { query: { type: "STRING", description: "Câu hỏi hoặc chủ đề cần tìm kiếm." } }, required: ["query"] }
        }]
    },
    databaseQuery: {
        functionDeclarations: [{
            name: "databaseQuery",
            description: "Thực thi một truy vấn chính xác trên một collection cụ thể trong database để lấy dữ liệu thời gian thực.",
            parameters: {
                type: "OBJECT",
                properties: {
                    collection: { type: "STRING", description: "Tên collection cần truy vấn, ví dụ: 'users', 'products'." },
                    filter: { type: "OBJECT", description: "Điều kiện lọc của MongoDB." },
                    projection: { type: "OBJECT", description: "Các trường cần trả về." },
                    sort: { type: "OBJECT", description: "Cách sắp xếp." },
                    limit: { type: "NUMBER", description: "Số lượng kết quả." }
                },
                required: ["collection", "filter"]
            }
        }]
    }
};

// 5. Export tất cả các cấu hình cần thiết
module.exports = {
    allowedSchema,
    systemPrompt,
    availableTools
};