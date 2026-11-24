/**
 * VencordForAndroid - Persistent Settings Store
 * Manages core configuration and per-plugin state inside Discord Mobile.
 */

const STORAGE_KEY = "VencordForAndroid_Settings_v1";

const DEFAULT_SETTINGS = {
    version: "0.0.1",
    installedAt: null,
    autoUpdateCheck: true,
    notifyOnUpdates: true,
    safeMode: false,
    developerMode: false,
    repoOwner: "juli22292",
    repoName: "vencordforandroid",
    repoUrl: "https://github.com/juli22292/vencordforandroid",
    installerRepoUrl: "https://github.com/juli22292/vencordandroidapp",
    plugins: {}
};

class SettingsManager {
    constructor() {
        this.state = this._load();
        this.listeners = new Set();
    }

    _getStorageBackend() {
        if (typeof globalThis !== "undefined") {
            if (globalThis.__VENCORD_NATIVE_STORAGE__) {
                return globalThis.__VENCORD_NATIVE_STORAGE__;
            }
            if (globalThis.localStorage) {
                return globalThis.localStorage;
            }
            if (globalThis.mmkvStorage) {
                return {
                    getItem: (k) => globalThis.mmkvStorage.getString(k) ?? null,
                    setItem: (k, v) => globalThis.mmkvStorage.set(k, v),
                    removeItem: (k) => globalThis.mmkvStorage.delete(k)
                };
            }
        }
        if (!this._memoryFallback) {
            this._memoryFallback = new Map();
        }
        return {
            getItem: (k) => this._memoryFallback.get(k) ?? null,
            setItem: (k, v) => this._memoryFallback.set(k, v),
            removeItem: (k) => this._memoryFallback.delete(k)
        };
    }

    _load() {
        try {
            const backend = this._getStorageBackend();
            const raw = backend.getItem(STORAGE_KEY);
            if (!raw) {
                const initial = {
                    ...DEFAULT_SETTINGS,
                    installedAt: new Date().toISOString()
                };
                backend.setItem(STORAGE_KEY, JSON.stringify(initial));
                return initial;
            }
            const parsed = JSON.parse(raw);
            return {
                ...DEFAULT_SETTINGS,
                ...parsed,
                plugins: { ...(parsed.plugins || {}) }
            };
        } catch (err) {
            console.error("[VencordForAndroid] Failed to load settings:", err);
            return { ...DEFAULT_SETTINGS };
        }
    }

    save() {
        try {
            const backend = this._getStorageBackend();
            backend.setItem(STORAGE_KEY, JSON.stringify(this.state));
            this._emit();
        } catch (err) {
            console.error("[VencordForAndroid] Failed to save settings:", err);
        }
    }

    get(key) {
        return this.state[key];
    }

    set(key, value) {
        this.state[key] = value;
        this.save();
    }

    getPluginConfig(pluginName, defaults = {}) {
        if (!this.state.plugins[pluginName]) {
            this.state.plugins[pluginName] = {
                enabled: Boolean(defaults.enabledByDefault),
                options: { ...(defaults.defaultOptions || {}) }
            };
        }
        return this.state.plugins[pluginName];
    }

    setPluginEnabled(pluginName, enabled) {
        const cfg = this.getPluginConfig(pluginName);
        cfg.enabled = Boolean(enabled);
        this.save();
    }

    setPluginOption(pluginName, optionKey, value) {
        const cfg = this.getPluginConfig(pluginName);
        if (!cfg.options) cfg.options = {};
        cfg.options[optionKey] = value;
        this.save();
    }

    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    _emit() {
        for (const listener of this.listeners) {
            try {
                listener(this.state);
            } catch (err) {
                console.error("[VencordForAndroid] Settings listener error:", err);
            }
        }
    }

    exportJSON() {
        return JSON.stringify(this.state, null, 2);
    }

    importJSON(jsonString) {
        const parsed = JSON.parse(jsonString);
        this.state = {
            ...DEFAULT_SETTINGS,
            ...parsed,
            plugins: { ...(parsed.plugins || {}) }
        };
        this.save();
    }

    wipeAll() {
        try {
            const backend = this._getStorageBackend();
            backend.removeItem(STORAGE_KEY);
            this.state = { ...DEFAULT_SETTINGS, plugins: {} };
            this._emit();
        } catch (err) {
            console.error("[VencordForAndroid] Failed to wipe settings:", err);
        }
    }
}

export const Settings = new SettingsManager();
export default Settings;
