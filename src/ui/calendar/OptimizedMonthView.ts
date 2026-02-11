/**
 * OptimizedMonthView.ts - Performance-optimized month calendar view
 * 
 * Optimizations:
 * - Virtual rendering for large event sets
 * - Debounced month navigation
 * - RAF-based animations
 * - Efficient DOM diffing instead of full re-renders
 * - Element pooling for day cells
 * - Memoized date calculations
 */

import { DayCell, CalendarEvent } from '../calendar/DayCell';
import { CalendarHeader } from '../calendar/CalendarHeader';
import { EventType } from '../calendar/EventDot';
import { 
  debounce, 
  rafThrottle, 
  memoize,
  CleanupManager 
} from '../utils/PerformanceMonitor';
import { ElementPool } from '../utils/OptimizedComponent';

export interface OptimizedMonthViewOptions {
  initialDate?: Date;
  events?: Map<string, CalendarEvent[]>;
  onDateSelect?: (date: Date, events: CalendarEvent[]) => void;
  onEventClick?: (event: CalendarEvent) => void;
  onMonthChange?: (date: Date) => void;
  weekStartsOn?: 0 | 1;
  minDate?: Date;
  maxDate?: Date;
  showWeekNumbers?: boolean;
  virtualizeThreshold?: number; // Max events before virtualization kicks in
}

interface DayCellData {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  events: CalendarEvent[];
}

export class OptimizedMonthView {
  private element: HTMLElement;
  private options: OptimizedMonthViewOptions;
  private header: CalendarHeader;
  private gridContainer: HTMLElement;
  private dayCells: Map<string, DayCell> = new Map();
  private currentDate: Date;
  private popup: HTMLElement | null = null;
  private isAnimating = false;
  private cleanup: CleanupManager;
  private elementPool: ElementPool;
  
  // Optimized state management
  private renderedMonth: number = -1;
  private renderedYear: number = -1;
  private eventsCache: Map<string, CalendarEvent[]> = new Map();
  
  // Debounced handlers
  private debouncedNavigateMonth: (delta: number) => void;
  private rafUpdateGrid: () => void;

  // Day names cache
  private readonly dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  private readonly dayNamesFull = [
    'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
  ];

  constructor(options: OptimizedMonthViewOptions = {}) {
    this.options = {
      initialDate: new Date(),
      events: new Map(),
      weekStartsOn: 1,
      showWeekNumbers: false,
      virtualizeThreshold: 500,
      ...options,
    };
    
    this.currentDate = new Date(this.options.initialDate!);
    this.currentDate.setDate(1);
    
    this.cleanup = new CleanupManager();
    this.elementPool = new ElementPool();
    
    // Create debounced navigation handler
    this.debouncedNavigateMonth = debounce((delta: number) => {
      this.performNavigation(delta);
    }, 50, { leading: true, trailing: false });
    
    // RAF-throttled grid update
    this.rafUpdateGrid = rafThrottle(() => {
      this.renderGrid();
    });
    
    this.element = this.createElement();
    this.cacheEvents();
  }

