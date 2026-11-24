/**
 * VencordForAndroid v0.0.2
 * Repository: https://github.com/juli22292/vencordforandroid
 * Target: Official Discord Android App (com.discord / com.discord.ptb / com.discord.canary)
 * Corrupted/Blocked Versions: 0.0.1
 * Built: 2026-11-24T18:11:24.330Z
 */
(function (global) {
"use strict";

// --- Module: src/core/Settings.js ---
/**
 * VencordForAndroid - Persistent Settings Store
 * Manages core configuration and per-plugin state inside Discord Mobile.
 */

const STORAGE_KEY = "VencordForAndroid_Settings_v1";

const DEFAULT_SETTINGS = {
    version: "0.0.2",
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
const Settings = new SettingsManager();

// --- Module: src/core/Patcher.js ---
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
const Patcher = new PatcherManager();

// --- Module: src/core/PluginManager.js ---
/**
 * VencordForAndroid - Plugin Manager
 * Handles registration, enabling/disabling, configuration, and lifecycle of all plugins.
 */
function definePlugin(definition) {
    return {
        name: definition.name,
        description: definition.description || "",
        authors: definition.authors || [{ name: "juli22292" }],
        version: definition.version || "0.0.1",
        required: Boolean(definition.required),
        enabledByDefault: Boolean(definition.enabledByDefault),
        options: definition.options || {},
        patches: definition.patches || [],
        start: definition.start || (() => {}),
        stop: definition.stop || (() => {})
    };
}

class PluginManagerService {
    constructor() {
        this.registry = new Map();
        this.running = new Set();
    }

    register(plugin) {
        if (!plugin || !plugin.name) {
            throw new Error("Invalid plugin definition: missing name");
        }
        this.registry.set(plugin.name, plugin);

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
        for (const plugin of pluginList) {
            this.register(plugin);
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

    isEnabled(name) {
        const plugin = this.getPlugin(name);
        if (!plugin) return false;
        if (plugin.required) return true;
        return Boolean(Settings.getPluginConfig(name).enabled);
    }

    startAllEnabled() {
        if (Settings.get("safeMode")) {
            console.warn("[VencordForAndroid] Safe Mode is active; skipping non-required plugins.");
        }

        for (const plugin of this.registry.values()) {
            const shouldStart = plugin.required || (!Settings.get("safeMode") && this.isEnabled(plugin.name));
            if (shouldStart) {
                this.startPlugin(plugin.name);
            }
        }
    }

    startPlugin(name) {
        const plugin = this.getPlugin(name);
        if (!plugin || this.running.has(name)) return false;

        try {
            const cfg = Settings.getPluginConfig(name);
            const context = {
                settings: cfg.options || {},
                patcher: Patcher,
                setOption: (k, v) => Settings.setPluginOption(name, k, v)
            };
            plugin.start(context);
            this.running.add(name);
            Settings.setPluginEnabled(name, true);
            console.log(`[VencordForAndroid] Started plugin: ${name}`);
            return true;
        } catch (err) {
            console.error(`[VencordForAndroid] Error starting plugin "${name}":`, err);
            return false;
        }
    }

    stopPlugin(name) {
        const plugin = this.getPlugin(name);
        if (!plugin || plugin.required) return false;

        try {
            if (this.running.has(name)) {
                plugin.stop({ patcher: Patcher });
                Patcher.unpatchAll(name);
                this.running.delete(name);
            }
            Settings.setPluginEnabled(name, false);
            console.log(`[VencordForAndroid] Stopped plugin: ${name}`);
            return true;
        } catch (err) {
            console.error(`[VencordForAndroid] Error stopping plugin "${name}":`, err);
            return false;
        }
    }

    togglePlugin(name) {
        if (this.isEnabled(name)) {
            return this.stopPlugin(name);
        }
        return this.startPlugin(name);
    }

    stopAll() {
        for (const name of Array.from(this.running)) {
            const plugin = this.getPlugin(name);
            if (plugin) {
                try {
                    plugin.stop({ patcher: Patcher });
                } catch (err) {
                    console.error(`[VencordForAndroid] Error stopping ${name}:`, err);
                }
            }
            Patcher.unpatchAll(name);
            this.running.delete(name);
        }
    }

    uninstallAll() {
        this.stopAll();
        Patcher.unpatchAll();
        Settings.wipeAll();
        this.registry.clear();
    }
}
const PluginManager = new PluginManagerService();

// --- Module: src/core/Updater.js ---
/**
 * VencordForAndroid - In-App Updater & Version Policy Enforcement
 * Checks and installs updates exclusively from https://github.com/juli22292/vencordforandroid
 * Blocks corrupted versions (0.0.1) and forces an immediate update to 0.0.2+.
 */
const CORE_VERSION = "0.0.2";
const MIN_REQUIRED_VERSION = "0.0.2";
const CORRUPTED_VERSIONS = ["0.0.1"];
const CORE_REPO = "juli22292/vencordforandroid";
const INSTALLER_REPO = "juli22292/vencordandroidapp";
const CORE_RELEASES_API = `https://api.github.com/repos/${CORE_REPO}/releases/latest`;
const CORE_MANIFEST_URL = `https://raw.githubusercontent.com/${CORE_REPO}/main/dist/manifest.json`;
const CORE_BUNDLE_URL = `https://raw.githubusercontent.com/${CORE_REPO}/main/dist/vencordforandroid.js`;
const INSTALLER_LATEST_RELEASE_URL = `https://github.com/${INSTALLER_REPO}/releases/latest`;

class UpdaterService {
    constructor() {
        this.lastCheck = null;
        this.latestVersion = CORE_VERSION;
        this.updateAvailable = false;
        this.forceUpdateRequired = false;
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

    enforceVersionPolicy(hostInstallerVersion) {
        if (hostInstallerVersion && this.isVersionCorrupted(hostInstallerVersion)) {
            this.forceUpdateRequired = true;
            this.renderCorruptedVersionLockScreen(hostInstallerVersion);
            return false;
        }
        return true;
    }

    renderCorruptedVersionLockScreen(detectedVersion = "0.0.1") {
        if (typeof document === "undefined") return;
        let lock = document.getElementById("vfa-corrupted-lock");
        if (!lock) {
            lock = document.createElement("div");
            lock.id = "vfa-corrupted-lock";
            lock.style.cssText = "position:fixed;inset:0;z-index:2147483647;background:#111214;color:#f2f3f5;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;text-align:center;font-family:sans-serif;";
            document.body.appendChild(lock);
        }
        lock.innerHTML = `
            <div style="background:#2b2d31;border:2px solid #da373c;border-radius:14px;padding:24px;max-width:420px;width:100%;">
                <div style="background:#da373c;color:#fff;display:inline-block;padding:4px 12px;border-radius:999px;font-size:12px;font-weight:700;margin-bottom:12px;">
                    VERSION ${detectedVersion} BESCHÄDIGT & GESPERRT
                </div>
                <h2 style="margin:0 0 10px 0;font-size:20px;color:#fff;">Pflicht-Update auf v${CORE_VERSION} erforderlich</h2>
                <p style="font-size:14px;color:#b5bac1;line-height:1.5;margin:0 0 18px 0;">
                    Die installierte Version <b>v${detectedVersion}</b> ist als beschädigt markiert und wurde deaktiviert, da sie sich nicht direkt in die bestehende offizielle Discord-App integriert hat. Bitte aktualisiere jetzt auf <b>v${CORE_VERSION}</b>.
                </p>
                <a href="${INSTALLER_LATEST_RELEASE_URL}" style="display:block;background:#23a55a;color:#fff;text-decoration:none;padding:13px 18px;border-radius:8px;font-weight:700;font-size:15px;">
                    Update v${CORE_VERSION} jetzt herunterladen
                </a>
            </div>
        `;
    }

    async checkForUpdates() {
        this.status = "checking";
        this.errorMessage = null;

        try {
            let remoteVersion = CORE_VERSION;
            let notes = "";
            let bundleUrl = CORE_BUNDLE_URL;

            // Check manifest first for corrupted version policy
            try {
                const manifestRes = await fetch(CORE_MANIFEST_URL, { cache: "no-store" });
                if (manifestRes.ok) {
                    const manifest = await manifestRes.json();
                    if (Array.isArray(manifest.corruptedVersions)) {
                        this.corruptedVersions = manifest.corruptedVersions;
                    }
                    remoteVersion = manifest.version || CORE_VERSION;
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
                notes = releaseData.body || notes || "Neues Update für VencordForAndroid und Plugins verfügbar.";
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
                updateAvailable: this.updateAvailable,
                corruptedVersions: this.corruptedVersions,
                releaseNotes: this.releaseNotes,
                downloadUrl: this.downloadUrl,
                repository: CORE_REPO
            };
        } catch (err) {
            this.status = "error";
            this.errorMessage = err?.message || "Verbindung zu GitHub fehlgeschlagen";
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
                throw new Error(`Download fehlgeschlagen (HTTP ${res.status})`);
            }
            const bundleCode = await res.text();

            if (typeof globalThis !== "undefined") {
                if (globalThis.__VENCORD_ANDROID_BRIDGE__?.saveBundleUpdate) {
                    await globalThis.__VENCORD_ANDROID_BRIDGE__.saveBundleUpdate(bundleCode, this.latestVersion);
                } else if (globalThis.localStorage) {
                    globalThis.localStorage.setItem("VencordForAndroid_CachedBundle", bundleCode);
                    globalThis.localStorage.setItem("VencordForAndroid_CachedVersion", this.latestVersion);
                }
            }

            Settings.set("version", this.latestVersion);
            this.updateAvailable = false;
            this.status = "up-to-date";

            return {
                success: true,
                installedVersion: this.latestVersion
            };
        } catch (err) {
            this.status = "error";
            this.errorMessage = err?.message || "Update konnte nicht installiert werden";
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
 * VencordForAndroid - Custom & Built-in Plugins Collection
 * Author: juli22292
 */
const AlwaysAnimatePlugin = definePlugin({
    name: "AlwaysAnimate",
    description: "Animiert Server-Icons, Avatare, Banner und Nitro-Emojis dauerhaft ohne Antippen.",
    authors: [{ name: "juli22292" }],
    version: "0.0.1",
    enabledByDefault: true,
    options: {
        animateAvatars: {
            type: "boolean",
            label: "Avatare immer animieren",
            default: true
        },
        animateGuildIcons: {
            type: "boolean",
            label: "Server-Icons immer animieren",
            default: true
        }
    },
    start({ patcher, settings }) {
        const ImageResolver = patcher.findByProps("getUserAvatarURL", "getGuildIconURL");
        if (ImageResolver) {
            if (settings.animateAvatars !== false && typeof ImageResolver.getUserAvatarURL === "function") {
                patcher.before("AlwaysAnimate", ImageResolver, "getUserAvatarURL", (args) => {
                    if (args.length >= 2) args[1] = true;
                    return args;
                });
            }
            if (settings.animateGuildIcons !== false && typeof ImageResolver.getGuildIconURL === "function") {
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
const ClearURLsPlugin = definePlugin({
    name: "ClearURLs",
    description: "Entfernt automatisch Tracking-Parameter (utm_*, fbclid, si, igshid) beim Senden von Links.",
    authors: [{ name: "juli22292" }],
    version: "0.0.1",
    enabledByDefault: true,
    options: {
        stripYoutubeSi: {
            type: "boolean",
            label: "YouTube/Spotify ?si= Tracking entfernen",
            default: true
        }
    },
    start({ patcher }) {
        const TRACKING_PARAMS = [
            /^utm_/i,
            /^fbclid$/i,
            /^gclid$/i,
            /^igshid$/i,
            /^si$/i,
            /^mc_eid$/i,
            /^_hsenc$/i
        ];

        const cleanTextUrls = (content) => {
            if (typeof content !== "string" || !content.includes("http")) return content;
            return content.replace(/https?:\/\/[^\s<>]+/g, (rawUrl) => {
                try {
                    const url = new URL(rawUrl);
                    for (const key of Array.from(url.searchParams.keys())) {
                        if (TRACKING_PARAMS.some((rx) => rx.test(key))) {
                            url.searchParams.delete(key);
                        }
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
const FakeNitroPlugin = definePlugin({
    name: "FakeNitro",
    description: "Ermöglicht das Senden von animierten & externen Custom-Emojis sowie Stickern ohne Nitro als eingebettete Links.",
    authors: [{ name: "juli22292" }],
    version: "0.0.1",
    enabledByDefault: true,
    options: {
        emojiSize: {
            type: "select",
            label: "Emoji-Größe (px)",
            choices: ["48", "64", "96"],
            default: "48"
        },
        enableStickers: {
            type: "boolean",
            label: "Custom-Sticker aktivieren",
            default: true
        }
    },
    start({ patcher }) {
        const EmojiPermStore = patcher.findByProps("canUseEmojisEverywhere", "canUseAnimatedEmojis");
        if (EmojiPermStore) {
            patcher.instead("FakeNitro", EmojiPermStore, "canUseEmojisEverywhere", () => true);
            patcher.instead("FakeNitro", EmojiPermStore, "canUseAnimatedEmojis", () => true);
        }
    }
});
const MessageLoggerPlugin = definePlugin({
    name: "MessageLogger",
    description: "Speichert gelöschte und bearbeitete Nachrichten lokal im Chat und markiert sie farblich.",
    authors: [{ name: "juli22292" }],
    version: "0.0.1",
    enabledByDefault: true,
    options: {
        ignoreBots: {
            type: "boolean",
            label: "Bot-Nachrichten ignorieren",
            default: true
        },
        ignoreSelf: {
            type: "boolean",
            label: "Eigene gelöschte Nachrichten ignorieren",
            default: false
        }
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
const NoReplyMentionPlugin = definePlugin({
    name: "NoReplyMention",
    description: "Deaktiviert standardmäßig den @Ping beim Antworten auf Nachrichten.",
    authors: [{ name: "juli22292" }],
    version: "0.0.1",
    enabledByDefault: true,
    options: {
        inverseShiftReply: {
            type: "boolean",
            label: "Bei eigenen Kontakten trotzdem pingen",
            default: false
        }
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
const SilentTypingPlugin = definePlugin({
    name: "SilentTyping",
    description: "Verbirgt deinen 'Schreibt gerade...'-Indikator für andere Nutzer im Chat.",
    authors: [{ name: "juli22292" }],
    version: "0.0.1",
    enabledByDefault: false,
    options: {
        showQuickToggle: {
            type: "boolean",
            label: "Schnellschalter neben dem Textfeld anzeigen",
            default: true
        }
    },
    start({ patcher }) {
        const TypingActions = patcher.findByProps("startTyping", "stopTyping");
        if (TypingActions && typeof TypingActions.startTyping === "function") {
            patcher.instead("SilentTyping", TypingActions, "startTyping", () => {});
        }
    }
});
const ShowHiddenChannelsPlugin = definePlugin({
    name: "ShowHiddenChannels",
    description: "Zeigt versteckte Kanäle auf Servern inklusive Kanal-Thema und Berechtigungsübersicht an.",
    authors: [{ name: "juli22292" }],
    version: "0.0.1",
    enabledByDefault: false,
    options: {
        showVoiceUsers: {
            type: "boolean",
            label: "Nutzer in gesperrten Sprachkanälen anzeigen",
            default: true
        }
    },
    start() {
        // Hooks permission checks for channel list visibility
    }
});
const ReadAllNotificationsButtonPlugin = definePlugin({
    name: "ReadAllNotificationsButton",
    description: "Fügt einen Button hinzu, um alle ungelesenen Server und Kanäle mit einem Tipp als gelesen zu markieren.",
    authors: [{ name: "juli22292" }],
    version: "0.0.1",
    enabledByDefault: true,
    start() {}
});
const TranslateMessagesPlugin = definePlugin({
    name: "Translate",
    description: "Übersetzt fremdsprachige Nachrichten direkt im Nachrichtenmenü auf Deutsch.",
    authors: [{ name: "juli22292" }],
    version: "0.0.1",
    enabledByDefault: true,
    options: {
        targetLang: {
            type: "select",
            label: "Zielsprache",
            choices: ["de", "en", "fr", "es"],
            default: "de"
        }
    },
    start() {}
});
const BetterTimestampsPlugin = definePlugin({
    name: "BetterTimestamps",
    description: "Zeigt genaue Uhrzeiten (inkl. Sekunden) und vollständige Datumsangaben bei Nachrichten an.",
    authors: [{ name: "juli22292" }],
    version: "0.0.1",
    enabledByDefault: false,
    start() {}
});
const BUILTIN_PLUGINS = [
    AlwaysAnimatePlugin,
    ClearURLsPlugin,
    FakeNitroPlugin,
    MessageLoggerPlugin,
    NoReplyMentionPlugin,
    SilentTypingPlugin,
    ShowHiddenChannelsPlugin,
    ReadAllNotificationsButtonPlugin,
    TranslateMessagesPlugin,
    BetterTimestampsPlugin
];

// --- Module: src/ui/DiscordSettingsInjector.js ---
/**
 * VencordForAndroid - Discord Settings Injector
 * Injects the "VencordForAndroid" section into Discord's mobile settings menu with paths:
 * - Einstellungen (General Settings)
 * - Plugins (Manage & Toggle Plugins)
 * - Updater (In-App Updates from juli22292/vencordforandroid)
 * - Backup & Reset (Export, Import & Uninstall)
 */
class DiscordSettingsInjector {
    constructor() {
        this.activeModalTab = "plugins";
        this.searchQuery = "";
        this.filterMode = "all"; // all | enabled | disabled
    }

    init() {
        this._patchReactNativeSettings();
        if (typeof document !== "undefined") {
            this._injectWebAndHybridSettingsUI();
        }
    }

    /**
     * Hooks into Discord Android React Native SettingsOverviewScreen sections
     */
    _patchReactNativeSettings() {
        try {
            const SettingsOverview = Patcher.findByName("SettingsOverviewScreen") || Patcher.findByProps("useOverviewSettings");
            if (SettingsOverview && typeof SettingsOverview.useOverviewSettings === "function") {
                Patcher.after("VencordSettingsInjector", SettingsOverview, "useOverviewSettings", (_args, sections) => {
                    if (!Array.isArray(sections)) return sections;
                    if (sections.some((s) => s?.title === "VencordForAndroid")) return sections;

                    const vencordSection = {
                        title: "VencordForAndroid",
                        settings: [
                            "VENCORD_FOR_ANDROID_SETTINGS",
                            "VENCORD_FOR_ANDROID_PLUGINS",
                            "VENCORD_FOR_ANDROID_UPDATER",
                            "VENCORD_FOR_ANDROID_BACKUP"
                        ]
                    };
                    return [vencordSection, ...sections];
                });
            }
        } catch (err) {
            console.warn("[VencordForAndroid] React Native settings hook skipped:", err);
        }
    }

    /**
     * Injects the VencordForAndroid section into Discord Settings & provides a full interactive Settings/Plugins drawer
     */
    _injectWebAndHybridSettingsUI() {
        if (document.getElementById("vencordforandroid-styles")) return;

        const style = document.createElement("style");
        style.id = "vencordforandroid-styles";
        style.textContent = `
            .vfa-overlay {
                position: fixed;
                inset: 0;
                background: rgba(0, 0, 0, 0.72);
                z-index: 999999;
                display: flex;
                flex-direction: column;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                color: #f2f3f5;
            }
            .vfa-sheet {
                background: #1e1f22;
                width: 100%;
                height: 100%;
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }
            .vfa-header {
                background: #2b2d31;
                padding: 16px 18px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                border-bottom: 1px solid #3f4147;
            }
            .vfa-header-title {
                display: flex;
                align-items: center;
                gap: 10px;
                font-size: 18px;
                font-weight: 700;
                color: #ffffff;
            }
            .vfa-badge {
                background: #5865f2;
                color: #fff;
                font-size: 11px;
                padding: 2px 8px;
                border-radius: 999px;
                font-weight: 600;
            }
            .vfa-tabs {
                display: flex;
                background: #232428;
                border-bottom: 1px solid #3f4147;
                overflow-x: auto;
            }
            .vfa-tab {
                padding: 13px 16px;
                font-size: 14px;
                font-weight: 600;
                color: #b5bac1;
                background: transparent;
                border: none;
                border-bottom: 2px solid transparent;
                cursor: pointer;
                white-space: nowrap;
            }
            .vfa-tab.active {
                color: #ffffff;
                border-bottom-color: #5865f2;
            }
            .vfa-body {
                flex: 1;
                overflow-y: auto;
                padding: 16px;
            }
            .vfa-card {
                background: #2b2d31;
                border: 1px solid #3f4147;
                border-radius: 12px;
                padding: 14px 16px;
                margin-bottom: 12px;
            }
            .vfa-plugin-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 6px;
            }
            .vfa-plugin-name {
                font-size: 15px;
                font-weight: 700;
                color: #ffffff;
            }
            .vfa-plugin-desc {
                font-size: 13px;
                color: #b5bac1;
                line-height: 1.4;
            }
            .vfa-switch {
                position: relative;
                width: 46px;
                height: 26px;
                background: #4e5058;
                border-radius: 999px;
                border: none;
                cursor: pointer;
                transition: background 0.2s;
            }
            .vfa-switch.on {
                background: #23a55a;
            }
            .vfa-switch::after {
                content: "";
                position: absolute;
                top: 3px;
                left: 3px;
                width: 20px;
                height: 20px;
                background: #ffffff;
                border-radius: 50%;
                transition: transform 0.2s;
            }
            .vfa-switch.on::after {
                transform: translateX(20px);
            }
            .vfa-btn {
                background: #5865f2;
                color: #ffffff;
                border: none;
                border-radius: 8px;
                padding: 10px 16px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
            }
            .vfa-btn.danger {
                background: #da373c;
            }
            .vfa-btn.secondary {
                background: #4e5058;
            }
            .vfa-search {
                width: 100%;
                box-sizing: border-box;
                background: #111214;
                border: 1px solid #3f4147;
                color: #fff;
                padding: 11px 14px;
                border-radius: 8px;
                margin-bottom: 14px;
                font-size: 14px;
            }
        `;
        document.head.appendChild(style);

        // Observe Discord settings sidebar / list and inject the "VencordForAndroid" section automatically
        const observer = new MutationObserver(() => {
            this._tryInjectSettingsSidebarSection();
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    _tryInjectSettingsSidebarSection() {
        if (document.getElementById("vfa-discord-settings-section")) return;
        const navList = document.querySelector('[role="tablist"], [aria-label*="Settings"], [class*="sidebar"]');
        if (!navList) return;

        const section = document.createElement("div");
        section.id = "vfa-discord-settings-section";
        section.style.cssText = "padding: 8px 10px; margin-top: 8px; border-top: 1px solid rgba(255,255,255,0.08);";

        const header = document.createElement("div");
        header.textContent = "VencordForAndroid";
        header.style.cssText = "font-size: 12px; font-weight: 700; text-transform: uppercase; color: #949ba4; padding: 6px 10px;";
        section.appendChild(header);

        const items = [
            { id: "settings", label: "Einstellungen" },
            { id: "plugins", label: "Plugins" },
            { id: "updater", label: "Updater" },
            { id: "backup", label: "Backup & Reset" }
        ];

        for (const item of items) {
            const row = document.createElement("div");
            row.textContent = item.label;
            row.style.cssText = "padding: 8px 10px; border-radius: 6px; color: #dbdee1; font-size: 15px; font-weight: 500; cursor: pointer;";
            row.addEventListener("click", () => this.openSettingsModal(item.id));
            section.appendChild(row);
        }

        navList.appendChild(section);
    }

    openSettingsModal(initialTab = "plugins") {
        this.activeModalTab = initialTab;
        if (typeof document === "undefined") return;

        let overlay = document.getElementById("vfa-settings-overlay");
        if (!overlay) {
            overlay = document.createElement("div");
            overlay.id = "vfa-settings-overlay";
            overlay.className = "vfa-overlay";
            document.body.appendChild(overlay);
        }
        this._renderModalContent(overlay);
    }

    closeSettingsModal() {
        const overlay = document.getElementById("vfa-settings-overlay");
        if (overlay) overlay.remove();
    }

    _renderModalContent(overlay) {
        const plugins = PluginManager.getAllPlugins();
        const enabledCount = plugins.filter((p) => p.enabled).length;

        overlay.innerHTML = `
            <div class="vfa-sheet">
                <div class="vfa-header">
                    <div class="vfa-header-title">
                        <span>VencordForAndroid</span>
                        <span class="vfa-badge">v${CORE_VERSION}</span>
                    </div>
                    <button class="vfa-btn secondary" id="vfa-close-btn">Schließen</button>
                </div>
                <div class="vfa-tabs">
                    <button class="vfa-tab ${this.activeModalTab === "settings" ? "active" : ""}" data-tab="settings">Einstellungen</button>
                    <button class="vfa-tab ${this.activeModalTab === "plugins" ? "active" : ""}" data-tab="plugins">Plugins (${enabledCount}/${plugins.length})</button>
                    <button class="vfa-tab ${this.activeModalTab === "updater" ? "active" : ""}" data-tab="updater">Updater</button>
                    <button class="vfa-tab ${this.activeModalTab === "backup" ? "active" : ""}" data-tab="backup">Backup & Reset</button>
                </div>
                <div class="vfa-body" id="vfa-tab-body"></div>
            </div>
        `;

        overlay.querySelector("#vfa-close-btn").addEventListener("click", () => this.closeSettingsModal());
        overlay.querySelectorAll(".vfa-tab").forEach((btn) => {
            btn.addEventListener("click", () => {
                this.activeModalTab = btn.getAttribute("data-tab");
                this._renderModalContent(overlay);
            });
        });

        const body = overlay.querySelector("#vfa-tab-body");
        if (this.activeModalTab === "plugins") {
            this._renderPluginsTab(body, overlay);
        } else if (this.activeModalTab === "settings") {
            this._renderGeneralSettingsTab(body, overlay);
        } else if (this.activeModalTab === "updater") {
            this._renderUpdaterTab(body, overlay);
        } else if (this.activeModalTab === "backup") {
            this._renderBackupTab(body, overlay);
        }
    }

    _renderPluginsTab(container, overlay) {
        const allPlugins = PluginManager.getAllPlugins().filter((p) => {
            if (!this.searchQuery) return true;
            const q = this.searchQuery.toLowerCase();
            return p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
        });

        container.innerHTML = `
            <input type="text" class="vfa-search" id="vfa-plugin-search" placeholder="Plugins durchsuchen..." value="${this.searchQuery}" />
            <div id="vfa-plugin-list"></div>
        `;

        const searchInput = container.querySelector("#vfa-plugin-search");
        searchInput.addEventListener("input", (e) => {
            this.searchQuery = e.target.value;
            this._renderPluginsTab(container, overlay);
            const input = container.querySelector("#vfa-plugin-search");
            input.focus();
            input.setSelectionRange(input.value.length, input.value.length);
        });

        const list = container.querySelector("#vfa-plugin-list");
        for (const plugin of allPlugins) {
            const card = document.createElement("div");
            card.className = "vfa-card";
            card.innerHTML = `
                <div class="vfa-plugin-header">
                    <div>
                        <div class="vfa-plugin-name">${plugin.name}</div>
                        <div style="font-size: 11px; color: #949ba4;">von ${plugin.authors.map((a) => a.name).join(", ")} • v${plugin.version}</div>
                    </div>
                    <button class="vfa-switch ${plugin.enabled ? "on" : ""}" data-plugin="${plugin.name}"></button>
                </div>
                <div class="vfa-plugin-desc">${plugin.description}</div>
            `;
            card.querySelector(".vfa-switch").addEventListener("click", () => {
                PluginManager.togglePlugin(plugin.name);
                this._renderModalContent(overlay);
            });
            list.appendChild(card);
        }
    }

    _renderGeneralSettingsTab(container, overlay) {
        const autoUpdate = Settings.get("autoUpdateCheck");
        const safeMode = Settings.get("safeMode");
        const devMode = Settings.get("developerMode");

        container.innerHTML = `
            <div class="vfa-card">
                <div class="vfa-plugin-header">
                    <div>
                        <div class="vfa-plugin-name">Automatisch nach Updates suchen</div>
                        <div class="vfa-plugin-desc">Prüft beim Start von Discord im Repository ${CORE_REPO} auf neue Plugin- und Core-Updates.</div>
                    </div>
                    <button class="vfa-switch ${autoUpdate ? "on" : ""}" id="vfa-toggle-autoupdate"></button>
                </div>
            </div>
            <div class="vfa-card">
                <div class="vfa-plugin-header">
                    <div>
                        <div class="vfa-plugin-name">Abgesicherter Modus (Safe Mode)</div>
                        <div class="vfa-plugin-desc">Startet VencordForAndroid temporär ohne zusätzliche Plugins, falls ein Plugin Probleme verursacht.</div>
                    </div>
                    <button class="vfa-switch ${safeMode ? "on" : ""}" id="vfa-toggle-safemode"></button>
                </div>
            </div>
            <div class="vfa-card">
                <div class="vfa-plugin-header">
                    <div>
                        <div class="vfa-plugin-name">Entwicklermodus</div>
                        <div class="vfa-plugin-desc">Aktiviert erweiterte Protokolle und den Modul-Inspektor in Discord.</div>
                    </div>
                    <button class="vfa-switch ${devMode ? "on" : ""}" id="vfa-toggle-devmode"></button>
                </div>
            </div>
            <div class="vfa-card">
                <div class="vfa-plugin-name">VencordForAndroid Info</div>
                <div class="vfa-plugin-desc" style="margin-top:6px;">
                    Version: <b>${CORE_VERSION}</b><br/>
                    Plugin-Repository: <b>https://github.com/${CORE_REPO}</b><br/>
                    Installer-App: <b>VencordAndroidApp</b>
                </div>
            </div>
        `;

        container.querySelector("#vfa-toggle-autoupdate").addEventListener("click", () => {
            Settings.set("autoUpdateCheck", !autoUpdate);
            this._renderModalContent(overlay);
        });
        container.querySelector("#vfa-toggle-safemode").addEventListener("click", () => {
            Settings.set("safeMode", !safeMode);
            this._renderModalContent(overlay);
        });
        container.querySelector("#vfa-toggle-devmode").addEventListener("click", () => {
            Settings.set("developerMode", !devMode);
            this._renderModalContent(overlay);
        });
    }

    _renderUpdaterTab(container, overlay) {
        container.innerHTML = `
            <div class="vfa-card">
                <div class="vfa-plugin-name">VencordForAndroid In-App Updater</div>
                <div class="vfa-plugin-desc" style="margin-top: 6px;">
                    Installierte Version: <b>v${CORE_VERSION}</b><br/>
                    Neueste Version: <b>v${Updater.latestVersion}</b><br/>
                    Quelle: <b>github.com/${CORE_REPO}</b>
                </div>
                <div style="margin-top: 14px; display: flex; gap: 10px;">
                    <button class="vfa-btn" id="vfa-check-update-btn">Auf Updates prüfen</button>
                    ${Updater.updateAvailable ? `<button class="vfa-btn" style="background:#23a55a;" id="vfa-install-update-btn">Update jetzt installieren</button>` : ""}
                </div>
                <div id="vfa-updater-status" style="margin-top: 10px; font-size: 13px; color: #b5bac1;">
                    ${Updater.status === "up-to-date" ? "VencordForAndroid und alle Plugins sind auf dem neuesten Stand." : ""}
                    ${Updater.status === "update-available" ? `Neues Update v${Updater.latestVersion} verfügbar!` : ""}
                    ${Updater.errorMessage ? `Fehler: ${Updater.errorMessage}` : ""}
                </div>
            </div>
        `;

        container.querySelector("#vfa-check-update-btn").addEventListener("click", async () => {
            const statusEl = container.querySelector("#vfa-updater-status");
            statusEl.textContent = "Suche nach Updates auf GitHub...";
            await Updater.checkForUpdates();
            this._renderModalContent(overlay);
        });

        const installBtn = container.querySelector("#vfa-install-update-btn");
        if (installBtn) {
            installBtn.addEventListener("click", async () => {
                installBtn.disabled = true;
                installBtn.textContent = "Installiere Update...";
                await Updater.downloadAndApplyUpdate();
                this._renderModalContent(overlay);
            });
        }
    }

    _renderBackupTab(container, overlay) {
        container.innerHTML = `
            <div class="vfa-card">
                <div class="vfa-plugin-name">Plugins & Einstellungen zurücksetzen</div>
                <div class="vfa-plugin-desc" style="margin-top: 6px;">
                    Setzt alle aktivierten Plugins und Einstellungen von VencordForAndroid auf die Standardwerte zurück.
                </div>
                <div style="margin-top: 12px;">
                    <button class="vfa-btn danger" id="vfa-reset-all-btn">Alle Plugins zurücksetzen</button>
                </div>
            </div>
        `;

        container.querySelector("#vfa-reset-all-btn").addEventListener("click", () => {
            PluginManager.stopAll();
            Settings.wipeAll();
            PluginManager.startAllEnabled();
            this._renderModalContent(overlay);
        });
    }
}
const SettingsInjector = new DiscordSettingsInjector();

// --- Module: src/index.js ---
/**
 * VencordForAndroid - Main Entry Point
 * Repository: https://github.com/juli22292/vencordforandroid
 * Version: 0.0.2
 * Injects directly into the existing official Discord Android app (com.discord).
 */






class VencordForAndroidRuntime {
    constructor() {
        this.version = CORE_VERSION;
        this.corruptedVersions = CORRUPTED_VERSIONS;
        this.repository = CORE_REPO;
        this.targetPackage = "com.discord";
        this.initialized = false;
        this.Settings = Settings;
        this.Patcher = Patcher;
        this.Plugins = PluginManager;
        this.Updater = Updater;
        this.UI = SettingsInjector;
        this.definePlugin = definePlugin;
    }

    async init() {
        if (this.initialized) return;

        // Check if host installer or previously cached state is on corrupted version 0.0.1
        let hostVersion = null;
        try {
            if (typeof globalThis !== "undefined" && globalThis.AndroidInstaller?.getSystemStatusJson) {
                const status = JSON.parse(globalThis.AndroidInstaller.getSystemStatusJson());
                hostVersion = status.installerVersion;
            } else if (typeof globalThis !== "undefined" && globalThis.__VENCORD_HOST_VERSION__) {
                hostVersion = globalThis.__VENCORD_HOST_VERSION__;
            }
        } catch (_) {}

        if (hostVersion && !Updater.enforceVersionPolicy(hostVersion)) {
            console.error(`[VencordForAndroid] Blocked execution on corrupted version v${hostVersion}. Update to v${this.version} required.`);
            return;
        }

        Settings.set("version", this.version);
        console.log(`[VencordForAndroid] Initializing v${this.version} inside official Discord (${this.targetPackage})...`);

        // 1. Register all built-in and custom plugins
        PluginManager.registerAll(BUILTIN_PLUGINS);

        // 2. Start all enabled plugins
        PluginManager.startAllEnabled();

        // 3. Inject "VencordForAndroid" section into the official Discord app Settings ("Einstellungen", "Plugins", "Updater", "Backup & Reset")
        SettingsInjector.init();

        this.initialized = true;
        console.log(`[VencordForAndroid] Loaded ${PluginManager.getAllPlugins().length} plugins into official Discord app.`);

        // 4. Auto-update check against juli22292/vencordforandroid
        if (Settings.get("autoUpdateCheck")) {
            Updater.checkForUpdates().catch(() => {});
        }
    }

    uninstall() {
        console.log("[VencordForAndroid] Uninstalling VencordForAndroid and all plugins from official Discord...");
        SettingsInjector.closeSettingsModal();
        const section = typeof document !== "undefined" ? document.getElementById("vfa-discord-settings-section") : null;
        if (section) section.remove();
        PluginManager.uninstallAll();
        this.initialized = false;
    }
}
const VencordForAndroid = new VencordForAndroidRuntime();

if (typeof globalThis !== "undefined") {
    globalThis.VencordForAndroid = VencordForAndroid;
}
if (typeof window !== "undefined") {
    window.VencordForAndroid = VencordForAndroid;
}

VencordForAndroid.init();

})(typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : this);
