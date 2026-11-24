/**
 * VencordForAndroid - Main Entry Point
 * Repository: https://github.com/juli22292/vencordforandroid
 * Version: 0.0.2
 * Injects directly into the existing official Discord Android app (com.discord).
 */

import { Settings } from "./core/Settings.js";
import { Patcher } from "./core/Patcher.js";
import { PluginManager, definePlugin } from "./core/PluginManager.js";
import { Updater, CORE_VERSION, CORE_REPO, CORRUPTED_VERSIONS } from "./core/Updater.js";
import { BUILTIN_PLUGINS } from "./plugins/builtinPlugins.js";
import { SettingsInjector } from "./ui/DiscordSettingsInjector.js";

class VencordForAndroidRuntime {
    constructor() {
        this.version = CORE_VERSION;
        this.corruptedVersions = CORRUPTED_VERSIONS;
        this.repository = CORE_REPO;
        this.targetPackage = "com.discord";
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

        // Check if host installer or previously cached state is on corrupted version 0.0.1
        let hostVersion = null;
        try {
            if (typeof globalThis !== "undefined" && globalThis.AndroidInstaller?.getSystemStatusJson) {
                const status = JSON.parse(globalThis.AndroidInstaller.getSystemStatusJson());
                hostVersion = status.installerVersion;
            } else if (typeof globalThis !== "undefined" && globalThis.__VENCORD_HOST_VERSION__) {
                hostVersion = globalThis.__VENCORD_HOST_VERSION__;
            }
        } catch (_) {}

        if (hostVersion && !Updater.enforceVersionPolicy(hostVersion)) {
            console.error(`[VencordForAndroid] Blocked execution on corrupted version v${hostVersion}. Update to v${this.version} required.`);
            return;
        }

        Settings.set("version", this.version);
        console.log(`[VencordForAndroid] Initializing v${this.version} inside official Discord (${this.targetPackage})...`);

        // 1. Register all built-in and custom plugins
        PluginManager.registerAll(BUILTIN_PLUGINS);

        // 2. Start all enabled plugins
        PluginManager.startAllEnabled();

        // 3. Inject "VencordForAndroid" section into the official Discord app Settings ("Einstellungen", "Plugins", "Updater", "Backup & Reset")
        SettingsInjector.init();

        this.initialized = true;
        console.log(`[VencordForAndroid] Loaded ${PluginManager.getAllPlugins().length} plugins into official Discord app.`);

        // 4. Auto-update check against juli22292/vencordforandroid
        if (Settings.get("autoUpdateCheck")) {
            Updater.checkForUpdates().catch(() => {});
        }
    }

    uninstall() {
        console.log("[VencordForAndroid] Uninstalling VencordForAndroid and all plugins from official Discord...");
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
