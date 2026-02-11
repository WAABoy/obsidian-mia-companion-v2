/**
 * DashboardView - Main Dashboard Component
 * The heart of Mia Companion with Sakura theme
 */

import { StatsCard, StatsGrid } from './StatsCard';
import { ProgressBar, CircularProgressBar } from './ProgressBar';

export interface DashboardData {
  // User Stats
  streak: number;
  streakRecord: number;
  wordsWritten: number;
  wordGoal: number;
  notesCount: number;
  notesToday: number;
  tasksCompleted: number;
  tasksTotal: number;
  
  // Quick Actions
  recentNotes: Array<{ title: string; path: string; date: Date }>;
  upcomingTasks: Array<{ title: string; due: Date; priority: 'low' | 'medium' | 'high' }>;
  
  // Calendar
  eventsToday: number;
}

export type TabType = 'overview' | 'calendar' | 'tasks' | 'chat';

export class DashboardView {
  private container: HTMLElement;
  private currentTab: TabType = 'overview';
  private petalContainer: HTMLElement | null = null;
  private contentArea: HTMLElement;
  private statsGrid: StatsGrid | null = null;
  private tabButtons: Map<TabType, HTMLElement> = new Map();
  
  // Sample data (would come from plugin in real implementation)
  private data: DashboardData = {
    streak: 12,
    streakRecord: 30,
    wordsWritten: 2450,
    wordGoal: 3000,
    notesCount: 147,
    notesToday: 3,
    tasksCompleted: 8,
    tasksTotal: 12,
    recentNotes: [
      { title: 'Project Ideas', path: 'projects/ideas.md', date: new Date() },
      { title: 'Daily Journal', path: 'journal/2026-02-11.md', date: new Date() },
      { title: 'Meeting Notes', path: 'meetings/team.md', date: new Date(Date.now() - 86400000) }
    ],
    upcomingTasks: [
      { title: 'Review PRs', due: new Date(Date.now() + 3600000), priority: 'high' },
      { title: 'Update Documentation', due: new Date(Date.now() + 7200000), priority: 'medium' },
      { title: 'Team Sync', due: new Date(Date.now() + 86400000), priority: 'low' }
    ],
    eventsToday: 2
  };

  constructor(container: HTMLElement) {
    this.container = container;
    this.container.className = 'mia-companion-view';
    this.container.style.cssText = `
      min-height: 100%;
      background: var(--mia-bg-primary);
      position: relative;
    `;
    
    this.contentArea = document.createElement('div');
    this.contentArea.className = 'mia-container';
    
    this.init();
  }

  private init(): void {
    // Inject styles
    this.injectStyles();
    
    // Create falling petals
    this.createPetals();
    
    // Build UI
    this.buildHeader();
    this.buildTabs();
    this.container.appendChild(this.contentArea);
    
    // Render initial tab
    this.renderTab('overview');
    
    // Add welcome animation
    this.container.classList.add('mia-content-animate');
  }

  private injectStyles(): void {
    // Import CSS files
    const mainStyles = document.createElement('link');
    mainStyles.rel = 'stylesheet';
    mainStyles.href = 'src/ui/styles/main.css';
    
    const animStyles = document.createElement('link');
    animStyles.rel = 'stylesheet';
    animStyles.href = 'src/ui/styles/animations.css';
    
    // For now, inject inline styles for Obsidian compatibility
    const inlineStyles = document.createElement('style');
    inlineStyles.textContent = this.getInlineStyles();
    
    if (!document.getElementById('mia-companion-styles')) {
      inlineStyles.id = 'mia-companion-styles';
      document.head.appendChild(inlineStyles);
    }
  }

