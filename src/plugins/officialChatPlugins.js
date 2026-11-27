/*
 * Android ports of Vencord plugins from ff5810de5ac334c912321d7528d6d923d28c2db5.
 * Copyright (c) 2022 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import { definePlugin, definePluginSettings, OptionType } from "../core/PluginManager.js";

const clearUrlsRulesUrl = "https://raw.githubusercontent.com/ClearURLs/Rules/7c30a16c37c13526bd43eead3135459e79975585/data.min.json";
const trackingFallback = {
    urlPattern: /^https?:/i,
    rules: [/^(?:utm_.*|fbclid|gclid|igshid|mc_eid|_hsenc)$/i]
};
const clearUrlsFallback = [trackingFallback, {
    urlPattern: /^https?:\/\/(?:[\w-]+\.)?(?:youtube\.com|youtu\.be|spotify\.com)(?:[:/?#]|$)/i,
    rules: [/^si$/i]
}];
let clearUrlsRules = clearUrlsFallback;
let clearUrlsRequest;

function compileClearUrlsRules(providers) {
    const compile = (patterns) => patterns?.map((pattern) => new RegExp(pattern, "i"));
    return Object.values(providers).flatMap((provider) => {
        try {
            return [{
                urlPattern: new RegExp(provider.urlPattern, "i"),
                rules: compile(provider.rules),
                rawRules: compile(provider.rawRules),
                exceptions: compile(provider.exceptions)
            }];
        } catch {
            return [];
        }
    });
}

export function cleanTrackedUrls(content, providers = clearUrlsRules) {
    return content.replace(/https?:\/\/[^\s<]+[^<.,:;"'>)|\]\s]/gi, (link) => {
        const queryAt = link.indexOf("?");
        const fragmentAt = link.indexOf("#");
        if (queryAt === -1 || (fragmentAt !== -1 && fragmentAt < queryAt)) return link;

        let cleaned = link;
        for (const { urlPattern, rules, rawRules, exceptions } of providers) {
            if (!urlPattern.test(cleaned) || exceptions?.some((rule) => rule.test(cleaned))) continue;
            // Keep the original percent encoding and order of every untouched parameter.
            const parts = /^(.*?)\?([^#]*)(#.*)?$/.exec(cleaned);
            if (parts && rules?.length) {
                const [, base, query, fragment = ""] = parts;
                const parameters = query.split("&");
                const kept = parameters.filter((parameter) => {
                    const raw = parameter.split("=", 1)[0];
                    let key = raw;
                    try {
                        key = decodeURIComponent(raw.replace(/\+/g, " "));
                    } catch {}
                    return !rules.some((rule) => rule.test(key));
                });
                if (kept.length !== parameters.length) {
                    cleaned = base + (kept.length ? "?" + kept.join("&") : "") + fragment;
                }
            }
            for (const rule of rawRules ?? []) cleaned = cleaned.replace(rule, "");
        }
        return cleaned;
    });
}

export const ClearURLs = definePlugin({
    name: "ClearURLs",
    description: "Entfernt Tracking-Parameter aus Links beim Senden und Bearbeiten.",
    authors: [{ name: "adryd" }, { name: "thororen" }],
    tags: ["Privacy", "Utility"],
    enabledByDefault: true,
    start() {
        if (clearUrlsRequest || typeof fetch !== "function") return;
        clearUrlsRequest = fetch(clearUrlsRulesUrl)
            .then((response) => {
                if (!response.ok) throw new Error("ClearURLs rule download failed");
                return response.json();
            })
            .then(({ providers }) => {
                const rules = compileClearUrlsRules(providers);
                if (rules.length) clearUrlsRules = [trackingFallback, ...rules];
            })
            .catch(() => { clearUrlsRequest = undefined; });
    },
    onBeforeMessageSend(_channelId, message) {
        message.content = cleanTrackedUrls(message.content);
    },
    onBeforeMessageEdit(_channelId, _messageId, message) {
        message.content = cleanTrackedUrls(message.content);
    }
});

export function unindentCodeBlocks(content) {
    return content.replace(/(^|\n)([ \t]*```[^\n`]*\n)([\s\S]*?)(\n[ \t]*```(?=[ \t]*(?:\r?\n|$)))/g,
        (block, boundary, opening, body, closing) => {
            const expanded = body.replace(/\t/g, "    ");
            const minIndent = expanded.match(/^ *(?=\S)/gm)
                ?.reduce((minimum, indent) => Math.min(minimum, indent.length), Infinity);
            if (minIndent === undefined) return block;
            const unindented = minIndent ? expanded.replace(new RegExp(`^ {${minIndent}}`, "gm"), "") : expanded;
            return boundary + opening + unindented + closing;
        });
}

export const Unindent = definePlugin({
    name: "Unindent",
    description: "Entfernt gemeinsame Einrückungen aus Codeblöcken in deinen Nachrichten.",
    authors: [{ name: "V" }],
    tags: ["Chat", "Utility"],
    enabledByDefault: true,
    onBeforeMessageSend(_channelId, message) {
        message.content = unindentCodeBlocks(message.content);
    },
    onBeforeMessageEdit(_channelId, _messageId, message) {
        message.content = unindentCodeBlocks(message.content);
    }
});

export const textReplaceRuleGroups = [
    { key: "stringRules", label: "Textregel" },
    { key: "regexRules", label: "Regex-Regel" }
];

export function parseTextReplaceRegex(value) {
    const match = value.match(/^(\/)?(.+?)(?:\/([gimsuyv]*))?$/);
    if (!match) return new RegExp(value);
    const flags = match[3] === undefined ? "g" : [...new Set(match[3])].join("");
    return new RegExp(match[2], flags);
}

export function applyTextReplaceRules(content, options) {
    if (!content) return content;
    for (const { key } of textReplaceRuleGroups) {
        const rules = options[key];
        if (!Array.isArray(rules)) continue;
        for (const rule of rules) {
            if (typeof rule?.find !== "string" || !rule.find || typeof rule.replace !== "string") continue;
            if (rule.onlyIfIncludes && !content.includes(rule.onlyIfIncludes)) continue;
            const replacement = rule.replace.replaceAll("\\n", "\n");
            if (key === "stringRules") {
                const padded = ` ${content} `;
                const next = padded.replaceAll(rule.find, replacement);
                if (next !== padded) content = next.replace(/^\s|\s$/g, "");
            } else {
                try {
                    content = content.replace(parseTextReplaceRegex(rule.find), replacement);
                } catch {}
            }
        }
    }
    return content;
}

const textReplaceSettings = definePluginSettings({
    stringRules: { type: OptionType.CUSTOM, default: [] },
    regexRules: { type: OptionType.CUSTOM, default: [] }
});

export const TextReplace = definePlugin({
    name: "TextReplace",
    description: "Ersetzt beim Senden Text nach deinen Text- und Regex-Regeln.",
    authors: [{ name: "AutumnVN" }, { name: "TheKodeToad" }],
    tags: ["Chat", "Utility"],
    settings: textReplaceSettings,
    onBeforeMessageSend(channelId, message) {
        if (channelId !== "1102784112584040479") {
            message.content = applyTextReplaceRules(message.content, textReplaceSettings.store);
        }
    }
});

function listIncludesId(list, id) {
    return typeof list === "string" && Boolean(id) && list.split(/[\s,]+/).includes(id);
}

const silentTypingSettings = definePluginSettings({
    isEnabled: { type: OptionType.BOOLEAN, label: "Tippanzeige unterdrücken", default: true },
    showTypingIn: {
        type: OptionType.STRING,
        label: "Kanäle mit Tippanzeige",
        description: "Kanal-IDs mit Kommas oder Leerzeichen trennen.",
        default: ""
    }
});

export const SilentTyping = definePlugin({
    name: "SilentTyping",
    description: "Verbirgt deine Tippanzeige mit optionalen Ausnahmen pro Kanal.",
    authors: [{ name: "V" }, { name: "Rini" }, { name: "ImBanana" }],
    tags: ["Chat", "Privacy"],
    settings: silentTypingSettings,
    start({ patcher }) {
        return patcher.waitFor(["startTyping", "stopTyping"], (actions) => {
            patcher.instead("SilentTyping", actions, "startTyping", (args, startTyping) => {
                const { isEnabled, showTypingIn } = silentTypingSettings.store;
                if (isEnabled && !listIncludesId(showTypingIn, args[0])) return;
                return startTyping(...args);
            });
        });
    }
});

const noReplyMentionSettings = definePluginSettings({
    shouldPingListed: { type: OptionType.BOOLEAN, label: "Nur gelistete Nutzer oder Rollen erwähnen", default: true },
    userList: { type: OptionType.STRING, label: "Nutzer-IDs", description: "IDs mit Kommas oder Leerzeichen trennen.", default: "" },
    roleList: { type: OptionType.STRING, label: "Rollen-IDs", description: "IDs mit Kommas oder Leerzeichen trennen.", default: "" }
});

export const NoReplyMention = definePlugin({
    name: "NoReplyMention",
    description: "Legt fest, wer beim Antworten standardmäßig erwähnt wird.",
    authors: [{ name: "DustyAngel47" }, { name: "rae" }, { name: "pylix" }, { name: "outfoxxed" }],
    tags: ["Chat", "Notifications"],
    enabledByDefault: true,
    settings: noReplyMentionSettings,
    start({ patcher }) {
        return patcher.waitFor(["createPendingReply", "deletePendingReply", "setPendingReplyShouldMention"], (actions) => {
            patcher.before("NoReplyMention", actions, "createPendingReply", (args) => {
                const reply = args[0];
                if (!reply?.shouldMention) return;
                const { userList, roleList, shouldPingListed } = noReplyMentionSettings.store;
                const userId = reply.message?.author?.id;
                const guildId = reply.channel?.guild_id;
                const roles = guildId && userId && roleList
                    ? patcher.findByStoreName("GuildMemberStore")?.getMember(guildId, userId)?.roles
                    : null;
                const isListed = listIncludesId(userList, userId)
                    || Boolean(roles?.some((roleId) => listIncludesId(roleList, roleId)));
                return [{ ...reply, shouldMention: Boolean(shouldPingListed) === isListed }, ...args.slice(1)];
            });
        });
    }
});
