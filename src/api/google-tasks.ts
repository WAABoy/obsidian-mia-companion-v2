/**
 * Google Tasks API Integration
 */

import { Notice, requestUrl } from 'obsidian';

export interface TaskList {
	id: string;
	title: string;
	updated?: string;
}

export interface Task {
	id: string;
	title: string;
	notes?: string;
	status: 'needsAction' | 'completed';
	due?: string;
	completed?: string;
	parent?: string;
	position?: string;
	subtasks?: Task[];
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

export class GoogleTasksApi {
	private credentials: ServiceAccountCredentials | null = null;
	private accessToken: string | null = null;
	private tokenExpiry: number = 0;
	private readonly TOKEN_URL = 'https://oauth2.googleapis.com/token';
	private readonly API_BASE = 'https://tasks.googleapis.com/tasks/v1';
	
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
				scope: 'https://www.googleapis.com/auth/tasks',
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
			
			// Sign with private key
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
			new Notice('Failed to authenticate with Google Tasks');
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
			console.error(`Tasks API error (${method} ${endpoint}):`, error);
			return null;
		}
	}
	
	/**
	 * List all task lists
	 */
	async listTaskLists(): Promise<TaskList[]> {
		interface TaskListsResponse {
			items: TaskList[];
		}
		
		const response = await this.apiRequest<TaskListsResponse>('/users/@me/lists');
		return response?.items || [];
	}
	
	/**
	 * Create a new task list
	 */
	async createTaskList(title: string): Promise<TaskList | null> {
		return this.apiRequest<TaskList>('/users/@me/lists', 'POST', {
			title,
		});
	}
	
	/**
	 * Get tasks from a task list
	 */
	async getTasks(taskListId: string): Promise<Task[]> {
		interface TasksResponse {
			items: Task[];
		}
		
		const encodedId = encodeURIComponent(taskListId);
		const response = await this.apiRequest<TasksResponse>(
			`/lists/${encodedId}/tasks?showCompleted=true&showHidden=true`
		);
		
		const tasks = response?.items || [];
		
		// Organize subtasks
		const taskMap = new Map<string, Task>();
		const rootTasks: Task[] = [];
		
		tasks.forEach(task => {
			taskMap.set(task.id, { ...task, subtasks: [] });
		});
		
		tasks.forEach(task => {
			const mappedTask = taskMap.get(task.id)!;
			if (task.parent && taskMap.has(task.parent)) {
				const parent = taskMap.get(task.parent)!;
				if (!parent.subtasks) parent.subtasks = [];
				parent.subtasks.push(mappedTask);
			} else {
				rootTasks.push(mappedTask);
			}
		});
		
		return rootTasks;
	}
	
	/**
	 * Create a new task
	 */
	async createTask(
		taskListId: string,
		title: string,
		options: {
			notes?: string;
			due?: Date;
			parent?: string;
		} = {}
	): Promise<Task | null> {
		const encodedId = encodeURIComponent(taskListId);
		const body: Record<string, string> = { title };
		
		if (options.notes) body.notes = options.notes;
		if (options.due) body.due = this.formatDueDate(options.due);
		if (options.parent) body.parent = options.parent;
		
		return this.apiRequest<Task>(`/lists/${encodedId}/tasks`, 'POST', body);
	}
	
	/**
	 * Update an existing task
	 */
	async updateTask(
		taskListId: string,
		taskId: string,
		updates: Partial<Omit<Task, 'id'>>
	): Promise<Task | null> {
		const encodedListId = encodeURIComponent(taskListId);
		const encodedTaskId = encodeURIComponent(taskId);
		
		return this.apiRequest<Task>(
			`/lists/${encodedListId}/tasks/${encodedTaskId}`,
			'PATCH',
			updates
		);
	}
	
	/**
	 * Complete a task
	 */
	async completeTask(taskListId: string, taskId: string): Promise<Task | null> {
		return this.updateTask(taskListId, taskId, {
			status: 'completed',
			completed: new Date().toISOString(),
		});
	}
	
	/**
	 * Uncomplete a task
	 */
	async uncompleteTask(taskListId: string, taskId: string): Promise<Task | null> {
		return this.updateTask(taskListId, taskId, {
			status: 'needsAction',
			completed: undefined,
		});
	}
	
	/**
	 * Delete a task
	 */
	async deleteTask(taskListId: string, taskId: string): Promise<boolean> {
		const encodedListId = encodeURIComponent(taskListId);
		const encodedTaskId = encodeURIComponent(taskId);
		
		const result = await this.apiRequest<unknown>(
			`/lists/${encodedListId}/tasks/${encodedTaskId}`,
			'DELETE'
		);
		return result !== null;
	}
	
	/**
	 * Format due date for Google Tasks API (RFC 3339)
	 */
	private formatDueDate(date: Date): string {
		// Google Tasks expects date-only format for all-day tasks
		return date.toISOString().split('T')[0] + 'T00:00:00.000Z';
	}
}
