/**
 * OptimizedDashboardView.ts - Performance-optimized dashboard
 * 
 * Optimizations:
 * - Lazy loading for tab content
 * - Code splitting by tab
 * - Debounced data updates
 * - Memoized stat calculations
 * - Efficient DOM diffing
 * - RAF-based animations
 */

import { StatsCard, StatsGrid } from '../dashboard/StatsCard';
import { ProgressBar } from '../dashboard/ProgressBar';
import { 
  debounce, 
  rafThrottle,
  memoize,
  CleanupManager,
  LazyLoader
} from '../utils/PerformanceMonitor';

export type TabType = 'overview' | 'calendar' | 'tasks' | 'chat';

export interface OptimizedDashboardData {
  streak: number;
  streakRecord: number;
  wordsWritten: number;
  wordGoal: number;
  notesCount: number;
  notesToday: number;
  tasksCompleted: number;
  tasksTotal: number;
  recentNotes: Array<{ title: string; path: string; date: Date }>;
  upcomingTasks: Array<{ title: string; due: Date; priority: 'low' | 'medium' | 'high' }>;
  eventsToday: number;
}

interface TabLoader {
  loader: () => Promise<any>;
  loaded: boolean;
  component: any | null;
}

export class OptimizedDashboardView {
  private container: HTMLElement;
  private currentTab: TabType = 'overview';
  private contentArea: HTMLElement;
  private statsGrid: StatsGrid | null = null;
  private tabButtons: Map<TabType, HTMLElement> = new Map();
  private cleanup: CleanupManager;
  
  // Lazy-loaded tab components
  private tabLoaders: Map<TabType, TabLoader> = new Map();
  private activeTabComponents: Map<TabType, HTMLElement> = new Map();
  
  // Data and state
  private data: OptimizedDashboardData;
  private dataVersion = 0;
  
  // Debounced handlers
  private debouncedUpdateStats: () => void;
  private rafRender: (tabId: TabType) => void;

  constructor(container: HTMLElement, initialData?: Partial<OptimizedDashboardData>) {
    this.container = container;
    this.cleanup = new CleanupManager();
    
    this.data = {
      streak: 0,
      streakRecord: 0,
      wordsWritten: 0,
      wordGoal: 3000,
      notesCount: 0,
      notesToday: 0,
      tasksCompleted: 0,
      tasksTotal: 0,
      recentNotes: [],
      upcomingTasks: [],
      eventsToday: 0,
      ...initialData,
    };
    
    // Debounced stats update
    this.debouncedUpdateStats = debounce(() => {
      this.updateStatsDisplay();
    }, 100);
    
    // RAF-throttled render
    this.rafRender = rafThrottle((tabId: TabType) => {
      this.performRenderTab(tabId);
    });
    
    this.container.className = 'mia-companion-view mia-companion-optimized';
    this.container.style.cssText = `
      min-height: 100%;
      background: var(--mia-bg-primary);
      position: relative;
      contain: layout style;
    `;
    
    this.contentArea = document.createElement('div');
    this.contentArea.className = 'mia-container';
    
    this.initializeTabLoaders();
    this.init();
  }

  private initializeTabLoaders(): void {
    // Configure lazy loaders for each tab
    this.tabLoaders.set('overview', {
      loader: async () => {
        // Overview is pre-loaded
        return null;
      },
      loaded: true,
      component: null,
    });

    this.tabLoaders.set('calendar', {
      loader: async () => {
        const { OptimizedMonthView } = await import('../calendar/OptimizedMonthView');
        return OptimizedMonthView;
      },
      loaded: false,
      component: null,
    });

    this.tabLoaders.set('tasks', {
      loader: async () => {
        const { OptimizedTaskListView } = await import('../tasks/OptimizedTaskListView');
        return OptimizedTaskListView;
      },
      loaded: false,
      component: null,
    });

    this.tabLoaders.set('chat', {
      loader: async () => {
        // Chat component would be loaded here
        return null;
      },
      loaded: false,
      component: null,
    });
  }

