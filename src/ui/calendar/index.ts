/**
 * Calendar UI Components - Barrel Export
 * 
 * Import all calendar components from this single entry point:
 * 
 * ```typescript
 * import { MonthView, DayCell, CalendarHeader, EventDot, EventType } from './calendar';
 * // OR for optimized versions:
 * import { OptimizedMonthView } from './calendar';
 * ```
 */

// Main components (standard)
export { MonthView } from './MonthView';
export { DayCell } from './DayCell';
export { CalendarHeader } from './CalendarHeader';
export { EventDot } from './EventDot';

// Optimized components (recommended for large datasets)
export { OptimizedMonthView } from './OptimizedMonthView';
export type { OptimizedMonthViewOptions } from './OptimizedMonthView';

// Types and enums
export { EventType } from './EventDot';
export type { 
    EventDotOptions, 
    EventDotData,
    CalendarEvent,
    DayCellOptions,
    MonthViewOptions,
    DayPopupData,
} from './MonthView';

// Re-export from individual files for convenience
export type { CalendarEvent as DayCellCalendarEvent } from './DayCell';
export type { CalendarHeaderOptions } from './CalendarHeader';
