/**
 * MessageBubble - Individual chat message component with Sakura aesthetic
 * 
 * Features:
 * - Message bubbles with avatars (left=Mia 🌸 pink, right=User accent)
 * - Rounded corners, soft shadows
 * - Markdown rendering with syntax highlighting
 * - Message timestamps grouped by time
 * - Hover actions (copy, retry)
 * - ARIA accessibility support
 */

import { ChatMessage } from './types';

export interface MessageBubbleOptions {
	showAvatar?: boolean;
	showTimestamp?: boolean;
	showActions?: boolean;
	enableMarkdown?: boolean;
	compact?: boolean;
}

export class MessageBubble {
	private element: HTMLElement;
	private message: ChatMessage;
	private options: MessageBubbleOptions;
	private actionButtons: Map<string, HTMLElement> = new Map();

	// Sakura aesthetic colors
	private readonly COLORS = {
		mia: {
			bg: 'var(--mia-bubble-mia, rgba(255, 183, 197, 0.2))',
			border: 'var(--mia-primary, #ffb7c5)',
			avatar: '🌸',
		},
		user: {
			bg: 'var(--mia-bubble-user, var(--interactive-accent, #7c3aed))',
			border: 'var(--interactive-accent-hover, #8b5cf6)',
			avatar: '👤',
		},
		system: {
			bg: 'var(--mia-bubble-system, rgba(255, 183, 197, 0.1))',
			border: 'var(--text-muted, #6b7280)',
			avatar: '✨',
		},
	};

	constructor(message: ChatMessage, options: MessageBubbleOptions = {}) {
		this.message = message;
		this.options = {
			showAvatar: true,
			showTimestamp: true,
			showActions: true,
			enableMarkdown: true,
			compact: false,
			...options,
		};

		this.element = this.createElement();
		this.setupEventListeners();
	}

	private createElement(): HTMLElement {
		const isUser = this.message.role === 'user';
		const isSystem = this.message.role === 'system';
		const colors = isUser ? this.COLORS.user : isSystem ? this.COLORS.system : this.COLORS.mia;

		// Main container
		const container = document.createElement('div');
		container.className = `mia-message-bubble mia-message-${this.message.role}`;
		container.setAttribute('data-message-id', this.message.id);
		container.setAttribute('role', 'article');
		container.setAttribute('aria-label', `${this.message.role} message`);

		// Layout direction
		container.style.cssText = `
			display: flex;
			flex-direction: ${isUser ? 'row-reverse' : 'row'};
			align-items: flex-start;
			margin-bottom: ${this.options.compact ? '0.5rem' : '1rem'};
			animation: mia-message-appear 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
		`;

		// Avatar
		if (this.options.showAvatar) {
			const avatar = this.createAvatar(colors.avatar, isUser);
			container.appendChild(avatar);
		}

		// Message content wrapper
		const contentWrapper = document.createElement('div');
		contentWrapper.className = 'mia-message-content-wrapper';
		contentWrapper.style.cssText = `
			display: flex;
			flex-direction: column;
			max-width: 75%;
			${isUser ? 'margin-right: 0.75rem;' : 'margin-left: 0.75rem;'}
		`;

		// Bubble
		const bubble = document.createElement('div');
		bubble.className = 'mia-message-bubble-content';
		bubble.style.cssText = `
			background: ${isUser ? colors.bg : colors.bg};
			color: ${isUser ? 'white' : 'var(--text-normal)'};
			padding: ${this.options.compact ? '0.5rem 0.75rem' : '0.75rem 1rem'};
			border-radius: ${isUser ? '1rem 1rem 0.25rem 1rem' : '1rem 1rem 1rem 0.25rem'};
			box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
			border: 1px solid ${isUser ? 'transparent' : colors.border};
			position: relative;
			word-wrap: break-word;
			line-height: 1.5;
		`;

		// Message text
		const textContent = document.createElement('div');
		textContent.className = 'mia-message-text';
		if (this.options.enableMarkdown) {
			textContent.innerHTML = this.renderMarkdown(this.message.content);
		} else {
			textContent.textContent = this.message.content;
		}
		bubble.appendChild(textContent);

		// Status indicator (for user messages)
		if (isUser && this.message.status) {
			const status = this.createStatusIndicator();
			bubble.appendChild(status);
		}

		contentWrapper.appendChild(bubble);

		// Timestamp and actions row
		if (this.options.showTimestamp || this.options.showActions) {
			const metaRow = document.createElement('div');
			metaRow.className = 'mia-message-meta';
			metaRow.style.cssText = `
				display: flex;
				align-items: center;
				gap: 0.5rem;
				margin-top: 0.25rem;
				${isUser ? 'justify-content: flex-end;' : 'justify-content: flex-start;'}
				opacity: 0.7;
				font-size: 0.75rem;
				color: var(--text-muted);
				transition: opacity 0.2s ease;
			`;

			// Timestamp
			if (this.options.showTimestamp) {
				const timestamp = document.createElement('time');
				timestamp.className = 'mia-message-timestamp';
				timestamp.dateTime = new Date(this.message.timestamp).toISOString();
				timestamp.textContent = this.formatTimestamp(this.message.timestamp);
				metaRow.appendChild(timestamp);
			}

			// Actions
			if (this.options.showActions) {
				const actions = this.createActionButtons();
				metaRow.appendChild(actions);
			}

			contentWrapper.appendChild(metaRow);
		}

		container.appendChild(contentWrapper);

		return container;
	}

