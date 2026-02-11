/**
 * TypingIndicator - Animated "Mia is typing" component
 * 
 * Features:
 * - Animated three dots with staggered pulse
 * - Mia avatar with gentle bounce
 * - Sakura petal aesthetic
 * - Smooth transitions in/out
 * - ARIA live region support
 */

export interface TypingIndicatorOptions {
	avatar?: string;
	text?: string;
	dotCount?: number;
	animationSpeed?: 'slow' | 'normal' | 'fast';
}

export class TypingIndicator {
	private element: HTMLElement;
	private options: TypingIndicatorOptions;
	private isVisible: boolean = false;
	private dots: HTMLElement[] = [];

	constructor(options: TypingIndicatorOptions = {}) {
		this.options = {
			avatar: '🌸',
			text: 'Mia is typing',
			dotCount: 3,
			animationSpeed: 'normal',
			...options,
		};

		this.element = this.createElement();
	}

	private createElement(): HTMLElement {
		const container = document.createElement('div');
		container.className = 'mia-typing-indicator';
		container.setAttribute('role', 'status');
		container.setAttribute('aria-live', 'polite');
		container.setAttribute('aria-label', this.options.text!);
		container.style.cssText = `
			display: flex;
			align-items: flex-end;
			gap: 0.75rem;
			margin-bottom: 1rem;
			opacity: 0;
			transform: translateY(10px);
			transition: opacity 0.3s ease, transform 0.3s ease;
			pointer-events: none;
		`;

		// Avatar with gentle bounce
		const avatarWrapper = document.createElement('div');
		avatarWrapper.className = 'mia-typing-avatar';
		avatarWrapper.style.cssText = `
			width: 2rem;
			height: 2rem;
			border-radius: 50%;
			background: linear-gradient(135deg, #ffb7c5 0%, #ffd1dc 100%);
			display: flex;
			align-items: center;
			justify-content: center;
			font-size: 1rem;
			flex-shrink: 0;
			animation: mia-typing-bounce 1.5s ease-in-out infinite;
		`;
		avatarWrapper.textContent = this.options.avatar!;
		container.appendChild(avatarWrapper);

		// Typing bubble
		const bubble = document.createElement('div');
		bubble.className = 'mia-typing-bubble';
		bubble.style.cssText = `
			background: rgba(255, 183, 197, 0.2);
			border: 1px solid rgba(255, 183, 197, 0.4);
			padding: 0.75rem 1rem;
			border-radius: 1rem 1rem 1rem 0.25rem;
			display: flex;
			align-items: center;
			gap: 0.5rem;
			box-shadow: 0 2px 8px rgba(255, 183, 197, 0.15);
		`;

		// Dots container
		const dotsContainer = document.createElement('div');
		dotsContainer.className = 'mia-typing-dots';
		dotsContainer.style.cssText = `
			display: flex;
			gap: 0.25rem;
			align-items: center;
		`;

		// Create dots
		const speedMap = {
			slow: '1.5s',
			normal: '1s',
			fast: '0.6s',
		};
		const animationDuration = speedMap[this.options.animationSpeed!];

		for (let i = 0; i < this.options.dotCount!; i++) {
			const dot = document.createElement('span');
			dot.className = 'mia-typing-dot';
			dot.style.cssText = `
				width: 6px;
				height: 6px;
				background: #ffb7c5;
				border-radius: 50%;
				animation: mia-typing-pulse ${animationDuration} ease-in-out infinite;
				animation-delay: ${i * 0.15}s;
			`;
			dotsContainer.appendChild(dot);
			this.dots.push(dot);
		}

		bubble.appendChild(dotsContainer);

		// Optional text
		if (this.options.text) {
			const text = document.createElement('span');
			text.className = 'mia-typing-text';
			text.style.cssText = `
				font-size: 0.75rem;
				color: var(--text-muted);
				margin-left: 0.25rem;
				opacity: 0.8;
			`;
			text.textContent = this.options.text;
			bubble.appendChild(text);
		}

		container.appendChild(bubble);

		return container;
	}

	/**
	 * Show the typing indicator with animation
	 */
	public show(): void {
		if (this.isVisible) return;
		
		this.isVisible = true;
		this.element.style.opacity = '1';
		this.element.style.transform = 'translateY(0)';
		this.element.setAttribute('aria-hidden', 'false');

		// Add subtle glow effect
		const bubble = this.element.querySelector('.mia-typing-bubble') as HTMLElement;
		if (bubble) {
			bubble.style.boxShadow = '0 2px 12px rgba(255, 183, 197, 0.3)';
		}
	}

	/**
	 * Hide the typing indicator with animation
	 */
	public hide(): void {
		if (!this.isVisible) return;

		this.isVisible = false;
		this.element.style.opacity = '0';
		this.element.style.transform = 'translateY(10px)';
		this.element.setAttribute('aria-hidden', 'true');

		// Reset glow
		const bubble = this.element.querySelector('.mia-typing-bubble') as HTMLElement;
		if (bubble) {
			bubble.style.boxShadow = '0 2px 8px rgba(255, 183, 197, 0.15)';
		}
	}

	/**
	 * Toggle visibility
	 */
	public toggle(): void {
		if (this.isVisible) {
			this.hide();
		} else {
			this.show();
		}
	}

	/**
	 * Check if indicator is visible
	 */
	public getIsVisible(): boolean {
		return this.isVisible;
	}

	/**
	 * Update the typing text
	 */
	public setText(text: string): void {
		this.options.text = text;
		const textEl = this.element.querySelector('.mia-typing-text');
		if (textEl) {
			textEl.textContent = text;
		}
		this.element.setAttribute('aria-label', text);
	}

	/**
	 * Get the DOM element
	 */
	public getElement(): HTMLElement {
		return this.element;
	}

	/**
	 * Destroy and clean up
	 */
	public destroy(): void {
		this.hide();
		setTimeout(() => {
			this.element.remove();
		}, 300);
	}
}

// CSS animations for typing indicator
const typingAnimations = `
@keyframes mia-typing-pulse {
	0%, 60%, 100% {
		transform: scale(1);
		opacity: 0.4;
	}
	30% {
		transform: scale(1.4);
		opacity: 1;
	}
}

@keyframes mia-typing-bounce {
	0%, 100% {
		transform: translateY(0);
	}
	50% {
		transform: translateY(-3px);
	}
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
	.mia-typing-dot {
		animation: none !important;
		opacity: 0.7;
	}
	
	.mia-typing-avatar {
		animation: none !important;
	}
	
	.mia-typing-indicator {
		transition: none !important;
	}
}
`;

// Inject styles once
if (!document.getElementById('mia-typing-animations')) {
	const style = document.createElement('style');
	style.id = 'mia-typing-animations';
	style.textContent = typingAnimations;
	document.head.appendChild(style);
}
