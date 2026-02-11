/**
 * Word Tracker V2 - Enhanced Word Goal Tracking System
 * 
 * Features:
 * - Global daily word counting (all notes combined)
 * - Streak tracking (consecutive days)
 * - Weekly and monthly statistics
 * - CSV export functionality
 * - Success markers for calendar integration
 * - Word delta tracking (only new words count)
 * - Efficient data storage
 */

import { TFile, Vault, Notice } from 'obsidian';

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * Single day word count entry
 */
export interface DailyWordEntry {
	date: string;           // YYYY-MM-DD
	totalWords: number;     // Total words across all notes
	newWords: number;       // Only new words added (delta)
	filesModified: string[]; // List of modified file paths
	goalReached: boolean;   // Whether daily goal was achieved
}

/**
 * Per-file word tracking snapshot
 */
export interface FileWordSnapshot {
	path: string;
	wordCount: number;
	lastModified: number;   // Timestamp
	hash: string;           // Simple content hash for change detection
}

/**
 * Complete word tracking data structure
 */
export interface WordTrackingData {
	version: number;
	settings: WordTrackerSettings;
	dailyHistory: DailyWordEntry[];
	fileSnapshots: FileWordSnapshot[];
	currentStreak: number;
	longestStreak: number;
	lastStreakDate: string | null;
	totalWordsEver: number;
	lastUpdated: number;
}

/**
 * Word tracker configuration
 */
export interface WordTrackerSettings {
	dailyWordGoal: number;
	weeklyWordGoal: number;
	monthlyWordGoal: number;
	trackDeltas: boolean;
	autoExportCsv: boolean;
	csvExportPath: string;
	createCalendarEvents: boolean;
	calendarEventPrefix: string;
}

/**
 * Statistics summary
 */
export interface WordStats {
	today: DailyWordEntry | null;
	currentStreak: number;
	longestStreak: number;
	thisWeek: number;
	thisMonth: number;
	thisYear: number;
	allTime: number;
	averagePerDay: number;
	daysTracked: number;
	goalsReached: number;
	goalSuccessRate: number;
}

/**
 * Calendar success event for integration
 */