	private createAvatar(emoji: string, isUser: boolean): HTMLElement {
		const avatar = document.createElement('div');
		avatar.className = `mia-message-avatar mia-avatar-${isUser ? 'user' : 'mia'}`;
		avatar.setAttribute('aria-hidden', 'true');
		avatar.style.cssText = `
			width: 2rem;
			height: 2rem;
			border-radius: 50%;
			background: ${isUser ? 'var(--interactive-accent)' : 'linear-gradient(135deg, #ffb7c5 0%, #ffd1dc 100%)'};
			display: flex;
			align-items: center;
			justify-content: center;
			font-size: 1rem;
			flex-shrink: 0;
			box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
		`;
		avatar.textContent = emoji;
		return avatar;
	}

	private createStatusIndicator(): HTMLElement {
		const status = document.createElement('span');
		status.className = `mia-message-status mia-status-${this.message.status}`;
		status.style.cssText = `
			display: inline-flex;
			align-items: center;
			margin-left: 0.5rem;
			font-size: 0.75rem;
			opacity: 0.6;
		`;

		const icons: Record<string, string> = {
			sending: '⏳',
			sent: '✓',
			error: '⚠️',
			retrying: '🔄',
		};

		status.textContent = icons[this.message.status || 'sent'];
		status.title = this.message.status || 'sent';

		return status;
	}

	private createActionButtons(): HTMLElement {
		const actions = document.createElement('div');
		actions.className = 'mia-message-actions';
		actions.style.cssText = `
			display: flex;
			gap: 0.25rem;
			opacity: 0;
			transition: opacity 0.2s ease;
		`;

		// Copy button
		const copyBtn = this.createActionButton('📋', 'Copy message', 'copy');
		actions.appendChild(copyBtn);

		// Retry button (only for user messages with error)
		if (this.message.role === 'user' && this.message.status === 'error') {
			const retryBtn = this.createActionButton('🔄', 'Retry sending', 'retry');
			actions.appendChild(retryBtn);
		}

		// Show actions on hover (handled via CSS or parent)
		actions.addEventListener('mouseenter', () => {
			actions.style.opacity = '1';
		});
		actions.addEventListener('mouseleave', () => {
			actions.style.opacity = '0';
		});

		return actions;
	}

	private createActionButton(icon: string, label: string, action: string): HTMLElement {
		const btn = document.createElement('button');
		btn.className = `mia-action-btn mia-action-${action}`;
		btn.setAttribute('aria-label', label);
		btn.setAttribute('data-action', action);
		btn.style.cssText = `
			background: none;
			border: none;
			cursor: pointer;
			padding: 0.25rem;
			border-radius: 0.25rem;
			font-size: 0.875rem;
			transition: background 0.2s ease, transform 0.1s ease;
			opacity: 0.6;
		`;
		btn.textContent = icon;

		btn.addEventListener('mouseenter', () => {
			btn.style.background = 'var(--background-modifier-hover)';
			btn.style.opacity = '1';
		});
		btn.addEventListener('mouseleave', () => {
			btn.style.background = 'none';
			btn.style.opacity = '0.6';
		});
		btn.addEventListener('mousedown', () => {
			btn.style.transform = 'scale(0.95)';
		});
		btn.addEventListener('mouseup', () => {
			btn.style.transform = 'scale(1)';
		});

		this.actionButtons.set(action, btn);
		return btn;
	}

