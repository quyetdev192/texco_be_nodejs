const i18next = require('i18next');
const Backend = require('i18next-fs-backend');
const middleware = require('i18next-http-middleware');

class I18nConfig {
    constructor() {
        this.isInitialized = false;
    }

    async init() {
        if (this.isInitialized) return;

        try {
            await i18next
                .use(Backend)
                .use(middleware.LanguageDetector)
                .init({
                    backend: {
                        loadPath: './locales/{{lng}}/translation.json',
                    },
                    fallbackLng: 'en',
                    preload: ['en', 'vi'],
                    ns: ['translation'],
                    defaultNS: 'translation',
                    detection: {
                        order: ['header', 'querystring', 'cookie'],
                        lookupHeader: 'accept-language',
                        lookupQuerystring: 'lng',
                        lookupCookie: 'i18next',
                        caches: ['cookie'],
                        cookieExpirationDate: new Date(),
                        cookieMaxAge: 365 * 24 * 60 * 60 * 1000, 
                    },
                    interpolation: {
                        escapeValue: false,
                    },
                });

            this.isInitialized = true;
            console.log('i18n initialized successfully');
        } catch (error) {
            console.error('i18n initialization error:', error);
            throw error;
        }
    }

    getMiddleware() {
        if (!this.isInitialized) {
            throw new Error('i18n not initialized. Call init() first.');
        }
        return middleware.handle(i18next);
    }

    t(key, options = {}) {
        if (!this.isInitialized) {
            throw new Error('i18n not initialized. Call init() first.');
        }
        return i18next.t(key, options);
    }

    changeLanguage(lng) {
        if (!this.isInitialized) {
            throw new Error('i18n not initialized. Call init() first.');
        }
        return i18next.changeLanguage(lng);
    }

    getLanguage() {
        if (!this.isInitialized) {
            throw new Error('i18n not initialized. Call init() first.');
        }
        return i18next.language;
    }

    getLanguages() {
        if (!this.isInitialized) {
            throw new Error('i18n not initialized. Call init() first.');
        }
        return i18next.languages;
    }
}

module.exports = new I18nConfig(); 