import assert from "node:assert/strict";
import test from "node:test";

import { Patcher } from "../src/core/Patcher.js";
import { DiscordSettingsInjector } from "../src/ui/DiscordSettingsInjector.js";

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
