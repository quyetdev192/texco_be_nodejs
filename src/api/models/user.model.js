const { Schema } = require('mongoose');

class User {
    static name = 'User';
    static collection = 'users';
    static IsStandardModel = true;

    static getSchema() {
        return {
            username: { type: String, unique: true, required: true, trim: true, lowercase: true },
            email: { type: String, unique: true, required: true, trim: true, lowercase: true },
            password: { type: String, required: true },
            fullName: { type: String, required: true },
            phone: { type: String, default: '' },
            avatarUrl: { type: String, default: '' },
            address: { type: String, default: '' },
            role: {
                type: String,
                required: true,
                enum: [
                    "SUPPLIER", // Nhà cung cấp
                    "STAFF",    // Nhân viên C/O
                    "MOIT",     // Viewer (Bộ Công Thương)
                    "ADMIN"     // Admin
                ]
            },
            companyId: { type: Schema.Types.ObjectId, ref: 'Company' },
            isDisabled: { type: Boolean, default: false },
            currentSessionId: { type: String, default: '' },
            createdAt: { type: Date, default: Date.now },
            updatedAt: { type: Date, default: Date.now }
        };
    }
}

module.exports = User;