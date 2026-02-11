/**
 * MonthView.ts - Main month grid view component
 * 
 * Features:
 * - 7-column grid (Mon-Sun) like Google Calendar
 * - Color-coded event dots (Tasks, Completed, Reminders, Goals)
 * - Today highlighted with circle
 * - Event dots under dates (max 4, then "+more")
 * - Smooth animations between months
 * - Responsive (mobile-friendly)
 * - Obsidian theme integration
 */

import { DayCell, CalendarEvent } from './DayCell';
import { CalendarHeader } from './CalendarHeader';
import { EventType } from './EventDot';

export interface MonthViewOptions {
    initialDate?: Date;
    events?: Map<string, CalendarEvent[]>; // Key: 'YYYY-MM-DD'
    onDateSelect?: (date: Date, events: CalendarEvent[]) => void;
    onEventClick?: (event: CalendarEvent) => void;
    onMonthChange?: (date: Date) => void;
    weekStartsOn?: 0 | 1; // 0 = Sunday, 1 = Monday
    minDate?: Date;
    maxDate?: Date;
    showWeekNumbers?: boolean;
}

export interface DayPopupData {
    date: Date;
    events: CalendarEvent[];
    position: { x: number; y: number };
}

export class MonthView {
    private element: HTMLElement;
    private options: MonthViewOptions;
    private header: CalendarHeader;
    private gridContainer: HTMLElement;
    private dayCells: Map<string, DayCell> = new Map();
    private currentDate: Date;
    private popup: HTMLElement | null = null;
    private isAnimating: boolean = false;

    // Day names for header
    private readonly dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    private readonly dayNamesFull = [
        'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
    ];

    constructor(options: MonthViewOptions = {}) {
        this.options = {
            initialDate: new Date(),
            events: new Map(),
            weekStartsOn: 1, // Monday default like Google Calendar
            showWeekNumbers: false,
            ...options,
        };
        
        // Clone the date to avoid mutations
        this.currentDate = new Date(this.options.initialDate!);
        this.currentDate.setDate(1); // Always start at first of month
        
        this.element = this.createElement();
    }

    private createElement(): HTMLElement {
        const container = document.createElement('div');
        container.className = 'mia-calendar-month-view';
        container.setAttribute('role', 'application');
        container.setAttribute('aria-label', 'Calendar month view');

        // Create header
        this.header = new CalendarHeader({
            currentDate: this.currentDate,
            onPrevMonth: () => this.navigateMonth(-1),
            onNextMonth: () => this.navigateMonth(1),
            onToday: () => this.goToToday(),
            minDate: this.options.minDate,
            maxDate: this.options.maxDate,
        });
        container.appendChild(this.header.getElement());

        // Create weekday header
        const weekdayHeader = this.createWeekdayHeader();
        container.appendChild(weekdayHeader);

        // Create grid container
        this.gridContainer = document.createElement('div');
        this.gridContainer.className = 'mia-calendar-grid';
        this.gridContainer.setAttribute('role', 'grid');
        this.renderGrid();
        container.appendChild(this.gridContainer);

        // Create popup container
        this.popup = this.createPopup();
        container.appendChild(this.popup);

        // Add keyboard navigation
        this.setupKeyboardNavigation(container);

        return container;
    }

    private createWeekdayHeader(): HTMLElement {
        const header = document.createElement('div');
        header.className = 'mia-calendar-weekday-header';
        header.setAttribute('role', 'row');

        this.dayNames.forEach((day, index) => {
            const cell = document.createElement('div');
            cell.className = 'mia-calendar-weekday-cell';
            cell.textContent = day;
            cell.setAttribute('role', 'columnheader');
            cell.setAttribute('aria-label', this.dayNamesFull[index]);
            
            // Highlight weekend columns
            if (index >= 5) { // Saturday and Sunday
                cell.classList.add('mia-calendar-weekday-weekend');
            }
            
            header.appendChild(cell);
        });

        return header;
    }

    private renderGrid(): void {
        // Clear existing cells
        this.gridContainer.innerHTML = '';
        this.dayCells.clear();

        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();

        // Get first day of month and adjust for Monday start
        const firstDayOfMonth = new Date(year, month, 1);
        let startingDayOfWeek = firstDayOfMonth.getDay(); // 0 = Sunday
        
        // Adjust for Monday start (0 = Monday in our system)
        if (this.options.weekStartsOn === 1) {
            startingDayOfWeek = startingDayOfWeek === 0 ? 6 : startingDayOfWeek - 1;
        }

        // Get number of days in month
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        // Get days in previous month
        const daysInPrevMonth = new Date(year, month, 0).getDate();

        // Calculate total cells needed (6 rows × 7 columns = 42)
        const totalCells = 42;
        const cells: DayCell[] = [];

        // Previous month days
        for (let i = startingDayOfWeek - 1; i >= 0; i--) {
            const day = daysInPrevMonth - i;
            const date = new Date(year, month - 1, day);
            const cell = this.createDayCell(date, false);
            cells.push(cell);
        }

        // Current month days
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            const cell = this.createDayCell(date, true);
            cells.push(cell);
        }

