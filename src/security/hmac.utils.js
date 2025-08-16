const crypto = require('crypto');
const securityConfig = require('../config/security.config');

class HmacUtils {
    constructor() {
        this.config = securityConfig.getHmacConfig();
    }

 
    generateSignature(nonce, url, timestamp, hiddenKey = '') {
        const payload = `${nonce}|${url}`;
        const secret = `${this.config.secret}${timestamp}${hiddenKey}`;

        const hmac = crypto.createHmac(this.config.algorithm, secret);
        hmac.update(payload);
        return hmac.digest('hex');
    }


    verifySignature(signature, nonce, url, timestamp, hiddenKey = '') {
        const expectedSignature = this.generateSignature(nonce, url, timestamp, hiddenKey);
        return crypto.timingSafeEqual(
            Buffer.from(signature, 'hex'),
            Buffer.from(expectedSignature, 'hex')
        );
    }

 
    extractSignatureComponents(signatureNonce) {
        if (!signatureNonce || signatureNonce.length < 14) {
            return null;
        }

        const cleanNonce = signatureNonce.split(',')[0].trim();

        if (cleanNonce.length < 14) {
            return null;
        }

        const nonce = cleanNonce.slice(0, 10);
        const hiddenKey = cleanNonce.slice(10, 14);
        const timestamp = cleanNonce.slice(14);

        return { nonce, hiddenKey, timestamp };
    }


    validateTimestamp(timestamp) {
        const requestTime = parseInt(timestamp);
        const currentTime = Date.now();

        if (isNaN(requestTime)) {
            console.log('Invalid timestamp format:', timestamp);
            return false;
        }

        const timeDiff = Math.abs(currentTime - requestTime);
        const maxAge = this.config.expiresIn * 1000; 

        console.log('  Timestamp validation:');
        console.log('  Request time:', requestTime);
        console.log('  Current time:', currentTime);
        console.log('  Time diff (ms):', timeDiff);
        console.log('  Max age (ms):', maxAge);
        console.log('  Is valid:', timeDiff <= maxAge);

        return timeDiff <= maxAge;
    }

 
    generateTimestamp() {
        return Date.now().toString();
    }

 
    createSignedHeaders(url) {
        const timestamp = this.generateTimestamp();
        const nonce = Math.random().toString(36).slice(-10);
        const hiddenKey = Math.random().toString(36).slice(-4);
        const signature = this.generateSignature(nonce, url, timestamp, hiddenKey);

        return {
            'x-signature-nonce': `${nonce}${hiddenKey}${timestamp}`,
            'x-signature': signature,
            'x-from': 'local'
        };
    }

  
    validateRequest(req) {
        const { method, path, originalUrl } = req;
        const signatureNonce = req.headers['x-signature-nonce'];
        const signature = req.headers['x-signature'];
        const from = req.headers['x-from'];

        const fullPath = originalUrl || path;

        console.log('🔍 Debug Signature Validation:');
        console.log('  Path:', path);
        console.log('  Original URL:', originalUrl);
        console.log('  Full Path:', fullPath);
        console.log('  Method:', method);
        console.log('  x-signature-nonce:', signatureNonce);
        console.log('  x-signature:', signature);
        console.log('  x-from:', from);

        if (!signatureNonce || !signature || !from) {
            return {
                valid: false,
                error: 'Missing required headers: x-signature-nonce, x-signature, x-from'
            };
        }

        const cleanSignatureNonce = signatureNonce.split(',')[0].trim();
        const cleanSignature = signature.split(',')[0].trim();
        const cleanFrom = from.split(',')[0].trim();

        console.log('🧹 Cleaned headers:');
        console.log('  x-signature-nonce:', cleanSignatureNonce);
        console.log('  x-signature:', cleanSignature);
        console.log('  x-from:', cleanFrom);

        const components = this.extractSignatureComponents(cleanSignatureNonce);
        if (!components) {
            return {
                valid: false,
                error: 'Invalid signature nonce format'
            };
        }

        const { nonce, hiddenKey, timestamp } = components;
        console.log('  Extracted components:');
        console.log('    Nonce:', nonce);
        console.log('    Hidden Key:', hiddenKey);
        console.log('    Timestamp:', timestamp);

        if (!this.validateTimestamp(timestamp)) {
            return {
                valid: false,
                error: 'Invalid timestamp or request expired'
            };
        }

        const expectedSignature = this.generateSignature(nonce, fullPath, timestamp, hiddenKey);
        console.log('  Signature comparison:');
        console.log('    Received:', cleanSignature);
        console.log('    Expected:', expectedSignature);
        console.log('    Payload:', `${nonce}|${fullPath}`);
        console.log('    Secret:', `${this.config.secret}${timestamp}${hiddenKey}`);

        if (!this.verifySignature(cleanSignature, nonce, fullPath, timestamp, hiddenKey)) {
            return {
                valid: false,
                error: 'Invalid signature'
            };
        }

        console.log('Signature validation successful!');
        return { valid: true };
    }

  
    hashData(data, salt = '') {
        const hmac = crypto.createHmac(this.config.algorithm, this.config.secret + salt);
        hmac.update(data);
        return hmac.digest('hex');
    }

   
    generateSalt(length = 16) {
        return crypto.randomBytes(length).toString('hex');
    }


    encryptData(data) {
        const iv = crypto.randomBytes(this.config.encryption.ivLength);
        const cipher = crypto.createCipher(this.config.encryption.algorithm, this.config.encryption.key);

        let encrypted = cipher.update(data, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        return {
            encrypted,
            iv: iv.toString('hex')
        };
    }

   
    decryptData(encryptedData, iv) {
        const decipher = crypto.createDecipher(this.config.encryption.algorithm, this.config.encryption.key);

        let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    }
}

module.exports = new HmacUtils(); 