export interface CalendarSuccessEvent {
	date: string;
	wordsWritten: number;
	goal: number;
	percentage: number;
	streakDay: number;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_SETTINGS: WordTrackerSettings = {
	dailyWordGoal: 500,
	weeklyWordGoal: 3500,
	monthlyWordGoal: 15000,
	trackDeltas: true,
	autoExportCsv: false,
	csvExportPath: 'word-stats.csv',
	createCalendarEvents: true,
	calendarEventPrefix: '🎉 Writing Goal:',
};

const DATA_VERSION = 2;
const BATCH_SIZE = 10;
const STORAGE_KEY = 'mia-word-tracker-v2';

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get today's date as YYYY-MM-DD
 */
export function getTodayString(): string {
	return new Date().toISOString().split('T')[0];
}

/**
 * Get date string for N days ago
 */
export function getDateString(daysAgo: number): string {
	const date = new Date();
	date.setDate(date.getDate() - daysAgo);
	return date.toISOString().split('T')[0];
}

/**
 * Get start of week (Monday) as date string
 */
export function getWeekStartString(): string {
	const now = new Date();
	const day = now.getDay();
	const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Monday
	const monday = new Date(now.setDate(diff));
	return monday.toISOString().split('T')[0];
}

/**
 * Get start of month as date string
 */
export function getMonthStartString(): string {
	const now = new Date();
	return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

/**
 * Get start of year as date string
 */
export function getYearStartString(): string {
	const now = new Date();
	return `${now.getFullYear()}-01-01`;
}

/**
 * Simple hash function for content comparison
 */
function simpleHash(content: string): string {
	let hash = 0;
	for (let i = 0; i < content.length; i++) {
		const char = content.charCodeAt(i);
		hash = ((hash << 5) - hash) + char;
		hash = hash & hash;
	}
	return hash.toString(16);
}

/**
 * Count words in markdown content
 * Handles frontmatter, markdown syntax, and code blocks
 */
export function countWordsInContent(content: string): number {
	if (!content || typeof content !== 'string') {
		return 0;
	}

	// Remove frontmatter
	const withoutFrontmatter = content.replace(/^---\s*\n[\s\S]*?\n---\s*\n?/, '');

	// Clean markdown syntax
	const cleanText = withoutFrontmatter
		.replace(/```[\s\S]*?```/g, (match) => match.slice(3, -3).trim())
		.replace(/`([^`]+)`/g, '$1')
		.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
		.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
		.replace(/[#*_~[\](){}|>]/g, ' ')
		.replace(/\s+/g, ' ');

	// Count words (sequences with at least one letter or number)
	const words = cleanText.trim().split(/\s+/).filter(word => 
		/[a-zA-Z0-9\u00C0-\u017F]/.test(word)
	);
	return words.length;
}

// ============================================================================
// Word Tracker V2 Class
// ============================================================================

/**
 * Advanced word tracking system for Obsidian.
 * Tracks daily word counts, streaks, and statistics across all notes.
 *
 * @example
 * ```typescript
 * const tracker = new WordTrackerV2(vault, async (data) => {
 *     await vault.adapter.write('word-data.json', JSON.stringify(data));
 * });
 * await tracker.initialize();
 * ```
 */
export class WordTrackerV2 {
	private vault: Vault;
	private data: WordTrackingData;
	private settings: WordTrackerSettings;
	private saveCallback: (data: WordTrackingData) => Promise<void>;

	/**
	 * Creates a new WordTrackerV2 instance.
	 *
	 * @param vault - The Obsidian vault instance
	 * @param saveCallback - Callback function to persist tracking data
	 * @param settings - Optional partial settings to override defaults
	 */
	constructor(
		vault: Vault,
		saveCallback: (data: WordTrackingData) => Promise<void>,
		settings?: Partial<WordTrackerSettings>
	) {
		this.vault = vault;
		this.saveCallback = saveCallback;
		this.settings = { ...DEFAULT_SETTINGS, ...settings };
		this.data = this.createEmptyData();
	}

	/**
	 * Create empty data structure
	 */
	private createEmptyData(): WordTrackingData {
		return {
			version: DATA_VERSION,
			settings: this.settings,
			dailyHistory: [],
			fileSnapshots: [],
			currentStreak: 0,
			longestStreak: 0,
			lastStreakDate: null,
			totalWordsEver: 0,
			lastUpdated: Date.now(),
		};
	}

	/**
	 * Initialize the tracker with optional saved data.
	 * Migrates data if needed and performs initial word count scan.
	 *
	 * @param savedData - Optional previously saved tracking data
	 * @returns Promise that resolves when initialization is complete
	 *
	 * @example
	 * ```typescript
	 * const savedData = JSON.parse(await vault.adapter.read('word-data.json'));
	 * await tracker.initialize(savedData);
	 * ```
	 */
	async initialize(savedData?: Partial<WordTrackingData>): Promise<void> {
		if (savedData) {
			// Migrate if needed
			this.data = this.migrateData(savedData);
		}
		
		// Check for new day and process
		await this.processNewDayIfNeeded();
		
		// Initial scan
		await this.updateWordCounts();
	}

	/**
	 * Migrate data from older versions
	 */
	private migrateData(savedData: Partial<WordTrackingData>): WordTrackingData {
		const migrated: WordTrackingData = {
			...this.createEmptyData(),
			...savedData,
			version: DATA_VERSION,
			settings: { ...DEFAULT_SETTINGS, ...savedData.settings },
		};
		return migrated;
	}

	/**
	 * Get the current tracking data for persistence.
	 *
	 * @returns The complete WordTrackingData object
	 *
	 * @example
	 * ```typescript
	 * const data = tracker.getData();
	 * await vault.adapter.write('word-data.json', JSON.stringify(data));
	 * ```
	 */
	getData(): WordTrackingData {
		return this.data;
	}

	/**
	 * Update settings
	 */
	updateSettings(newSettings: Partial<WordTrackerSettings>): void {
		this.settings = { ...this.settings, ...newSettings };
		this.data.settings = this.settings;
	}

	// ============================================================================
	// Core Word Counting
	// ============================================================================

	/**
	 * Update word counts for all files
	 * This is the main method to call when files change
	 */
	async updateWordCounts(): Promise<DailyWordEntry | null> {
		const today = getTodayString();
		const markdownFiles = this.vault.getMarkdownFiles();
		
		if (markdownFiles.length === 0) {
			return null;
		}

		// Get or create today's entry
		let todayEntry = this.getOrCreateDailyEntry(today);
		const filesModifiedToday: string[] = [];
		let totalNewWordsToday = 0;
		let totalWordsToday = 0;

		// Process files in batches
		for (let i = 0; i < markdownFiles.length; i += BATCH_SIZE) {
			const batch = markdownFiles.slice(i, i + BATCH_SIZE);
			await Promise.all(
				batch.map(async (file) => {
					const result = await this.processFile(file, today);
					if (result.isNew) {
						filesModifiedToday.push(file.path);
						totalNewWordsToday += result.newWords;
					}
					totalWordsToday += result.totalWords;
				})
			);
		}

		// Update today's entry
		if (filesModifiedToday.length > 0 || todayEntry.filesModified.length > 0) {
			todayEntry.filesModified = [...new Set([...todayEntry.filesModified, ...filesModifiedToday])];
			todayEntry.newWords = this.settings.trackDeltas 
				? (todayEntry.newWords + totalNewWordsToday)
				: totalWordsToday;
			todayEntry.totalWords = totalWordsToday;
			todayEntry.goalReached = todayEntry.newWords >= this.settings.dailyWordGoal;

			// Update streak
			this.updateStreak(today, todayEntry.goalReached);

			// Update totals
			this.recalculateTotals();

			// Save data
			this.data.lastUpdated = Date.now();
			await this.saveCallback(this.data);

			// Auto-export CSV if enabled
			if (this.settings.autoExportCsv) {
				await this.exportToCSV();
			}

			// Create calendar event if goal reached
			if (todayEntry.goalReached && this.settings.createCalendarEvents) {
				this.emitCalendarEvent(todayEntry);
			}
		}

		return todayEntry;
	}

	/**
	 * Process a single file and return word count info
	 */
	private async processFile(
		file: TFile, 
		today: string
	): Promise<{ isNew: boolean; newWords: number; totalWords: number }> {
		try {
			const content = await this.vault.read(file);
			const currentWordCount = countWordsInContent(content);
			const contentHash = simpleHash(content);
			
			// Find existing snapshot
			const existingIndex = this.data.fileSnapshots.findIndex(s => s.path === file.path);
			const existing = existingIndex >= 0 ? this.data.fileSnapshots[existingIndex] : null;

			if (!existing) {
				// New file - all words are new
				const snapshot: FileWordSnapshot = {
					path: file.path,
					wordCount: currentWordCount,
					lastModified: Date.now(),
					hash: contentHash,
				};
				this.data.fileSnapshots.push(snapshot);
				return {
					isNew: true,
					newWords: currentWordCount,
					totalWords: currentWordCount,
				};
			}

			// Check if content changed
			if (existing.hash !== contentHash) {
				const wordDiff = currentWordCount - existing.wordCount;
				const newWords = Math.max(0, wordDiff); // Only count additions

				// Update snapshot
				existing.wordCount = currentWordCount;
				existing.lastModified = Date.now();
				existing.hash = contentHash;

				return {
					isNew: wordDiff > 0,
					newWords: newWords,
					totalWords: currentWordCount,
				};
			}

			// No change
			return {
				isNew: false,
				newWords: 0,
				totalWords: currentWordCount,
			};
		} catch (error) {
			console.error(`WordTrackerV2: Error processing file ${file.path}:`, error);
			return { isNew: false, newWords: 0, totalWords: 0 };
		}
	}

	/**
	 * Get or create a daily entry for a specific date
	 */
	private getOrCreateDailyEntry(date: string): DailyWordEntry {
		let entry = this.data.dailyHistory.find(e => e.date === date);
		if (!entry) {
			entry = {
				date,
				totalWords: 0,
				newWords: 0,
				filesModified: [],
				goalReached: false,
			};
			this.data.dailyHistory.push(entry);
		}
		return entry;
	}

	// ============================================================================
	// Streak Tracking
	// ============================================================================

	/**
	 * Update streak based on goal achievement
	 */
	private updateStreak(date: string, goalReached: boolean): void {
		if (!goalReached) {
			return; // Don't break streak on partial days, just don't increment
		}

		const lastStreakDate = this.data.lastStreakDate;
		
		if (!lastStreakDate) {
			// First streak day
			this.data.currentStreak = 1;
			this.data.lastStreakDate = date;
		} else {
			const yesterday = getDateString(1);
			const dayBefore = getDateString(2);
			
			if (lastStreakDate === yesterday || lastStreakDate === date) {
				// Continuing streak
				if (lastStreakDate !== date) {
					this.data.currentStreak++;
					this.data.lastStreakDate = date;
				}
			} else if (lastStreakDate === dayBefore) {
				// Missed yesterday, but goal reached today - new streak
				this.data.currentStreak = 1;
				this.data.lastStreakDate = date;
			}
		}

		// Update longest streak
		if (this.data.currentStreak > this.data.longestStreak) {
			this.data.longestStreak = this.data.currentStreak;
		}
	}

	/**
	 * Check and handle new day transitions
	 */
	private async processNewDayIfNeeded(): Promise<void> {
		const today = getTodayString();
		const lastEntry = this.data.dailyHistory[this.data.dailyHistory.length - 1];
		
		if (lastEntry && lastEntry.date !== today) {
			// It's a new day - check if yesterday's goal was reached
			const yesterday = getDateString(1);
			const yesterdayEntry = this.data.dailyHistory.find(e => e.date === yesterday);
			
			if (!yesterdayEntry || !yesterdayEntry.goalReached) {
				// Streak broken
				if (this.data.lastStreakDate && this.data.lastStreakDate !== yesterday) {
					// Only reset if we had an active streak
					const lastStreak = this.data.currentStreak;
					this.data.currentStreak = 0;
					
					if (lastStreak > 0) {
						new Notice(`🔥 Streak ended! You reached ${lastStreak} days. Start a new streak today!`);
					}
				}
			}
		}
	}

	// ============================================================================
	// Statistics
	// ============================================================================

	/**
	 * Recalculate total words ever written
	 */
	private recalculateTotals(): void {
		this.data.totalWordsEver = this.data.fileSnapshots.reduce(
			(sum, snapshot) => sum + snapshot.wordCount, 
			0
		);
	}

	/**
	 * Get comprehensive statistics
	 */
	getStats(): WordStats {
		const today = getTodayString();
		const weekStart = getWeekStartString();
		const monthStart = getMonthStartString();
		const yearStart = getYearStartString();

		// Calculate period totals
		const thisWeek = this.sumWordsSince(weekStart);
		const thisMonth = this.sumWordsSince(monthStart);
		const thisYear = this.sumWordsSince(yearStart);

		// Calculate averages and success rate
		const daysTracked = this.data.dailyHistory.length;
		const goalsReached = this.data.dailyHistory.filter(e => e.goalReached).length;
		const allTimeNewWords = this.data.dailyHistory.reduce((sum, e) => sum + e.newWords, 0);
		const averagePerDay = daysTracked > 0 ? Math.round(allTimeNewWords / daysTracked) : 0;

		return {
			today: this.data.dailyHistory.find(e => e.date === today) || null,
			currentStreak: this.data.currentStreak,
			longestStreak: this.data.longestStreak,
			thisWeek,
			thisMonth,
			thisYear,
			allTime: this.data.totalWordsEver,
			averagePerDay,
			daysTracked,
			goalsReached,
			goalSuccessRate: daysTracked > 0 ? Math.round((goalsReached / daysTracked) * 100) : 0,
		};
	}

	/**
	 * Sum new words since a specific date
	 */
	private sumWordsSince(date: string): number {
		return this.data.dailyHistory
			.filter(e => e.date >= date)
			.reduce((sum, e) => sum + e.newWords, 0);
	}

	/**
	 * Get weekly statistics
	 */
	getWeeklyStats(): { day: string; words: number; goalReached: boolean }[] {
		const weekStart = getWeekStartString();
		const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
		
		return days.map((day, index) => {
			const date = new Date();
			const dayOfWeek = date.getDay() || 7;
			date.setDate(date.getDate() - (dayOfWeek - 1) + index);
			const dateStr = date.toISOString().split('T')[0];
			
			const entry = this.data.dailyHistory.find(e => e.date === dateStr);
			return {
				day,
				words: entry?.newWords || 0,
				goalReached: entry?.goalReached || false,
			};
		});
	}

	/**
	 * Get monthly statistics for the last N months
	 */
	getMonthlyStats(months: number = 6): { month: string; words: number; goalsReached: number }[] {
		const result: { month: string; words: number; goalsReached: number }[] = [];
		
		for (let i = months - 1; i >= 0; i--) {
			const date = new Date();
			date.setMonth(date.getMonth() - i);
			const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
			
			const monthEntries = this.data.dailyHistory.filter(e => e.date.startsWith(yearMonth));
			result.push({
				month: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
				words: monthEntries.reduce((sum, e) => sum + e.newWords, 0),
				goalsReached: monthEntries.filter(e => e.goalReached).length,
			});
		}
		
		return result;
	}

	/**
	 * Get daily history for a date range
	 */
	getHistoryRange(startDate: string, endDate: string): DailyWordEntry[] {
		return this.data.dailyHistory
			.filter(e => e.date >= startDate && e.date <= endDate)
			.sort((a, b) => a.date.localeCompare(b.date));
	}

	// ============================================================================
	// CSV Export
	// ============================================================================

	/**
	 * Export word tracking data to CSV
	 */
	async exportToCSV(customPath?: string): Promise<string> {
		const exportPath = customPath || this.settings.csvExportPath;
		
		// Build CSV content
		const headers = ['Date', 'New Words', 'Total Words', 'Files Modified', 'Goal Reached', 'Streak Day'];
		const rows = this.data.dailyHistory
			.sort((a, b) => a.date.localeCompare(b.date))
			.map(entry => {
				const streakDay = entry.goalReached 
					? this.calculateStreakDay(entry.date) 
					: 0;
				return [
					entry.date,
					entry.newWords,
					entry.totalWords,
					entry.filesModified.length,
					entry.goalReached ? 'Yes' : 'No',
					streakDay,
				];
			});

		// Add summary section
		const stats = this.getStats();
		const summaryRows = [
			[],
			['Summary Statistics'],
			['Total Words (All Time)', stats.allTime],
			['Current Streak', stats.currentStreak],
			['Longest Streak', stats.longestStreak],
			['Days Tracked', stats.daysTracked],
			['Goals Reached', stats.goalsReached],
			['Success Rate', `${stats.goalSuccessRate}%`],
			['Average Words/Day', stats.averagePerDay],
		];

		// Combine and format
		const allRows = [headers, ...rows, ...summaryRows];
		const csv = allRows.map(row => 
			row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
		).join('\n');

		// Save to vault
		try {
			const adapter = this.vault.adapter;
			const fullPath = `${this.vault.configDir}/${exportPath}`;
			await adapter.write(fullPath, csv);
			return fullPath;
		} catch (error) {
			console.error('WordTrackerV2: Failed to export CSV:', error);
			throw error;
		}
	}

	/**
	 * Calculate which streak day a date was (if any)
	 */
	private calculateStreakDay(date: string): number {
		// Find consecutive streak backwards from this date
		let streakDay = 0;
		let checkDate = new Date(date);
		
		while (true) {
			const dateStr = checkDate.toISOString().split('T')[0];
			const entry = this.data.dailyHistory.find(e => e.date === dateStr);
			
			if (entry && entry.goalReached) {
				streakDay++;
				checkDate.setDate(checkDate.getDate() - 1);
			} else {
				break;
			}
		}
		
		return streakDay;
	}

	// ============================================================================
	// Calendar Integration
	// ============================================================================

	/**
	 * Get all calendar success events for a date range
	 */
	getCalendarEvents(startDate: string, endDate: string): CalendarSuccessEvent[] {
		return this.data.dailyHistory
			.filter(e => e.date >= startDate && e.date <= endDate && e.goalReached)
			.map(entry => ({
				date: entry.date,
				wordsWritten: entry.newWords,
				goal: this.settings.dailyWordGoal,
				percentage: Math.round((entry.newWords / this.settings.dailyWordGoal) * 100),
				streakDay: this.calculateStreakDay(entry.date),
			}));
	}

	/**
	 * Get today's calendar event if goal reached
	 */
	getTodayCalendarEvent(): CalendarSuccessEvent | null {
		const today = getTodayString();
		const todayEntry = this.data.dailyHistory.find(e => e.date === today);
		
		if (!todayEntry || !todayEntry.goalReached) {
			return null;
		}

		return {
			date: today,
			wordsWritten: todayEntry.newWords,
			goal: this.settings.dailyWordGoal,
			percentage: Math.round((todayEntry.newWords / this.settings.dailyWordGoal) * 100),
			streakDay: this.data.currentStreak,
		};
	}

	/**
	 * Emit a calendar event (for external integration)
	 * Returns the event data that should be sent to calendar API
	 */
	emitCalendarEvent(entry: DailyWordEntry): CalendarSuccessEvent {
		const event: CalendarSuccessEvent = {
			date: entry.date,
			wordsWritten: entry.newWords,
			goal: this.settings.dailyWordGoal,
			percentage: Math.round((entry.newWords / this.settings.dailyWordGoal) * 100),
			streakDay: this.calculateStreakDay(entry.date),
		};

		// This event can be captured by calendar integration
		console.log('WordTrackerV2: Calendar event emitted', event);
		
		return event;
	}

	/**
	 * Generate calendar event title
	 */
	getCalendarEventTitle(event: CalendarSuccessEvent): string {
		return `${this.settings.calendarEventPrefix} ${event.wordsWritten}/${event.goal} words`;
	}

	/**
	 * Generate calendar event description
	 */
	getCalendarEventDescription(event: CalendarSuccessEvent): string {
		const streakEmoji = event.streakDay > 1 ? `🔥 ${event.streakDay} day streak!` : '';
		return `Daily writing goal achieved!\n\nWords written: ${event.wordsWritten}\nGoal: ${event.goal}\nProgress: ${event.percentage}%\n${streakEmoji}`;
	}

	// ============================================================================
	// Utility Methods
	// ============================================================================

	/**
	 * Get encouraging message based on progress
	 */
	getEncouragingMessage(currentWords: number): string {
		const percentage = Math.min(100, Math.round((currentWords / this.settings.dailyWordGoal) * 100));
		
		if (percentage === 0) return "Every journey begins with a single word! 🌟";
		if (percentage < 25) return "Good start! Keep the momentum going! ✍️";
		if (percentage < 50) return "You're making progress! Almost halfway there! 💪";
		if (percentage < 75) return "Great work! More than halfway to your goal! 🔥";
		if (percentage < 100) return "So close! Just a few more words! 🚀";
		return `Goal reached! 🔥 ${this.data.currentStreak} day streak! You're amazing! 🎉✨`;
	}

