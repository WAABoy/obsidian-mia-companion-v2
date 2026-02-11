"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => MiaPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian2 = require("obsidian");

// src/settings.ts
var import_obsidian = require("obsidian");
var DEFAULT_SETTINGS = {
  googleClientEmail: "",
  googlePrivateKey: "",
  openclawUrl: "http://localhost:18789",
  dailyWordGoal: 500
};
var MiaSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Mia Companion V2 Settings" });
    new import_obsidian.Setting(containerEl).setName("OpenClaw URL").setDesc("URL of your OpenClaw gateway").addText((text) => text.setValue(this.plugin.settings.openclawUrl).onChange(async (value) => {
      this.plugin.settings.openclawUrl = value;
      await this.plugin.saveSettings();
    }));
    new import_obsidian.Setting(containerEl).setName("Daily Word Goal").setDesc("Target words per day").addSlider((slider) => slider.setLimits(100, 2e3, 100).setValue(this.plugin.settings.dailyWordGoal).setDynamicTooltip().onChange(async (value) => {
      this.plugin.settings.dailyWordGoal = value;
      await this.plugin.saveSettings();
    }));
  }
};

// src/main.ts
var MiaPlugin = class extends import_obsidian2.Plugin {
  async onload() {
    await this.loadSettings();
    console.log("Mia Companion V2 loaded");
    new import_obsidian2.Notice("\u{1F338} Mia V2 loaded!");
    this.addSettingTab(new MiaSettingTab(this.app, this));
    const statusBarItem = this.addStatusBarItem();
    statusBarItem.setText("\u{1F338} Mia");
  }
  onunload() {
    console.log("Mia Companion V2 unloaded");
  }
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
};
