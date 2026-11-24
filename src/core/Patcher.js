/**
 * VencordForAndroid - Runtime Patcher & Discord Module Finder
 * Provides before/instead/after method patching and Metro/Webpack module lookup.
 */

class PatcherManager {
    constructor() {
        this.patches = new Map();
    }

    _patch(type, callerId, target, method, callback) {
        if (!target || typeof target[method] !== "function") {
            return () => {};
        }

        const key = `${callerId}::${method}`;
        const original = target[method];

        const wrapped = function (...args) {
            if (type === "before") {
                try {
                    const replacementArgs = callback(args, this);
                    if (Array.isArray(replacementArgs)) {
                        return original.apply(this, replacementArgs);
                    }
                } catch (err) {
                    console.error(`[VencordForAndroid:Patcher] Error in before patch (${key}):`, err);
                }
                return original.apply(this, args);
            }

            if (type === "instead") {
                try {
                    return callback(args, original.bind(this), this);
                } catch (err) {
                    console.error(`[VencordForAndroid:Patcher] Error in instead patch (${key}):`, err);
                    return original.apply(this, args);
                }
            }

            // "after"
            const res = original.apply(this, args);
            try {
                const modifiedRes = callback(args, res, this);
                return modifiedRes !== undefined ? modifiedRes : res;
            } catch (err) {
                console.error(`[VencordForAndroid:Patcher] Error in after patch (${key}):`, err);
                return res;
            }
        };

        target[method] = wrapped;

        const unpatch = () => {
            if (target[method] === wrapped) {
                target[method] = original;
            }
            const callerPatches = this.patches.get(callerId);
            if (callerPatches) {
                callerPatches.delete(unpatch);
            }
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
                for (const unpatch of Array.from(set)) {
                    unpatch();
                }
                this.patches.delete(callerId);
            }
            return;
        }
        for (const id of Array.from(this.patches.keys())) {
            this.unpatchAll(id);
        }
    }

    /**
     * Metro / Webpack module search helper for Discord Android (React Native & WebView)
     */
    findByProps(...props) {
        const modules = this._getAvailableModules();
        for (const mod of modules) {
            if (!mod) continue;
            const candidate = mod.exports || mod;
            if (candidate && props.every((p) => p in candidate)) {
                return candidate;
            }
            if (candidate?.default && props.every((p) => p in candidate.default)) {
                return candidate.default;
            }
        }
        return null;
    }

    findByName(displayName) {
        const modules = this._getAvailableModules();
        for (const mod of modules) {
            const candidate = mod?.exports || mod;
            if (!candidate) continue;
            if (candidate.displayName === displayName || candidate.name === displayName) {
                return candidate;
            }
            if (candidate.default && (candidate.default.displayName === displayName || candidate.default.name === displayName)) {
                return candidate.default;
            }
        }
        return null;
    }

    _getAvailableModules() {
        try {
            if (typeof globalThis !== "undefined" && globalThis.__r && globalThis.modules) {
                return Object.values(globalThis.modules);
            }
            if (typeof window !== "undefined" && window.webpackChunkdiscord_app) {
                const modules = [];
                window.webpackChunkdiscord_app.push([
                    [Symbol("VencordForAndroid")],
                    {},
                    (req) => {
                        if (req?.c) {
                            for (const m of Object.values(req.c)) {
                                modules.push(m);
                            }
                        }
                    }
                ]);
                window.webpackChunkdiscord_app.pop();
                return modules;
            }
        } catch (err) {
            console.warn("[VencordForAndroid:Patcher] Module enumeration fallback:", err);
        }
        return [];
    }
}

export const Patcher = new PatcherManager();
export default Patcher;
