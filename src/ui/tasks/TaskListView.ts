/**
 * TaskListView.ts - Main Task List Component
 * Orchestrates task groups, drag & drop, and quick add
 */

import { Task, TaskItem } from './TaskItem';
import { TaskGroup, TaskGroupType, groupTasksByDate, getTaskGroupType, GROUP_CONFIGS } from './TaskGroup';

export interface TaskListViewOptions {
  tasks?: Task[];
  onTaskAdd?: (task: Omit<Task, 'id' | 'createdAt'>) => void;
  onTaskToggle?: (id: string, completed: boolean) => void;
  onTaskDelete?: (id: string) => void;
  onTaskEdit?: (id: string, text: string) => void;
  onTaskMove?: (taskId: string, fromGroup: TaskGroupType, toGroup: TaskGroupType, newIndex?: number) => void;
  onTaskReorder?: (taskId: string, groupType: TaskGroupType, newIndex: number) => void;
  onGroupToggle?: (type: TaskGroupType, collapsed: boolean) => void;
  placeholderText?: string;
}

export class TaskListView {
  private element: HTMLElement;
  private quickAddInput: HTMLInputElement;
  private quickAddWrapper: HTMLElement;
  private groupsContainer: HTMLElement;
  private groups: Map<TaskGroupType, TaskGroup> = new Map();
  private options: TaskListViewOptions;
  private draggedTask: Task | null = null;
  private draggedFromGroup: TaskGroupType | null = null;
  private keyboardFocusedTaskId: string | null = null;
  private allTasks: Map<string, Task> = new Map();

  constructor(container: HTMLElement, options: TaskListViewOptions = {}) {
    this.options = options;
    this.element = this.createElement();
    this.initializeGroups(options.tasks || []);
    this.attachEventListeners();
    
    container.appendChild(this.element);
    this.setupKeyboardNavigation();
  }

