/**
 * VencordForAndroid v0.0.4 - Metro / Webpack Module Engine & Runtime Patcher
 * Combines Vendicated/Vencord's patchWebpack.ts with Discord Android's Metro (__r / modules) lookup.
 */

class PatcherAndModuleEngine {
    constructor() {
        this.patches = new Map();
        this.patchWrappers = new WeakMap();
        this.declarativePatches = [];
        this.waitSubscriptions = new Set();
        this.metroModules = new Map();
        this.metroExportOwners = new WeakMap();
        this._commonCache = {};
        this.assetIds = new Map();
        this.nextAssetId = 1;
    }

    // --- 1. Runtime Method Patching (before / instead / after) ---
    _patch(type, callerId, target, method, callback) {
        if (!target || typeof target[method] !== "function") {
            return () => {};
        }

        const original = target[method];
        const descriptor = Object.getOwnPropertyDescriptor(target, method);
        const entry = { original, descriptor, active: true };
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
        if (descriptor?.configurable) {
            Object.defineProperty(target, method, {
                configurable: true, enumerable: descriptor.enumerable, writable: true, value: wrapped
            });
        } else {
            target[method] = wrapped;
        }
        this.patchWrappers.set(wrapped, entry);

        const unpatch = () => {
            entry.active = false;
            if (target[method] === wrapped) {
                let previous = this.patchWrappers.get(entry.original);
                let restore = entry.descriptor;
                while (previous && !previous.active) {
                    restore = previous.descriptor;
                    previous = this.patchWrappers.get(previous.original);
                }
                if (restore) Object.defineProperty(target, method, restore);
                else delete target[method];
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
            this.declarativePatches = this.declarativePatches.filter((patch) => patch.plugin !== callerId);
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
    addDeclarativePatch(patchDef, pluginName) {
        this.declarativePatches.push({
            ...patchDef,
            plugin: pluginName,
            replacement: Array.isArray(patchDef.replacement) ? patchDef.replacement : [patchDef.replacement]
        });
    }

    // --- 3. Discord Metro (React Native Android) & Webpack Module Discovery ---
    observeMetroDefinitions(onEntryLoaded) {
        const engine = this;
        const original = Object.getOwnPropertyDescriptor(globalThis, "__d");
        let wrapped;
        const assign = (next) => {
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

    patchableMetroExport(exports, key) {
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

    _notifyWaiters(record) {
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

    _getMetroModulesMap() {
        if (typeof globalThis === "undefined") return null;
        const raw = globalThis.modules ?? globalThis.__r?.getModules?.();
        if (!raw) return null;
        return raw instanceof Map ? Object.fromEntries(raw) : raw;
    }

    _getModuleList() {
        const list = new Set();
        for (const { exports } of this.metroModules.values()) list.add(exports);
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
    findDeepInMetro(filterFn) {
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
        if (this.assetIds.has(assetName)) return this.assetIds.get(assetName);
        const AssetsRegistry = this.findByProps("registerAsset", "getAssetByID");
        if (!AssetsRegistry) return null;
        // React Native registers image assets under consecutive IDs starting at 1.
        for (;;) {
            const id = this.nextAssetId;
            const asset = AssetsRegistry.getAssetByID(id);
            if (!asset) break;
            this.nextAssetId++;
            if (!this.assetIds.has(asset.name)) this.assetIds.set(asset.name, id);
            if (asset.name === assetName) return id;
        }
        return null;
    }

    waitFor(filterOrProps, callback) {
        const filter = Array.isArray(filterOrProps)
            ? (m) => m && (typeof m === "object" || typeof m === "function") && filterOrProps.every((p) => p in m)
            : typeof filterOrProps === "string"
                ? (m) => m && (typeof m === "object" || typeof m === "function") && (filterOrProps in m || m.displayName === filterOrProps || m.name === filterOrProps)
                : filterOrProps;

        const existing = this.find(filter);
        if (existing) {
            callback(existing);
            return () => {};
        }
        const sub = { filter, callback };
        this.waitSubscriptions.add(sub);

        return () => this.waitSubscriptions.delete(sub);
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

export const Patcher = new PatcherAndModuleEngine();
export const Webpack = Patcher;
export const Metro = Patcher;
export default Patcher;
