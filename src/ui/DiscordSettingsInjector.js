/**
 * VencordForAndroid v0.0.8 - Native Discord Android React Native Settings Integration
 *
 * Exact architecture matching revenge-bundle (tabs.tsx & shared.tsx):
 * 1. Patches SETTING_RENDERER_CONFIG with VencordCustomPage + all Vencord Settings rows
 * 2. Patches createListModule.createList (before & after) right below the ACCOUNT section
 * 3. Fallback patch on SettingsOverviewScreen via findInReactTree(ret, n => n?.props?.sections)
 * 4. Uses tabsNavigationRef.getRootNavigationRef().navigate("VencordCustomPage", ...)
 * 5. Renders native React Native screens using Discord's own React & ReactNative primitives.
 */

import { Settings } from "../core/Settings.js";
import { PluginManager } from "../core/PluginManager.js";
import { Updater, CORE_VERSION, CORE_REPO } from "../core/Updater.js";
import { Patcher } from "../core/Patcher.js";

function findInReactTree(tree, filter) {
    if (!tree || typeof tree !== "object") return null;
    try {
        if (filter(tree)) return tree;
    } catch (_) {}

    if (Array.isArray(tree)) {
        for (let i = 0; i < tree.length; i++) {
            const res = findInReactTree(tree[i], filter);
            if (res) return res;
        }
        return null;
    }

    if (tree.props && tree.props.children) {
        const res = findInReactTree(tree.props.children, filter);
        if (res) return res;
    }
    return null;
}

export class DiscordSettingsInjector {
    constructor() {
        this.unpatches = [];
        this._hooked = false;
    }

    init() {
        if (this._hooked) return;
        this._hooked = true;
        this._initReactNativeSettingsTabs();
    }

    _initReactNativeSettingsTabs() {
        Patcher.waitFor(["SETTING_RENDERER_CONFIG"], (settingConstants) => {
            try {
                const React = Patcher.Common.React;
                const TableRowMod = Patcher.findByProps("TableRow");
                const TableRow = TableRowMod?.TableRow;

                const rows = [
                    {
                        key: "VENCORD_MAIN",
                        title: () => "Vencord",
                        icon: Patcher.findAssetId("SettingsIcon") || Patcher.findAssetId("CogIcon"),
                        useTrailing: () => `(v${CORE_VERSION})`,
                        tabId: "vencord"
                    },
                    {
                        key: "VENCORD_PLUGINS",
                        title: () => "Plugins",
                        icon: Patcher.findAssetId("PuzzlePieceIcon"),
                        useTrailing: () => `${PluginManager.getAllPlugins().filter((p) => p.enabled).length}`,
                        tabId: "plugins"
                    },
                    {
                        key: "VENCORD_THEMES",
                        title: () => "Themes",
                        icon: Patcher.findAssetId("PaintPaletteIcon"),
                        tabId: "themes"
                    },
                    {
                        key: "VENCORD_UPDATER",
                        title: () => "Updater",
                        icon: Patcher.findAssetId("DownloadIcon") || Patcher.findAssetId("CloudUploadIcon"),
                        tabId: "updater"
                    },
                    {
                        key: "VENCORD_BACKUP",
                        title: () => "Backup & Restore",
                        icon: Patcher.findAssetId("RetryIcon") || Patcher.findAssetId("RefreshIcon"),
                        tabId: "backup"
                    }
                ];

                const CustomPageRenderer = this._createCustomPageRenderer();

                const getRendererRows = () => {
                    const map = {};
                    for (const row of rows) {
                        const PageComponent = this._createReactNativeTabComponent(row.tabId);
                        map[row.key] = {
                            type: "pressable",
                            useTitle: row.title,
                            title: row.title,
                            icon: row.icon,
                            IconComponent: (TableRow && row.icon && React)
                                ? () => React.createElement(TableRow.Icon, { source: row.icon })
                                : undefined,
                            useTrailing: row.useTrailing,
                            onPress: () => this._navigateToVencordPage(row.title(), PageComponent),
                            withArrow: true
                        };
                    }
                    return map;
                };

                const origRendererConfig = settingConstants.SETTING_RENDERER_CONFIG;
                let rendererConfigValue = settingConstants.SETTING_RENDERER_CONFIG;

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
                                getComponent: () => CustomPageRenderer
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
                        value: origRendererConfig,
                        writable: true
                    });
                });

