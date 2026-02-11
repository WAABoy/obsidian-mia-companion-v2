/**
 * Google Calendar API Integration
 * Uses Service Account authentication with JWT
 */

import { Notice, requestUrl } from 'obsidian';

export interface Calendar {
	id: string;
	summary: string;
	description?: string;
	timeZone?: string;
}

export interface CalendarEvent {
	id?: string;
	summary: string;
	description?: string;
	start: {
		dateTime?: string;
		date?: string;
		timeZone?: string;
	};
	end: {
		dateTime?: string;
		date?: string;
		timeZone?: string;
	};
	location?: string;
	status?: string;
}

interface ServiceAccountCredentials {
	type: string;
	project_id: string;
	private_key_id: string;
	private_key: string;
	client_email: string;
	client_id: string;
	auth_uri: string;
	token_uri: string;
}

interface TokenResponse {
	access_token: string;
	expires_in: number;
	token_type: string;
}

export class GoogleCalendarApi {
	private credentials: ServiceAccountCredentials | null = null;
	private accessToken: string | null = null;
	private tokenExpiry: number = 0;
	private readonly TOKEN_URL = 'https://oauth2.googleapis.com/token';
	private readonly API_BASE = 'https://www.googleapis.com/calendar/v3';
	
	constructor(private credentialsPath: string) {}
	
	/**
	 * Load service account credentials from file
	 */
	async loadCredentials(): Promise<boolean> {
		try {
			const response = await requestUrl({
				url: `file://${this.credentialsPath}`,
				method: 'GET',
			});
			this.credentials = JSON.parse(response.text);
			return true;
		} catch (error) {
			console.error('Failed to load Google service account credentials:', error);
			new Notice('Failed to load Google credentials. Check the path in settings.');
			return false;
		}
	}
	
