export interface MiaSettings {
    googleClientEmail: string;
    googlePrivateKey: string;
    openclawUrl: string;
    dailyWordGoal: number;
}

export const DEFAULT_SETTINGS: MiaSettings = {
    googleClientEmail: '',
    googlePrivateKey: '',
    openclawUrl: 'http://localhost:18789',
    dailyWordGoal: 500
};

import { App, PluginSettingTab, Setting } from 'obsidian';
import type MiaPlugin from './main';

export class MiaSettingTab extends PluginSettingTab {
    plugin: MiaPlugin;
    
    constructor(app: App, plugin: MiaPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }
    
    display(): void {
        const { containerEl } = this;
        containerEl.empty();
        
        containerEl.createEl('h2', { text: 'Mia Companion V2 Settings' });
        
        new Setting(containerEl)
            .setName('OpenClaw URL')
            .setDesc('URL of your OpenClaw gateway')
            .addText(text => text
                .setValue(this.plugin.settings.openclawUrl)
                .onChange(async (value) => {
                    this.plugin.settings.openclawUrl = value;
                    await this.plugin.saveSettings();
                }));
        
        new Setting(containerEl)
            .setName('Daily Word Goal')
            .setDesc('Target words per day')
            .addSlider(slider => slider
                .setLimits(100, 2000, 100)
                .setValue(this.plugin.settings.dailyWordGoal)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.dailyWordGoal = value;
                    await this.plugin.saveSettings();
                }));
    }
}
