/**
 * Google Calendar API Integration for Mia Companion Obsidian Plugin
 * 
 * This module provides a complete integration with Google Calendar API using
 * service account authentication (JWT). It handles calendar management,
 * event CRUD operations, and specialized event types for task tracking.
 */

import { google, calendar_v3 } from 'googleapis';
import { JWT } from 'google-auth-library';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * Configuration for the Google Calendar service
 */
export interface GoogleCalendarConfig {
    /** Path to the service account JSON file */
    credentialsPath: string;
    /** Calendar name to use for Obsidian tasks (default: "Obsidian Tasks") */
    calendarName?: string;
    /** Timezone for events (default: UTC) */
    timezone?: string;
    /** Maximum retry attempts for failed requests */
    maxRetries?: number;
    /** Initial delay between retries in ms (exponential backoff) */
    retryDelayMs?: number;
    /** Rate limit: requests per second */
    rateLimitPerSecond?: number;
}

/**
 * Represents a task event in the calendar
 */
export interface TaskEvent {
    /** Unique identifier for the event */
    id: string;
    /** Task title */
    summary: string;
    /** Task description/notes */
    description?: string;
    /** Due date (ISO string or Date object) */
    dueDate: string | Date;
    /** Due time (optional, for time-specific tasks) */
    dueTime?: string;
    /** Task priority level */
    priority?: 'low' | 'medium' | 'high';
    /** Tags/labels for the task */
    tags?: string[];
    /** Source note file in Obsidian */
    sourceNote?: string;
    /** Whether the task is completed */
    completed?: boolean;
    /** Completion timestamp */
    completedAt?: string | Date;
}

/**
 * Represents a task completion event
 */
export interface TaskCompletionEvent {
    /** Reference to the original task ID */
    taskId: string;
    /** Task title */
    taskTitle: string;
    /** When the task was completed */
    completedAt: string | Date;
    /** Source note file */
    sourceNote?: string;
}

/**
 * Represents a word goal achievement event
 */
export interface WordGoalEvent {
    /** Goal name/description */
    goalName: string;
    /** Number of words written */
    wordCount: number;
    /** Goal target (if applicable) */
    targetCount?: number;
    /** When the goal was achieved */
    achievedAt: string | Date;
    /** Source note/project */
    sourceNote?: string;
    /** Percentage of goal completed */
    percentage?: number;
}

/**
 * Event creation result
 */
export interface EventResult {
    success: boolean;
    eventId?: string;
    htmlLink?: string;
    error?: string;
}

/**
 * Event filter options for listing events
 */
export interface EventFilterOptions {
    /** Start date for the range */
    startDate: Date;
    /** End date for the range */
    endDate: Date;
    /** Filter by search query */
    query?: string;
    /** Maximum results to return */
    maxResults?: number;
    /** Include deleted/cancelled events */
    showDeleted?: boolean;
    /** Order by: 'startTime' | 'updated' */
    orderBy?: 'startTime' | 'updated';
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_CALENDAR_NAME = 'Obsidian Tasks';
const DEFAULT_TIMEZONE = 'UTC';
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 1000;
const DEFAULT_RATE_LIMIT_PER_SECOND = 10;

// Event colors from Google Calendar
const EVENT_COLORS = {
    lavender: '1',
    sage: '2',
    grape: '3',
    flamingo: '4',
    banana: '5',
    tangerine: '6',
    peacock: '7',
    graphite: '8',
    blueberry: '9',
    basil: '10',
    tomato: '11',
} as const;

// Custom event types for Obsidian integration
const EVENT_TYPE_PROPERTY = 'obsidianEventType';
enum ObsidianEventType {
    TASK = 'task',
    TASK_COMPLETION = 'task_completion',
    WORD_GOAL = 'word_goal',
}

// ============================================================================
// Rate Limiter
// ============================================================================

/**
 * Simple rate limiter to respect Google API quotas
 */
class RateLimiter {
    private lastRequestTime: number = 0;
    private minIntervalMs: number;

    constructor(requestsPerSecond: number) {
        this.minIntervalMs = 1000 / requestsPerSecond;
    }