  private createElement(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'task-panel task-list-container';
    container.setAttribute('role', 'application');
    container.setAttribute('aria-label', 'Task list');

    // Quick add section
    const quickAdd = document.createElement('div');
    quickAdd.className = 'task-quick-add';
    
    this.quickAddWrapper = document.createElement('div');
    this.quickAddWrapper.className = 'task-quick-add-wrapper';
    
    // Search/plus icon
    const icon = document.createElement('div');
    icon.className = 'task-quick-add-icon';
    icon.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M10 4v12M4 10h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
    `;
    
    // Input
    this.quickAddInput = document.createElement('input');
    this.quickAddInput.type = 'text';
    this.quickAddInput.className = 'task-quick-add-input';
    this.quickAddInput.placeholder = this.options.placeholderText || 'Add a new task...';
    this.quickAddInput.setAttribute('aria-label', 'Add new task');
    
    // Action buttons (visible when typing)
    const actions = document.createElement('div');
    actions.className = 'task-quick-add-actions';
    
    const priorityBtn = document.createElement('button');
    priorityBtn.className = 'task-quick-add-btn';
    priorityBtn.innerHTML = '🔴';
    priorityBtn.title = 'Set priority (Cmd/Ctrl + 1/2/3)';
    priorityBtn.setAttribute('aria-label', 'Set priority');
    
    const dueBtn = document.createElement('button');
    dueBtn.className = 'task-quick-add-btn';
    dueBtn.innerHTML = '📅';
    dueBtn.title = 'Set due date (Tab for suggestions)';
    dueBtn.setAttribute('aria-label', 'Set due date');
    
    const submitBtn = document.createElement('button');
    submitBtn.className = 'task-quick-add-btn task-quick-add-submit';
    submitBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M3 8l3 3 7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
    submitBtn.title = 'Add task (Enter)';
    submitBtn.setAttribute('aria-label', 'Add task');
    
    actions.appendChild(priorityBtn);
    actions.appendChild(dueBtn);
    actions.appendChild(submitBtn);
    
    this.quickAddWrapper.appendChild(icon);
    this.quickAddWrapper.appendChild(this.quickAddInput);
    this.quickAddWrapper.appendChild(actions);
    quickAdd.appendChild(this.quickAddWrapper);
    container.appendChild(quickAdd);

    // Groups container
    this.groupsContainer = document.createElement('div');
    this.groupsContainer.className = 'task-groups';
    container.appendChild(this.groupsContainer);

    return container;
  }

  private initializeGroups(tasks: Task[]): void {
    // Store all tasks
    tasks.forEach(task => this.allTasks.set(task.id, task));
    
    // Group by date
    const grouped = groupTasksByDate(tasks);
    
    // Create group in order
    const groupOrder: TaskGroupType[] = ['today', 'tomorrow', 'week', 'later'];
    
    groupOrder.forEach(type => {
      const group = new TaskGroup({
        type,
        tasks: grouped[type],
        onTaskToggle: this.handleTaskToggle.bind(this),
        onTaskDelete: this.handleTaskDelete.bind(this),
        onTaskEdit: this.handleTaskEdit.bind(this),
        onDragStart: this.handleDragStart.bind(this),
        onDragEnd: this.handleDragEnd.bind(this),
        onDrop: this.handleDrop.bind(this),
        onToggleCollapse: this.options.onGroupToggle
      });
      
      this.groups.set(type, group);
      this.groupsContainer.appendChild(group.getElement());
    });
  }

  private attachEventListeners(): void {
    // Quick add input
    this.quickAddInput.addEventListener('input', () => {
      const hasText = this.quickAddInput.value.trim().length > 0;
      this.quickAddWrapper.classList.toggle('has-text', hasText);
    });

    this.quickAddInput.addEventListener('keydown', (e) => {
      // Priority shortcuts
      if ((e.metaKey || e.ctrlKey) && e.key >= '1' && e.key <= '3') {
        e.preventDefault();
        const priorities: ('high' | 'medium' | 'low')[] = ['high', 'medium', 'low'];
        this.setQuickAddPriority(priorities[parseInt(e.key) - 1]);
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        this.addTaskFromQuickAdd();
      } else if (e.key === 'Escape') {
        this.quickAddInput.blur();
        this.quickAddInput.value = '';
        this.quickAddWrapper.classList.remove('has-text');
      } else if (e.key === 'Tab' && this.quickAddInput.value.length > 0) {
        // Show date suggestions
        this.showDateSuggestions();
      }
    });

    this.quickAddInput.addEventListener('focus', () => {
      this.keyboardFocusedTaskId = null;
    });

    // Global drag end cleanup
    document.addEventListener('dragend', () => {
      this.cleanupDragState();
    });
  }

  private setQuickAddPriority(priority: 'high' | 'medium' | 'low'): void {
    const icons: Record<string, string> = { high: '🔴', medium: '🟡', low: '🟢' };
    const priorityBtn = this.quickAddWrapper.querySelector('.task-quick-add-btn') as HTMLButtonElement;
    if (priorityBtn) {
      priorityBtn.innerHTML = icons[priority];
      priorityBtn.setAttribute('data-priority', priority);
    }
  }

  private showDateSuggestions(): void {
    // Could show a date picker popup here
    // For now, parse natural language in input
    const value = this.quickAddInput.value.toLowerCase();
    
    if (value.includes('today')) {
      this.quickAddWrapper.setAttribute('data-due', 'today');
    } else if (value.includes('tomorrow')) {
      this.quickAddWrapper.setAttribute('data-due', 'tomorrow');
    } else if (value.includes('next week')) {
      this.quickAddWrapper.setAttribute('data-due', 'next-week');
    }
  }

  private addTaskFromQuickAdd(): void {
    const text = this.quickAddInput.value.trim();
    if (!text) return;

    // Parse text for tags, priority, due date
    const parsed = this.parseTaskInput(text);
    
    const newTask: Omit<Task, 'id' | 'createdAt'> = {
      text: parsed.text,
      completed: false,
      priority: parsed.priority,
      dueDate: parsed.dueDate,
      tags: parsed.tags
    };

    this.options.onTaskAdd?.(newTask);
    
    // Clear input
    this.quickAddInput.value = '';
    this.quickAddWrapper.classList.remove('has-text');
    this.quickAddWrapper.removeAttribute('data-priority');
    this.quickAddWrapper.removeAttribute('data-due');
    
    // Reset priority button
    const priorityBtn = this.quickAddWrapper.querySelector('.task-quick-add-btn') as HTMLButtonElement;
    if (priorityBtn) {
      priorityBtn.innerHTML = '🔴';
    }
  }

  private parseTaskInput(input: string): {
    text: string;
    priority: 'high' | 'medium' | 'low';
    dueDate: Date;
    tags: string[];
  } {
    let text = input;
    let priority: 'high' | 'medium' | 'low' = 'medium';
    const tags: string[] = [];
    let dueDate = new Date();

    // Extract tags (#tag)
    const tagMatches = input.match(/#(\w+)/g);
    if (tagMatches) {
      tagMatches.forEach(match => {
        tags.push(match.substring(1));
        text = text.replace(match, '');
      });
    }

    // Extract priority from quick add button state
    const priorityBtn = this.quickAddWrapper.querySelector('[data-priority]');
    if (priorityBtn) {
      priority = priorityBtn.getAttribute('data-priority') as typeof priority;
    }

    // Parse due date from text
    const lowerText = text.toLowerCase();
    if (lowerText.includes('tomorrow')) {
      dueDate.setDate(dueDate.getDate() + 1);
      text = text.replace(/tomorrow/gi, '');
    } else if (lowerText.includes('next week')) {
      dueDate.setDate(dueDate.getDate() + 7);
      text = text.replace(/next week/gi, '');
    } else if (lowerText.includes('today')) {
      text = text.replace(/today/gi, '');
    } else if (lowerText.includes('later')) {
      dueDate.setDate(dueDate.getDate() + 14);
      text = text.replace(/later/gi, '');
    }

    return {
      text: text.trim(),
      priority,
      dueDate,
      tags
    };
  }

  private handleTaskToggle(id: string, completed: boolean): void {
    const task = this.allTasks.get(id);
    if (task) {
      task.completed = completed;
    }
    this.options.onTaskToggle?.(id, completed);
    
    // Update progress in the group
    const groupType = this.findTaskGroup(id);
    if (groupType) {
      this.groups.get(groupType)?.updateTask(id, { completed });
    }
  }

  private handleTaskDelete(id: string): void {
    const groupType = this.findTaskGroup(id);
    if (groupType) {
      const group = this.groups.get(groupType);
      group?.removeTask(id);
    }
    this.allTasks.delete(id);
    this.options.onTaskDelete?.(id);
  }

  private handleTaskEdit(id: string, text: string): void {
    const task = this.allTasks.get(id);
    if (task) {
      task.text = text;
    }
    this.options.onTaskEdit?.(id, text);
  }

  private handleDragStart(e: DragEvent, task: Task): void {
    this.draggedTask = task;
    this.draggedFromGroup = this.findTaskGroup(task.id);
    
    // Set drag data
    if (e.dataTransfer) {
      e.dataTransfer.setData('application/json', JSON.stringify({
        taskId: task.id,
        fromGroup: this.draggedFromGroup
      }));
      e.dataTransfer.effectAllowed = 'move';
    }

    // Visual feedback
    this.groupsContainer.classList.add('is-dragging');
  }

  private handleDragEnd(e: DragEvent, task: Task): void {
    this.cleanupDragState();
  }

  private handleDrop(e: DragEvent, toGroup: TaskGroupType): void {
    e.preventDefault();
    
    if (!this.draggedTask || !this.draggedFromGroup) return;

    // Get drop position from mouse coordinates
    const group = this.groups.get(toGroup);
    if (!group) return;

    // Calculate insertion index based on mouse position
    const groupEl = group.getElement();
    const rect = groupEl.getBoundingClientRect();
    const relativeY = e.clientY - rect.top;
    
    // Get all task items in this group
    const taskItems = groupEl.querySelectorAll('.task-item');
    let insertIndex = taskItems.length;

    for (let i = 0; i < taskItems.length; i++) {
      const itemRect = taskItems[i].getBoundingClientRect();
      const itemRelativeY = itemRect.top - rect.top + itemRect.height / 2;
      if (relativeY < itemRelativeY) {
        insertIndex = i;
        break;
      }
    }

    // Move task between groups or reorder within group
    if (this.draggedFromGroup !== toGroup) {
      // Remove from old group
      const oldGroup = this.groups.get(this.draggedFromGroup);
      oldGroup?.removeTask(this.draggedTask.id);
      
      // Add to new group
      const movedTask = { ...this.draggedTask };
      // Update due date to match new group
      movedTask.dueDate = this.getGroupDefaultDate(toGroup);
      
      group.addTask(movedTask);
      this.allTasks.set(movedTask.id, movedTask);
      
      this.options.onTaskMove?.(this.draggedTask.id, this.draggedFromGroup, toGroup, insertIndex);
    } else {
      // Reorder within same group
      group.moveTask(this.draggedTask.id, insertIndex);
      this.options.onTaskReorder?.(this.draggedTask.id, toGroup, insertIndex);
    }

    // Visual feedback
    group.highlight();
    this.cleanupDragState();
  }

  private cleanupDragState(): void {
    this.draggedTask = null;
    this.draggedFromGroup = null;
    this.groupsContainer.classList.remove('is-dragging');
    
    this.groups.forEach(group => {
      group.getElement().classList.remove('is-drag-over');
    });
  }

  private findTaskGroup(taskId: string): TaskGroupType | null {
    for (const [type, group] of this.groups) {
      if (group.getTasks().some(t => t.id === taskId)) {
        return type;
      }
    }
    return null;
  }

  private getGroupDefaultDate(groupType: TaskGroupType): Date {
    const date = new Date();
    switch (groupType) {
      case 'today':
        return date;
      case 'tomorrow':
        date.setDate(date.getDate() + 1);
        return date;
      case 'week':
        date.setDate(date.getDate() + 3);
        return date;
      case 'later':
        date.setDate(date.getDate() + 14);
        return date;
    }
  }

  private setupKeyboardNavigation(): void {
    this.element.addEventListener('keydown', (e) => {
      if (e.target === this.quickAddInput) return;
      
      const taskIds = Array.from(this.allTasks.keys());
      const currentIndex = this.keyboardFocusedTaskId 
        ? taskIds.indexOf(this.keyboardFocusedTaskId)
        : -1;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          this.focusTaskAtIndex(Math.min(currentIndex + 1, taskIds.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (currentIndex <= 0) {
            this.quickAddInput.focus();
          } else {
            this.focusTaskAtIndex(currentIndex - 1);
          }
          break;
        case 'Home':
          e.preventDefault();
          this.focusTaskAtIndex(0);
          break;
        case 'End':
          e.preventDefault();
          this.focusTaskAtIndex(taskIds.length - 1);
          break;
        case '/':
          if (!this.keyboardFocusedTaskId) {
            e.preventDefault();
            this.quickAddInput.focus();
          }
          break;
      }
    });
  }

  private focusTaskAtIndex(index: number): void {
    // Blur previous
    if (this.keyboardFocusedTaskId) {
      const group = this.findTaskGroup(this.keyboardFocusedTaskId);
      if (group) {
        this.groups.get(group)?.getTaskItem(this.keyboardFocusedTaskId)?.blur();
      }
    }

    // Collect all tasks in display order
    const orderedTasks: string[] = [];
    const groupOrder: TaskGroupType[] = ['today', 'tomorrow', 'week', 'later'];
    
    groupOrder.forEach(type => {
      const group = this.groups.get(type);
      if (group && !group.getElement().classList.contains('collapsed')) {
        group.getTasks().forEach(task => orderedTasks.push(task.id));
      }
    });

    if (index >= 0 && index < orderedTasks.length) {
      this.keyboardFocusedTaskId = orderedTasks[index];
      const group = this.findTaskGroup(this.keyboardFocusedTaskId);
      if (group) {
        const taskItem = this.groups.get(group)?.getTaskItem(this.keyboardFocusedTaskId);
        taskItem?.focus();
        taskItem?.getElement().scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }

  // Public API
  public addTask(task: Task): void {
    this.allTasks.set(task.id, task);
    const groupType = getTaskGroupType(task.dueDate);
    this.groups.get(groupType)?.addTask(task);
  }

  public removeTask(taskId: string): void {
    const groupType = this.findTaskGroup(taskId);
    if (groupType) {
      this.groups.get(groupType)?.removeTask(taskId);
    }
    this.allTasks.delete(taskId);
  }

  public updateTask(taskId: string, updates: Partial<Task>): void {
    const task = this.allTasks.get(taskId);
    if (!task) return;

    const oldGroup = this.findTaskGroup(taskId);
    Object.assign(task, updates);
    
    // Check if due date changed groups
    if (updates.dueDate && oldGroup) {
      const newGroup = getTaskGroupType(updates.dueDate);
      if (newGroup !== oldGroup) {
        this.groups.get(oldGroup)?.removeTask(taskId);
        this.groups.get(newGroup)?.addTask(task);
      } else {
        this.groups.get(oldGroup)?.updateTask(taskId, updates);
      }
    } else if (oldGroup) {
      this.groups.get(oldGroup)?.updateTask(taskId, updates);
    }
  }

  public refresh(): void {
    this.groups.forEach(group => group.refresh());
  }

  public collapseGroup(type: TaskGroupType): void {
    this.groups.get(type)?.setCollapsed(true);
  }

  public expandGroup(type: TaskGroupType): void {
    this.groups.get(type)?.setCollapsed(false);
  }

  public collapseAll(): void {
    this.groups.forEach(group => group.setCollapsed(true));
  }

  public expandAll(): void {
    this.groups.forEach(group => group.setCollapsed(false));
  }

  public getTasks(): Task[] {
    return Array.from(this.allTasks.values());
  }

  public getCompletedCount(): number {
    return Array.from(this.allTasks.values()).filter(t => t.completed).length;
  }

  public getTotalCount(): number {
    return this.allTasks.size;
  }

  public focusQuickAdd(): void {
    this.quickAddInput.focus();
  }

  public destroy(): void {
    this.groups.forEach(group => group.destroy());
    this.groups.clear();
    this.allTasks.clear();
    this.element.remove();
  }

  public setTheme(theme: 'light' | 'dark'): void {
    this.element.classList.remove('theme-light', 'theme-dark');
    this.element.classList.add(`theme-${theme}`);
  }
}

export default TaskListView;