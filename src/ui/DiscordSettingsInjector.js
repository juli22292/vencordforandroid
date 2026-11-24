/**
 * VencordForAndroid v0.0.4 - Native Discord React Settings Integration
 *
 * Implements the exact settings injection architecture of:
 * 1. Discord Android React Native (Metro):
 *    Hooks `SETTING_RENDERER_CONFIG` + `createListModule.createList` + `SettingsOverviewScreen`
 *    and renders pages using Discord's own `React.createElement` and `ReactNative` primitives.
 * 2. Discord Web / Vendroid (Webpack):
 *    Hooks `.buildLayout()` and `getPredicateSections` like `Vendicated/Vencord/src/plugins/_core/settings.tsx`
 *    and renders the official Vencord tabs (`Vencord`, `Plugins`, `Themes`, `Updater`, `Cloud`, `Backup & Restore`)
 *    directly inside Discord's native Settings view using Discord's own React instance.
 */

import { Settings } from "../core/Settings.js";
import { PluginManager } from "../core/PluginManager.js";
import { Updater, CORE_VERSION, CORE_REPO } from "../core/Updater.js";
import { Patcher } from "../core/Patcher.js";

const PLUGIN_TAGS = [
    "All", "Appearance", "Chat", "Friends", "Guilds",
    "Media", "Messages", "Notifications", "Privacy",
    "Shortcuts", "Utility", "Voice"
];

export class DiscordSettingsInjector {
    constructor() {
        this.unpatches = [];
        this.registeredSections = {};
    }

    init() {
        this._initReactNativeSettingsTabs();
        this._initWebpackBuildLayoutSettings();
    }

    // =========================================================================
    // 1. NATIVE DISCORD ANDROID (REACT NATIVE / METRO) SETTINGS INJECTION
    //    Matches revenge-bundle/src/lib/ui/settings/patches/tabs.tsx
    // =========================================================================
    _initReactNativeSettingsTabs() {
        Patcher.waitFor(["SETTING_RENDERER_CONFIG"], (settingConstants) => {
            try {
                const createListModule = Patcher.findByProps("createList");
                const TableRowMod = Patcher.findByProps("TableRow");
                const TableRow = TableRowMod?.TableRow;

                const rows = [
                    {
                        key: "VENCORD_MAIN",
                        title: () => "Vencord",
                        icon: Patcher.findAssetId("SettingsIcon") || Patcher.findAssetId("CogIcon"),
                        useTrailing: () => `(v${CORE_VERSION})`,
                        render: () => this._createReactNativeTabComponent("vencord")
                    },
                    {
                        key: "VENCORD_PLUGINS",
                        title: () => "Plugins",
                        icon: Patcher.findAssetId("PuzzlePieceIcon"),
                        render: () => this._createReactNativeTabComponent("plugins")
                    },
                    {
                        key: "VENCORD_THEMES",
                        title: () => "Themes",
                        icon: Patcher.findAssetId("PaintPaletteIcon"),
                        render: () => this._createReactNativeTabComponent("themes")
                    },
                    {
                        key: "VENCORD_UPDATER",
                        title: () => "Updater",
                        icon: Patcher.findAssetId("DownloadIcon") || Patcher.findAssetId("CloudUploadIcon"),
                        render: () => this._createReactNativeTabComponent("updater")
                    },
                    {
                        key: "VENCORD_CLOUD",
                        title: () => "Cloud",
                        icon: Patcher.findAssetId("CloudIcon"),
                        render: () => this._createReactNativeTabComponent("cloud")
                    },
                    {
                        key: "VENCORD_BACKUP",
                        title: () => "Backup & Restore",
                        icon: Patcher.findAssetId("RetryIcon") || Patcher.findAssetId("RefreshIcon"),
                        render: () => this._createReactNativeTabComponent("backup")
                    }
                ];

                const getRendererRows = () => {
                    const map = {};
                    for (const row of rows) {
                        map[row.key] = {
                            type: "pressable",
                            useTitle: row.title,
                            title: row.title,
                            icon: row.icon,
                            IconComponent: TableRow && row.icon
                                ? () => Patcher.Common.React.createElement(TableRow.Icon, { source: row.icon })
                                : undefined,
                            useTrailing: row.useTrailing,
                            onPress: () => this._navigateReactNativePage(row.title(), row.render()),
                            withArrow: true
                        };
                    }
                    return map;
                };

                let rendererConfigValue = settingConstants.SETTING_RENDERER_CONFIG;
                const origConfig = rendererConfigValue;

                Object.defineProperty(settingConstants, "SETTING_RENDERER_CONFIG", {
                    enumerable: true,
                    configurable: true,
                    get: () => ({
                        ...rendererConfigValue,
                        VencordCustomPage: {
                            type: "route",
                            useTitle: () => "Vencord Settings",
                            title: () => "Vencord Settings",
                            screen: {
                                route: "VencordCustomPage",
                                getComponent: () => this._getReactNativePageWrapper()
                            }
                        },
                        ...getRendererRows()
                    }),
                    set: (v) => {
                        rendererConfigValue = v;
                    }
                });

                this.unpatches.push(() => {
                    Object.defineProperty(settingConstants, "SETTING_RENDERER_CONFIG", {
                        value: origConfig,
                        writable: true
                    });
                });

                if (createListModule && typeof createListModule.createList === "function") {
                    const unpatch = Patcher.after("VencordSettingsRN", createListModule, "createList", (args) => {
                        const [config] = args;
                        if (config?.sections && Array.isArray(config.sections)) {
                            const sections = config.sections;
                            if (sections.some((s) => s?.label === "Vencord Settings" || s?.title === "Vencord Settings")) {
                                return;
                            }
                            const accountIdx = sections.findIndex((s) => Array.isArray(s?.settings) && s.settings.includes("ACCOUNT"));
                            const insertIdx = accountIdx !== -1 ? accountIdx + 1 : 1;
                            sections.splice(insertIdx, 0, {
                                label: "Vencord Settings",
                                title: "Vencord Settings",
                                settings: rows.map((r) => r.key)
                            });
                        }
                    });
                    this.unpatches.push(unpatch);
                }
            } catch (err) {
                console.error("[VencordForAndroid] React Native settings registration error:", err);
            }
        });
    }