    /**
     * Wait until it's safe to make another request
     */
    async acquire(): Promise<void> {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        
        if (timeSinceLastRequest < this.minIntervalMs) {
            const waitTime = this.minIntervalMs - timeSinceLastRequest;
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        
        this.lastRequestTime = Date.now();
    }
}

// ============================================================================
// Retry Logic
// ============================================================================

/**
 * Check if an error is retryable
 */
function isRetryableError(error: any): boolean {
    if (!error) return false;
    
    // Rate limit errors
    if (error.code === 429) return true;
    
    // Server errors
    if (error.code >= 500 && error.code < 600) return true;
    
    // Network errors
    if (error.code === 'ECONNRESET' || 
        error.code === 'ETIMEDOUT' || 
        error.code === 'ECONNREFUSED') return true;
    
    // Quota exceeded (may be temporary)
    if (error.message?.includes('quota')) return true;
    
    return false;
}

/**
 * Execute a function with exponential backoff retry logic
 */
async function withRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number,
    baseDelayMs: number,
    operationName: string
): Promise<T> {
    let lastError: any;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error: any) {
            lastError = error;
            
            if (attempt === maxRetries || !isRetryableError(error)) {
                throw error;
            }
            
            const delayMs = baseDelayMs * Math.pow(2, attempt);
            console.log(`[GoogleCalendar] ${operationName} failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delayMs}ms...`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }
    
    throw lastError;
}

// ============================================================================
// Main Service Class
// ============================================================================

/**
 * Main service class for Google Calendar integration.
 * Provides methods for calendar management, event CRUD operations,
 * and specialized event types for task tracking.
 * 
 * @example
 * ```typescript
 * const calendar = new GoogleCalendarService({
 *     credentialsPath: './service-account.json',
 *     timezone: 'America/New_York'
 * });
 * await calendar.initialize();
 * ```
 */
export class GoogleCalendarService {
    private auth: JWT | null = null;
    private calendar: calendar_v3.Calendar | null = null;
    private config: Required<GoogleCalendarConfig>;
    private rateLimiter: RateLimiter;
    private cachedCalendarId: string | null = null;

    /**
     * Creates a new GoogleCalendarService instance.
     * @param config - Configuration options for the service
     */
    constructor(config: GoogleCalendarConfig) {
        this.config = {
            credentialsPath: config.credentialsPath,
            calendarName: config.calendarName || DEFAULT_CALENDAR_NAME,
            timezone: config.timezone || DEFAULT_TIMEZONE,
            maxRetries: config.maxRetries || DEFAULT_MAX_RETRIES,
            retryDelayMs: config.retryDelayMs || DEFAULT_RETRY_DELAY_MS,
            rateLimitPerSecond: config.rateLimitPerSecond || DEFAULT_RATE_LIMIT_PER_SECOND,
        };
        
        this.rateLimiter = new RateLimiter(this.config.rateLimitPerSecond);
    }

    // ========================================================================
    // Initialization
    // ========================================================================

    /**
     * Initialize the service with JWT authentication.
     * Must be called before any other operations.
     * Loads service account credentials and creates the Calendar API client.
     * 
     * @throws {Error} When credentials file cannot be read or is invalid
     * @returns Promise that resolves when initialization is complete
     * 
     * @example
     * ```typescript
     * const calendar = new GoogleCalendarService({ credentialsPath: './creds.json' });
     * await calendar.initialize();
     * console.log('Calendar service ready');
     * ```
     */
    async initialize(): Promise<void> {
        try {
            // Load service account credentials
            const credentialsJson = await fs.promises.readFile(
                this.config.credentialsPath,
                'utf-8'
            );
            const credentials = JSON.parse(credentialsJson);

            // Create JWT client
            this.auth = new JWT(
                credentials.client_email,
                undefined,
                credentials.private_key,
                ['https://www.googleapis.com/auth/calendar']
            );

            // Create Calendar API client
            this.calendar = google.calendar({
                version: 'v3',
                auth: this.auth,
            });

            console.log('[GoogleCalendar] Service initialized successfully');
        } catch (error: any) {
            console.error('[GoogleCalendar] Failed to initialize:', error);
            throw new Error(`Failed to initialize Google Calendar service: ${error.message}`);
        }
    }

    /**
     * Ensure the service is initialized before performing operations.
     * @throws {Error} If the service has not been initialized
     * @internal
     */
    private ensureInitialized(): void {
        if (!this.auth || !this.calendar) {
            throw new Error('GoogleCalendarService not initialized. Call initialize() first.');
        }
    }

    // ========================================================================
    // Calendar Management
    // ========================================================================

