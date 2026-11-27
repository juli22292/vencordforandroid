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

    init() {
        if (this.initialized) return;
        PluginManager.registerAll(BUILTIN_PLUGINS);
        SettingsInjector.init();
        this.initialized = true;
    }

    async startPlugins() {
        if (!this.initialized || this.started) return;
        this.started = true;
        const native = Patcher.Common.ReactNative;
        const nativeModules = native?.NativeModules;
        const cache = nativeModules?.NativeCacheModule ?? nativeModules?.MMKVManager
            ?? native?.TurboModuleRegistry?.get?.("NativeCacheModule")
            ?? native?.TurboModuleRegistry?.get?.("MMKVManager");
        await Settings.connectNativeCache(cache);
        if (!this.initialized) return;
        PluginManager.startAllEnabled();
        globalThis.console?.log?.(`[VencordForAndroid] v${this.version} started ${PluginManager.running.size} plugins.`);
        if (Settings.get("autoUpdate") && typeof fetch === "function") {
            await Updater.checkForUpdates();
        }
    }

    uninstall() {
        SettingsInjector.unpatchAll();
        PluginManager.uninstallAll();
        this.initialized = false;
        this.started = false;
    }
}

export const VencordForAndroid = new VencordForAndroidRuntime();

const startVencordPlugins = () => {
    Promise.resolve().then(() => VencordForAndroid.startPlugins()).catch((err) => {
        globalThis.console?.error?.("[VencordForAndroid] Startup failed:", err);
    });
};

globalThis.VencordForAndroid = VencordForAndroid;
globalThis.Vencord = VencordForAndroid;
try {
    VencordForAndroid.init();
    const metroStarted = typeof globalThis.__r === "function";
    Patcher.observeMetroDefinitions(startVencordPlugins);
    if (metroStarted) startVencordPlugins();
} catch (err) {
    globalThis.console?.error?.("[VencordForAndroid] Setup failed:", err);
}

export default VencordForAndroid;