    _navigateReactNativePage(title, PageComponent) {
        const NavigationNative = Patcher.Common.NavigationNative;
        this._currentRNPage = { title, PageComponent };
        try {
            const nav = NavigationNative?.useNavigation?.();
            if (nav && typeof nav.push === "function") {
                nav.push("VencordCustomPage", { title, render: PageComponent });
            }
        } catch (_) {}
    }

    _getReactNativePageWrapper() {
        const React = Patcher.Common.React;
        const self = this;
        return function VencordCustomPageScreen(props) {
            const routeParams = props?.route?.params || self._currentRNPage || {};
            const Comp = routeParams.render || routeParams.PageComponent || self._createReactNativeTabComponent("plugins");
            return React.createElement(Comp);
        };
    }

    _createReactNativeTabComponent(tabId) {
        const React = Patcher.Common.React;
        const RN = Patcher.Common.ReactNative;
        if (!React || !RN) return () => null;

        const { View, Text, ScrollView, TextInput, TouchableOpacity, Switch } = RN;

        return function VencordRNSettingsScreen() {
            const [search, setSearch] = React.useState("");
            const [statusFilter, setStatusFilter] = React.useState("ALL");
            const [tagFilter, setTagFilter] = React.useState("All");
            const [selectedPlugin, setSelectedPlugin] = React.useState(null);
            const [, forceUpdate] = React.useState(0);
            const refresh = () => forceUpdate((n) => n + 1);

            if (tabId === "updater") {
                return React.createElement(
                    ScrollView,
                    { style: { flex: 1, backgroundColor: "#313338", padding: 16 } },
                    React.createElement(
                        View,
                        { style: { backgroundColor: "#2b2d31", borderRadius: 8, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: "#3f4147" } },
                        React.createElement(Text, { style: { color: "#f2f3f5", fontSize: 16, fontWeight: "700", marginBottom: 6 } }, "Repo"),
                        React.createElement(Text, { style: { color: "#00a8fc", fontSize: 13 } }, `https://github.com/${CORE_REPO}`),
                        React.createElement(Text, { style: { color: "#b5bac1", fontSize: 13, marginTop: 4 } }, `Installed: v${CORE_VERSION} • Latest: v${Updater.latestVersion}`)
                    ),
                    React.createElement(
                        View,
                        { style: { backgroundColor: "#2b2d31", borderRadius: 8, padding: 16, borderWidth: 1, borderColor: "#3f4147" } },
                        React.createElement(Text, { style: { color: "#f2f3f5", fontSize: 16, fontWeight: "700", marginBottom: 6 } }, "Updates"),
                        React.createElement(
                            Text,
                            { style: { color: "#b5bac1", fontSize: 13, marginBottom: 14 } },
                            Updater.updateAvailable ? `New update v${Updater.latestVersion} is available!` : "Your Vencord is up to date!"
                        ),
                        React.createElement(
                            View,
                            { style: { flexDirection: "row", gap: 10 } },
                            React.createElement(
                                TouchableOpacity,
                                {
                                    style: { backgroundColor: "#5865f2", paddingVertical: 10, paddingHorizontal: 16, borderRadius: 6 },
                                    onPress: async () => {
                                        await Updater.checkForUpdates();
                                        refresh();
                                    }
                                },
                                React.createElement(Text, { style: { color: "#fff", fontWeight: "700" } }, "Check for Updates")
                            ),
                            Updater.updateAvailable ? React.createElement(
                                TouchableOpacity,
                                {
                                    style: { backgroundColor: "#248046", paddingVertical: 10, paddingHorizontal: 16, borderRadius: 6 },
                                    onPress: async () => {
                                        await Updater.downloadAndApplyUpdate();
                                        refresh();
                                    }
                                },
                                React.createElement(Text, { style: { color: "#fff", fontWeight: "700" } }, "Update Now")
                            ) : null
                        )
                    )
                );
            }

            if (tabId === "vencord") {
                const toggles = [
                    { key: "autoUpdate", title: "Automatically check for updates", sub: "Checks for updates on startup" },
                    { key: "autoUpdateNotification", title: "Get notified about new updates", sub: "Shows a toast when a new update is ready" },
                    { key: "safeMode", title: "Safe Mode", sub: "Disables all optional plugins for recovery" },
                    { key: "enableReactDevtools", title: "Enable React Developer Tools", sub: "Enables developer inspection hooks" }
                ];
                return React.createElement(
                    ScrollView,
                    { style: { flex: 1, backgroundColor: "#313338", padding: 16 } },
                    toggles.map((item) =>
                        React.createElement(
                            View,
                            {
                                key: item.key,
                                style: {
                                    backgroundColor: "#2b2d31",
                                    borderRadius: 8,
                                    padding: 14,
                                    marginBottom: 10,
                                    flexDirection: "row",
                                    alignItems: "center",
                                    justifyContent: "space-between"
                                }
                            },
                            React.createElement(
                                View,
                                { style: { flex: 1, paddingRight: 12 } },
                                React.createElement(Text, { style: { color: "#f2f3f5", fontSize: 15, fontWeight: "700" } }, item.title),
                                React.createElement(Text, { style: { color: "#b5bac1", fontSize: 12, marginTop: 2 } }, item.sub)
                            ),
                            Switch ? React.createElement(Switch, {
                                value: Boolean(Settings.get(item.key)),
                                onValueChange: (val) => {
                                    Settings.set(item.key, val);
                                    refresh();
                                }
                            }) : null
                        )
                    )
                );
            }

            // Default: Official Vencord Plugins Tab in React Native
            const allPlugins = PluginManager.getAllPlugins().filter((p) => {
                if (search) {
                    const q = search.toLowerCase();
                    if (!p.name.toLowerCase().includes(q) && !p.description.toLowerCase().includes(q)) return false;
                }
                if (statusFilter === "ENABLED" && !p.enabled) return false;
                if (statusFilter === "DISABLED" && p.enabled) return false;
                if (tagFilter !== "All" && !(p.tags || []).includes(tagFilter)) return false;
                return true;
            });

            return React.createElement(
                ScrollView,
                { style: { flex: 1, backgroundColor: "#313338", padding: 16 } },
                // Plugin Management Card
                React.createElement(
                    View,
                    { style: { backgroundColor: "#2b2d31", borderRadius: 8, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#3f4147" } },
                    React.createElement(Text, { style: { color: "#f2f3f5", fontSize: 16, fontWeight: "700", marginBottom: 4 } }, "Plugin Management"),
                    React.createElement(Text, { style: { color: "#b5bac1", fontSize: 13 } }, "Press the cog wheel or info icon to get more info on a plugin\nPlugins with a cog wheel have settings you can modify!")
                ),
                // Filters
                React.createElement(Text, { style: { color: "#f2f3f5", fontSize: 16, fontWeight: "700", marginTop: 8, marginBottom: 8 } }, "Filters"),
                TextInput ? React.createElement(TextInput, {
                    style: { backgroundColor: "#1e1f22", color: "#dbdee1", borderRadius: 6, padding: 10, marginBottom: 10 },
                    placeholder: "Search for a plugin...",
                    placeholderTextColor: "#949ba4",
                    value: search,
                    onChangeText: setSearch
                }) : null,
                React.createElement(
                    View,
                    { style: { flexDirection: "row", gap: 8, marginBottom: 16 } },
                    ["ALL", "ENABLED", "DISABLED"].map((st) =>
                        React.createElement(
                            TouchableOpacity,
                            {
                                key: st,
                                style: {
                                    backgroundColor: statusFilter === st ? "#5865f2" : "#1e1f22",
                                    paddingVertical: 8,
                                    paddingHorizontal: 12,
                                    borderRadius: 6
                                },
                                onPress: () => setStatusFilter(st)
                            },
                            React.createElement(Text, { style: { color: "#fff", fontSize: 12, fontWeight: "600" } }, st === "ALL" ? "Show All" : st === "ENABLED" ? "Show Enabled" : "Show Disabled")
                        )
                    )
                ),
                // Plugin Cards
                React.createElement(Text, { style: { color: "#f2f3f5", fontSize: 16, fontWeight: "700", marginBottom: 10 } }, "Plugins"),
                allPlugins.map((plugin) =>
                    React.createElement(
                        View,
                        {
                            key: plugin.name,
                            style: {
                                backgroundColor: "#2b2d31",
                                borderRadius: 8,
                                padding: 14,
                                marginBottom: 10,
                                borderWidth: 1,
                                borderColor: "#3f4147"
                            }
                        },
                        React.createElement(
                            View,
                            { style: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 } },
                            React.createElement(Text, { style: { color: "#f2f3f5", fontSize: 15, fontWeight: "700" } }, plugin.name),
                            React.createElement(
                                View,
                                { style: { flexDirection: "row", alignItems: "center", gap: 10 } },
                                React.createElement(
                                    TouchableOpacity,
                                    { onPress: () => setSelectedPlugin(selectedPlugin === plugin.name ? null : plugin.name) },
                                    React.createElement(Text, { style: { color: "#b5bac1", fontSize: 16 } }, plugin.hasSettings ? "⚙" : "ⓘ")
                                ),
                                Switch ? React.createElement(Switch, {
                                    value: plugin.enabled,
                                    disabled: plugin.required,
                                    onValueChange: () => {
                                        PluginManager.togglePlugin(plugin.name);
                                        refresh();
                                    }
                                }) : null
                            )
                        ),
                        React.createElement(Text, { style: { color: "#b5bac1", fontSize: 13 } }, plugin.description),
                        selectedPlugin === plugin.name && plugin.hasSettings ? React.createElement(
                            View,
                            { style: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#3f4147" } },
                            Object.entries(plugin.options).map(([optKey, optDef]) =>
                                React.createElement(
                                    View,
                                    { key: optKey, style: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 6 } },
                                    React.createElement(Text, { style: { color: "#dbdee1", fontSize: 12, flex: 1 } }, optDef.label || optKey),
                                    optDef.type === "boolean" && Switch ? React.createElement(Switch, {
                                        value: Boolean(plugin.optionValues[optKey] ?? optDef.default),
                                        onValueChange: (val) => {
                                            Settings.setPluginOption(plugin.name, optKey, val);
                                            refresh();
                                        }
                                    }) : React.createElement(Text, { style: { color: "#5865f2", fontSize: 12, fontWeight: "700" } }, String(plugin.optionValues[optKey] ?? optDef.default))
                                )
                            )
                        ) : null
                    )
                )
            );
        };
    }

    // =========================================================================
    // 2. WEBPACK / VENDROID (.buildLayout() & getPredicateSections) INJECTION
    //    Matches Vendicated/Vencord/src/plugins/_core/settings.tsx
    // =========================================================================
    _initWebpackBuildLayoutSettings() {
        let LayoutTypes = {
            SECTION: 1,
            SIDEBAR_ITEM: 2,
            PANEL: 3,
            CATEGORY: 5,
            CUSTOM: 19
        };
        Patcher.waitFor(["SECTION", "SIDEBAR_ITEM", "PANEL", "CUSTOM"], (v) => {
            LayoutTypes = v;
        });

        // Declarative patch on .buildLayout() just like Vendicated/Vencord/src/plugins/_core/settings.tsx
        Patcher.addDeclarativePatch({
            find: ".buildLayout().map",
            replacement: {
                match: /(\i)\.buildLayout\(\)(?=\.map)/,
                replace: "VencordForAndroid.UI.buildWebpackSettingsLayout($1)"
            }
        }, "Settings");
    }

    buildWebpackSettingsLayout(originalLayoutBuilder) {
        const layout = originalLayoutBuilder.buildLayout();
        if (originalLayoutBuilder.key !== "$Root") return layout;
        if (!Array.isArray(layout)) return layout;
        if (layout.some((s) => s?.key === "vencord_section")) return layout;

        const React = Patcher.Common.React;
        if (!React) return layout;

        const buildEntry = ({ key, title, panelTitle = title, tabId }) => ({
            key: `${key}_sidebar_item`,
            type: 2, // SIDEBAR_ITEM
            legacySearchKey: title.toUpperCase(),
            getLegacySearchKey: () => title.toUpperCase(),
            useTitle: () => title,
            buildLayout: () => [
                {
                    key: `${key}_panel`,
                    type: 3, // PANEL
                    useTitle: () => panelTitle,
                    buildLayout: () => [
                        {
                            key: `${key}_category`,
                            type: 5, // CATEGORY
                            buildLayout: () => [
                                {
                                    key: `${key}_custom`,
                                    type: 19, // CUSTOM
                                    Component: this._createWebReactTabComponent(tabId),
                                    render: () => React.createElement(this._createWebReactTabComponent(tabId))
                                }
                            ]
                        }
                    ]
                }
            ]
        });

        const vencordEntries = [
            buildEntry({ key: "vencord_main", title: "Vencord", panelTitle: "Vencord Settings", tabId: "vencord" }),
            buildEntry({ key: "vencord_plugins", title: "Plugins", tabId: "plugins" }),
            buildEntry({ key: "vencord_themes", title: "Themes", tabId: "themes" }),
            buildEntry({ key: "vencord_updater", title: "Updater", panelTitle: "Vencord Updater", tabId: "updater" }),
            buildEntry({ key: "vencord_cloud", title: "Cloud", panelTitle: "Vencord Cloud", tabId: "cloud" }),
            buildEntry({ key: "vencord_backup_restore", title: "Backup & Restore", tabId: "backup" })
        ];

        const vencordSection = {
            key: "vencord_section",
            type: 1, // SECTION
            useTitle: () => "Vencord Settings",
            buildLayout: () => vencordEntries
        };

        let idx = layout.findIndex((s) => typeof s?.key === "string" && s.key === "billing_section");
        if (idx === -1) idx = 2;
        layout.splice(idx, 0, vencordSection);
        return layout;
    }

    _createWebReactTabComponent(tabId) {
        const React = Patcher.Common.React;
        return function VencordWebSettingsTab() {
            const [search, setSearch] = React.useState("");
            const [statusFilter, setStatusFilter] = React.useState("all");
            const [tagFilter, setTagFilter] = React.useState("All");
            const [modalPlugin, setModalPlugin] = React.useState(null);
            const [, setTick] = React.useState(0);
            const refresh = () => setTick((t) => t + 1);

            if (tabId === "updater") {
                return React.createElement(
                    "div",
                    { style: { color: "#f2f3f5" } },
                    React.createElement(
                        "div",
                        { style: { background: "#2b2d31", border: "1px solid #3f4147", borderRadius: 8, padding: 16, marginBottom: 14 } },
                        React.createElement("div", { style: { fontWeight: 700, fontSize: 16, marginBottom: 6 } }, "Repo"),
                        React.createElement("a", { href: `https://github.com/${CORE_REPO}`, target: "_blank", style: { color: "#00a8fc" } }, `https://github.com/${CORE_REPO}`),
                        React.createElement("div", { style: { fontSize: 13, color: "#b5bac1", marginTop: 4 } }, `Installed: v${CORE_VERSION} • Latest: v${Updater.latestVersion}`)
                    ),
                    React.createElement(
                        "div",
                        { style: { background: "#2b2d31", border: "1px solid #3f4147", borderRadius: 8, padding: 16 } },
                        React.createElement("div", { style: { fontWeight: 700, fontSize: 16, marginBottom: 6 } }, "Updates"),
                        React.createElement("div", { style: { fontSize: 13, color: "#b5bac1", marginBottom: 12 } }, Updater.updateAvailable ? `New update v${Updater.latestVersion} available!` : "Your Vencord is up to date!"),
                        React.createElement(
                            "div",
                            { style: { display: "flex", gap: 10 } },
                            React.createElement("button", {
                                style: { background: "#5865f2", color: "#fff", border: "none", borderRadius: 4, padding: "9px 16px", fontWeight: 600, cursor: "pointer" },
                                onClick: async () => {
                                    await Updater.checkForUpdates();
                                    refresh();
                                }
                            }, "Check for Updates"),
                            Updater.updateAvailable ? React.createElement("button", {
                                style: { background: "#248046", color: "#fff", border: "none", borderRadius: 4, padding: "9px 16px", fontWeight: 600, cursor: "pointer" },
                                onClick: async () => {
                                    await Updater.downloadAndApplyUpdate();
                                    refresh();
                                }
                            }, "Update Now") : null
                        )
                    )
                );
            }

            // Official Plugins Tab rendered via Discord's React.createElement
            const all = PluginManager.getAllPlugins().filter((p) => {
                if (search) {
                    const q = search.toLowerCase();
                    if (!p.name.toLowerCase().includes(q) && !p.description.toLowerCase().includes(q)) return false;
                }
                if (statusFilter === "enabled" && !p.enabled) return false;
                if (statusFilter === "disabled" && p.enabled) return false;
                if (tagFilter !== "All" && !(p.tags || []).includes(tagFilter)) return false;
                return true;
            });

            const regular = all.filter((p) => !p.required);
            const required = all.filter((p) => p.required);

            const renderPluginCard = (p) => React.createElement(
                "div",
                {
                    key: p.name,
                    style: {
                        background: "#2b2d31",
                        border: "1px solid rgba(255,255,255,0.06)",
                        borderRadius: 8,
                        padding: "14px 16px",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "flex-start"
                    }
                },
                React.createElement(
                    "div",
                    { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 } },
                    React.createElement("div", { style: { fontWeight: 700, fontSize: 15, color: "#f2f3f5" } }, p.name),
                    React.createElement(
                        "div",
                        { style: { display: "flex", alignItems: "center", gap: 10 } },
                        React.createElement(
                            "button",
                            {
                                style: { background: "transparent", border: "none", color: "#b5bac1", cursor: "pointer", fontSize: 16 },
                                onClick: () => setModalPlugin(modalPlugin === p.name ? null : p.name)
                            },
                            p.hasSettings ? "⚙" : "ⓘ"
                        ),
                        React.createElement(
                            "button",
                            {
                                disabled: p.required,
                                onClick: () => {
                                    PluginManager.togglePlugin(p.name);
                                    refresh();
                                },
                                style: {
                                    width: 40,
                                    height: 24,
                                    borderRadius: 14,
                                    border: "none",
                                    background: p.enabled ? "#5865f2" : "#72767d",
                                    position: "relative",
                                    cursor: p.required ? "not-allowed" : "pointer",
                                    opacity: p.required ? 0.5 : 1
                                }
                            },
                            React.createElement(
                                "span",
                                {
                                    style: {
                                        position: "absolute",
                                        top: 3,
                                        left: p.enabled ? 19 : 3,
                                        width: 18,
                                        height: 18,
                                        borderRadius: "50%",
                                        background: "#fff",
                                        color: p.enabled ? "#5865f2" : "#72767d",
                                        fontSize: 11,
                                        fontWeight: 800,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        transition: "left 0.15s ease"
                                    }
                                },
                                p.enabled ? "✓" : "✕"
                            )
                        )
                    )
                ),
                React.createElement("div", { style: { fontSize: 13, color: "#b5bac1", lineHeight: 1.4 } }, p.description)
            );

            return React.createElement(
                "div",
                { style: { color: "#f2f3f5" } },
                React.createElement(
                    "div",
                    { style: { background: "#2b2d31", border: "1px solid #3f4147", borderRadius: 8, padding: "16px 18px", marginBottom: 14 } },
                    React.createElement("div", { style: { fontSize: 16, fontWeight: 700, marginBottom: 4 } }, "Plugin Management"),
                    React.createElement("div", { style: { fontSize: 13, color: "#b5bac1", lineHeight: 1.45 } }, "Press the cog wheel or info icon to get more info on a plugin\nPlugins with a cog wheel have settings you can modify!")
                ),
                React.createElement(
                    "div",
                    { style: { background: "#2b2d31", border: "1px solid #3f4147", borderRadius: 8, padding: "16px 18px", marginBottom: 18, display: "flex", alignItems: "center", justifyContent: "space-between" } },
                    React.createElement(
                        "div",
                        null,
                        React.createElement("div", { style: { fontSize: 16, fontWeight: 700, marginBottom: 4 } }, "Manage plugin UI elements"),
                        React.createElement("div", { style: { fontSize: 13, color: "#b5bac1" } }, "Allows you to hide buttons you don't like")
                    ),
                    React.createElement("span", { style: { color: "#b5bac1", fontSize: 18 } }, "›")
                ),
                React.createElement("div", { style: { fontSize: 16, fontWeight: 700, marginBottom: 8 } }, "Filters"),
                React.createElement("input", {
                    type: "text",
                    placeholder: "Search for a plugin...",
                    value: search,
                    onChange: (e) => setSearch(e.target.value),
                    style: { width: "100%", boxSizing: "border-box", background: "#1e1f22", border: "1px solid #111214", borderRadius: 6, color: "#dbdee1", padding: "10px 12px", marginBottom: 10 }
                }),
                React.createElement(
                    "div",
                    { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 } },
                    React.createElement(
                        "select",
                        {
                            value: statusFilter,
                            onChange: (e) => setStatusFilter(e.target.value),
                            style: { background: "#1e1f22", border: "1px solid #111214", borderRadius: 6, color: "#dbdee1", padding: "10px 12px" }
                        },
                        React.createElement("option", { value: "all" }, "Show All"),
                        React.createElement("option", { value: "enabled" }, "Show Enabled"),
                        React.createElement("option", { value: "disabled" }, "Show Disabled")
                    ),
                    React.createElement(
                        "select",
                        {
                            value: tagFilter,
                            onChange: (e) => setTagFilter(e.target.value),
                            style: { background: "#1e1f22", border: "1px solid #111214", borderRadius: 6, color: "#dbdee1", padding: "10px 12px" }
                        },
                        PLUGIN_TAGS.map((t) => React.createElement("option", { key: t, value: t }, t === "All" ? "Filter by Tags" : t))
                    )
                ),
                React.createElement("div", { style: { fontSize: 16, fontWeight: 700, marginBottom: 10 } }, "Plugins"),
                React.createElement(
                    "div",
                    { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 } },
                    regular.map(renderPluginCard)
                ),
                React.createElement("div", { style: { fontSize: 16, fontWeight: 700, marginTop: 26, marginBottom: 10 } }, "Required Plugins"),
                React.createElement(
                    "div",
                    { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 } },
                    required.map(renderPluginCard)
                )
            );
        };
    }

    unpatchAll() {
        for (const fn of this.unpatches) {
            try {
                fn();
            } catch (_) {}
        }
        this.unpatches = [];
    }
}

export const SettingsInjector = new DiscordSettingsInjector();
export default SettingsInjector;
