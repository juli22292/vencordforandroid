import { Settings, OptionType } from "../core/Settings.js";
import { PluginManager } from "../core/PluginManager.js";
import { Updater, CORE_VERSION, CORE_REPO, INSTALLER_REPO } from "../core/Updater.js";
import { Patcher } from "../core/Patcher.js";

const VENCORD_SETTINGS = "VENCORD_ANDROID_SETTINGS";
const VENCORD_PLUGINS = "VENCORD_ANDROID_PLUGINS";
const VENCORD_UPDATER = "VENCORD_ANDROID_UPDATER";
const VENCORD_BACKUP = "VENCORD_ANDROID_BACKUP";
const VENCORD_MAIN_ROWS = [VENCORD_SETTINGS, VENCORD_PLUGINS, VENCORD_UPDATER, VENCORD_BACKUP];

function useSettingsValue(read) {
    const React = Patcher.Common.React;
    const [, refresh] = React.useReducer((revision) => revision + 1, 0);
    React.useEffect(() => Settings.subscribe(refresh), [refresh]);
    return read();
}

function injectVencordSection(sections) {
    if (!Array.isArray(sections)) return sections;
    const accountIndex = sections.findIndex((section) => section?.settings?.includes?.("ACCOUNT"));
    if (accountIndex < 0 || sections.some((section) => section?.settings?.includes?.(VENCORD_SETTINGS))) {
        return sections;
    }
    return [
        ...sections.slice(0, accountIndex + 1),
        { label: "Vencord", title: "Vencord", settings: VENCORD_MAIN_ROWS },
        ...sections.slice(accountIndex + 1)
    ];
}

function withVencordSections(props) {
    if (!props || typeof props !== "object") return props;
    if (Array.isArray(props.node?.sections)) {
        const sections = injectVencordSection(props.node.sections);
        return sections === props.node.sections ? props : { ...props, node: { ...props.node, sections } };
    }
    const sections = injectVencordSection(props.sections);
    return sections === props.sections ? props : { ...props, sections };
}

export class DiscordSettingsInjector {
    constructor() {
        this.unpatches = [];
        this.active = false;
        this.configRegistered = false;
        this.checkedUpdate = null;
    }

    init() {
        if (this.active) return;
        this.active = true;
        this.unpatches.push(Patcher.waitFor(
            (module) => module?.SETTING_RENDERER_CONFIG && typeof module.SETTING_RENDERER_CONFIG === "object",
            (module) => this.registerConfig(module)
        ));
        this.unpatches.push(Patcher.waitFor(
            (module) => typeof module?.SettingsList === "function",
            (module) => this.patchSections(module, "SettingsList")
        ));
        this.unpatches.push(Patcher.waitFor(
            (module) => typeof module?.createList === "function",
            (module) => this.patchSections(module, "createList")
        ));
    }

    patchSections(module, key) {
        const target = Patcher.patchableMetroExport(module, key);
        const descriptor = Object.getOwnPropertyDescriptor(target, key);
        if (!descriptor?.configurable && !descriptor?.writable) return;
        const original = target[key];
        const injector = this;
        Object.defineProperty(target, key, {
            configurable: descriptor.configurable,
            enumerable: descriptor.enumerable,
            writable: true,
            value: function (props, ...rest) {
                return original.call(this, injector.configRegistered ? withVencordSections(props) : props, ...rest);
            }
        });
        this.unpatches.push(() => Object.defineProperty(target, key, descriptor));
    }

