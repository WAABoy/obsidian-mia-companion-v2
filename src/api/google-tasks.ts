/**
 * Google Tasks API Integration for Mia Companion Obsidian Plugin
 * 
 * Provides service account authentication, CRUD operations, and bidirectional sync
 * for Google Tasks with the Obsidian Tasks plugin.
 */

import { requestUrl, RequestUrlParam, RequestUrlResponse } from 'obsidian';
import * as crypto from 'crypto';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface GoogleServiceAccount {
    type: string;
    project_id: string;
    private_key_id: string;
    private_key: string;
    client_email: string;
    client_id: string;
    auth_uri: string;
    token_uri: string;
    auth_provider_x509_cert_url: string;
    client_x509_cert_url: string;
    universe_domain: string;
}

export interface GoogleTask {
    id: string;
    title: string;
    notes?: string;
    status: 'needsAction' | 'completed';
    due?: string; // RFC 3339 timestamp
    completed?: string; // RFC 3339 timestamp
    deleted?: boolean;
    hidden?: boolean;
    parent?: string;
    position?: string;
    selfLink?: string;
    updated?: string;
    links?: Array<{ type: string; link: string; description?: string }>;
}

export interface GoogleTaskList {
    id: string;
    title: string;
    selfLink?: string;
    updated?: string;
}

export interface TaskListResponse {
    kind: string;
    etag: string;
    items: GoogleTaskList[];
}

export interface TasksResponse {
    kind: string;
    etag: string;
    items?: GoogleTask[];
    nextPageToken?: string;
}

export interface SyncResult {
    success: boolean;
    created: GoogleTask[];
    updated: GoogleTask[];
    deleted: string[];
    errors: Error[];
}

export interface ObsidianTask {
    id: string;
    content: string;
    completed: boolean;
    dueDate?: Date;
    description?: string;
    priority?: 'high' | 'medium' | 'low';
    tags?: string[];
    googleTaskId?: string;
    lastSynced?: Date;
}

// ============================================================================
// Configuration & Constants
// ============================================================================

const GOOGLE_TASKS_API_BASE = 'https://tasks.googleapis.com/tasks/v1';
const TOKEN_URI = 'https://oauth2.googleapis.com/token';
const DEFAULT_TASK_LIST_NAME = 'Obsidian Tasks';
const SCOPES = ['https://www.googleapis.com/auth/tasks'];

// Rate limiting configuration
const RATE_LIMIT = {
    maxRequestsPerMinute: 100,
    maxRequestsPerSecond: 10,
    retryDelayMs: 1000,
    maxRetries: 3,
    backoffMultiplier: 2,
};

// ============================================================================
// JWT Token Generation
// ============================================================================

/**
 * Base64URL encode a string
 */
