/**
 * Cookie Strategy
 * Handles session/cookie-based authentication
 */
import { BaseStrategy } from './BaseStrategy.js';

export class CookieStrategy extends BaseStrategy {
  constructor() {
    super('Cookie');
  }
  
  /**
   * Check if this strategy can handle the config
   */
  canHandle(config) {
    return config.cookies && Array.isArray(config.cookies) && config.cookies.length > 0;
  }
  
  /**
   * Execute cookie injection
   */
  async execute(config, context) {
    this.log('Executing cookie injection', { domain: config.domain, cookieCount: config.cookies.length });
    
    const targetUrl = config.targetUrl || `https://${config.domain}/`;
    const targetDomain = this.extractDomain(targetUrl);
    const isHttps = targetUrl.startsWith('https');
    
    let setCount = 0;
    let failedCount = 0;
    const failures = [];
    const setDetails = [];
    
    for (const cookie of config.cookies) {
      try {
        const result = await this.setCookie(cookie, targetDomain, isHttps);
        if (result.success) {
          setCount++;
          setDetails.push({ name: cookie.name, success: true });
        } else {
          throw new Error(result.error);
        }
      } catch (error) {
        failedCount++;
        failures.push({ 
          name: cookie.name, 
          error: error.message,
          reason: this.diagnoseCookieFailure(cookie, targetUrl, error)
        });
        setDetails.push({ name: cookie.name, success: false, error: error.message });
      }
    }
    
    // Verify cookies were set
    const verification = await this.verifyCookies(targetUrl, config.cookies);
    
    const success = setCount > 0 && failedCount === 0;
    const partial = setCount > 0 && failedCount > 0;
    
    this.log(`Cookie injection complete: ${setCount} set, ${failedCount} failed`, { verification });
    
    return {
      success,
      partial,
      strategy: this.name,
      set: setCount,
      failed: failedCount,
      failures,
      details: setDetails,
      verification,
      needsReload: success || partial
    };
  }
  
  /**
   * Set a single cookie
   */
  async setCookie(cookie, targetDomain, isHttps) {
    let cookieDomain = cookie.domain || targetDomain;
    const secure = cookie.secure === true || (cookie.secure !== false && isHttps);
    
    // Handle SameSite attribute
    let sameSite = (cookie.sameSite || 'lax').toLowerCase();
    if (sameSite === 'no_restriction' || sameSite === 'none') {
      sameSite = 'no_restriction';
    } else if (sameSite === 'strict') {
      sameSite = 'strict';
    } else {
      sameSite = 'lax';
    }
    
    // SameSite=None requires Secure
    const finalSecure = sameSite === 'no_restriction' ? true : secure;
    
    // Build cookie URL
    const protocol = finalSecure ? 'https' : 'http';
    const cleanDomain = cookieDomain.startsWith('.') ? cookieDomain.substring(1) : cookieDomain;
    const cookieUrl = `${protocol}://${cleanDomain}/`;
    
    const cookieDetails = {
      url: cookieUrl,
      name: cookie.name,
      value: cookie.value,
      path: cookie.path || '/',
      secure: finalSecure,
      httpOnly: cookie.httpOnly === true,
      sameSite: sameSite
    };
    
    // Set domain for subdomain cookies
    if (cookieDomain.startsWith('.')) {
      cookieDetails.domain = cookieDomain;
    }
    
    // Handle expiration
    if (cookie.expirationDate) {
      cookieDetails.expirationDate = cookie.expirationDate;
    } else if (cookie.expires) {
      const expiresDate = new Date(cookie.expires);
      if (!isNaN(expiresDate.getTime())) {
        cookieDetails.expirationDate = expiresDate.getTime() / 1000;
      }
    } else {
      // Default: 30 days
      cookieDetails.expirationDate = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60);
    }
    
    const result = await chrome.cookies.set(cookieDetails);
    
    if (result) {
      return { success: true, cookie: result };
    } else {
      return { success: false, error: 'chrome.cookies.set returned null' };
    }
  }
  
  /**
   * Verify cookies were set
   */
  async verifyCookies(targetUrl, expectedCookies) {
    const targetDomain = this.extractDomain(targetUrl);
    const baseDomain = this.getBaseDomain(targetDomain);
    
    try {
      // Get cookies for domain and subdomain
      const [domainCookies, subdomainCookies] = await Promise.all([
        chrome.cookies.getAll({ domain: targetDomain }),
        chrome.cookies.getAll({ domain: `.${baseDomain}` })
      ]);
      
      const allCookies = [...domainCookies, ...subdomainCookies];
      const actualNames = new Set(allCookies.map(c => c.name));
      
      const verified = [];
      const missing = [];
      
      for (const expected of expectedCookies) {
        if (actualNames.has(expected.name)) {
          verified.push(expected.name);
        } else {
          missing.push(expected.name);
        }
      }
      
      return {
        success: missing.length === 0,
        verified,
        missing,
        totalFound: allCookies.length
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        verified: [],
        missing: expectedCookies.map(c => c.name)
      };
    }
  }
  
  /**
   * Diagnose cookie failure
   */
  diagnoseCookieFailure(cookie, targetUrl, error) {
    const isHttps = targetUrl.startsWith('https');
    const targetDomain = this.extractDomain(targetUrl);
    const cookieDomain = cookie.domain || targetDomain;
    
    if (cookie.secure && !isHttps) {
      return 'SECURE_FLAG_REQUIRES_HTTPS';
    }
    
    if ((cookie.sameSite || '').toLowerCase() === 'none' && !cookie.secure) {
      return 'SAMESITE_NONE_REQUIRES_SECURE';
    }
    
    if (cookieDomain && !targetDomain.endsWith(cookieDomain.replace(/^\./, ''))) {
      return 'DOMAIN_MISMATCH';
    }
    
    return 'UNKNOWN_ERROR';
  }
  
  /**
   * Extract domain from URL
   */
  extractDomain(url) {
    try {
      return new URL(url).hostname;
    } catch (e) {
      return url;
    }
  }
  
  /**
   * Get base domain
   */
  getBaseDomain(hostname) {
    const parts = hostname.split('.');
    if (parts.length <= 2) return hostname;
    const multiPartTLDs = ['co.uk', 'com.au', 'co.nz', 'co.in', 'com.br'];
    const lastTwo = parts.slice(-2).join('.');
    if (multiPartTLDs.includes(lastTwo)) {
      return parts.slice(-3).join('.');
    }
    return parts.slice(-2).join('.');
  }
  
  /**
   * Verify login was successful by checking for session cookies
   */
  async verify(config, context) {
    const verification = await this.verifyCookies(
      config.targetUrl || `https://${config.domain}/`,
      config.cookies
    );
    return verification.success;
  }
}

export default CookieStrategy;
