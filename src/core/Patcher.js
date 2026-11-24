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
    _hookModuleLoaders() {
        if (typeof globalThis === "undefined") return;

        // Hook Discord Android React Native Metro require (__r) if present
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
            Object.assign(hookedRequire, origRequire);
            globalThis.__r = hookedRequire;
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
                for (const key of Object.keys(globalThis.modules)) {
                    const mod = globalThis.modules[key];
                    if (mod?.publicModule?.exports) {
                        list.push(mod.publicModule.exports);
                    } else if (mod?.exports) {
                        list.push(mod.exports);
                    }
                }
            }
            // 2. Webpack chunk cache (Discord Web / Desktop / Vendroid)
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
        const filter = Array.isArray(filterOrProps)
            ? (m) => m && filterOrProps.every((p) => p in m)
            : typeof filterOrProps === "string"
                ? (m) => m && (filterOrProps in m || m.displayName === filterOrProps || m.name === filterOrProps)
                : filterOrProps;

        const existing = this.find(filter);
        if (existing) {
            callback(existing);
            return;
        }
        this.waitSubscriptions.add({ filter, callback });
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
