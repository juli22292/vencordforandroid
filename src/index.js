/**
 * VencordForAndroid v0.0.4 - Main Entry Point
 * Follows Vendicated/Vencord/src/Vencord.ts
 * Repository: https://github.com/juli22292/vencordforandroid
 */

import { Settings, SettingsStore, PlainSettings, definePluginSettings, OptionType } from "./core/Settings.js";
import { Patcher, Webpack, Metro } from "./core/Patcher.js";
import { PluginManager, definePlugin } from "./core/PluginManager.js";
import { Updater, CORE_VERSION, CORE_REPO, CORRUPTED_VERSIONS } from "./core/Updater.js";
import { BUILTIN_PLUGINS } from "./plugins/builtinPlugins.js";
import { SettingsInjector } from "./ui/DiscordSettingsInjector.js";

class VencordForAndroidRuntime {
    constructor() {
        this.version = CORE_VERSION;
        this.corruptedVersions = CORRUPTED_VERSIONS;
        this.repository = CORE_REPO;
        this.initialized = false;
        this.Settings = Settings;
        this.SettingsStore = SettingsStore;
        this.PlainSettings = PlainSettings;
        this.Patcher = Patcher;
        this.Webpack = Webpack;
        this.Metro = Metro;
        this.Plugins = PluginManager;
        this.Updater = Updater;
        this.UI = SettingsInjector;
        this.definePlugin = definePlugin;
        this.definePluginSettings = definePluginSettings;
        this.OptionType = OptionType;
    }

    async init() {
        if (this.initialized) return;

        Settings.set("version", this.version);
        console.log(`[VencordForAndroid] Initializing v${this.version} (${this.repository}) inside Discord JS runtime...`);

        // 1. Register all official Vencord plugins
        PluginManager.registerAll(BUILTIN_PLUGINS);

        // 2. Hook Discord's native Settings router (React Native SETTING_RENDERER_CONFIG & Webpack .buildLayout())
        SettingsInjector.init();

        // 3. Initialize and start all enabled plugins
        PluginManager.startAllEnabled();

        this.initialized = true;
        console.log(`[VencordForAndroid] Loaded ${PluginManager.getAllPlugins().length} official Vencord plugins into Discord.`);

        // 4. Automatic update check against juli22292/vencordforandroid
        if (Settings.get("autoUpdate")) {
            Updater.checkForUpdates().catch(() => {});
        }
    }

    uninstall() {
        console.log("[VencordForAndroid] Uninstalling VencordForAndroid from Discord runtime...");
        SettingsInjector.unpatchAll();
        PluginManager.uninstallAll();
        this.initialized = false;
    }
}

export const VencordForAndroid = new VencordForAndroidRuntime();

if (typeof globalThis !== "undefined") {
    globalThis.VencordForAndroid = VencordForAndroid;
    globalThis.Vencord = VencordForAndroid;
}
if (typeof window !== "undefined") {
    window.VencordForAndroid = VencordForAndroid;
    window.Vencord = VencordForAndroid;
}

VencordForAndroid.init();

export default VencordForAndroid;