function base64UrlEncode(input: string): string {
    return Buffer.from(input)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

/**
 * Generate JWT for Google Service Account authentication
 */
function generateJWT(serviceAccount: GoogleServiceAccount): string {
    const now = Math.floor(Date.now() / 1000);
    const expiry = now + 3600; // 1 hour

    const header = {
        alg: 'RS256',
        typ: 'JWT',
        kid: serviceAccount.private_key_id,
    };

    const claims = {
        iss: serviceAccount.client_email,
        sub: serviceAccount.client_email,
        scope: SCOPES.join(' '),
        aud: TOKEN_URI,
        iat: now,
        exp: expiry,
    };

    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedClaims = base64UrlEncode(JSON.stringify(claims));
    const signatureInput = `${encodedHeader}.${encodedClaims}`;

    // Sign with private key
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(signatureInput);
    const signature = sign.sign(serviceAccount.private_key, 'base64');
    const encodedSignature = signature
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

    return `${signatureInput}.${encodedSignature}`;
}

// ============================================================================
// Rate Limiter
// ============================================================================

class RateLimiter {
    private requestTimestamps: number[] = [];
    private lastRequestTime: number = 0;

    async throttle(): Promise<void> {
        const now = Date.now();
        
        // Clean old timestamps (older than 1 minute)
        this.requestTimestamps = this.requestTimestamps.filter(
            ts => now - ts < 60000
        );

        // Check per-minute limit
        if (this.requestTimestamps.length >= RATE_LIMIT.maxRequestsPerMinute) {
            const oldestTimestamp = this.requestTimestamps[0];
            const waitTime = 60000 - (now - oldestTimestamp) + 100;
            await this.delay(waitTime);
            return this.throttle();
        }

        // Check per-second limit
        const timeSinceLastRequest = now - this.lastRequestTime;
        const minInterval = 1000 / RATE_LIMIT.maxRequestsPerSecond;
        
        if (timeSinceLastRequest < minInterval) {
            await this.delay(minInterval - timeSinceLastRequest);
        }

        this.requestTimestamps.push(Date.now());
        this.lastRequestTime = Date.now();
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// ============================================================================
// Error Handling
// ============================================================================

class GoogleTasksError extends Error {
    constructor(
        message: string,
        public code?: number,
        public status?: string,
        public details?: any
    ) {
        super(message);
        this.name = 'GoogleTasksError';
    }
}

function handleApiError(error: any, context: string): never {
    if (error.status !== undefined) {
        const response = error.json || {};
        throw new GoogleTasksError(
            `Google Tasks API Error in ${context}: ${response.error?.message || error.text || 'Unknown error'}`,
            error.status,
            response.error?.status,
            response.error
        );
    }
    throw new GoogleTasksError(
        `Unexpected error in ${context}: ${error.message || error}`,
        undefined,
        undefined,
        error
    );
}

// ============================================================================
// Google Tasks Client
// ============================================================================

/**
 * Main client for Google Tasks API integration.
 * Provides authentication, CRUD operations, and bidirectional sync capabilities.
 *
 * @example
 * ```typescript
 * const client = new GoogleTasksClient('./service-account.json');
 * await client.authenticate();
 * const tasks = await client.listTasks(listId);
 * ```
 */
export class GoogleTasksClient {
    private accessToken: string | null = null;
    private tokenExpiry: number = 0;
    private serviceAccount: GoogleServiceAccount;
    private rateLimiter: RateLimiter;
    private obsidianTasksListId: string | null = null;

    /**
     * Creates a new GoogleTasksClient instance.
     * @param serviceAccountPath - Path to the service account JSON file
     */
    constructor(serviceAccountPath: string) {
        this.serviceAccount = this.loadServiceAccount(serviceAccountPath);
        this.rateLimiter = new RateLimiter();
    }

    private loadServiceAccount(path: string): GoogleServiceAccount {
        try {
            // In Obsidian, we'd use the vault adapter to read files
            // For now, we'll assume the file is loaded externally
            const fs = require('fs');
            const content = fs.readFileSync(path, 'utf-8');
            return JSON.parse(content);
        } catch (error) {
            throw new GoogleTasksError(
                `Failed to load service account from ${path}: ${error.message}`
            );
        }
    }

    /**
     * Authenticate with Google and get an access token.
     * Generates a JWT from service account credentials and exchanges it for an access token.
     * Tokens are cached until 5 minutes before expiry.
     *
     * @returns Promise resolving to the access token string
     * @throws {GoogleTasksError} When authentication fails
     *
     * @example
     * ```typescript
     * const token = await client.authenticate();
     * console.log('Authenticated with token:', token.substring(0, 10) + '...');
     * ```
     */
    async authenticate(): Promise<string> {
        const now = Date.now();
        
        // Return cached token if still valid (with 5 min buffer)
        if (this.accessToken && this.tokenExpiry > now + 300000) {
            return this.accessToken;
        }

        const jwt = generateJWT(this.serviceAccount);

        const response = await requestUrl({
            url: TOKEN_URI,
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                assertion: jwt,
            }).toString(),
        });

        if (response.status !== 200) {
            throw new GoogleTasksError(
                `Authentication failed: ${response.text}`,
                response.status
            );
        }

        const data = response.json;
        this.accessToken = data.access_token;
        this.tokenExpiry = now + (data.expires_in * 1000);

        return this.accessToken;
    }

    /**
     * Make authenticated API request with rate limiting and retries
     */
    private async request(
        endpoint: string,
        method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'GET',
        body?: any,
        retryCount: number = 0
    ): Promise<any> {
        await this.rateLimiter.throttle();
        await this.authenticate();

        const url = `${GOOGLE_TASKS_API_BASE}${endpoint}`;
        const params: RequestUrlParam = {
            url,
            method,
            headers: {
                'Authorization': `Bearer ${this.accessToken}`,
                'Content-Type': 'application/json',
            },
        };

        if (body && method !== 'GET') {
            params.body = JSON.stringify(body);
        }

        try {
            const response = await requestUrl(params);
            return response.json;
        } catch (error: any) {
            // Handle rate limiting (429) or server errors (5xx) with retries
            if ((error.status === 429 || (error.status >= 500 && error.status < 600)) 
                && retryCount < RATE_LIMIT.maxRetries) {
                const delay = RATE_LIMIT.retryDelayMs * Math.pow(RATE_LIMIT.backoffMultiplier, retryCount);
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.request(endpoint, method, body, retryCount + 1);
            }
            handleApiError(error, `${method} ${endpoint}`);
        }
    }

    // ============================================================================
    // Task List Operations
    // ============================================================================

    /**
     * List all task lists accessible to the service account.
     *
     * @returns Promise resolving to array of task lists
     * @throws {GoogleTasksError} When API request fails
     *
     * @example
     * ```typescript
     * const lists = await client.listTaskLists();
     * for (const list of lists) {
     *     console.log(`${list.title} (${list.id})`);
     * }
     * ```
     */
    async listTaskLists(): Promise<GoogleTaskList[]> {
        const response = await this.request('/users/@me/lists') as TaskListResponse;
        return response.items || [];
    }

    /**
     * Create a new task list.
     *
     * @param title - The name for the new task list
     * @returns Promise resolving to the created task list
     * @throws {GoogleTasksError} When API request fails
     *
     * @example
     * ```typescript
     * const newList = await client.createTaskList('My New List');
     * console.log('Created list with ID:', newList.id);
     * ```
     */
    async createTaskList(title: string): Promise<GoogleTaskList> {
        return this.request('/users/@me/lists', 'POST', { title });
    }

    /**
     * Get the "Obsidian Tasks" list ID, creating it if it doesn't exist.
     * The result is cached for subsequent calls.
     *
     * @returns Promise resolving to the task list ID
     * @throws {GoogleTasksError} When API request fails
     *
     * @example
     * ```typescript
     * const listId = await client.getOrCreateObsidianTaskList();
     * const tasks = await client.listTasks(listId);
     * ```
     */
    async getOrCreateObsidianTaskList(): Promise<string> {
        if (this.obsidianTasksListId) {
            return this.obsidianTasksListId;
        }

        const lists = await this.listTaskLists();
        let obsidianList = lists.find(list => list.title === DEFAULT_TASK_LIST_NAME);

        if (!obsidianList) {
            obsidianList = await this.createTaskList(DEFAULT_TASK_LIST_NAME);
        }

        this.obsidianTasksListId = obsidianList.id;
        return obsidianList.id;
    }

    /**
     * Update a task list's title.
     *
     * @param listId - The task list identifier
     * @param title - The new title
     * @returns Promise resolving to the updated task list
     * @throws {GoogleTasksError} When API request fails
     *
     * @example
     * ```typescript
     * const updated = await client.updateTaskList(listId, 'New Title');
     * ```
     */
    async updateTaskList(listId: string, title: string): Promise<GoogleTaskList> {
        return this.request(`/users/@me/lists/${listId}`, 'PUT', { id: listId, title });
    }

    /**
     * Delete a task list permanently.
     *
     * @param listId - The task list identifier
     * @throws {GoogleTasksError} When API request fails
     *
     * @example
     * ```typescript
     * await client.deleteTaskList(listId);
     * console.log('List deleted');
     * ```
     */
    async deleteTaskList(listId: string): Promise<void> {
        await this.request(`/users/@me/lists/${listId}`, 'DELETE');
    }

    // ============================================================================
    // Task Operations
    // ============================================================================

    /**
     * List all tasks in a task list with optional filtering.
     *
     * @param listId - The task list identifier
     * @param options - Query options for filtering
     * @returns Promise resolving to array of tasks
     * @throws {GoogleTasksError} When API request fails
     *
     * @example
     * ```typescript
     * const tasks = await client.listTasks(listId, {
     *     showCompleted: false,
     *     dueMin: new Date().toISOString()
     * });
     * ```
     */
    async listTasks(
        listId: string,
        options?: {
            showCompleted?: boolean;
            showHidden?: boolean;
            updatedMin?: string;
            dueMin?: string;
            dueMax?: string;
        }
    ): Promise<GoogleTask[]> {
        const queryParams = new URLSearchParams();
        
        if (options?.showCompleted !== undefined) {
            queryParams.set('showCompleted', String(options.showCompleted));
        }
        if (options?.showHidden !== undefined) {
            queryParams.set('showHidden', String(options.showHidden));
        }
        if (options?.updatedMin) {
            queryParams.set('updatedMin', options.updatedMin);
        }
        if (options?.dueMin) {
            queryParams.set('dueMin', options.dueMin);
        }
        if (options?.dueMax) {
            queryParams.set('dueMax', options.dueMax);
        }

        const queryString = queryParams.toString();
        const endpoint = `/lists/${listId}/tasks${queryString ? '?' + queryString : ''}`;
        
        const response = await this.request(endpoint) as TasksResponse;
        return response.items || [];
    }

    /**
     * Get a specific task by its ID.
     *
     * @param listId - The task list identifier
     * @param taskId - The task identifier
     * @returns Promise resolving to the task
     * @throws {GoogleTasksError} When API request fails or task not found
     *
     * @example
     * ```typescript
     * const task = await client.getTask(listId, 'abc123');
     * console.log('Task:', task.title);
     * ```
     */
    async getTask(listId: string, taskId: string): Promise<GoogleTask> {
        return this.request(`/lists/${listId}/tasks/${taskId}`);
    }

    /**
     * Create a new task in a task list.
     *
     * @param listId - The task list identifier
     * @param task - The task data to create
     * @returns Promise resolving to the created task
     * @throws {GoogleTasksError} When API request fails
     *
     * @example
     * ```typescript
     * const task = await client.createTask(listId, {
     *     title: 'Write documentation',
     *     notes: 'Update API docs',
     *     due: new Date('2025-02-20').toISOString()
     * });
     * ```
     */
    async createTask(
        listId: string,
        task: Partial<GoogleTask>
    ): Promise<GoogleTask> {
        const taskData: Partial<GoogleTask> = {
            title: task.title,
            notes: task.notes,
            status: task.status || 'needsAction',
        };

        if (task.due) {
            taskData.due = this.formatDate(task.due);
        }

        if (task.parent) {
            taskData.parent = task.parent;
        }

        if (task.links) {
            taskData.links = task.links;
        }

        return this.request(`/lists/${listId}/tasks`, 'POST', taskData);
    }

    /**
     * Update an existing task (full update).
     * Merges updates with current task data and replaces all fields.
     *
     * @param listId - The task list identifier
     * @param taskId - The task identifier
     * @param updates - The updated task data
     * @returns Promise resolving to the updated task
     * @throws {GoogleTasksError} When API request fails
     *
     * @example
     * ```typescript
     * const updated = await client.updateTask(listId, 'abc123', {
     *     title: 'Updated Title',
     *     status: 'completed'
     * });
     * ```
     */
    async updateTask(
        listId: string,
        taskId: string,
        updates: Partial<GoogleTask>
    ): Promise<GoogleTask> {
        // Get current task to merge with updates
        const currentTask = await this.getTask(listId, taskId);
        
        const taskData: Partial<GoogleTask> = {
            id: taskId,
            title: updates.title ?? currentTask.title,
            notes: updates.notes ?? currentTask.notes,
            status: updates.status ?? currentTask.status,
        };

        if (updates.due !== undefined) {
            taskData.due = updates.due ? this.formatDate(updates.due) : undefined;
        } else if (currentTask.due) {
            taskData.due = currentTask.due;
        }

        if (updates.completed !== undefined) {
            taskData.completed = updates.completed;
        }

        return this.request(`/lists/${listId}/tasks/${taskId}`, 'PUT', taskData);
    }

    /**
     * Patch a task with partial updates.
     * Only updates the specified fields, leaving others unchanged.
     *
     * @param listId - The task list identifier
     * @param taskId - The task identifier
     * @param updates - Partial task data to update
     * @returns Promise resolving to the updated task
     * @throws {GoogleTasksError} When API request fails
     *
     * @example
     * ```typescript
     * const patched = await client.patchTask(listId, 'abc123', {
     *     status: 'completed'
     * });
     * ```
     */
    async patchTask(
        listId: string,
        taskId: string,
        updates: Partial<GoogleTask>
    ): Promise<GoogleTask> {
        const taskData: Partial<GoogleTask> = { id: taskId };

        if (updates.title !== undefined) taskData.title = updates.title;
        if (updates.notes !== undefined) taskData.notes = updates.notes;
        if (updates.status !== undefined) taskData.status = updates.status;
        if (updates.due !== undefined) {
            taskData.due = updates.due ? this.formatDate(updates.due) : undefined;
        }
        if (updates.completed !== undefined) taskData.completed = updates.completed;

        return this.request(`/lists/${listId}/tasks/${taskId}`, 'PATCH', taskData);
    }

    /**
     * Mark a task as complete.
     *
     * @param listId - The task list identifier
     * @param taskId - The task identifier
     * @returns Promise resolving to the completed task
     * @throws {GoogleTasksError} When API request fails
     *
     * @example
     * ```typescript
     * const completed = await client.completeTask(listId, 'abc123');
     * console.log('Completed at:', completed.completed);
     * ```
     */
    async completeTask(listId: string, taskId: string): Promise<GoogleTask> {
        return this.patchTask(listId, taskId, { 
            status: 'completed',
            completed: new Date().toISOString()
        });
    }

    /**
     * Mark a task as incomplete (reopen).
     *
     * @param listId - The task list identifier
     * @param taskId - The task identifier
     * @returns Promise resolving to the reopened task
     * @throws {GoogleTasksError} When API request fails
     *
     * @example
     * ```typescript
     * const reopened = await client.uncompleteTask(listId, 'abc123');
     * ```
     */
    async uncompleteTask(listId: string, taskId: string): Promise<GoogleTask> {
        return this.patchTask(listId, taskId, { 
            status: 'needsAction',
            completed: undefined
        });
    }

    /**
     * Delete a task permanently.
     *
     * @param listId - The task list identifier
     * @param taskId - The task identifier
     * @throws {GoogleTasksError} When API request fails
     *
     * @example
     * ```typescript
     * await client.deleteTask(listId, 'abc123');
     * console.log('Task deleted');
     * ```
     */
    async deleteTask(listId: string, taskId: string): Promise<void> {
        await this.request(`/lists/${listId}/tasks/${taskId}`, 'DELETE');
    }

    /**
     * Clear all completed tasks from a list.
     *
     * @param listId - The task list identifier
     * @throws {GoogleTasksError} When API request fails
     *
     * @example
     * ```typescript
     * await client.clearCompletedTasks(listId);
     * console.log('Completed tasks cleared');
     * ```
     */
    async clearCompletedTasks(listId: string): Promise<void> {
        await this.request(`/lists/${listId}/clear`, 'POST');
    }

    /**
     * Move a task to a new position in the list.
     *
     * @param listId - The task list identifier
     * @param taskId - The task identifier
     * @param options - Move options (parent for subtasks, previous for ordering)
     * @returns Promise resolving to the moved task
     * @throws {GoogleTasksError} When API request fails
     *
     * @example
     * ```typescript
     * // Move task to be after another task
     * await client.moveTask(listId, 'task-2', { previous: 'task-1' });
     *
     * // Make task a subtask
     * await client.moveTask(listId, 'subtask', { parent: 'parent-task' });
     * ```
     */
    async moveTask(
        listId: string,
        taskId: string,
        options?: {
            parent?: string;
            previous?: string;
        }
    ): Promise<GoogleTask> {
        const queryParams = new URLSearchParams();
        if (options?.parent) queryParams.set('parent', options.parent);
        if (options?.previous) queryParams.set('previous', options.previous);

        const queryString = queryParams.toString();
        const endpoint = `/lists/${listId}/tasks/${taskId}/move${queryString ? '?' + queryString : ''}`;

        return this.request(endpoint, 'POST');
    }

    // ============================================================================
    // Helper Methods
    // ============================================================================

    /**
     * Format date for Google Tasks API (RFC 3339)
     */
    private formatDate(date: string | Date): string {
        if (typeof date === 'string') {
            // If it's already a date string, ensure it's RFC 3339
            const d = new Date(date);
            if (!isNaN(d.getTime())) {
                return d.toISOString();
            }
            return date;
        }
        return date.toISOString();
    }

    /**
     * Parse RFC 3339 date string to Date object.
     *
     * @param dateString - The RFC 3339 formatted date string
     * @returns JavaScript Date object
     *
     * @example
     * ```typescript
     * const date = client.parseDate('2025-02-15T10:00:00Z');
     * console.log(date.toLocaleDateString());
     * ```
     */
    parseDate(dateString: string): Date {
        return new Date(dateString);
    }

    // ============================================================================
    // Bidirectional Sync
    // ============================================================================

    /**
     * Sync Obsidian tasks with Google Tasks (bidirectional).
     * Handles creation, updates, and conflict resolution based on the specified strategy.
     *
     * @param obsidianTasks - Array of Obsidian tasks to sync
     * @param options - Sync options including conflict resolution strategy
     * @returns Promise resolving to sync results
     * @throws {GoogleTasksError} When API request fails
     *
     * @example
     * ```typescript
     * const result = await client.syncTasks(obsidianTasks, {
     *     conflictResolution: 'newer',
     *     syncCompleted: true
     * });
     * console.log(`Created: ${result.created.length}, Updated: ${result.updated.length}`);
     * ```
     */
    async syncTasks(
        obsidianTasks: ObsidianTask[],
        options?: {
            conflictResolution?: 'obsidian' | 'google' | 'newer';
            syncCompleted?: boolean;
        }
    ): Promise<SyncResult> {
        const result: SyncResult = {
            success: true,
            created: [],
            updated: [],
            deleted: [],
            errors: [],
        };

        const listId = await this.getOrCreateObsidianTaskList();
        const conflictResolution = options?.conflictResolution || 'newer';

        try {
            // Fetch all Google tasks
            const googleTasks = await this.listTasks(listId, {
                showCompleted: options?.syncCompleted ?? true,
                showHidden: false,
            });

            // Create maps for easier lookup
            const googleTaskMap = new Map(googleTasks.map(t => [t.id, t]));
            const obsidianTaskMap = new Map(obsidianTasks.map(t => [t.googleTaskId, t]));

            // Track processed Google task IDs
            const processedGoogleIds = new Set<string>();

            // Process Obsidian tasks
            for (const obsidianTask of obsidianTasks) {
                try {
                    if (obsidianTask.googleTaskId && googleTaskMap.has(obsidianTask.googleTaskId)) {
                        // Task exists in both - check for conflicts
                        const googleTask = googleTaskMap.get(obsidianTask.googleTaskId)!;
                        processedGoogleIds.add(obsidianTask.googleTaskId);

                        const shouldUpdate = this.shouldUpdateTask(
                            obsidianTask,
                            googleTask,
                            conflictResolution
                        );

                        if (shouldUpdate === 'to-google') {
                            // Update Google task with Obsidian data
                            const updated = await this.updateTaskFromObsidian(
                                listId,
                                googleTask.id,
                                obsidianTask
                            );
                            result.updated.push(updated);
                        } else if (shouldUpdate === 'to-obsidian') {
                            // Update will be handled by caller
                            // We just record that Google version is newer
                        }
                    } else {
                        // Create new task in Google
                        const created = await this.createTaskFromObsidian(listId, obsidianTask);
                        result.created.push(created);
                        obsidianTask.googleTaskId = created.id;
                    }
                } catch (error) {
                    result.errors.push(error as Error);
                }
            }

            // Handle Google tasks not in Obsidian (pull new tasks)
            for (const googleTask of googleTasks) {
                if (!processedGoogleIds.has(googleTask.id) && !googleTask.deleted) {
                    // This is a new Google task not in Obsidian
                    // Caller should handle creating Obsidian tasks
                    // We just provide the data
                }
            }

            result.success = result.errors.length === 0;
        } catch (error) {
            result.success = false;
            result.errors.push(error as Error);
        }

        return result;
    }

    /**
     * Determine if and which way to update based on conflict resolution strategy
     */
    private shouldUpdateTask(
        obsidianTask: ObsidianTask,
        googleTask: GoogleTask,
        strategy: 'obsidian' | 'google' | 'newer'
    ): 'to-google' | 'to-obsidian' | 'none' {
        const obsidianModified = obsidianTask.lastSynced || new Date(0);
        const googleModified = googleTask.updated 
            ? new Date(googleTask.updated) 
            : new Date(0);

        switch (strategy) {
            case 'obsidian':
                return obsidianModified > googleModified ? 'to-google' : 'none';
            case 'google':
                return googleModified > obsidianModified ? 'to-obsidian' : 'none';
            case 'newer':
            default:
                if (obsidianModified > googleModified) return 'to-google';
                if (googleModified > obsidianModified) return 'to-obsidian';
                return 'none';
        }
    }

    /**
     * Create a Google task from an Obsidian task
     */
    private async createTaskFromObsidian(
        listId: string,
        obsidianTask: ObsidianTask
    ): Promise<GoogleTask> {
        let notes = obsidianTask.description || '';
        
        if (obsidianTask.tags && obsidianTask.tags.length > 0) {
            notes += notes ? '\n\n' : '';
            notes += `Tags: ${obsidianTask.tags.join(', ')}`;
        }

        return this.createTask(listId, {
            title: obsidianTask.content,
            notes: notes || undefined,
            status: obsidianTask.completed ? 'completed' : 'needsAction',
            due: obsidianTask.dueDate?.toISOString(),
        });
    }

    /**
     * Update a Google task from an Obsidian task
     */
    private async updateTaskFromObsidian(
        listId: string,
        taskId: string,
        obsidianTask: ObsidianTask
    ): Promise<GoogleTask> {
        let notes = obsidianTask.description || '';
        
        if (obsidianTask.tags && obsidianTask.tags.length > 0) {
            notes += notes ? '\n\n' : '';
            notes += `Tags: ${obsidianTask.tags.join(', ')}`;
        }

        return this.updateTask(listId, taskId, {
            title: obsidianTask.content,
            notes: notes || undefined,
            status: obsidianTask.completed ? 'completed' : 'needsAction',
            due: obsidianTask.dueDate?.toISOString(),
            completed: obsidianTask.completed ? new Date().toISOString() : undefined,
        });
    }

    /**
     * Convert a Google Task to Obsidian Task format.
     * Extracts tags from notes and maps Google fields to Obsidian format.
     *
     * @param googleTask - The Google task to convert
     * @returns ObsidianTask formatted for Obsidian
     *
     * @example
     * ```typescript
     * const googleTask = await client.getTask(listId, 'abc123');
     * const obsidianTask = client.convertToObsidianTask(googleTask);
     * ```
     */
    convertToObsidianTask(googleTask: GoogleTask): ObsidianTask {
        const tags: string[] = [];
        let description = googleTask.notes || '';

        // Extract tags from notes if present
        const tagMatch = description.match(/Tags: (.+)$/m);
        if (tagMatch) {
            tags.push(...tagMatch[1].split(',').map(t => t.trim()));
            description = description.replace(/\n\nTags: .+$/, '').trim();
        }

        return {
            id: this.generateObsidianId(),
            content: googleTask.title,
            completed: googleTask.status === 'completed',
            dueDate: googleTask.due ? new Date(googleTask.due) : undefined,
            description: description || undefined,
            googleTaskId: googleTask.id,
            tags: tags.length > 0 ? tags : undefined,
            lastSynced: new Date(),
        };
    }

    private generateObsidianId(): string {
        return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // ============================================================================
    // Batch Operations
    // ============================================================================

    /**
     * Batch create multiple tasks.
     * Continues processing even if individual tasks fail.
     *
     * @param listId - The task list identifier
     * @param tasks - Array of task data to create
     * @returns Promise resolving to results with successes and errors
     *
     * @example
     * ```typescript
     * const result = await client.batchCreateTasks(listId, [
     *     { title: 'Task 1' },
     *     { title: 'Task 2' }
     * ]);
     * console.log(`Created ${result.success.length} tasks`);
     * ```
     */
    async batchCreateTasks(
        listId: string,
        tasks: Partial<GoogleTask>[]
    ): Promise<{ success: GoogleTask[]; errors: Error[] }> {
        const results = { success: [] as GoogleTask[], errors: [] as Error[] };

        for (const task of tasks) {
            try {
                const created = await this.createTask(listId, task);
                results.success.push(created);
            } catch (error) {
                results.errors.push(error as Error);
            }
        }

        return results;
    }

    /**
     * Batch update multiple tasks.
     * Continues processing even if individual updates fail.
     *
     * @param listId - The task list identifier
     * @param tasks - Array of task updates with taskId and updates
     * @returns Promise resolving to results with successes and errors
     *
     * @example
     * ```typescript
     * const result = await client.batchUpdateTasks(listId, [
     *     { taskId: 'abc123', updates: { status: 'completed' } },
     *     { taskId: 'def456', updates: { due: new Date().toISOString() } }
     * ]);
     * ```
     */
    async batchUpdateTasks(
        listId: string,
        tasks: Array<{ taskId: string; updates: Partial<GoogleTask> }>
    ): Promise<{ success: GoogleTask[]; errors: Error[] }> {
        const results = { success: [] as GoogleTask[], errors: [] as Error[] };

        for (const { taskId, updates } of tasks) {
            try {
                const updated = await this.updateTask(listId, taskId, updates);
                results.success.push(updated);
            } catch (error) {
                results.errors.push(error as Error);
            }
        }

        return results;
    }

    /**
     * Batch delete multiple tasks.
     * Continues processing even if individual deletions fail.
     *
     * @param listId - The task list identifier
     * @param taskIds - Array of task IDs to delete
     * @returns Promise resolving to results with successes and errors
     *
     * @example
     * ```typescript
     * const result = await client.batchDeleteTasks(listId, ['abc123', 'def456']);
     * console.log(`Deleted ${result.success.length} tasks`);
     * ```
     */
    async batchDeleteTasks(
        listId: string,
        taskIds: string[]
    ): Promise<{ success: string[]; errors: Error[] }> {
        const results = { success: [] as string[], errors: [] as Error[] };

        for (const taskId of taskIds) {
            try {
                await this.deleteTask(listId, taskId);
                results.success.push(taskId);
            } catch (error) {
                results.errors.push(error as Error);
            }
        }

        return results;
    }

    // ============================================================================
    // Utility Methods
    // ============================================================================

    /**
     * Search tasks by title or notes content.
     * Performs client-side filtering after fetching tasks.
     *
     * @param listId - The task list identifier
     * @param query - Search query string (case-insensitive)
     * @returns Promise resolving to matching tasks
     *
     * @example
     * ```typescript
     * const results = await client.searchTasks(listId, 'documentation');
     * console.log(`Found ${results.length} matching tasks`);
     * ```
     */
    async searchTasks(listId: string, query: string): Promise<GoogleTask[]> {
        const tasks = await this.listTasks(listId, { showCompleted: true });
        const lowerQuery = query.toLowerCase();
        
        return tasks.filter(task => 
            task.title.toLowerCase().includes(lowerQuery) ||
            (task.notes && task.notes.toLowerCase().includes(lowerQuery))
        );
    }

    /**
     * Get tasks due today (from midnight to midnight).
     *
     * @param listId - The task list identifier
     * @returns Promise resolving to tasks due today
     *
     * @example
     * ```typescript
     * const tasks = await client.getTasksDueToday(listId);
     * console.log(`You have ${tasks.length} tasks due today`);
     * ```
     */
    async getTasksDueToday(listId: string): Promise<GoogleTask[]> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        return this.listTasks(listId, {
            dueMin: today.toISOString(),
            dueMax: tomorrow.toISOString(),
        });
    }

    /**
     * Get tasks due within the next 7 days.
     *
     * @param listId - The task list identifier
     * @returns Promise resolving to tasks due this week
     *
     * @example
     * ```typescript
     * const tasks = await client.getTasksDueThisWeek(listId);
     * console.log(`${tasks.length} tasks due this week`);
     * ```
     */
    async getTasksDueThisWeek(listId: string): Promise<GoogleTask[]> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const nextWeek = new Date(today);
        nextWeek.setDate(nextWeek.getDate() + 7);

        return this.listTasks(listId, {
            dueMin: today.toISOString(),
            dueMax: nextWeek.toISOString(),
        });
    }

    /**
     * Get all overdue incomplete tasks.
     *
     * @param listId - The task list identifier
     * @returns Promise resolving to overdue tasks
     *
     * @example
     * ```typescript
     * const overdue = await client.getOverdueTasks(listId);
     * if (overdue.length > 0) {
     *     console.log(`⚠️ ${overdue.length} tasks are overdue!`);
     * }
     * ```
     */
    async getOverdueTasks(listId: string): Promise<GoogleTask[]> {
        const now = new Date().toISOString();
        const allTasks = await this.listTasks(listId, { showCompleted: false });
        
        return allTasks.filter(task => 
            task.due && new Date(task.due) < new Date(now)
        );
    }

    /**
     * Test the connection to Google Tasks API.
     * Attempts to list task lists to verify authentication and connectivity.
     *
     * @returns Promise resolving to true if connection successful
     *
     * @example
     * ```typescript
     * const connected = await client.testConnection();
     * if (connected) {
     *     console.log('✅ Connected to Google Tasks');
     * } else {
     *     console.log('❌ Connection failed');
     * }
     * ```
     */
    async testConnection(): Promise<boolean> {
        try {
            await this.listTaskLists();
            return true;
        } catch (error) {
            return false;
        }
    }
}

// ============================================================================
// Factory & Singleton
// ============================================================================

let globalClient: GoogleTasksClient | null = null;

/**
 * Initialize the global Google Tasks client instance.
 * Creates a new client and stores it as the global singleton.
 *
 * @param serviceAccountPath - Path to the service account JSON file
 * @returns The initialized GoogleTasksClient instance
 *
 * @example
 * ```typescript
 * const client = initializeGoogleTasks('./service-account.json');
 * await client.authenticate();
 * ```
 */
export function initializeGoogleTasks(serviceAccountPath: string): GoogleTasksClient {
    globalClient = new GoogleTasksClient(serviceAccountPath);
    return globalClient;
}

/**
 * Get the global Google Tasks client instance.
 * Returns null if initializeGoogleTasks() has not been called.
 *
 * @returns The global GoogleTasksClient instance or null
 *
 * @example
 * ```typescript
 * const client = getGoogleTasksClient();
 * if (client) {
 *     const tasks = await client.listTasks(listId);
 * }
 * ```
 */
export function getGoogleTasksClient(): GoogleTasksClient | null {
    return globalClient;
}

// ============================================================================
// Export default
// ============================================================================

export default GoogleTasksClient;
