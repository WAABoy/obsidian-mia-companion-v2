/**
 * AuthService.ts
 * 
 * Handles JWT authentication for Google APIs, token refresh logic,
 * and service account credential loading.
 */

import { Notice } from 'obsidian';
import {
	GoogleCredentials,
	AuthToken,
	AuthState,
	MiaCompanionSettings,
} from '../types';

/**
 * Service for managing Google API authentication
 */
export class AuthService {
	private state: AuthState;
	private settings: MiaCompanionSettings;
	private refreshTimer: number | null = null;
	private readonly TOKEN_EXPIRY_BUFFER = 300; // Refresh 5 minutes before expiry
	private readonly GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
	private readonly GOOGLE_AUTH_SCOPE = 'https://www.googleapis.com/auth/tasks';

	constructor(settings: MiaCompanionSettings) {
		this.settings = settings;
		this.state = {
			isAuthenticated: false,
			token: null,
			credentials: null,
		};
	}

	/**
	 * Update settings (called when settings change)
	 */
	updateSettings(settings: MiaCompanionSettings): void {
		this.settings = settings;
		
		// If credentials changed, re-authenticate
		const currentCreds = this.state.credentials;
		const newCreds = this.getCredentialsFromSettings();
		
		if (newCreds && (!currentCreds || 
			newCreds.client_email !== currentCreds.client_email ||
			newCreds.private_key !== currentCreds.private_key)) {
			this.authenticate();
		}
	}

	/**
	 * Get current authentication state
	 */
	getAuthState(): AuthState {
		return { ...this.state };
	}

	/**
	 * Check if authenticated and token is valid
	 */
	isAuthenticated(): boolean {
		if (!this.state.isAuthenticated || !this.state.token) {
			return false;
		}
		
		// Check if token is expired
		return this.state.token.expires_at > Date.now() + (this.TOKEN_EXPIRY_BUFFER * 1000);
	}

	/**
	 * Get the current access token (refreshing if necessary)
	 */
	async getAccessToken(): Promise<string | null> {
		if (!this.isAuthenticated()) {
			const success = await this.authenticate();
			if (!success) return null;
		}
		
		return this.state.token?.access_token || null;
	}

	/**
	 * Authenticate with Google using service account JWT
	 */
	async authenticate(): Promise<boolean> {
		try {
			const credentials = this.getCredentialsFromSettings();
			
			if (!credentials) {
				this.setError('No credentials configured. Please add Google service account credentials in settings.');
				return false;
			}

			this.state.credentials = credentials;
			
			// Generate and sign JWT
			const jwt = this.generateJWT(credentials);
			
			// Exchange JWT for access token
			const token = await this.exchangeJWTForToken(jwt);
			
			if (!token) {
				return false;
			}

			this.state.token = token;
			this.state.isAuthenticated = true;
			
			// Schedule token refresh
			this.scheduleTokenRefresh(token);
			
			return true;
		} catch (error) {
			this.setError(`Authentication failed: ${error.message}`);
			return false;
		}
	}

	/**
	 * Logout and clear authentication state
	 */
	logout(): void {
		if (this.refreshTimer) {
			window.clearTimeout(this.refreshTimer);
			this.refreshTimer = null;
		}
		
		this.state = {
			isAuthenticated: false,
			token: null,
			credentials: null,
		};
	}

	/**
	 * Extract credentials from settings
	 */
	private getCredentialsFromSettings(): GoogleCredentials | null {
		const { googleClientEmail, googlePrivateKey, googleProjectId } = this.settings;
		
		if (!googleClientEmail || !googlePrivateKey) {
			return null;
		}

		return {
			client_email: googleClientEmail,
			private_key: googlePrivateKey.replace(/\\n/g, '\n'), // Handle escaped newlines
			project_id: googleProjectId || 'obsidian-mia-companion',
		};
	}

	/**
	 * Load credentials from a JSON file (for import)
	 */
	loadCredentialsFromJSON(jsonContent: string): GoogleCredentials | null {
		try {
			const parsed = JSON.parse(jsonContent);
			
			if (!parsed.client_email || !parsed.private_key) {
				throw new Error('Invalid credentials file: missing client_email or private_key');
			}

			return {
				client_email: parsed.client_email,
				private_key: parsed.private_key,
				project_id: parsed.project_id || 'obsidian-mia-companion',
				client_id: parsed.client_id,
			};
		} catch (error) {
			new Notice(`Failed to parse credentials: ${error.message}`);
			return null;
		}
	}