                const injectSectionIntoList = (sections) => {
                    if (!Array.isArray(sections)) return;
                    if (sections.some((s) => s && (s.label === "Vencord Settings" || s.title === "Vencord Settings"))) {
                        return;
                    }
                    const accountIdx = sections.findIndex((s) => Array.isArray(s?.settings) && s.settings.includes("ACCOUNT"));
                    const insertIdx = accountIdx !== -1 ? accountIdx + 1 : 1;
                    sections.splice(insertIdx, 0, {
                        label: "Vencord Settings",
                        title: "Vencord Settings",
                        settings: rows.map((r) => r.key)
                    });
                };

                // Patch 1: createListModule.createList (both before and after for full compatibility)
                Patcher.waitFor(["createList"], (createListModule) => {
                    if (createListModule && typeof createListModule.createList === "function") {
                        this.unpatches.push(
                            Patcher.before("VencordSettingsCreateListBefore", createListModule, "createList", (args) => {
                                const config = args[0];
                                if (config && Array.isArray(config.sections)) {
                                    injectSectionIntoList(config.sections);
                                }
                                return args;
                            })
                        );
                        this.unpatches.push(
                            Patcher.after("VencordSettingsCreateListAfter", createListModule, "createList", (args, ret) => {
                                const config = args[0];
                                if (config && Array.isArray(config.sections)) {
                                    injectSectionIntoList(config.sections);
                                }
                                return ret;
                            })
                        );
                    }
                });

                // Patch 2: Fallback patch directly on SettingsOverviewScreen
                Patcher.waitFor("SettingsOverviewScreen", (SettingsOverviewMod) => {
                    const targetObj = SettingsOverviewMod?.default ? SettingsOverviewMod : null;
                    if (targetObj && typeof targetObj.default === "function") {
                        this.unpatches.push(
                            Patcher.after("VencordSettingsOverview", targetObj, "default", (_args, ret) => {
                                try {
                                    const node = findInReactTree(ret, (n) => Array.isArray(n?.props?.sections));
                                    if (node && Array.isArray(node.props.sections)) {
                                        injectSectionIntoList(node.props.sections);
                                    }
                                } catch (_) {}
                                return ret;
                            })
                        );
                    }
                });

