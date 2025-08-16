const i18nConfig = require('../config/i18n.config');
const logger = require('../config/logger.config');

const setLanguage = (req, res, next) => {
    try {
        let language = req.query.lang ||
            req.headers['accept-language'] ||
            req.cookies?.language ||
            'en';

        language = normalizeLanguage(language);

        req.language = language;
        req.lng = language;

        req.t = (key, options = {}) => {
            return i18nConfig.t(key, { ...options, lng: language });
        };

        res.set('Content-Language', language);

        next();
    } catch (error) {
        logger.error('Language middleware error', {
            path: req.path,
            method: req.method,
            ip: req.ip,
            error: error.message
        });

        req.language = 'en';
        req.lng = 'en';
        req.t = (key, options = {}) => {
            return i18nConfig.t(key, { ...options, lng: 'en' });
        };

        next();
    }
};

const normalizeLanguage = (language) => {
    if (!language) return 'en';

    const primaryLang = language.split('-')[0].toLowerCase();

    const supportedLanguages = ['en', 'vi'];

    if (supportedLanguages.includes(primaryLang)) {
        return primaryLang;
    }

    return 'en';
};

const setLanguageCookie = (req, res, next) => {
    if (!req.cookies?.language) {
        res.cookie('language', req.language || 'en', {
            maxAge: 365 * 24 * 60 * 60 * 1000,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict'
        });
    }

    next();
};

const changeLanguage = (req, res, next) => {
    try {
        const newLanguage = req.body.language || req.query.language;

        if (newLanguage) {
            const normalizedLang = normalizeLanguage(newLanguage);

            req.language = normalizedLang;
            req.lng = normalizedLang;

            req.t = (key, options = {}) => {
                return i18nConfig.t(key, { ...options, lng: normalizedLang });
            };

            res.cookie('language', normalizedLang, {
                maxAge: 365 * 24 * 60 * 60 * 1000, 
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict'
            });

            res.set('Content-Language', normalizedLang);

            logger.info('Language changed', {
                path: req.path,
                method: req.method,
                ip: req.ip,
                oldLanguage: req.cookies?.language,
                newLanguage: normalizedLang
            });
        }

        next();
    } catch (error) {
        logger.error('Language change error', {
            path: req.path,
            method: req.method,
            ip: req.ip,
            error: error.message
        });

        next();
    }
};


const getAvailableLanguages = (req, res, next) => {
    try {
        req.availableLanguages = i18nConfig.getLanguages();
        next();
    } catch (error) {
        logger.error('Get available languages error', {
            path: req.path,
            method: req.method,
            ip: req.ip,
            error: error.message
        });

        req.availableLanguages = ['en', 'vi'];
        next();
    }
};


const validateLanguage = (req, res, next) => {
    const language = req.params.language || req.query.language;

    if (language) {
        const supportedLanguages = ['en', 'vi'];

        if (!supportedLanguages.includes(language.toLowerCase())) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_LANGUAGE',
                    message: `Unsupported language: ${language}. Supported languages: ${supportedLanguages.join(', ')}`
                }
            });
        }
    }

    next();
};


const addLanguageInfo = (req, res, next) => {
    res.set('X-Request-Language', req.language || 'en');
    res.set('X-Available-Languages', (req.availableLanguages || ['en', 'vi']).join(','));

    next();
};

const handleLanguageContent = (req, res, next) => {
    try {
        const language = req.language || 'en';

        if (language === 'vi') {
            req.contentLocale = 'vi-VN';
        } else {
            req.contentLocale = 'en-US';
        }

        req.dateLocale = language === 'vi' ? 'vi-VN' : 'en-US';

        next();
    } catch (error) {
        logger.error('Language content handling error', {
            path: req.path,
            method: req.method,
            ip: req.ip,
            error: error.message
        });

        req.contentLocale = 'en-US';
        req.dateLocale = 'en-US';
        next();
    }
};

module.exports = {
    setLanguage,
    setLanguageCookie,
    changeLanguage,
    getAvailableLanguages,
    validateLanguage,
    addLanguageInfo,
    handleLanguageContent,
    normalizeLanguage
}; 