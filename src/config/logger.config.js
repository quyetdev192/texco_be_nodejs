const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

class LoggerConfig {
    constructor() {
        this.logger = null;
        this.logDir = './logs';
    }

    createLogger() {
        if (this.logger) return this.logger;

        const { combine, timestamp, printf, colorize, errors } = winston.format;

        const logFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
            let log = `${timestamp} [${level}]: ${message}`;

            if (Object.keys(meta).length > 0) {
                log += ` ${JSON.stringify(meta)}`;
            }

            if (stack) {
                log += `\n${stack}`;
            }

            return log;
        });

        const consoleTransport = new winston.transports.Console({
            format: combine(
                colorize(),
                timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                logFormat
            ),
            level: process.env.NODE_ENV === 'production' ? 'info' : 'debug'
        });

        const fileTransports = this.createFileTransports();

        this.logger = winston.createLogger({
            level: process.env.LOG_LEVEL || 'info',
            format: combine(
                timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                errors({ stack: true }),
                logFormat
            ),
            transports: [consoleTransport, ...fileTransports],
            exitOnError: false
        });

        return this.logger;
    }

    createFileTransports() {
        const transports = [];

        const errorTransport = new DailyRotateFile({
            filename: path.join(this.logDir, 'error-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            level: 'error',
            maxSize: '20m',
            maxFiles: '14d', 
            zippedArchive: true
        });

        const combinedTransport = new DailyRotateFile({
            filename: path.join(this.logDir, 'combined-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            maxSize: '20m',
            maxFiles: '14d',
            zippedArchive: true
        });

        if (process.env.NODE_ENV === 'production') {
            const prodTransport = new DailyRotateFile({
                filename: path.join(this.logDir, 'production-%DATE%.log'),
                datePattern: 'YYYY-MM-DD',
                maxSize: '50m',
                maxFiles: '30d', 
                zippedArchive: true
            });
            transports.push(prodTransport);
        }

        transports.push(errorTransport, combinedTransport);
        return transports;
    }

    getLogger() {
        if (!this.logger) {
            this.createLogger();
        }
        return this.logger;
    }

    info(message, meta = {}) {
        this.getLogger().info(message, meta);
    }

    error(message, meta = {}) {
        this.getLogger().error(message, meta);
    }

    warn(message, meta = {}) {
        this.getLogger().warn(message, meta);
    }

    debug(message, meta = {}) {
        this.getLogger().debug(message, meta);
    }

    logWithContext(level, message, context = {}) {
        this.getLogger().log(level, message, { context });
    }

    logRequest(req, res, responseTime) {
        const logData = {
            method: req.method,
            url: req.originalUrl,
            status: res.statusCode,
            responseTime: `${responseTime}ms`,
            userAgent: req.get('User-Agent'),
            ip: req.ip,
            userId: req.user?.id || 'anonymous'
        };

        if (res.statusCode >= 400) {
            this.error('API Request Error', logData);
        } else {
            this.info('API Request', logData);
        }
    }

    logDatabase(operation, collection, duration, success = true) {
        const level = success ? 'info' : 'error';
        this.logWithContext(level, 'Database Operation', {
            operation,
            collection,
            duration: `${duration}ms`,
            success
        });
    }
}

module.exports = new LoggerConfig(); 