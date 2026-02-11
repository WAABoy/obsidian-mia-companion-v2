/**
 * Type definitions for the Obsidian MIA Companion plugin
 */

// ============================================================================
// Task Types
// ============================================================================

export interface ObsidianTask {
	id: string;
	content: string;
	completed: boolean;
	dueDate?: string; // ISO date string
	priority?: TaskPriority;
	tags: string[];
	notes?: string;
	filePath: string;
	lineNumber: number;
	lastModified: number; // Unix timestamp
	syncId?: string; // Maps to Google Task ID
}

export interface GoogleTask {
	id: string;
	title: string;
	status: 'needsAction' | 'completed';
	due?: string; // RFC 3339 timestamp
	notes?: string;
	updated: string; // RFC 3339 timestamp
	position: string;
	parent?: string;
	links?: Array<{
		type: string;
		description: string;
		link: string;
	}>;
}

export interface GoogleTaskList {
	id: string;
	title: string;
	updated: string;
}

export enum TaskPriority {
	LOW = 1,
	NORMAL = 2,
	HIGH = 3,
}

// ============================================================================
// Sync Types
// ============================================================================

export enum SyncStatus {
	IDLE = 'idle',
	SYNCING = 'syncing',
	ERROR = 'error',
	OFFLINE = 'offline',
}

export enum SyncDirection {
	OBSIDIAN_TO_GOOGLE = 'obsidian_to_google',
	GOOGLE_TO_OBSIDIAN = 'google_to_obsidian',
	BIDIRECTIONAL = 'bidirectional',
}

export interface SyncState {
	status: SyncStatus;
	lastSyncTime: number | null;
	lastError: string | null;
	pendingOperations: number;
	online: boolean;
}

export interface SyncConflict {
	obsidianTask: ObsidianTask;
	googleTask: GoogleTask;
	resolution: 'obsidian' | 'google' | 'manual';
	resolvedAt: number;
}

export interface SyncOperation {
	id: string;
	type: 'create' | 'update' | 'delete';
	direction: SyncDirection;
	taskId: string;
	payload?: Partial<ObsidianTask> | Partial<GoogleTask>;
	timestamp: number;
	retries: number;
	maxRetries: number;
	error?: string;
}

// ============================================================================
// Auth Types
// ============================================================================

export interface GoogleCredentials {
	client_email: string;
	private_key: string;
	project_id: string;
	client_id?: string;
}

export interface AuthToken {
	access_token: string;
	expires_in: number;
	token_type: string;
	expires_at: number; // Calculated from expires_in
}

export interface AuthState {
	isAuthenticated: boolean;
	token: AuthToken | null;
	credentials: GoogleCredentials | null;
}

// ============================================================================
// Settings Types
// ============================================================================

export interface MiaCompanionSettings {
	// Google Auth
	googleClientEmail: string;
	googlePrivateKey: string;
	googleProjectId: string;
	
	// Sync Settings
	syncInterval: number; // seconds, default 60
	syncEnabled: boolean;
	taskListId: string;
	defaultSyncDirection: SyncDirection;
	
	// Conflict Resolution
	autoResolveConflicts: boolean;
	preferredSource: 'obsidian' | 'google';
	
	// Offline Queue
	maxOfflineOperations: number;
	retryAttempts: number;
	retryDelay: number; // milliseconds
	
	// Notifications
	enableNotifications: boolean;
	notifyOnConflict: boolean;
	notifyOnError: boolean;
}

export const DEFAULT_SETTINGS: MiaCompanionSettings = {
	googleClientEmail: '',
	googlePrivateKey: '',
	googleProjectId: '',
	
	syncInterval: 60,
	syncEnabled: true,
	taskListId: '@default',
	defaultSyncDirection: SyncDirection.BIDIRECTIONAL,
	
	autoResolveConflicts: true,
	preferredSource: 'obsidian',
	
	maxOfflineOperations: 100,
	retryAttempts: 3,
	retryDelay: 5000,
	
	enableNotifications: true,
	notifyOnConflict: true,
	notifyOnError: true,
};
