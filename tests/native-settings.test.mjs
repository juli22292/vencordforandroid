import assert from "node:assert/strict";
import test from "node:test";

import { Patcher } from "../src/core/Patcher.js";
import { DiscordSettingsInjector } from "../src/ui/DiscordSettingsInjector.js";
import { PluginManager } from "../src/core/PluginManager.js";
import { Settings } from "../src/core/Settings.js";
import { TextReplace } from "../src/plugins/officialChatPlugins.js";

test("inserts Vencord into the memoized Discord 355.10 settings overview", () => {
    const injector = new DiscordSettingsInjector();
    const factories = new Map();
    const modules = new Map();
    const originalDefine = Object.getOwnPropertyDescriptor(globalThis, "__d");

    function load(id) {
        if (!modules.has(id)) {
            const module = { exports: {} };
            factories.get(id)(globalThis, load, null, null, module, module.exports, []);
            modules.set(id, module.exports);
        }
        return modules.get(id);
    }

    try {
        injector.init();
        Patcher.observeMetroDefinitions(() => {});
        globalThis.__d = (factory, id) => factories.set(id, factory);

        globalThis.__d((_global, _require, _default, _all, _module, exports) => {
            exports.SETTING_RENDERER_CONFIG = {
                ACCOUNT: { type: "route" },
                SHOP: { type: "route" }
            };
        }, 355101);

        const memo = (type) => ({ $$typeof: Symbol.for("react.memo"), type, compare: null });
        const renderSearchableList = (props) => props.node.sections;
        const searchable = memo(renderSearchableList);
        const list = memo((props) => props.node.sections);
        globalThis.__d((_global, _require, _default, _all, _module, exports) => {
            Object.defineProperties(exports, {
                SettingsList: { value: list, enumerable: true },
                SearchableSettingsList: { value: searchable, enumerable: true }
            });
        }, 355102);

        const settings = load(355101).SETTING_RENDERER_CONFIG;
        const renderer = load(355102).SearchableSettingsList;
        const account = Object.freeze({ label: "Accounteinstellungen", settings: Object.freeze(["NITRO", "ACCOUNT"]) });
        const billing = Object.freeze({ label: "Rechnungseinstellungen", settings: Object.freeze(["SHOP"]) });
        const node = Object.freeze({ type: "list", sections: Object.freeze([account, billing]) });

        const sections = renderer.type({ node });
        assert.deepEqual(sections.map((section) => section.label), [
            "Accounteinstellungen", "Vencord", "Rechnungseinstellungen"
        ]);
        assert.ok(sections[1].settings.includes("VENCORD_ANDROID_PLUGINS"));
        assert.equal(settings.VENCORD_ANDROID_PLUGINS.screen.route, "VENCORD_ANDROID_PLUGINS");
        assert.deepEqual(node.sections, [account, billing]);
        assert.equal(renderer.type({ node: { ...node, sections } }), sections);
        assert.equal(renderer.type({ node: { sections: [billing] } }).length, 1);
        assert.equal(load(355102).SettingsList, list);
    } finally {
        injector.unpatchAll();
        if (originalDefine) Object.defineProperty(globalThis, "__d", originalDefine);
        else delete globalThis.__d;
    }
});

test("native settings rows use Discord icons and open a working TextReplace editor", () => {
    const injector = new DiscordSettingsInjector();
    const originalFind = Patcher.findByProps;
    const originalGetAsset = Patcher.findAssetId;
    const native = { View: "View", ScrollView: "ScrollView", Text: "Text", TouchableOpacity: "TouchableOpacity" };
    const createElement = (type, props, ...children) => ({ type, props, children });
    const react = { createElement, useReducer: () => [0, () => {}], useEffect() {} };
    const design = { TableRowIcon: "TableRowIcon", TableRowGroup: "TableRowGroup", TextInput: "TextInput", Button: "Button" };
    const assets = ["SettingsIcon", "PuzzlePieceIcon", "DownloadIcon", "RefreshIcon"];

    try {
        Patcher._commonCache = { React: react, ReactNative: native };
        Patcher.findByProps = (name) => {
            if (name === "TableRowIcon") return design;
            if (name === "SettingsList") return { SettingsList: "SettingsList" };
            return null;
        };
        Patcher.findAssetId = (name) => (assets.indexOf(name) + 1) || null;
        PluginManager.register(TextReplace);
        const items = injector.createItems();
        const routes = ["SETTINGS", "PLUGINS", "UPDATER", "BACKUP"];
        routes.forEach((id, index) => {
            const row = items[`VENCORD_ANDROID_${id}`];
            const icon = row.IconComponent({});
            assert.equal(icon.type, "TableRowIcon");
            assert.equal(icon.props.source, index + 1);
        });
        assert.equal(items.VENCORD_ANDROID_BACKUP.useTitle(), "Backup & Restore");
        assert.equal(items.VENCORD_ANDROID_RESTORE_SETTINGS.type, "pressable");

        const page = items.VENCORD_ANDROID_PLUGIN_TextReplace_OPTIONS.screen.getComponent()();
        const fields = page.children[1];
        const read = () => fields.type(fields.props);
        read().children[0].children[0].props.onPress();
        let rule = read().children[0].children[0];
        rule.children[0].props.onChange("hello");
        rule.children[1].props.onChange("hallo");
        assert.deepEqual(Settings.getPluginConfig("TextReplace").options.stringRules,
            [{ find: "hello", replace: "hallo", onlyIfIncludes: "" }]);
        rule.children[3].props.onPress();
        assert.deepEqual(Settings.getPluginConfig("TextReplace").options.stringRules, []);
    } finally {
        Patcher.findByProps = originalFind;
        Patcher.findAssetId = originalGetAsset;
        Patcher._commonCache = {};
        PluginManager.uninstallAll();
    }
});
