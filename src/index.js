/**
 * VencordForAndroid - Main Entry Point
 * Repository: https://github.com/juli22292/vencordforandroid
 * Version: 0.0.1
 */

import { Settings } from "./core/Settings.js";
import { Patcher } from "./core/Patcher.js";
import { PluginManager, definePlugin } from "./core/PluginManager.js";
import { Updater, CORE_VERSION, CORE_REPO } from "./core/Updater.js";
import { BUILTIN_PLUGINS } from "./plugins/builtinPlugins.js";
import { SettingsInjector } from "./ui/DiscordSettingsInjector.js";

class VencordForAndroidRuntime {
    constructor() {
        this.version = CORE_VERSION;
        this.repository = CORE_REPO;
        this.initialized = false;
        this.Settings = Settings;
        this.Patcher = Patcher;
        this.Plugins = PluginManager;
        this.Updater = Updater;
        this.UI = SettingsInjector;
        this.definePlugin = definePlugin;
    }

    async init() {
        if (this.initialized) return;
        console.log(`[VencordForAndroid] Initializing v${this.version} (${this.repository})...`);

        // 1. Register all built-in and custom plugins
        PluginManager.registerAll(BUILTIN_PLUGINS);

        // 2. Start all enabled plugins
        PluginManager.startAllEnabled();

        // 3. Inject "VencordForAndroid" section into Discord Settings ("Einstellungen", "Plugins", "Updater", "Backup & Reset")
        SettingsInjector.init();

        this.initialized = true;
        console.log(`[VencordForAndroid] Loaded ${PluginManager.getAllPlugins().length} plugins successfully.`);

        // 4. Optional auto-update check against juli22292/vencordforandroid
        if (Settings.get("autoUpdateCheck")) {
            Updater.checkForUpdates().catch(() => {});
        }
    }

    uninstall() {
        console.log("[VencordForAndroid] Uninstalling VencordForAndroid and all plugins...");
        SettingsInjector.closeSettingsModal();
        const section = typeof document !== "undefined" ? document.getElementById("vfa-discord-settings-section") : null;
        if (section) section.remove();
        PluginManager.uninstallAll();
        this.initialized = false;
    }
}

export const VencordForAndroid = new VencordForAndroidRuntime();

if (typeof globalThis !== "undefined") {
    globalThis.VencordForAndroid = VencordForAndroid;
}
if (typeof window !== "undefined") {
    window.VencordForAndroid = VencordForAndroid;
}

VencordForAndroid.init();

export default VencordForAndroid;