  private getInlineStyles(): string {
    return `
      /* Core Sakura Variables */
      .mia-companion-view {
        --mia-primary: #ffb7c5;
        --mia-secondary: #ffd1dc;
        --mia-accent: #ff69b4;
        --mia-bg-primary: var(--background-primary, #ffffff);
        --mia-bg-secondary: var(--background-secondary, #f8f9fa);
        --mia-text-primary: var(--text-normal, #2d2d2d);
        --mia-text-secondary: var(--text-muted, #6b7280);
      }
      
      /* Petal Animation Keyframes */
      @keyframes mia-petal-fall-sway {
        0% { transform: translateY(-10vh) translateX(0) rotate(0deg); opacity: 0; }
        5% { opacity: 0.7; }
        25% { transform: translateY(25vh) translateX(30px) rotate(90deg); }
        50% { transform: translateY(50vh) translateX(-20px) rotate(180deg); }
        75% { transform: translateY(75vh) translateX(25px) rotate(270deg); }
        95% { opacity: 0.5; }
        100% { transform: translateY(110vh) translateX(0) rotate(360deg); opacity: 0; }
      }
      
      @keyframes mia-stat-pop {
        0% { transform: scale(0.8); opacity: 0; }
        50% { transform: scale(1.1); }
        100% { transform: scale(1); opacity: 1; }
      }
      
      @keyframes mia-stat-increment {
        0% { transform: translateY(10px); opacity: 0; }
        100% { transform: translateY(0); opacity: 1; }
      }
      
      @keyframes mia-progress-shimmer {
        0% { background-position: -200% 0; }
        100% { background-position: 200% 0; }
      }
      
      @keyframes mia-streak-flame {
        0%, 100% { transform: scale(1) rotate(-2deg); }
        25% { transform: scale(1.05) rotate(2deg); }
        50% { transform: scale(1.1) rotate(-1deg); }
        75% { transform: scale(1.05) rotate(1deg); }
      }
      
      @keyframes mia-tab-fade-in {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }
      
      @keyframes mia-content-slide-up {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }
      
      /* Animation Classes */
      .mia-content-animate { animation: mia-content-slide-up 0.4s ease-out forwards; }
      .mia-stat-pop { animation: mia-stat-pop 0.5s ease-out forwards; }
      .mia-stat-increment { animation: mia-stat-increment 0.3s ease-out forwards; }
      .mia-tab-content { animation: mia-tab-fade-in 0.3s ease-out forwards; }
      .mia-streak-icon { animation: mia-streak-flame 2s ease-in-out infinite; display: inline-block; }
    `;
  }

  private createPetals(): void {
    this.petalContainer = document.createElement('div');
    this.petalContainer.className = 'mia-petals-container';
    
    // Create 10 petals with different properties
    for (let i = 0; i < 10; i++) {
      const petal = document.createElement('div');
      petal.className = `mia-petal type-${(i % 3) + 1}`;
      petal.style.cssText = `
        left: ${5 + i * 10}%;
        animation-duration: ${10 + Math.random() * 6}s;
        animation-delay: ${Math.random() * 5}s;
        transform: scale(${0.5 + Math.random() * 0.5});
      `;
      this.petalContainer.appendChild(petal);
    }
    
    this.container.appendChild(this.petalContainer);
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
      button.addEventListener('click', () => this.switchTab(tab.id));
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
    // Clear current content (keep header and tabs)
    const existingContent = this.contentArea.querySelector('.mia-tab-panel');
    if (existingContent) {
      existingContent.remove();
    }
    
    const panel = document.createElement('div');
    panel.className = 'mia-tab-panel mia-tab-content';
    
    switch (tabId) {
      case 'overview':
        this.renderOverview(panel);
        break;
      case 'calendar':
        this.renderCalendar(panel);
        break;
      case 'tasks':
        this.renderTasks(panel);
        break;
      case 'chat':
        this.renderChat(panel);
        break;
    }
    
    this.contentArea.appendChild(panel);
  }

