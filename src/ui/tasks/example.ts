/**
 * TaskPanel Example Usage
 * 
 * This demonstrates how to integrate the Task List Panel
 * into your Obsidian Mia Companion plugin.
 */

import { TaskListView, Task, TaskGroupType } from './index';

// Example: Initialize the task panel
export function initializeTaskPanel(container: HTMLElement): TaskListView {
  // Sample tasks
  const sampleTasks: Task[] = [
    {
      id: '1',
      text: 'Review daily notes from yesterday',
      completed: false,
      priority: 'high',
      dueDate: new Date(),
      tags: ['review', 'notes'],
      createdAt: new Date()
    },
    {
      id: '2',
      text: 'Plan tomorrow\'s schedule',
      completed: false,
      priority: 'medium',
      dueDate: new Date(),
      tags: ['planning'],
      createdAt: new Date()
    },
    {
      id: '3',
      text: 'Update project documentation',
      completed: true,
      priority: 'low',
      dueDate: new Date(Date.now() + 86400000), // tomorrow
      tags: ['docs'],
      createdAt: new Date()
    }
  ];

  // Create the task list view
  const taskList = new TaskListView(container, {
    tasks: sampleTasks,
    placeholderText: 'What needs to be done? Press / to focus',
    
    // Event handlers
    onTaskAdd: (task) => {
      console.log('Adding task:', task);
      // Save to your data store
      // app.vault.modify(file, content);
    },
    
    onTaskToggle: (id, completed) => {
      console.log(`Task ${id} ${completed ? 'completed' : 'uncompleted'}`);
      // Play satisfying sound or animation
      if (completed) {
        // Maybe trigger haptic feedback on mobile
        if ('vibrate' in navigator) {
          navigator.vibrate(50);
        }
      }
    },
    
    onTaskDelete: (id) => {
      console.log('Deleting task:', id);
      // Remove from data store
    },
    
    onTaskEdit: (id, text) => {
      console.log('Editing task:', id, text);
      // Update in data store
    },
    
    onTaskMove: (taskId, fromGroup, toGroup, newIndex) => {
      console.log(`Moved task ${taskId} from ${fromGroup} to ${toGroup} at index ${newIndex}`);
      // Update due date based on new group
    },
    
    onTaskReorder: (taskId, groupType, newIndex) => {
      console.log(`Reordered task ${taskId} in ${groupType} to index ${newIndex}`);
    },
    
    onGroupToggle: (type, collapsed) => {
      console.log(`Group ${type} ${collapsed ? 'collapsed' : 'expanded'}`);
      // Persist user preference
    }
  });

  return taskList;
}

// Example: Create a sidebar view
export class TaskPanelSidebar {
  private view: TaskListView | null = null;
  
  constructor(private container: HTMLElement) {}
  
  async onOpen() {
    // Load tasks from storage
    const tasks = await this.loadTasks();
    
    this.view = new TaskListView(this.container, {
      tasks,
      onTaskAdd: this.handleTaskAdd.bind(this),
      onTaskToggle: this.handleTaskToggle.bind(this),
      onTaskDelete: this.handleTaskDelete.bind(this),
      onTaskEdit: this.handleTaskEdit.bind(this),
      onTaskMove: this.handleTaskMove.bind(this),
    });
  }
  
  private async loadTasks(): Promise<Task[]> {
    // Load from Obsidian data.json or your preferred storage
    return [];
  }
  
  private async handleTaskAdd(task: Omit<Task, 'id' | 'createdAt'>) {
    const newTask: Task = {
      ...task,
      id: crypto.randomUUID(),
      createdAt: new Date()
    };
    this.view?.addTask(newTask);
    await this.saveTasks();
  }
  
  private async handleTaskToggle(id: string, completed: boolean) {
    this.view?.updateTask(id, { completed });
    await this.saveTasks();
  }
  
  private async handleTaskDelete(id: string) {
    this.view?.removeTask(id);
    await this.saveTasks();
  }
  
  private async handleTaskEdit(id: string, text: string) {
    this.view?.updateTask(id, { text });
    await this.saveTasks();
  }
  
  private async handleTaskMove(
    taskId: string, 
    fromGroup: TaskGroupType, 
    toGroup: TaskGroupType,
    newIndex?: number
  ) {
    // Calculate new due date based on target group
    const newDueDate = this.getDueDateForGroup(toGroup);
    this.view?.updateTask(taskId, { dueDate: newDueDate });
    await this.saveTasks();
  }
  
  private getDueDateForGroup(group: TaskGroupType): Date {
    const date = new Date();
    switch (group) {
      case 'today': return date;
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
  
  private async saveTasks() {
    const tasks = this.view?.getTasks() || [];
    // Save to Obsidian data.json
    // await this.plugin.saveData({ tasks });
  }
  
  onClose() {
    this.view?.destroy();
    this.view = null;
  }
}

// Example: Command palette integration
export function registerTaskCommands(plugin: any) {
  // Add task command
  plugin.addCommand({
    id: 'add-task',
    name: 'Add new task',
    hotkeys: [{ modifiers: ['Mod'], key: 't' }],
    callback: () => {
      // Focus quick add input
      const taskPanel = document.querySelector('.task-panel') as HTMLElement;
      if (taskPanel) {
        const input = taskPanel.querySelector('.task-quick-add-input') as HTMLInputElement;
        input?.focus();
      }
    }
  });
  
  // Toggle task panel theme
  plugin.addCommand({
    id: 'toggle-task-theme',
    name: 'Toggle task panel theme',
    callback: () => {
      const taskPanel = document.querySelector('.task-panel') as HTMLElement;
      if (taskPanel) {
        const isDark = taskPanel.classList.contains('theme-dark');
        taskPanel.classList.remove('theme-dark', 'theme-light');
        taskPanel.classList.add(isDark ? 'theme-light' : 'theme-dark');
      }
    }
  });
  
  // Collapse/expand all groups
  plugin.addCommand({
    id: 'collapse-all-groups',
    name: 'Collapse all task groups',
    callback: () => {
      // Access your TaskListView instance and call collapseAll()
    }
  });
}

export default initializeTaskPanel;