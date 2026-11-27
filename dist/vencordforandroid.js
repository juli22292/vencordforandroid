(function () {
function _classCallCheck(a, n) { if (!(a instanceof n)) throw new TypeError("Cannot call a class as a function"); }
function _defineProperties(e, r) { for (var t = 0; t < r.length; t++) { var o = r[t]; o.enumerable = o.enumerable || !1, o.configurable = !0, "value" in o && (o.writable = !0), Object.defineProperty(e, _toPropertyKey(o.key), o); } }
function _createClass(e, r, t) { return r && _defineProperties(e.prototype, r), t && _defineProperties(e, t), Object.defineProperty(e, "prototype", { writable: !1 }), e; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == typeof i ? i : i + ""; }
function _toPrimitive(t, e) { if ("object" != typeof t || !t) return t; var r; if ("undefined" != typeof Symbol && void 0 !== (r = t[Symbol.toPrimitive])) { var i = r.call(t, e || "default"); if ("object" != typeof i) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === e ? String : Number)(t); }
/**
 * VencordForAndroid v0.1.2 (React Native / Hermes Bundle for com.discord)
 * Repository: https://github.com/juli22292/vencordforandroid
 * Includes 170 plugin definitions
 * Built: 2026-11-27T15:25:32.835Z
 */
(function (global) {
  "use strict";

  try {
    // --- Module: src/core/Version.js ---
    const CORE_VERSION = "0.1.2";

    // --- Module: src/core/Settings.js ---
    /**
     * VencordForAndroid v0.0.4 - Settings & SettingsStore API
     * Follows Vendicated/Vencord/src/api/Settings.ts architecture for Discord Android (MMKV / NativeBridge / Storage).
     */

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
    let SettingsStoreService = /*#__PURE__*/function () {
      function SettingsStoreService() {
        _classCallCheck(this, SettingsStoreService);
        this.plain = this._load();
        this.globalListeners = new Set();
        this.pathListeners = new Map();
      }
      return _createClass(SettingsStoreService, [{
        key: "_getNativeStorage",
        value: function _getNativeStorage() {
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
                getItem: k => mmkv.getString(k) ?? null,
                setItem: (k, v) => mmkv.set(k, v),
                removeItem: k => mmkv.delete(k)
              };
            }
            // 3. Web / DOM localStorage
            try {
              if (globalThis.localStorage) return globalThis.localStorage;
            } catch (_) {}
          }
          if (!this._mem) this._mem = new Map();
          return {
            getItem: k => this._mem.get(k) ?? null,
            setItem: (k, v) => this._mem.set(k, v),
            removeItem: k => this._mem.delete(k)
          };
        }
      }, {
        key: "_load",
        value: function _load() {
          try {
            const storage = this._getNativeStorage();
            const raw = storage.getItem(STORAGE_KEY);
            return this._normalize(raw ? JSON.parse(raw) : {});
          } catch (err) {
            return this._normalize({});
          }
        }
      }, {
        key: "_normalize",
        value: function _normalize(parsed) {
          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            throw new TypeError("Der Einstellungsimport muss ein JSON-Objekt enthalten.");
          }
          const defaults = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
          const plugins = Object.create(null);
          for (const [name, config] of Object.entries(parsed.plugins ?? {})) {
            if (config && typeof config === "object" && !Array.isArray(config)) {
              plugins[name] = {
                ...config,
                options: {
                  ...config.options
                }
              };
            }
          }
          return {
            ...defaults,
            ...parsed,
            version: CORE_VERSION,
            cloud: {
              ...defaults.cloud,
              ...parsed.cloud
            },
            uiElements: {
              ...defaults.uiElements,
              ...parsed.uiElements
            },
            plugins
          };
        }
      }, {
        key: "_replaceSettings",
        value: function _replaceSettings(next) {
          for (const key of Object.keys(this.plain)) delete this.plain[key];
          Object.defineProperties(this.plain, Object.getOwnPropertyDescriptors(next));
        }
      }, {
        key: "save",
        value: function save(changedPath = "") {
          try {
            const storage = this.nativeCache ?? this._getNativeStorage();
            const write = storage.setItem(STORAGE_KEY, JSON.stringify(this.plain));
            write?.catch?.(err => console.error("[VencordForAndroid:SettingsStore] Save failed:", err));
          } catch (err) {
            console.error("[VencordForAndroid:SettingsStore] Save failed:", err);
          }
          this._notify(changedPath);
        }
      }, {
        key: "connectNativeCache",
        value: async function connectNativeCache(cache) {
          if (typeof cache?.getItem !== "function" || typeof cache.setItem !== "function") return;
          try {
            const saved = await cache.getItem(STORAGE_KEY);
            this.nativeCache = cache;
            if (saved) {
              this._replaceSettings(this._normalize(JSON.parse(saved)));
              this._notify("*");
            }
          } catch (err) {
            console.error("[VencordForAndroid:SettingsStore] Read failed:", err);
          }
        }
      }, {
        key: "get",
        value: function get(key) {
          return this.plain[key];
        }
      }, {
        key: "set",
        value: function set(key, value) {
          this.plain[key] = value;
          this.save(key);
        }
      }, {
        key: "getPluginConfig",
        value: function getPluginConfig(pluginName, defaults = {}) {
          if (!this.plain.plugins[pluginName]) {
            this.plain.plugins[pluginName] = {
              enabled: Boolean(defaults.enabledByDefault),
              options: {
                ...(defaults.defaultOptions || {})
              }
            };
          } else if (!this.plain.plugins[pluginName].options) {
            this.plain.plugins[pluginName].options = {
              ...(defaults.defaultOptions || {})
            };
          }
          return this.plain.plugins[pluginName];
        }
      }, {
        key: "getPluginOptionsProxy",
        value: function getPluginOptionsProxy(pluginName, def = {}) {
          const defaultOptions = {};
          for (const [k, opt] of Object.entries(def)) {
            defaultOptions[k] = opt.default !== undefined ? opt.default : Array.isArray(opt.options) ? opt.options.find(o => o.default)?.value : undefined;
          }
          const self = this;
          const currentOptions = () => self.getPluginConfig(pluginName, {
            defaultOptions
          }).options;
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
      }, {
        key: "setPluginEnabled",
        value: function setPluginEnabled(pluginName, enabled) {
          const cfg = this.getPluginConfig(pluginName);
          cfg.enabled = Boolean(enabled);
          this.save(`plugins.${pluginName}.enabled`);
        }
      }, {
        key: "setPluginOption",
        value: function setPluginOption(pluginName, optionKey, value) {
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
      }, {
        key: "addGlobalChangeListener",
        value: function addGlobalChangeListener(cb) {
          this.globalListeners.add(cb);
          return () => this.globalListeners.delete(cb);
        }
      }, {
        key: "subscribe",
        value: function subscribe(cb) {
          return this.addGlobalChangeListener(cb);
        }
      }, {
        key: "addChangeListener",
        value: function addChangeListener(path, cb) {
          if (!this.pathListeners.has(path)) {
            this.pathListeners.set(path, new Set());
          }
          this.pathListeners.get(path).add(cb);
          return () => this.pathListeners.get(path)?.delete(cb);
        }
      }, {
        key: "_notify",
        value: function _notify(path) {
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
      }, {
        key: "exportJSON",
        value: function exportJSON() {
          return JSON.stringify(this.plain, null, 2);
        }
      }, {
        key: "importJSON",
        value: function importJSON(jsonStr) {
          this._replaceSettings(this._normalize(JSON.parse(jsonStr)));
          this.save();
        }
      }, {
        key: "wipeAll",
        value: function wipeAll() {
          this._replaceSettings(this._normalize({}));
          this.save("*");
        }
      }]);
    }();
    const Settings = new SettingsStoreService();
    const SettingsStore = Settings;
    const PlainSettings = Settings.plain;

    // --- Module: src/core/Patcher.js ---
    /**
     * VencordForAndroid v0.0.4 - Metro / Webpack Module Engine & Runtime Patcher
     * Combines Vendicated/Vencord's patchWebpack.ts with Discord Android's Metro (__r / modules) lookup.
     */
    let PatcherAndModuleEngine = /*#__PURE__*/function () {
      function PatcherAndModuleEngine() {
        _classCallCheck(this, PatcherAndModuleEngine);
        this.patches = new Map();
        this.patchWrappers = new WeakMap();
        this.declarativePatches = [];
        this.waitSubscriptions = new Set();
        this.metroModules = new Map();
        this.metroExportOwners = new WeakMap();
        this._commonCache = {};
      }

      // --- 1. Runtime Method Patching (before / instead / after) ---
      return _createClass(PatcherAndModuleEngine, [{
        key: "_patch",
        value: function _patch(type, callerId, target, method, callback) {
          if (!target || typeof target[method] !== "function") {
            return () => {};
          }
          const original = target[method];
          const entry = {
            original,
            active: true
          };
          const wrapped = function (...args) {
            if (!entry.active) return original.apply(this, args);
            if (type === "before") {
              try {
                const newArgs = callback(args, this);
                if (Array.isArray(newArgs)) args = newArgs;
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
          this.patchWrappers.set(wrapped, entry);
          const unpatch = () => {
            entry.active = false;
            if (target[method] === wrapped) {
              let next = original;
              let previous = this.patchWrappers.get(next);
              while (previous && !previous.active) {
                next = previous.original;
                previous = this.patchWrappers.get(next);
              }
              target[method] = next;
            }
            this.patches.get(callerId)?.delete(unpatch);
          };
          if (!this.patches.has(callerId)) {
            this.patches.set(callerId, new Set());
          }
          this.patches.get(callerId).add(unpatch);
          return unpatch;
        }
      }, {
        key: "before",
        value: function before(callerId, target, method, callback) {
          return this._patch("before", callerId, target, method, callback);
        }
      }, {
        key: "instead",
        value: function instead(callerId, target, method, callback) {
          return this._patch("instead", callerId, target, method, callback);
        }
      }, {
        key: "after",
        value: function after(callerId, target, method, callback) {
          return this._patch("after", callerId, target, method, callback);
        }
      }, {
        key: "unpatchAll",
        value: function unpatchAll(callerId) {
          if (callerId) {
            this.declarativePatches = this.declarativePatches.filter(patch => patch.plugin !== callerId);
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
          this.declarativePatches.length = 0;
        }

        // --- 2. Vencord Declarative Patches (patches: [{ find, replacement: { match, replace } }]) ---
      }, {
        key: "addDeclarativePatch",
        value: function addDeclarativePatch(patchDef, pluginName) {
          this.declarativePatches.push({
            ...patchDef,
            plugin: pluginName,
            replacement: Array.isArray(patchDef.replacement) ? patchDef.replacement : [patchDef.replacement]
          });
        }

        // --- 3. Discord Metro (React Native Android) & Webpack Module Discovery ---
      }, {
        key: "observeMetroDefinitions",
        value: function observeMetroDefinitions(onEntryLoaded) {
          const engine = this;
          const original = Object.getOwnPropertyDescriptor(globalThis, "__d");
          let wrapped;
          const assign = next => {
            wrapped = typeof next !== "function" ? next : function (factory, id, ...args) {
              if (typeof factory !== "function") return next.call(this, factory, id, ...args);
              const observeFactory = function (...factoryArgs) {
                const result = factory.apply(this, factoryArgs);
                try {
                  const record = factoryArgs[4];
                  const exports = record?.exports;
                  if (exports && (typeof exports === "object" || typeof exports === "function")) {
                    engine.metroModules.set(id, record);
                    engine.metroExportOwners.set(exports, record);
                    engine._notifyWaiters(record);
                  }
                  if (id === 0) onEntryLoaded();
                } catch (error) {
                  globalThis.console?.error?.("[VencordForAndroid] Metro observer:", error);
                }
                return result;
              };
              return next.call(this, observeFactory, id, ...args);
            };
          };
          assign(globalThis.__d);
          Object.defineProperty(globalThis, "__d", {
            configurable: true,
            enumerable: original?.enumerable ?? true,
            get: () => wrapped,
            set: assign
          });
        }
      }, {
        key: "patchableMetroExport",
        value: function patchableMetroExport(exports, key) {
          const descriptor = Object.getOwnPropertyDescriptor(exports, key);
          if (!descriptor || descriptor.configurable || descriptor.writable) return exports;
          const record = this.metroExportOwners.get(exports);
          if (!record || record.exports !== exports) return exports;
          const descriptors = Object.getOwnPropertyDescriptors(exports);
          descriptors[key].configurable = true;
          const replacement = Object.create(Object.getPrototypeOf(exports), descriptors);
          record.exports = replacement;
          this.metroExportOwners.set(replacement, record);
          return replacement;
        }
      }, {
        key: "_notifyWaiters",
        value: function _notifyWaiters(record) {
          if (this.waitSubscriptions.size === 0) return;
          for (const sub of Array.from(this.waitSubscriptions)) {
            const exports = record.exports;
            try {
              const match = sub.filter(exports) ? exports : exports?.default && sub.filter(exports.default) ? exports.default : null;
              if (!match) continue;
              this.waitSubscriptions.delete(sub);
              sub.callback(match);
            } catch (error) {
              globalThis.console?.error?.("[VencordForAndroid] Module callback:", error);
            }
          }
        }
      }, {
        key: "_getMetroModulesMap",
        value: function _getMetroModulesMap() {
          if (typeof globalThis === "undefined") return null;
          const raw = globalThis.modules ?? globalThis.__r?.getModules?.();
          if (!raw) return null;
          return raw instanceof Map ? Object.fromEntries(raw) : raw;
        }
      }, {
        key: "_getModuleList",
        value: function _getModuleList() {
          const list = new Set();
          for (const {
            exports
          } of this.metroModules.values()) list.add(exports);
          try {
            // Explicit module registries provided by supported hosts and test runtimes.
            const modulesMap = this._getMetroModulesMap();
            if (modulesMap) {
              for (const key of Object.keys(modulesMap)) {
                const mod = modulesMap[key];
                if (mod?.isInitialized && mod?.publicModule?.exports) {
                  list.add(mod.publicModule.exports);
                } else if (mod?.exports) {
                  list.add(mod.exports);
                }
              }
            }
            // 2. Webpack chunk cache fallback
            if (typeof window !== "undefined" && Array.isArray(window.webpackChunkdiscord_app)) {
              let wpRequire = this._wpRequire;
              if (!wpRequire) {
                window.webpackChunkdiscord_app.push([[Symbol("VencordForAndroid")], {}, req => {
                  wpRequire = req;
                }]);
                window.webpackChunkdiscord_app.pop();
                this._wpRequire = wpRequire;
              }
              if (wpRequire?.c) {
                for (const mod of Object.values(wpRequire.c)) {
                  if (mod?.exports) list.add(mod.exports);
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
      }, {
        key: "findDeepInMetro",
        value: function findDeepInMetro(filterFn) {
          const quick = this.find(filterFn);
          if (quick) return quick;
          const modulesMap = this._getMetroModulesMap();
          if (!modulesMap || typeof globalThis.__r !== "function") {
            return null;
          }
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
      }, {
        key: "find",
        value: function find(filterFn) {
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
      }, {
        key: "findByProps",
        value: function findByProps(...props) {
          return this.find(m => (typeof m === "object" || typeof m === "function") && props.every(p => p in m));
        }
      }, {
        key: "findByPropsLazy",
        value: function findByPropsLazy(...props) {
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
      }, {
        key: "findByName",
        value: function findByName(name, defaultExport = true) {
          const mod = this.find(m => m && (m.displayName === name || m.name === name));
          return mod;
        }
      }, {
        key: "findByStoreName",
        value: function findByStoreName(storeName) {
          return this.find(m => m && typeof m.getName === "function" && m.getName() === storeName);
        }
      }, {
        key: "findAssetId",
        value: function findAssetId(assetName) {
          const AssetsRegistry = this.findByProps("registerAsset", "getAssetByID");
          if (!AssetsRegistry) return null;
          for (let id = 1; id < 8000; id++) {
            const asset = AssetsRegistry.getAssetByID(id);
            if (!asset) continue;
            if (asset.name === assetName) return id;
          }
          return null;
        }
      }, {
        key: "waitFor",
        value: function waitFor(filterOrProps, callback) {
          const filter = Array.isArray(filterOrProps) ? m => m && (typeof m === "object" || typeof m === "function") && filterOrProps.every(p => p in m) : typeof filterOrProps === "string" ? m => m && (typeof m === "object" || typeof m === "function") && (filterOrProps in m || m.displayName === filterOrProps || m.name === filterOrProps) : filterOrProps;
          const existing = this.find(filter);
          if (existing) {
            callback(existing);
            return () => {};
          }
          const sub = {
            filter,
            callback
          };
          this.waitSubscriptions.add(sub);
          return () => this.waitSubscriptions.delete(sub);
        }
      }, {
        key: "Common",
        get: function () {
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
      }]);
    }();
    const Patcher = new PatcherAndModuleEngine();
    const Webpack = Patcher;
    const Metro = Patcher;

    // --- Module: src/core/PluginManager.js ---
    /**
     * VencordForAndroid v0.0.4 - PluginManager & Internal Plugin APIs
     * Follows Vendicated/Vencord/src/api/PluginManager.ts (Flux events, MessageEventsAPI, CommandsAPI, Patches, Settings).
     */
    function definePlugin(definition) {
      const options = definition.options || definition.settings?.def || {};
      return {
        name: definition.name,
        description: definition.description || "",
        authors: definition.authors || [{
          name: "Vendicated"
        }, {
          name: "juli22292"
        }],
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
    let PluginManagerService = /*#__PURE__*/function () {
      function PluginManagerService() {
        _classCallCheck(this, PluginManagerService);
        this.plugins = Object.create(null);
        this.registry = new Map();
        this.running = new Set();
        this.fluxUnsubscribers = new Map();
        this.preSendListeners = new Map();
        this.preEditListeners = new Map();
        this._messageEventsHooked = false;
      }
      return _createClass(PluginManagerService, [{
        key: "register",
        value: function register(plugin) {
          if (!plugin || !plugin.name) return;
          this.plugins[plugin.name] = plugin;
          this.registry.set(plugin.name, plugin);
          if (plugin.settings) {
            plugin.settings.pluginName = plugin.name;
          }
          const defaultOptions = {};
          if (plugin.options) {
            for (const [key, opt] of Object.entries(plugin.options)) {
              defaultOptions[key] = opt.default !== undefined ? opt.default : Array.isArray(opt.options) ? opt.options.find(option => option.default)?.value : undefined;
            }
          }
          Settings.getPluginConfig(plugin.name, {
            enabledByDefault: plugin.enabledByDefault || plugin.required,
            defaultOptions
          });
        }
      }, {
        key: "registerAll",
        value: function registerAll(pluginList) {
          const sorted = [...pluginList].sort((a, b) => a.name.localeCompare(b.name));
          for (const p of sorted) {
            this.register(p);
          }
        }
      }, {
        key: "getAllPlugins",
        value: function getAllPlugins() {
          return Array.from(this.registry.values()).map(plugin => {
            const cfg = Settings.getPluginConfig(plugin.name);
            const available = this._isAvailable(plugin);
            return {
              ...plugin,
              available,
              enabled: available && Boolean(plugin.required || cfg.enabled),
              running: this.running.has(plugin.name),
              optionValues: {
                ...(cfg.options || {})
              }
            };
          });
        }
      }, {
        key: "getPlugin",
        value: function getPlugin(name) {
          return this.registry.get(name) || null;
        }
      }, {
        key: "_isAvailable",
        value: function _isAvailable(plugin) {
          return Boolean(plugin.required || plugin.start || plugin.flux || plugin.onBeforeMessageSend || plugin.onBeforeMessageEdit);
        }
      }, {
        key: "isPluginEnabled",
        value: function isPluginEnabled(name) {
          const plugin = this.getPlugin(name);
          if (!plugin || !this._isAvailable(plugin)) return false;
          if (plugin.required || plugin.isDependency) return true;
          return Boolean(Settings.getPluginConfig(name).enabled);
        }
      }, {
        key: "isEnabled",
        value: function isEnabled(name) {
          return this.isPluginEnabled(name);
        }
      }, {
        key: "_ensureMessageEventsHooked",
        value: function _ensureMessageEventsHooked() {
          if (this._messageEventsHooked) return;
          const MessageActions = Patcher.findByProps("sendMessage", "editMessage");
          if (!MessageActions) return;
          this._messageEventsHooked = true;
          Patcher.before("VencordMessageEventsAPI", MessageActions, "sendMessage", args => {
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
          Patcher.before("VencordMessageEventsAPI", MessageActions, "editMessage", args => {
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
      }, {
        key: "initPluginManager",
        value: function initPluginManager() {
          // Resolve dependencies and register declarative patches for enabled plugins
          for (const plugin of this.registry.values()) {
            if (!this.isPluginEnabled(plugin.name)) continue;
            if (Settings.get("safeMode") && !plugin.required) continue;
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
      }, {
        key: "startAllEnabled",
        value: function startAllEnabled() {
          this.initPluginManager();
          if (Settings.get("safeMode")) {
            console.warn("[VencordForAndroid] Safe Mode active: starting required core plugins only.");
          }
          for (const plugin of this.registry.values()) {
            const shouldStart = plugin.required || !Settings.get("safeMode") && this.isPluginEnabled(plugin.name);
            if (shouldStart) {
              this.startPlugin(plugin.name);
            }
          }
        }
      }, {
        key: "startPlugin",
        value: function startPlugin(nameOrPlugin) {
          const plugin = typeof nameOrPlugin === "string" ? this.getPlugin(nameOrPlugin) : nameOrPlugin;
          if (!plugin || !this._isAvailable(plugin) || this.running.has(plugin.name)) return false;
          if (Settings.get("safeMode") && !plugin.required) return false;
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
              if (typeof FluxDispatcher?.subscribe === "function" && typeof FluxDispatcher.unsubscribe === "function") {
                const unsubs = [];
                this.fluxUnsubscribers.set(plugin.name, unsubs);
                for (const [eventName, handler] of Object.entries(plugin.flux)) {
                  if (typeof handler === "function") {
                    const bound = handler.bind(plugin);
                    FluxDispatcher.subscribe(eventName, bound);
                    unsubs.push(() => FluxDispatcher.unsubscribe(eventName, bound));
                  }
                }
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
            this._disposePlugin(plugin);
            return false;
          }
        }
      }, {
        key: "_disposePlugin",
        value: function _disposePlugin(plugin) {
          try {
            plugin.stop?.({
              patcher: Patcher
            });
          } catch (err) {
            console.error(`[VencordForAndroid:PluginManager] Failed to stop ${plugin.name}:`, err);
          }
          Patcher.unpatchAll(plugin.name);
          const unsubs = this.fluxUnsubscribers.get(plugin.name) || [];
          for (const unsubscribe of unsubs) {
            try {
              unsubscribe();
            } catch (err) {
              console.error(`[VencordForAndroid:PluginManager] Failed to unsubscribe ${plugin.name}:`, err);
            }
          }
          this.fluxUnsubscribers.delete(plugin.name);
          this.preSendListeners.delete(plugin.name);
          this.preEditListeners.delete(plugin.name);
          plugin.started = false;
          this.running.delete(plugin.name);
        }
      }, {
        key: "stopPlugin",
        value: function stopPlugin(nameOrPlugin) {
          const plugin = typeof nameOrPlugin === "string" ? this.getPlugin(nameOrPlugin) : nameOrPlugin;
          if (!plugin || plugin.required) return false;
          if (this.running.has(plugin.name)) this._disposePlugin(plugin);
          Settings.setPluginEnabled(plugin.name, false);
          return true;
        }
      }, {
        key: "togglePlugin",
        value: function togglePlugin(name) {
          return this.setPluginEnabled(name, !this.isPluginEnabled(name));
        }
      }, {
        key: "setPluginEnabled",
        value: function setPluginEnabled(name, enabled) {
          const plugin = this.getPlugin(name);
          if (!plugin || !this._isAvailable(plugin) || plugin.required || Settings.get("safeMode")) return false;
          return enabled ? this.startPlugin(plugin) : this.stopPlugin(plugin);
        }
      }, {
        key: "setSafeMode",
        value: function setSafeMode(enabled) {
          Settings.set("safeMode", enabled);
          if (enabled) {
            for (const name of this.running) {
              const plugin = this.getPlugin(name);
              if (plugin && !plugin.required) this._disposePlugin(plugin);
            }
          } else {
            this.startAllEnabled();
          }
        }
      }, {
        key: "stopAll",
        value: function stopAll() {
          for (const name of Array.from(this.running)) {
            const p = this.getPlugin(name);
            if (p && !p.required) {
              this.stopPlugin(name);
            }
          }
        }
      }, {
        key: "uninstallAll",
        value: function uninstallAll() {
          for (const name of Array.from(this.running)) {
            this._disposePlugin(this.getPlugin(name));
          }
          Patcher.unpatchAll();
          this._messageEventsHooked = false;
          Settings.wipeAll();
          this.registry.clear();
          for (const name of Object.keys(this.plugins)) delete this.plugins[name];
        }
      }]);
    }();
    const PluginManager = new PluginManagerService();

    // --- Module: src/core/Updater.js ---
    /**
     * VencordForAndroid v0.0.4 - In-App Updater
     * Follows Vendicated/Vencord/src/utils/updater.ts and Vencord/Vendroid/VencordUpdater.java
     * Pulls updates exclusively from https://github.com/juli22292/vencordforandroid
     */
    const MIN_REQUIRED_VERSION = "0.0.2";
    const CORRUPTED_VERSIONS = ["0.0.1"];
    const CORE_REPO = "juli22292/vencordforandroid";
    const INSTALLER_REPO = "juli22292/vencordandroidapp";
    const CORE_RELEASES_API = `https://api.github.com/repos/${CORE_REPO}/releases/latest`;
    const CORE_MANIFEST_URL = `https://raw.githubusercontent.com/${CORE_REPO}/main/dist/manifest.json`;
    const CORE_BUNDLE_URL = `https://raw.githubusercontent.com/${CORE_REPO}/main/dist/vencordforandroid.js`;
    function parseReleaseVersion(value) {
      const version = typeof value === "string" ? value.trim().replace(/^v/i, "") : "";
      return /^\d+\.\d+\.\d+$/.test(version) ? version : null;
    }
    async function fetchUpdateMetadata(url) {
      const response = await fetch(url, {
        cache: "no-store",
        headers: {
          Accept: "application/json"
        }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    }
    let UpdaterService = /*#__PURE__*/function () {
      function UpdaterService() {
        _classCallCheck(this, UpdaterService);
        this.lastCheck = null;
        this.latestVersion = CORE_VERSION;
        this.latestHash = "main";
        this.updateAvailable = false;
        this.hasPendingRestart = false;
        this.changes = [];
        this.corruptedVersions = [...CORRUPTED_VERSIONS];
        this.releaseNotes = "";
        this.downloadUrl = null;
        this.status = "idle";
        this.errorMessage = null;
      }
      return _createClass(UpdaterService, [{
        key: "canApplyUpdate",
        get: function () {
          return !!this.downloadUrl && typeof globalThis.__VENCORD_NATIVE_BRIDGE__?.saveBundleUpdate === "function";
        }
      }, {
        key: "compareVersions",
        value: function compareVersions(current, remote) {
          const clean = v => String(v || "0.0.0").replace(/^v/i, "").split(".").map(n => parseInt(n, 10) || 0);
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
      }, {
        key: "isVersionCorrupted",
        value: function isVersionCorrupted(versionStr) {
          const cleanVer = String(versionStr || "").replace(/^v/i, "").trim();
          if (!parseReleaseVersion(cleanVer)) return false;
          return this.corruptedVersions.includes(cleanVer) || this.compareVersions(cleanVer, MIN_REQUIRED_VERSION) > 0;
        }
      }, {
        key: "checkForUpdates",
        value: async function checkForUpdates() {
          this.status = "checking";
          this.errorMessage = null;
          try {
            const [manifestResult, releaseResult] = await Promise.allSettled([fetchUpdateMetadata(CORE_MANIFEST_URL), fetchUpdateMetadata(CORE_RELEASES_API)]);
            const manifest = manifestResult.value;
            const release = releaseResult.value;
            const manifestVersion = parseReleaseVersion(manifest?.version);
            const releaseVersion = parseReleaseVersion(release?.tag_name);
            if (!manifestVersion && !releaseVersion) {
              const unavailable = [manifestResult, releaseResult].every(result => result.reason?.message === "HTTP 404");
              throw new Error(unavailable ? "GitHub-Releases sind ohne Anmeldung nicht zugänglich. Öffne die Releases im Browser." : "Die Update-Informationen konnten nicht geladen werden.");
            }
            if (Array.isArray(manifest?.corruptedVersions)) {
              this.corruptedVersions = manifest.corruptedVersions.filter(version => parseReleaseVersion(version) === version);
            }
            const useRelease = releaseVersion && (!manifestVersion || this.compareVersions(manifestVersion, releaseVersion) >= 0);
            const remoteVersion = useRelease ? releaseVersion : manifestVersion;
            const releaseAssetUrl = useRelease ? `https://github.com/${CORE_REPO}/releases/download/${release.tag_name}/vencordforandroid.js` : null;
            const hasReleaseBundle = useRelease && Array.isArray(release.assets) && release.assets.some(asset => asset?.name === "vencordforandroid.js" && asset.browser_download_url === releaseAssetUrl);
            this.lastCheck = new Date().toISOString();
            this.latestVersion = remoteVersion;
            this.latestHash = remoteVersion === manifestVersion && /^[0-9a-f]{64}$/.test(manifest.sha256) ? manifest.sha256.slice(0, 7) : "main";
            this.releaseNotes = useRelease ? release.body || "" : manifest.changelog || "";
            this.downloadUrl = hasReleaseBundle ? releaseAssetUrl : remoteVersion === manifestVersion ? CORE_BUNDLE_URL : null;
            this.updateAvailable = this.compareVersions(CORE_VERSION, remoteVersion) > 0 && !this.isVersionCorrupted(remoteVersion);
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
            this.updateAvailable = false;
            this.downloadUrl = null;
            return {
              currentVersion: CORE_VERSION,
              latestVersion: this.latestVersion,
              updateAvailable: false,
              error: this.errorMessage,
              repository: CORE_REPO
            };
          }
        }
      }, {
        key: "downloadAndApplyUpdate",
        value: async function downloadAndApplyUpdate() {
          if (this.status === "downloading") return {
            success: false
          };
          this.status = "downloading";
          this.errorMessage = null;
          try {
            if (!this.updateAvailable || !this.canApplyUpdate) {
              throw new Error("Installiere das Update über die aktuelle VencordAndroidApp.");
            }
            const version = this.latestVersion;
            const res = await fetch(this.downloadUrl, {
              cache: "no-store"
            });
            if (!res.ok) {
              throw new Error(`HTTP ${res.status}`);
            }
            const bundleCode = await res.text();
            const applied = await globalThis.__VENCORD_NATIVE_BRIDGE__.saveBundleUpdate(bundleCode, version);
            if (applied === false) {
              throw new Error("Das Update konnte nicht gespeichert werden.");
            }
            this.updateAvailable = false;
            this.hasPendingRestart = true;
            this.status = "restart-required";
            return {
              success: true,
              installedVersion: version
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
      }]);
    }();
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
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
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
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Chat", "Messages"],
      enabledByDefault: false
    });
    const AlwaysAnimate = definePlugin({
      name: "AlwaysAnimate",
      description: "Animates anything that can be animated",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Appearance", "Media"],
      enabledByDefault: true,
      start({
        patcher
      }) {
        const ImageResolver = patcher.findByProps("getUserAvatarURL", "getGuildIconURL");
        if (ImageResolver) {
          if (typeof ImageResolver.getUserAvatarURL === "function") {
            patcher.before("AlwaysAnimate", ImageResolver, "getUserAvatarURL", args => {
              if (args.length >= 2) args[1] = true;
              return args;
            });
          }
          if (typeof ImageResolver.getGuildIconURL === "function") {
            patcher.before("AlwaysAnimate", ImageResolver, "getGuildIconURL", args => {
              if (args[0] && typeof args[0] === "object") {
                args[0] = {
                  ...args[0],
                  canAnimate: true
                };
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
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Appearance", "Guilds"],
      enabledByDefault: true
    });
    const AlwaysTrust = definePlugin({
      name: "AlwaysTrust",
      description: "Removes the annoying untrusted domain and suspicious file popup",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
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
      start({
        patcher
      }) {
        const MaskedLinkStore = patcher.findByProps("isTrustedDomain");
        if (MaskedLinkStore && typeof MaskedLinkStore.isTrustedDomain === "function") {
          patcher.instead("AlwaysTrust", MaskedLinkStore, "isTrustedDomain", () => true);
        }
      }
    });
    const AnonymiseFileNames = definePlugin({
      name: "AnonymiseFileNames",
      description: "Anonymise uploaded file names",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
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
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Media", "Utility"],
      enabledByDefault: false,
      options: {
        refreshInterval: {
          type: "select",
          label: "Refresh interval (seconds)",
          choices: ["5", "10", "15"],
          default: "10"
        }
      }
    });
    const AutomodContext = definePlugin({
      name: "AutomodContext",
      description: "Allows you to jump to the message surrounding an Automod hit",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Guilds", "Messages"],
      enabledByDefault: false
    });
    const BetterFolders = definePlugin({
      name: "BetterFolders",
      description: "Shows server folders on dedicated sidebar and allows auto-closing folders",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Appearance", "Guilds"],
      enabledByDefault: false,
      options: {
        closeAllFolders: {
          type: "boolean",
          label: "Close all folders on startup",
          default: false
        },
        closeOthers: {
          type: "boolean",
          label: "Close other folders when opening a folder",
          default: true
        },
        forceOpen: {
          type: "boolean",
          label: "Force open folder of selected server",
          default: true
        }
      }
    });
    const BetterGifAltText = definePlugin({
      name: "BetterGifAltText",
      description: "Change GIF alt text from simply being 'GIF' to containing the GIF's tags/title",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Media", "Appearance"],
      enabledByDefault: false
    });
    const BetterGifPicker = definePlugin({
      name: "BetterGifPicker",
      description: "Makes the gif picker open the favorite category by default",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Media", "Chat"],
      enabledByDefault: true
    });
    const BetterNotesBox = definePlugin({
      name: "BetterNotesBox",
      description: "Hide notes or disable spellcheck in user profile notes",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Appearance", "Utility"],
      enabledByDefault: false,
      options: {
        hide: {
          type: "boolean",
          label: "Hide the notes box in user profiles",
          default: false
        },
        noSpellCheck: {
          type: "boolean",
          label: "Disable spellcheck in notes",
          default: true
        }
      }
    });
    const BetterRoleContext = definePlugin({
      name: "BetterRoleContext",
      description: "Adds options to copy role color / ID / icon when tapping a role in profile popouts",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Guilds", "Utility"],
      enabledByDefault: true,
      options: {
        roleIconFileFormat: {
          type: "select",
          label: "Role icon format",
          choices: ["png", "webp"],
          default: "png"
        }
      }
    });
    const BetterRoleDot = definePlugin({
      name: "BetterRoleDot",
      description: "Copy role colour on RoleDot click and use both RoleDot and coloured names simultaneously",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Appearance", "Guilds"],
      enabledByDefault: false,
      options: {
        bothStyles: {
          type: "boolean",
          label: "Show both RoleDot and coloured usernames",
          default: true
        },
        copyRoleColorInProfilePopout: {
          type: "boolean",
          label: "Tap RoleDot to copy hex color",
          default: true
        }
      }
    });
    const BetterSessions = definePlugin({
      name: "BetterSessions",
      description: "Enhances the active sessions (Devices) page with custom device names and notifications",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Privacy", "Notifications"],
      enabledByDefault: true,
      options: {
        backgroundCheck: {
          type: "boolean",
          label: "Check for new unknown logins in background",
          default: true
        }
      }
    });
    const BetterSettings = definePlugin({
      name: "BetterSettings",
      description: "Enhances your settings menu opening speed and navigation experience",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Appearance", "Shortcuts"],
      enabledByDefault: true,
      options: {
        disableFade: {
          type: "boolean",
          label: "Disable slow fade animation on settings open",
          default: true
        },
        eagerLoad: {
          type: "boolean",
          label: "Eagerly preload all settings tabs",
          default: true
        }
      }
    });
    const BetterUploadButton = definePlugin({
      name: "BetterUploadButton",
      description: "Upload with a single tap instead of opening the attachment menu",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Chat", "Shortcuts"],
      enabledByDefault: false
    });
    const BiggerStreamPreview = definePlugin({
      name: "BiggerStreamPreview",
      description: "This plugin allows you to enlarge stream previews in voice channels",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Voice", "Media"],
      enabledByDefault: true
    });
    const BlurNSFW = definePlugin({
      name: "BlurNSFW",
      description: "Blur attachments in NSFW channels until you tap them",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Privacy", "Media"],
      enabledByDefault: false,
      options: {
        blurAmount: {
          type: "select",
          label: "Blur radius (px)",
          choices: ["5", "10", "20", "30"],
          default: "10"
        }
      }
    });
    const CallTimer = definePlugin({
      name: "CallTimer",
      description: "Adds a live duration timer to any voice call or voice channel",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Voice", "Utility"],
      enabledByDefault: true,
      options: {
        format: {
          type: "select",
          label: "Timer Format",
          choices: ["stopwatch", "human"],
          default: "stopwatch"
        }
      }
    });
    const ClearURLs = definePlugin({
      name: "ClearURLs",
      description: "Removes tracking garbage (utm_*, fbclid, si, igshid) from URLs before sending",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Privacy", "Chat"],
      enabledByDefault: true,
      start({
        patcher
      }) {
        const TRACKING_PARAMS = [/^utm_/i, /^fbclid$/i, /^gclid$/i, /^igshid$/i, /^si$/i, /^mc_eid$/i, /^_hsenc$/i];
        const cleanTextUrls = content => {
          if (typeof content !== "string" || !content.includes("http")) return content;
          return content.replace(/https?:\/\/[^\s<>]+/g, rawUrl => {
            try {
              const url = new URL(rawUrl);
              for (const key of Array.from(url.searchParams.keys())) {
                if (TRACKING_PARAMS.some(rx => rx.test(key))) url.searchParams.delete(key);
              }
              return url.toString();
            } catch {
              return rawUrl;
            }
          });
        };
        const MessageActions = patcher.findByProps("sendMessage", "editMessage");
        if (MessageActions && typeof MessageActions.sendMessage === "function") {
          patcher.before("ClearURLs", MessageActions, "sendMessage", args => {
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
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Appearance"],
      enabledByDefault: false,
      options: {
        color: {
          type: "select",
          label: "Accent Color Hex",
          choices: ["#313338", "#1e1f22", "#5865f2", "#111214", "#23a55a"],
          default: "#313338"
        }
      }
    });
    const ColorSighted = definePlugin({
      name: "ColorSighted",
      description: "Removes the colorblind-friendly icons from status indicators, leaving pure round status dots",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Appearance"],
      enabledByDefault: false
    });
    const ConsoleJanitor = definePlugin({
      name: "ConsoleJanitor",
      description: "Disables annoying console logs and warnings from Discord internals",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Utility"],
      enabledByDefault: false,
      options: {
        disableLoggers: {
          type: "boolean",
          label: "Disable verbose Discord loggers",
          default: true
        },
        disableSpotifyLogger: {
          type: "boolean",
          label: "Disable Spotify polling logs",
          default: true
        }
      }
    });
    const ConsoleShortcuts = definePlugin({
      name: "ConsoleShortcuts",
      description: "Adds shorter aliases for common debugging functions on the global window object",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Utility"],
      enabledByDefault: false
    });
    const CopyEmojiMarkdown = definePlugin({
      name: "CopyEmojiMarkdown",
      description: "Allows you to copy the raw markdown (<:name:id>) of an emoji from its popout",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Chat", "Utility"],
      enabledByDefault: true,
      options: {
        copyUnicode: {
          type: "boolean",
          label: "Copy unicode character for standard emojis",
          default: true
        }
      }
    });
    const CopyFileContents = definePlugin({
      name: "CopyFileContents",
      description: "Adds a button to text file attachments to copy their contents to clipboard",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Chat", "Utility"],
      enabledByDefault: true
    });
    const CopyUserURLs = definePlugin({
      name: "CopyUserURLs",
      description: "Adds a 'Copy User URL' (<https://discord.com/users/id>) entry to user profiles",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Friends", "Utility"],
      enabledByDefault: true
    });
    const CrashHandler = definePlugin({
      name: "CrashHandler",
      description: "Utility plugin for handling and recovering from Discord UI crashes without restarting",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Utility"],
      enabledByDefault: true,
      options: {
        attemptToPreventCrashes: {
          type: "boolean",
          label: "Attempt to recover React tree without reloading",
          default: true
        },
        attemptToNavigateToHome: {
          type: "boolean",
          label: "Navigate to Home DM tab on fatal channel crash",
          default: false
        }
      }
    });
    const CtrlEnterSend = definePlugin({
      name: "CtrlEnterSend",
      description: "Customize how the Enter / Send key behaves when typing messages",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Chat", "Shortcuts"],
      enabledByDefault: false,
      options: {
        submitRule: {
          type: "select",
          label: "Submit rule",
          choices: ["ctrl+enter", "shift+enter", "enter"],
          default: "ctrl+enter"
        }
      }
    });
    const CustomIdle = definePlugin({
      name: "CustomIdle",
      description: "Allows you to set a custom idle timeout or disable auto-idle completely",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Utility", "Privacy"],
      enabledByDefault: false,
      options: {
        idleTimeout: {
          type: "select",
          label: "Idle timeout (minutes, 0 = disabled)",
          choices: ["0", "5", "10", "30", "60"],
          default: "10"
        },
        remainInIdle: {
          type: "boolean",
          label: "Remain in auto-idle until manually confirmed",
          default: true
        }
      }
    });
    const CustomRPC = definePlugin({
      name: "CustomRPC",
      description: "Add a fully customisable Rich Presence (Game / Stream / Listening status) to your Discord profile",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Appearance", "Utility"],
      enabledByDefault: false,
      options: {
        appName: {
          type: "select",
          label: "Application Name",
          choices: ["VencordForAndroid", "Visual Studio Code", "Spotify", "Custom"],
          default: "VencordForAndroid"
        },
        type: {
          type: "select",
          label: "Activity Type",
          choices: ["Playing", "Streaming", "Listening", "Watching", "Competing"],
          default: "Playing"
        }
      }
    });
    const Dearrow = definePlugin({
      name: "Dearrow",
      description: "Makes YouTube video titles and thumbnails less clickbaity using CrowdSourced DeArrow data",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Media", "Appearance"],
      enabledByDefault: false,
      options: {
        hideButton: {
          type: "boolean",
          label: "Hide the DeArrow toggle button on embeds",
          default: false
        },
        replaceElements: {
          type: "select",
          label: "Elements to replace",
          choices: ["Everything", "Titles Only", "Thumbnails Only"],
          default: "Everything"
        }
      }
    });
    const Decor = definePlugin({
      name: "Decor",
      description: "Create and use custom avatar decorations for free with other Vencord users",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Appearance"],
      enabledByDefault: true
    });
    const DisableCallIdle = definePlugin({
      name: "DisableCallIdle",
      description: "Disables automatically getting kicked from a DM voice call after 3 minutes alone",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Voice"],
      enabledByDefault: true
    });
    const DontRoundMyTimestamps = definePlugin({
      name: "DontRoundMyTimestamps",
      description: "Prevents Discord from rounding relative timestamps up to the next unit",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Messages", "Appearance"],
      enabledByDefault: false
    });
    const Experiments = definePlugin({
      name: "Experiments",
      description: "Enable Access to Experiments & other dev-only features in Discord!",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Utility"],
      enabledByDefault: true,
      options: {
        toolbarDevMenu: {
          type: "boolean",
          label: "Enable Staging DevMenu in Toolbar",
          default: false
        }
      }
    });
    const FakeNitro = definePlugin({
      name: "FakeNitro",
      description: "Allows you to stream in nitro quality, send fake emojis/stickers, use client themes and custom icons",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Chat", "Media", "Voice"],
      enabledByDefault: true,
      options: {
        enableEmojiBypass: {
          type: "boolean",
          label: "Allow sending external & animated emojis",
          default: true
        },
        emojiSize: {
          type: "select",
          label: "Emoji Size (px)",
          choices: ["32", "48", "64", "96"],
          default: "48"
        },
        enableStickerBypass: {
          type: "boolean",
          label: "Allow sending custom stickers",
          default: true
        },
        stickerSize: {
          type: "select",
          label: "Sticker Size (px)",
          choices: ["128", "160", "200"],
          default: "160"
        },
        enableStreamQualityBypass: {
          type: "boolean",
          label: "Unlock 1080p/1440p 60fps screenshare",
          default: true
        },
        useHyperLinks: {
          type: "boolean",
          label: "Use masked hyperlinks for fake emojis",
          default: true
        }
      },
      start({
        patcher
      }) {
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
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Appearance"],
      enabledByDefault: true,
      options: {
        nitroFirst: {
          type: "boolean",
          label: "Prefer real Nitro theme colors if present",
          default: true
        }
      }
    });
    const FavoriteEmojiFirst = definePlugin({
      name: "FavoriteEmojiFirst",
      description: "Puts your favorite emojis first in the emoji autocomplete list",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Chat", "Shortcuts"],
      enabledByDefault: true
    });
    const FavoriteGifSearch = definePlugin({
      name: "FavoriteGifSearch",
      description: "Adds a search bar to your favorite gifs menu",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Media", "Chat"],
      enabledByDefault: true,
      options: {
        searchOption: {
          type: "select",
          label: "Search target",
          choices: ["Url & Title", "Url Only", "Title Only"],
          default: "Url & Title"
        }
      }
    });
    const FixCodeblockGap = definePlugin({
      name: "FixCodeblockGap",
      description: "Removes the awkward empty gap below codeblocks in messages",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Appearance", "Messages"],
      enabledByDefault: true
    });
    const FixImagesQuality = definePlugin({
      name: "FixImagesQuality",
      description: "Improves quality of images in chat by forcing original WebP/PNG resolution",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Media", "Appearance"],
      enabledByDefault: true
    });
    const FixSpotifyEmbeds = definePlugin({
      name: "FixSpotifyEmbeds",
      description: "Fixes spotify embeds being way too loud by letting you configure their default volume",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Media"],
      enabledByDefault: false,
      options: {
        volume: {
          type: "select",
          label: "Spotify Embed Volume (%)",
          choices: ["10", "25", "50", "75", "100"],
          default: "25"
        }
      }
    });
    const FixYoutubeEmbeds = definePlugin({
      name: "FixYoutubeEmbeds",
      description: "Bypasses youtube videos being blocked from playing inside Discord embeds",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Media"],
      enabledByDefault: true
    });
    const ForceOwnerCrown = definePlugin({
      name: "ForceOwnerCrown",
      description: "Force the owner crown next to usernames even if the server is very large",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Appearance", "Guilds"],
      enabledByDefault: true
    });
    const FriendInvites = definePlugin({
      name: "FriendInvites",
      description: "Create and manage friend invite links via slash commands (/create friend invite)",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Friends", "Utility"],
      enabledByDefault: false
    });
    const FriendsSince = definePlugin({
      name: "FriendsSince",
      description: "Displays when you became friends with someone in their user profile popout",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Friends", "Appearance"],
      enabledByDefault: true
    });
    const FullSearchContext = definePlugin({
      name: "FullSearchContext",
      description: "Makes the message context menu in search results have all standard options",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Messages", "Utility"],
      enabledByDefault: true
    });
    const GameActivityToggle = definePlugin({
      name: "GameActivityToggle",
      description: "Adds a button next to the mic and deafen button to toggle game activity visibility",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Appearance", "Privacy"],
      enabledByDefault: false,
      options: {
        oldIcon: {
          type: "boolean",
          label: "Use classic controller icon",
          default: false
        }
      }
    });
    const GifPaste = definePlugin({
      name: "GifPaste",
      description: "Makes picking a GIF in the gif picker insert a link into the chatbox instead of instantly sending it",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Chat", "Media"],
      enabledByDefault: false
    });
    const GreetStickerPicker = definePlugin({
      name: "GreetStickerPicker",
      description: "Allows you to use any welcome sticker instead of only the random default sticker",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Chat"],
      enabledByDefault: false,
      options: {
        greetMode: {
          type: "select",
          label: "Greet mode",
          choices: ["Greet", "Normal Message"],
          default: "Greet"
        }
      }
    });
    const HideAttachments = definePlugin({
      name: "HideAttachments",
      description: "Allow hiding attachments and embeds for individual messages via a toggle button",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Media", "Messages"],
      enabledByDefault: false
    });
    const IgnoreActivities = definePlugin({
      name: "IgnoreActivities",
      description: "Ignore specific activities from showing up on your status or others' profiles",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Privacy", "Appearance"],
      enabledByDefault: false,
      options: {
        ignorePlaying: {
          type: "boolean",
          label: "Hide all 'Playing' statuses",
          default: false
        },
        ignoreStreaming: {
          type: "boolean",
          label: "Hide all 'Streaming' statuses",
          default: false
        },
        ignoreListening: {
          type: "boolean",
          label: "Hide all 'Listening' statuses",
          default: false
        }
      }
    });
    const iLoveSpam = definePlugin({
      name: "iLoveSpam",
      description: "Do not collapse messages from 'likely spammers' automatically",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Chat", "Messages"],
      enabledByDefault: false
    });
    const ImageFilename = definePlugin({
      name: "ImageFilename",
      description: "Display the file name of images & videos as a tooltip / overlay",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Media", "Appearance"],
      enabledByDefault: false,
      options: {
        showFullUrl: {
          type: "boolean",
          label: "Show full CDN URL instead of filename only",
          default: false
        }
      }
    });
    const ImageZoom = definePlugin({
      name: "ImageZoom",
      description: "Lets you zoom in to images and gifs inside Discord with a magnifier lens",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Media"],
      enabledByDefault: true,
      options: {
        size: {
          type: "select",
          label: "Lens Size",
          choices: ["100", "200", "300"],
          default: "200"
        },
        zoom: {
          type: "select",
          label: "Zoom Multiplier",
          choices: ["2", "3", "4"],
          default: "2"
        },
        nearestNeighbour: {
          type: "boolean",
          label: "Use Nearest Neighbour (pixel art mode)",
          default: false
        }
      }
    });
    const ImplicitRelationships = definePlugin({
      name: "ImplicitRelationships",
      description: "Shows your implicit relationships (Discord affinity score) in the Friends tab",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Friends"],
      enabledByDefault: false,
      options: {
        sortByAffinity: {
          type: "boolean",
          label: "Sort friends by affinity score",
          default: true
        }
      }
    });
    const InvisibleChat = definePlugin({
      name: "InvisibleChat",
      description: "Encrypt your messages in invisible zero-width characters so only Vencord users can read them",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Privacy", "Chat"],
      enabledByDefault: false,
      options: {
        savedPasswords: {
          type: "select",
          label: "Default Decryption Key",
          choices: ["password", "vencord", "secret"],
          default: "password"
        }
      }
    });
    const KeepCurrentChannel = definePlugin({
      name: "KeepCurrentChannel",
      description: "Attempt to navigate back to the exact channel you had open before restarting Discord",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Utility", "Shortcuts"],
      enabledByDefault: true
    });
    const LastFMRichPresence = definePlugin({
      name: "LastFMRichPresence",
      description: "Little plugin for Last.fm rich presence status",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Media", "Appearance"],
      enabledByDefault: false,
      options: {
        shareUsername: {
          type: "boolean",
          label: "Show Last.fm profile link button",
          default: false
        },
        hideWithSpotify: {
          type: "boolean",
          label: "Hide status if Spotify is already running",
          default: true
        }
      }
    });
    const LoadingQuotes = definePlugin({
      name: "LoadingQuotes",
      description: "Replace Discord's loading quotes with custom Vencord quotes",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Appearance"],
      enabledByDefault: true,
      options: {
        replaceEvents: {
          type: "boolean",
          label: "Replace special event loading quotes too",
          default: true
        },
        enablePluginPresetQuotes: {
          type: "boolean",
          label: "Include built-in Vencord quotes",
          default: true
        }
      }
    });
    const MemberCount = definePlugin({
      name: "MemberCount",
      description: "Shows the amount of online and total members in the server member list and tooltip",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Guilds", "Appearance"],
      enabledByDefault: true,
      options: {
        toolTip: {
          type: "boolean",
          label: "Show member count on server icon tooltip",
          default: true
        },
        memberList: {
          type: "boolean",
          label: "Show member count at the top of member list",
          default: true
        }
      }
    });
    const MentionAvatars = definePlugin({
      name: "MentionAvatars",
      description: "Shows user avatars inside @mentions in chat",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Appearance", "Messages"],
      enabledByDefault: false,
      options: {
        showAtSymbol: {
          type: "boolean",
          label: "Keep the @ symbol next to the avatar",
          default: true
        }
      }
    });
    const MessageClickActions = definePlugin({
      name: "MessageClickActions",
      description: "Double-tap a message to quick-reply or edit your own message",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Chat", "Shortcuts"],
      enabledByDefault: true,
      options: {
        enableDeleteOnClick: {
          type: "boolean",
          label: "Enable quick delete on modifier click",
          default: true
        },
        enableDoubleClickToEdit: {
          type: "boolean",
          label: "Double tap own message to edit",
          default: true
        },
        enableDoubleClickToReply: {
          type: "boolean",
          label: "Double tap others' message to reply",
          default: true
        }
      }
    });
    const MessageLatency = definePlugin({
      name: "MessageLatency",
      description: "Displays an indicator for messages that took >= N seconds to arrive",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Messages", "Utility"],
      enabledByDefault: false,
      options: {
        latency: {
          type: "select",
          label: "Threshold in seconds",
          choices: ["1", "2", "5"],
          default: "2"
        },
        detectDiscordKotlin: {
          type: "boolean",
          label: "Detect old Discord Android Kotlin clients",
          default: true
        },
        showMillis: {
          type: "boolean",
          label: "Show milliseconds precision",
          default: false
        }
      }
    });
    const MessageLinkEmbeds = definePlugin({
      name: "MessageLinkEmbeds",
      description: "Previews the contents of linked Discord messages directly in chat",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Messages", "Chat"],
      enabledByDefault: true,
      options: {
        messageBackgroundColor: {
          type: "boolean",
          label: "Use distinct background color for embeds",
          default: false
        },
        automodEmbeds: {
          type: "select",
          label: "Embed in Automod messages",
          choices: ["never", "prefer", "always"],
          default: "never"
        }
      }
    });
    const MessageLogger = definePlugin({
      name: "MessageLogger",
      description: "Temporarily logs deleted and edited messages in chat",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Messages", "Chat", "Utility"],
      enabledByDefault: true,
      options: {
        deleteStyle: {
          type: "select",
          label: "Deleted message style",
          choices: ["text", "overlay"],
          default: "text"
        },
        logDeletes: {
          type: "boolean",
          label: "Log deleted messages in red",
          default: true
        },
        collapseDeleted: {
          type: "boolean",
          label: "Collapse deleted messages by default",
          default: false
        },
        logEdits: {
          type: "boolean",
          label: "Log message edit history inline",
          default: true
        },
        inlineEdits: {
          type: "boolean",
          label: "Display edited history inline",
          default: true
        },
        ignoreBots: {
          type: "boolean",
          label: "Ignore messages sent by bots",
          default: false
        },
        ignoreSelf: {
          type: "boolean",
          label: "Ignore messages sent by yourself",
          default: false
        }
      },
      start({
        patcher
      }) {
        const FluxDispatcher = patcher.findByProps("dispatch", "subscribe");
        if (FluxDispatcher && typeof FluxDispatcher.dispatch === "function") {
          patcher.before("MessageLogger", FluxDispatcher, "dispatch", args => {
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
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Chat", "Shortcuts"],
      enabledByDefault: false,
      options: {
        clyde: {
          type: "boolean",
          label: "Send confirmation messages via Clyde",
          default: true
        }
      }
    });
    const MoreCommands = definePlugin({
      name: "MoreCommands",
      description: "Adds various fun and useful slash commands (/echo, /lenny, /mock, /shrug)",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Chat"],
      enabledByDefault: false
    });
    const MoreKaomoji = definePlugin({
      name: "MoreKaomoji",
      description: "Adds more Kaomoji to Discord's built-in slash commands",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Chat"],
      enabledByDefault: false
    });
    const MoreUserTags = definePlugin({
      name: "MoreUserTags",
      description: "Adds tags for webhooks and moderation roles (Owner, Admin, Mod, Staff, Voice) in chat",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Appearance", "Guilds"],
      enabledByDefault: false,
      options: {
        dontShowForBots: {
          type: "boolean",
          label: "Don't show role tags for bots",
          default: false
        },
        dontShowBotTag: {
          type: "boolean",
          label: "Hide default BOT tag when role tag is shown",
          default: false
        }
      }
    });
    const Moyai = definePlugin({
      name: "Moyai",
      description: "🗿 Vine boom sound effect whenever someone sends or reacts with 🗿",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Chat", "Media"],
      enabledByDefault: false,
      options: {
        volume: {
          type: "select",
          label: "Moyai Volume (%)",
          choices: ["25", "50", "75", "100"],
          default: "50"
        },
        triggerWhenUnfocused: {
          type: "boolean",
          label: "Trigger even when Discord is in background",
          default: true
        },
        ignoreBots: {
          type: "boolean",
          label: "Ignore bots",
          default: true
        }
      }
    });
    const MutualGroupDMs = definePlugin({
      name: "MutualGroupDMs",
      description: "Shows mutual group DMs in user profiles next to Mutual Servers and Mutual Friends",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Friends", "Appearance"],
      enabledByDefault: true
    });
    const NewGuildSettings = definePlugin({
      name: "NewGuildSettings",
      description: "Automatically mute new servers or apply default notification preferences upon joining",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Guilds", "Notifications"],
      enabledByDefault: false,
      options: {
        guild: {
          type: "boolean",
          label: "Mute new server automatically",
          default: false
        },
        everyone: {
          type: "boolean",
          label: "Suppress @everyone and @here",
          default: true
        },
        role: {
          type: "boolean",
          label: "Suppress all role @mentions",
          default: true
        },
        highlights: {
          type: "boolean",
          label: "Suppress Community Highlights",
          default: true
        },
        muteScheduledEvents: {
          type: "boolean",
          label: "Mute new scheduled events",
          default: false
        }
      }
    });
    const NoBlockedMessages = definePlugin({
      name: "NoBlockedMessages",
      description: "Hides all blocked messages from chat completely",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Chat", "Appearance"],
      enabledByDefault: false,
      options: {
        ignoreBlockedMessages: {
          type: "boolean",
          label: "Also ignore unread indicators from blocked users",
          default: true
        }
      }
    });
    const NoDevtoolsWarning = definePlugin({
      name: "NoDevtoolsWarning",
      description: "Disables the 'Hold Up!' console warning and prevents Self-XSS token logging",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Utility", "Privacy"],
      enabledByDefault: true
    });
    const NoF1 = definePlugin({
      name: "NoF1",
      description: "Disables F1 help bind inside Discord",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Shortcuts"],
      enabledByDefault: true
    });
    const NoMaskedUrlPaste = definePlugin({
      name: "NoMaskedUrlPaste",
      description: "Pasting a link while having text selected will not paste as a masked URL",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Chat"],
      enabledByDefault: false
    });
    const NoMosaic = definePlugin({
      name: "NoMosaic",
      description: "Removes Discord image mosaic layout so multiple images stack cleanly",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Media", "Appearance"],
      enabledByDefault: false,
      options: {
        inlineVideo: {
          type: "boolean",
          label: "Apply to multiple videos in a single message too",
          default: true
        }
      }
    });
    const NoOnboardingDelay = definePlugin({
      name: "NoOnboardingDelay",
      description: "Skips the slow onboarding delay when joining a community server",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Guilds"],
      enabledByDefault: true
    });
    const NoPendingCount = definePlugin({
      name: "NoPendingCount",
      description: "Removes the ping count of incoming friend requests, message requests, and nitro offers",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Notifications", "Appearance"],
      enabledByDefault: false,
      options: {
        hideFriendRequestsCount: {
          type: "boolean",
          label: "Hide incoming friend requests count",
          default: true
        },
        hideMessageRequestsCount: {
          type: "boolean",
          label: "Hide message requests badge",
          default: true
        },
        hidePremiumOffersCount: {
          type: "boolean",
          label: "Hide Nitro promotion badges",
          default: true
        }
      }
    });
    const NoProfileThemes = definePlugin({
      name: "NoProfileThemes",
      description: "Completely removes Nitro profile themes from everyone's profile popouts",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Appearance"],
      enabledByDefault: false
    });
    const NoReplyMention = definePlugin({
      name: "NoReplyMention",
      description: "Automatically sets replies to not ping the target user by default",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Chat", "Notifications"],
      enabledByDefault: true,
      options: {
        shouldPingListed: {
          type: "boolean",
          label: "Ping users in exception list instead of ignoring them",
          default: true
        },
        inverseShiftReply: {
          type: "boolean",
          label: "Invert shift key behavior when replying",
          default: false
        }
      },
      start({
        patcher
      }) {
        const ReplyActions = patcher.findByProps("createPendingReply");
        if (ReplyActions && typeof ReplyActions.createPendingReply === "function") {
          patcher.before("NoReplyMention", ReplyActions, "createPendingReply", args => {
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
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Privacy"],
      enabledByDefault: false
    });
    const NoScreensharePreview = definePlugin({
      name: "NoScreensharePreview",
      description: "Disables screenshare previews from being sent to reduce mobile data & battery usage",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Voice", "Privacy"],
      enabledByDefault: false
    });
    const NoServerEmojis = definePlugin({
      name: "NoServerEmojis",
      description: "Do not show other servers' emojis in the emoji autocomplete menu",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Chat"],
      enabledByDefault: false,
      options: {
        shownEmojis: {
          type: "select",
          label: "Shown emojis",
          choices: ["Only Unicode", "Unicode & Current Server"],
          default: "Unicode & Current Server"
        }
      }
    });
    const NoSystemBadge = definePlugin({
      name: "NoSystemBadge",
      description: "Disables the unread badge count on the system launcher icon",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Notifications"],
      enabledByDefault: false
    });
    const NoTypingAnimation = definePlugin({
      name: "NoTypingAnimation",
      description: "Disables the CPU-intensive typing dots animation in the bottom chat bar",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Appearance", "Utility"],
      enabledByDefault: false
    });
    const NoUnblockToJump = definePlugin({
      name: "NoUnblockToJump",
      description: "Allows you to jump to messages of blocked users in search without unblocking them",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Messages", "Utility"],
      enabledByDefault: true
    });
    const NormalizeMessageLinks = definePlugin({
      name: "NormalizeMessageLinks",
      description: "Strips canary/ptb subdomains from message links when copying",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Messages", "Utility"],
      enabledByDefault: true
    });
    const NotificationVolume = definePlugin({
      name: "NotificationVolume",
      description: "Allows you to set a separate custom volume level for in-app Discord notification sounds",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Notifications"],
      enabledByDefault: false,
      options: {
        notificationVolume: {
          type: "select",
          label: "Notification Volume (%)",
          choices: ["10", "25", "50", "75", "100"],
          default: "100"
        }
      }
    });
    const NSFWGateBypass = definePlugin({
      name: "NSFWGateBypass",
      description: "Allows you to access NSFW channels without verifying your age on your account",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Guilds", "Utility"],
      enabledByDefault: true
    });
    const OnePingPerDM = definePlugin({
      name: "OnePingPerDM",
      description: "If unread messages exist in a DM, suppresses further notification sounds until you read them",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Notifications"],
      enabledByDefault: false,
      options: {
        channelToAffect: {
          type: "select",
          label: "Channel types",
          choices: ["Both DMs and Group DMs", "Private DMs Only", "Group DMs Only"],
          default: "Both DMs and Group DMs"
        },
        allowMentions: {
          type: "boolean",
          label: "Always play sound for explicit @mentions",
          default: false
        },
        allowEveryone: {
          type: "boolean",
          label: "Always play sound for @everyone",
          default: false
        }
      }
    });
    const oneko = definePlugin({
      name: "oneko",
      description: "Cat follow cursor / touch point on screen (oneko)",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Appearance"],
      enabledByDefault: false
    });
    const OpenInApp = definePlugin({
      name: "OpenInApp",
      description: "Opens Spotify, Steam, Epic, and Tidal links directly in their native apps",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Utility", "Shortcuts"],
      enabledByDefault: true,
      options: {
        spotify: {
          type: "boolean",
          label: "Open Spotify links in Spotify app",
          default: true
        },
        steam: {
          type: "boolean",
          label: "Open Steam links in Steam app",
          default: true
        },
        epic: {
          type: "boolean",
          label: "Open Epic Games links in app",
          default: true
        },
        tidal: {
          type: "boolean",
          label: "Open Tidal links in Tidal app",
          default: true
        }
      }
    });
    const OverrideForumDefaults = definePlugin({
      name: "OverrideForumDefaults",
      description: "Allows you to override default forum layout (List vs Gallery) and sort order",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Guilds", "Appearance"],
      enabledByDefault: false,
      options: {
        defaultLayout: {
          type: "select",
          label: "Default layout",
          choices: ["List View", "Gallery View"],
          default: "List View"
        },
        defaultSortOrder: {
          type: "select",
          label: "Default sort order",
          choices: ["Recently Active", "Date Posted"],
          default: "Recently Active"
        }
      }
    });
    const PartyMode = definePlugin({
      name: "PartyMode",
      description: "Allows you to use Discord's anniversary Party Mode combos and confetti anytime",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Appearance", "Chat"],
      enabledByDefault: false,
      options: {
        superIntensePartyMode: {
          type: "select",
          label: "Intensity",
          choices: ["Normal", "Better", "Project X"],
          default: "Normal"
        }
      }
    });
    const PauseInvitesForever = definePlugin({
      name: "PauseInvitesForever",
      description: "Brings back the option to pause server invites indefinitely in server settings",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Guilds"],
      enabledByDefault: false
    });
    const PermissionFreeWill = definePlugin({
      name: "PermissionFreeWill",
      description: "Disables client-side permission checks for channel lockouts and server onboarding",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Guilds", "Utility"],
      enabledByDefault: false,
      options: {
        lockout: {
          type: "boolean",
          label: "Bypass channel permission lockout warning",
          default: true
        },
        onboarding: {
          type: "boolean",
          label: "Bypass mandatory onboarding requirements",
          default: true
        }
      }
    });
    const PermissionsViewer = definePlugin({
      name: "PermissionsViewer",
      description: "View the permissions a user or role has, and the roles of a server",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Guilds", "Utility"],
      enabledByDefault: true,
      options: {
        permissionsSortOrder: {
          type: "select",
          label: "Sort method",
          choices: ["Highest Role", "Lowest Role"],
          default: "Highest Role"
        }
      }
    });
    const petpet = definePlugin({
      name: "petpet",
      description: "Adds a /petpet slash command to generate headpat GIFs of any user's avatar",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Chat", "Media"],
      enabledByDefault: false
    });
    const PictureInPicture = definePlugin({
      name: "PictureInPicture",
      description: "Adds picture in picture button on videos inside Discord",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Media"],
      enabledByDefault: true,
      options: {
        loop: {
          type: "boolean",
          label: "Loop PiP videos automatically",
          default: true
        }
      }
    });
    const PinDMs = definePlugin({
      name: "PinDMs",
      description: "Allows you to pin private messages and categorize them at the top of your DM list",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Friends", "Shortcuts"],
      enabledByDefault: true,
      options: {
        pinOrder: {
          type: "select",
          label: "Pin order",
          choices: ["Most Recent", "Custom Order"],
          default: "Custom Order"
        },
        canCollapseDmSection: {
          type: "boolean",
          label: "Allow collapsing DM categories",
          default: true
        }
      }
    });
    const PlainFolderIcon = definePlugin({
      name: "PlainFolderIcon",
      description: "Dont show the small guild icons in server folders",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Appearance", "Guilds"],
      enabledByDefault: false
    });
    const PlatformIndicators = definePlugin({
      name: "PlatformIndicators",
      description: "Adds platform indicators (Desktop, Mobile, Web, Embedded) to users",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Appearance", "Friends"],
      enabledByDefault: true,
      options: {
        list: {
          type: "boolean",
          label: "Show indicators in the member list",
          default: true
        },
        badges: {
          type: "boolean",
          label: "Show indicators as profile badges",
          default: true
        },
        messages: {
          type: "boolean",
          label: "Show indicators next to usernames in chat",
          default: true
        },
        colorMobileIndicator: {
          type: "boolean",
          label: "Color mobile icon with user status color",
          default: true
        }
      }
    });
    const PreviewMessage = definePlugin({
      name: "PreviewMessage",
      description: "Lets you preview your formatted message before sending it",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Chat"],
      enabledByDefault: false
    });
    const QuickMention = definePlugin({
      name: "QuickMention",
      description: "Adds an @ mention button directly to the message actions bar",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Chat", "Shortcuts"],
      enabledByDefault: true
    });
    const QuickReply = definePlugin({
      name: "QuickReply",
      description: "Reply to (and edit) messages via quick shortcut",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Chat", "Shortcuts"],
      enabledByDefault: false,
      options: {
        shouldMention: {
          type: "select",
          label: "Mention mode",
          choices: ["Follow NoReplyMention plugin", "Enabled", "Disabled"],
          default: "Follow NoReplyMention plugin"
        }
      }
    });
    const ReactErrorDecoder = definePlugin({
      name: "ReactErrorDecoder",
      description: "Replaces 'Minified React Error' crashes with the actual decoded error description",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Utility"],
      enabledByDefault: true
    });
    const ReadAllNotificationsButton = definePlugin({
      name: "ReadAllNotificationsButton",
      description: "Read all server notifications with a single button click!",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Notifications", "Shortcuts"],
      enabledByDefault: true
    });
    const RelationshipNotifier = definePlugin({
      name: "RelationshipNotifier",
      description: "Notifies you when a friend, group chat, or server removes you",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Friends", "Notifications"],
      enabledByDefault: true,
      options: {
        notices: {
          type: "boolean",
          label: "Also show a permanent top notice banner",
          default: false
        },
        offlineRemovals: {
          type: "boolean",
          label: "Check for removals that happened while offline",
          default: true
        },
        friends: {
          type: "boolean",
          label: "Notify when a friend removes you",
          default: true
        },
        friendRequestCancels: {
          type: "boolean",
          label: "Notify when a friend request is cancelled",
          default: true
        },
        servers: {
          type: "boolean",
          label: "Notify when kicked/banned from a server",
          default: true
        },
        groups: {
          type: "boolean",
          label: "Notify when removed from a Group DM",
          default: true
        }
      }
    });
    const ReplaceGoogleSearch = definePlugin({
      name: "ReplaceGoogleSearch",
      description: "Replaces the Google search engine with different Engines (DuckDuckGo, Brave, Startpage)",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Utility"],
      enabledByDefault: false,
      options: {
        customEngineName: {
          type: "select",
          label: "Search Engine",
          choices: ["DuckDuckGo", "Brave", "Startpage", "Google"],
          default: "DuckDuckGo"
        }
      }
    });
    const ReplyTimestamp = definePlugin({
      name: "ReplyTimestamp",
      description: "Shows a timestamp on replied-message previews",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Messages", "Appearance"],
      enabledByDefault: true
    });
    const RevealAllSpoilers = definePlugin({
      name: "RevealAllSpoilers",
      description: "Reveal all spoilers in a message by long-pressing / Ctrl-clicking a spoiler",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Messages", "Shortcuts"],
      enabledByDefault: true
    });
    const ReverseImageSearch = definePlugin({
      name: "ReverseImageSearch",
      description: "Adds Image Search options (Google, Yandex, SauceNAO, IQDB, TinEye) to image context menus",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Media", "Utility"],
      enabledByDefault: true
    });
    const ReviewDB = definePlugin({
      name: "ReviewDB",
      description: "Review other users and servers (powered by ReviewDB)",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Friends", "Appearance"],
      enabledByDefault: false,
      options: {
        notifyReviews: {
          type: "boolean",
          label: "Notify when someone leaves a review on your profile",
          default: true
        },
        showWarning: {
          type: "boolean",
          label: "Show warning on offensive reviews",
          default: true
        },
        hideTimestamps: {
          type: "boolean",
          label: "Hide timestamps on reviews",
          default: false
        },
        hideBlockedUsers: {
          type: "boolean",
          label: "Hide reviews written by blocked users",
          default: true
        }
      }
    });
    const RoleColorEverywhere = definePlugin({
      name: "RoleColorEverywhere",
      description: "Adds the top role color anywhere possible (chat mentions, typing bar, voice list, member list)",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Appearance", "Guilds"],
      enabledByDefault: true,
      options: {
        chatMentions: {
          type: "boolean",
          label: "Use role colors in @mentions in chat",
          default: true
        },
        memberList: {
          type: "boolean",
          label: "Use role colors in member list group headers",
          default: true
        },
        voiceUsers: {
          type: "boolean",
          label: "Use role colors in voice channel user lists",
          default: true
        },
        reactorsList: {
          type: "boolean",
          label: "Use role colors in the message reactions modal",
          default: true
        },
        pollResults: {
          type: "boolean",
          label: "Use role colors in poll results",
          default: true
        },
        colorChatMessages: {
          type: "boolean",
          label: "Tint message text with the author's role color",
          default: false
        }
      }
    });
    const SearchReply = definePlugin({
      name: "SearchReply",
      description: "Adds a reply button to messages in search results",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Messages", "Shortcuts"],
      enabledByDefault: true
    });
    const SecretRingToneEnabler = definePlugin({
      name: "SecretRingToneEnabler",
      description: "Always play the rare 0.1% secret Discord call ringtone",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Voice", "Media"],
      enabledByDefault: false,
      options: {
        onlySnow: {
          type: "boolean",
          label: "Only play the Snowsgiving remix version",
          default: false
        }
      }
    });
    const SendTimestamps = definePlugin({
      name: "SendTimestamps",
      description: "Send dynamic Discord timestamps easily via a chat bar picker button",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Chat", "Utility"],
      enabledByDefault: true,
      options: {
        replaceMessageContents: {
          type: "boolean",
          label: "Automatically parse {{HH:mm}} into timestamps",
          default: true
        }
      }
    });
    const ServerInfo = definePlugin({
      name: "ServerInfo",
      description: "Allows you to view detailed info about a server by long-pressing the server icon",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Guilds", "Utility"],
      enabledByDefault: true
    });
    const ServerListIndicators = definePlugin({
      name: "ServerListIndicators",
      description: "Add online friend count or total server count indicators to the top of the server list",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Appearance", "Guilds"],
      enabledByDefault: false,
      options: {
        mode: {
          type: "select",
          label: "Indicator mode",
          choices: ["Both", "Online Friends Only", "Server Count Only"],
          default: "Both"
        }
      }
    });
    const ShikiCodeblocks = definePlugin({
      name: "ShikiCodeblocks",
      description: "Brings VSCode-style Shiki syntax highlighting to codeblocks in chat",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Appearance", "Messages"],
      enabledByDefault: false,
      options: {
        theme: {
          type: "select",
          label: "Syntax Theme",
          choices: ["Dark Plus", "One Dark Pro", "Dracula", "GitHub Dark", "Catppuccin Mocha"],
          default: "Dark Plus"
        },
        tryHljs: {
          type: "select",
          label: "Fallback to Highlight.js",
          choices: ["SECONDARY", "NEVER", "PRIMARY"],
          default: "SECONDARY"
        },
        useDevIcon: {
          type: "select",
          label: "Language Icon Style",
          choices: ["COLOR", "GREYSCALE", "DISABLED"],
          default: "COLOR"
        }
      }
    });
    const ShowAllMessageButtons = definePlugin({
      name: "ShowAllMessageButtons",
      description: "Always show all message action buttons without holding Shift",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Messages", "Shortcuts"],
      enabledByDefault: false
    });
    const ShowConnections = definePlugin({
      name: "ShowConnections",
      description: "Show connected accounts directly in user popouts",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Appearance", "Friends"],
      enabledByDefault: true,
      options: {
        iconSize: {
          type: "select",
          label: "Icon size (px)",
          choices: ["24", "32", "40"],
          default: "32"
        },
        iconSpacing: {
          type: "select",
          label: "Icon spacing",
          choices: ["Compact", "Normal", "Spacious"],
          default: "Normal"
        }
      }
    });
    const ShowHiddenChannels = definePlugin({
      name: "ShowHiddenChannels",
      description: "Show channels that you do not have access to view!",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Guilds", "Utility"],
      enabledByDefault: true,
      options: {
        hideUnreads: {
          type: "boolean",
          label: "Hide unread indicators on locked channels",
          default: true
        },
        showMode: {
          type: "select",
          label: "Display style",
          choices: ["Lock Icon", "Hidden Eye Icon", "Muted Style"],
          default: "Lock Icon"
        },
        defaultAllowedUsersAndRolesDropdownState: {
          type: "boolean",
          label: "Expand allowed roles in lock screen by default",
          default: true
        }
      }
    });
    const ShowHiddenThings = definePlugin({
      name: "ShowHiddenThings",
      description: "Displays various hidden & moderator-only things regardless of permissions",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Guilds", "Utility"],
      enabledByDefault: true,
      options: {
        showTimeouts: {
          type: "boolean",
          label: "Show timeout icons on timed-out members",
          default: true
        },
        showInvitesPaused: {
          type: "boolean",
          label: "Show when server invites are paused",
          default: true
        },
        showModView: {
          type: "boolean",
          label: "Enable member Mod View panel",
          default: true
        }
      }
    });
    const ShowMeYourName = definePlugin({
      name: "ShowMeYourName",
      description: "Display usernames next to display names / nicknames in chat",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Appearance", "Messages"],
      enabledByDefault: false,
      options: {
        mode: {
          type: "select",
          label: "Display format",
          choices: ["user-nick", "nick-user", "user"],
          default: "user-nick"
        },
        inReplies: {
          type: "boolean",
          label: "Also show in message replies",
          default: false
        },
        friendNicknames: {
          type: "select",
          label: "Friend nicknames",
          choices: ["Fallback to username", "Always use friend nickname"],
          default: "Fallback to username"
        }
      }
    });
    const ShowTimeoutDuration = definePlugin({
      name: "ShowTimeoutDuration",
      description: "Shows how much longer a user's timeout will last, either in the timeout icon tooltip or inline",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Guilds", "Messages"],
      enabledByDefault: true,
      options: {
        displayStyle: {
          type: "select",
          label: "Display style",
          choices: ["ssalggnikool (Inline)", "Tooltip Only"],
          default: "ssalggnikool (Inline)"
        }
      }
    });
    const SilentMessageToggle = definePlugin({
      name: "SilentMessageToggle",
      description: "Adds a button to the chat bar to toggle sending a @silent message",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Chat", "Notifications"],
      enabledByDefault: false,
      options: {
        persistState: {
          type: "boolean",
          label: "Persist silent state across restarts",
          default: false
        },
        autoDisable: {
          type: "boolean",
          label: "Automatically disable silent mode after sending 1 message",
          default: true
        }
      }
    });
    const SilentTyping = definePlugin({
      name: "SilentTyping",
      description: "Hide that you are typing from others",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Privacy", "Chat"],
      enabledByDefault: false,
      options: {
        showIcon: {
          type: "boolean",
          label: "Show quick toggle icon in the chat bar",
          default: true
        },
        contextMenu: {
          type: "boolean",
          label: "Add toggle in chat bar context menu",
          default: true
        },
        isEnabled: {
          type: "boolean",
          label: "Currently suppress typing indicator",
          default: true
        }
      },
      start({
        patcher
      }) {
        const TypingActions = patcher.findByProps("startTyping", "stopTyping");
        if (TypingActions && typeof TypingActions.startTyping === "function") {
          patcher.instead("SilentTyping", TypingActions, "startTyping", () => {});
        }
      }
    });
    const SortFriendRequests = definePlugin({
      name: "SortFriendRequests",
      description: "Sorts friend requests by date of receipt",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Friends"],
      enabledByDefault: false,
      options: {
        showDates: {
          type: "boolean",
          label: "Display exact timestamp on pending requests",
          default: true
        }
      }
    });
    const SpotifyControls = definePlugin({
      name: "SpotifyControls",
      description: "Adds a Spotify player control bar above your account panel",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Media", "Appearance"],
      enabledByDefault: false,
      options: {
        hoverControls: {
          type: "boolean",
          label: "Only show controls on tap/hover",
          default: false
        },
        useSpotifyUris: {
          type: "boolean",
          label: "Open links directly in Spotify app instead of browser",
          default: true
        },
        previousButtonRestartsTrack: {
          type: "boolean",
          label: "Previous button restarts current track if >3s in",
          default: true
        }
      }
    });
    const SpotifyCrack = definePlugin({
      name: "SpotifyCrack",
      description: "Free listen along, no auto-pausing in voice chat, and allows activity without Premium",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Media", "Voice"],
      enabledByDefault: true,
      options: {
        noSpotifyAutoPause: {
          type: "boolean",
          label: "Disable Discord auto-pausing Spotify when talking in VC",
          default: true
        },
        keepSpotifyActivityOnIdle: {
          type: "boolean",
          label: "Keep Spotify status visible when idle",
          default: false
        }
      }
    });
    const SpotifyShareCommands = definePlugin({
      name: "SpotifyShareCommands",
      description: "Share your current Spotify track, album or artist via slash command (/track, /album, /artist)",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Media", "Chat"],
      enabledByDefault: false
    });
    const StartupTimings = definePlugin({
      name: "StartupTimings",
      description: "Adds Startup Timings page to the Vencord settings",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Utility"],
      enabledByDefault: false
    });
    const StickerPaste = definePlugin({
      name: "StickerPaste",
      description: "Makes picking a sticker in the sticker picker insert it into the chatbox instead of sending immediately",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Chat"],
      enabledByDefault: false
    });
    const StreamerModeOnStream = definePlugin({
      name: "StreamerModeOnStream",
      description: "Automatically enables streamer mode when you start streaming in Discord",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Privacy", "Voice"],
      enabledByDefault: false
    });
    const Summaries = definePlugin({
      name: "Summaries",
      description: "Enables Discord's AI conversation summaries feature on all servers",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Messages", "Guilds"],
      enabledByDefault: false
    });
    const SuperReactionTweaks = definePlugin({
      name: "SuperReactionTweaks",
      description: "Customize the limit of super reactions playing at once, and super react by default",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Chat", "Appearance"],
      enabledByDefault: false,
      options: {
        superReactByDefault: {
          type: "boolean",
          label: "Default reaction picker to Super Reactions",
          default: false
        },
        unlimitedSuperReactionPlaying: {
          type: "boolean",
          label: "Allow unlimited super reaction animations at once",
          default: false
        },
        superReactionPlayingLimit: {
          type: "select",
          label: "Max simultaneous animations",
          choices: ["5", "10", "20", "50"],
          default: "20"
        }
      }
    });
    const TextReplace = definePlugin({
      name: "TextReplace",
      description: "Replace text in your own messages using string or regex rules",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Chat"],
      enabledByDefault: false,
      options: {
        replaceMode: {
          type: "select",
          label: "Rule engine",
          choices: ["String & Regex", "String Only", "Regex Only"],
          default: "String & Regex"
        }
      }
    });
    const ThemeAttributes = definePlugin({
      name: "ThemeAttributes",
      description: "Adds data attributes to various elements for CSS theming purposes",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Appearance"],
      enabledByDefault: false
    });
    const TimeBarAllActivities = definePlugin({
      name: "TimeBarAllActivities",
      description: "Adds the Spotify-like progress time bar to all rich presence activities that have start/end timestamps",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Appearance"],
      enabledByDefault: false
    });
    const Translate = definePlugin({
      name: "Translate",
      description: "Translate messages with Google Translate or DeepL",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Chat", "Messages", "Utility"],
      enabledByDefault: true,
      options: {
        service: {
          type: "select",
          label: "Translation Service",
          choices: ["Google Translate", "DeepL Free", "DeepL Pro"],
          default: "Google Translate"
        },
        showChatBarButton: {
          type: "boolean",
          label: "Show translate button in chat bar",
          default: true
        },
        autoTranslate: {
          type: "boolean",
          label: "Automatically translate your outgoing messages before sending",
          default: false
        },
        receivedOutput: {
          type: "select",
          label: "Target language for incoming messages",
          choices: ["de", "en", "fr", "es", "it", "ja", "ru"],
          default: "de"
        }
      }
    });
    const TypingIndicator = definePlugin({
      name: "TypingIndicator",
      description: "Adds an indicator if someone is typing on a channel in the channel list",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Appearance", "Guilds"],
      enabledByDefault: true,
      options: {
        includeCurrentChannel: {
          type: "boolean",
          label: "Show indicator on currently selected channel",
          default: true
        },
        includeMutedChannels: {
          type: "boolean",
          label: "Show indicator on muted channels",
          default: false
        },
        includeBlockedUsers: {
          type: "boolean",
          label: "Show indicator when blocked users are typing",
          default: false
        },
        indicatorMode: {
          type: "select",
          label: "Indicator mode",
          choices: ["Dots & Avatars", "Animated Dots", "Avatars Only"],
          default: "Dots & Avatars"
        }
      }
    });
    const TypingTweaks = definePlugin({
      name: "TypingTweaks",
      description: "Show avatars and role colours in the typing indicator",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Appearance", "Chat"],
      enabledByDefault: true,
      options: {
        showAvatars: {
          type: "boolean",
          label: "Show user avatars in the typing bar",
          default: true
        },
        showRoleColors: {
          type: "boolean",
          label: "Color typing usernames with their role color",
          default: true
        },
        alternativeFormatting: {
          type: "boolean",
          label: "Show exact list instead of 'Several people are typing'",
          default: true
        }
      }
    });
    const Unindent = definePlugin({
      name: "Unindent",
      description: "Trims leading indentation from codeblocks",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Messages", "Chat"],
      enabledByDefault: true
    });
    const UnlockedAvatarZoom = definePlugin({
      name: "UnlockedAvatarZoom",
      description: "Allows you to zoom in further in the avatar crop tool",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Appearance", "Utility"],
      enabledByDefault: false,
      options: {
        zoomMultiplier: {
          type: "select",
          label: "Max Zoom Multiplier",
          choices: ["4", "8", "16"],
          default: "4"
        }
      }
    });
    const UnsuppressEmbeds = definePlugin({
      name: "UnsuppressEmbeds",
      description: "Allows you to unsuppress embeds in messages",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Messages"],
      enabledByDefault: true
    });
    const UrbanDictionary = definePlugin({
      name: "UrbanDictionary",
      description: "Search for a word on Urban Dictionary via /urban slash command",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Chat", "Utility"],
      enabledByDefault: false
    });
    const UserMessagesPronouns = definePlugin({
      name: "UserMessagesPronouns",
      description: "Adds pronouns to chat user messages",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Appearance", "Messages"],
      enabledByDefault: false,
      options: {
        pronounsFormat: {
          type: "select",
          label: "Pronouns format",
          choices: ["LOWERCASE", "CAPITALIZED"],
          default: "LOWERCASE"
        },
        showSelf: {
          type: "boolean",
          label: "Show pronouns on your own messages",
          default: true
        }
      }
    });
    const UserVoiceShow = definePlugin({
      name: "UserVoiceShow",
      description: "Shows an indicator when a user is in a Voice Channel",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Voice", "Appearance"],
      enabledByDefault: true,
      options: {
        showInUserProfileModal: {
          type: "boolean",
          label: "Show voice channel in User Profile popouts",
          default: true
        },
        showInMemberList: {
          type: "boolean",
          label: "Show speaker icon next to user in Member List",
          default: true
        },
        showInMessages: {
          type: "boolean",
          label: "Show speaker icon next to username in chat messages",
          default: true
        }
      }
    });
    const USRBG = definePlugin({
      name: "USRBG",
      description: "Displays user banners from USRBG database, allowing anyone to get a custom banner without Nitro",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Appearance"],
      enabledByDefault: true,
      options: {
        nitroFirst: {
          type: "boolean",
          label: "Prioritize real Nitro banner if user has both",
          default: true
        },
        voiceBackground: {
          type: "boolean",
          label: "Use USRBG banners as voice call tile backgrounds",
          default: true
        }
      }
    });
    const ValidReply = definePlugin({
      name: "ValidReply",
      description: "Fixes 'Message could not be loaded' upon hovering/tapping a reply",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Messages"],
      enabledByDefault: true
    });
    const ValidUser = definePlugin({
      name: "ValidUser",
      description: "Fix mentions for unknown/uncached users (<@id>) showing up in chat",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Messages"],
      enabledByDefault: true
    });
    const VcNarrator = definePlugin({
      name: "VcNarrator",
      description: "Announces when users join, leave, or move in your voice channel via speech synthesis",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Voice"],
      enabledByDefault: false,
      options: {
        volume: {
          type: "select",
          label: "Voice Volume (%)",
          choices: ["25", "50", "75", "100"],
          default: "100"
        },
        rate: {
          type: "select",
          label: "Speech Speed",
          choices: ["0.75", "1.0", "1.25", "1.5"],
          default: "1.0"
        },
        latinOnly: {
          type: "boolean",
          label: "Strip non-latin symbols from usernames before speaking",
          default: false
        }
      }
    });
    const VencordToolbox = definePlugin({
      name: "VencordToolbox",
      description: "Adds a button to the titlebar/header that houses Vencord quick actions",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Shortcuts", "Utility"],
      enabledByDefault: true,
      options: {
        showPluginMenu: {
          type: "boolean",
          label: "Include quick plugin toggle list in toolbox menu",
          default: true
        }
      }
    });
    const ViewIcons = definePlugin({
      name: "ViewIcons",
      description: "Makes avatars and banners in user profiles clickable, and adds View Icon to context menus",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Media", "Utility"],
      enabledByDefault: true,
      options: {
        format: {
          type: "select",
          label: "Static Image Format",
          choices: ["webp", "png", "jpg"],
          default: "webp"
        },
        imgSize: {
          type: "select",
          label: "Image Resolution",
          choices: ["512", "1024", "2048", "4096"],
          default: "1024"
        }
      }
    });
    const ViewRaw = definePlugin({
      name: "ViewRaw",
      description: "Copy and view the raw content/data of any message, channel or guild",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Utility", "Messages"],
      enabledByDefault: false,
      options: {
        clickMethod: {
          type: "select",
          label: "Button click action",
          choices: ["Left (Modal)", "Right (Copy Raw)"],
          default: "Left (Modal)"
        }
      }
    });
    const VoiceChatDoubleClick = definePlugin({
      name: "VoiceChatDoubleClick",
      description: "Join voice chats via double-tap instead of single tap to prevent accidental joins",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Voice", "Shortcuts"],
      enabledByDefault: true
    });
    const VoiceDownload = definePlugin({
      name: "VoiceDownload",
      description: "Adds a download button to voice messages",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Voice", "Media"],
      enabledByDefault: true
    });
    const VoiceMessages = definePlugin({
      name: "VoiceMessages",
      description: "Allows you to send voice messages anywhere, including uploading audio files as voice messages",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Voice", "Chat"],
      enabledByDefault: true,
      options: {
        noiseSuppression: {
          type: "boolean",
          label: "Enable WebRTC Noise Suppression",
          default: true
        },
        echoCancellation: {
          type: "boolean",
          label: "Enable Echo Cancellation",
          default: true
        }
      }
    });
    const VolumeBooster = definePlugin({
      name: "VolumeBooster",
      description: "Allows you to set the user and stream volume above the default 200% maximum",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Voice"],
      enabledByDefault: true,
      options: {
        multiplier: {
          type: "select",
          label: "Max Volume Multiplier (2 = 400%, 3 = 600%)",
          choices: ["2", "3", "4", "5"],
          default: "2"
        }
      }
    });
    const WhoReacted = definePlugin({
      name: "WhoReacted",
      description: "Renders the avatars of users who reacted to a message right next to the reaction pill",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Appearance", "Messages"],
      enabledByDefault: true
    });
    const Wikisearch = definePlugin({
      name: "Wikisearch",
      description: "Searches Wikipedia for your query via /wiki slash command",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Chat", "Utility"],
      enabledByDefault: false
    });
    const YoutubeAdblock = definePlugin({
      name: "YoutubeAdblock",
      description: "Block ads in YouTube embeds inside Discord via Watch2Gether player",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Media", "Privacy"],
      enabledByDefault: true
    });

    // Required Core Vencord Plugins
    const NoTrack = definePlugin({
      name: "NoTrack",
      description: "Disable Discord's tracking ('science'/analytics) and crash reporting",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Privacy"],
      required: true,
      enabledByDefault: true,
      options: {
        disableAnalytics: {
          type: "boolean",
          label: "Disable Discord Science Analytics",
          default: true
        }
      }
    });
    const SettingsPlugin = definePlugin({
      name: "Settings",
      description: "Adds the Vencord settings section (Vencord, Plugins, Themes, Updater, Cloud, Backup & Restore) to Discord Settings",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Utility"],
      required: true,
      enabledByDefault: true,
      options: {
        settingsLocation: {
          type: "select",
          label: "Settings Section Position",
          choices: ["aboveActivity", "belowNitro", "top", "bottom"],
          default: "belowNitro"
        }
      }
    });
    const SupportHelper = definePlugin({
      name: "SupportHelper",
      description: "Helps us provide support to you and provides debug diagnostics",
      authors: [{
        name: "Vendicated"
      }, {
        name: "juli22292"
      }],
      tags: ["Utility"],
      required: true,
      enabledByDefault: true
    });
    const BUILTIN_PLUGINS = [AccountPanelServerProfile, AddAttachments, AlwaysAnimate, AlwaysExpandRoles, AlwaysTrust, AnonymiseFileNames, AppleMusicRichPresence, AutomodContext, BetterFolders, BetterGifAltText, BetterGifPicker, BetterNotesBox, BetterRoleContext, BetterRoleDot, BetterSessions, BetterSettings, BetterUploadButton, BiggerStreamPreview, BlurNSFW, CallTimer, ClearURLs, ClientTheme, ColorSighted, ConsoleJanitor, ConsoleShortcuts, CopyEmojiMarkdown, CopyFileContents, CopyUserURLs, CrashHandler, CtrlEnterSend, CustomIdle, CustomRPC, Dearrow, Decor, DisableCallIdle, DontRoundMyTimestamps, Experiments, FakeNitro, FakeProfileThemes, FavoriteEmojiFirst, FavoriteGifSearch, FixCodeblockGap, FixImagesQuality, FixSpotifyEmbeds, FixYoutubeEmbeds, ForceOwnerCrown, FriendInvites, FriendsSince, FullSearchContext, GameActivityToggle, GifPaste, GreetStickerPicker, HideAttachments, IgnoreActivities, iLoveSpam, ImageFilename, ImageZoom, ImplicitRelationships, InvisibleChat, KeepCurrentChannel, LastFMRichPresence, LoadingQuotes, MemberCount, MentionAvatars, MessageClickActions, MessageLatency, MessageLinkEmbeds, MessageLogger, MessageTags, MoreCommands, MoreKaomoji, MoreUserTags, Moyai, MutualGroupDMs, NewGuildSettings, NoBlockedMessages, NoDevtoolsWarning, NoF1, NoMaskedUrlPaste, NoMosaic, NoOnboardingDelay, NoPendingCount, NoProfileThemes, NoReplyMention, NoRPC, NoScreensharePreview, NoServerEmojis, NoSystemBadge, NoTrack, NoTypingAnimation, NoUnblockToJump, NormalizeMessageLinks, NotificationVolume, NSFWGateBypass, OnePingPerDM, oneko, OpenInApp, OverrideForumDefaults, PartyMode, PauseInvitesForever, PermissionFreeWill, PermissionsViewer, petpet, PictureInPicture, PinDMs, PlainFolderIcon, PlatformIndicators, PreviewMessage, QuickMention, QuickReply, ReactErrorDecoder, ReadAllNotificationsButton, RelationshipNotifier, ReplaceGoogleSearch, ReplyTimestamp, RevealAllSpoilers, ReverseImageSearch, ReviewDB, RoleColorEverywhere, SearchReply, SecretRingToneEnabler, SendTimestamps, ServerInfo, ServerListIndicators, SettingsPlugin, ShikiCodeblocks, ShowAllMessageButtons, ShowConnections, ShowHiddenChannels, ShowHiddenThings, ShowMeYourName, ShowTimeoutDuration, SilentMessageToggle, SilentTyping, SortFriendRequests, SpotifyControls, SpotifyCrack, SpotifyShareCommands, StartupTimings, StickerPaste, StreamerModeOnStream, Summaries, SuperReactionTweaks, SupportHelper, TextReplace, ThemeAttributes, TimeBarAllActivities, Translate, TypingIndicator, TypingTweaks, Unindent, UnlockedAvatarZoom, UnsuppressEmbeds, UrbanDictionary, UserMessagesPronouns, UserVoiceShow, USRBG, ValidReply, ValidUser, VcNarrator, VencordToolbox, ViewIcons, ViewRaw, VoiceChatDoubleClick, VoiceDownload, VoiceMessages, VolumeBooster, WhoReacted, Wikisearch, YoutubeAdblock];

    // --- Module: src/ui/DiscordSettingsInjector.js ---
    const VENCORD_SETTINGS = "VENCORD_ANDROID_SETTINGS";
    const VENCORD_PLUGINS = "VENCORD_ANDROID_PLUGINS";
    const VENCORD_UPDATER = "VENCORD_ANDROID_UPDATER";
    const VENCORD_BACKUP = "VENCORD_ANDROID_BACKUP";
    const VENCORD_MAIN_ROWS = [VENCORD_SETTINGS, VENCORD_PLUGINS, VENCORD_UPDATER, VENCORD_BACKUP];
    function useSettingsValue(read) {
      const React = Patcher.Common.React;
      const [, refresh] = React.useReducer(revision => revision + 1, 0);
      React.useEffect(() => Settings.subscribe(refresh), [refresh]);
      return read();
    }
    function injectVencordSection(sections) {
      if (!Array.isArray(sections)) return sections;
      const accountIndex = sections.findIndex(section => section?.settings?.includes?.("ACCOUNT"));
      if (accountIndex < 0 || sections.some(section => section?.settings?.includes?.(VENCORD_SETTINGS))) {
        return sections;
      }
      return [...sections.slice(0, accountIndex + 1), {
        label: "Vencord",
        title: "Vencord",
        settings: VENCORD_MAIN_ROWS
      }, ...sections.slice(accountIndex + 1)];
    }
    function withVencordSections(props) {
      if (!props || typeof props !== "object") return props;
      if (Array.isArray(props.node?.sections)) {
        const sections = injectVencordSection(props.node.sections);
        return sections === props.node.sections ? props : {
          ...props,
          node: {
            ...props.node,
            sections
          }
        };
      }
      const sections = injectVencordSection(props.sections);
      return sections === props.sections ? props : {
        ...props,
        sections
      };
    }
    function isMemoizedRenderer(renderer) {
      return renderer?.$$typeof === Symbol.for("react.memo") && typeof renderer.type === "function";
    }
    let DiscordSettingsInjector = /*#__PURE__*/function () {
      function DiscordSettingsInjector() {
        _classCallCheck(this, DiscordSettingsInjector);
        this.unpatches = [];
        this.active = false;
        this.configRegistered = false;
        this.sectionRendered = false;
        this.checkedUpdate = null;
      }
      return _createClass(DiscordSettingsInjector, [{
        key: "init",
        value: function init() {
          if (this.active) return;
          this.active = true;
          this.unpatches.push(Patcher.waitFor(module => module?.SETTING_RENDERER_CONFIG && typeof module.SETTING_RENDERER_CONFIG === "object", module => this.registerConfig(module)));
          this.unpatches.push(Patcher.waitFor(module => isMemoizedRenderer(module?.SearchableSettingsList) && isMemoizedRenderer(module?.SettingsList), module => this.patchSections(module, "SearchableSettingsList")));
          this.unpatches.push(Patcher.waitFor(module => typeof module?.SettingsList === "function", module => this.patchSections(module, "SettingsList")));
          this.unpatches.push(Patcher.waitFor(module => typeof module?.createList === "function", module => this.patchSections(module, "createList")));
        }
      }, {
        key: "patchSections",
        value: function patchSections(module, key) {
          const renderer = module[key];
          const memoized = isMemoizedRenderer(renderer);
          const target = memoized ? renderer : Patcher.patchableMetroExport(module, key);
          const property = memoized ? "type" : key;
          const descriptor = Object.getOwnPropertyDescriptor(target, property);
          if (!descriptor?.configurable && !descriptor?.writable) return;
          const original = target[property];
          const injector = this;
          Object.defineProperty(target, property, {
            configurable: descriptor.configurable,
            enumerable: descriptor.enumerable,
            writable: true,
            value: function (props, ...rest) {
              const nextProps = injector.configRegistered ? withVencordSections(props) : props;
              if (nextProps !== props && !injector.sectionRendered) {
                injector.sectionRendered = true;
                globalThis.console?.log?.("[VencordForAndroid] Vencord section added to Discord settings.");
              }
              return original.call(this, nextProps, ...rest);
            }
          });
          this.unpatches.push(() => Object.defineProperty(target, property, descriptor));
        }
      }, {
        key: "registerConfig",
        value: function registerConfig(module) {
          const key = "SETTING_RENDERER_CONFIG";
          const items = this.createItems();
          const config = module[key];
          if (Object.isExtensible(config)) {
            const added = Object.keys(items).filter(id => !Object.prototype.hasOwnProperty.call(config, id));
            for (const id of added) config[id] = items[id];
            this.unpatches.push(() => {
              for (const id of added) if (config[id] === items[id]) delete config[id];
            });
          } else {
            const target = Patcher.patchableMetroExport(module, key);
            const original = Object.getOwnPropertyDescriptor(target, key);
            if (!original?.configurable && !original?.writable) return;
            Object.defineProperty(target, key, {
              configurable: original.configurable,
              enumerable: original.enumerable,
              writable: true,
              value: {
                ...config,
                ...items
              }
            });
            this.unpatches.push(() => Object.defineProperty(target, key, original));
          }
          this.configRegistered = true;
          globalThis.console?.log?.("[VencordForAndroid] Native Vencord settings registered.");
        }
      }, {
        key: "createItems",
        value: function createItems() {
          const items = {};
          const add = (id, title, definition) => {
            items[id] = {
              useTitle: () => title,
              title: () => title,
              ...definition
            };
          };
          const toggle = (id, parent, title, read, write, description, disabled) => {
            add(id, title, {
              parent,
              type: "toggle",
              useDescription: () => description,
              useValue: () => useSettingsValue(read),
              useIsDisabled: disabled ? () => useSettingsValue(disabled) : undefined,
              onValueChange: write
            });
          };
          const screen = (id, title, rows, parent = null) => {
            const NativeSettingsPage = () => {
              const React = Patcher.Common.React;
              const ScrollView = Patcher.Common.ReactNative?.ScrollView;
              const renderer = Patcher.findByProps("SettingsList", "SearchableSettingsList") ?? Patcher.findByProps("SettingsList");
              const list = renderer?.SettingsList;
              if (!React || !ScrollView || !list) return null;
              const sections = [{
                settings: rows
              }];
              return React.createElement(ScrollView, {
                style: {
                  flex: 1
                }
              }, React.createElement(list, {
                node: {
                  type: "list",
                  sections
                },
                sections
              }));
            };
            add(id, title, {
              parent,
              type: "route",
              screen: {
                route: id,
                getComponent: () => NativeSettingsPage
              }
            });
          };
          screen(VENCORD_SETTINGS, "Vencord", ["VENCORD_ANDROID_VERSION", "VENCORD_ANDROID_AUTO_UPDATE", "VENCORD_ANDROID_SAFE_MODE"]);
          add("VENCORD_ANDROID_VERSION", "Version", {
            parent: VENCORD_SETTINGS,
            type: "static",
            useTrailing: () => `v${CORE_VERSION}`
          });
          toggle("VENCORD_ANDROID_AUTO_UPDATE", VENCORD_SETTINGS, "Automatisch nach Updates suchen", () => Settings.get("autoUpdate"), value => Settings.set("autoUpdate", value));
          toggle("VENCORD_ANDROID_SAFE_MODE", VENCORD_SETTINGS, "Abgesicherter Modus", () => Settings.get("safeMode"), value => PluginManager.setSafeMode(value), "Hält optionale Plugins vorübergehend an.");
          const pluginRows = [];
          for (const plugin of PluginManager.getAllPlugins()) {
            if (!plugin.available || plugin.required || plugin.isDependency) continue;
            const id = `VENCORD_ANDROID_PLUGIN_${plugin.name}`;
            toggle(id, VENCORD_PLUGINS, plugin.name, () => PluginManager.isPluginEnabled(plugin.name), enabled => PluginManager.setPluginEnabled(plugin.name, enabled), plugin.description, () => Settings.get("safeMode"));
            pluginRows.push(id);
            const optionIds = [];
            const optionsPage = `${id}_OPTIONS`;
            for (const [name, option] of Object.entries(plugin.options)) {
              if (option.type !== "boolean" && option.type !== OptionType.BOOLEAN) continue;
              const optionId = `${optionsPage}_${name}`;
              toggle(optionId, optionsPage, option.label || name, () => Settings.getPluginConfig(plugin.name).options[name] ?? option.default, value => Settings.setPluginOption(plugin.name, name, value), option.description);
              optionIds.push(optionId);
            }
            if (optionIds.length) {
              screen(optionsPage, `${plugin.name} · Einstellungen`, optionIds, VENCORD_PLUGINS);
              pluginRows.push(optionsPage);
            }
          }
          screen(VENCORD_PLUGINS, "Plugins", pluginRows);
          screen(VENCORD_UPDATER, "Updater", ["VENCORD_ANDROID_CHECK_UPDATE", "VENCORD_ANDROID_OPEN_RELEASE"]);
          add("VENCORD_ANDROID_CHECK_UPDATE", "Nach Updates suchen", {
            parent: VENCORD_UPDATER,
            type: "pressable",
            onPress: async () => {
              this.checkedUpdate = await Updater.checkForUpdates();
              const {
                error,
                updateAvailable,
                latestVersion
              } = this.checkedUpdate;
              const message = error || (updateAvailable ? `Version v${latestVersion} ist verfügbar.` : `v${CORE_VERSION} ist aktuell.`);
              Patcher.Common.ReactNative?.Alert?.alert("Vencord", message);
            }
          });
          add("VENCORD_ANDROID_OPEN_RELEASE", "GitHub-Releases öffnen", {
            parent: VENCORD_UPDATER,
            type: "pressable",
            withArrow: true,
            onPress: () => {
              const repo = this.checkedUpdate?.updateAvailable ? INSTALLER_REPO : CORE_REPO;
              Patcher.Common.ReactNative?.Linking?.openURL(`https://github.com/${repo}/releases/latest`).catch(() => {
                Patcher.Common.ReactNative?.Alert?.alert("Vencord", "GitHub konnte nicht geöffnet werden.");
              });
            }
          });
          screen(VENCORD_BACKUP, "Backup & Reset", ["VENCORD_ANDROID_COPY_SETTINGS", "VENCORD_ANDROID_RESET"]);
          add("VENCORD_ANDROID_COPY_SETTINGS", "Einstellungen kopieren", {
            parent: VENCORD_BACKUP,
            type: "pressable",
            onPress: () => {
              const clipboard = Patcher.Common.Clipboard;
              if (typeof clipboard?.setString === "function") clipboard.setString(Settings.exportJSON());else Patcher.Common.ReactNative?.Alert?.alert("Vencord", "Die Zwischenablage ist nicht verfügbar.");
            }
          });
          add("VENCORD_ANDROID_RESET", "Plugins und Einstellungen zurücksetzen", {
            parent: VENCORD_BACKUP,
            type: "pressable",
            onPress: () => Patcher.Common.ReactNative?.Alert?.alert("Vencord", "Alle Vencord-Einstellungen zurücksetzen?", [{
              text: "Abbrechen",
              style: "cancel"
            }, {
              text: "Zurücksetzen",
              style: "destructive",
              onPress: () => {
                PluginManager.stopAll();
                Settings.wipeAll();
                PluginManager.startAllEnabled();
              }
            }])
          });
          return items;
        }
      }, {
        key: "unpatchAll",
        value: function unpatchAll() {
          for (const unpatch of this.unpatches.reverse()) unpatch();
          this.unpatches.length = 0;
          this.configRegistered = false;
          this.sectionRendered = false;
          this.active = false;
        }
      }]);
    }();
    const SettingsInjector = new DiscordSettingsInjector();

    // --- Module: src/index.js ---
    let VencordForAndroidRuntime = /*#__PURE__*/function () {
      function VencordForAndroidRuntime() {
        _classCallCheck(this, VencordForAndroidRuntime);
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
      return _createClass(VencordForAndroidRuntime, [{
        key: "init",
        value: function init() {
          if (this.initialized) return;
          PluginManager.registerAll(BUILTIN_PLUGINS);
          SettingsInjector.init();
          this.initialized = true;
        }
      }, {
        key: "startPlugins",
        value: async function startPlugins() {
          if (!this.initialized || this.started) return;
          this.started = true;
          const native = Patcher.Common.ReactNative;
          const nativeModules = native?.NativeModules;
          const cache = nativeModules?.NativeCacheModule ?? nativeModules?.MMKVManager ?? native?.TurboModuleRegistry?.get?.("NativeCacheModule") ?? native?.TurboModuleRegistry?.get?.("MMKVManager");
          await Settings.connectNativeCache(cache);
          if (!this.initialized) return;
          PluginManager.startAllEnabled();
          globalThis.console?.log?.(`[VencordForAndroid] v${this.version} started ${PluginManager.running.size} plugins.`);
          if (Settings.get("autoUpdate") && typeof fetch === "function") {
            await Updater.checkForUpdates();
          }
        }
      }, {
        key: "uninstall",
        value: function uninstall() {
          SettingsInjector.unpatchAll();
          PluginManager.uninstallAll();
          this.initialized = false;
          this.started = false;
        }
      }]);
    }();
    const VencordForAndroid = new VencordForAndroidRuntime();
    const startVencordPlugins = () => {
      Promise.resolve().then(() => VencordForAndroid.startPlugins()).catch(err => {
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
  } catch (error) {
    const message = "[VencordForAndroid] Bundle startup failed: " + (error?.stack || error);
    if (typeof global.nativeLoggingHook === "function") global.nativeLoggingHook(message, 3);else global.console?.error?.(message);
  }
})(typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : this);
})();