    /**
     * List all calendars accessible to the service account.
     * 
     * @returns Promise resolving to array of calendar list entries
     * @throws {GoogleCalendarError} When API request fails
     * 
     * @example
     * ```typescript
     * const calendars = await calendar.listCalendars();
     * console.log(calendars.map(c => c.summary));
     * ```
     */
    async listCalendars(): Promise<calendar_v3.Schema$CalendarListEntry[]> {
        this.ensureInitialized();
        
        return withRetry(async () => {
            await this.rateLimiter.acquire();
            
            const response = await this.calendar!.calendarList.list();
            return response.data.items || [];
        }, this.config.maxRetries, this.config.retryDelayMs, 'listCalendars');
    }

    /**
     * Get the Obsidian Tasks calendar ID, creating it if it doesn't exist.
     * The calendar name is determined by the config.calendarName setting.
     * Results are cached for subsequent calls.
     * 
     * @returns Promise resolving to the calendar ID string
     * @throws {GoogleCalendarError} When API request fails
     * 
     * @example
     * ```typescript
     * const calendarId = await calendar.getOrCreateObsidianCalendar();
     * console.log('Using calendar:', calendarId);
     * ```
     */
    async getOrCreateObsidianCalendar(): Promise<string> {
        this.ensureInitialized();
        
        // Check cache first
        if (this.cachedCalendarId) {
            return this.cachedCalendarId;
        }

        return withRetry(async () => {
            await this.rateLimiter.acquire();
            
            // Search for existing calendar
            const calendars = await this.listCalendars();
            const existingCalendar = calendars.find(
                cal => cal.summary === this.config.calendarName
            );

            if (existingCalendar?.id) {
                console.log(`[GoogleCalendar] Found existing calendar: ${existingCalendar.id}`);
                this.cachedCalendarId = existingCalendar.id;
                return existingCalendar.id;
            }

            // Create new calendar
            await this.rateLimiter.acquire();
            const response = await this.calendar!.calendars.insert({
                requestBody: {
                    summary: this.config.calendarName,
                    description: 'Calendar for Obsidian tasks, completions, and word goals managed by Mia Companion',
                    timeZone: this.config.timezone,
                },
            });

            if (!response.data.id) {
                throw new Error('Calendar created but no ID returned');
            }

            console.log(`[GoogleCalendar] Created new calendar: ${response.data.id}`);
            this.cachedCalendarId = response.data.id;
            return response.data.id;
        }, this.config.maxRetries, this.config.retryDelayMs, 'getOrCreateObsidianCalendar');
    }

    /**
     * Delete the Obsidian Tasks calendar permanently.
     * This will remove all events in the calendar.
     * 
     * @returns Promise resolving to true if deletion was successful
     * @throws {GoogleCalendarError} When API request fails
     * 
     * @example
     * ```typescript
     * const deleted = await calendar.deleteObsidianCalendar();
     * if (deleted) {
     *     console.log('Calendar deleted');
     * }
     * ```
     */
    async deleteObsidianCalendar(): Promise<boolean> {
        this.ensureInitialized();
        
        const calendarId = await this.getOrCreateObsidianCalendar();
        
        return withRetry(async () => {
            await this.rateLimiter.acquire();
            
            await this.calendar!.calendars.delete({
                calendarId: calendarId,
            });
            
            this.cachedCalendarId = null;
            console.log(`[GoogleCalendar] Deleted calendar: ${calendarId}`);
            return true;
        }, this.config.maxRetries, this.config.retryDelayMs, 'deleteObsidianCalendar');
    }

    // ========================================================================
    // Event CRUD Operations
    // ========================================================================

    /**
     * List events within a date range from the Obsidian calendar.
     * 
     * @param options - Filter options for the query
     * @returns Promise resolving to array of calendar events
     * @throws {GoogleCalendarError} When API request fails
     * 
     * @example
     * ```typescript
     * const events = await calendar.listEvents({
     *     startDate: new Date('2025-02-01'),
     *     endDate: new Date('2025-02-28'),
     *     query: 'meeting'
     * });
     * ```
     */
    async listEvents(options: EventFilterOptions): Promise<calendar_v3.Schema$Event[]> {
        this.ensureInitialized();
        
        const calendarId = await this.getOrCreateObsidianCalendar();
        
        return withRetry(async () => {
            await this.rateLimiter.acquire();
            
            const response = await this.calendar!.events.list({
                calendarId: calendarId,
                timeMin: options.startDate.toISOString(),
                timeMax: options.endDate.toISOString(),
                q: options.query,
                maxResults: options.maxResults || 250,
                showDeleted: options.showDeleted || false,
                singleEvents: true,
                orderBy: options.orderBy || 'startTime',
            });
            
            return response.data.items || [];
        }, this.config.maxRetries, this.config.retryDelayMs, 'listEvents');
    }

