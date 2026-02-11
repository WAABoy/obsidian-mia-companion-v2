import { App, Plugin, WorkspaceLeaf, TFile, Notice } from 'obsidian';
import { MiaSettings, DEFAULT_SETTINGS, MiaSettingTab } from './settings';

export default class MiaPlugin extends Plugin {
    settings!: MiaSettings;
    
    async onload() {
        await this.loadSettings();
        
        console.log('Mia Companion V2 loaded');
        new Notice('🌸 Mia V2 loaded!');
        
        // Add settings tab
        this.addSettingTab(new MiaSettingTab(this.app, this));
        
        // Status bar
        const statusBarItem = this.addStatusBarItem();
        statusBarItem.setText('🌸 Mia');
    }
    
    onunload() {
        console.log('Mia Companion V2 unloaded');
    }
    
    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }
    
    async saveSettings() {
        await this.saveData(this.settings);
    }
}