	/**
	 * Get remaining words to reach goal
	 */
	getRemainingWords(currentWords: number): number {
		return Math.max(0, this.settings.dailyWordGoal - currentWords);
	}

	/**
	 * Check if goal is reached
	 */
	isGoalReached(date?: string): boolean {
		const targetDate = date || getTodayString();
		const entry = this.data.dailyHistory.find(e => e.date === targetDate);
		return entry?.goalReached || false;
	}

	/**
	 * Get current progress percentage
	 */
	getProgressPercentage(currentWords: number): number {
		return Math.min(100, Math.round((currentWords / this.settings.dailyWordGoal) * 100));
	}

	/**
	 * Force recalculation of all stats (useful for migration or repair)
	 */
	async forceRecalculation(): Promise<void> {
		// Clear file snapshots and rebuild
		this.data.fileSnapshots = [];
		
		// Recount all files
		const markdownFiles = this.vault.getMarkdownFiles();
		for (const file of markdownFiles) {
			try {
				const content = await this.vault.read(file);
				const wordCount = countWordsInContent(content);
				this.data.fileSnapshots.push({
					path: file.path,
					wordCount,
					lastModified: Date.now(),
					hash: simpleHash(content),
				});
			} catch (error) {
				console.error(`WordTrackerV2: Error recounting ${file.path}:`, error);
			}
		}

		this.recalculateTotals();
		await this.saveCallback(this.data);
	}