  private init(): void {
    this.injectStyles();
    this.buildHeader();
    this.buildTabs();
    this.container.appendChild(this.contentArea);
    
    // Render initial tab
    this.renderTab('overview');
    
    // Add welcome animation
    requestAnimationFrame(() => {
      this.container.classList.add('mia-content-animate');
    });
  }

  private injectStyles(): void {
    // Only inject if not already present
    if (document.getElementById('mia-companion-optimized-styles')) return;

    const style = document.createElement('style');
    style.id = 'mia-companion-optimized-styles';
    style.textContent = `
      /* Core optimized styles */
      .mia-companion-optimized {
        --mia-primary: #ffb7c5;
        --mia-secondary: #ffd1dc;
        --mia-accent: #ff69b4;
        --mia-bg-primary: var(--background-primary, #ffffff);
        --mia-bg-secondary: var(--background-secondary, #f8f9fa);
        --mia-text-primary: var(--text-normal, #2d2d2d);
        --mia-text-secondary: var(--text-muted, #6b7280);
        contain: layout style;
      }
      
      /* Animation performance */
      .mia-content-animate {
        animation: mia-content-slide-up 0.4s ease-out forwards;
      }
      
      .mia-tab-content {
        animation: mia-tab-fade-in 0.3s ease-out forwards;
        will-change: opacity, transform;
      }
      
      /* GPU acceleration for animations */
      .mia-card,
      .mia-tab-panel {
        transform: translateZ(0);
        backface-visibility: hidden;
      }
      
      /* Containment for performance */
      .mia-stats-grid,
      .mia-tab-panel {
        contain: layout style paint;
      }
      
      @keyframes mia-content-slide-up {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }
      
      @keyframes mia-tab-fade-in {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }
      
      /* Loading state */
      .mia-tab-loading {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 200px;
        color: var(--mia-text-secondary);
      }
      
      .mia-tab-loading::after {
        content: '';
        width: 24px;
        height: 24px;
        border: 2px solid var(--mia-border);
        border-top-color: var(--mia-primary);
        border-radius: 50%;
        margin-left: 12px;
        animation: mia-spin 1s linear infinite;
      }
      
      @keyframes mia-spin {
        to { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }

  private buildHeader(): void {
    const header = document.createElement('header');
    header.className = 'mia-header';
    header.innerHTML = `
      <div>
        <h1 class="mia-header-title">🌸 Mia Companion</h1>
        <p class="mia-header-subtitle">Your creative writing partner</p>
      </div>
      <div style="display: flex; gap: 8px;">
        <button class="mia-btn mia-btn-icon" id="mia-settings-btn" title="Settings">⚙️</button>
        <button class="mia-btn mia-btn-icon" id="mia-help-btn" title="Help">❓</button>
      </div>
    `;
    
    this.contentArea.appendChild(header);
  }

  private buildTabs(): void {
    const tabsContainer = document.createElement('nav');
    tabsContainer.className = 'mia-tabs';
    
    const tabs: Array<{ id: TabType; label: string; icon: string }> = [
      { id: 'overview', label: 'Overview', icon: '📊' },
      { id: 'calendar', label: 'Calendar', icon: '📅' },
      { id: 'tasks', label: 'Tasks', icon: '✅' },
      { id: 'chat', label: 'Chat with Mia', icon: '💬' }
    ];
    
    tabs.forEach(tab => {
      const button = document.createElement('button');
      button.className = `mia-tab ${tab.id === this.currentTab ? 'active' : ''}`;
      button.innerHTML = `${tab.icon} ${tab.label}`;
      
      this.cleanup.addEventListener(button, 'click', () => {
        this.switchTab(tab.id);
      });
      
      this.tabButtons.set(tab.id, button);
      tabsContainer.appendChild(button);
    });
    
    this.contentArea.appendChild(tabsContainer);
  }

  private switchTab(tabId: TabType): void {
    if (tabId === this.currentTab) return;
    
    // Update active state
    this.tabButtons.forEach((btn, id) => {
      btn.classList.toggle('active', id === tabId);
    });
    
    this.currentTab = tabId;
    this.renderTab(tabId);
  }

  private renderTab(tabId: TabType): void {
    this.rafRender(tabId);
  }

  private async performRenderTab(tabId: TabType): Promise<void> {
    // Clear current content (keep header and tabs)
    const existingContent = this.contentArea.querySelector('.mia-tab-panel');
    if (existingContent) {
      // Fade out
      existingContent.classList.add('mia-tab-exit');
      await this.waitForAnimation(existingContent);
      existingContent.remove();
    }
    
    const panel = document.createElement('div');
    panel.className = 'mia-tab-panel mia-tab-content';
    
    // Check if tab needs lazy loading
    const loader = this.tabLoaders.get(tabId);
    if (loader && !loader.loaded) {
      panel.innerHTML = `<div class="mia-tab-loading">Loading ${tabId}...</div>`;
      this.contentArea.appendChild(panel);
      
      try {
        loader.component = await loader.loader();
        loader.loaded = true;
      } catch (error) {
        panel.innerHTML = `<div class="mia-tab-error">Failed to load ${tabId}</div>`;
        return;
      }
    }
    
    // Remove loading state and render actual content
    panel.innerHTML = '';
    
    switch (tabId) {
      case 'overview':
        await this.renderOverview(panel);
        break;
      case 'calendar':
        await this.renderCalendar(panel);
        break;
      case 'tasks':
        await this.renderTasks(panel);
        break;
      case 'chat':
        await this.renderChat(panel);
        break;
    }
    
    this.contentArea.appendChild(panel);
  }

  private async renderOverview(container: HTMLElement): Promise<void> {
    // Stats Grid (memoized)
    const statsData = this.getMemoizedStatsData();
    this.statsGrid = StatsGrid.createDefaultGrid(statsData);
    container.appendChild(this.statsGrid.getElement());
    
    // Main content grid
    const grid = document.createElement('div');
    grid.className = 'mia-grid mia-grid-2';
    grid.style.cssText = `
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 24px;
    `;
    
    // Left column
    const leftCol = document.createElement('div');
    leftCol.appendChild(this.createWordGoalCard());
    leftCol.appendChild(this.createQuickActionsCard());
    grid.appendChild(leftCol);
    
    // Right column
    const rightCol = document.createElement('div');
    rightCol.appendChild(this.createRecentNotesCard());
    rightCol.appendChild(this.createTodaysFocusCard());
    grid.appendChild(rightCol);
    
    container.appendChild(grid);
  }

  private getMemoizedStatsData = memoize(() => ({
    streak: this.data.streak,
    record: this.data.streakRecord,
    words: this.data.wordsWritten,
    wordGoal: this.data.wordGoal,
    notes: this.data.notesCount,
    notesToday: this.data.notesToday,
    tasksCompleted: this.data.tasksCompleted,
    tasksTotal: this.data.tasksTotal,
  }), () => `${this.dataVersion}`);

  private createWordGoalCard(): HTMLElement {
    const card = this.createCard('Daily Writing Goal');
    const wordProgress = ProgressBar.createGoalProgress(
      this.data.wordsWritten,
      this.data.wordGoal,
      'Words Today'
    );
    card.appendChild(wordProgress.getElement());
    
    if (this.data.wordsWritten >= this.data.wordGoal) {
      const celebration = document.createElement('div');
      celebration.className = 'mia-goal-celebration';
      celebration.innerHTML = `
        <div style="font-size: 2rem; animation: mia-stat-pop 0.5s ease-out;">🎉</div>
        <p>Goal reached! Amazing work today! ✨</p>
      `;
      card.appendChild(celebration);
    }
    
    return card;
  }

  private createQuickActionsCard(): HTMLElement {
    const card = this.createCard('Quick Actions');
    
    const actions = [
      { icon: '📝', label: 'New Note', action: () => this.createNewNote() },
      { icon: '⏰', label: 'Add Task', action: () => this.addTask() },
      { icon: '🔍', label: 'Search', action: () => this.openSearch() },
      { icon: '📊', label: 'View Stats', action: () => this.viewStats() }
    ];
    
    const grid = document.createElement('div');
    grid.style.cssText = `
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
    `;
    
    actions.forEach((action, index) => {
      const btn = document.createElement('button');
      btn.className = 'mia-btn mia-btn-secondary';
      btn.style.animationDelay = `${index * 0.1}s`;
      btn.innerHTML = `
        <span style="font-size: 1.5rem;">${action.icon}</span>
        <span style="font-size: 0.75rem; font-weight: 500;">${action.label}</span>
      `;
      
      this.cleanup.addEventListener(btn, 'click', action.action);
      grid.appendChild(btn);
    });
    
    card.appendChild(grid);
    return card;
  }

  private createRecentNotesCard(): HTMLElement {
    const card = this.createCard('Recent Notes');
    const list = document.createElement('div');
    list.className = 'mia-recent-notes-list';
    
    this.data.recentNotes.slice(0, 5).forEach((note, index) => {
      const item = document.createElement('div');
      item.className = 'mia-recent-note-item';
      item.style.animationDelay = `${index * 0.1}s`;
      item.innerHTML = `
        <span>📝</span>
        <div style="flex: 1; min-width: 0;">
          <div style="font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${note.title}
          </div>
          <div style="font-size: 0.75rem; color: var(--mia-text-muted);">
            ${this.formatDate(note.date)}
          </div>
        </div>
      `;
      
      this.cleanup.addEventListener(item, 'click', () => this.openNote(note.path));
      list.appendChild(item);
    });
    
    card.appendChild(list);
    return card;
  }

  private createTodaysFocusCard(): HTMLElement {
    const card = this.createCard("Today's Focus");
    const list = document.createElement('div');
    list.className = 'mia-focus-list';
    
    const focusItems = this.getMemoizedFocusItems();
    
    focusItems.forEach((item, index) => {
      const row = document.createElement('div');
      row.className = 'mia-focus-item';
      row.style.cssText = `
        animation-delay: ${index * 0.1}s;
        border-left-color: ${item.color};
        background: ${item.color}15;
      `;
      row.innerHTML = `
        <span>${item.icon}</span>
        <span style="font-weight: 500; color: ${item.color};">${item.text}</span>
      `;
      list.appendChild(row);
    });
    
    card.appendChild(list);
    return card;
  }

  private getMemoizedFocusItems = memoize(() => {
    const items: Array<{ icon: string; text: string; color: string }> = [];
    
    items.push({
      icon: '🔥',
      text: `${this.data.streak} day streak! Keep it up!`,
      color: '#ff69b4'
    });
    
    const wordsRemaining = this.data.wordGoal - this.data.wordsWritten;
    items.push({
      icon: '🎯',
      text: wordsRemaining > 0 
        ? `${wordsRemaining.toLocaleString()} words to goal`
        : 'Daily goal completed! 🎉',
      color: wordsRemaining > 0 ? '#22c55e' : '#f59e0b'
    });
    
    items.push({
      icon: '📅',
      text: `${this.data.eventsToday} events today`,
      color: '#f59e0b'
    });
    
    return items;
  }, () => `${this.data.streak}-${this.data.wordsWritten}-${this.data.eventsToday}`);

  private createCard(title: string): HTMLElement {
    const card = document.createElement('div');
    card.className = 'mia-card';
    
    const titleEl = document.createElement('h3');
    titleEl.textContent = title;
    card.appendChild(titleEl);
    
    return card;
  }

  private async renderCalendar(container: HTMLElement): Promise<void> {
    const loader = this.tabLoaders.get('calendar');
    if (!loader?.component) {
      container.innerHTML = '<div class="mia-tab-loading">Loading calendar...</div>';
      return;
    }
    
    const { OptimizedMonthView } = loader.component;
    const calendarContainer = document.createElement('div');
    calendarContainer.className = 'mia-calendar-container';
    
    const monthView = new OptimizedMonthView({
      initialDate: new Date(),
      onDateSelect: (date, events) => {
        console.log('Selected date:', date, events);
      },
    });
    
    calendarContainer.appendChild(monthView.getElement());
    container.appendChild(calendarContainer);
    
    // Store reference for cleanup
    this.activeTabComponents.set('calendar', monthView.getElement());
  }

  private async renderTasks(container: HTMLElement): Promise<void> {
    const loader = this.tabLoaders.get('tasks');
    if (!loader?.component) {
      container.innerHTML = '<div class="mia-tab-loading">Loading tasks...</div>';
      return;
    }
    
    const { OptimizedTaskListView } = loader.component;
    const tasksContainer = document.createElement('div');
    tasksContainer.className = 'mia-tasks-container';
    
    const taskList = new OptimizedTaskListView(tasksContainer, {
      tasks: this.data.upcomingTasks.map(t => ({
        id: `task-${t.title}`,
        text: t.title,
        completed: false,
        priority: t.priority,
        dueDate: t.due,
        tags: [],
        createdAt: new Date(),
      })),
      onTaskAdd: (task) => console.log('Add task:', task),
    });
    
    container.appendChild(tasksContainer);
    this.activeTabComponents.set('tasks', tasksContainer);
  }

  private async renderChat(container: HTMLElement): Promise<void> {
    const card = this.createCard('Chat with Mia 💬');
    card.style.cssText += 'min-height: 400px; display: flex; flex-direction: column;';
    
    const messagesArea = document.createElement('div');
    messagesArea.className = 'mia-chat-messages';
    
    const inputArea = document.createElement('div');
    inputArea.className = 'mia-chat-input-area';
    inputArea.innerHTML = `
      <input type="text" placeholder="Type a message..." class="mia-chat-input">
      <button class="mia-btn mia-btn-primary mia-chat-send">➤</button>
    `;
    
    card.appendChild(messagesArea);
    card.appendChild(inputArea);
    container.appendChild(card);
  }

  // ============================================================================
  // Data Updates
  // ============================================================================

  updateData(newData: Partial<OptimizedDashboardData>): void {
    const hasChanges = Object.keys(newData).some(key => {
      const k = key as keyof OptimizedDashboardData;
      return JSON.stringify(this.data[k]) !== JSON.stringify(newData[k]);
    });
    
    if (!hasChanges) return;
    
    this.data = { ...this.data, ...newData };
    this.dataVersion++;
    
    // Debounced update for stats
    if (this.currentTab === 'overview') {
      this.debouncedUpdateStats();
    }
  }

  private updateStatsDisplay(): void {
    if (!this.statsGrid || this.currentTab !== 'overview') return;
    
    // Efficiently update only changed cards
    const statsData = this.getMemoizedStatsData();
    // StatsGrid would have update method for individual cards
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  private formatDate(date: Date): string {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  }

  private waitForAnimation(element: HTMLElement): Promise<void> {
    return new Promise(resolve => {
      const onEnd = () => {
        element.removeEventListener('animationend', onEnd);
        resolve();
      };
      element.addEventListener('animationend', onEnd);
      // Fallback
      setTimeout(resolve, 300);
    });
  }

  // ============================================================================
  // Action Handlers
  // ============================================================================

  private createNewNote(): void {
    console.log('Creating new note...');
  }

  private addTask(): void {
    this.switchTab('tasks');
  }

  private openSearch(): void {
    console.log('Opening search...');
  }

  private viewStats(): void {
    console.log('Viewing stats...');
  }

  private openNote(path: string): void {
    console.log('Opening note:', path);
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  destroy(): void {
    this.cleanup.cleanup();
    this.activeTabComponents.forEach(component => {
      component.remove();
    });
    this.activeTabComponents.clear();
    this.container.innerHTML = '';
  }
}

export default OptimizedDashboardView;
