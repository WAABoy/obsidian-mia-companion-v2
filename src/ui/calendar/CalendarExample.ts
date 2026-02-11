/**
 * Calendar Example - Demo usage of the Calendar UI Components
 * 
 * This file demonstrates how to use the Mia Calendar components
 * in an Obsidian plugin context.
 */

import { MonthView, CalendarEvent, EventType } from './index';
import './../styles/calendar.css';

export class CalendarExample {
    private monthView: MonthView | null = null;
    private container: HTMLElement;

    constructor(container: HTMLElement) {
        this.container = container;
    }

    /**
     * Initialize and render the calendar
     */
    public init(): void {
        // Create sample events
        const events = this.generateSampleEvents();

        // Create the month view
        this.monthView = new MonthView({
            initialDate: new Date(),
            events: events,
            weekStartsOn: 1, // Monday start (like Google Calendar)
            showWeekNumbers: false,
            
            // Callback when a date is selected
            onDateSelect: (date, events) => {
                console.log('Selected date:', date);
                console.log('Events:', events);
                
                // In Obsidian, you might open a note or modal
                // new DayDetailModal(this.app, date, events).open();
            },
            
            // Callback when an event is clicked in the popup
            onEventClick: (event) => {
                console.log('Clicked event:', event);
                
                // Navigate to task or open detail view
                // this.navigateToEvent(event);
            },
            
            // Callback when month changes
            onMonthChange: (date) => {
                console.log('Month changed to:', date);
                
                // Fetch new events from Google Calendar API
                // this.fetchEventsForMonth(date);
            },
        });

        // Append to container
        this.container.appendChild(this.monthView.getElement());
    }

    /**
     * Generate sample events for demonstration
     */
    private generateSampleEvents(): Map<string, CalendarEvent[]> {
        const events = new Map<string, CalendarEvent[]>();
        const today = new Date();

        // Today's events
        const todayKey = this.formatDateKey(today);
        events.set(todayKey, [
            {
                id: '1',
                title: 'Review plugin code',
                type: EventType.TASK,
                time: '10:00',
                description: 'Code review for Mia Companion',
            },
            {
                id: '2',
                title: 'Write 500 words',
                type: EventType.GOAL,
                completed: true,
            },
            {
                id: '3',
                title: 'Team meeting',
                type: EventType.REMINDER,
                time: '14:00',
            },
        ]);

        // Tomorrow's events
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowKey = this.formatDateKey(tomorrow);
        events.set(tomorrowKey, [
            {
                id: '4',
                title: 'Deploy to production',
                type: EventType.TASK,
                completed: true,
            },
            {
                id: '5',
                title: 'Update documentation',
                type: EventType.TASK,
            },
            {
                id: '6',
                title: 'Weekly review',
                type: EventType.REMINDER,
                time: '16:00',
            },
            {
                id: '7',
                title: 'Exercise',
                type: EventType.GOAL,
            },
            {
                id: '8',
                title: 'Read 30 min',
                type: EventType.GOAL,
            },
        ]);

        // Add some random events throughout the month
        for (let i = 2; i < 20; i += 3) {
            const date = new Date(today);
            date.setDate(date.getDate() + i);
            const key = this.formatDateKey(date);
            
            const randomEvents: CalendarEvent[] = [
                {
                    id: `random-${i}`,
                    title: `Task ${i}`,
                    type: EventType.TASK,
                },
            ];
            
            if (i % 2 === 0) {
                randomEvents.push({
                    id: `reminder-${i}`,
                    title: `Reminder ${i}`,
                    type: EventType.REMINDER,
                });
            }
            
            events.set(key, randomEvents);
        }

        return events;
    }

    /**
     * Format date as YYYY-MM-DD key
     */
    private formatDateKey(date: Date): string {
        return date.toISOString().split('T')[0];
    }

    /**
     * Add a new event to the calendar
     */
    public addEvent(date: Date, event: CalendarEvent): void {
        if (this.monthView) {
            this.monthView.addEvent(date, event);
        }
    }

    /**
     * Remove an event from the calendar
     */
    public removeEvent(date: Date, eventId: string): void {
        if (this.monthView) {
            this.monthView.removeEvent(date, eventId);
        }
    }

    /**
     * Navigate to a specific date
     */
    public goToDate(date: Date): void {
        if (this.monthView) {
            this.monthView.setDate(date);
        }
    }

    /**
     * Refresh the calendar display
     */
    public refresh(): void {
        if (this.monthView) {
            this.monthView.refresh();
        }
    }

    /**
     * Update all events
     */
    public updateEvents(events: Map<string, CalendarEvent[]>): void {
        if (this.monthView) {
            this.monthView.updateEvents(events);
        }
    }

    /**
     * Destroy the calendar
     */
    public destroy(): void {
        if (this.monthView) {
            this.monthView.destroy();
            this.monthView = null;
        }
    }
}

/**
 * Example integration with Obsidian Plugin
 * 
 * ```typescript
 * import { ItemView, WorkspaceLeaf } from 'obsidian';
 * import { CalendarExample } from './calendar/CalendarExample';
 * 
 * export const VIEW_TYPE_CALENDAR = 'mia-calendar-view';
 * 
 * export class CalendarView extends ItemView {
 *     private calendar: CalendarExample;
 * 
 *     constructor(leaf: WorkspaceLeaf) {
 *         super(leaf);
 *     }
 * 
 *     getViewType(): string {
 *         return VIEW_TYPE_CALENDAR;
 *     }
 * 
 *     getDisplayText(): string {
 *         return '📅 Calendar';
 *     }
 * 
 *     async onOpen(): Promise<void> {
 *         const container = this.containerEl.children[1];
 *         container.empty();
 *         
 *         this.calendar = new CalendarExample(container);
 *         this.calendar.init();
 *     }
 * 
 *     async onClose(): Promise<void> {
 *         this.calendar?.destroy();
 *     }
 * }
 * ```
 */