    /**
     * Get a single event by its ID from the Obsidian calendar.
     * 
     * @param eventId - The unique event identifier
     * @returns Promise resolving to the event, or null if not found
     * @throws {GoogleCalendarError} When API request fails (except 404)
     * 
     * @example
     * ```typescript
     * const event = await calendar.getEvent('abc123');
     * if (event) {
     *     console.log('Event:', event.summary);
     * }
     * ```
     */
    async getEvent(eventId: string): Promise<calendar_v3.Schema$Event | null> {
        this.ensureInitialized();
        
        const calendarId = await this.getOrCreateObsidianCalendar();
        
        return withRetry(async () => {
            await this.rateLimiter.acquire();
            
            try {
                const response = await this.calendar!.events.get({
                    calendarId: calendarId,
                    eventId: eventId,
                });
                return response.data;
            } catch (error: any) {
                if (error.code === 404) {
                    return null;
                }
                throw error;
            }
        }, this.config.maxRetries, this.config.retryDelayMs, 'getEvent');
    }

    /**
     * Create a generic calendar event in the Obsidian calendar.
     * 
     * @param event - The event data to create
     * @returns Promise resolving to the creation result with event ID
     * @throws {GoogleCalendarError} When API request fails
     * 
     * @example
     * ```typescript
     * const result = await calendar.createEvent({
     *     summary: 'Team Meeting',
     *     start: { dateTime: '2025-02-15T10:00:00Z' },
     *     end: { dateTime: '2025-02-15T11:00:00Z' }
     * });
     * console.log('Created:', result.eventId);
     * ```
     */
    async createEvent(
        event: calendar_v3.Schema$Event
    ): Promise<EventResult> {
        this.ensureInitialized();
        
        const calendarId = await this.getOrCreateObsidianCalendar();
        
        return withRetry(async () => {
            await this.rateLimiter.acquire();
            
            const response = await this.calendar!.events.insert({
                calendarId: calendarId,
                requestBody: event,
            });
            
            return {
                success: true,
                eventId: response.data.id || undefined,
                htmlLink: response.data.htmlLink || undefined,
            };
        }, this.config.maxRetries, this.config.retryDelayMs, 'createEvent');
    }

    /**
     * Update an existing calendar event.
     *
     * @param eventId - The unique event identifier
     * @param event - The updated event data
     * @returns Promise resolving to the update result
     * @throws {GoogleCalendarError} When API request fails
     *
     * @example
     * ```typescript
     * const result = await calendar.updateEvent('abc123', {
     *     summary: 'Updated Meeting Title'
     * });
     * ```
     */
    async updateEvent(
        eventId: string,
        event: calendar_v3.Schema$Event
    ): Promise<EventResult> {
        this.ensureInitialized();
        
        const calendarId = await this.getOrCreateObsidianCalendar();
        
        return withRetry(async () => {
            await this.rateLimiter.acquire();
            
            const response = await this.calendar!.events.update({
                calendarId: calendarId,
                eventId: eventId,
                requestBody: event,
            });
            
            return {
                success: true,
                eventId: response.data.id || undefined,
                htmlLink: response.data.htmlLink || undefined,
            };
        }, this.config.maxRetries, this.config.retryDelayMs, 'updateEvent');
    }

    /**
     * Delete a calendar event permanently.
     *
     * @param eventId - The unique event identifier
     * @returns Promise resolving to true if deletion was successful
     * @throws {GoogleCalendarError} When API request fails
     *
     * @example
     * ```typescript
     * const deleted = await calendar.deleteEvent('abc123');
     * if (deleted) {
     *     console.log('Event deleted');
     * }
     * ```
     */
    async deleteEvent(eventId: string): Promise<boolean> {
        this.ensureInitialized();
        
        const calendarId = await this.getOrCreateObsidianCalendar();
        
        return withRetry(async () => {
            await this.rateLimiter.acquire();
            
            await this.calendar!.events.delete({
                calendarId: calendarId,
                eventId: eventId,
            });
            
            return true;
        }, this.config.maxRetries, this.config.retryDelayMs, 'deleteEvent');
    }

    // ========================================================================
    // Specialized Event Types
    // ========================================================================

