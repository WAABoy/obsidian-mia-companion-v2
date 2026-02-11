/**
 * Mia Companion V2 - Obsidian Plugin
 * Main Entry Point
 * 
 * Integrates Google Calendar, Tasks, Writing Tracker, and AI Chat
 * into a unified companion experience within Obsidian.
 */

import { 
  Plugin, 
  WorkspaceLeaf, 
  TFile, 
  Modal, 
  Setting, 
  Platform,
  addIcon,
  Notice
} from 'obsidian';

// ============================================
// IMPORTS - Services
// ============================================
import { AuthService } from './services/AuthService';
import { SyncEngine } from './services/SyncEngine';
import { GoogleCalendarAPI } from './api/GoogleCalendarAPI';
import { GoogleTasksAPI } from './api/GoogleTasksAPI';
import { WordTrackerV2 } from './tracking/WordTrackerV2';

// ============================================
// IMPORTS - Views
// ============================================
import { CalendarView, VIEW_TYPE_CALENDAR } from './views/CalendarView';
import { TaskListView, VIEW_TYPE_TASKS } from './views/TaskListView';
import { DashboardView, VIEW_TYPE_DASHBOARD } from './views/DashboardView';
import { ChatPanel, VIEW_TYPE_CHAT } from './views/ChatPanel';

// ============================================
// IMPORTS - Settings
// ============================================
import { 
  MiaSettings, 
  DEFAULT_SETTINGS, 
  MiaSettingTab 
} from './settings/MiaSettings';

// ============================================
// IMPORTS - Utilities
// ============================================
import { Logger } from './utils/Logger';
import { EventBus } from './utils/EventBus';
import { Icons } from './utils/Icons';

// ============================================
// PLUGIN CLASS
// ============================================
export default class MiaCompanionPlugin extends Plugin {
  // Settings
  settings: MiaSettings;
  
  // Services
  authService: AuthService;
  syncEngine: SyncEngine;
  calendarAPI: GoogleCalendarAPI;
  tasksAPI: GoogleTasksAPI;
  wordTracker: WordTrackerV2;
  
  // Event Bus for cross-component communication
  eventBus: EventBus;
  logger: Logger;
  
  // State tracking
  private isInitialized = false;
  private activeSyncInterval: number | null = null;

  // ============================================
  // PLUGIN LIFECYCLE - ONLOAD
  // ============================================
  async onload(): Promise<void> {
    console.log('Mia Companion V2: Loading...');
    
    // Initialize logger first for debugging
    this.logger = new Logger(this.settings?.debugMode || false);
    this.logger.info('Mia Companion V2 initializing...');
    
    // Initialize event bus
    this.eventBus = new EventBus();
    
    // Load settings
    await this.loadSettings();
    
    // Initialize services
    await this.initializeServices();
    
    // Register custom icons
    this.registerIcons();
    
    // Register views
    this.registerAllViews();
    
    // Register ribbon icons
    this.registerRibbonIcons();
    
    // Register commands
    this.registerCommands();
    
    // Register event handlers
    this.registerEventHandlers();
    
    // Initialize layout (restore views)
    this.initializeLayout();
    
    // Start background sync if enabled
    if (this.settings.autoSync) {
      this.startAutoSync();
    }
    
    // Add settings tab
    this.addSettingTab(new MiaSettingTab(this.app, this));
    
    this.isInitialized = true;
    this.logger.info('Mia Companion V2 loaded successfully! ✨');
    
    // Emit plugin loaded event
    this.eventBus.emit('plugin:loaded', { timestamp: Date.now() });
  }

  // ============================================
  // PLUGIN LIFECYCLE - ONUNLOAD
  // ============================================
  async onunload(): Promise<void> {
    this.logger.info('Mia Companion V2 unloading...');
    
    // Stop auto sync
    this.stopAutoSync();
    
    // Emit plugin unloading event
    this.eventBus.emit('plugin:unloading', { timestamp: Date.now() });
    
    // Cleanup services
    await this.cleanupServices();
    
    // Clear state
    this.isInitialized = false;
    
    console.log('Mia Companion V2: Unloaded');
  }

