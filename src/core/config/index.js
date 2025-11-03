const dbConfig = require('./db.config');
const loggerConfig = require('./logger.config');
const securityConfig = require('./security.config');

const initializeConfigs = async () => {
    try {
        securityConfig.validate();

        loggerConfig.createLogger();

        await dbConfig.connect();

        console.log('All configurations initialized successfully');
    } catch (error) {
        console.error('Configuration initialization failed:', error);
        throw error;
    }
};

const gracefulShutdown = async () => {
    try {
        console.log('Shutting down gracefully...');

        await dbConfig.disconnect();

        console.log('Graceful shutdown completed');
        process.exit(0);
    } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
    }
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

module.exports = {
    dbConfig,
    loggerConfig,
    securityConfig,
    initializeConfigs,
    gracefulShutdown
}; 