/**
 * TaskGroup.ts - Task Grouping Component
 * Groups tasks by due date with progress tracking
 */

import { Task, TaskItem, TaskItemOptions } from './TaskItem';

export type TaskGroupType = 'today' | 'tomorrow' | 'week' | 'later';

export interface TaskGroupConfig {
  type: TaskGroupType;
  title: string;
  icon: string;
  colorClass: string;
}

export interface TaskGroupOptions {
  type: TaskGroupType;
  tasks: Task[];
  onTaskToggle?: (id: string, completed: boolean) => void;
  onTaskDelete?: (id: string) => void;
  onTaskEdit?: (id: string, text: string) => void;
  onTaskMove?: (taskId: string, toGroup: TaskGroupType) => void;
  onDragStart?: (e: DragEvent, task: Task) => void;
  onDragEnd?: (e: DragEvent, task: Task) => void;
  onDrop?: (e: DragEvent, groupType: TaskGroupType) => void;
  collapsed?: boolean;
  onToggleCollapse?: (type: TaskGroupType, collapsed: boolean) => void;
}

export const GROUP_CONFIGS: Record<TaskGroupType, TaskGroupConfig> = {
  today: {
    type: 'today',
    title: 'Today',
    icon: `🌸`,
    colorClass: 'task-group--today'
  },
  tomorrow: {
    type: 'tomorrow', 
    title: 'Tomorrow',
    icon: `🌙`,
    colorClass: 'task-group--tomorrow'
  },
  week: {
    type: 'week',
    title: 'This Week',
    icon: `📅`,
    colorClass: 'task-group--week'
  },
  later: {
    type: 'later',
    title: 'Later',
    icon: `🔮`,
    colorClass: 'task-group--later'
  }
};

export class TaskGroup {
  private element: HTMLElement;
  private header: HTMLElement;
  private itemsContainer: HTMLElement;
  private progressBar: HTMLElement;
  private config: TaskGroupConfig;
  private options: TaskGroupOptions;
  private taskItems: Map<string, TaskItem> = new Map();
  private isCollapsed: boolean;
  private dragCounter = 0;

  constructor(options: TaskGroupOptions) {
    this.options = options;
    this.config = GROUP_CONFIGS[options.type];
    this.isCollapsed = options.collapsed ?? false;
    this.element = this.createElement();
    this.renderTasks();
    this.updateProgress();
    this.attachEventListeners();
  }

  private createElement(): HTMLElement {
    const group = document.createElement('div');
    group.className = `task-group ${this.config.colorClass}`;
    if (this.isCollapsed) {
      group.classList.add('collapsed');
    }
    group.setAttribute('data-group-type', this.options.type);
    group.setAttribute('role', 'region');
    group.setAttribute('aria-label', `${this.config.title} tasks`);

    // Header with progress
    this.header = document.createElement('div');
    this.header.className = 'task-group-header';
    this.header.setAttribute('tabindex', '0');
    this.header.setAttribute('role', 'button');
    this.header.setAttribute('aria-expanded', (!this.isCollapsed).toString());

    const titleSection = document.createElement('div');
    titleSection.className = 'task-group-title';
    
    const icon = document.createElement('span');
    icon.className = 'task-group-icon';
    icon.textContent = this.config.icon;
    icon.style.fontSize = '18px';
    
    const title = document.createElement('span');
    title.textContent = this.config.title;
    
    const count = document.createElement('span');
    count.className = 'task-group-count';
    count.textContent = `${this.options.tasks.length}`;
    count.setAttribute('data-count', this.options.tasks.length.toString());
    
    titleSection.appendChild(icon);
    titleSection.appendChild(title);
    titleSection.appendChild(count);

    // Progress section
    const progressSection = document.createElement('div');
    progressSection.style.cssText = 'flex: 1; margin: 0 16px; max-width: 150px;';
    
    const progressWrapper = document.createElement('div');
    progressWrapper.className = 'task-group-progress';
    
    this.progressBar = document.createElement('div');
    this.progressBar.className = 'task-group-progress-bar';
    this.progressBar.style.width = '0%';
    this.progressBar.setAttribute('role', 'progressbar');
    this.progressBar.setAttribute('aria-valuemin', '0');
    this.progressBar.setAttribute('aria-valuemax', '100');
    this.progressBar.setAttribute('aria-valuenow', '0');
    this.progressBar.setAttribute('aria-label', `${this.config.title} completion`);
    
    progressWrapper.appendChild(this.progressBar);
    progressSection.appendChild(progressWrapper);

    this.header.appendChild(titleSection);
    this.header.appendChild(progressSection);
    group.appendChild(this.header);

    // Items container with drop zone
    this.itemsContainer = document.createElement('div');
    this.itemsContainer.className = 'task-group-items';
    this.itemsContainer.setAttribute('role', 'list');
    group.appendChild(this.itemsContainer);

    return group;
  }

