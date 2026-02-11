/**
 * API Module - Google API integrations
 */

// Google Calendar API
export {
  GoogleCalendarService,
  createGoogleCalendarService,
} from './google-calendar';

export type {
  GoogleCalendarConfig,
  TaskEvent,
  TaskCompletionEvent,
  WordGoalEvent,
  EventResult,
  EventFilterOptions,
} from './google-calendar';

// Optimized Google Calendar API
export {
  OptimizedGoogleCalendarService,
  createOptimizedGoogleCalendarService,
} from './OptimizedGoogleCalendar';

// Google Tasks API
export {
  GoogleTasksClient,
  initializeGoogleTasks,
  getGoogleTasksClient,
  GoogleServiceAccount,
  GoogleTask,
  GoogleTaskList,
  TaskListResponse,
  TasksResponse,
  SyncResult,
  ObsidianTask,
} from './google-tasks';

// Default exports
export { GoogleCalendarService as default } from './google-calendar';
