class ApiLog {
    static name = 'ApiLog';
    static collection = 'api_logs';
    static IsStandardModel = true;

    static getSchema() {
        return {
            method: { type: String, required: true },
            path: { type: String, required: true },
            baseUrl: { type: String },
            originalUrl: { type: String },
            query: { type: Object },
            body: { type: Object },
            headers: { type: Object },
            statusCode: { type: Number },
            success: { type: Boolean },
            errorCode: { type: Number },
            message: { type: String },
            userId: { type: String },
            username: { type: String },
            ip: { type: String },
            durationMs: { type: Number },
            createdAt: { type: Date, default: Date.now }
        };
    }
}

module.exports = ApiLog;