    /**
     * Create a task event in the calendar with proper metadata.
     * Creates either an all-day event or timed event based on dueTime.
     *
     * @param task - The task event data
     * @returns Promise resolving to the creation result
     * @throws {GoogleCalendarError} When API request fails
     *
     * @example
     * ```typescript
     * const result = await calendar.createTaskEvent({
     *     id: 'task-001',
     *     summary: 'Write blog post',
     *     dueDate: new Date('2025-02-15'),
     *     dueTime: '14:00',
     *     priority: 'high',
     *     tags: ['writing']
     * });
     * ```
     */
    async createTaskEvent(task: TaskEvent): Promise<EventResult> {
        const dueDate = new Date(task.dueDate);
        const isAllDay = !task.dueTime;
        
        // Format date for all-day vs timed events
        const startDateTime = isAllDay
            ? { date: this.formatDateOnly(dueDate) }
            : { 
                dateTime: this.combineDateAndTime(dueDate, task.dueTime!).toISOString(),
                timeZone: this.config.timezone,
            };
        
        const endDateTime = isAllDay
            ? { date: this.formatDateOnly(this.addDays(dueDate, 1)) }
            : {
                dateTime: this.combineDateAndTime(dueDate, task.dueTime!).toISOString(),
                timeZone: this.config.timezone,
            };

        // Build description with metadata
        const descriptionParts: string[] = [];
        if (task.description) {
            descriptionParts.push(task.description);
        }
        descriptionParts.push(`---`);
        descriptionParts.push(`${EVENT_TYPE_PROPERTY}: ${ObsidianEventType.TASK}`);
        if (task.priority) descriptionParts.push(`Priority: ${task.priority}`);
        if (task.tags?.length) descriptionParts.push(`Tags: ${task.tags.join(', ')}`);
        if (task.sourceNote) descriptionParts.push(`Source: ${task.sourceNote}`);
        if (task.completed) descriptionParts.push(`Completed: ${task.completed}`);
        if (task.completedAt) descriptionParts.push(`CompletedAt: ${task.completedAt}`);

        const event: calendar_v3.Schema$Event = {
            summary: task.summary,
            description: descriptionParts.join('\n'),
            start: startDateTime,
            end: endDateTime,
            colorId: this.getPriorityColor(task.priority),
            extendedProperties: {
                private: {
                    [EVENT_TYPE_PROPERTY]: ObsidianEventType.TASK,
                    taskId: task.id,
                    priority: task.priority || 'medium',
                    sourceNote: task.sourceNote || '',
                    completed: String(task.completed || false),
                },
            },
        };

        // If task is completed, mark it as transparent (not blocking time)
        if (task.completed) {
            event.transparency = 'transparent';
        }

        return this.createEvent(event);
    }

    /**
     * Update an existing task event.
     * Merges new data with existing event metadata.
     *
     * @param eventId - The event identifier
     * @param task - Partial task data to update
     * @returns Promise resolving to the update result
     * @throws {GoogleCalendarError} When API request fails
     *
     * @example
     * ```typescript
     * const result = await calendar.updateTaskEvent('abc123', {
     *     summary: 'Updated task title',
     *     priority: 'low'
     * });
     * ```
     */
    async updateTaskEvent(
        eventId: string,
        task: Partial<TaskEvent>
    ): Promise<EventResult> {
        const existingEvent = await this.getEvent(eventId);
        if (!existingEvent) {
            return { success: false, error: 'Event not found' };
        }

        const updates: calendar_v3.Schema$Event = {
            ...existingEvent,
        };

        // Update summary
        if (task.summary !== undefined) {
            updates.summary = task.summary;
        }

        // Update dates/times
        if (task.dueDate) {
            const dueDate = new Date(task.dueDate);
            const isAllDay = !task.dueTime;
            
            if (isAllDay) {
                updates.start = { date: this.formatDateOnly(dueDate) };
                updates.end = { date: this.formatDateOnly(this.addDays(dueDate, 1)) };
            } else {
                const dateTime = this.combineDateAndTime(dueDate, task.dueTime!).toISOString();
                updates.start = { dateTime, timeZone: this.config.timezone };
                updates.end = { dateTime, timeZone: this.config.timezone };
            }
        }

        // Update color based on priority
        if (task.priority !== undefined) {
            updates.colorId = this.getPriorityColor(task.priority);
        }

        // Update description with metadata
        const descriptionParts: string[] = [];
        if (task.description !== undefined) {
            descriptionParts.push(task.description);
        } else if (existingEvent.description) {
            // Keep the original description (before the metadata section)
            const originalDesc = existingEvent.description.split('---')[0]?.trim();
            if (originalDesc) descriptionParts.push(originalDesc);
        }
        
        descriptionParts.push(`---`);
        descriptionParts.push(`${EVENT_TYPE_PROPERTY}: ${ObsidianEventType.TASK}`);
        
        // Get existing or new values
        const existingPrivate = existingEvent.extendedProperties?.private || {};
        const priority = task.priority || existingPrivate['priority'] || 'medium';
        const sourceNote = task.sourceNote || existingPrivate['sourceNote'] || '';
        const completed = task.completed !== undefined 
            ? String(task.completed) 
            : existingPrivate['completed'] || 'false';
        const completedAt = task.completedAt || existingPrivate['completedAt'] || '';

        descriptionParts.push(`Priority: ${priority}`);
        if (task.tags?.length) descriptionParts.push(`Tags: ${task.tags.join(', ')}`);
        if (sourceNote) descriptionParts.push(`Source: ${sourceNote}`);
        descriptionParts.push(`Completed: ${completed}`);
        if (completedAt) descriptionParts.push(`CompletedAt: ${completedAt}`);

        updates.description = descriptionParts.join('\n');

        // Update extended properties
        updates.extendedProperties = {
            private: {
                ...existingPrivate,
                [EVENT_TYPE_PROPERTY]: ObsidianEventType.TASK,
                priority,
                sourceNote,
                completed,
                ...(completedAt && { completedAt: String(completedAt) }),
            },
        };

        // Update transparency if completed status changed
        if (task.completed !== undefined) {
            updates.transparency = task.completed ? 'transparent' : 'opaque';
        }

        return this.updateEvent(eventId, updates);
    }