  // ============================================
  // INITIALIZATION METHODS
  // ============================================
  
  /**
   * Initialize all plugin services
   */
  private async initializeServices(): Promise<void> {
    this.logger.debug('Initializing services...');
    
    // Auth Service (required by other services)
    this.authService = new AuthService(this);
    await this.authService.initialize();
    
    // Google Calendar API
    this.calendarAPI = new GoogleCalendarAPI(this);
    await this.calendarAPI.initialize();
    
    // Google Tasks API
    this.tasksAPI = new GoogleTasksAPI(this);
    await this.tasksAPI.initialize();
    
    // Word Tracker
    this.wordTracker = new WordTrackerV2(this);
    await this.wordTracker.initialize();
    
    // Sync Engine (orchestrates all sync operations)
    this.syncEngine = new SyncEngine(this);
    await this.syncEngine.initialize();
    
    this.logger.debug('All services initialized');
  }

  /**
   * Cleanup services on unload
   */
  private async cleanupServices(): Promise<void> {
    this.logger.debug('Cleaning up services...');
    
    // Save any pending data
    if (this.wordTracker) {
      await this.wordTracker.saveStats();
    }
    
    // Stop sync engine
    if (this.syncEngine) {
      await this.syncEngine.cleanup();
    }
    
    // Cleanup APIs
    if (this.calendarAPI) {
      await this.calendarAPI.cleanup();
    }
    
    if (this.tasksAPI) {
      await this.tasksAPI.cleanup();
    }
    
    if (this.authService) {
      await this.authService.cleanup();
    }
  }

  // ============================================
  // VIEW REGISTRATION
  // ============================================
  
  /**
   * Register all plugin views
   */
  private registerAllViews(): void {
    this.logger.debug('Registering views...');
    
    // Calendar View
    this.registerView(
      VIEW_TYPE_CALENDAR, 
      (leaf) => new CalendarView(leaf, this)
    );
    
    // Task List View
    this.registerView(
      VIEW_TYPE_TASKS, 
      (leaf) => new TaskListView(leaf, this)
    );
    
    // Dashboard View
    this.registerView(
      VIEW_TYPE_DASHBOARD, 
      (leaf) => new DashboardView(leaf, this)
    );
    
    // Chat Panel View
    this.registerView(
      VIEW_TYPE_CHAT, 
      (leaf) => new ChatPanel(leaf, this)
    );
  }

  /**
   * Initialize layout - restore views from previous session
   */
  private initializeLayout(): void {
    // Views are restored automatically by Obsidian
    // We just ensure proper state
    this.logger.debug('Layout initialized');
  }

  // ============================================
  // ICON REGISTRATION
  // ============================================
  
  /**
   * Register custom icons
   */
  private registerIcons(): void {
    // Add Mia Companion icon
    addIcon('mia-companion', Icons.MIA_COMPANION);
    addIcon('mia-calendar', Icons.CALENDAR);
    addIcon('mia-tasks', Icons.TASKS);
    addIcon('mia-dashboard', Icons.DASHBOARD);
    addIcon('mia-chat', Icons.CHAT);
    addIcon('mia-sync', Icons.SYNC);
  }

  // ============================================
  // RIBBON ICONS
  // ============================================
  
  /**
   * Register ribbon icons (left sidebar)
   */
  private registerRibbonIcons(): void {
    // Dashboard toggle
    this.addRibbonIcon('mia-dashboard', 'Open Mia Dashboard', () => {
      this.activateView(VIEW_TYPE_DASHBOARD);
    });
    
    // Calendar toggle
    this.addRibbonIcon('mia-calendar', 'Open Calendar', () => {
      this.activateView(VIEW_TYPE_CALENDAR);
    });
    
    // Tasks toggle
    this.addRibbonIcon('mia-tasks', 'Open Tasks', () => {
      this.activateView(VIEW_TYPE_TASKS);
    });
    
    // Chat toggle
    this.addRibbonIcon('mia-chat', 'Chat with Mia', () => {
      this.activateView(VIEW_TYPE_CHAT);
    });
    
    // Manual sync button
    this.addRibbonIcon('mia-sync', 'Sync with Google', async () => {
      await this.manualSync();
    });
  }

