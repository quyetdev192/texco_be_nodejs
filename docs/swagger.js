const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

class SwaggerConfig {
    constructor() {
        this.options = {
            definition: {
                openapi: '3.0.0',
                info: {
                    title: 'Project Name API',
                    version: '1.0.0',
                    description: 'A comprehensive Node.js API with security features, i18n support, and modular architecture',
                    contact: {
                        name: 'API Support',
                        email: 'support@project-name.com'
                    },
                    license: {
                        name: 'MIT',
                        url: 'https://opensource.org/licenses/MIT'
                    }
                },
                servers: [
                    {
                        url: 'http://localhost:3000',
                        description: 'Development server'
                    },
                    {
                        url: 'https://api.project-name.com',
                        description: 'Production server'
                    }
                ],
                components: {
                    securitySchemes: {
                        BearerAuth: {
                            type: 'http',
                            scheme: 'bearer',
                            bearerFormat: 'JWT',
                            description: 'JWT token for authentication'
                        },
                        ApiKeyAuth: {
                            type: 'apiKey',
                            in: 'header',
                            name: 'x-api-key',
                            description: 'API key for access'
                        },
                        SignatureAuth: {
                            type: 'apiKey',
                            in: 'header',
                            name: 'x-signature',
                            description: 'HMAC signature for request verification'
                        }
                    },
                    schemas: {
                        User: {
                            type: 'object',
                            properties: {
                                _id: {
                                    type: 'string',
                                    description: 'User ID'
                                },
                                email: {
                                    type: 'string',
                                    format: 'email',
                                    description: 'User email address'
                                },
                                firstName: {
                                    type: 'string',
                                    description: 'User first name'
                                },
                                lastName: {
                                    type: 'string',
                                    description: 'User last name'
                                },
                                displayName: {
                                    type: 'string',
                                    description: 'User display name'
                                },
                                roles: {
                                    type: 'array',
                                    items: {
                                        type: 'string',
                                        enum: ['user', 'admin', 'moderator']
                                    },
                                    description: 'User roles'
                                },
                                isActive: {
                                    type: 'boolean',
                                    description: 'Whether user account is active'
                                },
                                isEmailVerified: {
                                    type: 'boolean',
                                    description: 'Whether user email is verified'
                                },
                                createdAt: {
                                    type: 'string',
                                    format: 'date-time',
                                    description: 'User creation timestamp'
                                },
                                updatedAt: {
                                    type: 'string',
                                    format: 'date-time',
                                    description: 'User last update timestamp'
                                }
                            }
                        },
                        UserCreate: {
                            type: 'object',
                            required: ['email', 'password', 'firstName', 'lastName'],
                            properties: {
                                email: {
                                    type: 'string',
                                    format: 'email',
                                    description: 'User email address'
                                },
                                password: {
                                    type: 'string',
                                    minLength: 8,
                                    description: 'User password (min 8 chars, must include uppercase, lowercase, number, and special char)'
                                },
                                firstName: {
                                    type: 'string',
                                    maxLength: 50,
                                    description: 'User first name'
                                },
                                lastName: {
                                    type: 'string',
                                    maxLength: 50,
                                    description: 'User last name'
                                },
                                displayName: {
                                    type: 'string',
                                    maxLength: 100,
                                    description: 'User display name (optional)'
                                }
                            }
                        },
                        UserUpdate: {
                            type: 'object',
                            properties: {
                                firstName: {
                                    type: 'string',
                                    maxLength: 50,
                                    description: 'User first name'
                                },
                                lastName: {
                                    type: 'string',
                                    maxLength: 50,
                                    description: 'User last name'
                                },
                                displayName: {
                                    type: 'string',
                                    maxLength: 100,
                                    description: 'User display name'
                                },
                                avatar: {
                                    type: 'string',
                                    description: 'User avatar URL'
                                }
                            }
                        },
                        LoginRequest: {
                            type: 'object',
                            required: ['email', 'password'],
                            properties: {
                                email: {
                                    type: 'string',
                                    format: 'email',
                                    description: 'User email address'
                                },
                                password: {
                                    type: 'string',
                                    description: 'User password'
                                }
                            }
                        },
                        LoginResponse: {
                            type: 'object',
                            properties: {
                                success: {
                                    type: 'boolean',
                                    example: true
                                },
                                message: {
                                    type: 'string',
                                    example: 'Login successful'
                                },
                                data: {
                                    type: 'object',
                                    properties: {
                                        user: {
                                            $ref: '#/components/schemas/User'
                                        },
                                        tokens: {
                                            type: 'object',
                                            properties: {
                                                accessToken: {
                                                    type: 'string',
                                                    description: 'JWT access token'
                                                },
                                                refreshToken: {
                                                    type: 'string',
                                                    description: 'JWT refresh token'
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        ErrorResponse: {
                            type: 'object',
                            properties: {
                                success: {
                                    type: 'boolean',
                                    example: false
                                },
                                error: {
                                    type: 'object',
                                    properties: {
                                        code: {
                                            type: 'string',
                                            description: 'Error code'
                                        },
                                        message: {
                                            type: 'string',
                                            description: 'Error message'
                                        },
                                        details: {
                                            type: 'string',
                                            description: 'Additional error details'
                                        }
                                    }
                                }
                            }
                        },
                        PaginationResponse: {
                            type: 'object',
                            properties: {
                                success: {
                                    type: 'boolean',
                                    example: true
                                },
                                data: {
                                    type: 'array',
                                    items: {
                                        $ref: '#/components/schemas/User'
                                    }
                                },
                                pagination: {
                                    type: 'object',
                                    properties: {
                                        page: {
                                            type: 'integer',
                                            description: 'Current page number'
                                        },
                                        limit: {
                                            type: 'integer',
                                            description: 'Number of items per page'
                                        },
                                        total: {
                                            type: 'integer',
                                            description: 'Total number of items'
                                        },
                                        pages: {
                                            type: 'integer',
                                            description: 'Total number of pages'
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                security: [
                    {
                        BearerAuth: []
                    },
                    {
                        ApiKeyAuth: []
                    },
                    {
                        SignatureAuth: []
                    }
                ]
            },
            apis: [
                './src/modules/*/*.route.js',
                './src/modules/*/*.controller.js'
            ]
        };

        this.spec = null;
    }

    /**
     * Get Swagger specification
     * @returns {Object} Swagger specification
     */
    getSpec() {
        if (!this.spec) {
            this.spec = swaggerJsdoc(this.options);
        }
        return this.spec;
    }

    /**
     * Get Swagger UI middleware
     * @returns {Object} Swagger UI middleware
     */
    get serve() {
        return swaggerUi.serve;
    }

    /**
     * Get Swagger UI setup
     * @returns {Function} Swagger UI setup function
     */
    get setup() {
        return swaggerUi.setup(this.getSpec(), {
            explorer: true,
            customCss: '.swagger-ui .topbar { display: none }',
            customSiteTitle: 'Project Name API Documentation',
            customfavIcon: '/favicon.ico',
            swaggerOptions: {
                docExpansion: 'list',
                filter: true,
                showRequestHeaders: true,
                showCommonExtensions: true
            }
        });
    }
}

module.exports = new SwaggerConfig(); 