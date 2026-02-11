/**
 * Chat message types for Mia Companion
 */

export interface ChatMessage {
	id: string;
	content: string;
	role: 'user' | 'assistant' | 'system';
	timestamp: number;
	status?: 'sending' | 'sent' | 'error' | 'retrying';
	metadata?: {
		wordCount?: number;
		streakDay?: number;
		mood?: 'happy' | 'excited' | 'calm' | 'encouraging';
	};
}

export interface ChatSession {
	id: string;
	messages: ChatMessage[];
	createdAt: number;
	updatedAt: number;
}

export interface ChatOptions {
	placeholder?: string;
	showTimestamps?: boolean;
	showAvatars?: boolean;
	enableMarkdown?: boolean;
	maxHeight?: string;
}

export type ChatEventType = 
	| 'message-sent'
	| 'message-received'
	| 'typing-start'
	| 'typing-stop'
	| 'message-error'
	| 'message-retry';

export interface ChatEvent {
	type: ChatEventType;
	messageId?: string;
	content?: string;
}