  private renderTasks(): void {
    // Clear existing
    this.itemsContainer.innerHTML = '';
    this.taskItems.clear();

    if (this.options.tasks.length === 0) {
      this.renderEmptyState();
      return;
    }

    // Sort tasks: incomplete first, then by priority
    const sortedTasks = [...this.options.tasks].sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    sortedTasks.forEach(task => {
      const taskItem = new TaskItem({
        task,
        isDraggable: true,
        onToggle: this.options.onTaskToggle,
        onDelete: this.options.onTaskDelete,
        onEdit: this.options.onTaskEdit,
        onDragStart: this.options.onDragStart,
        onDragEnd: this.options.onDragEnd
      });

      this.taskItems.set(task.id, taskItem);
      this.itemsContainer.appendChild(taskItem.getElement());
    });
  }

  private renderEmptyState(): void {
    const emptyState = document.createElement('div');
    emptyState.className = 'task-group-empty';
    
    const illustrations: Record<TaskGroupType, string> = {
      today: '🍃',
      tomorrow: '🌙',
      week: '🌤',
      later: '✨'
    };
    
    const messages: Record<TaskGroupType, string> = {
      today: 'No tasks for today!',
      tomorrow: 'Nothing planned for tomorrow',
      week: 'Your week is clear',
      later: 'Future looks bright'
    };

    emptyState.innerHTML = `
      <div class="task-group-empty-illustration">${illustrations[this.options.type]}</div>
      <div>${messages[this.options.type]}</div>
    `;
    
    this.itemsContainer.appendChild(emptyState);
  }

  private updateProgress(): void {
    const total = this.options.tasks.length;
    const completed = this.options.tasks.filter(t => t.completed).length;
    const percentage = total > 0 ? (completed / total) * 100 : 0;

    this.progressBar.style.width = `${percentage}%`;
    this.progressBar.setAttribute('aria-valuenow', Math.round(percentage).toString());

    // Update color based on progress
    if (percentage === 100) {
      this.progressBar.style.background = 'linear-gradient(90deg, #06d6a0 0%, #04b889 100%)';
    } else if (percentage >= 50) {
      this.progressBar.style.background = 'linear-gradient(90deg, #ffd166 0%, #e5b93d 100%)';
    } else {
      this.progressBar.style.background = '';
    }
  }

