class SecurityConfig {
    constructor() {
        this.config = {
            jwt: {
                secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
                expiresIn: process.env.JWT_EXPIRES_IN || '24h',
                refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
                issuer: process.env.JWT_ISSUER || 'project-name',
                audience: process.env.JWT_AUDIENCE || 'project-name-users'
            },

            hmac: {
                algorithm: process.env.HMAC_ALGORITHM || 'sha256',
                secret: process.env.HMAC_SECRET || 'zr@rArX$&v',
                expiresIn: parseInt(process.env.HMAC_EXPIRES_IN) || 300,
                clockSkew: parseInt(process.env.HMAC_CLOCK_SKEW) || 60, 
                requiredHeaders: ['x-signature-nonce', 'x-signature', 'x-from']
            },

            rateLimit: {
                windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, 
                max: parseInt(process.env.RATE_LIMIT_MAX) || 100, 
                message: 'Too many requests from this IP, please try again later.',
                standardHeaders: true,
                legacyHeaders: false
            },

            cors: {
                origin: process.env.CORS_ORIGIN || '*',
                methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
                allowedHeaders: [
                    'Content-Type',
                    'Authorization',
                    'x-timestamp',
                    'x-signature',
                    'x-signature-nonce',
                    'x-from',
                    'x-api-key'
                ],
                credentials: true,
                maxAge: 86400 
            },

            helmet: {
                contentSecurityPolicy: {
                    directives: {
                        defaultSrc: ["'self'"],
                        styleSrc: ["'self'", "'unsafe-inline'"],
                        scriptSrc: ["'self'"],
                        imgSrc: ["'self'", "data:", "https:"],
                        connectSrc: ["'self'"],
                        fontSrc: ["'self'"],
                        objectSrc: ["'none'"],
                        mediaSrc: ["'self'"],
                        frameSrc: ["'none'"]
                    }
                },
                hsts: {
                    maxAge: 31536000,
                    includeSubDomains: true,
                    preload: true
                }
            },

            password: {
                minLength: parseInt(process.env.PASSWORD_MIN_LENGTH) || 8,
                requireUppercase: process.env.PASSWORD_REQUIRE_UPPERCASE !== 'false',
                requireLowercase: process.env.PASSWORD_REQUIRE_LOWERCASE !== 'false',
                requireNumbers: process.env.PASSWORD_REQUIRE_NUMBERS !== 'false',
                requireSpecialChars: process.env.PASSWORD_REQUIRE_SPECIAL_CHARS !== 'false',
                maxAge: parseInt(process.env.PASSWORD_MAX_AGE) || 90 * 24 * 60 * 60 * 1000 
            },

            session: {
                secret: process.env.SESSION_SECRET || 'your-session-secret-change-in-production',
                resave: false,
                saveUninitialized: false,
                cookie: {
                    secure: process.env.NODE_ENV === 'production',
                    httpOnly: true,
                    maxAge: 24 * 60 * 60 * 1000, 
                    sameSite: 'strict'
                }
            },

            apiKey: {
                required: process.env.API_KEY_REQUIRED === 'true',
                headerName: process.env.API_KEY_HEADER || 'x-api-key',
                validKeys: process.env.API_KEYS ? process.env.API_KEYS.split(',') : []
            },

            encryption: {
                algorithm: process.env.ENCRYPTION_ALGORITHM || 'aes-256-gcm',
                key: process.env.ENCRYPTION_KEY || 'your-32-character-encryption-key',
                ivLength: parseInt(process.env.ENCRYPTION_IV_LENGTH) || 16
            }
        };
    }

    get(key) {
        return key ? this.config[key] : this.config;
    }

    getJwtConfig() {
        return this.config.jwt;
    }

    getHmacConfig() {
        return this.config.hmac;
    }

    getRateLimitConfig() {
        return this.config.rateLimit;
    }

    getCorsConfig() {
        // Default allowlist with frontend URLs
        const defaultAllowlist = [
            'http://localhost:3000',
            'http://localhost:3001',
            'http://127.0.0.1:3000',
            'http://127.0.0.1:3001',
            'https://texco-web-dashboard.vercel.app',
            'https://texco-web-dashboard-staging.vercel.app',
            'https://devphanmem.site',
            'https://www.devphanmem.site',
            'https://www.texco.site',
            'https://texco.site',
            'http://devphanmem.site',
            'http://www.devphanmem.site',
            'http://localhost:5173',
            'http://localhost:5174'
        ];

        const rawOrigin = process.env.CORS_ORIGIN || '*';

        // If wildcard, mirror request origin (works with credentials)
        if (rawOrigin === '*') {
            return { ...this.config.cors, origin: true };
        }

        // Support comma-separated allowlist: "http://a.com,http://b.com"
        const envAllowlist = rawOrigin.split(',').map(o => o.trim()).filter(Boolean);
        const allowlist = [...defaultAllowlist, ...envAllowlist];

        const isProd = this.isProduction();

        return {
            ...this.config.cors,
            origin: (origin, callback) => {
                // Allow non-browser or same-origin requests (no Origin header)
                if (!origin) return callback(null, true);
                // In non-production, allow any localhost/127.0.0.1 origin for DX
                if (!isProd && (/^https?:\/\/localhost:\d+$/i.test(origin) || /^https?:\/\/127\.0\.0\.1:\d+$/i.test(origin))) {
                    return callback(null, true);
                }
                if (allowlist.includes(origin)) return callback(null, true);
                console.warn(`⚠️ CORS blocked request from origin: ${origin}`);
                return callback(new Error('Not allowed by CORS'));
            }
        };
    }

    getHelmetConfig() {
        return this.config.helmet;
    }

    getPasswordPolicy() {
        return this.config.password;
    }

    getSessionConfig() {
        return this.config.session;
    }

    getApiKeyConfig() {
        return this.config.apiKey;
    }

    getEncryptionConfig() {
        return this.config.encryption;
    }

    validate() {
        const errors = [];

        if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
            errors.push('JWT_SECRET is required in production');
        }

        if (!process.env.HMAC_SECRET && process.env.NODE_ENV === 'production') {
            errors.push('HMAC_SECRET is required in production');
        }

        if (!process.env.ENCRYPTION_KEY && process.env.NODE_ENV === 'production') {
            errors.push('ENCRYPTION_KEY is required in production');
        }

        if (errors.length > 0) {
            throw new Error(`Security configuration errors: ${errors.join(', ')}`);
        }

        return true;
    }

    isProduction() {
        return process.env.NODE_ENV === 'production';
    }

    isSecurityEnabled() {
        return process.env.SECURITY_ENABLED !== 'false';
    }
}

module.exports = new SecurityConfig(); 