/**
 * EventDot.ts - Color-coded event indicator component
 * 
 * Displays small colored dots representing different event types:
 * 🔵 Tasks, 🟢 Completed, 🟡 Reminders, 🟣 Goals
 */

export enum EventType {
    TASK = 'task',
    COMPLETED = 'completed',
    REMINDER = 'reminder',
    GOAL = 'goal',
}

export interface EventDotData {
    type: EventType;
    count: number;
    tooltip?: string;
}

export interface EventDotOptions {
    type: EventType;
    size?: 'sm' | 'md' | 'lg';
    showTooltip?: boolean;
    tooltipText?: string;
}

export class EventDot {
    private element: HTMLElement;
    private options: EventDotOptions;

    // Color mappings following UX design system
    private static readonly COLORS: Record<EventType, string> = {
        [EventType.TASK]: '#60a5fa',      // 🔵 Blue
        [EventType.COMPLETED]: '#4ade80',  // 🟢 Green
        [EventType.REMINDER]: '#fbbf24',   // 🟡 Yellow/Amber
        [EventType.GOAL]: '#c084fc',       // 🟣 Purple
    };

    private static readonly CSS_CLASSES: Record<EventType, string> = {
        [EventType.TASK]: 'mia-event-task',
        [EventType.COMPLETED]: 'mia-event-completed',
        [EventType.REMINDER]: 'mia-event-reminder',
        [EventType.GOAL]: 'mia-event-goal',
    };

    private static readonly SIZE_MAP: Record<string, { width: string; height: string }> = {
        sm: { width: '6px', height: '6px' },
        md: { width: '8px', height: '8px' },
        lg: { width: '10px', height: '10px' },
    };

    constructor(options: EventDotOptions) {
        this.options = {
            size: 'md',
            showTooltip: true,
            ...options,
        };
        this.element = this.createElement();
    }

    private createElement(): HTMLElement {
        const dot = document.createElement('span');
        dot.className = `mia-event-dot ${EventDot.CSS_CLASSES[this.options.type]}`;
        
        const size = EventDot.SIZE_MAP[this.options.size || 'md'];
        dot.style.width = size.width;
        dot.style.height = size.height;
        dot.style.backgroundColor = EventDot.COLORS[this.options.type];
        
        // Add ARIA label for accessibility
        dot.setAttribute('aria-label', `${this.options.type} event indicator`);
        
        // Add tooltip if enabled
        if (this.options.showTooltip && this.options.tooltipText) {
            dot.setAttribute('data-tooltip', this.options.tooltipText);
            dot.setAttribute('title', this.options.tooltipText);
        }

        return dot;
    }

    public getElement(): HTMLElement {
        return this.element;
    }

    public setTooltip(text: string): void {
        this.options.tooltipText = text;
        this.element.setAttribute('data-tooltip', text);
        this.element.setAttribute('title', text);
    }

    public updateType(type: EventType): void {
        // Remove old type class
        this.element.classList.remove(EventDot.CSS_CLASSES[this.options.type]);
        
        // Update type and apply new styling
        this.options.type = type;
        this.element.classList.add(EventDot.CSS_CLASSES[type]);
        this.element.style.backgroundColor = EventDot.COLORS[type];
        this.element.setAttribute('aria-label', `${type} event indicator`);
    }

    public pulse(): void {
        this.element.classList.add('mia-event-dot-pulse');
        setTimeout(() => {
            this.element.classList.remove('mia-event-dot-pulse');
        }, 600);
    }

    public destroy(): void {
        this.element.remove();
    }

    // Static factory methods for convenience
    public static createTask(tooltip?: string): EventDot {
        return new EventDot({ type: EventType.TASK, tooltipText: tooltip });
    }

    public static createCompleted(tooltip?: string): EventDot {
        return new EventDot({ type: EventType.COMPLETED, tooltipText: tooltip });
    }

    public static createReminder(tooltip?: string): EventDot {
        return new EventDot({ type: EventType.REMINDER, tooltipText: tooltip });
    }

    public static createGoal(tooltip?: string): EventDot {
        return new EventDot({ type: EventType.GOAL, tooltipText: tooltip });
    }

    // Static method to create a group of dots (max 4, then "+more")
    public static createDotGroup(
        events: EventDotData[],
        maxVisible: number = 4
    ): HTMLElement {
        const container = document.createElement('div');
        container.className = 'mia-event-dot-group';

        const visibleEvents = events.slice(0, maxVisible);
        const hiddenCount = events.length - maxVisible;

        visibleEvents.forEach(eventData => {
            const dot = new EventDot({
                type: eventData.type,
                size: 'sm',
                tooltipText: eventData.tooltip || `${eventData.count} ${eventData.type}(s)`,
            });
            container.appendChild(dot.getElement());
        });

        if (hiddenCount > 0) {
            const moreIndicator = document.createElement('span');
            moreIndicator.className = 'mia-event-dot-more';
            moreIndicator.textContent = `+${hiddenCount}`;
            moreIndicator.setAttribute('data-tooltip', `${hiddenCount} more events`);
            moreIndicator.setAttribute('title', `${hiddenCount} more events`);
            container.appendChild(moreIndicator);
        }

        return container;
    }
}
