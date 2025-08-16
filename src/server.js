
require('dotenv').config({
    path: process.env.NODE_ENV === 'production' ? '.env.prod' :
        process.env.NODE_ENV === 'staging' ? '.env.uat' : '.env.dev'
});

const App = require('./app');

const app = new App();

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

async function startServer() {
    try {
        await app.start();
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    startServer();
}

module.exports = app; 