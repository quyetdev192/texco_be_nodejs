module.exports = {
    testEnvironment: 'node',

    testMatch: [
        '**/tests/**/*.test.js',
        '**/tests/**/*.spec.js'
    ],

    testFileExtensions: ['js', 'json'],

    collectCoverage: true,
    coverageDirectory: 'coverage',
    coverageReporters: [
        'text',
        'lcov',
        'html'
    ],

    coverageThreshold: {
        global: {
            branches: 70,
            functions: 70,
            lines: 70,
            statements: 70
        }
    },

    collectCoverageFrom: [
        'src/**/*.js',
        '!src/**/*.test.js',
        '!src/**/*.spec.js',
        '!src/server.js',
        '!src/app.js'
    ],

    setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],

    testTimeout: 10000,

    verbose: true,

    clearMocks: true,

    restoreMocks: true,

    moduleNameMapping: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^@config/(.*)$': '<rootDir>/src/config/$1',
        '^@modules/(.*)$': '<rootDir>/src/modules/$1',
        '^@middlewares/(.*)$': '<rootDir>/src/middlewares/$1',
        '^@utils/(.*)$': '<rootDir>/src/utils/$1',
        '^@security/(.*)$': '<rootDir>/src/security/$1'
    },

    transform: {
        '^.+\\.js$': 'babel-jest'
    },

    testPathIgnorePatterns: [
        '/node_modules/',
        '/logs/',
        '/coverage/'
    ],

    setupFiles: ['<rootDir>/tests/env.js'],

    globalSetup: '<rootDir>/tests/global-setup.js',

    globalTeardown: '<rootDir>/tests/global-teardown.js'
}; 