  private renderOverview(container: HTMLElement): void {
    // Stats Grid
    this.statsGrid = StatsGrid.createDefaultGrid({
      streak: this.data.streak,
      record: this.data.streakRecord,
      words: this.data.wordsWritten,
      wordGoal: this.data.wordGoal,
      notes: this.data.notesCount,
      notesToday: this.data.notesToday,
      tasksCompleted: this.data.tasksCompleted,
      tasksTotal: this.data.tasksTotal
    });
    container.appendChild(this.statsGrid.getElement());
    
    // Main content grid
    const grid = document.createElement('div');
    grid.className = 'mia-grid mia-grid-2';
    grid.style.cssText = `
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 24px;
    `;
    
    // Left column - Progress & Goals
    const leftCol = document.createElement('div');
    
    // Word Goal Card
    const wordGoalCard = this.createCard('Daily Writing Goal');
    const wordProgress = ProgressBar.createGoalProgress(
      this.data.wordsWritten,
      this.data.wordGoal,
      'Words Today'
    );
    wordGoalCard.appendChild(wordProgress.getElement());
    
    // Goal celebration
    if (this.data.wordsWritten >= this.data.wordGoal) {
      const celebration = document.createElement('div');
      celebration.style.cssText = `
        text-align: center;
        padding: 16px;
        background: linear-gradient(135deg, rgba(255,183,197,0.2) 0%, rgba(255,209,220,0.2) 100%);
        border-radius: 12px;
        margin-top: 16px;
      `;
      celebration.innerHTML = `
        <div style="font-size: 2rem; animation: mia-stat-pop 0.5s ease-out;">🎉</div>
        <p style="margin: 8px 0 0; color: var(--mia-accent); font-weight: 600;">
          Goal reached! Amazing work today! ✨
        </p>
      `;
      wordGoalCard.appendChild(celebration);
    }
    
    leftCol.appendChild(wordGoalCard);
    
    // Quick Actions
    const actionsCard = this.createQuickActionsCard();
    leftCol.appendChild(actionsCard);
    
    grid.appendChild(leftCol);
    
    // Right column - Recent & Upcoming
    const rightCol = document.createElement('div');
    
    // Recent Notes
    const recentCard = this.createRecentNotesCard();
    rightCol.appendChild(recentCard);
    
    // Today's Focus
    const focusCard = this.createTodaysFocusCard();
    rightCol.appendChild(focusCard);
    
    grid.appendChild(rightCol);
    
    container.appendChild(grid);
  }

  private createCard(title: string): HTMLElement {
    const card = document.createElement('div');
    card.className = 'mia-card';
    card.style.cssText = `
      background: var(--mia-bg-card);
      border: 1px solid var(--mia-border);
      border-radius: 16px;
      padding: 20px;
      margin-bottom: 20px;
    `;
    
    const titleEl = document.createElement('h3');
    titleEl.style.cssText = `
      margin: 0 0 16px 0;
      font-size: 1rem;
      font-weight: 600;
      color: var(--mia-text-primary);
    `;
    titleEl.textContent = title;
    card.appendChild(titleEl);
    
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
      btn.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 16px 8px;
        gap: 8px;
        border: 1px solid var(--mia-border);
        background: var(--mia-bg-secondary);
        border-radius: 12px;
        cursor: pointer;
        transition: all 0.2s ease;
        animation: mia-content-slide-up 0.4s ease-out forwards;
        animation-delay: ${index * 0.1}s;
        opacity: 0;
      `;
      btn.innerHTML = `
        <span style="font-size: 1.5rem;">${action.icon}</span>
        <span style="font-size: 0.75rem; font-weight: 500;">${action.label}</span>
      `;
      btn.addEventListener('mouseenter', () => {
        btn.style.transform = 'translateY(-2px)';
        btn.style.borderColor = 'var(--mia-primary)';
        btn.style.boxShadow = '0 4px 12px rgba(255,183,197,0.2)';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.transform = 'translateY(0)';
        btn.style.borderColor = 'var(--mia-border)';
        btn.style.boxShadow = 'none';
      });
      btn.addEventListener('click', action.action);
      grid.appendChild(btn);
    });
    
    card.appendChild(grid);
    return card;
  }

  private createRecentNotesCard(): HTMLElement {
    const card = this.createCard('Recent Notes');
    
    const list = document.createElement('div');
    list.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 8px;
    `;
    
    this.data.recentNotes.forEach((note, index) => {
      const item = document.createElement('div');
      item.style.cssText = `
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s ease;
        animation: mia-content-slide-up 0.4s ease-out forwards;
        animation-delay: ${index * 0.1}s;
        opacity: 0;
      `;
      item.innerHTML = `
        <span style="font-size: 1.25rem;">📝</span>
        <div style="flex: 1; min-width: 0;">
          <div style="font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${note.title}
          </div>
          <div style="font-size: 0.75rem; color: var(--mia-text-muted);">
            ${this.formatDate(note.date)}
          </div>
        </div>
      `;
      item.addEventListener('mouseenter', () => {
        item.style.background = 'var(--mia-bg-hover)';
      });
      item.addEventListener('mouseleave', () => {
        item.style.background = 'transparent';
      });
      item.addEventListener('click', () => this.openNote(note.path));
      list.appendChild(item);
    });
    
    card.appendChild(list);
    return card;
  }

