const crypto = require('crypto');

// Get encryption key from env or generate one
const ENCRYPTION_KEY = process.env.COOKIES_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');

if (!process.env.COOKIES_ENCRYPTION_KEY) {
  console.warn('⚠️  COOKIES_ENCRYPTION_KEY not set in environment. Using temporary key.');
}

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Encrypt cookies JSON
 * @param {string} cookiesJson - JSON string of cookies
 * @returns {string} Encrypted string with IV and auth tag
 */
function encryptCookies(cookiesJson) {
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const key = Buffer.from(ENCRYPTION_KEY, 'hex');
    
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(cookiesJson, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // Combine: iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  } catch (error) {
    console.error('Encryption error:', error.message);
    throw new Error('Failed to encrypt cookies');
  }
}

/**
 * Decrypt cookies
 * @param {string} encryptedData - Encrypted string with IV and auth tag
 * @returns {string} Decrypted JSON string
 */
function decryptCookies(encryptedData) {
  try {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }
    
    const [ivHex, authTagHex, encrypted] = parts;
    
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const key = Buffer.from(ENCRYPTION_KEY, 'hex');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error.message);
    throw new Error('Failed to decrypt cookies');
  }
}

/**
 * Validate and parse cookies JSON
 * @param {string} cookiesJson - JSON string to validate
 * @returns {boolean} True if valid JSON
 */
function validateCookiesJson(cookiesJson) {
  try {
    JSON.parse(cookiesJson);
    return true;
  } catch (error) {
    return false;
  }
}

module.exports = {
  encryptCookies,
  decryptCookies,
  validateCookiesJson
};