    /**
     * Mark a task as completed and create a completion event.
     * Updates the task event and creates a separate completion tracking event.
     *
     * @param eventId - The task event identifier
     * @param completedAt - Optional completion timestamp (defaults to now)
     * @returns Promise resolving to the update result
     * @throws {GoogleCalendarError} When API request fails
     *
     * @example
     * ```typescript
     * const result = await calendar.completeTask('abc123');
     * if (result.success) {
     *     console.log('Task completed!');
     * }
     * ```
     */
    async completeTask(
        eventId: string,
        completedAt?: Date
    ): Promise<EventResult> {
        const now = completedAt || new Date();
        
        // First update the task event
        const taskResult = await this.updateTaskEvent(eventId, {
            completed: true,
            completedAt: now.toISOString(),
        });

        if (!taskResult.success) {
            return taskResult;
        }

        // Also create a completion event for tracking
        const event = await this.getEvent(eventId);
        if (event) {
            const taskTitle = event.summary || 'Unknown Task';
            const sourceNote = event.extendedProperties?.private?.['sourceNote'];
            
            await this.createTaskCompletionEvent({
                taskId: eventId,
                taskTitle,
                completedAt: now,
                sourceNote,
            });
        }

        return taskResult;
    }

    /**
     * Create a task completion event for tracking purposes.
     * This creates a separate event marking when a task was completed.
     *
     * @param completion - The completion event data
     * @returns Promise resolving to the creation result
     * @throws {GoogleCalendarError} When API request fails
     *
     * @example
     * ```typescript
     * await calendar.createTaskCompletionEvent({
     *     taskId: 'task-001',
     *     taskTitle: 'Write blog post',
     *     completedAt: new Date()
     * });
     * ```
     */
    async createTaskCompletionEvent(completion: TaskCompletionEvent): Promise<EventResult> {
        const completedAt = new Date(completion.completedAt);
        
        const event: calendar_v3.Schema$Event = {
            summary: `✓ Completed: ${completion.taskTitle}`,
            description: [
                `Task completed!`,
                `---`,
                `${EVENT_TYPE_PROPERTY}: ${ObsidianEventType.TASK_COMPLETION}`,
                `OriginalTaskId: ${completion.taskId}`,
                completion.sourceNote ? `Source: ${completion.sourceNote}` : '',
            ].filter(Boolean).join('\n'),
            start: {
                dateTime: completedAt.toISOString(),
                timeZone: this.config.timezone,
            },
            end: {
                dateTime: new Date(completedAt.getTime() + 60 * 1000).toISOString(), // 1 minute duration
                timeZone: this.config.timezone,
            },
            colorId: EVENT_COLORS.basil, // Green for completion
            transparency: 'transparent',
            extendedProperties: {
                private: {
                    [EVENT_TYPE_PROPERTY]: ObsidianEventType.TASK_COMPLETION,
                    originalTaskId: completion.taskId,
                    sourceNote: completion.sourceNote || '',
                },
            },
        };

        return this.createEvent(event);
    }