    registerConfig(module) {
        const key = "SETTING_RENDERER_CONFIG";
        const items = this.createItems();
        const config = module[key];
        if (Object.isExtensible(config)) {
            const added = Object.keys(items).filter((id) => !Object.prototype.hasOwnProperty.call(config, id));
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
                value: { ...config, ...items }
            });
            this.unpatches.push(() => Object.defineProperty(target, key, original));
        }
        this.configRegistered = true;
        globalThis.console?.log?.("[VencordForAndroid] Native Vencord settings registered.");
    }

    createItems() {
        const items = {};
        const add = (id, title, definition) => {
            items[id] = { useTitle: () => title, title: () => title, ...definition };
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
                const list = Patcher.findByProps("SettingsList")?.SettingsList;
                if (!React || !ScrollView || !list) return null;
                const sections = [{ settings: rows }];
                return React.createElement(ScrollView, { style: { flex: 1 } },
                    React.createElement(list, { node: { type: "list", sections }, sections }));
            };
            add(id, title, {
                parent,
                type: "route",
                screen: { route: id, getComponent: () => NativeSettingsPage }
            });
        };

        screen(VENCORD_SETTINGS, "Vencord", ["VENCORD_ANDROID_VERSION", "VENCORD_ANDROID_AUTO_UPDATE", "VENCORD_ANDROID_SAFE_MODE"]);
        add("VENCORD_ANDROID_VERSION", "Version", {
            parent: VENCORD_SETTINGS,
            type: "static",
            useTrailing: () => `v${CORE_VERSION}`
        });
        toggle("VENCORD_ANDROID_AUTO_UPDATE", VENCORD_SETTINGS, "Automatisch nach Updates suchen",
            () => Settings.get("autoUpdate"), (value) => Settings.set("autoUpdate", value));
        toggle("VENCORD_ANDROID_SAFE_MODE", VENCORD_SETTINGS, "Abgesicherter Modus",
            () => Settings.get("safeMode"), (value) => PluginManager.setSafeMode(value),
            "Hält optionale Plugins vorübergehend an.");

        const pluginRows = [];
        for (const plugin of PluginManager.getAllPlugins()) {
            if (!plugin.available || plugin.required || plugin.isDependency) continue;
            const id = `VENCORD_ANDROID_PLUGIN_${plugin.name}`;
            toggle(id, VENCORD_PLUGINS, plugin.name,
                () => PluginManager.isPluginEnabled(plugin.name),
                (enabled) => PluginManager.setPluginEnabled(plugin.name, enabled),
                plugin.description, () => Settings.get("safeMode"));
            pluginRows.push(id);

            const optionIds = [];
            const optionsPage = `${id}_OPTIONS`;
            for (const [name, option] of Object.entries(plugin.options)) {
                if (option.type !== "boolean" && option.type !== OptionType.BOOLEAN) continue;
                const optionId = `${optionsPage}_${name}`;
                toggle(optionId, optionsPage, option.label || name,
                    () => Settings.getPluginConfig(plugin.name).options[name] ?? option.default,
                    (value) => Settings.setPluginOption(plugin.name, name, value),
                    option.description);
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
                const { error, updateAvailable, latestVersion } = this.checkedUpdate;
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
                if (typeof clipboard?.setString === "function") clipboard.setString(Settings.exportJSON());
                else Patcher.Common.ReactNative?.Alert?.alert("Vencord", "Die Zwischenablage ist nicht verfügbar.");
            }
        });
        add("VENCORD_ANDROID_RESET", "Plugins und Einstellungen zurücksetzen", {
            parent: VENCORD_BACKUP,
            type: "pressable",
            onPress: () => Patcher.Common.ReactNative?.Alert?.alert("Vencord", "Alle Vencord-Einstellungen zurücksetzen?", [
                { text: "Abbrechen", style: "cancel" },
                { text: "Zurücksetzen", style: "destructive", onPress: () => {
                    PluginManager.stopAll();
                    Settings.wipeAll();
                    PluginManager.startAllEnabled();
                } }
            ])
        });
        return items;
    }

    unpatchAll() {
        for (const unpatch of this.unpatches.reverse()) unpatch();
        this.unpatches.length = 0;
        this.configRegistered = false;
        this.active = false;
    }
}

export const SettingsInjector = new DiscordSettingsInjector();
export default SettingsInjector;
