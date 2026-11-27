/**
 * VencordForAndroid v0.0.4 - Settings & SettingsStore API
 * Follows Vendicated/Vencord/src/api/Settings.ts architecture for Discord Android (MMKV / NativeBridge / Storage).
 */

import { CORE_VERSION } from "./Version.js";

const STORAGE_KEY = "VencordForAndroid_Settings_v4";

const DEFAULT_SETTINGS = {
    version: CORE_VERSION,
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
            const bridge = globalThis.__VENCORD_NATIVE_BRIDGE__;
            if (typeof bridge?.readSettingsJson === "function" && typeof bridge.writeSettingsJson === "function") {
                return {
                    getItem: () => bridge.readSettingsJson(),
                    setItem: (_k, v) => bridge.writeSettingsJson(v),
                    removeItem: () => bridge.writeSettingsJson("")
                };
            }
            // 2. Discord React Native MMKV storage
            const mmkv = globalThis.mmkvStorage;
            if (typeof mmkv?.getString === "function" && typeof mmkv.set === "function" && typeof mmkv.delete === "function") {
                return {
                    getItem: (k) => mmkv.getString(k) ?? null,
                    setItem: (k, v) => mmkv.set(k, v),
                    removeItem: (k) => mmkv.delete(k)
                };
            }
            // 3. Web / DOM localStorage
            try {
                if (globalThis.localStorage) return globalThis.localStorage;
            } catch (_) {}
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
            return this._normalize(raw ? JSON.parse(raw) : {});
        } catch (err) {
            return this._normalize({});
        }
    }

    _normalize(parsed) {
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            throw new TypeError("Der Einstellungsimport muss ein JSON-Objekt enthalten.");
        }
        const defaults = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
        const plugins = Object.create(null);
        for (const [name, config] of Object.entries(parsed.plugins ?? {})) {
            if (config && typeof config === "object" && !Array.isArray(config)) {
                plugins[name] = { ...config, options: { ...config.options } };
            }
        }
        return {
            ...defaults,
            ...parsed,
            version: CORE_VERSION,
            cloud: { ...defaults.cloud, ...parsed.cloud },
            uiElements: { ...defaults.uiElements, ...parsed.uiElements },
            plugins
        };
    }

    _replaceSettings(next) {
        for (const key of Object.keys(this.plain)) delete this.plain[key];
        Object.defineProperties(this.plain, Object.getOwnPropertyDescriptors(next));
    }

    save(changedPath = "") {
        try {
            const storage = this._getNativeStorage();
            storage.setItem(STORAGE_KEY, JSON.stringify(this.plain));
        } catch (err) {
            console.error("[VencordForAndroid:SettingsStore] Save failed:", err);
        }
        this._notify(changedPath);
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
        const self = this;
        const currentOptions = () => self.getPluginConfig(pluginName, { defaultOptions }).options;
        return new Proxy({}, {
            get(_target, prop) {
                const options = currentOptions();
                if (Object.prototype.hasOwnProperty.call(options, prop)) return options[prop];
                return defaultOptions[prop];
            },
            set(_target, prop, value) {
                self.setPluginOption(pluginName, prop, value);
                return true;
            },
            has(_target, prop) {
                return prop in currentOptions();
            },
            ownKeys() {
                return Reflect.ownKeys(currentOptions());
            },
            getOwnPropertyDescriptor(_target, prop) {
                return Object.getOwnPropertyDescriptor(currentOptions(), prop);
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
        Object.defineProperty(cfg.options, optionKey, {
            value,
            enumerable: true,
            configurable: true,
            writable: true
        });
        this.save(`plugins.${pluginName}.${String(optionKey)}`);
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
        this._replaceSettings(this._normalize(JSON.parse(jsonStr)));
        this.save();
    }

    wipeAll() {
        this._replaceSettings(this._normalize({}));
        this.save("*");
    }
}

export const Settings = new SettingsStoreService();
export const SettingsStore = Settings;
export const PlainSettings = Settings.plain;
export default Settings;
