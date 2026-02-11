import { App, TFile } from 'obsidian';

export class WordTracker {
    private app: App;
    private goal: number;
    
    constructor(app: App, goal: number = 500) {
        this.app = app;
        this.goal = goal;
    }
    
    countWords(text: string): number {
        return text.trim().split(/\s+/).filter(w => w.length > 0).length;
    }
    
    async getTodayWordCount(): Promise<number> {
        const files = this.app.vault.getMarkdownFiles();
        let total = 0;
        
        for (const file of files.slice(0, 50)) { // Limit to prevent lag
            try {
                const content = await this.app.vault.read(file);
                total += this.countWords(content);
            } catch (e) {
                // Skip files that can't be read
            }
        }
        
        return total;
    }
    
    getProgress(current: number): number {
        return Math.min(100, Math.round((current / this.goal) * 100));
    }
}