        // Next month days
        const remainingCells = totalCells - cells.length;
        for (let day = 1; day <= remainingCells; day++) {
            const date = new Date(year, month + 1, day);
            const cell = this.createDayCell(date, false);
            cells.push(cell);
        }

        // Create rows (weeks)
        for (let i = 0; i < cells.length; i += 7) {
            const weekCells = cells.slice(i, i + 7);
            const row = DayCell.createWeekRow(weekCells);
            this.gridContainer.appendChild(row);
        }
    }

    private createDayCell(date: Date, isCurrentMonth: boolean): DayCell {
        const dateKey = this.formatDateKey(date);
        const isToday = this.isToday(date);
        const events = this.options.events?.get(dateKey) || [];

        const cell = new DayCell({
            date,
            isCurrentMonth,
            isToday,
            events,
            onClick: (clickedDate, clickedEvents) => {
                this.handleDateClick(clickedDate, clickedEvents);
            },
        });

        this.dayCells.set(dateKey, cell);
        return cell;
    }

    private navigateMonth(delta: number): void {
        if (this.isAnimating) return;
        this.isAnimating = true;

        // Add animation class
        const animationClass = delta > 0 ? 'mia-calendar-slide-left' : 'mia-calendar-slide-right';
        this.gridContainer.classList.add(animationClass);

        setTimeout(() => {
            // Update date
            this.currentDate.setMonth(this.currentDate.getMonth() + delta);
            
            // Update header
            this.header.setDate(this.currentDate);
            
            // Re-render grid
            this.renderGrid();

            // Remove animation class
            this.gridContainer.classList.remove(animationClass);
            this.gridContainer.classList.add('mia-calendar-slide-in');

            setTimeout(() => {
                this.gridContainer.classList.remove('mia-calendar-slide-in');
                this.isAnimating = false;
            }, 250);

            // Notify callback
            if (this.options.onMonthChange) {
                this.options.onMonthChange(new Date(this.currentDate));
            }
        }, 150);
    }

    private goToToday(): void {
        if (this.isAnimating) return;
        
        const today = new Date();
        const currentMonth = this.currentDate.getMonth();
        const currentYear = this.currentDate.getFullYear();
        
        if (today.getMonth() !== currentMonth || today.getFullYear() !== currentYear) {
            this.currentDate = new Date(today.getFullYear(), today.getMonth(), 1);
            this.header.setDate(this.currentDate);
            this.renderGrid();
        }

        // Highlight today cell
        const todayKey = this.formatDateKey(today);
        const todayCell = this.dayCells.get(todayKey);
        if (todayCell) {
            todayCell.focus();
            todayCell.pulse?.();
        }
    }

    private handleDateClick(date: Date, events: CalendarEvent[]): void {
        // Deselect all cells
        this.dayCells.forEach(cell => cell.setSelected(false));
        
        // Select clicked cell
        const dateKey = this.formatDateKey(date);
        const cell = this.dayCells.get(dateKey);
        if (cell) {
            cell.setSelected(true);
        }

        // Show popup if has events
        if (events.length > 0) {
            this.showDayPopup(date, events);
        }

        // Notify callback
        if (this.options.onDateSelect) {
            this.options.onDateSelect(date, events);
        }
    }

    private createPopup(): HTMLElement {
        const popup = document.createElement('div');
        popup.className = 'mia-calendar-popup';
        popup.setAttribute('role', 'dialog');
        popup.setAttribute('aria-modal', 'true');
        popup.style.display = 'none';

        const content = document.createElement('div');
        content.className = 'mia-calendar-popup-content';
        popup.appendChild(content);

        // Close button
        const closeBtn = document.createElement('button');
        closeBtn.className = 'mia-calendar-popup-close';
        closeBtn.innerHTML = '×';
        closeBtn.setAttribute('aria-label', 'Close popup');
        closeBtn.addEventListener('click', () => this.hidePopup());
        content.appendChild(closeBtn);

        // Title
        const title = document.createElement('div');
        title.className = 'mia-calendar-popup-title';
        content.appendChild(title);

        // Events list
        const list = document.createElement('div');
        list.className = 'mia-calendar-popup-events';
        content.appendChild(list);

        // Add event button
        const addBtn = document.createElement('button');
        addBtn.className = 'mia-calendar-popup-add';
        addBtn.innerHTML = '+ Add Event';
        content.appendChild(addBtn);

        // Close on outside click
        popup.addEventListener('click', (e) => {
            if (e.target === popup) {
                this.hidePopup();
            }
        });

        // Close on Escape
        popup.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hidePopup();
            }
        });

        return popup;
    }

    private showDayPopup(date: Date, events: CalendarEvent[]): void {
        if (!this.popup) return;

        const content = this.popup.querySelector('.mia-calendar-popup-content') as HTMLElement;
        const title = content.querySelector('.mia-calendar-popup-title') as HTMLElement;
        const list = content.querySelector('.mia-calendar-popup-events') as HTMLElement;

        // Update title
        title.textContent = date.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
        });

        // Update events list
        list.innerHTML = '';
        events.forEach(event => {
            const item = document.createElement('div');
            item.className = `mia-calendar-popup-event mia-calendar-popup-event--${event.type}`;
            
            const dot = document.createElement('span');
            dot.className = `mia-calendar-popup-event-dot mia-calendar-popup-event-dot--${event.type}`;
            item.appendChild(dot);

            const text = document.createElement('span');
            text.className = 'mia-calendar-popup-event-text';
            text.textContent = event.time ? `${event.time} ${event.title}` : event.title;
            if (event.completed) {
                text.classList.add('mia-calendar-popup-event-completed');
            }
            item.appendChild(text);

            item.addEventListener('click', () => {
                if (this.options.onEventClick) {
                    this.options.onEventClick(event);
                }
            });

            list.appendChild(item);
        });

        // Show popup
        this.popup.style.display = 'flex';
        
        // Focus trap
        const closeBtn = content.querySelector('.mia-calendar-popup-close') as HTMLElement;
        closeBtn?.focus();
    }

    private hidePopup(): void {
        if (this.popup) {
            this.popup.style.display = 'none';
        }
    }

    private setupKeyboardNavigation(container: HTMLElement): void {
        container.addEventListener('keydown', (e) => {
            const focused = document.activeElement as HTMLElement;
            if (!focused?.classList.contains('mia-day-cell')) return;

            const dateKey = focused.getAttribute('data-date');
            if (!dateKey) return;

            const currentCell = this.dayCells.get(dateKey);
            if (!currentCell) return;

            const currentDate = currentCell.getDate();
            let newDate: Date | null = null;

            switch (e.key) {
                case 'ArrowLeft':
                    newDate = new Date(currentDate);
                    newDate.setDate(newDate.getDate() - 1);
                    break;
                case 'ArrowRight':
                    newDate = new Date(currentDate);
                    newDate.setDate(newDate.getDate() + 1);
                    break;
                case 'ArrowUp':
                    newDate = new Date(currentDate);
                    newDate.setDate(newDate.getDate() - 7);
                    break;
                case 'ArrowDown':
                    newDate = new Date(currentDate);
                    newDate.setDate(newDate.getDate() + 7);
                    break;
            }

            if (newDate) {
                e.preventDefault();
                const newKey = this.formatDateKey(newDate);
                const newCell = this.dayCells.get(newKey);
                
                // If navigating to different month, switch months
                if (newDate.getMonth() !== this.currentDate.getMonth()) {
                    this.currentDate = new Date(newDate.getFullYear(), newDate.getMonth(), 1);
                    this.header.setDate(this.currentDate);
                    this.renderGrid();
                }
                
                newCell?.focus();
            }
        });
    }

    private isToday(date: Date): boolean {
        const today = new Date();
        return date.getDate() === today.getDate() &&
               date.getMonth() === today.getMonth() &&
               date.getFullYear() === today.getFullYear();
    }

    private formatDateKey(date: Date): string {
        return date.toISOString().split('T')[0];
    }

    // Public API
    public getElement(): HTMLElement {
        return this.element;
    }

    public setDate(date: Date): void {
        this.currentDate = new Date(date.getFullYear(), date.getMonth(), 1);
        this.header.setDate(this.currentDate);
        this.renderGrid();
    }

    public getCurrentDate(): Date {
        return new Date(this.currentDate);
    }

    public updateEvents(events: Map<string, CalendarEvent[]>): void {
        this.options.events = events;
        this.renderGrid();
    }

    public addEvent(date: Date, event: CalendarEvent): void {
        const dateKey = this.formatDateKey(date);
        const existingEvents = this.options.events?.get(dateKey) || [];
        const newEvents = new Map(this.options.events);
        newEvents.set(dateKey, [...existingEvents, event]);
        this.updateEvents(newEvents);
    }

    public removeEvent(date: Date, eventId: string): void {
        const dateKey = this.formatDateKey(date);
        const existingEvents = this.options.events?.get(dateKey) || [];
        const filtered = existingEvents.filter(e => e.id !== eventId);
        const newEvents = new Map(this.options.events);
        
        if (filtered.length > 0) {
            newEvents.set(dateKey, filtered);
        } else {
            newEvents.delete(dateKey);
        }
        
        this.updateEvents(newEvents);
    }

    public refresh(): void {
        this.renderGrid();
    }

    public destroy(): void {
        this.dayCells.forEach(cell => cell.destroy());
        this.dayCells.clear();
        this.header.destroy();
        this.element.remove();
    }

    // Static factory method for quick creation
    public static create(container: HTMLElement, options?: MonthViewOptions): MonthView {
        const view = new MonthView(options);
        container.appendChild(view.getElement());
        return view;
    }
}
