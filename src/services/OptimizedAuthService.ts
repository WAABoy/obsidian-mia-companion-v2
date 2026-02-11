/**
 * OptimizedAuthService.ts - Performance-optimized authentication service
 * 
 * Optimizations:
 * - Token caching with precise expiry tracking
 * - Request deduplication for token refresh
 * - Background refresh before expiry
 * - Memory-efficient state management
 * - Cleanup management
 */

import { Notice } from 'obsidian';
import {
  GoogleCredentials,
  AuthToken,
  AuthState,
  MiaCompanionSettings,
} from '../types';
import {
  CleanupManager,
  debounce,
  memoizeWithTTL,
} from '../utils/PerformanceMonitor';

interface TokenRefreshPromise {
  promise: Promise<boolean>;
  timestamp: number;
}

export class OptimizedAuthService {
  private state: AuthState;
  private settings: MiaCompanionSettings;
  private cleanup: CleanupManager;
  
  // Token management
  private readonly TOKEN_EXPIRY_BUFFER = 300000; // Refresh 5 minutes before expiry (in ms)
  private readonly GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
  private readonly GOOGLE_AUTH_SCOPE = 'https://www.googleapis.com/auth/tasks';
  
  // Deduplication
  private refreshPromise: TokenRefreshPromise | null = null;
  private authPromise: Promise<boolean> | null = null;
  
  // Background refresh timer
  private refreshTimer: number | null = null;
  
  // Cached JWT generation
  private cachedJWT: { token: string; expires: number } | null = null;

  constructor(settings: MiaCompanionSettings) {
    this.settings = settings;
    this.cleanup = new CleanupManager();
    this.state = {
      isAuthenticated: false,
      token: null,
      credentials: null,
    };
  }

  /**
   * Update settings with debounced re-authentication
   */
  updateSettings(settings: MiaCompanionSettings): void {
    const oldSettings = this.settings;
    this.settings = settings;
    
    // Check if credentials changed
    const credsChanged = 
      oldSettings.googleClientEmail !== settings.googleClientEmail ||
      oldSettings.googlePrivateKey !== settings.googlePrivateKey;
    
    if (credsChanged && settings.googleClientEmail && settings.googlePrivateKey) {
      // Debounced re-authentication
      this.debouncedReauth();
    }
  }

  private debouncedReauth = debounce(() => {
    this.logout();
    this.authenticate();
  }, 500);

  /**
   * Get current authentication state (immutable copy)
   */
  getAuthState(): AuthState {
    return { ...this.state };
  }

  /**
   * Check if authenticated with token validity check
   */
  isAuthenticated(): boolean {
    if (!this.state.isAuthenticated || !this.state.token) {
      return false;
    }
    
    // Check if token will expire soon
    const expiresSoon = this.state.token.expires_at <= Date.now() + this.TOKEN_EXPIRY_BUFFER;
    
    if (expiresSoon) {
      // Trigger background refresh
      this.scheduleTokenRefresh(this.state.token);
    }
    
    return !expiresSoon;
  }

  /**
   * Get access token (auto-refreshes if needed)
   */
  async getAccessToken(): Promise<string | null> {
    // Fast path: valid token exists
    if (this.isAuthenticated() && this.state.token) {
      return this.state.token.access_token;
    }
    
    // Attempt authentication/refresh
    const success = await this.authenticate();
    return success ? this.state.token?.access_token || null : null;
  }

  /**
   * Authenticate with deduplication
   */
  async authenticate(): Promise<boolean> {
    // Return existing promise if authentication is in progress
    if (this.authPromise) {
      return this.authPromise;
    }
    
    this.authPromise = this.performAuthentication();
    
    try {
      const result = await this.authPromise;
      return result;
    } finally {
      this.authPromise = null;
    }
  }