	/**
	 * Get JWT access token using service account
	 */
	private async getAccessToken(): Promise<string | null> {
		if (this.accessToken && Date.now() < this.tokenExpiry) {
			return this.accessToken;
		}
		
		if (!this.credentials) {
			const loaded = await this.loadCredentials();
			if (!loaded) return null;
		}
		
		try {
			const now = Math.floor(Date.now() / 1000);
			const expiry = now + 3600;
			
			// Create JWT header
			const header = {
				alg: 'RS256',
				typ: 'JWT',
				kid: this.credentials!.private_key_id,
			};
			
			// Create JWT claim set
			const claimSet = {
				iss: this.credentials!.client_email,
				scope: 'https://www.googleapis.com/auth/calendar',
				aud: this.TOKEN_URL,
				iat: now,
				exp: expiry,
			};
			
			// Base64 encode
			const encodeBase64 = (obj: object): string => {
				return btoa(JSON.stringify(obj))
					.replace(/=/g, '')
					.replace(/\+/g, '-')
					.replace(/\//g, '_');
			};
			
			const headerB64 = encodeBase64(header);
			const claimSetB64 = encodeBase64(claimSet);
			
			// Create signature input
			const signatureInput = `${headerB64}.${claimSetB64}`;
			
			// Sign with private key using Web Crypto API
			const privateKey = this.credentials!.private_key
				.replace('-----BEGIN PRIVATE KEY-----', '')
				.replace('-----END PRIVATE KEY-----', '')
				.replace(/\n/g, '');
			
			const keyData = Uint8Array.from(atob(privateKey), c => c.charCodeAt(0));
			
			const cryptoKey = await crypto.subtle.importKey(
				'pkcs8',
				keyData.buffer,
				{ name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
				false,
				['sign']
			);
			
			const signature = await crypto.subtle.sign(
				'RSASSA-PKCS1-v1_5',
				cryptoKey,
				new TextEncoder().encode(signatureInput)
			);
			
			const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
				.replace(/=/g, '')
				.replace(/\+/g, '-')
				.replace(/\//g, '_');
			
			const jwt = `${signatureInput}.${signatureB64}`;
			
			// Exchange JWT for access token
			const tokenResponse = await requestUrl({
				url: this.TOKEN_URL,
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
				},
				body: new URLSearchParams({
					grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
					assertion: jwt,
				}).toString(),
			});
			
			const tokenData: TokenResponse = JSON.parse(tokenResponse.text);
			this.accessToken = tokenData.access_token;
			this.tokenExpiry = Date.now() + (tokenData.expires_in * 1000);
			
			return this.accessToken;
		} catch (error) {
			console.error('Failed to get access token:', error);
			new Notice('Failed to authenticate with Google Calendar');
			return null;
		}
	}
	
	/**
	 * Make authenticated API request
	 */
	private async apiRequest<T>(
		endpoint: string,
		method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'GET',
		body?: object
	): Promise<T | null> {
		const token = await this.getAccessToken();
		if (!token) return null;
		
		try {
			const url = `${this.API_BASE}${endpoint}`;
			const response = await requestUrl({
				url,
				method,
				headers: {
					'Authorization': `Bearer ${token}`,
					'Content-Type': 'application/json',
				},
				body: body ? JSON.stringify(body) : undefined,
			});
			
			return JSON.parse(response.text) as T;
		} catch (error) {
			console.error(`Calendar API error (${method} ${endpoint}):`, error);
			return null;
		}
	}
	
	/**
	 * List all calendars accessible to the service account
	 */
	async listCalendars(): Promise<Calendar[]> {
		interface CalendarListResponse {
			items: Calendar[];
		}
		
		const response = await this.apiRequest<CalendarListResponse>('/users/me/calendarList');
		return response?.items || [];
	}
	
	/**
	 * Create a new calendar
	 */
	async createCalendar(summary: string, description?: string): Promise<Calendar | null> {
		return this.apiRequest<Calendar>('/calendars', 'POST', {
			summary,
			description,
		});
	}
	
	/**
	 * List events from a calendar
	 */
	async listEvents(
		calendarId: string,
		options: {
			timeMin?: string;
			timeMax?: string;
			maxResults?: number;
			q?: string;
		} = {}
	): Promise<CalendarEvent[]> {
		interface EventsResponse {
			items: CalendarEvent[];
		}
		
		const params = new URLSearchParams();
		if (options.timeMin) params.append('timeMin', options.timeMin);
		if (options.timeMax) params.append('timeMax', options.timeMax);
		if (options.maxResults) params.append('maxResults', String(options.maxResults));
		if (options.q) params.append('q', options.q);
		
		const encodedId = encodeURIComponent(calendarId);
		const queryString = params.toString() ? `?${params.toString()}` : '';
		
		const response = await this.apiRequest<EventsResponse>(
			`/calendars/${encodedId}/events${queryString}`
		);
		return response?.items || [];
	}
	
	/**
	 * Create a new event
	 */
	async createEvent(
		calendarId: string,
		event: CalendarEvent
	): Promise<CalendarEvent | null> {
		const encodedId = encodeURIComponent(calendarId);
		return this.apiRequest<CalendarEvent>(
			`/calendars/${encodedId}/events`,
			'POST',
			event
		);
	}
	
	/**
	 * Create a quick event from task
	 */
	async createEventFromTask(
		calendarId: string,
		title: string,
		dueDate: Date,
		description?: string
	): Promise<CalendarEvent | null> {
		const startOfDay = new Date(dueDate);
		startOfDay.setHours(0, 0, 0, 0);
		
		const endOfDay = new Date(dueDate);
		endOfDay.setHours(23, 59, 59, 999);
		
		return this.createEvent(calendarId, {
			summary: title,
			description: description || `Task: ${title}`,
			start: {
				dateTime: startOfDay.toISOString(),
			},
			end: {
				dateTime: endOfDay.toISOString(),
			},
			status: 'confirmed',
		});
	}
}