  // ============================================
  // COMMANDS
  // ============================================
  
  /**
   * Register all plugin commands
   */
  private registerCommands(): void {
    // Open Dashboard
    this.addCommand({
      id: 'open-dashboard',
      name: 'Open Dashboard',
      callback: () => this.activateView(VIEW_TYPE_DASHBOARD)
    });
    
    // Open Calendar
    this.addCommand({
      id: 'open-calendar',
      name: 'Open Calendar',
      callback: () => this.activateView(VIEW_TYPE_CALENDAR)
    });
    
    // Open Tasks
    this.addCommand({
      id: 'open-tasks',
      name: 'Open Tasks',
      callback: () => this.activateView(VIEW_TYPE_TASKS)
    });
    
    // Open Chat
    this.addCommand({
      id: 'open-chat',
      name: 'Open Chat with Mia',
      callback: () => this.activateView(VIEW_TYPE_CHAT)
    });
    
    // Manual Sync
    this.addCommand({
      id: 'manual-sync',
      name: 'Sync Now',
      callback: () => this.manualSync()
    });
    
    // Sync Calendar Only
    this.addCommand({
      id: 'sync-calendar',
      name: 'Sync Calendar Only',
      callback: () => this.syncCalendar()
    });
    
    // Sync Tasks Only
    this.addCommand({
      id: 'sync-tasks',
      name: 'Sync Tasks Only',
      callback: () => this.syncTasks()
    });
    
    // Show Writing Stats
    this.addCommand({
      id: 'show-writing-stats',
      name: 'Show Writing Statistics',
      callback: () => this.showWritingStats()
    });
    
    // Quick Add Task
    this.addCommand({
      id: 'quick-add-task',
      name: 'Quick Add Task',
      callback: () => this.quickAddTask()
    });
    
    // Authenticate with Google
    this.addCommand({
      id: 'authenticate-google',
      name: 'Authenticate with Google',
      callback: () => this.authenticateGoogle()
    });
    
    // Sign out
    this.addCommand({
      id: 'sign-out',
      name: 'Sign Out from Google',
      callback: () => this.signOut()
    });
  }

  // ============================================
  // EVENT HANDLERS
  // ============================================
  
  /**
   * Register internal event handlers
   */
  private registerEventHandlers(): void {
    // File create/modify for word tracking
    this.registerEvent(
      this.app.vault.on('create', (file) => {
        if (file instanceof TFile && file.extension === 'md') {
          this.wordTracker?.handleFileCreate(file);
        }
      })
    );
    
    this.registerEvent(
      this.app.vault.on('modify', (file) => {
        if (file instanceof TFile && file.extension === 'md') {
          this.wordTracker?.handleFileModify(file);
        }
      })
    );
    
    this.registerEvent(
      this.app.vault.on('delete', (file) => {
        if (file instanceof TFile && file.extension === 'md') {
          this.wordTracker?.handleFileDelete(file);
        }
      })
    );
    
    // Active file change for context awareness
    this.registerEvent(
      this.app.workspace.on('file-open', (file) => {
        this.eventBus.emit('file:opened', { file });
      })
    );
    
    // Editor change for real-time word count
    this.registerEvent(
      this.app.workspace.on('editor-change', (editor, info) => {
        this.wordTracker?.handleEditorChange(editor, info);
      })
    );
  }

  // ============================================
  // SYNC MANAGEMENT
  // ============================================
  
  /**
   * Start automatic synchronization
   */
  startAutoSync(): void {
    if (this.activeSyncInterval) {
      return;
    }
    
    const intervalMinutes = this.settings.syncIntervalMinutes || 15;
    const intervalMs = intervalMinutes * 60 * 1000;
    
    this.activeSyncInterval = window.setInterval(() => {
      this.syncEngine?.performSync();
    }, intervalMs);
    
    this.logger.info(`Auto-sync started (${intervalMinutes}min interval)`);
  }

