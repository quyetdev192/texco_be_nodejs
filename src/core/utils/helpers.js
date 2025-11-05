const Joi = require('joi');

class Helpers {

    isValidEmail(email) {
        const emailSchema = Joi.string().email().required();
        const { error } = emailSchema.validate(email);
        return !error;
    }

    validatePassword(password, options = {}) {
        const {
            minLength = 8,
            requireUppercase = true,
            requireLowercase = true,
            requireNumbers = true,
            requireSpecialChars = true
        } = options;

        const errors = [];

        if (password.length < minLength) {
            errors.push(`Password must be at least ${minLength} characters long`);
        }

        if (requireUppercase && !/[A-Z]/.test(password)) {
            errors.push('Password must contain at least one uppercase letter');
        }

        if (requireLowercase && !/[a-z]/.test(password)) {
            errors.push('Password must contain at least one lowercase letter');
        }

        if (requireNumbers && !/\d/.test(password)) {
            errors.push('Password must contain at least one number');
        }

        if (requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
            errors.push('Password must contain at least one special character');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    generateRandomString(length = 10) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    formatDate(date, locale = 'en-US') {
        const dateObj = new Date(date);
        return dateObj.toLocaleDateString(locale, {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    formatCurrency(amount, currency = 'USD', locale = 'en-US') {
        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: currency
        }).format(amount);
    }

    sanitizeHtml(html) {
        if (!html) return '';

        return html
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
            .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
            .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
            .replace(/javascript:/gi, '')
            .replace(/on\w+\s*=/gi, '');
    }

    truncateText(text, maxLength = 100, suffix = '...') {
        if (!text || text.length <= maxLength) return text;
        return text.substring(0, maxLength - suffix.length) + suffix;
    }

    toSlug(text) {
        return text
            .toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, '')
            .replace(/[\s_-]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    deepClone(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj.getTime());
        if (obj instanceof Array) return obj.map(item => this.deepClone(item));
        if (typeof obj === 'object') {
            const cloned = {};
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    cloned[key] = this.deepClone(obj[key]);
                }
            }
            return cloned;
        }
    }

    isEmpty(obj) {
        if (obj === null || obj === undefined) return true;
        if (typeof obj === 'string') return obj.trim().length === 0;
        if (Array.isArray(obj)) return obj.length === 0;
        if (typeof obj === 'object') return Object.keys(obj).length === 0;
        return false;
    }

    getNestedProperty(obj, path, defaultValue = undefined) {
        if (!obj || !path) return defaultValue;

        const keys = path.split('.');
        let result = obj;

        for (const key of keys) {
            if (result && typeof result === 'object' && key in result) {
                result = result[key];
            } else {
                return defaultValue;
            }
        }

        return result;
    }

    setNestedProperty(obj, path, value) {
        if (!obj || !path) return obj;

        const keys = path.split('.');
        const lastKey = keys.pop();
        let current = obj;

        for (const key of keys) {
            if (!(key in current) || typeof current[key] !== 'object') {
                current[key] = {};
            }
            current = current[key];
        }

        current[lastKey] = value;
        return obj;
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    throttle(func, limit) {
        let inThrottle;
        return function executedFunction(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    // Pagination helpers
    buildPagination(query = {}, defaults = {}) {
        const page = Math.max(parseInt(query.page) || defaults.page || 1, 1);
        const limitRaw = parseInt(query.limit) || defaults.limit || 20;
        const maxLimit = defaults.maxLimit || 100;
        const limit = Math.min(Math.max(limitRaw, 1), maxLimit);
        const skip = (page - 1) * limit;

        // sort: `-createdAt` or `email` etc.
        const sortParam = (query.sort || defaults.sort || '-createdAt').toString();
        const sort = {};
        const fields = sortParam.split(',').map(s => s.trim()).filter(Boolean);
        for (const f of fields) {
            if (!f) continue;
            if (f.startsWith('-')) sort[f.substring(1)] = -1;
            else sort[f] = 1;
        }

        return { page, limit, skip, sort };
    }

    buildPaginationMeta(total, page, limit) {
        const pages = Math.max(Math.ceil((total || 0) / (limit || 1)), 1);
        return { page, limit, total, pages, hasNext: page < pages, hasPrev: page > 1 };
        }

    // Date range helper: inclusive day range
    buildDateRange(fromDate, toDate) {
        const range = {};
        if (fromDate) {
            const d = new Date(fromDate);
            if (!isNaN(d.getTime())) {
                d.setHours(0, 0, 0, 0);
                range.$gte = d;
            }
        }
        if (toDate) {
            const d = new Date(toDate);
            if (!isNaN(d.getTime())) {
                d.setHours(23, 59, 59, 999);
                range.$lte = d;
            }
        }
        return Object.keys(range).length ? range : null;
    }

    // Status text mapping (Document/Bundle status)
    getStatusText(status) {
        const statusMap = {
            'PENDING_REVIEW': 'Chờ duyệt',
            'REJECTED': 'Từ chối',
            'OCR_PROCESSING': 'Đang xử lý OCR',
            'OCR_COMPLETED': 'Hoàn thành OCR',
            'OCR_FAILED': 'OCR thất bại',
            'ARCHIVED': 'Đã lưu trữ'
        };
        return statusMap[status] || status;
    }

    // Role text mapping
    getRoleText(role) {
        const roleMap = {
            'SUPPLIER': 'Nhà cung cấp',
            'STAFF': 'Nhân viên C/O',
            'MOIT': 'Bộ Công Thương',
            'ADMIN': 'Quản trị viên'
        };
        return roleMap[role] || role;
    }

    // Document type text mapping
    getDocumentTypeText(documentType) {
        const typeMap = {
            'VAT_INVOICE': 'Hóa đơn VAT',
            'IMPORT_DECLARATION': 'Tờ khai nhập khẩu',
            'PURCHASE_LIST': 'Danh sách mua hàng',
            'NPL_ORIGIN_CERT': 'Giấy chứng nhận xuất xứ',
            'EXPORT_DECLARATION': 'Tờ khai xuất khẩu',
            'COMMERCIAL_INVOICE': 'Hóa đơn thương mại',
            'BILL_OF_LADING': 'Vận đơn',
            'BOM': 'Danh mục nguyên vật liệu'
        };
        return typeMap[documentType] || documentType;
    }

    // Add text fields to object
    addTextFields(obj, fields = ['status', 'role', 'documentType']) {
        const result = { ...obj };
        if (fields.includes('status') && obj.status) {
            result.status_text = this.getStatusText(obj.status);
        }
        if (fields.includes('role') && obj.role) {
            result.role_text = this.getRoleText(obj.role);
        }
        if (fields.includes('documentType') && obj.documentType) {
            result.documentType_text = this.getDocumentTypeText(obj.documentType);
        }
        return result;
    }
}

module.exports = new Helpers(); 