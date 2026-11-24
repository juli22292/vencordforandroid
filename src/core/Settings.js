/**
 * VencordForAndroid v0.0.4 - Settings & SettingsStore API
 * Follows Vendicated/Vencord/src/api/Settings.ts architecture for Discord Android (MMKV / NativeBridge / Storage).
 */

const STORAGE_KEY = "VencordForAndroid_Settings_v4";

const DEFAULT_SETTINGS = {
    version: "0.0.9",
    autoUpdate: true,
    autoUpdateNotification: true,
    useQuickCss: true,
    quickCss: "",
    themeLinks: [],
    enabledThemes: [],
    enableReactDevtools: false,
    safeMode: false,
    settingsLocation: "aboveNitro",
    cloud: {
        authenticated: false,
        url: "https://api.vencord.dev/",
        settingsSync: false,
        settingsSyncVersion: 0
    },
    uiElements: {
        chatBarButtons: {},
        messagePopoverButtons: {}
    },
    plugins: {}
};

export const OptionType = {
    STRING: 0,
    NUMBER: 1,
    BIGINT: 2,
    BOOLEAN: 3,
    SELECT: 4,
    SLIDER: 5,
    COMPONENT: 6,
    CUSTOM: 7
};

export function definePluginSettings(def) {
    const defined = {
        def,
        pluginName: "",
        get store() {
            return Settings.getPluginOptionsProxy(this.pluginName, def);
        },
        withPrivateSettings() {
            return this;
        }
    };
    return defined;
}

class SettingsStoreService {
    constructor() {
        this.plain = this._load();
        this.globalListeners = new Set();
        this.pathListeners = new Map();
    }

    _getNativeStorage() {
        if (typeof globalThis !== "undefined") {
            // 1. Native Xposed / Loader Bridge inside com.discord
            if (globalThis.__VENCORD_NATIVE_BRIDGE__ && typeof globalThis.__VENCORD_NATIVE_BRIDGE__.readSettingsJson === "function") {
                return {
                    getItem: () => globalThis.__VENCORD_NATIVE_BRIDGE__.readSettingsJson(),
                    setItem: (_k, v) => globalThis.__VENCORD_NATIVE_BRIDGE__.writeSettingsJson(v),
                    removeItem: () => globalThis.__VENCORD_NATIVE_BRIDGE__.writeSettingsJson("")
                };
            }
            // 2. Discord React Native MMKV storage
            if (globalThis.mmkvStorage) {
                return {
                    getItem: (k) => globalThis.mmkvStorage.getString(k) ?? null,
                    setItem: (k, v) => globalThis.mmkvStorage.set(k, v),
                    removeItem: (k) => globalThis.mmkvStorage.delete(k)
                };
            }
            // 3. Web / DOM localStorage
            if (globalThis.localStorage) {
                return globalThis.localStorage;
            }
        }
        if (!this._mem) this._mem = new Map();
        return {
            getItem: (k) => this._mem.get(k) ?? null,
            setItem: (k, v) => this._mem.set(k, v),
            removeItem: (k) => this._mem.delete(k)
        };
    }

    _load() {
        try {
            const storage = this._getNativeStorage();
            const raw = storage.getItem(STORAGE_KEY);
            if (!raw) {
                const init = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
                storage.setItem(STORAGE_KEY, JSON.stringify(init));
                return init;
            }
            const parsed = JSON.parse(raw);
            return {
                ...DEFAULT_SETTINGS,
                ...parsed,
                version: "0.0.9",
                cloud: { ...DEFAULT_SETTINGS.cloud, ...(parsed.cloud || {}) },
                uiElements: { ...DEFAULT_SETTINGS.uiElements, ...(parsed.uiElements || {}) },
                plugins: { ...(parsed.plugins || {}) }
            };
        } catch (err) {
            return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
        }
    }

    save(changedPath = "") {
        try {
            const storage = this._getNativeStorage();
            storage.setItem(STORAGE_KEY, JSON.stringify(this.plain));
            this._notify(changedPath);
        } catch (err) {
            console.error("[VencordForAndroid:SettingsStore] Save failed:", err);
        }
    }

    get(key) {
        return this.plain[key];
    }

    set(key, value) {
        this.plain[key] = value;
        this.save(key);
    }

    getPluginConfig(pluginName, defaults = {}) {
        if (!this.plain.plugins[pluginName]) {
            this.plain.plugins[pluginName] = {
                enabled: Boolean(defaults.enabledByDefault),
                options: { ...(defaults.defaultOptions || {}) }
            };
        } else if (!this.plain.plugins[pluginName].options) {
            this.plain.plugins[pluginName].options = { ...(defaults.defaultOptions || {}) };
        }
        return this.plain.plugins[pluginName];
    }

    getPluginOptionsProxy(pluginName, def = {}) {
        const defaultOptions = {};
        for (const [k, opt] of Object.entries(def)) {
            defaultOptions[k] = opt.default !== undefined
                ? opt.default
                : (Array.isArray(opt.options) ? opt.options.find((o) => o.default)?.value : undefined);
        }
        const cfg = this.getPluginConfig(pluginName, { defaultOptions });
        const self = this;
        return new Proxy(cfg.options, {
            get(target, prop) {
                if (prop in target) return target[prop];
                return defaultOptions[prop];
            },
            set(target, prop, value) {
                target[prop] = value;
                self.save(`plugins.${pluginName}.${String(prop)}`);
                return true;
            }
        });
    }

    setPluginEnabled(pluginName, enabled) {
        const cfg = this.getPluginConfig(pluginName);
        cfg.enabled = Boolean(enabled);
        this.save(`plugins.${pluginName}.enabled`);
    }

    setPluginOption(pluginName, optionKey, value) {
        const cfg = this.getPluginConfig(pluginName);
        if (!cfg.options) cfg.options = {};
        cfg.options[optionKey] = value;
        this.save(`plugins.${pluginName}.${optionKey}`);
    }

    addGlobalChangeListener(cb) {
        this.globalListeners.add(cb);
        return () => this.globalListeners.delete(cb);
    }

    subscribe(cb) {
        return this.addGlobalChangeListener(cb);
    }

    addChangeListener(path, cb) {
        if (!this.pathListeners.has(path)) {
            this.pathListeners.set(path, new Set());
        }
        this.pathListeners.get(path).add(cb);
        return () => this.pathListeners.get(path)?.delete(cb);
    }

    _notify(path) {
        for (const cb of this.globalListeners) {
            try {
                cb(this.plain, path);
            } catch (_) {}
        }
        if (path && this.pathListeners.has(path)) {
            for (const cb of this.pathListeners.get(path)) {
                try {
                    cb();
                } catch (_) {}
            }
        }
    }

    exportJSON() {
        return JSON.stringify(this.plain, null, 2);
    }

    importJSON(jsonStr) {
        const parsed = JSON.parse(jsonStr);
        this.plain = {
            ...DEFAULT_SETTINGS,
            ...parsed,
            version: "0.0.9",
            plugins: { ...(parsed.plugins || {}) }
        };
        this.save();
    }

    wipeAll() {
        const storage = this._getNativeStorage();
        storage.removeItem(STORAGE_KEY);
        this.plain = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
        this._notify("*");
    }
}

export const Settings = new SettingsStoreService();
export const SettingsStore = Settings;
export const PlainSettings = Settings.plain;
export default Settings;