  /**
   * Stop automatic synchronization
   */
  stopAutoSync(): void {
    if (this.activeSyncInterval) {
      window.clearInterval(this.activeSyncInterval);
      this.activeSyncInterval = null;
      this.logger.info('Auto-sync stopped');
    }
  }

  /**
   * Restart auto sync with new settings
   */
  restartAutoSync(): void {
    this.stopAutoSync();
    if (this.settings.autoSync) {
      this.startAutoSync();
    }
  }

  /**
   * Perform manual sync
   */
  async manualSync(): Promise<void> {
    new Notice('Mia: Syncing...', 2000);
    
    try {
      await this.syncEngine?.performSync();
      new Notice('Mia: Sync complete! ✓', 3000);
    } catch (error) {
      this.logger.error('Manual sync failed:', error);
      new Notice('Mia: Sync failed ✗', 3000);
    }
  }

  /**
   * Sync calendar only
   */
  async syncCalendar(): Promise<void> {
    try {
      await this.calendarAPI?.sync();
      new Notice('Mia: Calendar synced! ✓', 3000);
    } catch (error) {
      this.logger.error('Calendar sync failed:', error);
      new Notice('Mia: Calendar sync failed ✗', 3000);
    }
  }

  /**
   * Sync tasks only
   */
  async syncTasks(): Promise<void> {
    try {
      await this.tasksAPI?.sync();
      new Notice('Mia: Tasks synced! ✓', 3000);
    } catch (error) {
      this.logger.error('Tasks sync failed:', error);
      new Notice('Mia: Tasks sync failed ✗', 3000);
    }
  }

  // ============================================
  // VIEW MANAGEMENT
  // ============================================
  
  /**
   * Activate a specific view
   */
  async activateView(viewType: string): Promise<void> {
    const { workspace } = this.app;
    
    // Check if view is already open
    let leaf = workspace.getLeavesOfType(viewType)[0];
    
    if (!leaf) {
      // Create new leaf in right sidebar
      const newLeaf = workspace.getRightLeaf(false);
      if (newLeaf) {
        await newLeaf.setViewState({ type: viewType, active: true });
        leaf = newLeaf;
      }
    }
    
    if (leaf) {
      workspace.revealLeaf(leaf);
    }
  }

  /**
   * Close a specific view type
   */
  async closeView(viewType: string): Promise<void> {
    const leaves = this.app.workspace.getLeavesOfType(viewType);
    leaves.forEach(leaf => leaf.detach());
  }

  // ============================================
  // ACTIONS
  // ============================================
  
  /**
   * Show writing statistics modal
   */
  showWritingStats(): void {
    const stats = this.wordTracker?.getStats();
    
    if (!stats) {
      new Notice('No writing stats available');
      return;
    }
    
    // Create and open stats modal
    new WritingStatsModal(this.app, stats).open();
  }

  /**
   * Quick add task modal
   */
  quickAddTask(): void {
    new QuickAddTaskModal(this.app, this).open();
  }

  /**
   * Authenticate with Google
   */
  async authenticateGoogle(): Promise<void> {
    try {
      await this.authService?.authenticate();
      new Notice('Mia: Authenticated with Google! ✓', 3000);
    } catch (error) {
      this.logger.error('Authentication failed:', error);
      new Notice('Mia: Authentication failed ✗', 3000);
    }
  }

  /**
   * Sign out from Google
   */
  async signOut(): Promise<void> {
    try {
      await this.authService?.signOut();
      new Notice('Mia: Signed out ✓', 3000);
    } catch (error) {
      this.logger.error('Sign out failed:', error);
      new Notice('Mia: Sign out failed ✗', 3000);
    }
  }

  // ============================================
  // SETTINGS
  // ============================================
  
  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    
    // Update logger debug mode
    if (this.logger) {
      this.logger.setDebugMode(this.settings.debugMode);
    }
    
