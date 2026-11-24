/**
 * VencordForAndroid v0.0.8 (React Native / Hermes Bundle for com.discord)
 * Repository: https://github.com/juli22292/vencordforandroid
 * Official Vencord Plugins adapted for Android (170 plugins)
 * Built: 2026-11-24T19:56:47.700Z
 */
(function (global) {
"use strict";

// --- Module: src/core/Settings.js ---
/**
 * VencordForAndroid v0.0.4 - Settings & SettingsStore API
 * Follows Vendicated/Vencord/src/api/Settings.ts architecture for Discord Android (MMKV / NativeBridge / Storage).
 */

const STORAGE_KEY = "VencordForAndroid_Settings_v4";

const DEFAULT_SETTINGS = {
    version: "0.0.8",
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
const OptionType = {
    STRING: 0,
    NUMBER: 1,
    BIGINT: 2,
    BOOLEAN: 3,
    SELECT: 4,
    SLIDER: 5,
    COMPONENT: 6,
    CUSTOM: 7
};
function definePluginSettings(def) {
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
                version: "0.0.8",
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
            version: "0.0.8",
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
const Settings = new SettingsStoreService();
const SettingsStore = Settings;
const PlainSettings = Settings.plain;

// --- Module: src/core/Patcher.js ---
/**
 * VencordForAndroid v0.0.4 - Metro / Webpack Module Engine & Runtime Patcher
 * Combines Vendicated/Vencord's patchWebpack.ts with Discord Android's Metro (__r / modules) lookup.
 */

class PatcherAndModuleEngine {
    constructor() {
        this.patches = new Map();
        this.declarativePatches = [];
        this.waitSubscriptions = new Set();
        this._commonCache = {};
        this._hookModuleLoaders();
    }

    // --- 1. Runtime Method Patching (before / instead / after) ---
    _patch(type, callerId, target, method, callback) {
        if (!target || typeof target[method] !== "function") {
            return () => {};
        }

        const original = target[method];
        const wrapped = function (...args) {
            if (type === "before") {
                try {
                    const newArgs = callback(args, this);
                    if (Array.isArray(newArgs)) {
                        return original.apply(this, newArgs);
                    }
                } catch (err) {
                    console.error(`[VencordForAndroid:Patcher] Error in before patch (${callerId}.${method}):`, err);
                }
                return original.apply(this, args);
            }

            if (type === "instead") {
                try {
                    return callback(args, original.bind(this), this);
                } catch (err) {
                    console.error(`[VencordForAndroid:Patcher] Error in instead patch (${callerId}.${method}):`, err);
                    return original.apply(this, args);
                }
            }

            const res = original.apply(this, args);
            try {
                const modified = callback(args, res, this);
                return modified !== undefined ? modified : res;
            } catch (err) {
                console.error(`[VencordForAndroid:Patcher] Error in after patch (${callerId}.${method}):`, err);
                return res;
            }
        };

        wrapped.__vencordOriginal = original;
        target[method] = wrapped;

        const unpatch = () => {
            if (target[method] === wrapped) {
                target[method] = original;
            }
            this.patches.get(callerId)?.delete(unpatch);
        };

        if (!this.patches.has(callerId)) {
            this.patches.set(callerId, new Set());
        }
        this.patches.get(callerId).add(unpatch);
        return unpatch;
    }

    before(callerId, target, method, callback) {
        return this._patch("before", callerId, target, method, callback);
    }

    instead(callerId, target, method, callback) {
        return this._patch("instead", callerId, target, method, callback);
    }

    after(callerId, target, method, callback) {
        return this._patch("after", callerId, target, method, callback);
    }

    unpatchAll(callerId) {
        if (callerId) {
            const set = this.patches.get(callerId);
            if (set) {
                for (const unpatch of Array.from(set)) unpatch();
                this.patches.delete(callerId);
            }
            return;
        }
        for (const id of Array.from(this.patches.keys())) {
            this.unpatchAll(id);
        }
    }

    // --- 2. Vencord Declarative Patches (patches: [{ find, replacement: { match, replace } }]) ---
    addDeclarativePatch(patchDef, pluginName) {
        this.declarativePatches.push({
            ...patchDef,
            plugin: pluginName,
            replacement: Array.isArray(patchDef.replacement) ? patchDef.replacement : [patchDef.replacement]
        });
    }

    // --- 3. Discord Metro (React Native Android) & Webpack Module Discovery ---
    attachToMetroRequire() {
        this._hookModuleLoaders();
    }

    _hookModuleLoaders() {
        if (typeof globalThis === "undefined") return;

        // Hook Discord Android React Native Metro require (__r) if present and not yet hooked
        if (typeof globalThis.__r === "function" && !globalThis.__r.__vencordHooked) {
            const origRequire = globalThis.__r;
            const self = this;
            const hookedRequire = function (moduleId) {
                const exports = origRequire.apply(this, arguments);
                if (exports) {
                    self._notifyWaiters(exports);
                }
                return exports;
            };
            hookedRequire.__vencordHooked = true;
            try {
                Object.assign(hookedRequire, origRequire);
            } catch (_) {}
            try {
                Object.defineProperty(globalThis, "__r", {
                    configurable: true,
                    writable: true,
                    value: hookedRequire
                });
            } catch (_) {
                globalThis.__r = hookedRequire;
            }
        }
    }

    _notifyWaiters(exports) {
        if (this.waitSubscriptions.size === 0) return;
        for (const sub of Array.from(this.waitSubscriptions)) {
            try {
                if (sub.filter(exports)) {
                    this.waitSubscriptions.delete(sub);
                    sub.callback(exports);
                } else if (exports?.default && sub.filter(exports.default)) {
                    this.waitSubscriptions.delete(sub);
                    sub.callback(exports.default);
                }
            } catch (_) {}
        }
    }

    _getModuleList() {
        const list = [];
        try {
            // 1. React Native Metro modules map (Discord Android com.discord)
            if (typeof globalThis !== "undefined" && globalThis.modules) {
                const modulesMap = globalThis.modules instanceof Map
                    ? Object.fromEntries(globalThis.modules)
                    : globalThis.modules;
                for (const key of Object.keys(modulesMap)) {
                    const mod = modulesMap[key];
                    if (mod?.isInitialized && mod?.publicModule?.exports) {
                        list.push(mod.publicModule.exports);
                    } else if (mod?.exports) {
                        list.push(mod.exports);
                    }
                }
            }
            // 2. Webpack chunk cache fallback
            if (typeof window !== "undefined" && Array.isArray(window.webpackChunkdiscord_app)) {
                let wpRequire = this._wpRequire;
                if (!wpRequire) {
                    window.webpackChunkdiscord_app.push([
                        [Symbol("VencordForAndroid")],
                        {},
                        (req) => {
                            wpRequire = req;
                        }
                    ]);
                    window.webpackChunkdiscord_app.pop();
                    this._wpRequire = wpRequire;
                }
                if (wpRequire?.c) {
                    for (const mod of Object.values(wpRequire.c)) {
                        if (mod?.exports) list.push(mod.exports);
                    }
                }
            }
        } catch (_) {}
        return list;
    }

    /**
     * Safely initializes and searches uninitialized Metro modules inside com.discord
     * (exact ErrorUtils-guarded technique from revenge-bundle/src/metro/internals/modules.ts)
     */
    findDeepInMetro(filterFn) {
        const quick = this.find(filterFn);
        if (quick) return quick;
        if (typeof globalThis === "undefined" || !globalThis.modules || typeof globalThis.__r !== "function") {
            return null;
        }
        const modulesMap = globalThis.modules instanceof Map
            ? Object.fromEntries(globalThis.modules)
            : globalThis.modules;
        const origErrHandler = globalThis.ErrorUtils?.getGlobalHandler?.();
        try {
            if (globalThis.ErrorUtils?.setGlobalHandler) {
                globalThis.ErrorUtils.setGlobalHandler(() => {});
            }
            for (const key of Object.keys(modulesMap)) {
                if (key === "0") continue;
                const mod = modulesMap[key];
                if (!mod || mod.hasError) continue;
                try {
                    const exp = mod.isInitialized ? mod.publicModule?.exports : globalThis.__r(Number(key));
                    if (!exp) continue;
                    if (filterFn(exp)) return exp;
                    if (exp.default && filterFn(exp.default)) return exp.default;
                } catch (_) {}
            }
        } finally {
            if (origErrHandler && globalThis.ErrorUtils?.setGlobalHandler) {
                globalThis.ErrorUtils.setGlobalHandler(origErrHandler);
            }
        }
        return null;
    }

    find(filterFn) {
        if (typeof filterFn !== "function") return null;
        for (const exp of this._getModuleList()) {
            if (!exp) continue;
            try {
                if (filterFn(exp)) return exp;
                if (exp.default && filterFn(exp.default)) return exp.default;
            } catch (_) {}
        }
        return null;
    }

    findByProps(...props) {
        return this.find((m) => (typeof m === "object" || typeof m === "function") && props.every((p) => p in m));
    }

    findByPropsLazy(...props) {
        let cached = null;
        const self = this;
        return new Proxy(function () {}, {
            get(_target, prop) {
                if (!cached) cached = self.findByProps(...props);
                return cached ? cached[prop] : undefined;
            },
            set(_target, prop, value) {
                if (!cached) cached = self.findByProps(...props);
                if (cached) cached[prop] = value;
                return true;
            }
        });
    }

    findByName(name, defaultExport = true) {
        const mod = this.find((m) => m && (m.displayName === name || m.name === name));
        return mod;
    }

    findByStoreName(storeName) {
        return this.find((m) => m && typeof m.getName === "function" && m.getName() === storeName);
    }

    findAssetId(assetName) {
        const AssetsRegistry = this.findByProps("registerAsset", "getAssetByID");
        if (!AssetsRegistry) return null;
        for (let id = 1; id < 8000; id++) {
            const asset = AssetsRegistry.getAssetByID(id);
            if (!asset) continue;
            if (asset.name === assetName) return id;
        }
        return null;
    }

    waitFor(filterOrProps, callback) {
        this._hookModuleLoaders();

        const filter = Array.isArray(filterOrProps)
            ? (m) => m && (typeof m === "object" || typeof m === "function") && filterOrProps.every((p) => p in m)
            : typeof filterOrProps === "string"
                ? (m) => m && (typeof m === "object" || typeof m === "function") && (filterOrProps in m || m.displayName === filterOrProps || m.name === filterOrProps)
                : filterOrProps;

        const existing = this.find(filter);
        if (existing) {
            callback(existing);
            return;
        }
        const sub = { filter, callback };
        this.waitSubscriptions.add(sub);

        // Keep polling gently once React Native polyfills setInterval
        if (typeof setInterval === "function") {
            const timer = setInterval(() => {
                if (!this.waitSubscriptions.has(sub)) {
                    clearInterval(timer);
                    return;
                }
                const found = this.find(filter);
                if (found) {
                    this.waitSubscriptions.delete(sub);
                    clearInterval(timer);
                    callback(found);
                }
            }, 750);
        }
    }

    get Common() {
        const self = this;
        return {
            get React() {
                return self._commonCache.React || (self._commonCache.React = self.findByProps("createElement", "useState", "useEffect") || globalThis.React);
            },
            get ReactNative() {
                return self._commonCache.ReactNative || (self._commonCache.ReactNative = self.findByProps("View", "Text", "ScrollView", "TouchableOpacity") || globalThis.ReactNative);
            },
            get FluxDispatcher() {
                return self._commonCache.FluxDispatcher || (self._commonCache.FluxDispatcher = self.findByProps("_dispatch", "dispatch", "subscribe"));
            },
            get NavigationNative() {
                return self._commonCache.NavigationNative || (self._commonCache.NavigationNative = self.findByProps("useNavigation", "NavigationContainer"));
            },
            get SettingsRouter() {
                return self._commonCache.SettingsRouter || (self._commonCache.SettingsRouter = self.findByProps("open", "saveAccountChanges") || self.findByProps("openUserSettings"));
            },
            get Toasts() {
                return self._commonCache.Toasts || (self._commonCache.Toasts = self.findByProps("open", "close", "show"));
            },
            get Clipboard() {
                return self._commonCache.Clipboard || (self._commonCache.Clipboard = self.findByProps("setString", "getString") || self.findByProps("copy"));
            }
        };
    }
}
const Patcher = new PatcherAndModuleEngine();
const Webpack = Patcher;
const Metro = Patcher;

// --- Module: src/core/PluginManager.js ---
/**
 * VencordForAndroid v0.0.4 - PluginManager & Internal Plugin APIs
 * Follows Vendicated/Vencord/src/api/PluginManager.ts (Flux events, MessageEventsAPI, CommandsAPI, Patches, Settings).
 */
function definePlugin(definition) {
    const options = definition.options || (definition.settings?.def) || {};
    return {
        name: definition.name,
        description: definition.description || "",
        authors: definition.authors || [{ name: "Vendicated" }, { name: "juli22292" }],
        tags: definition.tags || ["Utility"],
        version: definition.version || "0.0.4",
        required: Boolean(definition.required),
        isDependency: Boolean(definition.isDependency),
        dependencies: definition.dependencies || [],
        enabledByDefault: Boolean(definition.enabledByDefault || definition.required),
        hasSettings: Object.keys(options).length > 0,
        options,
        settings: definition.settings || null,
        patches: definition.patches || [],
        flux: definition.flux || null,
        commands: definition.commands || [],
        onBeforeMessageSend: definition.onBeforeMessageSend || null,
        onBeforeMessageEdit: definition.onBeforeMessageEdit || null,
        start: definition.start || null,
        stop: definition.stop || null,
        started: false
    };
}

class PluginManagerService {
    constructor() {
        this.plugins = {};
        this.registry = new Map();
        this.running = new Set();
        this.fluxUnsubscribers = new Map();
        this.preSendListeners = new Map();
        this.preEditListeners = new Map();
        this._messageEventsHooked = false;
    }

    register(plugin) {
        if (!plugin || !plugin.name) return;
        this.plugins[plugin.name] = plugin;
        this.registry.set(plugin.name, plugin);

        if (plugin.settings) {
            plugin.settings.pluginName = plugin.name;
        }

        const defaultOptions = {};
        if (plugin.options) {
            for (const [key, opt] of Object.entries(plugin.options)) {
                defaultOptions[key] = opt.default;
            }
        }

        Settings.getPluginConfig(plugin.name, {
            enabledByDefault: plugin.enabledByDefault || plugin.required,
            defaultOptions
        });
    }

    registerAll(pluginList) {
        const sorted = [...pluginList].sort((a, b) => a.name.localeCompare(b.name));
        for (const p of sorted) {
            this.register(p);
        }
    }

    getAllPlugins() {
        return Array.from(this.registry.values()).map((plugin) => {
            const cfg = Settings.getPluginConfig(plugin.name);
            return {
                ...plugin,
                enabled: Boolean(plugin.required || cfg.enabled),
                running: this.running.has(plugin.name),
                optionValues: { ...(cfg.options || {}) }
            };
        });
    }

    getPlugin(name) {
        return this.registry.get(name) || null;
    }

    isPluginEnabled(name) {
        const plugin = this.getPlugin(name);
        if (!plugin) return false;
        if (plugin.required || plugin.isDependency) return true;
        return Boolean(Settings.getPluginConfig(name).enabled);
    }

    isEnabled(name) {
        return this.isPluginEnabled(name);
    }

    _ensureMessageEventsHooked() {
        if (this._messageEventsHooked) return;
        const MessageActions = Patcher.findByProps("sendMessage", "editMessage");
        if (!MessageActions) return;

        this._messageEventsHooked = true;
        Patcher.before("VencordMessageEventsAPI", MessageActions, "sendMessage", (args) => {
            const [channelId, messageObj] = args;
            if (messageObj && typeof messageObj === "object") {
                for (const listener of this.preSendListeners.values()) {
                    try {
                        listener(channelId, messageObj);
                    } catch (e) {
                        console.error("[VencordForAndroid:MessageEventsAPI] PreSend listener error:", e);
                    }
                }
            }
            return args;
        });

        Patcher.before("VencordMessageEventsAPI", MessageActions, "editMessage", (args) => {
            const [channelId, messageId, messageObj] = args;
            if (messageObj && typeof messageObj === "object") {
                for (const listener of this.preEditListeners.values()) {
                    try {
                        listener(channelId, messageId, messageObj);
                    } catch (e) {
                        console.error("[VencordForAndroid:MessageEventsAPI] PreEdit listener error:", e);
                    }
                }
            }
            return args;
        });
    }

    initPluginManager() {
        // Resolve dependencies and register declarative patches for enabled plugins
        for (const plugin of this.registry.values()) {
            if (!this.isPluginEnabled(plugin.name)) continue;

            if (Array.isArray(plugin.dependencies)) {
                for (const depName of plugin.dependencies) {
                    const dep = this.getPlugin(depName);
                    if (dep) {
                        dep.isDependency = true;
                        Settings.setPluginEnabled(depName, true);
                    }
                }
            }

            if (Array.isArray(plugin.patches)) {
                for (const patch of plugin.patches) {
                    Patcher.addDeclarativePatch(patch, plugin.name);
                }
            }
        }
    }

    startAllEnabled() {
        this.initPluginManager();

        if (Settings.get("safeMode")) {
            console.warn("[VencordForAndroid] Safe Mode active: starting required core plugins only.");
        }

        for (const plugin of this.registry.values()) {
            const shouldStart = plugin.required || (!Settings.get("safeMode") && this.isPluginEnabled(plugin.name));
            if (shouldStart) {
                this.startPlugin(plugin.name);
            }
        }
    }

    startPlugin(nameOrPlugin) {
        const plugin = typeof nameOrPlugin === "string" ? this.getPlugin(nameOrPlugin) : nameOrPlugin;
        if (!plugin || this.running.has(plugin.name)) return false;

        try {
            const cfg = Settings.getPluginConfig(plugin.name);
            const context = {
                settings: cfg.options || {},
                patcher: Patcher,
                webpack: Patcher,
                metro: Patcher,
                setOption: (k, v) => Settings.setPluginOption(plugin.name, k, v)
            };

            if (typeof plugin.start === "function") {
                plugin.start(context);
            }

            // Auto-subscribe FluxDispatcher events like official Vencord
            if (plugin.flux && typeof plugin.flux === "object") {
                const FluxDispatcher = Patcher.Common.FluxDispatcher;
                if (FluxDispatcher && typeof FluxDispatcher.subscribe === "function") {
                    const unsubs = [];
                    for (const [eventName, handler] of Object.entries(plugin.flux)) {
                        if (typeof handler === "function") {
                            const bound = handler.bind(plugin);
                            FluxDispatcher.subscribe(eventName, bound);
                            unsubs.push(() => FluxDispatcher.unsubscribe(eventName, bound));
                        }
                    }
                    this.fluxUnsubscribers.set(plugin.name, unsubs);
                }
            }

            if (typeof plugin.onBeforeMessageSend === "function") {
                this._ensureMessageEventsHooked();
                this.preSendListeners.set(plugin.name, plugin.onBeforeMessageSend.bind(plugin));
            }

            if (typeof plugin.onBeforeMessageEdit === "function") {
                this._ensureMessageEventsHooked();
                this.preEditListeners.set(plugin.name, plugin.onBeforeMessageEdit.bind(plugin));
            }

            plugin.started = true;
            this.running.add(plugin.name);
            Settings.setPluginEnabled(plugin.name, true);
            return true;
        } catch (err) {
            console.error(`[VencordForAndroid:PluginManager] Failed to start ${plugin.name}:`, err);
            return false;
        }
    }

    stopPlugin(nameOrPlugin) {
        const plugin = typeof nameOrPlugin === "string" ? this.getPlugin(nameOrPlugin) : nameOrPlugin;
        if (!plugin || plugin.required) return false;

        try {
            if (this.running.has(plugin.name)) {
                if (typeof plugin.stop === "function") {
                    plugin.stop({ patcher: Patcher });
                }
                Patcher.unpatchAll(plugin.name);

                const unsubs = this.fluxUnsubscribers.get(plugin.name);
                if (unsubs) {
                    for (const u of unsubs) u();
                    this.fluxUnsubscribers.delete(plugin.name);
                }

                this.preSendListeners.delete(plugin.name);
                this.preEditListeners.delete(plugin.name);
                plugin.started = false;
                this.running.delete(plugin.name);
            }
            Settings.setPluginEnabled(plugin.name, false);
            return true;
        } catch (err) {
            console.error(`[VencordForAndroid:PluginManager] Failed to stop ${plugin.name}:`, err);
            return false;
        }
    }

    togglePlugin(name) {
        if (this.isPluginEnabled(name)) {
            return this.stopPlugin(name);
        }
        return this.startPlugin(name);
    }

    stopAll() {
        for (const name of Array.from(this.running)) {
            const p = this.getPlugin(name);
            if (p && !p.required) {
                this.stopPlugin(name);
            }
        }
    }

    uninstallAll() {
        for (const name of Array.from(this.running)) {
            const p = this.getPlugin(name);
            if (p && typeof p.stop === "function") {
                try {
                    p.stop({ patcher: Patcher });
                } catch (_) {}
            }
            Patcher.unpatchAll(name);
        }
        this.running.clear();
        this.fluxUnsubscribers.clear();
        this.preSendListeners.clear();
        this.preEditListeners.clear();
        Patcher.unpatchAll();
        Settings.wipeAll();
        this.registry.clear();
    }
}
const PluginManager = new PluginManagerService();

// --- Module: src/core/Updater.js ---
/**
 * VencordForAndroid v0.0.4 - In-App Updater
 * Follows Vendicated/Vencord/src/utils/updater.ts and Vencord/Vendroid/VencordUpdater.java
 * Pulls updates exclusively from https://github.com/juli22292/vencordforandroid
 */
const CORE_VERSION = "0.0.8";
const MIN_REQUIRED_VERSION = "0.0.2";
const CORRUPTED_VERSIONS = ["0.0.1"];
const CORE_REPO = "juli22292/vencordforandroid";
const INSTALLER_REPO = "juli22292/vencordandroidapp";
const CORE_RELEASES_API = `https://api.github.com/repos/${CORE_REPO}/releases/latest`;
const CORE_MANIFEST_URL = `https://raw.githubusercontent.com/${CORE_REPO}/main/dist/manifest.json`;
const CORE_BUNDLE_URL = `https://raw.githubusercontent.com/${CORE_REPO}/main/dist/vencordforandroid.js`;

class UpdaterService {
    constructor() {
        this.lastCheck = null;
        this.latestVersion = CORE_VERSION;
        this.latestHash = "main";
        this.updateAvailable = false;
        this.hasPendingRestart = false;
        this.changes = [];
        this.corruptedVersions = [...CORRUPTED_VERSIONS];
        this.releaseNotes = "";
        this.downloadUrl = CORE_BUNDLE_URL;
        this.status = "idle";
        this.errorMessage = null;
    }

    compareVersions(current, remote) {
        const clean = (v) => String(v || "0.0.0").replace(/^v/i, "").split(".").map((n) => parseInt(n, 10) || 0);
        const a = clean(current);
        const b = clean(remote);
        const len = Math.max(a.length, b.length);
        for (let i = 0; i < len; i++) {
            const av = a[i] || 0;
            const bv = b[i] || 0;
            if (bv > av) return 1;
            if (bv < av) return -1;
        }
        return 0;
    }

    isVersionCorrupted(versionStr) {
        const cleanVer = String(versionStr || "").replace(/^v/i, "").trim();
        if (this.corruptedVersions.includes(cleanVer)) return true;
        if (this.compareVersions(cleanVer, MIN_REQUIRED_VERSION) > 0) return true;
        return false;
    }

    async checkForUpdates() {
        this.status = "checking";
        this.errorMessage = null;

        try {
            let remoteVersion = CORE_VERSION;
            let notes = "";
            let bundleUrl = CORE_BUNDLE_URL;

            try {
                const manifestRes = await fetch(CORE_MANIFEST_URL, { cache: "no-store" });
                if (manifestRes.ok) {
                    const manifest = await manifestRes.json();
                    if (Array.isArray(manifest.corruptedVersions)) {
                        this.corruptedVersions = manifest.corruptedVersions;
                    }
                    remoteVersion = manifest.version || CORE_VERSION;
                    this.latestHash = (manifest.sha256 || "main").slice(0, 7);
                    notes = manifest.changelog || "";
                    bundleUrl = manifest.rawBundleUrl || CORE_BUNDLE_URL;
                }
            } catch (_) {}

            const releaseRes = await fetch(CORE_RELEASES_API, {
                headers: { Accept: "application/vnd.github+json" }
            });

            if (releaseRes.ok) {
                const releaseData = await releaseRes.json();
                remoteVersion = (releaseData.tag_name || releaseData.name || remoteVersion).replace(/^v/i, "");
                notes = releaseData.body || notes;
                const asset = (releaseData.assets || []).find((a) => a.name === "vencordforandroid.js");
                if (asset && asset.browser_download_url) {
                    bundleUrl = asset.browser_download_url;
                }
            }

            this.lastCheck = new Date().toISOString();
            this.latestVersion = remoteVersion;
            this.releaseNotes = notes;
            this.downloadUrl = bundleUrl;
            this.updateAvailable = this.compareVersions(CORE_VERSION, remoteVersion) > 0;
            this.status = this.updateAvailable ? "update-available" : "up-to-date";

            return {
                currentVersion: CORE_VERSION,
                latestVersion: this.latestVersion,
                latestHash: this.latestHash,
                updateAvailable: this.updateAvailable,
                releaseNotes: this.releaseNotes,
                downloadUrl: this.downloadUrl,
                repository: CORE_REPO
            };
        } catch (err) {
            this.status = "error";
            this.errorMessage = err?.message || "Failed to fetch updates from GitHub";
            return {
                currentVersion: CORE_VERSION,
                latestVersion: this.latestVersion,
                updateAvailable: false,
                error: this.errorMessage,
                repository: CORE_REPO
            };
        }
    }

    async downloadAndApplyUpdate() {
        this.status = "downloading";
        try {
            const res = await fetch(this.downloadUrl, { cache: "no-store" });
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }
            const bundleCode = await res.text();

            if (typeof globalThis !== "undefined") {
                if (globalThis.__VENCORD_NATIVE_BRIDGE__?.saveBundleUpdate) {
                    await globalThis.__VENCORD_NATIVE_BRIDGE__.saveBundleUpdate(bundleCode, this.latestVersion);
                } else if (globalThis.mmkvStorage) {
                    globalThis.mmkvStorage.set("VencordForAndroid_CachedBundle", bundleCode);
                    globalThis.mmkvStorage.set("VencordForAndroid_CachedVersion", this.latestVersion);
                } else if (globalThis.localStorage) {
                    globalThis.localStorage.setItem("VencordForAndroid_CachedBundle", bundleCode);
                    globalThis.localStorage.setItem("VencordForAndroid_CachedVersion", this.latestVersion);
                }
            }

            Settings.set("version", this.latestVersion);
            this.updateAvailable = false;
            this.hasPendingRestart = true;
            this.status = "up-to-date";

            return {
                success: true,
                installedVersion: this.latestVersion
            };
        } catch (err) {
            this.status = "error";
            this.errorMessage = err?.message || "Update installation failed";
            return {
                success: false,
                error: this.errorMessage
            };
        }
    }
}
const Updater = new UpdaterService();

// --- Module: src/plugins/builtinPlugins.js ---
/**
 * VencordForAndroid - Official Vencord Plugins Ported & Adapted for Android
 * Source: https://github.com/Vendicated/Vencord/tree/main/src/plugins
 * Adapted for Android by juli22292
 */
const AccountPanelServerProfile = definePlugin({
    name: "AccountPanelServerProfile",
    description: "Right click your account panel in the bottom left to view your profile in the current server",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Appearance", "Guilds"],
    enabledByDefault: false,
    options: {
        prioritizeServerProfile: {
            type: "boolean",
            label: "Prioritize Server Profile when tapping your account panel",
            default: false
        }
    }
});
const AddAttachments = definePlugin({
    name: "AddAttachments",
    description: "Allows you to add new attachments while editing messages",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Chat", "Messages"],
    enabledByDefault: false
});
const AlwaysAnimate = definePlugin({
    name: "AlwaysAnimate",
    description: "Animates anything that can be animated",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Appearance", "Media"],
    enabledByDefault: true,
    start({ patcher }) {
        const ImageResolver = patcher.findByProps("getUserAvatarURL", "getGuildIconURL");
        if (ImageResolver) {
            if (typeof ImageResolver.getUserAvatarURL === "function") {
                patcher.before("AlwaysAnimate", ImageResolver, "getUserAvatarURL", (args) => {
                    if (args.length >= 2) args[1] = true;
                    return args;
                });
            }
            if (typeof ImageResolver.getGuildIconURL === "function") {
                patcher.before("AlwaysAnimate", ImageResolver, "getGuildIconURL", (args) => {
                    if (args[0] && typeof args[0] === "object") {
                        args[0] = { ...args[0], canAnimate: true };
                    }
                    return args;
                });
            }
        }
    }
});
const AlwaysExpandRoles = definePlugin({
    name: "AlwaysExpandRoles",
    description: "Always expands the role list in profile popouts",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Appearance", "Guilds"],
    enabledByDefault: true
});
const AlwaysTrust = definePlugin({
    name: "AlwaysTrust",
    description: "Removes the annoying untrusted domain and suspicious file popup",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Utility", "Chat"],
    enabledByDefault: false,
    options: {
        domain: {
            type: "boolean",
            label: "Trust all external domains without confirmation popup",
            default: true
        },
        file: {
            type: "boolean",
            label: "Trust all downloaded file extensions",
            default: true
        },
        noDeleteSafety: {
            type: "boolean",
            label: "Skip delete server confirmation prompt",
            default: false
        }
    },
    start({ patcher }) {
        const MaskedLinkStore = patcher.findByProps("isTrustedDomain");
        if (MaskedLinkStore && typeof MaskedLinkStore.isTrustedDomain === "function") {
            patcher.instead("AlwaysTrust", MaskedLinkStore, "isTrustedDomain", () => true);
        }
    }
});
const AnonymiseFileNames = definePlugin({
    name: "AnonymiseFileNames",
    description: "Anonymise uploaded file names",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Privacy", "Media"],
    enabledByDefault: true,
    options: {
        method: {
            type: "select",
            label: "Anonymising method",
            choices: ["Random Characters", "Timestamp", "Custom Name"],
            default: "Random Characters"
        },
        randomisedLength: {
            type: "select",
            label: "Random characters length",
            choices: ["6", "8", "12", "16"],
            default: "8"
        },
        consistent: {
            type: "boolean",
            label: "Consistent filenames for identical hashes",
            default: true
        }
    }
});
const AppleMusicRichPresence = definePlugin({
    name: "AppleMusicRichPresence",
    description: "Discord rich presence for your Apple Music status on Android",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Media", "Utility"],
    enabledByDefault: false,
    options: {
        refreshInterval: { type: "select", label: "Refresh interval (seconds)", choices: ["5", "10", "15"], default: "10" }
    }
});
const AutomodContext = definePlugin({
    name: "AutomodContext",
    description: "Allows you to jump to the message surrounding an Automod hit",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Guilds", "Messages"],
    enabledByDefault: false
});
const BetterFolders = definePlugin({
    name: "BetterFolders",
    description: "Shows server folders on dedicated sidebar and allows auto-closing folders",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Appearance", "Guilds"],
    enabledByDefault: false,
    options: {
        closeAllFolders: { type: "boolean", label: "Close all folders on startup", default: false },
        closeOthers: { type: "boolean", label: "Close other folders when opening a folder", default: true },
        forceOpen: { type: "boolean", label: "Force open folder of selected server", default: true }
    }
});
const BetterGifAltText = definePlugin({
    name: "BetterGifAltText",
    description: "Change GIF alt text from simply being 'GIF' to containing the GIF's tags/title",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Media", "Appearance"],
    enabledByDefault: false
});
const BetterGifPicker = definePlugin({
    name: "BetterGifPicker",
    description: "Makes the gif picker open the favorite category by default",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Media", "Chat"],
    enabledByDefault: true
});
const BetterNotesBox = definePlugin({
    name: "BetterNotesBox",
    description: "Hide notes or disable spellcheck in user profile notes",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Appearance", "Utility"],
    enabledByDefault: false,
    options: {
        hide: { type: "boolean", label: "Hide the notes box in user profiles", default: false },
        noSpellCheck: { type: "boolean", label: "Disable spellcheck in notes", default: true }
    }
});
const BetterRoleContext = definePlugin({
    name: "BetterRoleContext",
    description: "Adds options to copy role color / ID / icon when tapping a role in profile popouts",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Guilds", "Utility"],
    enabledByDefault: true,
    options: {
        roleIconFileFormat: { type: "select", label: "Role icon format", choices: ["png", "webp"], default: "png" }
    }
});
const BetterRoleDot = definePlugin({
    name: "BetterRoleDot",
    description: "Copy role colour on RoleDot click and use both RoleDot and coloured names simultaneously",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Appearance", "Guilds"],
    enabledByDefault: false,
    options: {
        bothStyles: { type: "boolean", label: "Show both RoleDot and coloured usernames", default: true },
        copyRoleColorInProfilePopout: { type: "boolean", label: "Tap RoleDot to copy hex color", default: true }
    }
});
const BetterSessions = definePlugin({
    name: "BetterSessions",
    description: "Enhances the active sessions (Devices) page with custom device names and notifications",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Privacy", "Notifications"],
    enabledByDefault: true,
    options: {
        backgroundCheck: { type: "boolean", label: "Check for new unknown logins in background", default: true }
    }
});
const BetterSettings = definePlugin({
    name: "BetterSettings",
    description: "Enhances your settings menu opening speed and navigation experience",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Appearance", "Shortcuts"],
    enabledByDefault: true,
    options: {
        disableFade: { type: "boolean", label: "Disable slow fade animation on settings open", default: true },
        eagerLoad: { type: "boolean", label: "Eagerly preload all settings tabs", default: true }
    }
});
const BetterUploadButton = definePlugin({
    name: "BetterUploadButton",
    description: "Upload with a single tap instead of opening the attachment menu",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Chat", "Shortcuts"],
    enabledByDefault: false
});
const BiggerStreamPreview = definePlugin({
    name: "BiggerStreamPreview",
    description: "This plugin allows you to enlarge stream previews in voice channels",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Voice", "Media"],
    enabledByDefault: true
});
const BlurNSFW = definePlugin({
    name: "BlurNSFW",
    description: "Blur attachments in NSFW channels until you tap them",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Privacy", "Media"],
    enabledByDefault: false,
    options: {
        blurAmount: { type: "select", label: "Blur radius (px)", choices: ["5", "10", "20", "30"], default: "10" }
    }
});
const CallTimer = definePlugin({
    name: "CallTimer",
    description: "Adds a live duration timer to any voice call or voice channel",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Voice", "Utility"],
    enabledByDefault: true,
    options: {
        format: { type: "select", label: "Timer Format", choices: ["stopwatch", "human"], default: "stopwatch" }
    }
});
const ClearURLs = definePlugin({
    name: "ClearURLs",
    description: "Removes tracking garbage (utm_*, fbclid, si, igshid) from URLs before sending",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Privacy", "Chat"],
    enabledByDefault: true,
    start({ patcher }) {
        const TRACKING_PARAMS = [/^utm_/i, /^fbclid$/i, /^gclid$/i, /^igshid$/i, /^si$/i, /^mc_eid$/i, /^_hsenc$/i];
        const cleanTextUrls = (content) => {
            if (typeof content !== "string" || !content.includes("http")) return content;
            return content.replace(/https?:\/\/[^\s<>]+/g, (rawUrl) => {
                try {
                    const url = new URL(rawUrl);
                    for (const key of Array.from(url.searchParams.keys())) {
                        if (TRACKING_PARAMS.some((rx) => rx.test(key))) url.searchParams.delete(key);
                    }
                    return url.toString();
                } catch {
                    return rawUrl;
                }
            });
        };
        const MessageActions = patcher.findByProps("sendMessage", "editMessage");
        if (MessageActions && typeof MessageActions.sendMessage === "function") {
            patcher.before("ClearURLs", MessageActions, "sendMessage", (args) => {
                if (args[1] && typeof args[1].content === "string") {
                    args[1].content = cleanTextUrls(args[1].content);
                }
                return args;
            });
        }
    }
});
const ClientTheme = definePlugin({
    name: "ClientTheme",
    description: "Recreation of the old Discord client theme experiment with custom hex color picker",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Appearance"],
    enabledByDefault: false,
    options: {
        color: { type: "select", label: "Accent Color Hex", choices: ["#313338", "#1e1f22", "#5865f2", "#111214", "#23a55a"], default: "#313338" }
    }
});
const ColorSighted = definePlugin({
    name: "ColorSighted",
    description: "Removes the colorblind-friendly icons from status indicators, leaving pure round status dots",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Appearance"],
    enabledByDefault: false
});
const ConsoleJanitor = definePlugin({
    name: "ConsoleJanitor",
    description: "Disables annoying console logs and warnings from Discord internals",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Utility"],
    enabledByDefault: false,
    options: {
        disableLoggers: { type: "boolean", label: "Disable verbose Discord loggers", default: true },
        disableSpotifyLogger: { type: "boolean", label: "Disable Spotify polling logs", default: true }
    }
});
const ConsoleShortcuts = definePlugin({
    name: "ConsoleShortcuts",
    description: "Adds shorter aliases for common debugging functions on the global window object",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Utility"],
    enabledByDefault: false
});
const CopyEmojiMarkdown = definePlugin({
    name: "CopyEmojiMarkdown",
    description: "Allows you to copy the raw markdown (<:name:id>) of an emoji from its popout",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Chat", "Utility"],
    enabledByDefault: true,
    options: {
        copyUnicode: { type: "boolean", label: "Copy unicode character for standard emojis", default: true }
    }
});
const CopyFileContents = definePlugin({
    name: "CopyFileContents",
    description: "Adds a button to text file attachments to copy their contents to clipboard",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Chat", "Utility"],
    enabledByDefault: true
});
const CopyUserURLs = definePlugin({
    name: "CopyUserURLs",
    description: "Adds a 'Copy User URL' (<https://discord.com/users/id>) entry to user profiles",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Friends", "Utility"],
    enabledByDefault: true
});
const CrashHandler = definePlugin({
    name: "CrashHandler",
    description: "Utility plugin for handling and recovering from Discord UI crashes without restarting",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Utility"],
    enabledByDefault: true,
    options: {
        attemptToPreventCrashes: { type: "boolean", label: "Attempt to recover React tree without reloading", default: true },
        attemptToNavigateToHome: { type: "boolean", label: "Navigate to Home DM tab on fatal channel crash", default: false }
    }
});
const CtrlEnterSend = definePlugin({
    name: "CtrlEnterSend",
    description: "Customize how the Enter / Send key behaves when typing messages",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Chat", "Shortcuts"],
    enabledByDefault: false,
    options: {
        submitRule: { type: "select", label: "Submit rule", choices: ["ctrl+enter", "shift+enter", "enter"], default: "ctrl+enter" }
    }
});
const CustomIdle = definePlugin({
    name: "CustomIdle",
    description: "Allows you to set a custom idle timeout or disable auto-idle completely",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Utility", "Privacy"],
    enabledByDefault: false,
    options: {
        idleTimeout: { type: "select", label: "Idle timeout (minutes, 0 = disabled)", choices: ["0", "5", "10", "30", "60"], default: "10" },
        remainInIdle: { type: "boolean", label: "Remain in auto-idle until manually confirmed", default: true }
    }
});
const CustomRPC = definePlugin({
    name: "CustomRPC",
    description: "Add a fully customisable Rich Presence (Game / Stream / Listening status) to your Discord profile",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Appearance", "Utility"],
    enabledByDefault: false,
    options: {
        appName: { type: "select", label: "Application Name", choices: ["VencordForAndroid", "Visual Studio Code", "Spotify", "Custom"], default: "VencordForAndroid" },
        type: { type: "select", label: "Activity Type", choices: ["Playing", "Streaming", "Listening", "Watching", "Competing"], default: "Playing" }
    }
});
const Dearrow = definePlugin({
    name: "Dearrow",
    description: "Makes YouTube video titles and thumbnails less clickbaity using CrowdSourced DeArrow data",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Media", "Appearance"],
    enabledByDefault: false,
    options: {
        hideButton: { type: "boolean", label: "Hide the DeArrow toggle button on embeds", default: false },
        replaceElements: { type: "select", label: "Elements to replace", choices: ["Everything", "Titles Only", "Thumbnails Only"], default: "Everything" }
    }
});
const Decor = definePlugin({
    name: "Decor",
    description: "Create and use custom avatar decorations for free with other Vencord users",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Appearance"],
    enabledByDefault: true
});
const DisableCallIdle = definePlugin({
    name: "DisableCallIdle",
    description: "Disables automatically getting kicked from a DM voice call after 3 minutes alone",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Voice"],
    enabledByDefault: true
});
const DontRoundMyTimestamps = definePlugin({
    name: "DontRoundMyTimestamps",
    description: "Prevents Discord from rounding relative timestamps up to the next unit",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Messages", "Appearance"],
    enabledByDefault: false
});
const Experiments = definePlugin({
    name: "Experiments",
    description: "Enable Access to Experiments & other dev-only features in Discord!",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Utility"],
    enabledByDefault: true,
    options: {
        toolbarDevMenu: { type: "boolean", label: "Enable Staging DevMenu in Toolbar", default: false }
    }
});
const FakeNitro = definePlugin({
    name: "FakeNitro",
    description: "Allows you to stream in nitro quality, send fake emojis/stickers, use client themes and custom icons",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Chat", "Media", "Voice"],
    enabledByDefault: true,
    options: {
        enableEmojiBypass: { type: "boolean", label: "Allow sending external & animated emojis", default: true },
        emojiSize: { type: "select", label: "Emoji Size (px)", choices: ["32", "48", "64", "96"], default: "48" },
        enableStickerBypass: { type: "boolean", label: "Allow sending custom stickers", default: true },
        stickerSize: { type: "select", label: "Sticker Size (px)", choices: ["128", "160", "200"], default: "160" },
        enableStreamQualityBypass: { type: "boolean", label: "Unlock 1080p/1440p 60fps screenshare", default: true },
        useHyperLinks: { type: "boolean", label: "Use masked hyperlinks for fake emojis", default: true }
    },
    start({ patcher }) {
        const EmojiPermStore = patcher.findByProps("canUseEmojisEverywhere", "canUseAnimatedEmojis");
        if (EmojiPermStore) {
            patcher.instead("FakeNitro", EmojiPermStore, "canUseEmojisEverywhere", () => true);
            patcher.instead("FakeNitro", EmojiPermStore, "canUseAnimatedEmojis", () => true);
        }
    }
});
const FakeProfileThemes = definePlugin({
    name: "FakeProfileThemes",
    description: "Allows profile theming by hiding the colors as invisible 3y3 encoding in your bio",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Appearance"],
    enabledByDefault: true,
    options: {
        nitroFirst: { type: "boolean", label: "Prefer real Nitro theme colors if present", default: true }
    }
});
const FavoriteEmojiFirst = definePlugin({
    name: "FavoriteEmojiFirst",
    description: "Puts your favorite emojis first in the emoji autocomplete list",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Chat", "Shortcuts"],
    enabledByDefault: true
});
const FavoriteGifSearch = definePlugin({
    name: "FavoriteGifSearch",
    description: "Adds a search bar to your favorite gifs menu",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Media", "Chat"],
    enabledByDefault: true,
    options: {
        searchOption: { type: "select", label: "Search target", choices: ["Url & Title", "Url Only", "Title Only"], default: "Url & Title" }
    }
});
const FixCodeblockGap = definePlugin({
    name: "FixCodeblockGap",
    description: "Removes the awkward empty gap below codeblocks in messages",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Appearance", "Messages"],
    enabledByDefault: true
});
const FixImagesQuality = definePlugin({
    name: "FixImagesQuality",
    description: "Improves quality of images in chat by forcing original WebP/PNG resolution",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Media", "Appearance"],
    enabledByDefault: true
});
const FixSpotifyEmbeds = definePlugin({
    name: "FixSpotifyEmbeds",
    description: "Fixes spotify embeds being way too loud by letting you configure their default volume",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Media"],
    enabledByDefault: false,
    options: {
        volume: { type: "select", label: "Spotify Embed Volume (%)", choices: ["10", "25", "50", "75", "100"], default: "25" }
    }
});
const FixYoutubeEmbeds = definePlugin({
    name: "FixYoutubeEmbeds",
    description: "Bypasses youtube videos being blocked from playing inside Discord embeds",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Media"],
    enabledByDefault: true
});
const ForceOwnerCrown = definePlugin({
    name: "ForceOwnerCrown",
    description: "Force the owner crown next to usernames even if the server is very large",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Appearance", "Guilds"],
    enabledByDefault: true
});
const FriendInvites = definePlugin({
    name: "FriendInvites",
    description: "Create and manage friend invite links via slash commands (/create friend invite)",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Friends", "Utility"],
    enabledByDefault: false
});
const FriendsSince = definePlugin({
    name: "FriendsSince",
    description: "Displays when you became friends with someone in their user profile popout",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Friends", "Appearance"],
    enabledByDefault: true
});
const FullSearchContext = definePlugin({
    name: "FullSearchContext",
    description: "Makes the message context menu in search results have all standard options",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Messages", "Utility"],
    enabledByDefault: true
});
const GameActivityToggle = definePlugin({
    name: "GameActivityToggle",
    description: "Adds a button next to the mic and deafen button to toggle game activity visibility",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Appearance", "Privacy"],
    enabledByDefault: false,
    options: {
        oldIcon: { type: "boolean", label: "Use classic controller icon", default: false }
    }
});
const GifPaste = definePlugin({
    name: "GifPaste",
    description: "Makes picking a GIF in the gif picker insert a link into the chatbox instead of instantly sending it",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Chat", "Media"],
    enabledByDefault: false
});
const GreetStickerPicker = definePlugin({
    name: "GreetStickerPicker",
    description: "Allows you to use any welcome sticker instead of only the random default sticker",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Chat"],
    enabledByDefault: false,
    options: {
        greetMode: { type: "select", label: "Greet mode", choices: ["Greet", "Normal Message"], default: "Greet" }
    }
});
const HideAttachments = definePlugin({
    name: "HideAttachments",
    description: "Allow hiding attachments and embeds for individual messages via a toggle button",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Media", "Messages"],
    enabledByDefault: false
});
const IgnoreActivities = definePlugin({
    name: "IgnoreActivities",
    description: "Ignore specific activities from showing up on your status or others' profiles",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Privacy", "Appearance"],
    enabledByDefault: false,
    options: {
        ignorePlaying: { type: "boolean", label: "Hide all 'Playing' statuses", default: false },
        ignoreStreaming: { type: "boolean", label: "Hide all 'Streaming' statuses", default: false },
        ignoreListening: { type: "boolean", label: "Hide all 'Listening' statuses", default: false }
    }
});
const iLoveSpam = definePlugin({
    name: "iLoveSpam",
    description: "Do not collapse messages from 'likely spammers' automatically",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Chat", "Messages"],
    enabledByDefault: false
});
const ImageFilename = definePlugin({
    name: "ImageFilename",
    description: "Display the file name of images & videos as a tooltip / overlay",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Media", "Appearance"],
    enabledByDefault: false,
    options: {
        showFullUrl: { type: "boolean", label: "Show full CDN URL instead of filename only", default: false }
    }
});
const ImageZoom = definePlugin({
    name: "ImageZoom",
    description: "Lets you zoom in to images and gifs inside Discord with a magnifier lens",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Media"],
    enabledByDefault: true,
    options: {
        size: { type: "select", label: "Lens Size", choices: ["100", "200", "300"], default: "200" },
        zoom: { type: "select", label: "Zoom Multiplier", choices: ["2", "3", "4"], default: "2" },
        nearestNeighbour: { type: "boolean", label: "Use Nearest Neighbour (pixel art mode)", default: false }
    }
});
const ImplicitRelationships = definePlugin({
    name: "ImplicitRelationships",
    description: "Shows your implicit relationships (Discord affinity score) in the Friends tab",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Friends"],
    enabledByDefault: false,
    options: {
        sortByAffinity: { type: "boolean", label: "Sort friends by affinity score", default: true }
    }
});
const InvisibleChat = definePlugin({
    name: "InvisibleChat",
    description: "Encrypt your messages in invisible zero-width characters so only Vencord users can read them",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Privacy", "Chat"],
    enabledByDefault: false,
    options: {
        savedPasswords: { type: "select", label: "Default Decryption Key", choices: ["password", "vencord", "secret"], default: "password" }
    }
});
const KeepCurrentChannel = definePlugin({
    name: "KeepCurrentChannel",
    description: "Attempt to navigate back to the exact channel you had open before restarting Discord",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Utility", "Shortcuts"],
    enabledByDefault: true
});
const LastFMRichPresence = definePlugin({
    name: "LastFMRichPresence",
    description: "Little plugin for Last.fm rich presence status",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Media", "Appearance"],
    enabledByDefault: false,
    options: {
        shareUsername: { type: "boolean", label: "Show Last.fm profile link button", default: false },
        hideWithSpotify: { type: "boolean", label: "Hide status if Spotify is already running", default: true }
    }
});
const LoadingQuotes = definePlugin({
    name: "LoadingQuotes",
    description: "Replace Discord's loading quotes with custom Vencord quotes",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Appearance"],
    enabledByDefault: true,
    options: {
        replaceEvents: { type: "boolean", label: "Replace special event loading quotes too", default: true },
        enablePluginPresetQuotes: { type: "boolean", label: "Include built-in Vencord quotes", default: true }
    }
});
const MemberCount = definePlugin({
    name: "MemberCount",
    description: "Shows the amount of online and total members in the server member list and tooltip",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Guilds", "Appearance"],
    enabledByDefault: true,
    options: {
        toolTip: { type: "boolean", label: "Show member count on server icon tooltip", default: true },
        memberList: { type: "boolean", label: "Show member count at the top of member list", default: true }
    }
});
const MentionAvatars = definePlugin({
    name: "MentionAvatars",
    description: "Shows user avatars inside @mentions in chat",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Appearance", "Messages"],
    enabledByDefault: false,
    options: {
        showAtSymbol: { type: "boolean", label: "Keep the @ symbol next to the avatar", default: true }
    }
});
const MessageClickActions = definePlugin({
    name: "MessageClickActions",
    description: "Double-tap a message to quick-reply or edit your own message",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Chat", "Shortcuts"],
    enabledByDefault: true,
    options: {
        enableDeleteOnClick: { type: "boolean", label: "Enable quick delete on modifier click", default: true },
        enableDoubleClickToEdit: { type: "boolean", label: "Double tap own message to edit", default: true },
        enableDoubleClickToReply: { type: "boolean", label: "Double tap others' message to reply", default: true }
    }
});
const MessageLatency = definePlugin({
    name: "MessageLatency",
    description: "Displays an indicator for messages that took >= N seconds to arrive",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Messages", "Utility"],
    enabledByDefault: false,
    options: {
        latency: { type: "select", label: "Threshold in seconds", choices: ["1", "2", "5"], default: "2" },
        detectDiscordKotlin: { type: "boolean", label: "Detect old Discord Android Kotlin clients", default: true },
        showMillis: { type: "boolean", label: "Show milliseconds precision", default: false }
    }
});
const MessageLinkEmbeds = definePlugin({
    name: "MessageLinkEmbeds",
    description: "Previews the contents of linked Discord messages directly in chat",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Messages", "Chat"],
    enabledByDefault: true,
    options: {
        messageBackgroundColor: { type: "boolean", label: "Use distinct background color for embeds", default: false },
        automodEmbeds: { type: "select", label: "Embed in Automod messages", choices: ["never", "prefer", "always"], default: "never" }
    }
});
const MessageLogger = definePlugin({
    name: "MessageLogger",
    description: "Temporarily logs deleted and edited messages in chat",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Messages", "Chat", "Utility"],
    enabledByDefault: true,
    options: {
        deleteStyle: { type: "select", label: "Deleted message style", choices: ["text", "overlay"], default: "text" },
        logDeletes: { type: "boolean", label: "Log deleted messages in red", default: true },
        collapseDeleted: { type: "boolean", label: "Collapse deleted messages by default", default: false },
        logEdits: { type: "boolean", label: "Log message edit history inline", default: true },
        inlineEdits: { type: "boolean", label: "Display edited history inline", default: true },
        ignoreBots: { type: "boolean", label: "Ignore messages sent by bots", default: false },
        ignoreSelf: { type: "boolean", label: "Ignore messages sent by yourself", default: false }
    },
    start({ patcher }) {
        const FluxDispatcher = patcher.findByProps("dispatch", "subscribe");
        if (FluxDispatcher && typeof FluxDispatcher.dispatch === "function") {
            patcher.before("MessageLogger", FluxDispatcher, "dispatch", (args) => {
                const event = args[0];
                if (event && event.type === "MESSAGE_DELETE") {
                    event.__vencordLoggedDelete = true;
                    event.type = "MESSAGE_DELETE_LOGGED_BY_VENCORD";
                }
                return args;
            });
        }
    }
});
const MessageTags = definePlugin({
    name: "MessageTags",
    description: "Allows you to save custom snippets and to send them with a simple slash command",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Chat", "Shortcuts"],
    enabledByDefault: false,
    options: {
        clyde: { type: "boolean", label: "Send confirmation messages via Clyde", default: true }
    }
});
const MoreCommands = definePlugin({
    name: "MoreCommands",
    description: "Adds various fun and useful slash commands (/echo, /lenny, /mock, /shrug)",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Chat"],
    enabledByDefault: false
});
const MoreKaomoji = definePlugin({
    name: "MoreKaomoji",
    description: "Adds more Kaomoji to Discord's built-in slash commands",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Chat"],
    enabledByDefault: false
});
const MoreUserTags = definePlugin({
    name: "MoreUserTags",
    description: "Adds tags for webhooks and moderation roles (Owner, Admin, Mod, Staff, Voice) in chat",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Appearance", "Guilds"],
    enabledByDefault: false,
    options: {
        dontShowForBots: { type: "boolean", label: "Don't show role tags for bots", default: false },
        dontShowBotTag: { type: "boolean", label: "Hide default BOT tag when role tag is shown", default: false }
    }
});
const Moyai = definePlugin({
    name: "Moyai",
    description: "🗿 Vine boom sound effect whenever someone sends or reacts with 🗿",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Chat", "Media"],
    enabledByDefault: false,
    options: {
        volume: { type: "select", label: "Moyai Volume (%)", choices: ["25", "50", "75", "100"], default: "50" },
        triggerWhenUnfocused: { type: "boolean", label: "Trigger even when Discord is in background", default: true },
        ignoreBots: { type: "boolean", label: "Ignore bots", default: true }
    }
});
const MutualGroupDMs = definePlugin({
    name: "MutualGroupDMs",
    description: "Shows mutual group DMs in user profiles next to Mutual Servers and Mutual Friends",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Friends", "Appearance"],
    enabledByDefault: true
});
const NewGuildSettings = definePlugin({
    name: "NewGuildSettings",
    description: "Automatically mute new servers or apply default notification preferences upon joining",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Guilds", "Notifications"],
    enabledByDefault: false,
    options: {
        guild: { type: "boolean", label: "Mute new server automatically", default: false },
        everyone: { type: "boolean", label: "Suppress @everyone and @here", default: true },
        role: { type: "boolean", label: "Suppress all role @mentions", default: true },
        highlights: { type: "boolean", label: "Suppress Community Highlights", default: true },
        muteScheduledEvents: { type: "boolean", label: "Mute new scheduled events", default: false }
    }
});
const NoBlockedMessages = definePlugin({
    name: "NoBlockedMessages",
    description: "Hides all blocked messages from chat completely",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Chat", "Appearance"],
    enabledByDefault: false,
    options: {
        ignoreBlockedMessages: { type: "boolean", label: "Also ignore unread indicators from blocked users", default: true }
    }
});
const NoDevtoolsWarning = definePlugin({
    name: "NoDevtoolsWarning",
    description: "Disables the 'Hold Up!' console warning and prevents Self-XSS token logging",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Utility", "Privacy"],
    enabledByDefault: true
});
const NoF1 = definePlugin({
    name: "NoF1",
    description: "Disables F1 help bind inside Discord",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Shortcuts"],
    enabledByDefault: true
});
const NoMaskedUrlPaste = definePlugin({
    name: "NoMaskedUrlPaste",
    description: "Pasting a link while having text selected will not paste as a masked URL",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Chat"],
    enabledByDefault: false
});
const NoMosaic = definePlugin({
    name: "NoMosaic",
    description: "Removes Discord image mosaic layout so multiple images stack cleanly",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Media", "Appearance"],
    enabledByDefault: false,
    options: {
        inlineVideo: { type: "boolean", label: "Apply to multiple videos in a single message too", default: true }
    }
});
const NoOnboardingDelay = definePlugin({
    name: "NoOnboardingDelay",
    description: "Skips the slow onboarding delay when joining a community server",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Guilds"],
    enabledByDefault: true
});
const NoPendingCount = definePlugin({
    name: "NoPendingCount",
    description: "Removes the ping count of incoming friend requests, message requests, and nitro offers",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Notifications", "Appearance"],
    enabledByDefault: false,
    options: {
        hideFriendRequestsCount: { type: "boolean", label: "Hide incoming friend requests count", default: true },
        hideMessageRequestsCount: { type: "boolean", label: "Hide message requests badge", default: true },
        hidePremiumOffersCount: { type: "boolean", label: "Hide Nitro promotion badges", default: true }
    }
});
const NoProfileThemes = definePlugin({
    name: "NoProfileThemes",
    description: "Completely removes Nitro profile themes from everyone's profile popouts",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Appearance"],
    enabledByDefault: false
});
const NoReplyMention = definePlugin({
    name: "NoReplyMention",
    description: "Automatically sets replies to not ping the target user by default",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Chat", "Notifications"],
    enabledByDefault: true,
    options: {
        shouldPingListed: { type: "boolean", label: "Ping users in exception list instead of ignoring them", default: true },
        inverseShiftReply: { type: "boolean", label: "Invert shift key behavior when replying", default: false }
    },
    start({ patcher }) {
        const ReplyActions = patcher.findByProps("createPendingReply");
        if (ReplyActions && typeof ReplyActions.createPendingReply === "function") {
            patcher.before("NoReplyMention", ReplyActions, "createPendingReply", (args) => {
                if (args[0] && typeof args[0] === "object") {
                    args[0].shouldMention = false;
                }
                return args;
            });
        }
    }
});
const NoRPC = definePlugin({
    name: "NoRPC",
    description: "Disables Discord's local RPC server entirely",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Privacy"],
    enabledByDefault: false
});
const NoScreensharePreview = definePlugin({
    name: "NoScreensharePreview",
    description: "Disables screenshare previews from being sent to reduce mobile data & battery usage",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Voice", "Privacy"],
    enabledByDefault: false
});
const NoServerEmojis = definePlugin({
    name: "NoServerEmojis",
    description: "Do not show other servers' emojis in the emoji autocomplete menu",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Chat"],
    enabledByDefault: false,
    options: {
        shownEmojis: { type: "select", label: "Shown emojis", choices: ["Only Unicode", "Unicode & Current Server"], default: "Unicode & Current Server" }
    }
});
const NoSystemBadge = definePlugin({
    name: "NoSystemBadge",
    description: "Disables the unread badge count on the system launcher icon",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Notifications"],
    enabledByDefault: false
});
const NoTypingAnimation = definePlugin({
    name: "NoTypingAnimation",
    description: "Disables the CPU-intensive typing dots animation in the bottom chat bar",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Appearance", "Utility"],
    enabledByDefault: false
});
const NoUnblockToJump = definePlugin({
    name: "NoUnblockToJump",
    description: "Allows you to jump to messages of blocked users in search without unblocking them",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Messages", "Utility"],
    enabledByDefault: true
});
const NormalizeMessageLinks = definePlugin({
    name: "NormalizeMessageLinks",
    description: "Strips canary/ptb subdomains from message links when copying",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Messages", "Utility"],
    enabledByDefault: true
});
const NotificationVolume = definePlugin({
    name: "NotificationVolume",
    description: "Allows you to set a separate custom volume level for in-app Discord notification sounds",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Notifications"],
    enabledByDefault: false,
    options: {
        notificationVolume: { type: "select", label: "Notification Volume (%)", choices: ["10", "25", "50", "75", "100"], default: "100" }
    }
});
const NSFWGateBypass = definePlugin({
    name: "NSFWGateBypass",
    description: "Allows you to access NSFW channels without verifying your age on your account",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Guilds", "Utility"],
    enabledByDefault: true
});
const OnePingPerDM = definePlugin({
    name: "OnePingPerDM",
    description: "If unread messages exist in a DM, suppresses further notification sounds until you read them",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Notifications"],
    enabledByDefault: false,
    options: {
        channelToAffect: { type: "select", label: "Channel types", choices: ["Both DMs and Group DMs", "Private DMs Only", "Group DMs Only"], default: "Both DMs and Group DMs" },
        allowMentions: { type: "boolean", label: "Always play sound for explicit @mentions", default: false },
        allowEveryone: { type: "boolean", label: "Always play sound for @everyone", default: false }
    }
});
const oneko = definePlugin({
    name: "oneko",
    description: "Cat follow cursor / touch point on screen (oneko)",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Appearance"],
    enabledByDefault: false
});
const OpenInApp = definePlugin({
    name: "OpenInApp",
    description: "Opens Spotify, Steam, Epic, and Tidal links directly in their native apps",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Utility", "Shortcuts"],
    enabledByDefault: true,
    options: {
        spotify: { type: "boolean", label: "Open Spotify links in Spotify app", default: true },
        steam: { type: "boolean", label: "Open Steam links in Steam app", default: true },
        epic: { type: "boolean", label: "Open Epic Games links in app", default: true },
        tidal: { type: "boolean", label: "Open Tidal links in Tidal app", default: true }
    }
});
const OverrideForumDefaults = definePlugin({
    name: "OverrideForumDefaults",
    description: "Allows you to override default forum layout (List vs Gallery) and sort order",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Guilds", "Appearance"],
    enabledByDefault: false,
    options: {
        defaultLayout: { type: "select", label: "Default layout", choices: ["List View", "Gallery View"], default: "List View" },
        defaultSortOrder: { type: "select", label: "Default sort order", choices: ["Recently Active", "Date Posted"], default: "Recently Active" }
    }
});
const PartyMode = definePlugin({
    name: "PartyMode",
    description: "Allows you to use Discord's anniversary Party Mode combos and confetti anytime",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Appearance", "Chat"],
    enabledByDefault: false,
    options: {
        superIntensePartyMode: { type: "select", label: "Intensity", choices: ["Normal", "Better", "Project X"], default: "Normal" }
    }
});
const PauseInvitesForever = definePlugin({
    name: "PauseInvitesForever",
    description: "Brings back the option to pause server invites indefinitely in server settings",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Guilds"],
    enabledByDefault: false
});
const PermissionFreeWill = definePlugin({
    name: "PermissionFreeWill",
    description: "Disables client-side permission checks for channel lockouts and server onboarding",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Guilds", "Utility"],
    enabledByDefault: false,
    options: {
        lockout: { type: "boolean", label: "Bypass channel permission lockout warning", default: true },
        onboarding: { type: "boolean", label: "Bypass mandatory onboarding requirements", default: true }
    }
});
const PermissionsViewer = definePlugin({
    name: "PermissionsViewer",
    description: "View the permissions a user or role has, and the roles of a server",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Guilds", "Utility"],
    enabledByDefault: true,
    options: {
        permissionsSortOrder: { type: "select", label: "Sort method", choices: ["Highest Role", "Lowest Role"], default: "Highest Role" }
    }
});
const petpet = definePlugin({
    name: "petpet",
    description: "Adds a /petpet slash command to generate headpat GIFs of any user's avatar",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Chat", "Media"],
    enabledByDefault: false
});
const PictureInPicture = definePlugin({
    name: "PictureInPicture",
    description: "Adds picture in picture button on videos inside Discord",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Media"],
    enabledByDefault: true,
    options: {
        loop: { type: "boolean", label: "Loop PiP videos automatically", default: true }
    }
});
const PinDMs = definePlugin({
    name: "PinDMs",
    description: "Allows you to pin private messages and categorize them at the top of your DM list",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Friends", "Shortcuts"],
    enabledByDefault: true,
    options: {
        pinOrder: { type: "select", label: "Pin order", choices: ["Most Recent", "Custom Order"], default: "Custom Order" },
        canCollapseDmSection: { type: "boolean", label: "Allow collapsing DM categories", default: true }
    }
});
const PlainFolderIcon = definePlugin({
    name: "PlainFolderIcon",
    description: "Dont show the small guild icons in server folders",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Appearance", "Guilds"],
    enabledByDefault: false
});
const PlatformIndicators = definePlugin({
    name: "PlatformIndicators",
    description: "Adds platform indicators (Desktop, Mobile, Web, Embedded) to users",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Appearance", "Friends"],
    enabledByDefault: true,
    options: {
        list: { type: "boolean", label: "Show indicators in the member list", default: true },
        badges: { type: "boolean", label: "Show indicators as profile badges", default: true },
        messages: { type: "boolean", label: "Show indicators next to usernames in chat", default: true },
        colorMobileIndicator: { type: "boolean", label: "Color mobile icon with user status color", default: true }
    }
});
const PreviewMessage = definePlugin({
    name: "PreviewMessage",
    description: "Lets you preview your formatted message before sending it",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Chat"],
    enabledByDefault: false
});
const QuickMention = definePlugin({
    name: "QuickMention",
    description: "Adds an @ mention button directly to the message actions bar",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Chat", "Shortcuts"],
    enabledByDefault: true
});
const QuickReply = definePlugin({
    name: "QuickReply",
    description: "Reply to (and edit) messages via quick shortcut",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Chat", "Shortcuts"],
    enabledByDefault: false,
    options: {
        shouldMention: { type: "select", label: "Mention mode", choices: ["Follow NoReplyMention plugin", "Enabled", "Disabled"], default: "Follow NoReplyMention plugin" }
    }
});
const ReactErrorDecoder = definePlugin({
    name: "ReactErrorDecoder",
    description: "Replaces 'Minified React Error' crashes with the actual decoded error description",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Utility"],
    enabledByDefault: true
});
const ReadAllNotificationsButton = definePlugin({
    name: "ReadAllNotificationsButton",
    description: "Read all server notifications with a single button click!",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Notifications", "Shortcuts"],
    enabledByDefault: true
});
const RelationshipNotifier = definePlugin({
    name: "RelationshipNotifier",
    description: "Notifies you when a friend, group chat, or server removes you",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Friends", "Notifications"],
    enabledByDefault: true,
    options: {
        notices: { type: "boolean", label: "Also show a permanent top notice banner", default: false },
        offlineRemovals: { type: "boolean", label: "Check for removals that happened while offline", default: true },
        friends: { type: "boolean", label: "Notify when a friend removes you", default: true },
        friendRequestCancels: { type: "boolean", label: "Notify when a friend request is cancelled", default: true },
        servers: { type: "boolean", label: "Notify when kicked/banned from a server", default: true },
        groups: { type: "boolean", label: "Notify when removed from a Group DM", default: true }
    }
});
const ReplaceGoogleSearch = definePlugin({
    name: "ReplaceGoogleSearch",
    description: "Replaces the Google search engine with different Engines (DuckDuckGo, Brave, Startpage)",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Utility"],
    enabledByDefault: false,
    options: {
        customEngineName: { type: "select", label: "Search Engine", choices: ["DuckDuckGo", "Brave", "Startpage", "Google"], default: "DuckDuckGo" }
    }
});
const ReplyTimestamp = definePlugin({
    name: "ReplyTimestamp",
    description: "Shows a timestamp on replied-message previews",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Messages", "Appearance"],
    enabledByDefault: true
});
const RevealAllSpoilers = definePlugin({
    name: "RevealAllSpoilers",
    description: "Reveal all spoilers in a message by long-pressing / Ctrl-clicking a spoiler",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Messages", "Shortcuts"],
    enabledByDefault: true
});
const ReverseImageSearch = definePlugin({
    name: "ReverseImageSearch",
    description: "Adds Image Search options (Google, Yandex, SauceNAO, IQDB, TinEye) to image context menus",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Media", "Utility"],
    enabledByDefault: true
});
const ReviewDB = definePlugin({
    name: "ReviewDB",
    description: "Review other users and servers (powered by ReviewDB)",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Friends", "Appearance"],
    enabledByDefault: false,
    options: {
        notifyReviews: { type: "boolean", label: "Notify when someone leaves a review on your profile", default: true },
        showWarning: { type: "boolean", label: "Show warning on offensive reviews", default: true },
        hideTimestamps: { type: "boolean", label: "Hide timestamps on reviews", default: false },
        hideBlockedUsers: { type: "boolean", label: "Hide reviews written by blocked users", default: true }
    }
});
const RoleColorEverywhere = definePlugin({
    name: "RoleColorEverywhere",
    description: "Adds the top role color anywhere possible (chat mentions, typing bar, voice list, member list)",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Appearance", "Guilds"],
    enabledByDefault: true,
    options: {
        chatMentions: { type: "boolean", label: "Use role colors in @mentions in chat", default: true },
        memberList: { type: "boolean", label: "Use role colors in member list group headers", default: true },
        voiceUsers: { type: "boolean", label: "Use role colors in voice channel user lists", default: true },
        reactorsList: { type: "boolean", label: "Use role colors in the message reactions modal", default: true },
        pollResults: { type: "boolean", label: "Use role colors in poll results", default: true },
        colorChatMessages: { type: "boolean", label: "Tint message text with the author's role color", default: false }
    }
});
const SearchReply = definePlugin({
    name: "SearchReply",
    description: "Adds a reply button to messages in search results",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Messages", "Shortcuts"],
    enabledByDefault: true
});
const SecretRingToneEnabler = definePlugin({
    name: "SecretRingToneEnabler",
    description: "Always play the rare 0.1% secret Discord call ringtone",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Voice", "Media"],
    enabledByDefault: false,
    options: {
        onlySnow: { type: "boolean", label: "Only play the Snowsgiving remix version", default: false }
    }
});
const SendTimestamps = definePlugin({
    name: "SendTimestamps",
    description: "Send dynamic Discord timestamps easily via a chat bar picker button",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Chat", "Utility"],
    enabledByDefault: true,
    options: {
        replaceMessageContents: { type: "boolean", label: "Automatically parse {{HH:mm}} into timestamps", default: true }
    }
});
const ServerInfo = definePlugin({
    name: "ServerInfo",
    description: "Allows you to view detailed info about a server by long-pressing the server icon",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Guilds", "Utility"],
    enabledByDefault: true
});
const ServerListIndicators = definePlugin({
    name: "ServerListIndicators",
    description: "Add online friend count or total server count indicators to the top of the server list",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Appearance", "Guilds"],
    enabledByDefault: false,
    options: {
        mode: { type: "select", label: "Indicator mode", choices: ["Both", "Online Friends Only", "Server Count Only"], default: "Both" }
    }
});
const ShikiCodeblocks = definePlugin({
    name: "ShikiCodeblocks",
    description: "Brings VSCode-style Shiki syntax highlighting to codeblocks in chat",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Appearance", "Messages"],
    enabledByDefault: false,
    options: {
        theme: { type: "select", label: "Syntax Theme", choices: ["Dark Plus", "One Dark Pro", "Dracula", "GitHub Dark", "Catppuccin Mocha"], default: "Dark Plus" },
        tryHljs: { type: "select", label: "Fallback to Highlight.js", choices: ["SECONDARY", "NEVER", "PRIMARY"], default: "SECONDARY" },
        useDevIcon: { type: "select", label: "Language Icon Style", choices: ["COLOR", "GREYSCALE", "DISABLED"], default: "COLOR" }
    }
});
const ShowAllMessageButtons = definePlugin({
    name: "ShowAllMessageButtons",
    description: "Always show all message action buttons without holding Shift",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Messages", "Shortcuts"],
    enabledByDefault: false
});
const ShowConnections = definePlugin({
    name: "ShowConnections",
    description: "Show connected accounts directly in user popouts",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Appearance", "Friends"],
    enabledByDefault: true,
    options: {
        iconSize: { type: "select", label: "Icon size (px)", choices: ["24", "32", "40"], default: "32" },
        iconSpacing: { type: "select", label: "Icon spacing", choices: ["Compact", "Normal", "Spacious"], default: "Normal" }
    }
});
const ShowHiddenChannels = definePlugin({
    name: "ShowHiddenChannels",
    description: "Show channels that you do not have access to view!",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Guilds", "Utility"],
    enabledByDefault: true,
    options: {
        hideUnreads: { type: "boolean", label: "Hide unread indicators on locked channels", default: true },
        showMode: { type: "select", label: "Display style", choices: ["Lock Icon", "Hidden Eye Icon", "Muted Style"], default: "Lock Icon" },
        defaultAllowedUsersAndRolesDropdownState: { type: "boolean", label: "Expand allowed roles in lock screen by default", default: true }
    }
});
const ShowHiddenThings = definePlugin({
    name: "ShowHiddenThings",
    description: "Displays various hidden & moderator-only things regardless of permissions",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Guilds", "Utility"],
    enabledByDefault: true,
    options: {
        showTimeouts: { type: "boolean", label: "Show timeout icons on timed-out members", default: true },
        showInvitesPaused: { type: "boolean", label: "Show when server invites are paused", default: true },
        showModView: { type: "boolean", label: "Enable member Mod View panel", default: true }
    }
});
const ShowMeYourName = definePlugin({
    name: "ShowMeYourName",
    description: "Display usernames next to display names / nicknames in chat",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Appearance", "Messages"],
    enabledByDefault: false,
    options: {
        mode: { type: "select", label: "Display format", choices: ["user-nick", "nick-user", "user"], default: "user-nick" },
        inReplies: { type: "boolean", label: "Also show in message replies", default: false },
        friendNicknames: { type: "select", label: "Friend nicknames", choices: ["Fallback to username", "Always use friend nickname"], default: "Fallback to username" }
    }
});
const ShowTimeoutDuration = definePlugin({
    name: "ShowTimeoutDuration",
    description: "Shows how much longer a user's timeout will last, either in the timeout icon tooltip or inline",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Guilds", "Messages"],
    enabledByDefault: true,
    options: {
        displayStyle: { type: "select", label: "Display style", choices: ["ssalggnikool (Inline)", "Tooltip Only"], default: "ssalggnikool (Inline)" }
    }
});
const SilentMessageToggle = definePlugin({
    name: "SilentMessageToggle",
    description: "Adds a button to the chat bar to toggle sending a @silent message",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Chat", "Notifications"],
    enabledByDefault: false,
    options: {
        persistState: { type: "boolean", label: "Persist silent state across restarts", default: false },
        autoDisable: { type: "boolean", label: "Automatically disable silent mode after sending 1 message", default: true }
    }
});
const SilentTyping = definePlugin({
    name: "SilentTyping",
    description: "Hide that you are typing from others",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Privacy", "Chat"],
    enabledByDefault: false,
    options: {
        showIcon: { type: "boolean", label: "Show quick toggle icon in the chat bar", default: true },
        contextMenu: { type: "boolean", label: "Add toggle in chat bar context menu", default: true },
        isEnabled: { type: "boolean", label: "Currently suppress typing indicator", default: true }
    },
    start({ patcher }) {
        const TypingActions = patcher.findByProps("startTyping", "stopTyping");
        if (TypingActions && typeof TypingActions.startTyping === "function") {
            patcher.instead("SilentTyping", TypingActions, "startTyping", () => {});
        }
    }
});
const SortFriendRequests = definePlugin({
    name: "SortFriendRequests",
    description: "Sorts friend requests by date of receipt",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Friends"],
    enabledByDefault: false,
    options: {
        showDates: { type: "boolean", label: "Display exact timestamp on pending requests", default: true }
    }
});
const SpotifyControls = definePlugin({
    name: "SpotifyControls",
    description: "Adds a Spotify player control bar above your account panel",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Media", "Appearance"],
    enabledByDefault: false,
    options: {
        hoverControls: { type: "boolean", label: "Only show controls on tap/hover", default: false },
        useSpotifyUris: { type: "boolean", label: "Open links directly in Spotify app instead of browser", default: true },
        previousButtonRestartsTrack: { type: "boolean", label: "Previous button restarts current track if >3s in", default: true }
    }
});
const SpotifyCrack = definePlugin({
    name: "SpotifyCrack",
    description: "Free listen along, no auto-pausing in voice chat, and allows activity without Premium",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Media", "Voice"],
    enabledByDefault: true,
    options: {
        noSpotifyAutoPause: { type: "boolean", label: "Disable Discord auto-pausing Spotify when talking in VC", default: true },
        keepSpotifyActivityOnIdle: { type: "boolean", label: "Keep Spotify status visible when idle", default: false }
    }
});
const SpotifyShareCommands = definePlugin({
    name: "SpotifyShareCommands",
    description: "Share your current Spotify track, album or artist via slash command (/track, /album, /artist)",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Media", "Chat"],
    enabledByDefault: false
});
const StartupTimings = definePlugin({
    name: "StartupTimings",
    description: "Adds Startup Timings page to the Vencord settings",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Utility"],
    enabledByDefault: false
});
const StickerPaste = definePlugin({
    name: "StickerPaste",
    description: "Makes picking a sticker in the sticker picker insert it into the chatbox instead of sending immediately",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Chat"],
    enabledByDefault: false
});
const StreamerModeOnStream = definePlugin({
    name: "StreamerModeOnStream",
    description: "Automatically enables streamer mode when you start streaming in Discord",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Privacy", "Voice"],
    enabledByDefault: false
});
const Summaries = definePlugin({
    name: "Summaries",
    description: "Enables Discord's AI conversation summaries feature on all servers",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Messages", "Guilds"],
    enabledByDefault: false
});
const SuperReactionTweaks = definePlugin({
    name: "SuperReactionTweaks",
    description: "Customize the limit of super reactions playing at once, and super react by default",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Chat", "Appearance"],
    enabledByDefault: false,
    options: {
        superReactByDefault: { type: "boolean", label: "Default reaction picker to Super Reactions", default: false },
        unlimitedSuperReactionPlaying: { type: "boolean", label: "Allow unlimited super reaction animations at once", default: false },
        superReactionPlayingLimit: { type: "select", label: "Max simultaneous animations", choices: ["5", "10", "20", "50"], default: "20" }
    }
});
const TextReplace = definePlugin({
    name: "TextReplace",
    description: "Replace text in your own messages using string or regex rules",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Chat"],
    enabledByDefault: false,
    options: {
        replaceMode: { type: "select", label: "Rule engine", choices: ["String & Regex", "String Only", "Regex Only"], default: "String & Regex" }
    }
});
const ThemeAttributes = definePlugin({
    name: "ThemeAttributes",
    description: "Adds data attributes to various elements for CSS theming purposes",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Appearance"],
    enabledByDefault: false
});
const TimeBarAllActivities = definePlugin({
    name: "TimeBarAllActivities",
    description: "Adds the Spotify-like progress time bar to all rich presence activities that have start/end timestamps",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Appearance"],
    enabledByDefault: false
});
const Translate = definePlugin({
    name: "Translate",
    description: "Translate messages with Google Translate or DeepL",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Chat", "Messages", "Utility"],
    enabledByDefault: true,
    options: {
        service: { type: "select", label: "Translation Service", choices: ["Google Translate", "DeepL Free", "DeepL Pro"], default: "Google Translate" },
        showChatBarButton: { type: "boolean", label: "Show translate button in chat bar", default: true },
        autoTranslate: { type: "boolean", label: "Automatically translate your outgoing messages before sending", default: false },
        receivedOutput: { type: "select", label: "Target language for incoming messages", choices: ["de", "en", "fr", "es", "it", "ja", "ru"], default: "de" }
    }
});
const TypingIndicator = definePlugin({
    name: "TypingIndicator",
    description: "Adds an indicator if someone is typing on a channel in the channel list",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Appearance", "Guilds"],
    enabledByDefault: true,
    options: {
        includeCurrentChannel: { type: "boolean", label: "Show indicator on currently selected channel", default: true },
        includeMutedChannels: { type: "boolean", label: "Show indicator on muted channels", default: false },
        includeBlockedUsers: { type: "boolean", label: "Show indicator when blocked users are typing", default: false },
        indicatorMode: { type: "select", label: "Indicator mode", choices: ["Dots & Avatars", "Animated Dots", "Avatars Only"], default: "Dots & Avatars" }
    }
});
const TypingTweaks = definePlugin({
    name: "TypingTweaks",
    description: "Show avatars and role colours in the typing indicator",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Appearance", "Chat"],
    enabledByDefault: true,
    options: {
        showAvatars: { type: "boolean", label: "Show user avatars in the typing bar", default: true },
        showRoleColors: { type: "boolean", label: "Color typing usernames with their role color", default: true },
        alternativeFormatting: { type: "boolean", label: "Show exact list instead of 'Several people are typing'", default: true }
    }
});
const Unindent = definePlugin({
    name: "Unindent",
    description: "Trims leading indentation from codeblocks",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Messages", "Chat"],
    enabledByDefault: true
});
const UnlockedAvatarZoom = definePlugin({
    name: "UnlockedAvatarZoom",
    description: "Allows you to zoom in further in the avatar crop tool",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Appearance", "Utility"],
    enabledByDefault: false,
    options: {
        zoomMultiplier: { type: "select", label: "Max Zoom Multiplier", choices: ["4", "8", "16"], default: "4" }
    }
});
const UnsuppressEmbeds = definePlugin({
    name: "UnsuppressEmbeds",
    description: "Allows you to unsuppress embeds in messages",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Messages"],
    enabledByDefault: true
});
const UrbanDictionary = definePlugin({
    name: "UrbanDictionary",
    description: "Search for a word on Urban Dictionary via /urban slash command",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Chat", "Utility"],
    enabledByDefault: false
});
const UserMessagesPronouns = definePlugin({
    name: "UserMessagesPronouns",
    description: "Adds pronouns to chat user messages",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Appearance", "Messages"],
    enabledByDefault: false,
    options: {
        pronounsFormat: { type: "select", label: "Pronouns format", choices: ["LOWERCASE", "CAPITALIZED"], default: "LOWERCASE" },
        showSelf: { type: "boolean", label: "Show pronouns on your own messages", default: true }
    }
});
const UserVoiceShow = definePlugin({
    name: "UserVoiceShow",
    description: "Shows an indicator when a user is in a Voice Channel",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Voice", "Appearance"],
    enabledByDefault: true,
    options: {
        showInUserProfileModal: { type: "boolean", label: "Show voice channel in User Profile popouts", default: true },
        showInMemberList: { type: "boolean", label: "Show speaker icon next to user in Member List", default: true },
        showInMessages: { type: "boolean", label: "Show speaker icon next to username in chat messages", default: true }
    }
});
const USRBG = definePlugin({
    name: "USRBG",
    description: "Displays user banners from USRBG database, allowing anyone to get a custom banner without Nitro",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Appearance"],
    enabledByDefault: true,
    options: {
        nitroFirst: { type: "boolean", label: "Prioritize real Nitro banner if user has both", default: true },
        voiceBackground: { type: "boolean", label: "Use USRBG banners as voice call tile backgrounds", default: true }
    }
});
const ValidReply = definePlugin({
    name: "ValidReply",
    description: "Fixes 'Message could not be loaded' upon hovering/tapping a reply",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Messages"],
    enabledByDefault: true
});
const ValidUser = definePlugin({
    name: "ValidUser",
    description: "Fix mentions for unknown/uncached users (<@id>) showing up in chat",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Messages"],
    enabledByDefault: true
});
const VcNarrator = definePlugin({
    name: "VcNarrator",
    description: "Announces when users join, leave, or move in your voice channel via speech synthesis",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Voice"],
    enabledByDefault: false,
    options: {
        volume: { type: "select", label: "Voice Volume (%)", choices: ["25", "50", "75", "100"], default: "100" },
        rate: { type: "select", label: "Speech Speed", choices: ["0.75", "1.0", "1.25", "1.5"], default: "1.0" },
        latinOnly: { type: "boolean", label: "Strip non-latin symbols from usernames before speaking", default: false }
    }
});
const VencordToolbox = definePlugin({
    name: "VencordToolbox",
    description: "Adds a button to the titlebar/header that houses Vencord quick actions",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Shortcuts", "Utility"],
    enabledByDefault: true,
    options: {
        showPluginMenu: { type: "boolean", label: "Include quick plugin toggle list in toolbox menu", default: true }
    }
});
const ViewIcons = definePlugin({
    name: "ViewIcons",
    description: "Makes avatars and banners in user profiles clickable, and adds View Icon to context menus",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Media", "Utility"],
    enabledByDefault: true,
    options: {
        format: { type: "select", label: "Static Image Format", choices: ["webp", "png", "jpg"], default: "webp" },
        imgSize: { type: "select", label: "Image Resolution", choices: ["512", "1024", "2048", "4096"], default: "1024" }
    }
});
const ViewRaw = definePlugin({
    name: "ViewRaw",
    description: "Copy and view the raw content/data of any message, channel or guild",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Utility", "Messages"],
    enabledByDefault: false,
    options: {
        clickMethod: { type: "select", label: "Button click action", choices: ["Left (Modal)", "Right (Copy Raw)"], default: "Left (Modal)" }
    }
});
const VoiceChatDoubleClick = definePlugin({
    name: "VoiceChatDoubleClick",
    description: "Join voice chats via double-tap instead of single tap to prevent accidental joins",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Voice", "Shortcuts"],
    enabledByDefault: true
});
const VoiceDownload = definePlugin({
    name: "VoiceDownload",
    description: "Adds a download button to voice messages",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Voice", "Media"],
    enabledByDefault: true
});
const VoiceMessages = definePlugin({
    name: "VoiceMessages",
    description: "Allows you to send voice messages anywhere, including uploading audio files as voice messages",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Voice", "Chat"],
    enabledByDefault: true,
    options: {
        noiseSuppression: { type: "boolean", label: "Enable WebRTC Noise Suppression", default: true },
        echoCancellation: { type: "boolean", label: "Enable Echo Cancellation", default: true }
    }
});
const VolumeBooster = definePlugin({
    name: "VolumeBooster",
    description: "Allows you to set the user and stream volume above the default 200% maximum",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Voice"],
    enabledByDefault: true,
    options: {
        multiplier: { type: "select", label: "Max Volume Multiplier (2 = 400%, 3 = 600%)", choices: ["2", "3", "4", "5"], default: "2" }
    }
});
const WhoReacted = definePlugin({
    name: "WhoReacted",
    description: "Renders the avatars of users who reacted to a message right next to the reaction pill",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Appearance", "Messages"],
    enabledByDefault: true
});
const Wikisearch = definePlugin({
    name: "Wikisearch",
    description: "Searches Wikipedia for your query via /wiki slash command",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Chat", "Utility"],
    enabledByDefault: false
});
const YoutubeAdblock = definePlugin({
    name: "YoutubeAdblock",
    description: "Block ads in YouTube embeds inside Discord via Watch2Gether player",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Media", "Privacy"],
    enabledByDefault: true
});

// Required Core Vencord Plugins
const NoTrack = definePlugin({
    name: "NoTrack",
    description: "Disable Discord's tracking ('science'/analytics) and crash reporting",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Privacy"],
    required: true,
    enabledByDefault: true,
    options: {
        disableAnalytics: { type: "boolean", label: "Disable Discord Science Analytics", default: true }
    }
});
const SettingsPlugin = definePlugin({
    name: "Settings",
    description: "Adds the Vencord settings section (Vencord, Plugins, Themes, Updater, Cloud, Backup & Restore) to Discord Settings",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Utility"],
    required: true,
    enabledByDefault: true,
    options: {
        settingsLocation: { type: "select", label: "Settings Section Position", choices: ["aboveActivity", "belowNitro", "top", "bottom"], default: "belowNitro" }
    }
});
const SupportHelper = definePlugin({
    name: "SupportHelper",
    description: "Helps us provide support to you and provides debug diagnostics",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Utility"],
    required: true,
    enabledByDefault: true
});
const BUILTIN_PLUGINS = [
    AccountPanelServerProfile,
    AddAttachments,
    AlwaysAnimate,
    AlwaysExpandRoles,
    AlwaysTrust,
    AnonymiseFileNames,
    AppleMusicRichPresence,
    AutomodContext,
    BetterFolders,
    BetterGifAltText,
    BetterGifPicker,
    BetterNotesBox,
    BetterRoleContext,
    BetterRoleDot,
    BetterSessions,
    BetterSettings,
    BetterUploadButton,
    BiggerStreamPreview,
    BlurNSFW,
    CallTimer,
    ClearURLs,
    ClientTheme,
    ColorSighted,
    ConsoleJanitor,
    ConsoleShortcuts,
    CopyEmojiMarkdown,
    CopyFileContents,
    CopyUserURLs,
    CrashHandler,
    CtrlEnterSend,
    CustomIdle,
    CustomRPC,
    Dearrow,
    Decor,
    DisableCallIdle,
    DontRoundMyTimestamps,
    Experiments,
    FakeNitro,
    FakeProfileThemes,
    FavoriteEmojiFirst,
    FavoriteGifSearch,
    FixCodeblockGap,
    FixImagesQuality,
    FixSpotifyEmbeds,
    FixYoutubeEmbeds,
    ForceOwnerCrown,
    FriendInvites,
    FriendsSince,
    FullSearchContext,
    GameActivityToggle,
    GifPaste,
    GreetStickerPicker,
    HideAttachments,
    IgnoreActivities,
    iLoveSpam,
    ImageFilename,
    ImageZoom,
    ImplicitRelationships,
    InvisibleChat,
    KeepCurrentChannel,
    LastFMRichPresence,
    LoadingQuotes,
    MemberCount,
    MentionAvatars,
    MessageClickActions,
    MessageLatency,
    MessageLinkEmbeds,
    MessageLogger,
    MessageTags,
    MoreCommands,
    MoreKaomoji,
    MoreUserTags,
    Moyai,
    MutualGroupDMs,
    NewGuildSettings,
    NoBlockedMessages,
    NoDevtoolsWarning,
    NoF1,
    NoMaskedUrlPaste,
    NoMosaic,
    NoOnboardingDelay,
    NoPendingCount,
    NoProfileThemes,
    NoReplyMention,
    NoRPC,
    NoScreensharePreview,
    NoServerEmojis,
    NoSystemBadge,
    NoTrack,
    NoTypingAnimation,
    NoUnblockToJump,
    NormalizeMessageLinks,
    NotificationVolume,
    NSFWGateBypass,
    OnePingPerDM,
    oneko,
    OpenInApp,
    OverrideForumDefaults,
    PartyMode,
    PauseInvitesForever,
    PermissionFreeWill,
    PermissionsViewer,
    petpet,
    PictureInPicture,
    PinDMs,
    PlainFolderIcon,
    PlatformIndicators,
    PreviewMessage,
    QuickMention,
    QuickReply,
    ReactErrorDecoder,
    ReadAllNotificationsButton,
    RelationshipNotifier,
    ReplaceGoogleSearch,
    ReplyTimestamp,
    RevealAllSpoilers,
    ReverseImageSearch,
    ReviewDB,
    RoleColorEverywhere,
    SearchReply,
    SecretRingToneEnabler,
    SendTimestamps,
    ServerInfo,
    ServerListIndicators,
    SettingsPlugin,
    ShikiCodeblocks,
    ShowAllMessageButtons,
    ShowConnections,
    ShowHiddenChannels,
    ShowHiddenThings,
    ShowMeYourName,
    ShowTimeoutDuration,
    SilentMessageToggle,
    SilentTyping,
    SortFriendRequests,
    SpotifyControls,
    SpotifyCrack,
    SpotifyShareCommands,
    StartupTimings,
    StickerPaste,
    StreamerModeOnStream,
    Summaries,
    SuperReactionTweaks,
    SupportHelper,
    TextReplace,
    ThemeAttributes,
    TimeBarAllActivities,
    Translate,
    TypingIndicator,
    TypingTweaks,
    Unindent,
    UnlockedAvatarZoom,
    UnsuppressEmbeds,
    UrbanDictionary,
    UserMessagesPronouns,
    UserVoiceShow,
    USRBG,
    ValidReply,
    ValidUser,
    VcNarrator,
    VencordToolbox,
    ViewIcons,
    ViewRaw,
    VoiceChatDoubleClick,
    VoiceDownload,
    VoiceMessages,
    VolumeBooster,
    WhoReacted,
    Wikisearch,
    YoutubeAdblock
];

// --- Module: src/ui/DiscordSettingsInjector.js ---
/**
 * VencordForAndroid v0.0.8 - Native Discord Android React Native Settings Integration
 *
 * Exact architecture matching revenge-bundle (tabs.tsx & shared.tsx):
 * 1. Patches SETTING_RENDERER_CONFIG with VencordCustomPage + all Vencord Settings rows
 * 2. Patches createListModule.createList (before & after) right below the ACCOUNT section
 * 3. Fallback patch on SettingsOverviewScreen via findInReactTree(ret, n => n?.props?.sections)
 * 4. Uses tabsNavigationRef.getRootNavigationRef().navigate("VencordCustomPage", ...)
 * 5. Renders native React Native screens using Discord's own React & ReactNative primitives.
 */




function findInReactTree(tree, filter) {
    if (!tree || typeof tree !== "object") return null;
    try {
        if (filter(tree)) return tree;
    } catch (_) {}

    if (Array.isArray(tree)) {
        for (let i = 0; i < tree.length; i++) {
            const res = findInReactTree(tree[i], filter);
            if (res) return res;
        }
        return null;
    }

    if (tree.props && tree.props.children) {
        const res = findInReactTree(tree.props.children, filter);
        if (res) return res;
    }
    return null;
}
class DiscordSettingsInjector {
    constructor() {
        this.unpatches = [];
        this._hooked = false;
    }

    init() {
        if (this._hooked) return;
        this._hooked = true;
        this._initReactNativeSettingsTabs();
    }

    _initReactNativeSettingsTabs() {
        Patcher.waitFor(["SETTING_RENDERER_CONFIG"], (settingConstants) => {
            try {
                const React = Patcher.Common.React;
                const TableRowMod = Patcher.findByProps("TableRow");
                const TableRow = TableRowMod?.TableRow;

                const rows = [
                    {
                        key: "VENCORD_MAIN",
                        title: () => "Vencord",
                        icon: Patcher.findAssetId("SettingsIcon") || Patcher.findAssetId("CogIcon"),
                        useTrailing: () => `(v${CORE_VERSION})`,
                        tabId: "vencord"
                    },
                    {
                        key: "VENCORD_PLUGINS",
                        title: () => "Plugins",
                        icon: Patcher.findAssetId("PuzzlePieceIcon"),
                        useTrailing: () => `${PluginManager.getAllPlugins().filter((p) => p.enabled).length}`,
                        tabId: "plugins"
                    },
                    {
                        key: "VENCORD_THEMES",
                        title: () => "Themes",
                        icon: Patcher.findAssetId("PaintPaletteIcon"),
                        tabId: "themes"
                    },
                    {
                        key: "VENCORD_UPDATER",
                        title: () => "Updater",
                        icon: Patcher.findAssetId("DownloadIcon") || Patcher.findAssetId("CloudUploadIcon"),
                        tabId: "updater"
                    },
                    {
                        key: "VENCORD_BACKUP",
                        title: () => "Backup & Restore",
                        icon: Patcher.findAssetId("RetryIcon") || Patcher.findAssetId("RefreshIcon"),
                        tabId: "backup"
                    }
                ];

                const CustomPageRenderer = this._createCustomPageRenderer();

                const getRendererRows = () => {
                    const map = {};
                    for (const row of rows) {
                        const PageComponent = this._createReactNativeTabComponent(row.tabId);
                        map[row.key] = {
                            type: "pressable",
                            useTitle: row.title,
                            title: row.title,
                            icon: row.icon,
                            IconComponent: (TableRow && row.icon && React)
                                ? () => React.createElement(TableRow.Icon, { source: row.icon })
                                : undefined,
                            useTrailing: row.useTrailing,
                            onPress: () => this._navigateToVencordPage(row.title(), PageComponent),
                            withArrow: true
                        };
                    }
                    return map;
                };

                const origRendererConfig = settingConstants.SETTING_RENDERER_CONFIG;
                let rendererConfigValue = settingConstants.SETTING_RENDERER_CONFIG;

                Object.defineProperty(settingConstants, "SETTING_RENDERER_CONFIG", {
                    enumerable: true,
                    configurable: true,
                    get: () => ({
                        ...rendererConfigValue,
                        VencordCustomPage: {
                            type: "route",
                            useTitle: () => "Vencord Settings",
                            title: () => "Vencord Settings",
                            screen: {
                                route: "VencordCustomPage",
                                getComponent: () => CustomPageRenderer
                            }
                        },
                        ...getRendererRows()
                    }),
                    set: (v) => {
                        rendererConfigValue = v;
                    }
                });

                this.unpatches.push(() => {
                    Object.defineProperty(settingConstants, "SETTING_RENDERER_CONFIG", {
                        value: origRendererConfig,
                        writable: true
                    });
                });

                const injectSectionIntoList = (sections) => {
                    if (!Array.isArray(sections)) return;
                    if (sections.some((s) => s && (s.label === "Vencord Settings" || s.title === "Vencord Settings"))) {
                        return;
                    }
                    const accountIdx = sections.findIndex((s) => Array.isArray(s?.settings) && s.settings.includes("ACCOUNT"));
                    const insertIdx = accountIdx !== -1 ? accountIdx + 1 : 1;
                    sections.splice(insertIdx, 0, {
                        label: "Vencord Settings",
                        title: "Vencord Settings",
                        settings: rows.map((r) => r.key)
                    });
                };

                // Patch 1: createListModule.createList (both before and after for full compatibility)
                Patcher.waitFor(["createList"], (createListModule) => {
                    if (createListModule && typeof createListModule.createList === "function") {
                        this.unpatches.push(
                            Patcher.before("VencordSettingsCreateListBefore", createListModule, "createList", (args) => {
                                const config = args[0];
                                if (config && Array.isArray(config.sections)) {
                                    injectSectionIntoList(config.sections);
                                }
                                return args;
                            })
                        );
                        this.unpatches.push(
                            Patcher.after("VencordSettingsCreateListAfter", createListModule, "createList", (args, ret) => {
                                const config = args[0];
                                if (config && Array.isArray(config.sections)) {
                                    injectSectionIntoList(config.sections);
                                }
                                return ret;
                            })
                        );
                    }
                });

                // Patch 2: Fallback patch directly on SettingsOverviewScreen
                Patcher.waitFor("SettingsOverviewScreen", (SettingsOverviewMod) => {
                    const targetObj = SettingsOverviewMod?.default ? SettingsOverviewMod : null;
                    if (targetObj && typeof targetObj.default === "function") {
                        this.unpatches.push(
                            Patcher.after("VencordSettingsOverview", targetObj, "default", (_args, ret) => {
                                try {
                                    const node = findInReactTree(ret, (n) => Array.isArray(n?.props?.sections));
                                    if (node && Array.isArray(node.props.sections)) {
                                        injectSectionIntoList(node.props.sections);
                                    }
                                } catch (_) {}
                                return ret;
                            })
                        );
                    }
                });

                console.log("[VencordForAndroid] Successfully registered Vencord Settings in Discord SETTING_RENDERER_CONFIG!");
            } catch (err) {
                console.error("[VencordForAndroid] React Native settings registration error:", err);
            }
        });
    }

    _navigateToVencordPage(title, PageComponent) {
        try {
            const tabsNav = Patcher.findByProps("getRootNavigationRef") || Patcher.findDeepInMetro((m) => m && typeof m.getRootNavigationRef === "function");
            const nav = tabsNav?.getRootNavigationRef?.();
            if (nav && typeof nav.navigate === "function") {
                nav.navigate("VencordCustomPage", {
                    title,
                    render: PageComponent
                });
                return;
            }
        } catch (err) {
            console.error("[VencordForAndroid] Navigation error:", err);
        }
    }

    _createCustomPageRenderer() {
        const React = Patcher.Common.React;
        const NavigationNative = Patcher.Common.NavigationNative;
        const self = this;

        const Renderer = function VencordCustomPageScreen(props) {
            const nav = NavigationNative?.useNavigation ? NavigationNative.useNavigation() : null;
            const route = NavigationNative?.useRoute ? NavigationNative.useRoute() : props?.route;
            const params = route?.params || {};
            const PageComp = params.render || self._createReactNativeTabComponent("plugins");
            const pageTitle = params.title || "Vencord Settings";

            if (React.useEffect) {
                React.useEffect(() => {
                    if (nav && typeof nav.setOptions === "function") {
                        try {
                            nav.setOptions({ title: pageTitle });
                        } catch (_) {}
                    }
                }, [pageTitle]);
            }

            return React.createElement(PageComp);
        };

        return React?.memo ? React.memo(Renderer) : Renderer;
    }

    _createReactNativeTabComponent(tabId) {
        return function VencordRNSettingsScreen() {
            const React = Patcher.Common.React;
            const RN = Patcher.Common.ReactNative;
            if (!React || !RN) return null;

            const { View, Text, ScrollView, TextInput, TouchableOpacity, Switch } = RN;
            const [search, setSearch] = React.useState("");
            const [statusFilter, setStatusFilter] = React.useState("ALL");
            const [selectedPlugin, setSelectedPlugin] = React.useState(null);
            const [, setTick] = React.useState(0);
            const refresh = () => setTick((n) => n + 1);

            if (tabId === "updater") {
                return React.createElement(
                    ScrollView,
                    { style: { flex: 1, backgroundColor: "#1e1f22", padding: 16 } },
                    React.createElement(
                        View,
                        { style: { backgroundColor: "#2b2d31", borderRadius: 10, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: "#3f4147" } },
                        React.createElement(Text, { style: { color: "#f2f3f5", fontSize: 16, fontWeight: "700", marginBottom: 6 } }, "VencordForAndroid Repository"),
                        React.createElement(Text, { style: { color: "#00a8fc", fontSize: 13 } }, `https://github.com/${CORE_REPO}`),
                        React.createElement(Text, { style: { color: "#b5bac1", fontSize: 13, marginTop: 4 } }, `Installiert: v${CORE_VERSION} • Neueste: v${Updater.latestVersion}`)
                    ),
                    React.createElement(
                        View,
                        { style: { backgroundColor: "#2b2d31", borderRadius: 10, padding: 16, borderWidth: 1, borderColor: "#3f4147" } },
                        React.createElement(Text, { style: { color: "#f2f3f5", fontSize: 16, fontWeight: "700", marginBottom: 6 } }, "Updates"),
                        React.createElement(
                            Text,
                            { style: { color: "#b5bac1", fontSize: 13, marginBottom: 14 } },
                            Updater.updateAvailable ? `Neues Update v${Updater.latestVersion} verfügbar!` : "VencordForAndroid ist auf dem neuesten Stand!"
                        ),
                        React.createElement(
                            View,
                            { style: { flexDirection: "row", gap: 10 } },
                            React.createElement(
                                TouchableOpacity,
                                {
                                    style: { backgroundColor: "#5865f2", paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 },
                                    onPress: async () => {
                                        await Updater.checkForUpdates();
                                        refresh();
                                    }
                                },
                                React.createElement(Text, { style: { color: "#fff", fontWeight: "700" } }, "Nach Updates suchen")
                            ),
                            Updater.updateAvailable ? React.createElement(
                                TouchableOpacity,
                                {
                                    style: { backgroundColor: "#248046", paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 },
                                    onPress: async () => {
                                        await Updater.downloadAndApplyUpdate();
                                        refresh();
                                    }
                                },
                                React.createElement(Text, { style: { color: "#fff", fontWeight: "700" } }, "Update installieren")
                            ) : null
                        )
                    )
                );
            }

            if (tabId === "vencord") {
                const toggles = [
                    { key: "autoUpdate", title: "Automatisch nach Updates suchen", sub: "Prüft beim Start von Discord auf neue VencordForAndroid-Updates" },
                    { key: "autoUpdateNotification", title: "Update-Benachrichtigungen", sub: "Informiert bei neuen Releases auf juli22292/vencordforandroid" },
                    { key: "safeMode", title: "Abgesicherter Modus (Safe Mode)", sub: "Deaktiviert optionale Plugins zur Fehlerbehebung" }
                ];
                return React.createElement(
                    ScrollView,
                    { style: { flex: 1, backgroundColor: "#1e1f22", padding: 16 } },
                    toggles.map((item) =>
                        React.createElement(
                            View,
                            {
                                key: item.key,
                                style: {
                                    backgroundColor: "#2b2d31",
                                    borderRadius: 10,
                                    padding: 14,
                                    marginBottom: 10,
                                    flexDirection: "row",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    borderWidth: 1,
                                    borderColor: "#3f4147"
                                }
                            },
                            React.createElement(
                                View,
                                { style: { flex: 1, paddingRight: 12 } },
                                React.createElement(Text, { style: { color: "#f2f3f5", fontSize: 15, fontWeight: "700" } }, item.title),
                                React.createElement(Text, { style: { color: "#b5bac1", fontSize: 12, marginTop: 2 } }, item.sub)
                            ),
                            Switch ? React.createElement(Switch, {
                                value: Boolean(Settings.get(item.key)),
                                onValueChange: (val) => {
                                    Settings.set(item.key, val);
                                    refresh();
                                }
                            }) : null
                        )
                    )
                );
            }

            if (tabId === "themes") {
                return React.createElement(
                    ScrollView,
                    { style: { flex: 1, backgroundColor: "#1e1f22", padding: 16 } },
                    React.createElement(
                        View,
                        { style: { backgroundColor: "#2b2d31", borderRadius: 10, padding: 16, borderWidth: 1, borderColor: "#3f4147" } },
                        React.createElement(Text, { style: { color: "#f2f3f5", fontSize: 16, fontWeight: "700", marginBottom: 6 } }, "Vencord Themes"),
                        React.createElement(Text, { style: { color: "#b5bac1", fontSize: 13 } }, "Eigene Android-Themes und Farbschemata für VencordForAndroid.")
                    )
                );
            }

            if (tabId === "backup") {
                return React.createElement(
                    ScrollView,
                    { style: { flex: 1, backgroundColor: "#1e1f22", padding: 16 } },
                    React.createElement(
                        View,
                        { style: { backgroundColor: "#2b2d31", borderRadius: 10, padding: 16, borderWidth: 1, borderColor: "#3f4147" } },
                        React.createElement(Text, { style: { color: "#f2f3f5", fontSize: 16, fontWeight: "700", marginBottom: 6 } }, "Backup & Restore"),
                        React.createElement(Text, { style: { color: "#b5bac1", fontSize: 13, marginBottom: 14 } }, "Setze alle Plugin-Einstellungen auf die Standardwerte zurück."),
                        React.createElement(
                            TouchableOpacity,
                            {
                                style: { backgroundColor: "#da373c", paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, alignSelf: "flex-start" },
                                onPress: () => {
                                    PluginManager.stopAll();
                                    Settings.wipeAll();
                                    PluginManager.startAllEnabled();
                                    refresh();
                                }
                            },
                            React.createElement(Text, { style: { color: "#fff", fontWeight: "700" } }, "Alle Plugins zurücksetzen")
                        )
                    )
                );
            }

            // Default: Official Vencord Plugins Screen (170 official Vencord plugins adapted for Android)
            const allPlugins = PluginManager.getAllPlugins().filter((p) => {
                if (search) {
                    const q = search.toLowerCase();
                    if (!p.name.toLowerCase().includes(q) && !p.description.toLowerCase().includes(q)) return false;
                }
                if (statusFilter === "ENABLED" && !p.enabled) return false;
                if (statusFilter === "DISABLED" && p.enabled) return false;
                return true;
            });

            return React.createElement(
                ScrollView,
                { style: { flex: 1, backgroundColor: "#1e1f22", padding: 14 } },
                // Plugin Management Card
                React.createElement(
                    View,
                    { style: { backgroundColor: "#2b2d31", borderRadius: 10, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: "#3f4147" } },
                    React.createElement(Text, { style: { color: "#f2f3f5", fontSize: 15, fontWeight: "700", marginBottom: 4 } }, "Plugin Management"),
                    React.createElement(Text, { style: { color: "#b5bac1", fontSize: 12 } }, "Tippe auf das Zahnrad- oder Info-Symbol für Einstellungen & Details.")
                ),
                // Search Bar
                TextInput ? React.createElement(TextInput, {
                    style: { backgroundColor: "#111214", color: "#dbdee1", borderRadius: 8, padding: 11, marginBottom: 10, borderWidth: 1, borderColor: "#3f4147" },
                    placeholder: "Search for a plugin...",
                    placeholderTextColor: "#949ba4",
                    value: search,
                    onChangeText: setSearch
                }) : null,
                // Filter Chips
                React.createElement(
                    View,
                    { style: { flexDirection: "row", gap: 8, marginBottom: 14 } },
                    ["ALL", "ENABLED", "DISABLED"].map((st) =>
                        React.createElement(
                            TouchableOpacity,
                            {
                                key: st,
                                style: {
                                    backgroundColor: statusFilter === st ? "#5865f2" : "#2b2d31",
                                    paddingVertical: 8,
                                    paddingHorizontal: 14,
                                    borderRadius: 8
                                },
                                onPress: () => setStatusFilter(st)
                            },
                            React.createElement(
                                Text,
                                { style: { color: "#fff", fontSize: 12, fontWeight: "700" } },
                                st === "ALL" ? `Show All (${PluginManager.getAllPlugins().length})` : st === "ENABLED" ? "Show Enabled" : "Show Disabled"
                            )
                        )
                    )
                ),
                // Plugin Cards
                allPlugins.map((plugin) =>
                    React.createElement(
                        View,
                        {
                            key: plugin.name,
                            style: {
                                backgroundColor: "#2b2d31",
                                borderRadius: 10,
                                padding: 14,
                                marginBottom: 10,
                                borderWidth: 1,
                                borderColor: "#3f4147"
                            }
                        },
                        React.createElement(
                            View,
                            { style: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 } },
                            React.createElement(Text, { style: { color: "#f2f3f5", fontSize: 15, fontWeight: "700", flex: 1 } }, plugin.name),
                            React.createElement(
                                View,
                                { style: { flexDirection: "row", alignItems: "center", gap: 12 } },
                                React.createElement(
                                    TouchableOpacity,
                                    { onPress: () => setSelectedPlugin(selectedPlugin === plugin.name ? null : plugin.name) },
                                    React.createElement(Text, { style: { color: "#b5bac1", fontSize: 18 } }, plugin.hasSettings ? "⚙" : "ⓘ")
                                ),
                                Switch ? React.createElement(Switch, {
                                    value: plugin.enabled,
                                    disabled: plugin.required,
                                    onValueChange: () => {
                                        PluginManager.togglePlugin(plugin.name);
                                        refresh();
                                    }
                                }) : null
                            )
                        ),
                        React.createElement(Text, { style: { color: "#b5bac1", fontSize: 13 } }, plugin.description),
                        selectedPlugin === plugin.name && plugin.hasSettings ? React.createElement(
                            View,
                            { style: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#3f4147" } },
                            Object.entries(plugin.options).map(([optKey, optDef]) =>
                                React.createElement(
                                    View,
                                    { key: optKey, style: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 6 } },
                                    React.createElement(Text, { style: { color: "#dbdee1", fontSize: 12, flex: 1, paddingRight: 8 } }, optDef.label || optKey),
                                    optDef.type === "boolean" && Switch ? React.createElement(Switch, {
                                        value: Boolean(plugin.optionValues[optKey] ?? optDef.default),
                                        onValueChange: (val) => {
                                            Settings.setPluginOption(plugin.name, optKey, val);
                                            refresh();
                                        }
                                    }) : React.createElement(Text, { style: { color: "#5865f2", fontSize: 12, fontWeight: "700" } }, String(plugin.optionValues[optKey] ?? optDef.default))
                                )
                            )
                        ) : null
                    )
                )
            );
        };
    }

    unpatchAll() {
        for (const fn of this.unpatches) {
            try {
                fn();
            } catch (_) {}
        }
        this.unpatches = [];
        this._hooked = false;
    }
}
const SettingsInjector = new DiscordSettingsInjector();

// --- Module: src/index.js ---
/**
 * VencordForAndroid v0.0.8 - Real Discord Android Metro/Hermes Entry Point
 * Modeled after revenge-bundle/src/entry.ts:
 * 1. Disables Object.freeze/Object.seal immediately BEFORE index.android.bundle runs.
 * 2. Intercepts globalThis.__r so VencordForAndroid.init() patches SETTING_RENDERER_CONFIG
 *    and createList BEFORE originalRequire(0) boots Discord's UI!
 */






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
const VencordForAndroid = new VencordForAndroidRuntime();

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

})(typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : this);
