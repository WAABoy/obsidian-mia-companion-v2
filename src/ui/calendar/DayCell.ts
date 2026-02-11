/**
 * DayCell.ts - Individual day cell component for calendar
 * 
 * Features:
 * - Date display with today highlighting
 * - Event dots (max 4, then "+more")
 * - Hover tooltips with event details
 * - Click to show day details popup
 * - Smooth hover animations
 */

import { EventDot, EventDotData, EventType } from './EventDot';

export interface CalendarEvent {
    id: string;
    title: string;
    type: EventType;
    time?: string;
    description?: string;
    completed?: boolean;
}

export interface DayCellOptions {
    date: Date;
    isCurrentMonth: boolean;
    isToday: boolean;
    events?: CalendarEvent[];
    onClick?: (date: Date, events: CalendarEvent[]) => void;
    onHover?: (date: Date, events: CalendarEvent[]) => void;
}

export class DayCell {
    private element: HTMLElement;
    private options: DayCellOptions;
    private eventDotsContainer: HTMLElement | null = null;
    private dateLabel: HTMLElement | null = null;

    constructor(options: DayCellOptions) {
        this.options = {
            events: [],
            ...options,
        };
        this.element = this.createElement();
    }

    private createElement(): HTMLElement {
        const cell = document.createElement('div');
        cell.className = this.buildClassName();
        cell.setAttribute('role', 'gridcell');
        cell.setAttribute('tabindex', '0');
        
        // Add date attribute for accessibility
        const dateStr = this.formatDateISO(this.options.date);
        cell.setAttribute('data-date', dateStr);
        cell.setAttribute('aria-label', this.buildAriaLabel());

        // Create content container
        const content = document.createElement('div');
        content.className = 'mia-day-cell-content';

        // Date label
        this.dateLabel = document.createElement('span');
        this.dateLabel.className = 'mia-day-cell-date';
        this.dateLabel.textContent = String(this.options.date.getDate());
        content.appendChild(this.dateLabel);

        // Event dots container
        if (this.options.events && this.options.events.length > 0) {
            this.eventDotsContainer = this.createEventDots();
            content.appendChild(this.eventDotsContainer);
        }

        cell.appendChild(content);

        // Attach event listeners
        this.attachEventListeners(cell);

        return cell;
    }

    private buildClassName(): string {
        const classes = ['mia-day-cell'];
        
        if (!this.options.isCurrentMonth) {
            classes.push('mia-day-cell-other-month');
        }
        
        if (this.options.isToday) {
            classes.push('mia-day-cell-today');
        }
        
        if (this.options.events && this.options.events.length > 0) {
            classes.push('mia-day-cell-has-events');
        }

        if (this.isWeekend()) {
            classes.push('mia-day-cell-weekend');
        }

        return classes.join(' ');
    }

    private buildAriaLabel(): string {
        const dateStr = this.formatDateLong(this.options.date);
        const eventCount = this.options.events?.length || 0;
        
        let label = dateStr;
        if (this.options.isToday) {
            label += ', today';
        }
        if (eventCount > 0) {
            label += `, ${eventCount} event${eventCount !== 1 ? 's' : ''}`;
        }
        
        return label;
    }

    private isWeekend(): boolean {
        const day = this.options.date.getDay();
        return day === 0 || day === 6; // Sunday or Saturday
    }

    private createEventDots(): HTMLElement {
        // Group events by type for dot display
        const eventGroups = this.groupEventsByType(this.options.events || []);
        
        const dotData: EventDotData[] = eventGroups.map(group => ({
            type: group.type,
            count: group.events.length,
            tooltip: this.buildTooltipForGroup(group),
        }));

        return EventDot.createDotGroup(dotData, 4);
    }

    private groupEventsByType(events: CalendarEvent[]): { type: EventType; events: CalendarEvent[] }[] {
        const groups: Record<string, CalendarEvent[]> = {};
        
        events.forEach(event => {
            const key = event.type;
            if (!groups[key]) {
                groups[key] = [];
            }
            groups[key].push(event);
        });

        return Object.entries(groups).map(([type, typeEvents]) => ({
            type: type as EventType,
            events: typeEvents,
        }));
    }