  private attachEventListeners(): void {
    // Collapse/expand toggle
    this.header.addEventListener('click', () => {
      this.toggleCollapse();
    });

    this.header.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.toggleCollapse();
      }
    });

    // Drag and drop events for the container
    this.itemsContainer.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer!.dropEffect = 'move';
      
      // Visual feedback for drop target
      this.itemsContainer.classList.add('is-drag-over');
      
      // Auto-expand if collapsed
      if (this.isCollapsed) {
        this.expand();
      }
    });

    this.itemsContainer.addEventListener('dragleave', (e) => {
      // Only remove if leaving the container (not entering a child)
      if (!this.itemsContainer.contains(e.relatedTarget as Node)) {
        this.itemsContainer.classList.remove('is-drag-over');
      }
    });

    this.itemsContainer.addEventListener('drop', (e) => {
      e.preventDefault();
      this.itemsContainer.classList.remove('is-drag-over');
      this.options.onDrop?.(e, this.options.type);
    });

    // Track drag enter/leave for visual feedback
    this.itemsContainer.addEventListener('dragenter', () => {
      this.dragCounter++;
      this.itemsContainer.classList.add('is-drag-over');
    });

    this.itemsContainer.addEventListener('dragleave', (e) => {
      this.dragCounter--;
      if (this.dragCounter === 0) {
        this.itemsContainer.classList.remove('is-drag-over');
      }
    });
  }

  private toggleCollapse(): void {
    this.isCollapsed = !this.isCollapsed;
    this.element.classList.toggle('collapsed', this.isCollapsed);
    this.header.setAttribute('aria-expanded', (!this.isCollapsed).toString());
    this.options.onToggleCollapse?.(this.options.type, this.isCollapsed);
  }

  private expand(): void {
    if (this.isCollapsed) {
      this.isCollapsed = false;
      this.element.classList.remove('collapsed');
      this.header.setAttribute('aria-expanded', 'true');
    }
  }

  // Public API
  public getElement(): HTMLElement {
    return this.element;
  }

  public getType(): TaskGroupType {
    return this.options.type;
  }

  public addTask(task: Task): void {
    this.options.tasks.push(task);
    this.refresh();
  }

  public removeTask(taskId: string): Task | null {
    const index = this.options.tasks.findIndex(t => t.id === taskId);
    if (index > -1) {
      const removed = this.options.tasks.splice(index, 1)[0];
      this.taskItems.get(taskId)?.destroy();
      this.taskItems.delete(taskId);
      this.refresh();
      return removed;
    }
    return null;
  }

  public updateTask(taskId: string, updates: Partial<Task>): void {
    const task = this.options.tasks.find(t => t.id === taskId);
    if (task) {
      Object.assign(task, updates);
      this.taskItems.get(taskId)?.updateTask(updates);
      this.updateProgress();
    }
  }

  public getTasks(): Task[] {
    return [...this.options.tasks];
  }

  public refresh(): void {
    this.renderTasks();
    this.updateProgress();
    
    // Update count
    const countEl = this.header.querySelector('.task-group-count');
    if (countEl) {
      countEl.textContent = `${this.options.tasks.length}`;
      countEl.setAttribute('data-count', this.options.tasks.length.toString());
    }
  }

  public setCollapsed(collapsed: boolean): void {
    this.isCollapsed = collapsed;
    this.element.classList.toggle('collapsed', collapsed);
    this.header.setAttribute('aria-expanded', (!collapsed).toString());
  }

  public highlight(): void {
    this.element.style.animation = 'groupSlideIn 0.5s ease';
    setTimeout(() => {
      this.element.style.animation = '';
    }, 500);
  }

  public destroy(): void {
    this.taskItems.forEach(item => item.destroy());
    this.taskItems.clear();
    this.element.remove();
  }

  public getTaskItem(taskId: string): TaskItem | undefined {
    return this.taskItems.get(taskId);
  }

  public insertTaskAt(task: Task, index: number): void {
    this.options.tasks.splice(index, 0, task);
    this.refresh();
  }

  public getTaskIndex(taskId: string): number {
    return this.options.tasks.findIndex(t => t.id === taskId);
  }

  public moveTask(taskId: string, newIndex: number): void {
    const currentIndex = this.getTaskIndex(taskId);
    if (currentIndex > -1) {
      const [task] = this.options.tasks.splice(currentIndex, 1);
      this.options.tasks.splice(newIndex, 0, task);
      this.refresh();
    }
  }
}

/**
 * Helper function to determine which group a task belongs to
 */
export function getTaskGroupType(dueDate: Date): TaskGroupType {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);
  
  const due = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
  
  if (due.getTime() === today.getTime()) {
    return 'today';
  } else if (due.getTime() === tomorrow.getTime()) {
    return 'tomorrow';
  } else if (due < nextWeek) {
    return 'week';
  } else {
    return 'later';
  }
}

/**
 * Group tasks by their due date
 */
export function groupTasksByDate(tasks: Task[]): Record<TaskGroupType, Task[]> {
  const groups: Record<TaskGroupType, Task[]> = {
    today: [],
    tomorrow: [],
    week: [],
    later: []
  };

  tasks.forEach(task => {
    const groupType = getTaskGroupType(task.dueDate);
    groups[groupType].push(task);
  });

  return groups;
}

export default TaskGroup;