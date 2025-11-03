# Project Name

A comprehensive Node.js API project with modular architecture, security features, internationalization (i18n) support, and comprehensive documentation.

## 🚀 Features

- **Modular Architecture**: Clean separation of concerns with 3-tier architecture (Routes, Controllers, Services)
- **Multi-Database Support**: MongoDB, PostgreSQL, and MySQL support with easy switching
- **Security Features**: JWT authentication, HMAC signature verification, API key validation, rate limiting
- **Internationalization**: Multi-language support (English/Vietnamese) with i18next
- **Comprehensive Logging**: Winston logger with file rotation and environment-specific configurations
- **API Documentation**: Swagger/OpenAPI documentation with interactive UI
- **Error Handling**: Global error handling with proper HTTP status codes and error messages
- **Validation**: Input validation with Joi and custom validation rules
- **Testing Ready**: Jest testing framework setup with unit and integration test examples

## 📁 Project Structure

```
project-name/
├── src/                  # Source code
│   ├── config/           # Configuration files
│   │   ├── db.config.js      # Database configuration
│   │   ├── i18n.config.js    # Internationalization config
│   │   ├── logger.config.js  # Winston logging config
│   │   ├── security.config.js # Security settings
│   │   └── index.js          # Config exports
│   ├── modules/          # Feature modules
│   │   ├── user/         # User module
│   │   │   ├── user.route.js     # Routes
│   │   │   ├── user.controller.js # Controllers
│   │   │   ├── user.service.js   # Business logic
│   │   │   └── user.model.js     # Data models
│   │   ├── auth/         # Authentication module
│   │   └── product/      # Product module (example)
│   ├── middlewares/      # Express middlewares
│   │   ├── signature.middleware.js # HMAC verification
│   │   ├── auth.middleware.js     # JWT authentication
│   │   ├── error.middleware.js    # Error handling
│   │   └── i18n.middleware.js    # Language handling
│   ├── security/         # Security utilities
│   │   └── hmac.utils.js # HMAC signature utilities
│   ├── utils/            # Utility functions
│   │   ├── helpers.js    # Common helpers
│   │   └── constants.js  # Constants and error codes
│   ├── app.js            # Express app setup
│   └── server.js         # Server entry point
├── locales/              # Translation files
│   ├── en/               # English translations
│   └── vi/               # Vietnamese translations
├── logs/                 # Log files (auto-created)
├── docs/                 # API documentation
│   └── swagger.js        # Swagger configuration
├── tests/                # Test files
│   ├── unit/             # Unit tests
│   └── integration/      # Integration tests
├── env.dev               # Development environment
├── package.json          # Dependencies and scripts
└── README.md             # This file
```

## 🛠️ Prerequisites

- Node.js 18.0.0 or higher
- npm or yarn package manager
- MongoDB, PostgreSQL, or MySQL database
- Git

## 📦 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd project-name
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   # Copy environment file
   cp env.dev .env
   
   # Edit .env file with your configuration
   nano .env
   ```

4. **Database Setup**
   ```bash
   # For MongoDB
   mongod
   
   # For PostgreSQL
   createdb project_name_dev
   
   # For MySQL
   mysql -u root -p -e "CREATE DATABASE project_name_dev;"
   ```

5. **Start the application**
   ```bash
   # Development mode
   npm run start:dev
   
   # Production mode
   npm run start:prod
   ```

## ⚙️ Configuration

### Environment Variables

The application uses environment variables for configuration. Key variables include:

- `NODE_ENV`: Environment (development, staging, production)
- `PORT`: Server port (default: 3000)
- `DB_TYPE`: Database type (mongodb, postgresql, mysql)
- `JWT_SECRET`: Secret key for JWT tokens
- `HMAC_SECRET`: Secret key for HMAC signatures
- `LOG_LEVEL`: Logging level (debug, info, warn, error)

### Database Configuration

The application supports multiple databases:

- **MongoDB**: Default database with Mongoose ODM
- **PostgreSQL**: Relational database with pg driver
- **MySQL**: Relational database with mysql2 driver

Switch databases by changing `DB_TYPE` in your environment file.

### Security Configuration

- **JWT Authentication**: Token-based authentication with configurable expiration
- **HMAC Signatures**: Request signature verification for API security
- **API Keys**: Optional API key validation
- **Rate Limiting**: Configurable request rate limiting
- **CORS**: Cross-origin resource sharing configuration
- **Helmet**: Security headers middleware

## 🔐 Authentication & Security

### JWT Authentication

```javascript
// Login
POST /api/v1/users/login
{
  "email": "user@example.com",
  "password": "password123"
}