    private buildTooltipForGroup(group: { type: EventType; events: CalendarEvent[] }): string {
        const typeLabel = group.type.charAt(0).toUpperCase() + group.type.slice(1);
        const eventTitles = group.events.slice(0, 3).map(e => e.title).join(', ');
        const moreCount = group.events.length - 3;
        
        let tooltip = `${group.events.length} ${typeLabel}`;
        if (eventTitles) {
            tooltip += `: ${eventTitles}`;
        }
        if (moreCount > 0) {
            tooltip += ` (+${moreCount} more)`;
        }
        
        return tooltip;
    }

    private attachEventListeners(cell: HTMLElement): void {
        // Click handler
        cell.addEventListener('click', () => {
            this.handleClick();
        });

        // Keyboard handler for accessibility
        cell.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.handleClick();
            }
        });

        // Hover handlers
        cell.addEventListener('mouseenter', () => {
            this.handleHover();
        });

        // Touch handler for mobile
        cell.addEventListener('touchstart', () => {
            cell.classList.add('mia-day-cell-touch');
        });

        cell.addEventListener('touchend', () => {
            setTimeout(() => {
                cell.classList.remove('mia-day-cell-touch');
            }, 150);
        });
    }

    private handleClick(): void {
        this.element.classList.add('mia-day-cell-active');
        
        setTimeout(() => {
            this.element.classList.remove('mia-day-cell-active');
        }, 150);

        if (this.options.onClick) {
            this.options.onClick(this.options.date, this.options.events || []);
        }

        // Dispatch custom event
        this.element.dispatchEvent(new CustomEvent('daycell:click', {
            bubbles: true,
            detail: {
                date: this.options.date,
                events: this.options.events,
            },
        }));
    }

    private handleHover(): void {
        if (this.options.onHover) {
            this.options.onHover(this.options.date, this.options.events || []);
        }
    }

    private formatDateISO(date: Date): string {
        return date.toISOString().split('T')[0];
    }

    private formatDateLong(date: Date): string {
        return date.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    }

    // Public API
    public getElement(): HTMLElement {
        return this.element;
    }

    public getDate(): Date {
        return this.options.date;
    }

    public updateEvents(events: CalendarEvent[]): void {
        this.options.events = events;
        
        // Update class name
        this.element.className = this.buildClassName();
        
        // Update ARIA label
        this.element.setAttribute('aria-label', this.buildAriaLabel());

        // Update event dots
        const content = this.element.querySelector('.mia-day-cell-content');
        const existingDots = content?.querySelector('.mia-event-dot-group');
        
        if (existingDots) {
            existingDots.remove();
        }

        if (events.length > 0) {
            this.eventDotsContainer = this.createEventDots();
            content?.appendChild(this.eventDotsContainer);
        }
    }

    public addEvent(event: CalendarEvent): void {
        const events = [...(this.options.events || []), event];
        this.updateEvents(events);
    }

    public removeEvent(eventId: string): void {
        const events = (this.options.events || []).filter(e => e.id !== eventId);
        this.updateEvents(events);
    }

    public setSelected(selected: boolean): void {
        if (selected) {
            this.element.classList.add('mia-day-cell-selected');
            this.element.setAttribute('aria-selected', 'true');
        } else {
            this.element.classList.remove('mia-day-cell-selected');
            this.element.setAttribute('aria-selected', 'false');
        }
    }

    public focus(): void {
        this.element.focus();
    }

    public destroy(): void {
        this.element.remove();
    }

    // Static helper to create a week row
    public static createWeekRow(cells: DayCell[]): HTMLElement {
        const row = document.createElement('div');
        row.className = 'mia-calendar-week-row';
        row.setAttribute('role', 'row');
        
        cells.forEach(cell => {
            row.appendChild(cell.getElement());
        });
        
        return row;
    }
}