	/**
	 * Clear all history (use with caution!)
	 */
	async clearAllHistory(): Promise<void> {
		this.data = this.createEmptyData();
		await this.saveCallback(this.data);
	}

	/**
	 * Get streak emoji representation
	 */
	getStreakEmoji(): string {
		const streak = this.data.currentStreak;
		if (streak === 0) return '';
		if (streak < 3) return '🔥';
		if (streak < 7) return '🔥🔥';
		if (streak < 14) return '🔥🔥🔥';
		if (streak < 30) return '⚡️🔥⚡️';
		return '👑🔥👑';
	}

	/**
	 * Get achievement badge for current streak
	 */
	getStreakBadge(): string | null {
		const streak = this.data.currentStreak;
		if (streak >= 100) return '🏆 Centurion';
		if (streak >= 30) return '💎 Monthly Master';
		if (streak >= 14) return '🥇 Fortnight Pro';
		if (streak >= 7) return '🥈 Week Warrior';
		if (streak >= 3) return '🥉 Starter Streak';
		return null;
	}
}

// ============================================================================
// Storage Helper
// ============================================================================

/**
 * Helper to serialize WordTrackingData for storage
 */
export function serializeWordData(data: WordTrackingData): string {
	return JSON.stringify(data);
}

/**
 * Helper to deserialize WordTrackingData from storage
 */
export function deserializeWordData(json: string): WordTrackingData | null {
	try {
		return JSON.parse(json) as WordTrackingData;
	} catch (error) {
		console.error('WordTrackerV2: Failed to deserialize data:', error);
		return null;
	}
}

// ============================================================================
// Export Constants
// ============================================================================

export { DEFAULT_SETTINGS, DATA_VERSION, STORAGE_KEY };
export default WordTrackerV2;
