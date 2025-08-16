const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
// Ta sẽ gọi embeddingService ở đây để tự động hóa
const embeddingService = require('../assistant/embedding.service');

const userSchema = new mongoose.Schema({
    firstName: {
        type: String,
        required: [true, 'First name is required'],
        trim: true,
        maxlength: [50, 'First name cannot exceed 50 characters']
    },
    lastName: {
        type: String,
        required: [true, 'Last name is required'],
        trim: true,
        maxlength: [50, 'Last name cannot exceed 50 characters']
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [8, 'Password must be at least 8 characters long'],
    },
    // THÊM TRƯỜNG MỚI ĐỂ LƯU VECTOR
    userVector: {
        type: [Number],
    },
}, {
    timestamps: true,
});

// Hook mã hóa mật khẩu (giữ nguyên)
userSchema.pre('save', async function (next) {
    if (this.isModified('password')) {
        try {
            const salt = await bcrypt.genSalt(12);
            this.password = await bcrypt.hash(this.password, salt);
        } catch (error) {
            return next(error);
        }
    }
    return next();
});

// HOOK MỚI: Tự động cập nhật vector khi thông tin thay đổi
userSchema.pre('save', async function (next) {
    if (this.isNew || this.isModified('firstName') || this.isModified('lastName') || this.isModified('email')) {
        try {
            const representativeText = `Tên: ${this.firstName} ${this.lastName}, email: ${this.email}`;
            this.userVector = await embeddingService.generateEmbedding(representativeText);
        } catch (error) {
            console.error(`Failed to generate embedding for user ${this.email}:`, error);
            // Không chặn việc lưu, chỉ log lỗi
        }
    }
    return next();
});

// Các hàm khác giữ nguyên
userSchema.methods.comparePassword = async function (candidatePassword) { /*...*/ };
userSchema.statics.findByEmail = function (email) { /*...*/ };

const User = mongoose.model('User', userSchema);

module.exports = User;