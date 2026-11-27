/**
 * VencordForAndroid v0.0.4 - PluginManager & Internal Plugin APIs
 * Follows Vendicated/Vencord/src/api/PluginManager.ts (Flux events, MessageEventsAPI, CommandsAPI, Patches, Settings).
 */

import { Settings, definePluginSettings, OptionType } from "./Settings.js";
import { Patcher } from "./Patcher.js";

export { definePluginSettings, OptionType };

export function definePlugin(definition) {
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
        this.plugins = Object.create(null);
        this.registry = new Map();
        this.running = new Set();
        this.fluxUnsubscribers = new Map();
        this.pluginCleanups = new Map();
        this.preSendListeners = new Map();
        this.preEditListeners = new Map();
        this.messageEventWaiters = new Map();
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
                defaultOptions[key] = opt.default !== undefined
                    ? opt.default
                    : (Array.isArray(opt.options) ? opt.options.find((option) => option.default)?.value : undefined);
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
            const cfg = Settings.getPluginConfig(plugin.name, { enabledByDefault: plugin.enabledByDefault });
            const available = this._isAvailable(plugin);
            return {
                ...plugin,
                available,
                enabled: available && Boolean(plugin.required || cfg.enabled),
                running: this.running.has(plugin.name),
                optionValues: { ...(cfg.options || {}) }
            };
        });
    }

    getPlugin(name) {
        return this.registry.get(name) || null;
    }

    _isAvailable(plugin) {
        return Boolean(plugin.required || plugin.start || plugin.flux || plugin.onBeforeMessageSend || plugin.onBeforeMessageEdit);
    }

    isPluginEnabled(name) {
        const plugin = this.getPlugin(name);
        if (!plugin || !this._isAvailable(plugin)) return false;
        if (plugin.required || plugin.isDependency) return true;
        return Boolean(Settings.getPluginConfig(name, { enabledByDefault: plugin.enabledByDefault }).enabled);
    }

    isEnabled(name) {
        return this.isPluginEnabled(name);
    }

    _ensureMessageEventHooked(method, marker, listeners, messageIndex) {
        if (this.messageEventWaiters.has(method)) return;
        const id = `VencordMessageEventsAPI.${method}`;
        const cancelWait = Patcher.waitFor([method, marker], (actions) => {
            Patcher.before(id, actions, method, (args) => {
                if (!listeners.size || typeof args[messageIndex]?.content !== "string") return;
                const message = { ...args[messageIndex] };
                const context = args.slice(0, messageIndex);
                for (const listener of listeners.values()) {
                    try {
                        listener(...context, message);
                    } catch (error) {
                        console.error(`[VencordForAndroid:MessageEventsAPI] ${method} listener:`, error);
                    }
                }
                if (message.content !== args[messageIndex].content) {
                    args[messageIndex] = message;
                    return args;
                }
            });
        });
        this.messageEventWaiters.set(method, () => {
            cancelWait();
            Patcher.unpatchAll(id);
        });
    }

    _releaseMessageEvent(method, listeners) {
        if (listeners.size) return;
        this.messageEventWaiters.get(method)?.();
        this.messageEventWaiters.delete(method);
    }

    initPluginManager() {
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
                const cleanup = plugin.start(context);
                if (typeof cleanup === "function") this.pluginCleanups.set(plugin.name, cleanup);
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
                this.preSendListeners.set(plugin.name, plugin.onBeforeMessageSend.bind(plugin));
                this._ensureMessageEventHooked("sendMessage", "getSendMessageOptionsForReply", this.preSendListeners, 1);
            }

            if (typeof plugin.onBeforeMessageEdit === "function") {
                this.preEditListeners.set(plugin.name, plugin.onBeforeMessageEdit.bind(plugin));
                this._ensureMessageEventHooked("editMessage", "deleteMessage", this.preEditListeners, 2);
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

    _disposePlugin(plugin) {
        try {
            this.pluginCleanups.get(plugin.name)?.();
            plugin.stop?.({ patcher: Patcher });
        } catch (err) {
            console.error(`[VencordForAndroid:PluginManager] Failed to stop ${plugin.name}:`, err);
        }
        this.pluginCleanups.delete(plugin.name);
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
        this._releaseMessageEvent("sendMessage", this.preSendListeners);
        this._releaseMessageEvent("editMessage", this.preEditListeners);
        plugin.started = false;
        this.running.delete(plugin.name);
    }

    stopPlugin(nameOrPlugin) {
        const plugin = typeof nameOrPlugin === "string" ? this.getPlugin(nameOrPlugin) : nameOrPlugin;
        if (!plugin || plugin.required) return false;

        if (this.running.has(plugin.name)) this._disposePlugin(plugin);
        Settings.setPluginEnabled(plugin.name, false);
        return true;
    }

    togglePlugin(name) {
        return this.setPluginEnabled(name, !this.isPluginEnabled(name));
    }

    setPluginEnabled(name, enabled) {
        const plugin = this.getPlugin(name);
        if (!plugin || !this._isAvailable(plugin) || plugin.required || Settings.get("safeMode")) return false;
        return enabled ? this.startPlugin(plugin) : this.stopPlugin(plugin);
    }

    setSafeMode(enabled) {
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

    reloadAllEnabled() {
        for (const name of this.running) {
            const plugin = this.getPlugin(name);
            if (!plugin.required) this._disposePlugin(plugin);
        }
        this.startAllEnabled();
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
            this._disposePlugin(this.getPlugin(name));
        }
        Patcher.unpatchAll();
        Settings.wipeAll();
        this.registry.clear();
        for (const name of Object.keys(this.plugins)) delete this.plugins[name];
    }
}

export const PluginManager = new PluginManagerService();
export default PluginManager;
