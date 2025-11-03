require('dotenv').config({
    path: process.env.NODE_ENV === 'production' ? '.env.prod' : '.env.dev'
});

const App = require('./core/app');
const app = new App();

if (require.main === module) {
    app.start();
}

module.exports = app;