  private async performAuthentication(): Promise<boolean> {
    try {
      const credentials = this.getCredentialsFromSettings();
      
      if (!credentials) {
        this.setError('No credentials configured');
        return false;
      }

      this.state.credentials = credentials;
      
      // Generate and exchange JWT
      const jwt = this.generateJWT(credentials);
      const token = await this.exchangeJWTForToken(jwt);
      
      if (!token) {
        return false;
      }

      this.state.token = token;
      this.state.isAuthenticated = true;
      
      // Schedule proactive refresh
      this.scheduleTokenRefresh(token);
      
      return true;
    } catch (error: any) {
      this.setError(`Authentication failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Refresh token with deduplication
   */
  async refreshToken(): Promise<boolean> {
    // Check if refresh is already in progress
    if (this.refreshPromise && 
        Date.now() - this.refreshPromise.timestamp < 30000) {
      return this.refreshPromise.promise;
    }
    
    if (!this.state.credentials) {
      this.setError('Cannot refresh: no credentials');
      return false;
    }

    const promise = this.performRefresh();
    this.refreshPromise = { promise, timestamp: Date.now() };
    
    try {
      const result = await promise;
      return result;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async performRefresh(): Promise<boolean> {
    try {
      const jwt = this.generateJWT(this.state.credentials!);
      const token = await this.exchangeJWTForToken(jwt);
      
      if (!token) {
        return false;
      }

      this.state.token = token;
      this.state.isAuthenticated = true;
      
      this.scheduleTokenRefresh(token);
      
      return true;
    } catch (error: any) {
      this.setError(`Token refresh failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Logout and cleanup
   */
  logout(): void {
    this.clearRefreshTimer();
    
    this.state = {
      isAuthenticated: false,
      token: null,
      credentials: null,
    };
    
    this.cachedJWT = null;
    this.authPromise = null;
    this.refreshPromise = null;
  }

  /**
   * Schedule token refresh before expiry
   */
  private scheduleTokenRefresh(token: AuthToken): void {
    this.clearRefreshTimer();
    
    const refreshTime = token.expires_at - Date.now() - this.TOKEN_EXPIRY_BUFFER;
    
    if (refreshTime > 0) {
      this.refreshTimer = window.setTimeout(() => {
        this.refreshToken().catch(console.error);
      }, refreshTime);
    }
  }

  private clearRefreshTimer(): void {
    if (this.refreshTimer) {
      window.clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  // ============================================================================
  // JWT Generation (with caching)
  // ============================================================================

  private generateJWT(credentials: GoogleCredentials): string {
    const now = Math.floor(Date.now() / 1000);
    
    // Check cached JWT
    if (this.cachedJWT && this.cachedJWT.expires > now + 60) {
      return this.cachedJWT.token;
    }

    const expiry = now + 3600; // 1 hour

    const header = {
      alg: 'RS256',
      typ: 'JWT',
    };

    const claims = {
      iss: credentials.client_email,
      sub: credentials.client_email,
      scope: this.GOOGLE_AUTH_SCOPE,
      aud: this.GOOGLE_TOKEN_URL,
      iat: now,
      exp: expiry,
    };

    const encodedHeader = this.base64UrlEncode(JSON.stringify(header));
    const encodedClaims = this.base64UrlEncode(JSON.stringify(claims));
    const signatureInput = `${encodedHeader}.${encodedClaims}`;
    
    const signature = this.signWithPrivateKey(signatureInput, credentials.private_key);
    const token = `${signatureInput}.${signature}`;
    
    // Cache the JWT
    this.cachedJWT = { token, expires: expiry };
    
    return token;
  }

  private signWithPrivateKey(data: string, privateKeyPem: string): string {
    // Note: In browser environment, use Web Crypto API
    // This is a simplified version - actual implementation would use proper crypto
    try {
      const pemContents = privateKeyPem
        .replace(/-----BEGIN (RSA )?PRIVATE KEY-----/g, '')
        .replace(/-----END (RSA )?PRIVATE KEY-----/g, '')
        .replace(/\s/g, '');
      
      // Placeholder - actual signing would use crypto.subtle
      return this.base64UrlEncode(pemContents.substring(0, 32));
    } catch (error: any) {
      throw new Error(`Failed to sign JWT: ${error.message}`);
    }
  }

  // ============================================================================
  // Token Exchange
  // ============================================================================

  private async exchangeJWTForToken(jwt: string): Promise<AuthToken | null> {
    try {
      const response = await fetch(this.GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          assertion: jwt,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Token exchange failed: ${error}`);
      }

      const data = await response.json();
      
      return {
        access_token: data.access_token,
        expires_in: data.expires_in,
        token_type: data.token_type,
        expires_at: Date.now() + (data.expires_in * 1000),
      };
    } catch (error: any) {
      this.setError(`Token exchange failed: ${error.message}`);
      return null;
    }
  }

  // ============================================================================
  // Credentials
  // ============================================================================

  private getCredentialsFromSettings(): GoogleCredentials | null {
    const { googleClientEmail, googlePrivateKey, googleProjectId } = this.settings;
    
    if (!googleClientEmail || !googlePrivateKey) {
      return null;
    }

    return {
      client_email: googleClientEmail,
      private_key: googlePrivateKey.replace(/\\n/g, '\n'),
      project_id: googleProjectId || 'obsidian-mia-companion',
    };
  }

  loadCredentialsFromJSON(jsonContent: string): GoogleCredentials | null {
    try {
      const parsed = JSON.parse(jsonContent);
      
      if (!parsed.client_email || !parsed.private_key) {
        throw new Error('Invalid credentials: missing client_email or private_key');
      }

      return {
        client_email: parsed.client_email,
        private_key: parsed.private_key,
        project_id: parsed.project_id || 'obsidian-mia-companion',
        client_id: parsed.client_id,
      };
    } catch (error: any) {
      new Notice(`Failed to parse credentials: ${error.message}`);
      return null;
    }
  }

  // ============================================================================
  // Error Handling
  // ============================================================================

  private setError(message: string): void {
    this.state.isAuthenticated = false;
    
    if (this.settings.notifyOnError) {
      new Notice(`MIA Companion: ${message}`, 5000);
    }
    
    console.error('[OptimizedAuth]', message);
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  private base64UrlEncode(str: string): string {
    return btoa(str)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  destroy(): void {
    this.cleanup.cleanup();
    this.logout();
  }
}

export default OptimizedAuthService;
