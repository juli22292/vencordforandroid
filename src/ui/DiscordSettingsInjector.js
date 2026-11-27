import { Settings, OptionType } from "../core/Settings.js";
import { PluginManager } from "../core/PluginManager.js";
import { Updater, CORE_VERSION, CORE_REPO, INSTALLER_REPO } from "../core/Updater.js";
import { Patcher } from "../core/Patcher.js";
import { TextReplace, parseTextReplaceRegex, textReplaceRuleGroups } from "../plugins/officialChatPlugins.js";

const VENCORD_SETTINGS = "VENCORD_ANDROID_SETTINGS";
const VENCORD_PLUGINS = "VENCORD_ANDROID_PLUGINS";
const VENCORD_UPDATER = "VENCORD_ANDROID_UPDATER";
const VENCORD_BACKUP = "VENCORD_ANDROID_BACKUP";
const VENCORD_MAIN_ROWS = [VENCORD_SETTINGS, VENCORD_PLUGINS, VENCORD_UPDATER, VENCORD_BACKUP];

function settingsIcon(name, fallback) {
    return function NativeSettingsIcon(props) {
        const React = Patcher.Common.React;
        const RowIcon = Patcher.findByProps("TableRowIcon", "TableRowGroup")?.TableRowIcon;
        if (!React || !RowIcon) return null;
        const source = Patcher.findAssetId(name);
        if (source != null) return React.createElement(RowIcon, { ...props, source });
        const generated = Patcher.findByProps(name)?.[name];
        if (typeof generated === "function" || generated?.$$typeof) {
            return React.createElement(RowIcon, { ...props, IconComponent: generated });
        }
        const fallbackId = fallback && Patcher.findAssetId(fallback);
        return fallbackId ? React.createElement(RowIcon, { ...props, source: fallbackId }) : null;
    };
}

function useSettingsValue(read) {
    const React = Patcher.Common.React;
    const [, refresh] = React.useReducer((revision) => revision + 1, 0);
    React.useEffect(() => Settings.subscribe(refresh), [refresh]);
    return read();
}

function renderTextReplaceEditor(React, { TextInput, Button }, View) {
    const options = Settings.getPluginConfig(TextReplace.name).options;
    return textReplaceRuleGroups.map(({ key, label }) => {
        const storedRules = Array.isArray(options[key]) ? options[key] : [];
        const currentRules = () => {
            const latest = Settings.getPluginConfig(TextReplace.name).options[key];
            return Array.isArray(latest) ? latest : [];
        };
        const save = (rules) => Settings.setPluginOption(TextReplace.name, key, rules);
        return React.createElement(View, { key, style: { gap: 12 } },
            ...storedRules.map((rule, index) => {
                const update = (field) => (value) => save(currentRules().map((entry, position) =>
                    position === index ? { ...entry, [field]: value } : entry));
                let errorMessage;
                if (key === "regexRules" && rule?.find) {
                    try {
                        parseTextReplaceRegex(rule.find);
                    } catch {
                        errorMessage = "Ungültiger regulärer Ausdruck";
                    }
                }
                return React.createElement(View, { key: index, style: { gap: 8 } },
                    React.createElement(TextInput, {
                        label: `${label} ${index + 1} · Suchen`,
                        value: rule?.find ?? "",
                        onChange: update("find"),
                        autoCapitalize: "none",
                        autoCorrect: false,
                        status: errorMessage ? "error" : undefined,
                        errorMessage
                    }),
                    React.createElement(TextInput, {
                        label: "Ersetzen durch",
                        value: rule?.replace ?? "",
                        onChange: update("replace"),
                        autoCapitalize: "none",
                        autoCorrect: false
                    }),
                    React.createElement(TextInput, {
                        label: "Nur anwenden, wenn die Nachricht Folgendes enthält",
                        value: rule?.onlyIfIncludes ?? "",
                        onChange: update("onlyIfIncludes"),
                        autoCapitalize: "none",
                        autoCorrect: false
                    }),
                    React.createElement(Button, {
                        text: `${label} ${index + 1} löschen`,
                        variant: "secondary",
                        size: "sm",
                        onPress: () => save(currentRules().filter((_, position) => position !== index))
                    }));
            }),
            React.createElement(Button, {
                text: `${label} hinzufügen`,
                variant: "secondary",
                onPress: () => save([...currentRules(), { find: "", replace: "", onlyIfIncludes: "" }])
            }));
    });
}

