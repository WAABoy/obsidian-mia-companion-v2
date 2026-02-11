/**
 * Task List Panel - Main Export
 * Innovative task management with Sakura theme
 */

// Standard components
export { TaskListView, TaskListViewOptions } from './TaskListView';
export { TaskItem, Task, TaskItemOptions } from './TaskItem';
export { 
  TaskGroup, 
  TaskGroupOptions, 
  TaskGroupType, 
  TaskGroupConfig,
  GROUP_CONFIGS,
  groupTasksByDate,
  getTaskGroupType 
} from './TaskGroup';

// Optimized components (recommended for large task lists)
export { OptimizedTaskListView } from './OptimizedTaskListView';
export type { OptimizedTaskListViewOptions } from './OptimizedTaskListView';

// Version
export const TASK_PANEL_VERSION = '2.0.0';
