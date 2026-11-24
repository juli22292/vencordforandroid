/**
 * VencordForAndroid - Plugin Manager (v0.0.3)
 * Handles registration, tags, options (cog wheel vs info icon), and lifecycle of official Vencord plugins on Android.
 */

import { Settings } from "./Settings.js";
import { Patcher } from "./Patcher.js";

export function definePlugin(definition) {
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

export const PluginManager = new PluginManagerService();
export default PluginManager;