function NativePluginFields({ textOptions, ruleEditor }) {
    const React = Patcher.Common.React;
    const View = Patcher.Common.ReactNative?.View;
    const design = Patcher.findByProps("TableRowIcon", "TextInput", "Button");
    const fields = useSettingsValue(() => textOptions.map(({ pluginName, name, option }) => ({
        pluginName, name, option, value: Settings.getPluginConfig(pluginName).options[name] ?? option.default
    })));
    if (!View || !design) return null;
    return React.createElement(View, { style: { padding: 16, gap: 16 } },
        ...fields.map(({ pluginName, name, option, value }) => React.createElement(design.TextInput, {
            key: name,
            label: option.label || name,
            value: typeof value === "string" ? value : option.default,
            description: option.description,
            onChange: (text) => Settings.setPluginOption(pluginName, name, text),
            autoCapitalize: "none",
            autoCorrect: false
        })),
        ...(ruleEditor ? renderTextReplaceEditor(React, design, View) : []));
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

function isMemoizedRenderer(renderer) {
    return renderer?.$$typeof === Symbol.for("react.memo") && typeof renderer.type === "function";
}

export class DiscordSettingsInjector {
    constructor() {
        this.unpatches = [];
        this.active = false;
        this.configRegistered = false;
        this.sectionRendered = false;
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
            (module) => isMemoizedRenderer(module?.SearchableSettingsList) && isMemoizedRenderer(module?.SettingsList),
            (module) => this.patchSections(module, "SearchableSettingsList")
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
        const screen = (id, title, rows, { parent = null, icon, textOptions, ruleEditor } = {}) => {
            const NativeSettingsPage = () => {
                const React = Patcher.Common.React;
                const { ScrollView, View } = Patcher.Common.ReactNative ?? {};
                const renderer = Patcher.findByProps("SettingsList", "SearchableSettingsList") ?? Patcher.findByProps("SettingsList");
                const list = renderer?.SettingsList;
                if (!React || !ScrollView || !View || !list) return null;
                const sections = [{ settings: rows }];
                let fields = null;
                if (textOptions?.length || ruleEditor) {
                    fields = React.createElement(NativePluginFields, { textOptions, ruleEditor });
                }
                return React.createElement(ScrollView, { style: { flex: 1 }, keyboardShouldPersistTaps: "handled" },
                    rows.length ? React.createElement(list, { node: { type: "list", sections }, sections }) : null,
                    fields);
            };
            add(id, title, {
                parent,
                type: "route",
                IconComponent: icon ? settingsIcon(...icon) : undefined,
                screen: { route: id, getComponent: () => NativeSettingsPage }
            });
        };

        screen(VENCORD_SETTINGS, "Vencord", ["VENCORD_ANDROID_VERSION", "VENCORD_ANDROID_AUTO_UPDATE", "VENCORD_ANDROID_SAFE_MODE"],
            { icon: ["SettingsIcon", "ic_settings_white_24px"] });
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
            const textOptions = [];
            const optionsPage = `${id}_OPTIONS`;
            for (const [name, option] of Object.entries(plugin.options)) {
                if (option.type === OptionType.STRING) {
                    textOptions.push({ pluginName: plugin.name, name, option });
                }
                if (option.type !== "boolean" && option.type !== OptionType.BOOLEAN) continue;
                const optionId = `${optionsPage}_${name}`;
                toggle(optionId, optionsPage, option.label || name,
                    () => Settings.getPluginConfig(plugin.name).options[name] ?? option.default,
                    (value) => Settings.setPluginOption(plugin.name, name, value),
                    option.description);
                optionIds.push(optionId);
            }
            const ruleEditor = plugin.name === TextReplace.name;
            if (optionIds.length || textOptions.length || ruleEditor) {
                screen(optionsPage, `${plugin.name} · Einstellungen`, optionIds,
                    { parent: VENCORD_PLUGINS, icon: ["SettingsIcon", "ic_settings_white_24px"], textOptions, ruleEditor });
                pluginRows.push(optionsPage);
            }
        }
        screen(VENCORD_PLUGINS, "Plugins", pluginRows, { icon: ["PuzzlePieceIcon"] });

        screen(VENCORD_UPDATER, "Updater", ["VENCORD_ANDROID_CHECK_UPDATE", "VENCORD_ANDROID_OPEN_RELEASE"],
            { icon: ["DownloadIcon", "ic_download_24px"] });
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

        screen(VENCORD_BACKUP, "Backup & Restore",
            ["VENCORD_ANDROID_COPY_SETTINGS", "VENCORD_ANDROID_RESTORE_SETTINGS", "VENCORD_ANDROID_RESET"],
            { icon: ["RefreshIcon", "ic_sync_24px"] });
        add("VENCORD_ANDROID_COPY_SETTINGS", "Einstellungen kopieren", {
            parent: VENCORD_BACKUP,
            type: "pressable",
            onPress: () => {
                const clipboard = Patcher.Common.Clipboard;
                if (typeof clipboard?.setString === "function") clipboard.setString(Settings.exportJSON());
                else Patcher.Common.ReactNative?.Alert?.alert("Vencord", "Die Zwischenablage ist nicht verfügbar.");
            }
        });
        add("VENCORD_ANDROID_RESTORE_SETTINGS", "Einstellungen aus der Zwischenablage wiederherstellen", {
            parent: VENCORD_BACKUP,
            type: "pressable",
            onPress: () => {
                const alert = Patcher.Common.ReactNative?.Alert?.alert;
                const clipboard = Patcher.Common.Clipboard;
                if (!clipboard?.getString) return alert?.("Vencord", "Die Zwischenablage ist nicht verfügbar.");
                alert?.("Vencord", "Die aktuellen Vencord-Einstellungen durch die Sicherung ersetzen?", [
                    { text: "Abbrechen", style: "cancel" },
                    { text: "Wiederherstellen", onPress: async () => {
                        try {
                            Settings.importJSON(await clipboard.getString());
                            PluginManager.reloadAllEnabled();
                            alert("Vencord", "Die Einstellungen wurden wiederhergestellt.");
                        } catch {
                            alert("Vencord", "Die Zwischenablage enthält keine lesbare Sicherung.");
                        }
                    } }
                ]);
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
        this.sectionRendered = false;
        this.active = false;
    }
}

export const SettingsInjector = new DiscordSettingsInjector();
export default SettingsInjector;