	/**
	 * Generate a JWT for Google service account authentication
	 */
	private generateJWT(credentials: GoogleCredentials): string {
		const header = {
			alg: 'RS256',
			typ: 'JWT',
		};

		const now = Math.floor(Date.now() / 1000);
		const claims = {
			iss: credentials.client_email,
			sub: credentials.client_email,
			scope: this.GOOGLE_AUTH_SCOPE,
			aud: this.GOOGLE_TOKEN_URL,
			iat: now,
			exp: now + 3600, // 1 hour expiry
		};

		const encodedHeader = this.base64UrlEncode(JSON.stringify(header));
		const encodedClaims = this.base64UrlEncode(JSON.stringify(claims));
		const signatureInput = `${encodedHeader}.${encodedClaims}`;
		
		const signature = this.signWithPrivateKey(signatureInput, credentials.private_key);
		
		return `${signatureInput}.${signature}`;
	}

	/**
	 * Sign data with RSA private key using Web Crypto API
	 */
	private async signWithPrivateKey(data: string, privateKeyPem: string): Promise<string> {
		try {
			// Remove PEM headers and convert to binary
			const pemContents = privateKeyPem
				.replace(/-----BEGIN PRIVATE KEY-----/g, '')
				.replace(/-----END PRIVATE KEY-----/g, '')
				.replace(/-----BEGIN RSA PRIVATE KEY-----/g, '')
				.replace(/-----END RSA PRIVATE KEY-----/g, '')
				.replace(/\s/g, '');
			
			const binaryKey = this.base64ToArrayBuffer(pemContents);
			
			// Import the private key
			const cryptoKey = await crypto.subtle.importKey(
				'pkcs8',
				binaryKey,
				{
					name: 'RSASSA-PKCS1-v1_5',
					hash: 'SHA-256',
				},
				false,
				['sign']
			);

			// Sign the data
			const encoder = new TextEncoder();
			const signature = await crypto.subtle.sign(
				'RSASSA-PKCS1-v1_5',
				cryptoKey,
				encoder.encode(data)
			);

			return this.arrayBufferToBase64Url(signature);
		} catch (error) {
			throw new Error(`Failed to sign JWT: ${error.message}`);
		}
	}

	/**
	 * Exchange JWT for an access token
	 */
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
		} catch (error) {
			this.setError(`Token exchange failed: ${error.message}`);
			return null;
		}
	}

	/**
	 * Refresh the access token
	 */
	async refreshToken(): Promise<boolean> {
		if (!this.state.credentials) {
			this.setError('Cannot refresh: no credentials available');
			return false;
		}

		try {
			const jwt = this.generateJWT(this.state.credentials);
			const token = await this.exchangeJWTForToken(jwt);
			
			if (!token) {
				return false;
			}

			this.state.token = token;
			this.state.isAuthenticated = true;
			
			this.scheduleTokenRefresh(token);
			
			return true;
		} catch (error) {
			this.setError(`Token refresh failed: ${error.message}`);
			return false;
		}
	}

	/**
	 * Schedule automatic token refresh before expiry
	 */
	private scheduleTokenRefresh(token: AuthToken): void {
		// Clear existing timer
		if (this.refreshTimer) {
			window.clearTimeout(this.refreshTimer);
		}

		// Calculate refresh time (5 minutes before expiry)
		const refreshTime = token.expires_at - Date.now() - (this.TOKEN_EXPIRY_BUFFER * 1000);
		
		if (refreshTime > 0) {
			this.refreshTimer = window.setTimeout(() => {
				this.refreshToken();
			}, refreshTime);
		}
	}

	/**
	 * Set error state and optionally show notification
	 */
	private setError(message: string): void {
		this.state.isAuthenticated = false;
		
		if (this.settings.notifyOnError) {
			new Notice(`MIA Companion: ${message}`, 5000);
		}
		
		console.error('[MIA Companion Auth]', message);
	}

	// ============================================================================
	// Utility Methods
	// ============================================================================

	/**
	 * Base64Url encode a string
	 */
	private base64UrlEncode(str: string): string {
		return btoa(str)
			.replace(/\+/g, '-')
			.replace(/\//g, '_')
			.replace(/=/g, '');
	}

	/**
	 * Convert base64 string to ArrayBuffer
	 */
	private base64ToArrayBuffer(base64: string): ArrayBuffer {
		const binaryString = atob(base64);
		const bytes = new Uint8Array(binaryString.length);
		for (let i = 0; i < binaryString.length; i++) {
			bytes[i] = binaryString.charCodeAt(i);
		}
		return bytes.buffer;
	}

	/**
	 * Convert ArrayBuffer to base64url string
	 */
	private arrayBufferToBase64Url(buffer: ArrayBuffer): string {
		const bytes = new Uint8Array(buffer);
		let binary = '';
		for (let i = 0; i < bytes.byteLength; i++) {
			binary += String.fromCharCode(bytes[i]);
		}
		return btoa(binary)
			.replace(/\+/g, '-')
			.replace(/\//g, '_')
			.replace(/=/g, '');
	}

	/**
	 * Clean up resources
	 */
	destroy(): void {
		if (this.refreshTimer) {
			window.clearTimeout(this.refreshTimer);
			this.refreshTimer = null;
		}
	}
}
