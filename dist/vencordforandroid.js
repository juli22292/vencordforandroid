/**
 * VencordForAndroid v0.0.3
 * Repository: https://github.com/juli22292/vencordforandroid
 * Official Vencord Plugins adapted for Android (170 plugins)
 * Target: Official Discord Android App (com.discord / com.discord.ptb / com.discord.canary)
 * Corrupted/Blocked Versions: 0.0.1
 * Built: 2026-11-24T18:29:52.205Z
 */
(function (global) {
"use strict";

// --- Module: src/core/Settings.js ---
/**
 * VencordForAndroid - Persistent Settings Store (v0.0.3)
 * Manages core configuration, QuickCSS, themes, UI element visibility, and per-plugin state.
 */

const STORAGE_KEY = "VencordForAndroid_Settings_v1";

const DEFAULT_SETTINGS = {
    version: "0.0.3",
    installedAt: null,
    autoUpdateCheck: true,
    notifyOnUpdates: true,
    safeMode: false,
    developerMode: false,
    useQuickCss: true,
    quickCss: "",
    themeLinks: [],
    uiElements: {
        chatBarButtons: true,
        messagePopoverButtons: true
    },
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
                version: "0.0.3",
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
        if (typeof globalThis !== "undefined" && globalThis.__VENCORD_ANDROID_BRIDGE__?.setPluginEnabledNative) {
            try {
                globalThis.__VENCORD_ANDROID_BRIDGE__.setPluginEnabledNative(pluginName, Boolean(enabled));
            } catch (_) {}
        }
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
 * VencordForAndroid - Plugin Manager (v0.0.3)
 * Handles registration, tags, options (cog wheel vs info icon), and lifecycle of official Vencord plugins on Android.
 */
function definePlugin(definition) {
    const options = definition.options || {};
    return {
        name: definition.name,
        description: definition.description || "",
        authors: definition.authors || [{ name: "Vendicated" }, { name: "juli22292" }],
        tags: definition.tags || ["Utility"],
        version: definition.version || "0.0.3",
        required: Boolean(definition.required),
        enabledByDefault: Boolean(definition.enabledByDefault || definition.required),
        hasSettings: Object.keys(options).length > 0,
        options,
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
        const sorted = [...pluginList].sort((a, b) => a.name.localeCompare(b.name));
        for (const plugin of sorted) {
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
                } catch (_) {}
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
const CORE_VERSION = "0.0.3";
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
 * VencordForAndroid - Official Vencord Settings UI in Discord Settings (v0.0.3)
 * Replicates the exact official Vencord Settings section inside Discord Settings:
 * - Vencord (Einstellungen)
 * - Plugins (with Plugin Management box, Manage plugin UI elements, Search + Show All + Filter by Tags, 2-column grid, Cog wheel / Info icon & Blurple checkmark toggle)
 * - Themes
 * - Updater
 * - Cloud
 * - Backup & Restore
 */




const SVG_ICONS = {
    vencord: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>`,
    plugins: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20.5 11H19V7c0-1.1-.9-2-2-2h-4V3.5C13 2.12 11.88 1 10.5 1S8 2.12 8 3.5V5H4c-1.1 0-1.99.9-1.99 2v3.8H3.5c1.49 0 2.7 1.21 2.7 2.7s-1.21 2.7-2.7 2.7H2V20c0 1.1.9 2 2 2h3.8v-1.5c0-1.49 1.21-2.7 2.7-2.7 1.49 0 2.7 1.21 2.7 2.7V22H17c1.1 0 2-.9 2-2v-4h1.5c1.38 0 2.5-1.12 2.5-2.5S21.88 11 20.5 11z"/></svg>`,
    themes: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 9 6.5 9 8 9.67 8 10.5 7.33 12 6.5 12zm3-4C8.67 8 8 7.33 8 6.5S8.67 5 9.5 5s1.5.67 1.5 1.5S10.33 8 9.5 8zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 5 14.5 5s1.5.67 1.5 1.5S15.33 8 14.5 8zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 9 17.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>`,
    updater: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>`,
    cloud: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/></svg>`,
    backup: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>`,
    cog: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>`,
    info: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>`,
    check: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5865f2" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    cross: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#72767d" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    chevronRight: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`,
    close: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    sidebar: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`
};
class DiscordSettingsInjector {
    constructor() {
        this.activeModalTab = "plugins"; // vencord | plugins | themes | updater | cloud | backup
        this.searchQuery = "";
        this.filterMode = "all"; // all | enabled | disabled
        this.tagFilter = "all";
        this.sidebarOpenMobile = false;
        this.activePluginModal = null;
        this.uiElementsModalOpen = false;
    }

    init() {
        this._patchReactNativeSettings();
        if (typeof document !== "undefined") {
            this._injectStylesAndObserver();
        }
    }

    _patchReactNativeSettings() {
        try {
            const SettingsOverview = Patcher.findByName("SettingsOverviewScreen") || Patcher.findByProps("useOverviewSettings");
            if (SettingsOverview && typeof SettingsOverview.useOverviewSettings === "function") {
                Patcher.after("VencordSettingsInjector", SettingsOverview, "useOverviewSettings", (_args, sections) => {
                    if (!Array.isArray(sections)) return sections;
                    if (sections.some((s) => s?.title === "Vencord Settings" || s?.title === "VencordForAndroid")) return sections;

                    const vencordSection = {
                        title: "Vencord Settings",
                        settings: [
                            "VENCORD_SETTINGS_MAIN",
                            "VENCORD_SETTINGS_PLUGINS",
                            "VENCORD_SETTINGS_THEMES",
                            "VENCORD_SETTINGS_UPDATER",
                            "VENCORD_SETTINGS_CLOUD",
                            "VENCORD_SETTINGS_BACKUP"
                        ]
                    };
                    // Insert right before Billing / Nitro section if found, else after Account section
                    const billingIdx = sections.findIndex((s) =>
                        String(s?.title || "").toLowerCase().includes("billing") ||
                        String(s?.title || "").toLowerCase().includes("zahlung")
                    );
                    if (billingIdx > 0) {
                        const copy = [...sections];
                        copy.splice(billingIdx, 0, vencordSection);
                        return copy;
                    }
                    return [sections[0], vencordSection, ...sections.slice(1)];
                });
            }
        } catch (err) {
            console.warn("[VencordForAndroid] React Native settings hook skipped:", err);
        }
    }

    _injectStylesAndObserver() {
        if (document.getElementById("vencordforandroid-styles")) return;

        const style = document.createElement("style");
        style.id = "vencordforandroid-styles";
        style.textContent = `
            .vfa-overlay {
                position: fixed;
                inset: 0;
                background: #313338;
                z-index: 999999;
                display: flex;
                font-family: "gg sans", "Noto Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                color: #f2f3f5;
                user-select: none;
            }
            .vfa-layout {
                display: flex;
                width: 100%;
                height: 100%;
                overflow: hidden;
            }
            /* Left Discord Settings Sidebar (1:1 like Screenshot) */
            .vfa-sidebar {
                width: 240px;
                min-width: 240px;
                background: #2b2d31;
                display: flex;
                flex-direction: column;
                padding: 16px 8px 16px 14px;
                overflow-y: auto;
                border-right: 1px solid rgba(255, 255, 255, 0.04);
            }
            .vfa-sidebar-profile {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 6px 8px 14px 8px;
            }
            .vfa-avatar {
                width: 40px;
                height: 40px;
                border-radius: 50%;
                background: linear-gradient(135deg, #5865f2, #eb459e);
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: 800;
                font-size: 16px;
                color: #fff;
            }
            .vfa-profile-name {
                font-size: 15px;
                font-weight: 700;
                color: #f2f3f5;
            }
            .vfa-profile-sub {
                font-size: 12px;
                color: #949ba4;
            }
            .vfa-sidebar-search {
                background: #1e1f22;
                border: none;
                border-radius: 4px;
                color: #dbdee1;
                padding: 7px 10px;
                font-size: 13px;
                margin: 0 6px 12px 6px;
            }
            .vfa-nav-cat {
                font-size: 12px;
                font-weight: 700;
                color: #949ba4;
                padding: 12px 10px 4px 10px;
            }
            .vfa-nav-sep {
                height: 1px;
                background: #3f4147;
                margin: 8px 10px;
            }
            .vfa-nav-item {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 7px 10px;
                margin: 1px 4px;
                border-radius: 4px;
                font-size: 14px;
                font-weight: 500;
                color: #b5bac1;
                cursor: pointer;
                transition: background 0.12s, color 0.12s;
            }
            .vfa-nav-item:hover {
                background: #35373c;
                color: #dbdee1;
            }
            .vfa-nav-item.active {
                background: #404249;
                color: #ffffff;
            }
            .vfa-nav-item.muted {
                opacity: 0.75;
            }
            /* Right Main Content Area */
            .vfa-content-wrap {
                flex: 1;
                background: #313338;
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }
            .vfa-topbar {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 18px 24px 14px 24px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.04);
            }
            .vfa-topbar-left {
                display: flex;
                align-items: center;
                gap: 12px;
            }
            .vfa-mobile-menu-btn {
                display: none;
                background: #2b2d31;
                border: 1px solid #3f4147;
                color: #dbdee1;
                border-radius: 6px;
                padding: 6px 8px;
                cursor: pointer;
            }
            .vfa-page-title {
                font-size: 20px;
                font-weight: 700;
                color: #f2f3f5;
                margin: 0;
            }
            .vfa-close-circle {
                background: transparent;
                border: 2px solid #b5bac1;
                color: #b5bac1;
                width: 34px;
                height: 34px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
            }
            .vfa-close-circle:hover {
                color: #fff;
                border-color: #fff;
            }
            .vfa-scroll-area {
                flex: 1;
                overflow-y: auto;
                padding: 20px 24px 60px 24px;
                max-width: 820px;
                width: 100%;
                margin: 0 auto;
            }
            /* Vencord Info Boxes (Plugin Management & Manage UI elements) */
            .vfa-info-box {
                background: #2b2d31;
                border: 1px solid #3f4147;
                border-radius: 8px;
                padding: 16px 18px;
                margin-bottom: 14px;
            }
            .vfa-info-box.clickable {
                display: flex;
                align-items: center;
                justify-content: space-between;
                cursor: pointer;
                transition: background 0.15s;
            }
            .vfa-info-box.clickable:hover {
                background: #35373c;
            }
            .vfa-box-title {
                font-size: 16px;
                font-weight: 700;
                color: #f2f3f5;
                margin-bottom: 4px;
            }
            .vfa-box-sub {
                font-size: 13px;
                color: #b5bac1;
                line-height: 1.45;
            }
            /* Filters Section */
            .vfa-section-heading {
                font-size: 16px;
                font-weight: 700;
                color: #f2f3f5;
                margin: 22px 0 10px 0;
            }
            .vfa-search-input {
                width: 100%;
                box-sizing: border-box;
                background: #1e1f22;
                border: 1px solid #111214;
                border-radius: 6px;
                color: #dbdee1;
                padding: 10px 12px;
                font-size: 14px;
                margin-bottom: 10px;
                outline: none;
            }
            .vfa-search-input:focus {
                border-color: #5865f2;
            }
            .vfa-filter-row {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 10px;
                margin-bottom: 16px;
            }
            .vfa-select {
                width: 100%;
                background: #1e1f22;
                border: 1px solid #111214;
                border-radius: 6px;
                color: #dbdee1;
                padding: 10px 12px;
                font-size: 14px;
                outline: none;
                cursor: pointer;
            }
            /* 2-Column Official Vencord Plugins Grid */
            .vfa-plugins-grid {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 12px;
            }
            @media (max-width: 640px) {
                .vfa-plugins-grid {
                    grid-template-columns: 1fr;
                }
                .vfa-sidebar {
                    position: absolute;
                    left: 0;
                    top: 0;
                    bottom: 0;
                    z-index: 20;
                    transform: translateX(-100%);
                    transition: transform 0.2s ease;
                    box-shadow: 4px 0 20px rgba(0, 0, 0, 0.6);
                }
                .vfa-sidebar.mobile-open {
                    transform: translateX(0);
                }
                .vfa-mobile-menu-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .vfa-scroll-area {
                    padding: 14px 16px 60px 16px;
                }
                .vfa-topbar {
                    padding: 14px 16px;
                }
            }
            .vfa-plugin-card {
                background: #2b2d31;
                border: 1px solid rgba(255, 255, 255, 0.05);
                border-radius: 8px;
                padding: 14px 16px;
                display: flex;
                flex-direction: column;
                justify-content: flex-start;
                min-height: 92px;
            }
            .vfa-plugin-top {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
                margin-bottom: 8px;
            }
            .vfa-plugin-title {
                font-size: 15px;
                font-weight: 700;
                color: #f2f3f5;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            .vfa-plugin-controls {
                display: flex;
                align-items: center;
                gap: 10px;
                flex-shrink: 0;
            }
            .vfa-icon-btn {
                background: transparent;
                border: none;
                color: #b5bac1;
                padding: 2px;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                transition: color 0.15s;
            }
            .vfa-icon-btn:hover {
                color: #ffffff;
            }
            /* Official Vencord / Discord Toggle Switch with Checkmark / Cross */
            .vfa-toggle {
                position: relative;
                width: 40px;
                height: 24px;
                background: #72767d;
                border-radius: 14px;
                border: none;
                cursor: pointer;
                padding: 0;
                transition: background 0.18s ease;
                display: flex;
                align-items: center;
            }
            .vfa-toggle.checked {
                background: #5865f2;
            }
            .vfa-toggle:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            .vfa-toggle-knob {
                position: absolute;
                top: 3px;
                left: 3px;
                width: 18px;
                height: 18px;
                background: #ffffff;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: transform 0.18s ease;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
            }
            .vfa-toggle.checked .vfa-toggle-knob {
                transform: translateX(16px);
            }
            .vfa-plugin-desc {
                font-size: 13px;
                color: #b5bac1;
                line-height: 1.4;
            }
            /* Plugin Settings / Info Sub-Modal */
            .vfa-modal-backdrop {
                position: fixed;
                inset: 0;
                background: rgba(0, 0, 0, 0.72);
                z-index: 1000001;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 16px;
            }
            .vfa-modal-dialog {
                background: #313338;
                border: 1px solid #3f4147;
                border-radius: 10px;
                max-width: 500px;
                width: 100%;
                max-height: 85vh;
                display: flex;
                flex-direction: column;
                overflow: hidden;
                box-shadow: 0 12px 32px rgba(0, 0, 0, 0.6);
            }
            .vfa-modal-head {
                padding: 16px 20px;
                background: #2b2d31;
                display: flex;
                align-items: center;
                justify-content: space-between;
                border-bottom: 1px solid #3f4147;
            }
            .vfa-modal-body {
                padding: 18px 20px;
                overflow-y: auto;
            }
            .vfa-btn {
                background: #5865f2;
                color: #ffffff;
                border: none;
                border-radius: 4px;
                padding: 10px 16px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
            }
            .vfa-btn.green { background: #248046; }
            .vfa-btn.danger { background: #da373c; }
            .vfa-btn.secondary { background: #4e5058; }
        `;
        document.head.appendChild(style);

        const observer = new MutationObserver(() => {
            this._tryInjectSettingsSidebarSection();
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    /**
     * Injects the "Vencord Settings" section directly into Discord's settings sidebar
     */
    _tryInjectSettingsSidebarSection() {
        if (document.getElementById("vfa-discord-settings-section")) return;
        const navList = document.querySelector('[role="tablist"], [aria-label*="Settings"], [class*="sidebar"]');
        if (!navList) return;

        const section = document.createElement("div");
        section.id = "vfa-discord-settings-section";
        section.style.cssText = "padding: 6px 0; margin-top: 6px; border-top: 1px solid #3f4147;";

        const header = document.createElement("div");
        header.textContent = "Vencord Settings";
        header.style.cssText = "font-size: 12px; font-weight: 700; color: #949ba4; padding: 6px 10px;";
        section.appendChild(header);

        const items = [
            { id: "vencord", label: "Vencord", icon: SVG_ICONS.vencord },
            { id: "plugins", label: "Plugins", icon: SVG_ICONS.plugins },
            { id: "themes", label: "Themes", icon: SVG_ICONS.themes },
            { id: "updater", label: "Updater", icon: SVG_ICONS.updater },
            { id: "cloud", label: "Cloud", icon: SVG_ICONS.cloud },
            { id: "backup", label: "Backup & Restore", icon: SVG_ICONS.backup }
        ];

        for (const item of items) {
            const row = document.createElement("div");
            row.style.cssText = "display:flex;align-items:center;gap:10px;padding:7px 10px;border-radius:4px;color:#b5bac1;font-size:14px;font-weight:500;cursor:pointer;";
            row.innerHTML = `${item.icon}<span>${item.label}</span>`;
            row.addEventListener("click", () => this.openSettingsModal(item.id));
            section.appendChild(row);
        }

        navList.appendChild(section);
    }

    openSettingsModal(initialTab = "plugins") {
        if (initialTab === "settings") initialTab = "vencord";
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
        if (typeof globalThis !== "undefined" && globalThis.__VENCORD_ANDROID_BRIDGE__?.closeOverlay) {
            try {
                globalThis.__VENCORD_ANDROID_BRIDGE__.closeOverlay();
            } catch (_) {}
        }
    }

    _getTabTitle(tab) {
        const titles = {
            vencord: "Vencord",
            plugins: "Plugins",
            themes: "Themes",
            updater: "Updater",
            cloud: "Cloud",
            backup: "Backup & Restore"
        };
        return titles[tab] || "Plugins";
    }

    _renderModalContent(overlay) {
        const vencordItems = [
            { id: "vencord", label: "Vencord", icon: SVG_ICONS.vencord },
            { id: "plugins", label: "Plugins", icon: SVG_ICONS.plugins },
            { id: "themes", label: "Themes", icon: SVG_ICONS.themes },
            { id: "updater", label: "Updater", icon: SVG_ICONS.updater },
            { id: "cloud", label: "Cloud", icon: SVG_ICONS.cloud },
            { id: "backup", label: "Backup & Restore", icon: SVG_ICONS.backup }
        ];

        overlay.innerHTML = `
            <div class="vfa-layout">
                <!-- Left Discord Settings Sidebar matching screenshot -->
                <div class="vfa-sidebar ${this.sidebarOpenMobile ? "mobile-open" : ""}" id="vfa-sidebar">
                    <div class="vfa-sidebar-profile">
                        <div class="vfa-avatar">V</div>
                        <div>
                            <div class="vfa-profile-name">Discord Android</div>
                            <div class="vfa-profile-sub">Profile bearbeiten ✎</div>
                        </div>
                    </div>
                    <input type="text" class="vfa-sidebar-search" placeholder="🔍 Suche" id="vfa-sidebar-quick-search" />

                    <div class="vfa-nav-item muted" data-close-native="1">👤 <span>Account</span></div>
                    <div class="vfa-nav-item muted" data-close-native="1">🛡️ <span>Daten &amp; Privatsphäre</span></div>
                    <div class="vfa-nav-item muted" data-close-native="1">💬 <span>Berechtigungen für Nachrichten</span></div>
                    <div class="vfa-nav-item muted" data-close-native="1">🔔 <span>Benachrichtigungen</span></div>

                    <div class="vfa-nav-sep"></div>
                    <div class="vfa-nav-cat">Vencord Settings</div>
                    ${vencordItems.map((item) => `
                        <div class="vfa-nav-item ${this.activeModalTab === item.id ? "active" : ""}" data-tab="${item.id}">
                            ${item.icon}
                            <span>${item.label}</span>
                        </div>
                    `).join("")}

                    <div class="vfa-nav-sep"></div>
                    <div class="vfa-nav-cat">Zahlungsabwicklung</div>
                    <div class="vfa-nav-item muted" data-close-native="1">💎 <span>Nitro</span></div>
                    <div class="vfa-nav-item muted" data-close-native="1">🚀 <span>Server-Boost</span></div>
                    <div class="vfa-nav-item muted" data-close-native="1">🔄 <span>Abonnements</span></div>
                    <div class="vfa-nav-item muted" data-close-native="1">🎁 <span>Geschenkinventar</span></div>
                    <div class="vfa-nav-item muted" data-close-native="1">💳 <span>Zahlungsabwicklung</span></div>
                </div>

                <!-- Main Settings Page Content -->
                <div class="vfa-content-wrap">
                    <div class="vfa-topbar">
                        <div class="vfa-topbar-left">
                            <button class="vfa-mobile-menu-btn" id="vfa-mobile-menu-toggle" title="Discord Einstellungen Seitenleiste">
                                ${SVG_ICONS.sidebar}
                            </button>
                            <h1 class="vfa-page-title">${this._getTabTitle(this.activeModalTab)}</h1>
                        </div>
                        <button class="vfa-close-circle" id="vfa-close-btn" title="Schließen">
                            ${SVG_ICONS.close}
                        </button>
                    </div>
                    <div class="vfa-scroll-area" id="vfa-tab-body"></div>
                </div>
            </div>
        `;

        overlay.querySelector("#vfa-close-btn").addEventListener("click", () => this.closeSettingsModal());
        overlay.querySelector("#vfa-mobile-menu-toggle").addEventListener("click", () => {
            this.sidebarOpenMobile = !this.sidebarOpenMobile;
            const sb = overlay.querySelector("#vfa-sidebar");
            if (sb) sb.classList.toggle("mobile-open", this.sidebarOpenMobile);
        });

        overlay.querySelectorAll(".vfa-nav-item[data-tab]").forEach((el) => {
            el.addEventListener("click", () => {
                this.activeModalTab = el.getAttribute("data-tab");
                this.sidebarOpenMobile = false;
                this._renderModalContent(overlay);
            });
        });

        overlay.querySelectorAll(".vfa-nav-item[data-close-native]").forEach((el) => {
            el.addEventListener("click", () => this.closeSettingsModal());
        });

        const body = overlay.querySelector("#vfa-tab-body");
        if (this.activeModalTab === "plugins") {
            this._renderPluginsTab(body, overlay);
        } else if (this.activeModalTab === "vencord") {
            this._renderVencordTab(body, overlay);
        } else if (this.activeModalTab === "themes") {
            this._renderThemesTab(body, overlay);
        } else if (this.activeModalTab === "updater") {
            this._renderUpdaterTab(body, overlay);
        } else if (this.activeModalTab === "cloud") {
            this._renderCloudTab(body, overlay);
        } else if (this.activeModalTab === "backup") {
            this._renderBackupTab(body, overlay);
        }

        if (this.activePluginModal) {
            this._renderPluginDetailModal(overlay, this.activePluginModal);
        }
        if (this.uiElementsModalOpen) {
            this._renderUiElementsModal(overlay);
        }
    }

    _renderPluginsTab(container, overlay) {
        const allTags = ["Appearance", "Chat", "Friends", "Guilds", "Media", "Messages", "Notifications", "Privacy", "Shortcuts", "Utility", "Voice"];

        container.innerHTML = `
            <!-- 1. Plugin Management Info Card (1:1 like Screenshot) -->
            <div class="vfa-info-box">
                <div class="vfa-box-title">Plugin Management</div>
                <div class="vfa-box-sub">
                    Press the cog wheel or info icon to get more info on a plugin<br/>
                    Plugins with a cog wheel have settings you can modify!
                </div>
            </div>

            <!-- 2. Manage plugin UI elements Card (1:1 like Screenshot) -->
            <div class="vfa-info-box clickable" id="vfa-manage-ui-elements">
                <div>
                    <div class="vfa-box-title">Manage plugin UI elements</div>
                    <div class="vfa-box-sub">Allows you to hide buttons you don't like</div>
                </div>
                <div style="color:#b5bac1;">${SVG_ICONS.chevronRight}</div>
            </div>

            <!-- 3. Filters Section (1:1 like Screenshot) -->
            <div class="vfa-section-heading">Filters</div>
            <input type="text" class="vfa-search-input" id="vfa-plugin-search" placeholder="Search for a plugin..." value="${this.searchQuery}" />
            <div class="vfa-filter-row">
                <select class="vfa-select" id="vfa-filter-status">
                    <option value="all" ${this.filterMode === "all" ? "selected" : ""}>Show All</option>
                    <option value="enabled" ${this.filterMode === "enabled" ? "selected" : ""}>Show Enabled</option>
                    <option value="disabled" ${this.filterMode === "disabled" ? "selected" : ""}>Show Disabled</option>
                </select>
                <select class="vfa-select" id="vfa-filter-tags">
                    <option value="all" ${this.tagFilter === "all" ? "selected" : ""}>Filter by Tags</option>
                    ${allTags.map((t) => `<option value="${t}" ${this.tagFilter === t ? "selected" : ""}>${t}</option>`).join("")}
                </select>
            </div>

            <!-- 4. Plugins 2-Column Grid -->
            <div class="vfa-section-heading">Plugins</div>
            <div class="vfa-plugins-grid" id="vfa-plugin-grid"></div>

            <!-- 5. Required Plugins Grid -->
            <div class="vfa-section-heading" style="margin-top:28px;">Required Plugins</div>
            <div class="vfa-plugins-grid" id="vfa-required-plugin-grid"></div>
        `;

        container.querySelector("#vfa-manage-ui-elements").addEventListener("click", () => {
            this.uiElementsModalOpen = true;
            this._renderModalContent(overlay);
        });

        const searchInput = container.querySelector("#vfa-plugin-search");
        searchInput.addEventListener("input", (e) => {
            this.searchQuery = e.target.value;
            this._populatePluginCards(container, overlay);
        });

        container.querySelector("#vfa-filter-status").addEventListener("change", (e) => {
            this.filterMode = e.target.value;
            this._populatePluginCards(container, overlay);
        });

        container.querySelector("#vfa-filter-tags").addEventListener("change", (e) => {
            this.tagFilter = e.target.value;
            this._populatePluginCards(container, overlay);
        });

        this._populatePluginCards(container, overlay);
    }

    _populatePluginCards(container, overlay) {
        const all = PluginManager.getAllPlugins().filter((p) => {
            if (this.searchQuery) {
                const q = this.searchQuery.toLowerCase();
                if (!p.name.toLowerCase().includes(q) && !p.description.toLowerCase().includes(q)) {
                    return false;
                }
            }
            if (this.filterMode === "enabled" && !p.enabled) return false;
            if (this.filterMode === "disabled" && p.enabled) return false;
            if (this.tagFilter !== "all" && !(p.tags || []).includes(this.tagFilter)) return false;
            return true;
        });

        const regularPlugins = all.filter((p) => !p.required);
        const requiredPlugins = all.filter((p) => p.required);

        const grid = container.querySelector("#vfa-plugin-grid");
        const reqGrid = container.querySelector("#vfa-required-plugin-grid");
        grid.innerHTML = "";
        reqGrid.innerHTML = "";

        const createCard = (plugin) => {
            const card = document.createElement("div");
            card.className = "vfa-plugin-card";
            const iconSvg = plugin.hasSettings ? SVG_ICONS.cog : SVG_ICONS.info;
            const knobIcon = plugin.enabled ? SVG_ICONS.check : SVG_ICONS.cross;

            card.innerHTML = `
                <div class="vfa-plugin-top">
                    <div class="vfa-plugin-title" title="${plugin.name}">${plugin.name}</div>
                    <div class="vfa-plugin-controls">
                        <button class="vfa-icon-btn" data-info="${plugin.name}" title="${plugin.hasSettings ? "Plugin Settings" : "Plugin Info"}">
                            ${iconSvg}
                        </button>
                        <button class="vfa-toggle ${plugin.enabled ? "checked" : ""}" ${plugin.required ? "disabled" : ""} data-toggle="${plugin.name}">
                            <span class="vfa-toggle-knob">${knobIcon}</span>
                        </button>
                    </div>
                </div>
                <div class="vfa-plugin-desc">${plugin.description}</div>
            `;

            card.querySelector("[data-info]").addEventListener("click", () => {
                this.activePluginModal = plugin.name;
                this._renderModalContent(overlay);
            });

            if (!plugin.required) {
                card.querySelector("[data-toggle]").addEventListener("click", () => {
                    PluginManager.togglePlugin(plugin.name);
                    this._populatePluginCards(container, overlay);
                });
            }
            return card;
        };

        for (const p of regularPlugins) {
            grid.appendChild(createCard(p));
        }
        for (const p of requiredPlugins) {
            reqGrid.appendChild(createCard(p));
        }
    }

    _renderPluginDetailModal(overlay, pluginName) {
        const plugin = PluginManager.getAllPlugins().find((p) => p.name === pluginName);
        if (!plugin) return;

        const backdrop = document.createElement("div");
        backdrop.className = "vfa-modal-backdrop";

        const optionEntries = Object.entries(plugin.options || {});
        const authorsText = (plugin.authors || []).map((a) => a.name).join(", ");
        const tagsText = (plugin.tags || []).join(" • ");

        backdrop.innerHTML = `
            <div class="vfa-modal-dialog">
                <div class="vfa-modal-head">
                    <div>
                        <div style="font-size:18px;font-weight:700;color:#fff;">${plugin.name}</div>
                        <div style="font-size:12px;color:#949ba4;">by ${authorsText} ${tagsText ? `• ${tagsText}` : ""}</div>
                    </div>
                    <button class="vfa-icon-btn" id="vfa-close-plugin-modal">${SVG_ICONS.close}</button>
                </div>
                <div class="vfa-modal-body">
                    <div style="font-size:14px;color:#dbdee1;line-height:1.5;margin-bottom:16px;">
                        ${plugin.description}
                    </div>
                    <div style="font-size:14px;font-weight:700;color:#f2f3f5;margin-bottom:10px;border-top:1px solid #3f4147;padding-top:14px;">
                        ${optionEntries.length > 0 ? "Settings" : "No configurable settings for this plugin."}
                    </div>
                    <div id="vfa-plugin-options-list"></div>
                </div>
            </div>
        `;

        const optsContainer = backdrop.querySelector("#vfa-plugin-options-list");
        for (const [optKey, optDef] of optionEntries) {
            const currentVal = plugin.optionValues[optKey] !== undefined ? plugin.optionValues[optKey] : optDef.default;
            const row = document.createElement("div");
            row.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.05);";

            if (optDef.type === "boolean") {
                const isOn = Boolean(currentVal);
                row.innerHTML = `
                    <div style="font-size:13px;color:#dbdee1;">${optDef.label || optKey}</div>
                    <button class="vfa-toggle ${isOn ? "checked" : ""}">
                        <span class="vfa-toggle-knob">${isOn ? SVG_ICONS.check : SVG_ICONS.cross}</span>
                    </button>
                `;
                row.querySelector(".vfa-toggle").addEventListener("click", () => {
                    Settings.setPluginOption(plugin.name, optKey, !isOn);
                    this._renderModalContent(overlay);
                });
            } else if (optDef.type === "select") {
                row.innerHTML = `
                    <div style="font-size:13px;color:#dbdee1;">${optDef.label || optKey}</div>
                    <select class="vfa-select" style="width:auto;min-width:140px;padding:6px 10px;">
                        ${(optDef.choices || []).map((c) => `<option value="${c}" ${String(currentVal) === String(c) ? "selected" : ""}>${c}</option>`).join("")}
                    </select>
                `;
                row.querySelector("select").addEventListener("change", (e) => {
                    Settings.setPluginOption(plugin.name, optKey, e.target.value);
                });
            }
            optsContainer.appendChild(row);
        }

        backdrop.querySelector("#vfa-close-plugin-modal").addEventListener("click", () => {
            this.activePluginModal = null;
            this._renderModalContent(overlay);
        });
        backdrop.addEventListener("click", (e) => {
            if (e.target === backdrop) {
                this.activePluginModal = null;
                this._renderModalContent(overlay);
            }
        });

        overlay.appendChild(backdrop);
    }

    _renderUiElementsModal(overlay) {
        const uiCfg = Settings.get("uiElements") || { chatBarButtons: true, messagePopoverButtons: true };
        const backdrop = document.createElement("div");
        backdrop.className = "vfa-modal-backdrop";

        backdrop.innerHTML = `
            <div class="vfa-modal-dialog">
                <div class="vfa-modal-head">
                    <div style="font-size:18px;font-weight:700;color:#fff;">Manage plugin UI elements</div>
                    <button class="vfa-icon-btn" id="vfa-close-ui-modal">${SVG_ICONS.close}</button>
                </div>
                <div class="vfa-modal-body">
                    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid #3f4147;">
                        <div>
                            <div style="font-size:14px;font-weight:600;color:#fff;">Chatbar Buttons</div>
                            <div style="font-size:12px;color:#b5bac1;">Show plugin quick-action icons (Translate, SilentTyping, SendTimestamps) in the chat bar</div>
                        </div>
                        <button class="vfa-toggle ${uiCfg.chatBarButtons ? "checked" : ""}" id="vfa-toggle-chatbar">
                            <span class="vfa-toggle-knob">${uiCfg.chatBarButtons ? SVG_ICONS.check : SVG_ICONS.cross}</span>
                        </button>
                    </div>
                    <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 0;">
                        <div>
                            <div style="font-size:14px;font-weight:600;color:#fff;">Message Popover Buttons</div>
                            <div style="font-size:12px;color:#b5bac1;">Show plugin buttons in message long-press and hover menus</div>
                        </div>
                        <button class="vfa-toggle ${uiCfg.messagePopoverButtons ? "checked" : ""}" id="vfa-toggle-popover">
                            <span class="vfa-toggle-knob">${uiCfg.messagePopoverButtons ? SVG_ICONS.check : SVG_ICONS.cross}</span>
                        </button>
                    </div>
                </div>
            </div>
        `;

        backdrop.querySelector("#vfa-toggle-chatbar").addEventListener("click", () => {
            Settings.set("uiElements", { ...uiCfg, chatBarButtons: !uiCfg.chatBarButtons });
            this._renderModalContent(overlay);
        });
        backdrop.querySelector("#vfa-toggle-popover").addEventListener("click", () => {
            Settings.set("uiElements", { ...uiCfg, messagePopoverButtons: !uiCfg.messagePopoverButtons });
            this._renderModalContent(overlay);
        });
        backdrop.querySelector("#vfa-close-ui-modal").addEventListener("click", () => {
            this.uiElementsModalOpen = false;
            this._renderModalContent(overlay);
        });
        overlay.appendChild(backdrop);
    }

    _renderVencordTab(container, overlay) {
        const autoUpdate = Settings.get("autoUpdateCheck");
        const notifyOnUpdates = Settings.get("notifyOnUpdates");
        const safeMode = Settings.get("safeMode");
        const devMode = Settings.get("developerMode");

        container.innerHTML = `
            <div class="vfa-info-box">
                <div class="vfa-box-title">Quick Actions</div>
                <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:12px;">
                    <button class="vfa-btn" id="vfa-qa-quickcss">Open QuickCSS File</button>
                    <button class="vfa-btn secondary" id="vfa-qa-plugins">Manage Plugins</button>
                    <button class="vfa-btn danger" id="vfa-qa-reset">Reset Vencord</button>
                </div>
            </div>

            <div class="vfa-section-heading">Settings</div>
            <div class="vfa-info-box" style="display:flex;flex-direction:column;gap:16px;">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
                    <div>
                        <div class="vfa-box-title" style="font-size:15px;">Automatically check for updates</div>
                        <div class="vfa-box-sub">Checks for new VencordForAndroid &amp; Plugin updates on Discord startup (${CORE_REPO})</div>
                    </div>
                    <button class="vfa-toggle ${autoUpdate ? "checked" : ""}" id="vfa-toggle-autoupdate">
                        <span class="vfa-toggle-knob">${autoUpdate ? SVG_ICONS.check : SVG_ICONS.cross}</span>
                    </button>
                </div>

                <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
                    <div>
                        <div class="vfa-box-title" style="font-size:15px;">Get notified about new updates</div>
                        <div class="vfa-box-sub">Shows an in-app alert whenever a new version is available</div>
                    </div>
                    <button class="vfa-toggle ${notifyOnUpdates ? "checked" : ""}" id="vfa-toggle-notify">
                        <span class="vfa-toggle-knob">${notifyOnUpdates ? SVG_ICONS.check : SVG_ICONS.cross}</span>
                    </button>
                </div>

                <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
                    <div>
                        <div class="vfa-box-title" style="font-size:15px;">Safe Mode (Disable non-required plugins)</div>
                        <div class="vfa-box-sub">Temporarily disables optional plugins for troubleshooting</div>
                    </div>
                    <button class="vfa-toggle ${safeMode ? "checked" : ""}" id="vfa-toggle-safemode">
                        <span class="vfa-toggle-knob">${safeMode ? SVG_ICONS.check : SVG_ICONS.cross}</span>
                    </button>
                </div>

                <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
                    <div>
                        <div class="vfa-box-title" style="font-size:15px;">Enable Developer Tools</div>
                        <div class="vfa-box-sub">Enables React Native / Metro module inspection and debug logging</div>
                    </div>
                    <button class="vfa-toggle ${devMode ? "checked" : ""}" id="vfa-toggle-devmode">
                        <span class="vfa-toggle-knob">${devMode ? SVG_ICONS.check : SVG_ICONS.cross}</span>
                    </button>
                </div>
            </div>
        `;

        container.querySelector("#vfa-qa-quickcss").addEventListener("click", () => {
            this.activeModalTab = "themes";
            this._renderModalContent(overlay);
        });
        container.querySelector("#vfa-qa-plugins").addEventListener("click", () => {
            this.activeModalTab = "plugins";
            this._renderModalContent(overlay);
        });
        container.querySelector("#vfa-qa-reset").addEventListener("click", () => {
            PluginManager.stopAll();
            Settings.wipeAll();
            PluginManager.startAllEnabled();
            this._renderModalContent(overlay);
        });

        container.querySelector("#vfa-toggle-autoupdate").addEventListener("click", () => {
            Settings.set("autoUpdateCheck", !autoUpdate);
            this._renderModalContent(overlay);
        });
        container.querySelector("#vfa-toggle-notify").addEventListener("click", () => {
            Settings.set("notifyOnUpdates", !notifyOnUpdates);
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

    _renderThemesTab(container) {
        const quickCss = Settings.get("quickCss") || "";
        container.innerHTML = `
            <div class="vfa-info-box">
                <div class="vfa-box-title">QuickCSS &amp; Online Themes</div>
                <div class="vfa-box-sub">Paste custom Discord CSS rules or @import links below to style Discord Mobile.</div>
                <textarea id="vfa-quickcss-input" style="width:100%;height:200px;margin-top:12px;background:#1e1f22;color:#dbdee1;border:1px solid #111214;border-radius:6px;padding:12px;font-family:monospace;font-size:13px;" placeholder="/* Custom QuickCSS */">${quickCss}</textarea>
                <div style="margin-top:10px;">
                    <button class="vfa-btn green" id="vfa-save-css">Save QuickCSS</button>
                </div>
            </div>
        `;
        container.querySelector("#vfa-save-css").addEventListener("click", () => {
            const val = container.querySelector("#vfa-quickcss-input").value;
            Settings.set("quickCss", val);
        });
    }

    _renderUpdaterTab(container, overlay) {
        container.innerHTML = `
            <div class="vfa-info-box">
                <div class="vfa-box-title">Repo</div>
                <div class="vfa-box-sub">
                    <a href="https://github.com/${CORE_REPO}" target="_blank" style="color:#00a8fc;text-decoration:none;">https://github.com/${CORE_REPO}</a>
                    (Installed: <b>v${CORE_VERSION}</b> • Latest: <b>v${Updater.latestVersion}</b>)
                </div>
            </div>

            <div class="vfa-info-box">
                <div class="vfa-box-title">Updates</div>
                <div class="vfa-box-sub" id="vfa-updater-status">
                    ${Updater.updateAvailable ? `New update v${Updater.latestVersion} is available!` : "Your VencordForAndroid is up to date!"}
                    ${Updater.errorMessage ? `<br/><span style="color:#da373c;">${Updater.errorMessage}</span>` : ""}
                </div>
                <div style="margin-top:14px;display:flex;gap:10px;">
                    <button class="vfa-btn" id="vfa-check-update-btn">Check for Updates</button>
                    ${Updater.updateAvailable ? `<button class="vfa-btn green" id="vfa-install-update-btn">Update Now</button>` : ""}
                </div>
            </div>
        `;

        container.querySelector("#vfa-check-update-btn").addEventListener("click", async () => {
            const statusEl = container.querySelector("#vfa-updater-status");
            statusEl.textContent = "Checking for updates on GitHub...";
            await Updater.checkForUpdates();
            this._renderModalContent(overlay);
        });

        const installBtn = container.querySelector("#vfa-install-update-btn");
        if (installBtn) {
            installBtn.addEventListener("click", async () => {
                installBtn.disabled = true;
                installBtn.textContent = "Installing Update...";
                await Updater.downloadAndApplyUpdate();
                this._renderModalContent(overlay);
            });
        }
    }

    _renderCloudTab(container) {
        container.innerHTML = `
            <div class="vfa-info-box">
                <div class="vfa-box-title">Vencord Cloud</div>
                <div class="vfa-box-sub">
                    Synchronize your enabled plugins and settings across devices securely.
                </div>
            </div>
        `;
    }

    _renderBackupTab(container, overlay) {
        container.innerHTML = `
            <div class="vfa-info-box">
                <div class="vfa-box-title">Backup &amp; Restore Settings</div>
                <div class="vfa-box-sub">Export your current plugin configuration as JSON or restore from a backup.</div>
                <textarea id="vfa-backup-json" style="width:100%;height:160px;margin-top:12px;background:#1e1f22;color:#dbdee1;border:1px solid #111214;border-radius:6px;padding:10px;font-family:monospace;font-size:12px;">${Settings.exportJSON()}</textarea>
                <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;">
                    <button class="vfa-btn" id="vfa-import-btn">Import Settings JSON</button>
                    <button class="vfa-btn danger" id="vfa-reset-all-btn">Reset All Plugins</button>
                </div>
            </div>
        `;

        container.querySelector("#vfa-import-btn").addEventListener("click", () => {
            try {
                Settings.importJSON(container.querySelector("#vfa-backup-json").value);
                PluginManager.stopAll();
                PluginManager.startAllEnabled();
                this._renderModalContent(overlay);
            } catch (e) {
                alert("Invalid JSON: " + e.message);
            }
        });

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