	private renderMarkdown(content: string): string {
		// Simple markdown rendering (can be enhanced with a proper library)
		let html = content
			// Code blocks
			.replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre class="mia-code-block"><code class="language-$1">$2</code></pre>')
			// Inline code
			.replace(/`([^`]+)`/g, '<code class="mia-inline-code">$1</code>')
			// Bold
			.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
			// Italic
			.replace(/\*([^*]+)\*/g, '<em>$1</em>')
			// Strikethrough
			.replace(/~~([^~]+)~~/g, '<del>$1</del>')
			// Links
			.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="mia-message-link" target="_blank">$1</a>')
			// Line breaks
			.replace(/\n/g, '<br>');

		return html;
	}

	private formatTimestamp(timestamp: number): string {
		const date = new Date(timestamp);
		const now = new Date();
		const diff = now.getTime() - date.getTime();
		const minutes = Math.floor(diff / 60000);
		const hours = Math.floor(diff / 3600000);
		const days = Math.floor(diff / 86400000);

		if (minutes < 1) return 'just now';
		if (minutes < 60) return `${minutes}m ago`;
		if (hours < 24) return `${hours}h ago`;
		if (days === 1) return 'yesterday';
		if (days < 7) return `${days} days ago`;
		
		return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
	}

	private setupEventListeners(): void {
		// Copy action
		const copyBtn = this.actionButtons.get('copy');
		if (copyBtn) {
			copyBtn.addEventListener('click', async () => {
				try {
					await navigator.clipboard.writeText(this.message.content);
					this.showToast('Copied!');
				} catch (err) {
					this.showToast('Failed to copy');
				}
			});
		}

		// Retry action
		const retryBtn = this.actionButtons.get('retry');
		if (retryBtn) {
			retryBtn.addEventListener('click', () => {
				this.element.dispatchEvent(new CustomEvent('message-retry', {
					detail: { messageId: this.message.id },
					bubbles: true,
				}));
			});
		}

		// Show/hide actions on hover
		this.element.addEventListener('mouseenter', () => {
			const actions = this.element.querySelector('.mia-message-actions') as HTMLElement;
			if (actions) actions.style.opacity = '1';
		});
		this.element.addEventListener('mouseleave', () => {
			const actions = this.element.querySelector('.mia-message-actions') as HTMLElement;
			if (actions) actions.style.opacity = '0';
		});
	}

	private showToast(message: string): void {
		const toast = document.createElement('div');
		toast.className = 'mia-toast';
		toast.textContent = message;
		toast.style.cssText = `
			position: fixed;
			bottom: 1rem;
			left: 50%;
			transform: translateX(-50%);
			background: var(--background-primary);
			color: var(--text-normal);
			padding: 0.5rem 1rem;
			border-radius: 0.5rem;
			box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
			font-size: 0.875rem;
			z-index: 1000;
			animation: mia-toast-appear 0.3s ease;
		`;
		document.body.appendChild(toast);
		setTimeout(() => toast.remove(), 2000);
	}

	// Public API
	public getElement(): HTMLElement {
		return this.element;
	}

	public getMessage(): ChatMessage {
		return this.message;
	}

	public updateMessage(updates: Partial<ChatMessage>): void {
		this.message = { ...this.message, ...updates };
		
		// Update status indicator if changed
		if (updates.status) {
			const statusEl = this.element.querySelector('.mia-message-status');
			if (statusEl) {
				const icons: Record<string, string> = {
					sending: '⏳',
					sent: '✓',
					error: '⚠️',
					retrying: '🔄',
				};
				statusEl.textContent = icons[updates.status];
				statusEl.className = `mia-message-status mia-status-${updates.status}`;
			}
		}
	}

	public highlight(): void {
		this.element.style.animation = 'mia-message-highlight 1s ease';
		setTimeout(() => {
			this.element.style.animation = '';
		}, 1000);
	}

	public destroy(): void {
		this.element.remove();
	}
}

// CSS animations (injected via JavaScript if not present)
const animationStyles = `
@keyframes mia-message-appear {
	from {
		opacity: 0;
		transform: translateY(10px) scale(0.95);
	}
	to {
		opacity: 1;
		transform: translateY(0) scale(1);
	}
}

@keyframes mia-toast-appear {
	from {
		opacity: 0;
		transform: translateX(-50%) translateY(10px);
	}
	to {
		opacity: 1;
		transform: translateX(-50%) translateY(0);
	}
}

@keyframes mia-message-highlight {
	0%, 100% { background: transparent; }
	50% { background: rgba(255, 183, 197, 0.3); }
}
`;

// Inject styles once
if (!document.getElementById('mia-bubble-animations')) {
	const style = document.createElement('style');
	style.id = 'mia-bubble-animations';
	style.textContent = animationStyles;
	document.head.appendChild(style);
}