    // Restart auto sync if settings changed
    this.restartAutoSync();
    
    // Notify components of settings change
    this.eventBus.emit('settings:changed', this.settings);
  }

  // ============================================
  // GETTERS
  // ============================================
  
  isReady(): boolean {
    return this.isInitialized;
  }

  getEventBus(): EventBus {
    return this.eventBus;
  }
}

// ============================================
// MODAL CLASSES
// ============================================

/**
 * Writing Statistics Modal
 */
class WritingStatsModal extends Modal {
  private stats: any;

  constructor(app: any, stats: any) {
    super(app);
    this.stats = stats;
  }

  onOpen(): void {
    const { contentEl } = this;
    
    contentEl.createEl('h2', { text: '📝 Writing Statistics' });
    
    const container = contentEl.createDiv('mia-stats-container');
    
    // Today's stats
    const todaySection = container.createDiv('mia-stats-section');
    todaySection.createEl('h3', { text: 'Today' });
    todaySection.createEl('p', { 
      text: `Words written: ${this.stats.today?.words || 0}` 
    });
    todaySection.createEl('p', { 
      text: `Files modified: ${this.stats.today?.files || 0}` 
    });
    todaySection.createEl('p', { 
      text: `Writing time: ${this.stats.today?.minutes || 0} minutes` 
    });
    
    // Weekly stats
    const weekSection = container.createDiv('mia-stats-section');
    weekSection.createEl('h3', { text: 'This Week' });
    weekSection.createEl('p', { 
      text: `Words written: ${this.stats.week?.words || 0}` 
    });
    weekSection.createEl('p', { 
      text: `Daily average: ${this.stats.week?.average || 0}` 
    });
    
    // Streak
    if (this.stats.streak) {
      const streakSection = container.createDiv('mia-stats-section');
      streakSection.createEl('h3', { text: 'Streak' });
      streakSection.createEl('p', { 
        text: `🔥 ${this.stats.streak.days} day${this.stats.streak.days !== 1 ? 's' : ''}` 
      });
    }
    
    // Close button
    new Setting(contentEl)
      .addButton(btn => btn
        .setButtonText('Close')
        .onClick(() => this.close()));
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }
}

/**
 * Quick Add Task Modal
 */
class QuickAddTaskModal extends Modal {
  private plugin: MiaCompanionPlugin;
  private taskTitle = '';
  private taskNotes = '';
  private dueDate = '';

  constructor(app: any, plugin: MiaCompanionPlugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen(): void {
    const { contentEl } = this;
    
    contentEl.createEl('h2', { text: '✓ Quick Add Task' });
    
    // Task title
    new Setting(contentEl)
      .setName('Task')
      .setDesc('What needs to be done?')
      .addText(text => text
        .setPlaceholder('Enter task...')
        .onChange(value => this.taskTitle = value));
    
    // Due date
    new Setting(contentEl)
      .setName('Due Date (optional)')
      .addText(text => text
        .setPlaceholder('YYYY-MM-DD')
        .onChange(value => this.dueDate = value));
    
    // Notes
    new Setting(contentEl)
      .setName('Notes (optional)')
      .addTextArea(area => area
        .setPlaceholder('Additional details...')
        .onChange(value => this.taskNotes = value));
    
    // Buttons
    new Setting(contentEl)
      .addButton(btn => btn
        .setButtonText('Cancel')
        .onClick(() => this.close()))
      .addButton(btn => btn
        .setButtonText('Add Task')
        .setCta()
        .onClick(async () => {
          await this.addTask();
          this.close();
        }));
  }

  async addTask(): Promise<void> {
    if (!this.taskTitle.trim()) {
      new Notice('Task title is required');
      return;
    }
    
    try {
      await this.plugin.tasksAPI?.createTask({
        title: this.taskTitle,
        notes: this.taskNotes,
        due: this.dueDate || undefined
      });
      new Notice('Task added! ✓', 3000);
    } catch (error) {
      new Notice('Failed to add task ✗', 3000);
    }
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }
}