    /**
     * Create a word goal achievement event when writing goals are reached.
     * Creates a calendar event celebrating the achievement with word count details.
     *
     * @param goal - The word goal event data
     * @returns Promise resolving to the creation result
     * @throws {GoogleCalendarError} When API request fails
     *
     * @example
     * ```typescript
     * const result = await calendar.createWordGoalEvent({
     *     goalName: 'Daily Writing Goal',
     *     wordCount: 750,
     *     targetCount: 500,
     *     achievedAt: new Date()
     * });
     * ```
     */
    async createWordGoalEvent(goal: WordGoalEvent): Promise<EventResult> {
        const achievedAt = new Date(goal.achievedAt);
        const percentage = goal.percentage || 
            (goal.targetCount ? Math.round((goal.wordCount / goal.targetCount) * 100) : 100);
        
        let summary = `📝 ${goal.wordCount} words`;
        if (goal.goalName) {
            summary = `📝 ${goal.goalName}: ${goal.wordCount} words`;
        }
        
        const event: calendar_v3.Schema$Event = {
            summary,
            description: [
                `Word count milestone achieved!`,
                ``,
                `Words written: ${goal.wordCount}`,
                goal.targetCount ? `Target: ${goal.targetCount}` : '',
                `Completion: ${percentage}%`,
                `---`,
                `${EVENT_TYPE_PROPERTY}: ${ObsidianEventType.WORD_GOAL}`,
                goal.sourceNote ? `Source: ${goal.sourceNote}` : '',
            ].filter(Boolean).join('\n'),
            start: {
                dateTime: achievedAt.toISOString(),
                timeZone: this.config.timezone,
            },
            end: {
                dateTime: new Date(achievedAt.getTime() + 15 * 60 * 1000).toISOString(), // 15 min duration
                timeZone: this.config.timezone,
            },
            colorId: EVENT_COLORS.peacock, // Blue for writing
            transparency: 'transparent',
            extendedProperties: {
                private: {
                    [EVENT_TYPE_PROPERTY]: ObsidianEventType.WORD_GOAL,
                    wordCount: String(goal.wordCount),
                    targetCount: goal.targetCount ? String(goal.targetCount) : '',
                    percentage: String(percentage),
                    sourceNote: goal.sourceNote || '',
                },
            },
        };

        return this.createEvent(event);
    }

    // ========================================================================
    // Query Methods
    // ========================================================================

    /**
     * Get all task events within a date range.
     * Filters events by the task event type and optionally by completion status.
     *
     * @param startDate - Range start date
     * @param endDate - Range end date
     * @param options - Query options (includeCompleted)
     * @returns Promise resolving to array of task events
     * @throws {GoogleCalendarError} When API request fails
     *
     * @example
     * ```typescript
     * const tasks = await calendar.getTasksInRange(
     *     new Date('2025-02-01'),
     *     new Date('2025-02-28'),
     *     { includeCompleted: false }
     * );
     * ```
     */
    async getTasksInRange(
        startDate: Date,
        endDate: Date,
        options: { includeCompleted?: boolean } = {}
    ): Promise<calendar_v3.Schema$Event[]> {
        const events = await this.listEvents({
            startDate,
            endDate,
        });

        return events.filter(event => {
            // Check if it's a task event
            const isTask = event.extendedProperties?.private?.[EVENT_TYPE_PROPERTY] === 
                          ObsidianEventType.TASK;
            
            if (!isTask) return false;

            // Filter by completion status if requested
            if (options.includeCompleted === false) {
                const completed = event.extendedProperties?.private?.['completed'] === 'true';
                if (completed) return false;
            }

            return true;
        });
    }

    /**
     * Get all word goal achievement events within a date range.
     *
     * @param startDate - Range start date
     * @param endDate - Range end date
     * @returns Promise resolving to array of word goal events
     * @throws {GoogleCalendarError} When API request fails
     *
     * @example
     * ```typescript
     * const goals = await calendar.getWordGoalsInRange(
     *     new Date('2025-02-01'),
     *     new Date('2025-02-28')
     * );
     * console.log(`Achieved ${goals.length} word goals this month`);
     * ```
     */
    async getWordGoalsInRange(
        startDate: Date,
        endDate: Date
    ): Promise<calendar_v3.Schema$Event[]> {
        const events = await this.listEvents({
            startDate,
            endDate,
        });

        return events.filter(event => 
            event.extendedProperties?.private?.[EVENT_TYPE_PROPERTY] === 
            ObsidianEventType.WORD_GOAL
        );
    }

