const mongoose = require('mongoose');
const ApiLogModelClass = require('../../api/models/apiLog.model');

function buildModelFromClass(modelClass) {
    const modelName = modelClass.name;
    if (mongoose.models[modelName]) return mongoose.models[modelName];
    const schemaDefinition = modelClass.getSchema();
    const schema = new mongoose.Schema(schemaDefinition, { collection: modelClass.collection });
    return mongoose.model(modelName, schema);
}

const ApiLog = buildModelFromClass(ApiLogModelClass);

function maskSensitive(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    const clone = JSON.parse(JSON.stringify(obj));
    const maskFields = ['password', 'token', 'accessToken', 'refreshToken'];
    const walk = (o) => {
        Object.keys(o).forEach((k) => {
            if (maskFields.includes(k)) {
                o[k] = '***';
            } else if (o[k] && typeof o[k] === 'object') {
                walk(o[k]);
            }
        });
    };
    walk(clone);
    return clone;
}

function maskHeaders(headers) {
    if (!headers) return headers;
    const cloned = { ...headers };
    ['authorization', 'x-signature'].forEach((h) => {
        if (cloned[h]) cloned[h] = '***';
    });
    return cloned;
}

function requestLogger(req, res, next) {
    const start = Date.now();

    const originalJson = res.json.bind(res);
    res.json = function (body) {
        res.locals.responseBody = body;
        return originalJson(body);
    };

    res.on('finish', async () => {
        try {
            const responseBody = res.locals.responseBody || {};
            const logDoc = new ApiLog({
                method: req.method,
                path: req.path,
                baseUrl: req.baseUrl,
                originalUrl: req.originalUrl,
                query: maskSensitive(req.query),
                body: maskSensitive(req.body),
                headers: maskHeaders(req.headers),
                statusCode: res.statusCode,
                success: typeof responseBody.success === 'boolean' ? responseBody.success : res.statusCode < 400,
                errorCode: typeof responseBody.errorCode === 'number' ? responseBody.errorCode : (res.statusCode < 400 ? 0 : 1),
                message: typeof responseBody.message === 'string' ? responseBody.message : undefined,
                userId: req.userId || (req.user && (req.user.userId || req.user.id)) || undefined,
                username: req.user && req.user.username ? req.user.username : undefined,
                ip: req.ip,
                durationMs: Date.now() - start
            });
            await logDoc.save();
        } catch (e) {
            // swallow logging errors to not impact response
        }
    });

    next();
}

module.exports = {
    requestLogger
};

