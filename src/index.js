/**
 * VencordForAndroid v0.0.8 - Real Discord Android Metro/Hermes Entry Point
 * Modeled after revenge-bundle/src/entry.ts:
 * 1. Disables Object.freeze/Object.seal immediately BEFORE index.android.bundle runs.
 * 2. Intercepts globalThis.__r so VencordForAndroid.init() patches SETTING_RENDERER_CONFIG
 *    and createList BEFORE originalRequire(0) boots Discord's UI!
 */

import { Settings, SettingsStore, PlainSettings, definePluginSettings, OptionType } from "./core/Settings.js";
import { Patcher, Webpack, Metro } from "./core/Patcher.js";
import { PluginManager, definePlugin } from "./core/PluginManager.js";
import { Updater, CORE_VERSION, CORE_REPO, CORRUPTED_VERSIONS } from "./core/Updater.js";
import { BUILTIN_PLUGINS } from "./plugins/builtinPlugins.js";
import { SettingsInjector } from "./ui/DiscordSettingsInjector.js";

if (typeof globalThis !== "undefined") {
    globalThis.window = globalThis;
    // Prevent Discord's Metro modules from being frozen before we can patch SETTING_RENDERER_CONFIG / createList
    try {
        Object.freeze = (o) => o;
        Object.seal = (o) => o;
    } catch (_) {}
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
            // Attach live Metro __r interceptor BEFORE registering settings/plugins
            Patcher.attachToMetroRequire();

            Settings.set("version", this.version);
            console.log(`[VencordForAndroid] Initializing v${this.version} natively inside com.discord Metro/Hermes runtime...`);

            // 1. Register all 170 official Vencord plugins adapted for Android
            PluginManager.registerAll(BUILTIN_PLUGINS);

            // 2. Patch Discord Android native Settings (SETTING_RENDERER_CONFIG, createList & SettingsOverviewScreen)
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

                            // Restore real __r BEFORE initializing Vencord so Patcher.findDeepInMetro can use __r safely
                            _requireFunc = origRequire;

                            // Initialize VencordForAndroid BEFORE Discord executes origRequire(0) so createList & SETTING_RENDERER_CONFIG are patched in time!
                            try {
                                VencordForAndroid.init();
                            } catch (e) {
                                console.error("[VencordForAndroid] Pre-boot error:", e);
                            }

                            return origRequire(moduleId);
                        }
                        return origRequire(moduleId);
                    };
                }
            });
        } catch (_) {
            VencordForAndroid.init();
        }
    } else {
        VencordForAndroid.init();
    }
}

bootstrapIntoDiscordMetro();

export default VencordForAndroid;
