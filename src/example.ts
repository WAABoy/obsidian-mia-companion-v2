/**
 * Example usage of the Google Calendar Integration
 * 
 * This file demonstrates how to use the GoogleCalendarService
 * for the Mia Companion Obsidian Plugin.
 */

import { createGoogleCalendarService, TaskEvent, WordGoalEvent } from './api/google-calendar';
import * as path from 'path';
import * as os from 'os';

async function main() {
    // Initialize the service
    const credentialsPath = path.join(
        os.homedir(),
        '.openclaw',
        '.secrets',
        'google-service-account.json'
    );

    const calendar = await createGoogleCalendarService({
        credentialsPath,
        calendarName: 'Obsidian Tasks',
        timezone: 'UTC',
        maxRetries: 3,
        rateLimitPerSecond: 10,
    });

    console.log('✅ Google Calendar service initialized');

    // List all accessible calendars
    console.log('\n📅 Available Calendars:');
    const calendars = await calendar.listCalendars();
    calendars.forEach(cal => {
        console.log(`  - ${cal.summary} (${cal.id})`);
    });

    // Get or create the Obsidian Tasks calendar
    const calendarId = await calendar.getOrCreateObsidianCalendar();
    console.log(`\n📝 Using calendar: ${calendarId}`);

    // Create a task event
    const task: TaskEvent = {
        id: 'task-001',
        summary: 'Write blog post about TypeScript',
        description: 'Draft a comprehensive guide on TypeScript best practices',
        dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
        priority: 'high',
        tags: ['writing', 'typescript', 'blog'],
        sourceNote: 'Projects/Blog Ideas.md',
        completed: false,
    };

    const taskResult = await calendar.createTaskEvent(task);
    console.log('\n✅ Task created:', taskResult);

    // Create a word goal achievement
    const wordGoal: WordGoalEvent = {
        goalName: 'Daily Writing Goal',
        wordCount: 1500,
        targetCount: 1000,
        achievedAt: new Date(),
        sourceNote: 'Daily Notes/2025-02-11.md',
        percentage: 150,
    };

    const goalResult = await calendar.createWordGoalEvent(wordGoal);
    console.log('\n🎯 Word goal recorded:', goalResult);

    // List upcoming tasks
    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    console.log('\n📋 Upcoming Tasks (next 7 days):');
    const upcomingTasks = await calendar.getTasksInRange(now, nextWeek, { 
        includeCompleted: false 
    });
    
    upcomingTasks.forEach(event => {
        const start = event.start?.dateTime || event.start?.date;
        console.log(`  - ${event.summary} (${start})`);
    });

    // Get statistics
    console.log('\n📊 Statistics (last 7 days):');
    const stats = await calendar.getStats(
        new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        now
    );
    console.log(`  Tasks: ${stats.completedTasks}/${stats.totalTasks} completed`);
    console.log(`  Words written: ${stats.totalWords}`);

    // Complete a task (example - would use actual event ID)
    if (taskResult.eventId) {
        const completeResult = await calendar.completeTask(taskResult.eventId);
        console.log('\n✓ Task marked as completed:', completeResult);
    }

    console.log('\n✨ Demo complete!');
}

// Run if executed directly
if (require.main === module) {
    main().catch(console.error);
}

export { main };
