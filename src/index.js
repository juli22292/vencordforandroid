/**
 * VencordForAndroid v0.0.7 - Real Discord Android Metro/Hermes Entry Point
 * Modeled after revenge-bundle/src/entry.ts and Vendicated/Vencord/src/Vencord.ts.
 * Hooks globalThis.__r before Discord's index.android.bundle runs so VencordForAndroid
 * injects natively into com.discord's React Native Settings and Metro modules.
 */

import { Settings, SettingsStore, PlainSettings, definePluginSettings, OptionType } from "./core/Settings.js";
import { Patcher, Webpack, Metro } from "./core/Patcher.js";
import { PluginManager, definePlugin } from "./core/PluginManager.js";
import { Updater, CORE_VERSION, CORE_REPO, CORRUPTED_VERSIONS } from "./core/Updater.js";
import { BUILTIN_PLUGINS } from "./plugins/builtinPlugins.js";
import { SettingsInjector } from "./ui/DiscordSettingsInjector.js";

if (typeof globalThis !== "undefined") {
    globalThis.window = globalThis;
}

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

    init() {
        if (this.initialized) return;
        try {
            // Allow patching frozen Discord Metro module exports (exact technique from revenge-bundle)
            try {
                Object.freeze = (o) => o;
                Object.seal = (o) => o;
            } catch (_) {}

            Settings.set("version", this.version);
            console.log(`[VencordForAndroid] Initializing v${this.version} natively inside com.discord Metro/Hermes runtime...`);

            // 1. Register all 170 official Vencord plugins adapted for Android
            PluginManager.registerAll(BUILTIN_PLUGINS);

            // 2. Patch Discord Android native Settings (SETTING_RENDERER_CONFIG & createList)
            SettingsInjector.init();

            // 3. Start all enabled plugins
            PluginManager.startAllEnabled();

            this.initialized = true;
            console.log(`[VencordForAndroid] Loaded ${PluginManager.getAllPlugins().length} official Vencord plugins natively inside com.discord.`);

            // 4. Background update check against juli22292/vencordforandroid
            if (Settings.get("autoUpdate") && typeof fetch === "function") {
                Updater.checkForUpdates().catch(() => {});
            }
        } catch (err) {
            console.error("[VencordForAndroid] Init error:", err);
        }
    }

    uninstall() {
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

/**
 * Bootstrap hook for Discord Android's React Native Hermes engine:
 * When VencordXposedHook injects this bundle BEFORE index.android.bundle runs,
 * globalThis.__r is not defined yet. We intercept __r so VencordForAndroid boots
 * at the exact moment Discord's Metro module table is initialized!
 */
function bootstrapIntoDiscordMetro() {
    if (typeof globalThis === "undefined") {
        VencordForAndroid.init();
        return;
    }

    if (typeof globalThis.__r === "undefined") {
        let _requireFunc;
        let booted = false;

        try {
            Object.defineProperty(globalThis, "__r", {
                configurable: true,
                get() {
                    return _requireFunc;
                },
                set(origRequire) {
                    _requireFunc = function patchedMetroRequire(moduleId) {
                        if (moduleId === 0 && !booted) {
                            booted = true;
                            try {
                                if (globalThis.modules instanceof Map) {
                                    globalThis.modules = Object.fromEntries(globalThis.modules);
                                }
                            } catch (_) {}

                            const result = origRequire(moduleId);
                            _requireFunc = origRequire;

                            // Boot VencordForAndroid right after Metro root module loads
                            setTimeout(() => {
                                VencordForAndroid.init();
                            }, 50);
                            return result;
                        }
                        return origRequire(moduleId);
                    };
                }
            });
        } catch (_) {
            VencordForAndroid.init();
        }
    } else {
        // Already inside an initialized runtime (or verification environment)
        VencordForAndroid.init();
    }
}

bootstrapIntoDiscordMetro();

export default VencordForAndroid;