  private createTodaysFocusCard(): HTMLElement {
    const card = this.createCard("Today's Focus");
    
    const focusItems = [
      { icon: '🔥', text: `${this.data.streak} day streak! Keep it up!`, color: '#ff69b4' },
      { icon: '🎯', text: `${this.data.wordGoal - this.data.wordsWritten > 0 
        ? `${(this.data.wordGoal - this.data.wordsWritten).toLocaleString()} words to goal`
        : 'Daily goal completed! 🎉'}`, color: '#22c55e' },
      { icon: '📅', text: `${this.data.eventsToday} events today`, color: '#f59e0b' }
    ];
    
    const list = document.createElement('div');
    list.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 12px;
    `;
    
    focusItems.forEach((item, index) => {
      const row = document.createElement('div');
      row.style.cssText = `
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px;
        background: ${item.color}15;
        border-radius: 12px;
        border-left: 3px solid ${item.color};
        animation: mia-content-slide-up 0.4s ease-out forwards;
        animation-delay: ${index * 0.1}s;
        opacity: 0;
      `;
      row.innerHTML = `
        <span style="font-size: 1.25rem;">${item.icon}</span>
        <span style="font-weight: 500; color: ${item.color};">${item.text}</span>
      `;
      list.appendChild(row);
    });
    
    card.appendChild(list);
    return card;
  }

  private renderCalendar(container: HTMLElement): void {
    const card = this.createCard('Calendar Integration');
    card.innerHTML += `
      <div style="text-align: center; padding: 48px 24px; color: var(--mia-text-muted);">
        <div style="font-size: 4rem; margin-bottom: 16px;">📅</div>
        <p>Calendar view coming soon!</p>
        <p style="font-size: 0.875rem; margin-top: 8px;">
          You'll be able to see your writing schedule and events here.
        </p>
      </div>
    `;
    container.appendChild(card);
  }

  private renderTasks(container: HTMLElement): void {
    const card = this.createCard('Your Tasks');
    
    const taskList = document.createElement('div');
    taskList.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 8px;
    `;
    
    this.data.upcomingTasks.forEach((task, index) => {
      const priorityColors = {
        low: '#6b7280',
        medium: '#f59e0b',
        high: '#ef4444'
      };
      
      const item = document.createElement('div');
      item.style.cssText = `
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px;
        background: var(--mia-bg-secondary);
        border-radius: 12px;
        border-left: 4px solid ${priorityColors[task.priority]};
        animation: mia-content-slide-up 0.4s ease-out forwards;
        animation-delay: ${index * 0.1}s;
        opacity: 0;
      `;
      item.innerHTML = `
        <input type="checkbox" style="width: 20px; height: 20px; accent-color: var(--mia-accent);">
        <div style="flex: 1;">
          <div style="font-weight: 500;">${task.title}</div>
          <div style="font-size: 0.75rem; color: var(--mia-text-muted);">
            Due ${this.formatTime(task.due)}
          </div>
        </div>
        <span style="
          padding: 4px 8px;
          background: ${priorityColors[task.priority]}20;
          color: ${priorityColors[task.priority]};
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
        ">${task.priority}</span>
      `;
      taskList.appendChild(item);
    });
    
    card.appendChild(taskList);
    container.appendChild(card);
  }

