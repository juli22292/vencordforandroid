import assert from "node:assert/strict";
import test from "node:test";

import { Patcher } from "../src/core/Patcher.js";
import { PluginManager } from "../src/core/PluginManager.js";
import { Settings } from "../src/core/Settings.js";
import {
    ClearURLs, NoReplyMention, SilentTyping, TextReplace, Unindent,
    cleanTrackedUrls, unindentCodeBlocks, applyTextReplaceRules
} from "../src/plugins/officialChatPlugins.js";

test("ClearURLs preserves encoding, fragments, punctuation and site-specific parameters", () => {
    assert.equal(cleanTrackedUrls("(https://example.org/a?q=a%20b&utm_source=test#one)."),
        "(https://example.org/a?q=a%20b#one).");
    assert.equal(cleanTrackedUrls("https://youtu.be/video?si=tracking"), "https://youtu.be/video");
    assert.equal(cleanTrackedUrls("https://example.org/?si=keep#fragment?utm_source=keep"),
        "https://example.org/?si=keep#fragment?utm_source=keep");
    assert.equal(cleanTrackedUrls("https://ex.org/?a=x&%75tm_medium=y&a=z"), "https://ex.org/?a=x&a=z");
});

test("Unindent removes common space from fenced code and leaves inline code intact", () => {
    const message = "inline `  x`\n```js\n\tif (ok) {\n\t    work();\n\t}\n```\nDone.";
    assert.equal(unindentCodeBlocks(message), "inline `  x`\n```js\nif (ok) {\n    work();\n}\n```\nDone.");
    assert.equal(unindentCodeBlocks("```\n\n``` and inline"), "```\n\n``` and inline");
});

test("TextReplace applies conditional literal rules, regex groups and newline escapes", () => {
    const options = {
        stringRules: [{ find: " hi ", replace: " hallo ", onlyIfIncludes: "notes" }, { find: "x" }],
        regexRules: [
            { find: "/(item)(\\d+)/g", replace: "$1-$2\\n" },
            { find: "[", replace: "ignored" }
        ]
    };
    assert.equal(applyTextReplaceRules("hi notes item7", options), "hallo notes item-7\n");
    assert.equal(applyTextReplaceRules(" hi ", options), " hi ");
});

test("plugins bind to late Android Metro actions and can be toggled without restarting", async () => {
    const factories = new Map();
    const originalDefine = Object.getOwnPropertyDescriptor(globalThis, "__d");
    const originalFetch = globalThis.fetch;

    const report = [];
    const store = {
        getName: () => "GuildMemberStore",
        getMember: (guild, user) => guild === "guild" && user === "987" ? { roles: ["345"] } : null
    };
    const load = (id, exports) => {
        globalThis.__d((_global, _require, _default, _all, module) => { module.exports = exports; }, id);
        const module = { exports: {} };
        factories.get(id)(globalThis, null, null, null, module, module.exports);
        return module.exports;
    };

    try {
        globalThis.fetch = async () => ({
            ok: true,
            json: async () => ({ providers: { example: { urlPattern: "example\\.org", rules: ["^analytics_id$"] } } })
        });
        globalThis.__d = (factory, id) => factories.set(id, factory);
        Patcher.observeMetroDefinitions(() => {});

        PluginManager.registerAll([ClearURLs, NoReplyMention, SilentTyping, TextReplace, Unindent]);
        PluginManager.startAllEnabled();
        PluginManager.setPluginEnabled("TextReplace", true);
        Settings.setPluginOption("TextReplace", "stringRules", [{ find: "hi", replace: "hallo" }]);
        PluginManager.setPluginEnabled("SilentTyping", true);
        Settings.setPluginOption("SilentTyping", "showTypingIn", "1234, 4321");

        const send = (_channel, payload) => { report.push(payload.content); return Promise.resolve(payload); };
        const edit = (_channel, _message, payload) => payload.content;
        const messages = load(62013, {
            sendMessage: send, editMessage: edit, getSendMessageOptionsForReply() {}, deleteMessage() {}
        });
        const typing = load(62014, {
            get startTyping() { return (channel) => report.push(channel); },
            stopTyping: () => "stopped"
        });
        const reply = load(62015, {
            createPendingReply: (options) => options.shouldMention,
            deletePendingReply() {},
            setPendingReplyShouldMention: (value) => value
        });
        load(62016, store);
        await new Promise(setImmediate);

        const message = Object.freeze({ content: "hi https://example.org/path?analytics_id=1&x=2\n```\n  a\n    b\n```" });
        const sent = await messages.sendMessage("123", message, undefined, {});
        assert.equal(sent.content, "hallo https://example.org/path?x=2\n```\na\n  b\n```");
        assert.equal(messages.editMessage("123", "456", message),
            "hi https://example.org/path?x=2\n```\na\n  b\n```");
        assert.equal((await messages.sendMessage("123", {})).content, undefined);
        assert.ok(message.content.includes("analytics_id"));

        typing.startTyping("123");
        typing.startTyping("4321");
        assert.equal(typing.stopTyping("123"), "stopped");
        assert.ok(report.includes("4321"));
        assert.ok(!report.includes("123"));
        Settings.setPluginOption("SilentTyping", "isEnabled", false);
        typing.startTyping("123");
        assert.ok(report.includes("123"));

        const pending = {
            message: { author: { id: "987" } }, channel: { guild_id: "guild" }, shouldMention: true
        };
        assert.equal(reply.createPendingReply(Object.freeze(pending)), false);
        Settings.setPluginOption("NoReplyMention", "roleList", "345");
        assert.equal(reply.createPendingReply(pending), true);
        assert.equal(reply.createPendingReply({ ...pending, shouldMention: false }), false);
        assert.equal(reply.setPendingReplyShouldMention(true), true);

        PluginManager.setSafeMode(true);
        assert.equal(messages.sendMessage, send);
        assert.equal(messages.editMessage, edit);
        assert.equal(typeof Object.getOwnPropertyDescriptor(typing, "startTyping").get, "function");
        assert.equal(reply.createPendingReply(pending), true);
        PluginManager.setSafeMode(false);
        assert.equal((await messages.sendMessage("123", { content: "hi" })).content, "hallo");
        Settings.importJSON('{"plugins":{"TextReplace":{"enabled":false}}}');
        PluginManager.reloadAllEnabled();
        assert.equal((await messages.sendMessage("123", { content: "hi" })).content, "hi");
        assert.equal(reply.createPendingReply(pending), false);
    } finally {
        PluginManager.uninstallAll();
        globalThis.fetch = originalFetch;
        if (originalDefine) Object.defineProperty(globalThis, "__d", originalDefine);
        else delete globalThis.__d;
    }
});
