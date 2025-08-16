const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

jest.mock('../../src/config/logger.config', () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
}));

jest.mock('../../src/config/security.config', () => ({
    getJwtConfig: jest.fn(() => ({
        secret: 'test-secret',
        expiresIn: '1h',
        refreshExpiresIn: '7d',
        issuer: 'test',
        audience: 'test-users'
    }))
}));

const App = require('../../src/app');

describe('User Routes Integration Tests', () => {
    let app;
    let server;
    let testUser;
    let authToken;

    beforeAll(async () => {
        app = new App();

        jest.spyOn(app, 'initialize').mockResolvedValue();

        await app.start();
        server = app.getServer();
    });

    afterAll(async () => {
        if (server) {
            await new Promise((resolve) => server.close(resolve));
        }

        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
        }
    });

    beforeEach(async () => {
        testUser = {
            email: 'test@example.com',
            password: 'TestPassword123!',
            firstName: 'Test',
            lastName: 'User'
        };

        authToken = jwt.sign(
            { userId: 'test123', email: testUser.email, roles: ['user'] },
            'test-secret',
            { expiresIn: '1h' }
        );
    });

    describe('POST /api/v1/users/register', () => {
        it('should register a new user successfully', async () => {
            const response = await request(server)
                .post('/api/v1/users/register')
                .send(testUser)
                .expect(201);

            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('User created successfully');
            expect(response.body.data).toBeDefined();
            expect(response.body.data.email).toBe(testUser.email);
            expect(response.body.data.firstName).toBe(testUser.firstName);
            expect(response.body.data.lastName).toBe(testUser.lastName);
        });

        it('should return 400 for missing required fields', async () => {
            const invalidUser = {
                email: 'test@example.com'
            };

            const response = await request(server)
                .post('/api/v1/users/register')
                .send(invalidUser)
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.error.code).toBe('VAL_001');
        });

        it('should return 400 for invalid email format', async () => {
            const invalidUser = {
                ...testUser,
                email: 'invalid-email'
            };

            const response = await request(server)
                .post('/api/v1/users/register')
                .send(invalidUser)
                .expect(400);

            expect(response.body.success).toBe(false);
        });

        it('should return 400 for weak password', async () => {
            const invalidUser = {
                ...testUser,
                password: 'weak'
            };

            const response = await request(server)
                .post('/api/v1/users/register')
                .send(invalidUser)
                .expect(400);

            expect(response.body.success).toBe(false);
        });
    });

    describe('POST /api/v1/users/login', () => {
        it('should login user successfully with valid credentials', async () => {
            const loginData = {
                email: testUser.email,
                password: testUser.password
            };

            const response = await request(server)
                .post('/api/v1/users/login')
                .send(loginData)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('Login successful');
            expect(response.body.data.user).toBeDefined();
            expect(response.body.data.tokens).toBeDefined();
            expect(response.body.data.tokens.accessToken).toBeDefined();
            expect(response.body.data.tokens.refreshToken).toBeDefined();
        });

        it('should return 400 for missing credentials', async () => {
            const response = await request(server)
                .post('/api/v1/users/login')
                .send({})
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.error.code).toBe('VAL_001');
        });

        it('should return 401 for invalid credentials', async () => {
            const loginData = {
                email: testUser.email,
                password: 'wrongpassword'
            };

            const response = await request(server)
                .post('/api/v1/users/login')
                .send(loginData)
                .expect(401);

            expect(response.body.success).toBe(false);
            expect(response.body.error.code).toBe('AUTH_001');
        });
    });

    describe('GET /api/v1/users/profile', () => {
        it('should return 401 without authentication token', async () => {
            const response = await request(server)
                .get('/api/v1/users/profile')
                .expect(401);

            expect(response.body.success).toBe(false);
            expect(response.body.error.code).toBe('AUTH_003');
        });

        it('should return user profile with valid token', async () => {
            const response = await request(server)
                .get('/api/v1/users/profile')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toBeDefined();
        });
    });

    describe('PUT /api/v1/users/profile', () => {
        it('should return 401 without authentication token', async () => {
            const updateData = {
                firstName: 'Updated',
                lastName: 'Name'
            };

            const response = await request(server)
                .put('/api/v1/users/profile')
                .send(updateData)
                .expect(401);

            expect(response.body.success).toBe(false);
            expect(response.body.error.code).toBe('AUTH_003');
        });

        it('should update user profile with valid token', async () => {
            const updateData = {
                firstName: 'Updated',
                lastName: 'Name'
            };

            const response = await request(server)
                .put('/api/v1/users/profile')
                .set('Authorization', `Bearer ${authToken}`)
                .send(updateData)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('User updated successfully');
            expect(response.body.data).toBeDefined();
        });
    });

    describe('POST /api/v1/users/forgot-password', () => {
        it('should return 400 for missing email', async () => {
            const response = await request(server)
                .post('/api/v1/users/forgot-password')
                .send({})
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.error.code).toBe('VAL_001');
        });

        it('should return 200 for valid email', async () => {
            const response = await request(server)
                .post('/api/v1/users/forgot-password')
                .send({ email: testUser.email })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('Password reset token sent successfully');
        });
    });

    describe('POST /api/v1/users/refresh-token', () => {
        it('should return 400 for missing refresh token', async () => {
            const response = await request(server)
                .post('/api/v1/users/refresh-token')
                .send({})
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.error.code).toBe('AUTH_003');
        });

        it('should return 200 for valid refresh token', async () => {
            const refreshToken = jwt.sign(
                { userId: 'test123', email: testUser.email, roles: ['user'] },
                'test-secret',
                { expiresIn: '7d' }
            );

            const response = await request(server)
                .post('/api/v1/users/refresh-token')
                .send({ refreshToken })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('Token refreshed successfully');
            expect(response.body.data.accessToken).toBeDefined();
        });
    });

    describe('GET /health', () => {
        it('should return health status', async () => {
            const response = await request(server)
                .get('/health')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('Service is healthy');
            expect(response.body.timestamp).toBeDefined();
            expect(response.body.uptime).toBeDefined();
        });
    });

    describe('GET /', () => {
        it('should return API information', async () => {
            const response = await request(server)
                .get('/')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('Welcome to the API');
            expect(response.body.version).toBe('1.0.0');
            expect(response.body.documentation).toBe('/docs');
            expect(response.body.health).toBe('/health');
        });
    });

    describe('404 Handler', () => {
        it('should return 404 for non-existent routes', async () => {
            const response = await request(server)
                .get('/non-existent-route')
                .expect(404);

            expect(response.body.success).toBe(false);
            expect(response.body.error.code).toBe('GEN_001');
            expect(response.body.error.message).toBe('Route not found');
        });
    });
}); 