const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const compression = require('compression');

const { initializeConfigs } = require('./config');
const securityConfig = require('./config/security.config');
const logger = require('./config/logger.config');

const { errorHandler, notFoundHandler } = require('./middlewares/error.middleware');
const { setLanguage, addLanguageInfo } = require('./middlewares/i18n.middleware');
const { verifySignature } = require('./middlewares/signature.middleware');

const userRoutes = require('./modules/user/user.route');
const assistantRoutes = require('./modules/assistant/assistant.route');

const swaggerConfig = require('../docs/swagger');

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

            this.setupLanguageMiddleware();

            this.setupRoutes();

            this.setupSwagger();

            this.setupErrorHandling();

            this.isInitialized = true;
            logger.info('Application initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize application', { error: error.message });
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
        const helmetConfig = securityConfig.getHelmetConfig();
        this.app.use(helmet(helmetConfig));

        const corsConfig = securityConfig.getCorsConfig();
        this.app.use(cors(corsConfig));

        const rateLimitConfig = securityConfig.getRateLimitConfig();
        const limiter = rateLimit(rateLimitConfig);
        this.app.use('/api/', limiter);

        this.app.use((req, res, next) => {
            res.setHeader('X-Content-Type-Options', 'nosniff');
            res.setHeader('X-Frame-Options', 'DENY');
            res.setHeader('X-XSS-Protection', '1; mode=block');
            res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
            next();
        });
    }

    setupLoggingMiddleware() {
        if (process.env.NODE_ENV === 'development') {
            this.app.use(morgan('dev'));
        } else {
            this.app.use(morgan('combined', {
                stream: {
                    write: (message) => logger.info(message.trim())
                }
            }));
        }

        this.app.use((req, res, next) => {
            const start = Date.now();

            res.on('finish', () => {
                const duration = Date.now() - start;
                logger.logRequest(req, res, duration);
            });

            next();
        });
    }

    setupLanguageMiddleware() {
        this.app.use(setLanguage);
        this.app.use(addLanguageInfo);
    }

    setupRoutes() {
        this.app.use('/api', verifySignature);
        this.app.use('/api/v1/users', userRoutes);
        this.app.use('/api/v1/assistant', assistantRoutes);

    }

    setupSwagger() {
        try {
            const swaggerSpec = swaggerConfig.getSpec();

            this.app.use('/docs', swaggerConfig.serve, swaggerConfig.setup);

            this.app.get('/docs/swagger.json', (req, res) => {
                res.setHeader('Content-Type', 'application/json');
                res.send(swaggerSpec);
            });

            logger.info('Swagger documentation setup successfully');
        } catch (error) {
            logger.warn('Failed to setup Swagger documentation', { error: error.message });
        }
    }

    setupErrorHandling() {
        this.app.use(notFoundHandler);

        this.app.use(errorHandler);
    }

    async start() {
        try {
            await this.initialize();

            this.server = this.app.listen(this.port, () => {
                logger.info(`Server started successfully on port ${this.port}`, {
                    port: this.port,
                    environment: process.env.NODE_ENV || 'development',
                    timestamp: new Date().toISOString()
                });

                this.logAvailableEndpoints();
            });

            this.server.on('error', (error) => {
                logger.error('Server error', { error: error.message });
                process.exit(1);
            });

            this.setupGracefulShutdown();

        } catch (error) {
            logger.error('Failed to start server', { error: error.message });
            process.exit(1);
        }
    }

    logAvailableEndpoints() {
        const endpoints = [
            { method: 'GET', path: '/', description: 'API root' },
            { method: 'GET', path: '/health', description: 'Health check' },
            { method: 'GET', path: '/docs', description: 'API documentation' },
           
        ];

        logger.info('Available endpoints:', { endpoints });
    }

    setupGracefulShutdown() {
        const shutdown = async (signal) => {
            logger.info(`Received ${signal}, starting graceful shutdown...`);

            try {
                if (this.server) {
                    await new Promise((resolve) => {
                        this.server.close(resolve);
                    });
                    logger.info('HTTP server closed');
                }

                const { gracefulShutdown } = require('./config');
                await gracefulShutdown();

                logger.info('Graceful shutdown completed');
                process.exit(0);
            } catch (error) {
                logger.error('Error during shutdown', { error: error.message });
                process.exit(1);
            }
        };

        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
    }

    getApp() {
        return this.app;
    }

    getServer() {
        return this.server;
    }
}

module.exports = App; 