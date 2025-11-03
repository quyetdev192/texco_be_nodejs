const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const { initializeConfigs } = require('./core/config');
const securityConfig = require('./config/security.config');
const logger = require('./config/logger.config');
const { errorHandler, notFoundHandler } = require('./middlewares/error.middleware');
const { validateTimestamp, verifySignature, addSignatureHeaders } = require('./middlewares/signature.middleware');
const { requestLogger } = require('./middlewares/requestLog.middleware');
const apiRoutes = require('./api/routes');

class App {
    constructor() {
        this.app = express();
        this.port = process.env.PORT || 3000;
        this.isInitialized = false;
    }

    async initialize() {
        if (this.isInitialized) return;
        try {
            await initializeConfigs();
            this.setupBasicMiddleware();
            this.setupSecurityMiddleware();
            this.setupLoggingMiddleware();
            this.setupRoutes();
            this.setupErrorHandling();
            this.isInitialized = true;
        } catch (error) {
            throw error;
        }
    }

    setupBasicMiddleware() {
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
        this.app.use(cookieParser());
        this.app.use(compression());
        this.app.set('trust proxy', 1);
    }

    setupSecurityMiddleware() {
        this.app.use(helmet(securityConfig.getHelmetConfig()));
        this.app.use(cors(securityConfig.getCorsConfig()));
        this.app.use('/api/', rateLimit(securityConfig.getRateLimitConfig()));
        this.app.use('/api/', validateTimestamp, 
            // verifySignature, 
             addSignatureHeaders
            );
        this.app.use('/api/', requestLogger);
    }

    setupLoggingMiddleware() {
        this.app.use(process.env.NODE_ENV === 'development'
            ? morgan('dev')
            : morgan('combined', {
                stream: { write: message => logger.info(message.trim()) }
            })
        );
    }

    setupRoutes() {
        this.app.use('/api', apiRoutes);
        this.app.get('/', (_, res) => res.json({ message: 'Welcome to API Server' }));
    }

    setupErrorHandling() {
        this.app.use(notFoundHandler);
        this.app.use(errorHandler);
    }

    async start() {
        try {
            await this.initialize();
            this.server = this.app.listen(this.port);
            this.setupGracefulShutdown();
        } catch (error) {
            process.exit(1);
        }
    }

    setupGracefulShutdown() {
        const shutdown = async () => {
            if (this.server) {
                await new Promise(resolve => this.server.close(resolve));
                await require('./config').gracefulShutdown();
                process.exit(0);
            }
        };

        process.on('SIGTERM', shutdown);
        process.on('SIGINT', shutdown);
    }

    getApp() {
        return this.app;
    }

    getServer() {
        return this.server;
    }
}

module.exports = App;