                console.log("[VencordForAndroid] Successfully registered Vencord Settings in Discord SETTING_RENDERER_CONFIG!");
            } catch (err) {
                console.error("[VencordForAndroid] React Native settings registration error:", err);
            }
        });
    }

    _navigateToVencordPage(title, PageComponent) {
        try {
            const tabsNav = Patcher.findByProps("getRootNavigationRef") || Patcher.findDeepInMetro((m) => m && typeof m.getRootNavigationRef === "function");
            const nav = tabsNav?.getRootNavigationRef?.();
            if (nav && typeof nav.navigate === "function") {
                nav.navigate("VencordCustomPage", {
                    title,
                    render: PageComponent
                });
                return;
            }
        } catch (err) {
            console.error("[VencordForAndroid] Navigation error:", err);
        }
    }

    _createCustomPageRenderer() {
        const React = Patcher.Common.React;
        const NavigationNative = Patcher.Common.NavigationNative;
        const self = this;

        const Renderer = function VencordCustomPageScreen(props) {
            const nav = NavigationNative?.useNavigation ? NavigationNative.useNavigation() : null;
            const route = NavigationNative?.useRoute ? NavigationNative.useRoute() : props?.route;
            const params = route?.params || {};
            const PageComp = params.render || self._createReactNativeTabComponent("plugins");
            const pageTitle = params.title || "Vencord Settings";

            if (React.useEffect) {
                React.useEffect(() => {
                    if (nav && typeof nav.setOptions === "function") {
                        try {
                            nav.setOptions({ title: pageTitle });
                        } catch (_) {}
                    }
                }, [pageTitle]);
            }

            return React.createElement(PageComp);
        };

        return React?.memo ? React.memo(Renderer) : Renderer;
    }

    _createReactNativeTabComponent(tabId) {
        return function VencordRNSettingsScreen() {
            const React = Patcher.Common.React;
            const RN = Patcher.Common.ReactNative;
            if (!React || !RN) return null;

            const { View, Text, ScrollView, TextInput, TouchableOpacity, Switch } = RN;
            const [search, setSearch] = React.useState("");
            const [statusFilter, setStatusFilter] = React.useState("ALL");
            const [selectedPlugin, setSelectedPlugin] = React.useState(null);
            const [, setTick] = React.useState(0);
            const refresh = () => setTick((n) => n + 1);

            if (tabId === "updater") {
                return React.createElement(
                    ScrollView,
                    { style: { flex: 1, backgroundColor: "#1e1f22", padding: 16 } },
                    React.createElement(
                        View,
                        { style: { backgroundColor: "#2b2d31", borderRadius: 10, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: "#3f4147" } },
                        React.createElement(Text, { style: { color: "#f2f3f5", fontSize: 16, fontWeight: "700", marginBottom: 6 } }, "VencordForAndroid Repository"),
                        React.createElement(Text, { style: { color: "#00a8fc", fontSize: 13 } }, `https://github.com/${CORE_REPO}`),
                        React.createElement(Text, { style: { color: "#b5bac1", fontSize: 13, marginTop: 4 } }, `Installiert: v${CORE_VERSION} • Neueste: v${Updater.latestVersion}`)
                    ),
                    React.createElement(
                        View,
                        { style: { backgroundColor: "#2b2d31", borderRadius: 10, padding: 16, borderWidth: 1, borderColor: "#3f4147" } },
                        React.createElement(Text, { style: { color: "#f2f3f5", fontSize: 16, fontWeight: "700", marginBottom: 6 } }, "Updates"),
                        React.createElement(
                            Text,
                            { style: { color: "#b5bac1", fontSize: 13, marginBottom: 14 } },
                            Updater.updateAvailable ? `Neues Update v${Updater.latestVersion} verfügbar!` : "VencordForAndroid ist auf dem neuesten Stand!"
                        ),
                        React.createElement(
                            View,
                            { style: { flexDirection: "row", gap: 10 } },
                            React.createElement(
                                TouchableOpacity,
                                {
                                    style: { backgroundColor: "#5865f2", paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 },
                                    onPress: async () => {
                                        await Updater.checkForUpdates();
                                        refresh();
                                    }
                                },
                                React.createElement(Text, { style: { color: "#fff", fontWeight: "700" } }, "Nach Updates suchen")
                            ),
                            Updater.updateAvailable ? React.createElement(
                                TouchableOpacity,
                                {
                                    style: { backgroundColor: "#248046", paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 },
                                    onPress: async () => {
                                        await Updater.downloadAndApplyUpdate();
                                        refresh();
                                    }
                                },
                                React.createElement(Text, { style: { color: "#fff", fontWeight: "700" } }, "Update installieren")
                            ) : null
                        )
                    )
                );
            }

            if (tabId === "vencord") {
                const toggles = [
                    { key: "autoUpdate", title: "Automatisch nach Updates suchen", sub: "Prüft beim Start von Discord auf neue VencordForAndroid-Updates" },
                    { key: "autoUpdateNotification", title: "Update-Benachrichtigungen", sub: "Informiert bei neuen Releases auf juli22292/vencordforandroid" },
                    { key: "safeMode", title: "Abgesicherter Modus (Safe Mode)", sub: "Deaktiviert optionale Plugins zur Fehlerbehebung" }
                ];
                return React.createElement(
                    ScrollView,
                    { style: { flex: 1, backgroundColor: "#1e1f22", padding: 16 } },
                    toggles.map((item) =>
                        React.createElement(
                            View,
                            {
                                key: item.key,
                                style: {
                                    backgroundColor: "#2b2d31",
                                    borderRadius: 10,
                                    padding: 14,
                                    marginBottom: 10,
                                    flexDirection: "row",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    borderWidth: 1,
                                    borderColor: "#3f4147"
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

            if (tabId === "themes") {
                return React.createElement(
                    ScrollView,
                    { style: { flex: 1, backgroundColor: "#1e1f22", padding: 16 } },
                    React.createElement(
                        View,
                        { style: { backgroundColor: "#2b2d31", borderRadius: 10, padding: 16, borderWidth: 1, borderColor: "#3f4147" } },
                        React.createElement(Text, { style: { color: "#f2f3f5", fontSize: 16, fontWeight: "700", marginBottom: 6 } }, "Vencord Themes"),
                        React.createElement(Text, { style: { color: "#b5bac1", fontSize: 13 } }, "Eigene Android-Themes und Farbschemata für VencordForAndroid.")
                    )
                );
            }

            if (tabId === "backup") {
                return React.createElement(
                    ScrollView,
                    { style: { flex: 1, backgroundColor: "#1e1f22", padding: 16 } },
                    React.createElement(
                        View,
                        { style: { backgroundColor: "#2b2d31", borderRadius: 10, padding: 16, borderWidth: 1, borderColor: "#3f4147" } },
                        React.createElement(Text, { style: { color: "#f2f3f5", fontSize: 16, fontWeight: "700", marginBottom: 6 } }, "Backup & Restore"),
                        React.createElement(Text, { style: { color: "#b5bac1", fontSize: 13, marginBottom: 14 } }, "Setze alle Plugin-Einstellungen auf die Standardwerte zurück."),
                        React.createElement(
                            TouchableOpacity,
                            {
                                style: { backgroundColor: "#da373c", paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, alignSelf: "flex-start" },
                                onPress: () => {
                                    PluginManager.stopAll();
                                    Settings.wipeAll();
                                    PluginManager.startAllEnabled();
                                    refresh();
                                }
                            },
                            React.createElement(Text, { style: { color: "#fff", fontWeight: "700" } }, "Alle Plugins zurücksetzen")
                        )
                    )
                );
            }

            // Default: Official Vencord Plugins Screen (170 official Vencord plugins adapted for Android)
            const allPlugins = PluginManager.getAllPlugins().filter((p) => {
                if (search) {
                    const q = search.toLowerCase();
                    if (!p.name.toLowerCase().includes(q) && !p.description.toLowerCase().includes(q)) return false;
                }
                if (statusFilter === "ENABLED" && !p.enabled) return false;
                if (statusFilter === "DISABLED" && p.enabled) return false;
                return true;
            });

            return React.createElement(
                ScrollView,
                { style: { flex: 1, backgroundColor: "#1e1f22", padding: 14 } },
                // Plugin Management Card
                React.createElement(
                    View,
                    { style: { backgroundColor: "#2b2d31", borderRadius: 10, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: "#3f4147" } },
                    React.createElement(Text, { style: { color: "#f2f3f5", fontSize: 15, fontWeight: "700", marginBottom: 4 } }, "Plugin Management"),
                    React.createElement(Text, { style: { color: "#b5bac1", fontSize: 12 } }, "Tippe auf das Zahnrad- oder Info-Symbol für Einstellungen & Details.")
                ),
                // Search Bar
                TextInput ? React.createElement(TextInput, {
                    style: { backgroundColor: "#111214", color: "#dbdee1", borderRadius: 8, padding: 11, marginBottom: 10, borderWidth: 1, borderColor: "#3f4147" },
                    placeholder: "Search for a plugin...",
                    placeholderTextColor: "#949ba4",
                    value: search,
                    onChangeText: setSearch
                }) : null,
                // Filter Chips
                React.createElement(
                    View,
                    { style: { flexDirection: "row", gap: 8, marginBottom: 14 } },
                    ["ALL", "ENABLED", "DISABLED"].map((st) =>
                        React.createElement(
                            TouchableOpacity,
                            {
                                key: st,
                                style: {
                                    backgroundColor: statusFilter === st ? "#5865f2" : "#2b2d31",
                                    paddingVertical: 8,
                                    paddingHorizontal: 14,
                                    borderRadius: 8
                                },
                                onPress: () => setStatusFilter(st)
                            },
                            React.createElement(
                                Text,
                                { style: { color: "#fff", fontSize: 12, fontWeight: "700" } },
                                st === "ALL" ? `Show All (${PluginManager.getAllPlugins().length})` : st === "ENABLED" ? "Show Enabled" : "Show Disabled"
                            )
                        )
                    )
                ),
                // Plugin Cards
                allPlugins.map((plugin) =>
                    React.createElement(
                        View,
                        {
                            key: plugin.name,
                            style: {
                                backgroundColor: "#2b2d31",
                                borderRadius: 10,
                                padding: 14,
                                marginBottom: 10,
                                borderWidth: 1,
                                borderColor: "#3f4147"
                            }
                        },
                        React.createElement(
                            View,
                            { style: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 } },
                            React.createElement(Text, { style: { color: "#f2f3f5", fontSize: 15, fontWeight: "700", flex: 1 } }, plugin.name),
                            React.createElement(
                                View,
                                { style: { flexDirection: "row", alignItems: "center", gap: 12 } },
                                React.createElement(
                                    TouchableOpacity,
                                    { onPress: () => setSelectedPlugin(selectedPlugin === plugin.name ? null : plugin.name) },
                                    React.createElement(Text, { style: { color: "#b5bac1", fontSize: 18 } }, plugin.hasSettings ? "⚙" : "ⓘ")
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
                                    React.createElement(Text, { style: { color: "#dbdee1", fontSize: 12, flex: 1, paddingRight: 8 } }, optDef.label || optKey),
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

    unpatchAll() {
        for (const fn of this.unpatches) {
            try {
                fn();
            } catch (_) {}
        }
        this.unpatches = [];
        this._hooked = false;
    }
}

export const SettingsInjector = new DiscordSettingsInjector();
export default SettingsInjector;
