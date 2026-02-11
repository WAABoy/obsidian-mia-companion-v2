/**
 * TaskItem.ts - Individual Task Component
 * Rich interactions with delightful micro-animations
 */

export interface Task {
  id: string;
  text: string;
  completed: boolean;
  priority: 'high' | 'medium' | 'low';
  dueDate: Date;
  tags: string[];
  createdAt: Date;
}

export interface TaskItemOptions {
  task: Task;
  onToggle?: (id: string, completed: boolean) => void;
  onDelete?: (id: string) => void;
  onEdit?: (id: string, text: string) => void;
  onDragStart?: (e: DragEvent, task: Task) => void;
  onDragEnd?: (e: DragEvent, task: Task) => void;
  onSwipe?: (action: 'complete' | 'snooze' | 'delete', task: Task) => void;
  isDraggable?: boolean;
}

export class TaskItem {
  private element: HTMLElement;
  private task: Task;
  private options: TaskItemOptions;
  private isEditing = false;
  private touchStartX = 0;
  private touchCurrentX = 0;
  private isSwiping = false;
  private swipeThreshold = 80;

  constructor(options: TaskItemOptions) {
    this.task = options.task;
    this.options = options;
    this.element = this.createElement();
    this.attachEventListeners();
  }

  private createElement(): HTMLElement {
    const item = document.createElement('div');
    item.className = 'task-item';
    item.setAttribute('draggable', this.options.isDraggable !== false ? 'true' : 'false');
    item.setAttribute('data-task-id', this.task.id);
    item.setAttribute('tabindex', '0');
    item.setAttribute('role', 'listitem');

    if (this.task.completed) {
      item.classList.add('is-completed');
    }

    // Priority indicator
    const priorityBar = document.createElement('div');
    priorityBar.className = `task-item-priority task-item-priority--${this.task.priority}`;
    item.appendChild(priorityBar);

    // Drag handle (visible on hover)
    const dragHandle = document.createElement('div');
    dragHandle.className = 'task-item-drag-handle';
    dragHandle.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M4 6h8M4 10h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
    `;
    dragHandle.setAttribute('aria-label', 'Drag to reorder');
    item.appendChild(dragHandle);

    // Checkbox with satisfying animation
    const checkboxWrapper = document.createElement('label');
    checkboxWrapper.className = 'task-item-checkbox-wrapper';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'task-item-checkbox';
    checkbox.checked = this.task.completed;
    checkbox.setAttribute('aria-label', `Mark "${this.task.text}" as ${this.task.completed ? 'incomplete' : 'complete'}`);
    
    const checkboxVisual = document.createElement('div');
    checkboxVisual.className = 'task-item-checkbox-visual';
    checkboxVisual.innerHTML = `
      <svg viewBox="0 0 14 14" fill="none">
        <path d="M2.5 7l3 3 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
    
    checkboxWrapper.appendChild(checkbox);
    checkboxWrapper.appendChild(checkboxVisual);
    item.appendChild(checkboxWrapper);

    // Confetti container for celebration animation
    const confettiContainer = document.createElement('div');
    confettiContainer.className = 'task-item-confetti';
    item.appendChild(confettiContainer);

    // Content area
    const content = document.createElement('div');
    content.className = 'task-item-content';
    
    const text = document.createElement('div');
    text.className = 'task-item-text';
    text.textContent = this.task.text;
    text.setAttribute('contenteditable', 'false');
    
    const meta = document.createElement('div');
    meta.className = 'task-item-meta';
    
    // Due date display
    const dueDate = this.formatDueDate(this.task.dueDate);
    const dueEl = document.createElement('span');
    dueEl.className = `task-item-due ${dueDate.isOverdue ? 'task-item-due--overdue' : ''}`;
    dueEl.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style="display: inline-block; vertical-align: middle; margin-right: 2px;">
        <circle cx="6" cy="6" r="5" stroke="currentColor" stroke-width="1.5"/>
        <path d="M6 3v3l2 1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
      ${dueDate.text}
    `;
    meta.appendChild(dueEl);
    
    // Tags
    this.task.tags.forEach(tag => {
      const tagEl = document.createElement('span');
      tagEl.className = 'task-item-tag';
      tagEl.innerHTML = `
        <svg width="10" height="10" viewBox="0 0 12 12" fill="currentColor">
          <path d="M2 3a1 1 0 011-1h3.586a1 1 0 01.707.293l3.414 3.414a1 1 0 010 1.414l-2.586 2.586a1 1 0 01-1.414 0L2.293 6.707A1 1 0 012 6V3z"/>
        </svg>
        ${tag}
      `;
      meta.appendChild(tagEl);
    });
    
    content.appendChild(text);
    content.appendChild(meta);
    item.appendChild(content);

    // Action buttons
    const actions = document.createElement('div');
    actions.className = 'task-item-actions';
    
    // Edit button
    const editBtn = document.createElement('button');
    editBtn.className = 'task-item-action task-item-action--edit';
    editBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M11 2l3 3-8 8H3v-3l8-8z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
    editBtn.setAttribute('aria-label', 'Edit task');
    editBtn.title = 'Edit (E)';
    actions.appendChild(editBtn);
    
    // Snooze button
    const snoozeBtn = document.createElement('button');
    snoozeBtn.className = 'task-item-action task-item-action--snooze';
    snoozeBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5"/>
        <path d="M8 4v4l3 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
    `;
    snoozeBtn.setAttribute('aria-label', 'Snooze task');
    snoozeBtn.title = 'Snooze (S)';
    actions.appendChild(snoozeBtn);
    
    // Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'task-item-action task-item-action--delete';
    deleteBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M3 4h10M6 4V2.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5V4m2 0v9.5a.5.5 0 01-.5.5h-9a.5.5 0 01-.5-.5V4h11z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
    `;
    deleteBtn.setAttribute('aria-label', 'Delete task');
    deleteBtn.title = 'Delete (Delete)';
    actions.appendChild(deleteBtn);
    
    item.appendChild(actions);

    // Swipe actions overlay (mobile)
    const swipeContainer = document.createElement('div');
    swipeContainer.className = 'task-item-swipe-container';
    swipeContainer.style.cssText = 'position: absolute; top: 0; right: 0; bottom: 0; overflow: hidden; pointer-events: none;';
    
    const swipeActions = document.createElement('div');
    swipeActions.className = 'task-item-swipe-actions';
    swipeActions.style.transform = 'translateX(100%)';
    swipeActions.style.transition = 'transform 0.2s ease';
    
    const swipeComplete = document.createElement('button');
    swipeComplete.className = 'task-item-swipe-action task-item-swipe-action--complete';
    swipeComplete.innerHTML = '✓';
    swipeComplete.title = 'Complete';
    
    const swipeSnooze = document.createElement('button');
    swipeSnooze.className = 'task-item-swipe-action task-item-swipe-action--snooze';
    swipeSnooze.innerHTML = '⏰';
    swipeSnooze.title = 'Snooze';
    
    const swipeDelete = document.createElement('button');
    swipeDelete.className = 'task-item-swipe-action task-item-swipe-action--delete';
    swipeDelete.innerHTML = '🗑';
    swipeDelete.title = 'Delete';
    
    swipeActions.appendChild(swipeComplete);
    swipeActions.appendChild(swoozeSnooze);
    swipeActions.appendChild(swipeDelete);
    swipeContainer.appendChild(swipeActions);
    item.appendChild(swipeContainer);

    return item;
  }

  private attachEventListeners(): void {
    const checkbox = this.element.querySelector('.task-item-checkbox') as HTMLInputElement;
    const deleteBtn = this.element.querySelector('.task-item-action--delete') as HTMLButtonElement;
    const snoozeBtn = this.element.querySelector('.task-item-action--snooze') as HTMLButtonElement;
    const editBtn = this.element.querySelector('.task-item-action--edit') as HTMLButtonElement;
    const textEl = this.element.querySelector('.task-item-text') as HTMLElement;

    // Checkbox toggle with confetti celebration
    checkbox?.addEventListener('change', (e) => {
      const isChecked = (e.target as HTMLInputElement).checked;
      
      if (isChecked) {
        this.element.classList.add('is-completing');
        this.triggerConfetti();
        
        setTimeout(() => {
          this.element.classList.remove('is-completing');
        }, 800);
      }
      
      this.task.completed = isChecked;
      this.element.classList.toggle('is-completed', isChecked);
      this.options.onToggle?.(this.task.id, isChecked);
    });

    // Delete action
    deleteBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.animateExit(() => {
        this.options.onDelete?.(this.task.id);
      });
    });

    // Snooze action
    snoozeBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.options.onSwipe?.('snooze', this.task);
      this.showSnoozeFeedback();
    });

    // Edit action
    editBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.startEditing();
    });

    // Double-click to edit
    textEl?.addEventListener('dblclick', () => {
      this.startEditing();
    });

    // Drag events
    this.element.addEventListener('dragstart', (e) => {
      this.element.classList.add('is-dragging');
      this.options.onDragStart?.(e, this.task);
      
      // Set drag image
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', this.task.id);
      }
    });

    this.element.addEventListener('dragend', (e) => {
      this.element.classList.remove('is-dragging');
      this.options.onDragEnd?.(e, this.task);
    });

    // Keyboard navigation
    this.element.addEventListener('keydown', (e) => {
      switch (e.key) {
        case ' ':
          e.preventDefault();
          checkbox?.click();
          break;
        case 'e':
        case 'E':
          if (!this.isEditing) {
            e.preventDefault();
            this.startEditing();
          }
          break;
        case 's':
        case 'S':
          e.preventDefault();
          snoozeBtn?.click();
          break;
        case 'Delete':
        case 'Backspace':
          if (!this.isEditing) {
            e.preventDefault();
            deleteBtn?.click();
          }
          break;
      }
    });

    // Touch swipe handling (mobile)
    this.element.addEventListener('touchstart', (e) => {
      this.touchStartX = e.touches[0].clientX;
      this.isSwiping = true;
    }, { passive: true });

    this.element.addEventListener('touchmove', (e) => {
      if (!this.isSwiping) return;
      
      this.touchCurrentX = e.touches[0].clientX;
      const diff = this.touchStartX - this.touchCurrentX;
      
      if (diff > 0 && diff < 200) {
        this.element.style.transform = `translateX(-${diff * 0.3}px)`;
      }
    }, { passive: true });

    this.element.addEventListener('touchend', (e) => {
      if (!this.isSwiping) return;
      
      const diff = this.touchStartX - this.touchCurrentX;
      this.isSwiping = false;
      
      if (diff > this.swipeThreshold) {
        // Show swipe actions
        this.showSwipeActions();
      } else {
        this.element.style.transform = '';
      }
    });

    // Prevent drag on interactive elements
    const interactiveElements = this.element.querySelectorAll('button, input, [contenteditable]');
    interactiveElements.forEach(el => {
      el.addEventListener('mousedown', (e) => e.stopPropagation());
    });
  }

  private triggerConfetti(): void {
    const container = this.element.querySelector('.task-item-confetti') as HTMLElement;
    if (!container) return;

    const colors = ['#e8a4b8', '#ffb7c5', '#9bc89b', '#ffd166', '#a4c2f4'];
    const particleCount = 8;

    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement('div');
      particle.className = 'task-item-confetti-particle';
      particle.style.backgroundColor = colors[i % colors.length];
      
      const angle = (360 / particleCount) * i;
      const distance = 30 + Math.random() * 20;
      const x = Math.cos((angle * Math.PI) / 180) * distance;
      const y = Math.sin((angle * Math.PI) / 180) * distance;
      
      particle.style.setProperty('--x', `${x}px`);
      particle.style.setProperty('--y', `${y}px`);
      particle.style.animationDelay = `${Math.random() * 0.1}s`;
      
      container.appendChild(particle);
      
      setTimeout(() => particle.remove(), 1000);
    }
  }

  private animateExit(callback: () => void): void {
    this.element.classList.add('task-item-exit');
    this.element.addEventListener('animationend', callback, { once: true });
  }

  private showSnoozeFeedback(): void {
    const meta = this.element.querySelector('.task-item-meta');
    if (!meta) return;

    const feedback = document.createElement('span');
    feedback.textContent = 'Snoozed! 🌙';
    feedback.style.cssText = 'color: var(--priority-medium); font-weight: 600; animation: fadeIn 0.3s ease;';
    meta.appendChild(feedback);

    setTimeout(() => {
      feedback.remove();
    }, 2000);
  }

  private startEditing(): void {
    if (this.isEditing) return;
    
    this.isEditing = true;
    const textEl = this.element.querySelector('.task-item-text') as HTMLElement;
    textEl.setAttribute('contenteditable', 'true');
    textEl.focus();
    
    // Select all text
    const range = document.createRange();
    range.selectNodeContents(textEl);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    const saveEdit = () => {
      if (!this.isEditing) return;
      
      this.isEditing = false;
      textEl.setAttribute('contenteditable', 'false');
      
      const newText = textEl.textContent?.trim() || '';
      if (newText && newText !== this.task.text) {
        this.task.text = newText;
        this.options.onEdit?.(this.task.id, newText);
      } else {
        textEl.textContent = this.task.text;
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveEdit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        textEl.textContent = this.task.text;
        this.isEditing = false;
        textEl.setAttribute('contenteditable', 'false');
      }
    };

    textEl.addEventListener('blur', saveEdit, { once: true });
    textEl.addEventListener('keydown', handleKeyDown);
  }

  private showSwipeActions(): void {
    const swipeActions = this.element.querySelector('.task-item-swipe-actions') as HTMLElement;
    if (!swipeActions) return;

    swipeActions.style.transform = 'translateX(0)';
    
    // Add click outside to close
    const closeActions = (e: Event) => {
      if (!this.element.contains(e.target as Node)) {
        swipeActions.style.transform = 'translateX(100%)';
        this.element.style.transform = '';
        document.removeEventListener('click', closeActions);
      }
    };
    
    setTimeout(() => {
      document.addEventListener('click', closeActions);
    }, 100);
  }

  private formatDueDate(date: Date): { text: string; isOverdue: boolean } {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const due = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { text: `${Math.abs(diffDays)}d overdue`, isOverdue: true };
    } else if (diffDays === 0) {
      return { text: 'Today', isOverdue: false };
    } else if (diffDays === 1) {
      return { text: 'Tomorrow', isOverdue: false };
    } else if (diffDays < 7) {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      return { text: days[due.getDay()], isOverdue: false };
    } else {
      return { text: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), isOverdue: false };
    }
  }

  // Public API
  public getElement(): HTMLElement {
    return this.element;
  }

  public getTask(): Task {
    return this.task;
  }

  public updateTask(updates: Partial<Task>): void {
    this.task = { ...this.task, ...updates };
    
    // Update UI
    const textEl = this.element.querySelector('.task-item-text');
    const checkbox = this.element.querySelector('.task-item-checkbox') as HTMLInputElement;
    
    if (textEl && updates.text) {
      textEl.textContent = updates.text;
    }
    
    if (checkbox && updates.completed !== undefined) {
      checkbox.checked = updates.completed;
      this.element.classList.toggle('is-completed', updates.completed);
    }
  }

  public destroy(): void {
    this.element.remove();
  }

  public focus(): void {
    this.element.focus();
    this.element.classList.add('is-focused');
  }

  public blur(): void {
    this.element.classList.remove('is-focused');
  }
}

export default TaskItem;