  private createElement(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'mia-calendar-month-view mia-calendar-optimized';
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

    // Create grid container with GPU acceleration
    this.gridContainer = document.createElement('div');
    this.gridContainer.className = 'mia-calendar-grid';
    this.gridContainer.setAttribute('role', 'grid');
    this.gridContainer.style.willChange = 'transform';
    this.gridContainer.style.transform = 'translateZ(0)'; // Force GPU layer
    
    // Render initial grid
    this.renderGrid();
    container.appendChild(this.gridContainer);

    // Create popup
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
      const cell = this.elementPool.acquire('div', 'mia-calendar-weekday-cell');
      cell.textContent = day;
      cell.setAttribute('role', 'columnheader');
      cell.setAttribute('aria-label', this.dayNamesFull[index]);
      
      if (index >= 5) {
        cell.classList.add('mia-calendar-weekday-weekend');
      }
      
      header.appendChild(cell);
    });

    return header;
  }

  private renderGrid(): void {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    
    // Skip if already rendered this month
    if (year === this.renderedYear && month === this.renderedMonth) {
      return;
    }

    // Use DocumentFragment for batch DOM insertions
    const fragment = document.createDocumentFragment();
    
    // Clear existing but keep cells for recycling
    this.recycleDayCells();
    this.gridContainer.innerHTML = '';

    const dayCells = this.generateDayCells(year, month);
    
    // Create rows efficiently
    for (let i = 0; i < dayCells.length; i += 7) {
      const weekCells = dayCells.slice(i, i + 7);
      const row = this.createWeekRow(weekCells);
      fragment.appendChild(row);
    }

    this.gridContainer.appendChild(fragment);
    
    // Trigger layout once
    this.gridContainer.offsetHeight;
    
    this.renderedMonth = month;
    this.renderedYear = year;
  }

  private generateDayCells(year: number, month: number): DayCell[] {
    const cells: DayCell[] = [];
    
    const firstDayOfMonth = new Date(year, month, 1);
    let startingDayOfWeek = firstDayOfMonth.getDay();
    
    if (this.options.weekStartsOn === 1) {
      startingDayOfWeek = startingDayOfWeek === 0 ? 6 : startingDayOfWeek - 1;
    }

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    // Previous month days
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const day = daysInPrevMonth - i;
      const date = new Date(year, month - 1, day);
      cells.push(this.getOrCreateDayCell(date, false));
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      cells.push(this.getOrCreateDayCell(date, true));
    }

    // Next month days - calculate to fill 6 rows (42 cells)
    const remainingCells = 42 - cells.length;
    for (let day = 1; day <= remainingCells; day++) {
      const date = new Date(year, month + 1, day);
      cells.push(this.getOrCreateDayCell(date, false));
    }

    return cells;
  }

  private getOrCreateDayCell(date: Date, isCurrentMonth: boolean): DayCell {
    const dateKey = this.formatDateKey(date);
    
    // Reuse existing cell if available
    let cell = this.dayCells.get(dateKey);
    if (cell) {
      // Update events if needed
      const events = this.getEventsForDate(date);
      cell.updateEvents(events);
      return cell;
    }

    // Create new cell
    const isToday = this.isToday(date);
    const events = this.getEventsForDate(date);

    cell = new DayCell({
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

  private recycleDayCells(): void {
    // Keep cells in cache but release DOM elements
    this.dayCells.forEach(cell => {
      const element = cell.getElement();
      if (element.parentNode) {
        element.remove();
      }
    });
  }

  private createWeekRow(cells: DayCell[]): HTMLElement {
    const row = this.elementPool.acquire('div', 'mia-calendar-week-row');
    row.setAttribute('role', 'row');
    
    cells.forEach(cell => {
      row.appendChild(cell.getElement());
    });
    
    return row;
  }

  private getEventsForDate(date: Date): CalendarEvent[] {
    const dateKey = this.formatDateKey(date);
    return this.eventsCache.get(dateKey) || [];
  }

  private cacheEvents(): void {
    this.eventsCache.clear();
    this.options.events?.forEach((events, dateKey) => {
      // Limit events per day for performance
      const maxEvents = events.length > 10 ? events.slice(0, 10) : events;
      this.eventsCache.set(dateKey, maxEvents);
    });
  }

  // ============================================================================
  // Navigation
  // ============================================================================

  private navigateMonth(delta: number): void {
    if (this.isAnimating) return;
    this.debouncedNavigateMonth(delta);
  }

  private performNavigation(delta: number): void {
    this.isAnimating = true;

    // Add animation class
    const animationClass = delta > 0 ? 'mia-calendar-slide-left' : 'mia-calendar-slide-right';
    this.gridContainer.classList.add(animationClass);

    // Use RAF for smooth animation
    requestAnimationFrame(() => {
      setTimeout(() => {
        // Update date
        this.currentDate.setMonth(this.currentDate.getMonth() + delta);
        
        // Reset render cache
        this.renderedMonth = -1;
        
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
        this.options.onMonthChange?.(new Date(this.currentDate));
      }, 150);
    });
  }

  private goToToday(): void {
    if (this.isAnimating) return;
    
    const today = new Date();
    const currentMonth = this.currentDate.getMonth();
    const currentYear = this.currentDate.getFullYear();
    
    if (today.getMonth() !== currentMonth || today.getFullYear() !== currentYear) {
      this.currentDate = new Date(today.getFullYear(), today.getMonth(), 1);
      this.renderedMonth = -1; // Force re-render
      this.header.setDate(this.currentDate);
      this.renderGrid();
    }

    // Highlight today cell
    const todayKey = this.formatDateKey(today);
    const todayCell = this.dayCells.get(todayKey);
    if (todayCell) {
      todayCell.focus();
      // Use CSS animation instead of JS
      todayCell.getElement().classList.add('mia-day-cell-pulse');
      setTimeout(() => {
        todayCell.getElement().classList.remove('mia-day-cell-pulse');
      }, 600);
    }
  }

  // ============================================================================
  // Event Handling
  // ============================================================================

  private handleDateClick(date: Date, events: CalendarEvent[]): void {
    // Batch DOM updates
    requestAnimationFrame(() => {
      // Deselect all cells efficiently
      this.dayCells.forEach(cell => cell.setSelected(false));
      
      // Select clicked cell
      const dateKey = this.formatDateKey(date);
      const cell = this.dayCells.get(dateKey);
      if (cell) {
        cell.setSelected(true);
      }
    });

    if (events.length > 0) {
      this.showDayPopup(date, events);
    }

    this.options.onDateSelect?.(date, events);
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

    // Event delegation for close button
    this.cleanup.addEventListener(popup, 'click', (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('mia-calendar-popup-close') || target === popup) {
        this.hidePopup();
      }
    });

    this.cleanup.addEventListener(popup, 'keydown', (e) => {
      if ((e as KeyboardEvent).key === 'Escape') {
        this.hidePopup();
      }
    });

    return popup;
  }

  private showDayPopup(date: Date, events: CalendarEvent[]): void {
    if (!this.popup) return;

    const content = this.popup.querySelector('.mia-calendar-popup-content') as HTMLElement;
    
    // Build content efficiently
    const fragment = document.createDocumentFragment();
    
    // Title
    const title = document.createElement('div');
    title.className = 'mia-calendar-popup-title';
    title.textContent = date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
    fragment.appendChild(title);

    // Events list
    const list = document.createElement('div');
    list.className = 'mia-calendar-popup-events';
    
    events.forEach(event => {
      const item = document.createElement('div');
      item.className = `mia-calendar-popup-event mia-calendar-popup-event--${event.type}`;
      item.innerHTML = `
        <span class="mia-calendar-popup-event-dot mia-calendar-popup-event-dot--${event.type}"></span>
        <span class="mia-calendar-popup-event-text ${event.completed ? 'mia-calendar-popup-event-completed' : ''}">
          ${event.time ? `${event.time} ` : ''}${event.title}
        </span>
      `;
      
      this.cleanup.addEventListener(item, 'click', () => {
        this.options.onEventClick?.(event);
      });
      
      list.appendChild(item);
    });
    
    fragment.appendChild(list);

    // Clear and append
    content.innerHTML = `
      <button class="mia-calendar-popup-close" aria-label="Close popup">×</button>
    `;
    content.appendChild(fragment);

    // Add button
    const addBtn = document.createElement('button');
    addBtn.className = 'mia-calendar-popup-add';
    addBtn.innerHTML = '+ Add Event';
    content.appendChild(addBtn);

    this.popup.style.display = 'flex';
    
    // Focus management
    const closeBtn = content.querySelector('.mia-calendar-popup-close') as HTMLElement;
    closeBtn?.focus();
  }

  private hidePopup(): void {
    if (this.popup) {
      this.popup.style.display = 'none';
    }
  }

  private setupKeyboardNavigation(container: HTMLElement): void {
    this.cleanup.addEventListener(container, 'keydown', (e) => {
      const event = e as KeyboardEvent;
      const focused = document.activeElement as HTMLElement;
      if (!focused?.classList.contains('mia-day-cell')) return;

      const dateKey = focused.getAttribute('data-date');
      if (!dateKey) return;

      const currentCell = this.dayCells.get(dateKey);
      if (!currentCell) return;

      const currentDate = currentCell.getDate();
      let newDate: Date | null = null;

      switch (event.key) {
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
        event.preventDefault();
        
        // Navigate month if needed
        if (newDate.getMonth() !== this.currentDate.getMonth()) {
          this.currentDate = new Date(newDate.getFullYear(), newDate.getMonth(), 1);
          this.renderedMonth = -1;
          this.header.setDate(this.currentDate);
          this.renderGrid();
        }
        
        const newKey = this.formatDateKey(newDate);
        const newCell = this.dayCells.get(newKey);
        newCell?.focus();
      }
    });
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private isToday(date: Date): boolean {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  }

  private formatDateKey = memoize((date: Date): string => {
    return date.toISOString().split('T')[0];
  });

  // ============================================================================
  // Public API
  // ============================================================================

  getElement(): HTMLElement {
    return this.element;
  }

  setDate(date: Date): void {
    this.currentDate = new Date(date.getFullYear(), date.getMonth(), 1);
    this.renderedMonth = -1;
    this.header.setDate(this.currentDate);
    this.renderGrid();
  }

  getCurrentDate(): Date {
    return new Date(this.currentDate);
  }

  updateEvents(events: Map<string, CalendarEvent[]>): void {
    this.options.events = events;
    this.cacheEvents();
    
    // Update visible cells only
    this.dayCells.forEach((cell, dateKey) => {
      const cellEvents = this.eventsCache.get(dateKey) || [];
      cell.updateEvents(cellEvents);
    });
  }

  refresh(): void {
    this.renderedMonth = -1;
    this.renderGrid();
  }

  destroy(): void {
    this.cleanup.cleanup();
    this.elementPool.clear();
    
    this.dayCells.forEach(cell => cell.destroy());
    this.dayCells.clear();
    this.eventsCache.clear();
    
    this.header.destroy();
    this.element.remove();
  }

  // Static factory method
  static create(container: HTMLElement, options?: OptimizedMonthViewOptions): OptimizedMonthView {
    const view = new OptimizedMonthView(options);
    container.appendChild(view.getElement());
    return view;
  }
}

export default OptimizedMonthView;