// Use token in Authorization header
Authorization: Bearer <jwt-token>
```

### HMAC Signature Verification

For enhanced security, requests can include HMAC signatures:

```javascript
// Required headers
x-timestamp: 1640995200
x-signature: <hmac-signature>
x-api-key: <api-key>

// Signature is generated from: method + path + timestamp + body + api-key
```

### Role-Based Access Control

```javascript
// Require specific role
router.get('/admin', requireRole('admin'), controller.adminOnly);

// Require specific permission
router.post('/users', requirePermission('user:create'), controller.createUser);
```

## 🌍 Internationalization (i18n)

The application supports multiple languages:

- **English (en)**: Default language
- **Vietnamese (vi)**: Secondary language

### Using Translations

```javascript
// In controllers/middlewares
const message = req.t('user.created'); // Returns localized message

// Change language
GET /api/v1/users?lang=vi
```

### Adding New Languages

1. Create new language file in `locales/`
2. Add language to i18n configuration
3. Update constants for new language

## 📚 API Documentation

Access the interactive API documentation at `/docs` when the server is running.

### Swagger Features

- Interactive API testing
- Request/response examples
- Authentication schemes
- Data models
- Error responses

## 🧪 Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test files
npm test -- user.service.test.js
```

### Test Structure

- **Unit Tests**: Test individual functions and methods
- **Integration Tests**: Test API endpoints and database operations
- **Test Utilities**: Common test helpers and mocks

## 📝 Logging

The application uses Winston for logging with the following features:

- **Console Logging**: Development-friendly colored output
- **File Logging**: Rotated log files by date and level
- **Environment-Specific**: Different log levels for different environments
- **Request Logging**: Automatic API request/response logging
- **Error Logging**: Detailed error logging with stack traces

### Log Levels

- `error`: Application errors and exceptions
- `warn`: Warning messages
- `info`: General information
- `debug`: Detailed debugging information

## 🚀 Deployment

### Production Checklist

1. **Environment Variables**
   - Set `NODE_ENV=production`
   - Use strong, unique secrets
   - Configure production database
   - Set appropriate log levels

2. **Security**
   - Enable all security features
   - Configure CORS properly
   - Set up rate limiting
   - Use HTTPS in production

3. **Monitoring**
   - Set up application monitoring
   - Configure log aggregation
   - Set up health checks
   - Monitor database performance

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

## 🔧 Development

### Adding New Modules

1. **Create module structure**
   ```
   src/modules/newmodule/
   ├── newmodule.model.js
   ├── newmodule.service.js
   ├── newmodule.controller.js
   └── newmodule.route.js
   ```

2. **Register routes in app.js**
   ```javascript
   const newmoduleRoutes = require('./modules/newmodule/newmodule.route');
   app.use('/api/v1/newmodule', newmoduleRoutes);
   ```

3. **Add to Swagger documentation**
   - Update swagger.js with new schemas
   - Add route documentation

### Code Style

- Use ES6+ features
- Follow consistent naming conventions
- Add JSDoc comments for public methods
- Use async/await for asynchronous operations
- Implement proper error handling

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:

- Create an issue in the repository
- Check the API documentation at `/docs`
- Review the logs for error details
- Check the configuration files

## 🔄 Changelog

### Version 1.0.0
- Initial release
- Basic user management
- Authentication system
- Multi-database support
- Internationalization
- Security features
- API documentation

---

**Happy Coding! 🎉** # node_1
# texco_be_nodejs