  private renderChat(container: HTMLElement): void {
    const card = this.createCard('Chat with Mia 💬');
    card.style.cssText += `
      min-height: 400px;
      display: flex;
      flex-direction: column;
    `;
    
    // Chat messages area
    const messagesArea = document.createElement('div');
    messagesArea.style.cssText = `
      flex: 1;
      min-height: 200px;
      background: var(--mia-bg-secondary);
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 16px;
      overflow-y: auto;
    `;
    
    // Welcome message
    messagesArea.innerHTML = `
      <div style="
        display: flex;
        gap: 12px;
        margin-bottom: 16px;
        animation: mia-content-slide-up 0.4s ease-out;
      ">
        <div style="
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: linear-gradient(135deg, #ffb7c5 0%, #ff69b4 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.25rem;
        ">🌸</div>
        <div style="
          background: var(--mia-bg-card);
          padding: 12px 16px;
          border-radius: 16px;
          border-bottom-left-radius: 4px;
          max-width: 70%;
        ">
          <p style="margin: 0;">Hi there! I'm Mia, your creative companion. How can I help with your writing today? ✨</p>
        </div>
      </div>
    `;
    
    // Input area
    const inputArea = document.createElement('div');
    inputArea.style.cssText = `
      display: flex;
      gap: 12px;
    `;
    inputArea.innerHTML = `
      <input type="text" placeholder="Type a message..." style="
        flex: 1;
        padding: 12px 16px;
        border: 1px solid var(--mia-border);
        border-radius: 24px;
        background: var(--mia-bg-card);
        color: var(--mia-text-primary);
        font-size: 0.875rem;
        outline: none;
        transition: border-color 0.2s ease;
      " onfocus="this.style.borderColor='var(--mia-primary)'" onblur="this.style.borderColor='var(--mia-border)'">
      <button class="mia-btn mia-btn-primary" style="border-radius: 50%; width: 44px; height: 44px; padding: 0;">➤</button>
    `;
    
    card.appendChild(messagesArea);
    card.appendChild(inputArea);
    container.appendChild(card);
  }

  // Action handlers
  private createNewNote(): void {
    console.log('Creating new note...');
    // Would integrate with Obsidian API
  }

  private addTask(): void {
    console.log('Adding task...');
    this.switchTab('tasks');
  }

  private openSearch(): void {
    console.log('Opening search...');
    // Would trigger Obsidian search
  }

  private viewStats(): void {
    console.log('Viewing stats...');
  }

  private openNote(path: string): void {
    console.log('Opening note:', path);
    // Would open note in Obsidian
  }

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

  private formatTime(date: Date): string {
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    
    if (hours < 1) {
      const minutes = Math.floor(diff / (1000 * 60));
      return minutes <= 0 ? 'Now' : `in ${minutes}m`;
    } else if (hours < 24) {
      return `in ${hours}h`;
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  }

  /**
   * Update dashboard data
   */
  updateData(newData: Partial<DashboardData>): void {
    this.data = { ...this.data, ...newData };
    
    // Re-render current tab if it's overview
    if (this.currentTab === 'overview') {
      this.renderTab('overview');
    }
  }

  /**
   * Get the main container element
   */
  getElement(): HTMLElement {
    return this.container;
  }

  /**
   * Destroy the dashboard
   */
  destroy(): void {
    if (this.petalContainer) {
      this.petalContainer.remove();
    }
    this.container.innerHTML = '';
  }
}

// Export for use in plugin
export default DashboardView;