    /**
     * Get task completion events within a date range.
     *
     * @param startDate - Range start date
     * @param endDate - Range end date
     * @returns Promise resolving to array of completion events
     * @throws {GoogleCalendarError} When API request fails
     *
     * @example
     * ```typescript
     * const completions = await calendar.getCompletionsInRange(
     *     new Date('2025-02-01'),
     *     new Date('2025-02-28')
     * );
     * ```
     */
    async getCompletionsInRange(
        startDate: Date,
        endDate: Date
    ): Promise<calendar_v3.Schema$Event[]> {
        const events = await this.listEvents({
            startDate,
            endDate,
        });

        return events.filter(event => 
            event.extendedProperties?.private?.[EVENT_TYPE_PROPERTY] === 
            ObsidianEventType.TASK_COMPLETION
        );
    }

    /**
     * Get statistics for a date range including tasks and word goals.
     *
     * @param startDate - Range start date
     * @param endDate - Range end date
     * @returns Promise resolving to statistics object
     * @throws {GoogleCalendarError} When API request fails
     *
     * @example
     * ```typescript
     * const stats = await calendar.getStats(
     *     new Date('2025-02-01'),
     *     new Date('2025-02-28')
     * );
     * console.log(`Completed ${stats.completedTasks}/${stats.totalTasks} tasks`);
     * console.log(`Total words: ${stats.totalWords}`);
     * ```
     */
    async getStats(startDate: Date, endDate: Date): Promise<{
        totalTasks: number;
        completedTasks: number;
        totalWords: number;
    }> {
        const events = await this.listEvents({ startDate, endDate });
        
        let totalTasks = 0;
        let completedTasks = 0;
        let totalWords = 0;

        for (const event of events) {
            const eventType = event.extendedProperties?.private?.[EVENT_TYPE_PROPERTY];
            
            if (eventType === ObsidianEventType.TASK) {
                totalTasks++;
                if (event.extendedProperties?.private?.['completed'] === 'true') {
                    completedTasks++;
                }
            } else if (eventType === ObsidianEventType.WORD_GOAL) {
                const wordCount = parseInt(
                    event.extendedProperties?.private?.['wordCount'] || '0',
                    10
                );
                totalWords += wordCount;
            }
        }

        return { totalTasks, completedTasks, totalWords };
    }

    // ========================================================================
    // Utility Methods
    // ========================================================================

    /**
     * Format a date as YYYY-MM-DD for all-day events
     */
    private formatDateOnly(date: Date): string {
        return date.toISOString().split('T')[0];
    }

    /**
     * Add days to a date
     */
    private addDays(date: Date, days: number): Date {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    }

    /**
     * Combine a date with a time string (HH:MM)
     */
    private combineDateAndTime(date: Date, timeStr: string): Date {
        const [hours, minutes] = timeStr.split(':').map(Number);
        const result = new Date(date);
        result.setHours(hours || 0, minutes || 0, 0, 0);
        return result;
    }

    /**
     * Get color ID based on priority
     */
    private getPriorityColor(priority?: string): string | undefined {
        switch (priority) {
            case 'high':
                return EVENT_COLORS.tomato; // Red
            case 'medium':
                return EVENT_COLORS.tangerine; // Orange
            case 'low':
                return EVENT_COLORS.sage; // Green
            default:
                return undefined;
        }
    }

    /**
     * Clear the cached calendar ID.
     * Useful for testing or when the calendar has been deleted externally.
     *
     * @example
     * ```typescript
     * calendar.clearCache();
     * // Next call will fetch/create fresh
     * const calendarId = await calendar.getOrCreateObsidianCalendar();
     * ```
     */
    clearCache(): void {
        this.cachedCalendarId = null;
    }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create and initialize a GoogleCalendarService instance in one call.
 * This is the recommended way to create a new service instance.
 *
 * @param config - Configuration for the calendar service
 * @returns Promise resolving to initialized GoogleCalendarService
 * @throws {Error} When initialization fails
 *
 * @example
 * ```typescript
 * const calendar = await createGoogleCalendarService({
 *     credentialsPath: './service-account.json',
 *     calendarName: 'My Tasks',
 *     timezone: 'America/New_York'
 * });
 *
 * // Create a task
 * await calendar.createTaskEvent({
 *     id: 'task-1',
 *     summary: 'Write blog post',
 *     dueDate: new Date('2025-02-15'),
 *     priority: 'high',
 * });
 * ```
 */
export async function createGoogleCalendarService(
    config: GoogleCalendarConfig
): Promise<GoogleCalendarService> {
    const service = new GoogleCalendarService(config);
    await service.initialize();
    return service;
}

// ============================================================================
// Default Export
// ============================================================================

export default GoogleCalendarService;
