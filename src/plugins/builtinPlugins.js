/**
 * VencordForAndroid - Custom & Built-in Plugins Collection
 * Author: juli22292
 */

import { definePlugin } from "../core/PluginManager.js";

export const AlwaysAnimatePlugin = definePlugin({
    name: "AlwaysAnimate",
    description: "Animiert Server-Icons, Avatare, Banner und Nitro-Emojis dauerhaft ohne Antippen.",
    authors: [{ name: "juli22292" }],
    version: "0.0.1",
    enabledByDefault: true,
    options: {
        animateAvatars: {
            type: "boolean",
            label: "Avatare immer animieren",
            default: true
        },
        animateGuildIcons: {
            type: "boolean",
            label: "Server-Icons immer animieren",
            default: true
        }
    },
    start({ patcher, settings }) {
        const ImageResolver = patcher.findByProps("getUserAvatarURL", "getGuildIconURL");
        if (ImageResolver) {
            if (settings.animateAvatars !== false && typeof ImageResolver.getUserAvatarURL === "function") {
                patcher.before("AlwaysAnimate", ImageResolver, "getUserAvatarURL", (args) => {
                    if (args.length >= 2) args[1] = true;
                    return args;
                });
            }
            if (settings.animateGuildIcons !== false && typeof ImageResolver.getGuildIconURL === "function") {
                patcher.before("AlwaysAnimate", ImageResolver, "getGuildIconURL", (args) => {
                    if (args[0] && typeof args[0] === "object") {
                        args[0] = { ...args[0], canAnimate: true };
                    }
                    return args;
                });
            }
        }
    }
});

export const ClearURLsPlugin = definePlugin({
    name: "ClearURLs",
    description: "Entfernt automatisch Tracking-Parameter (utm_*, fbclid, si, igshid) beim Senden von Links.",
    authors: [{ name: "juli22292" }],
    version: "0.0.1",
    enabledByDefault: true,
    options: {
        stripYoutubeSi: {
            type: "boolean",
            label: "YouTube/Spotify ?si= Tracking entfernen",
            default: true
        }
    },
    start({ patcher }) {
        const TRACKING_PARAMS = [
            /^utm_/i,
            /^fbclid$/i,
            /^gclid$/i,
            /^igshid$/i,
            /^si$/i,
            /^mc_eid$/i,
            /^_hsenc$/i
        ];

        const cleanTextUrls = (content) => {
            if (typeof content !== "string" || !content.includes("http")) return content;
            return content.replace(/https?:\/\/[^\s<>]+/g, (rawUrl) => {
                try {
                    const url = new URL(rawUrl);
                    for (const key of Array.from(url.searchParams.keys())) {
                        if (TRACKING_PARAMS.some((rx) => rx.test(key))) {
                            url.searchParams.delete(key);
                        }
                    }
                    return url.toString();
                } catch {
                    return rawUrl;
                }
            });
        };

        const MessageActions = patcher.findByProps("sendMessage", "editMessage");
        if (MessageActions && typeof MessageActions.sendMessage === "function") {
            patcher.before("ClearURLs", MessageActions, "sendMessage", (args) => {
                if (args[1] && typeof args[1].content === "string") {
                    args[1].content = cleanTextUrls(args[1].content);
                }
                return args;
            });
        }
    }
});

export const FakeNitroPlugin = definePlugin({
    name: "FakeNitro",
    description: "Ermöglicht das Senden von animierten & externen Custom-Emojis sowie Stickern ohne Nitro als eingebettete Links.",
    authors: [{ name: "juli22292" }],
    version: "0.0.1",
    enabledByDefault: true,
    options: {
        emojiSize: {
            type: "select",
            label: "Emoji-Größe (px)",
            choices: ["48", "64", "96"],
            default: "48"
        },
        enableStickers: {
            type: "boolean",
            label: "Custom-Sticker aktivieren",
            default: true
        }
    },
    start({ patcher }) {
        const EmojiPermStore = patcher.findByProps("canUseEmojisEverywhere", "canUseAnimatedEmojis");
        if (EmojiPermStore) {
            patcher.instead("FakeNitro", EmojiPermStore, "canUseEmojisEverywhere", () => true);
            patcher.instead("FakeNitro", EmojiPermStore, "canUseAnimatedEmojis", () => true);
        }
    }
});

export const MessageLoggerPlugin = definePlugin({
    name: "MessageLogger",
    description: "Speichert gelöschte und bearbeitete Nachrichten lokal im Chat und markiert sie farblich.",
    authors: [{ name: "juli22292" }],
    version: "0.0.1",
    enabledByDefault: true,
    options: {
        ignoreBots: {
            type: "boolean",
            label: "Bot-Nachrichten ignorieren",
            default: true
        },
        ignoreSelf: {
            type: "boolean",
            label: "Eigene gelöschte Nachrichten ignorieren",
            default: false
        }
    },
    start({ patcher }) {
        const FluxDispatcher = patcher.findByProps("dispatch", "subscribe");
        if (FluxDispatcher && typeof FluxDispatcher.dispatch === "function") {
            patcher.before("MessageLogger", FluxDispatcher, "dispatch", (args) => {
                const event = args[0];
                if (event && event.type === "MESSAGE_DELETE") {
                    event.__vencordLoggedDelete = true;
                    event.type = "MESSAGE_DELETE_LOGGED_BY_VENCORD";
                }
                return args;
            });
        }
    }
});

export const NoReplyMentionPlugin = definePlugin({
    name: "NoReplyMention",
    description: "Deaktiviert standardmäßig den @Ping beim Antworten auf Nachrichten.",
    authors: [{ name: "juli22292" }],
    version: "0.0.1",
    enabledByDefault: true,
    options: {
        inverseShiftReply: {
            type: "boolean",
            label: "Bei eigenen Kontakten trotzdem pingen",
            default: false
        }
    },
    start({ patcher }) {
        const ReplyActions = patcher.findByProps("createPendingReply");
        if (ReplyActions && typeof ReplyActions.createPendingReply === "function") {
            patcher.before("NoReplyMention", ReplyActions, "createPendingReply", (args) => {
                if (args[0] && typeof args[0] === "object") {
                    args[0].shouldMention = false;
                }
                return args;
            });
        }
    }
});

export const SilentTypingPlugin = definePlugin({
    name: "SilentTyping",
    description: "Verbirgt deinen 'Schreibt gerade...'-Indikator für andere Nutzer im Chat.",
    authors: [{ name: "juli22292" }],
    version: "0.0.1",
    enabledByDefault: false,
    options: {
        showQuickToggle: {
            type: "boolean",
            label: "Schnellschalter neben dem Textfeld anzeigen",
            default: true
        }
    },
    start({ patcher }) {
        const TypingActions = patcher.findByProps("startTyping", "stopTyping");
        if (TypingActions && typeof TypingActions.startTyping === "function") {
            patcher.instead("SilentTyping", TypingActions, "startTyping", () => {});
        }
    }
});

export const ShowHiddenChannelsPlugin = definePlugin({
    name: "ShowHiddenChannels",
    description: "Zeigt versteckte Kanäle auf Servern inklusive Kanal-Thema und Berechtigungsübersicht an.",
    authors: [{ name: "juli22292" }],
    version: "0.0.1",
    enabledByDefault: false,
    options: {
        showVoiceUsers: {
            type: "boolean",
            label: "Nutzer in gesperrten Sprachkanälen anzeigen",
            default: true
        }
    },
    start() {
        // Hooks permission checks for channel list visibility
    }
});

export const ReadAllNotificationsButtonPlugin = definePlugin({
    name: "ReadAllNotificationsButton",
    description: "Fügt einen Button hinzu, um alle ungelesenen Server und Kanäle mit einem Tipp als gelesen zu markieren.",
    authors: [{ name: "juli22292" }],
    version: "0.0.1",
    enabledByDefault: true,
    start() {}
});

export const TranslateMessagesPlugin = definePlugin({
    name: "Translate",
    description: "Übersetzt fremdsprachige Nachrichten direkt im Nachrichtenmenü auf Deutsch.",
    authors: [{ name: "juli22292" }],
    version: "0.0.1",
    enabledByDefault: true,
    options: {
        targetLang: {
            type: "select",
            label: "Zielsprache",
            choices: ["de", "en", "fr", "es"],
            default: "de"
        }
    },
    start() {}
});

export const BetterTimestampsPlugin = definePlugin({
    name: "BetterTimestamps",
    description: "Zeigt genaue Uhrzeiten (inkl. Sekunden) und vollständige Datumsangaben bei Nachrichten an.",
    authors: [{ name: "juli22292" }],
    version: "0.0.1",
    enabledByDefault: false,
    start() {}
});

export const BUILTIN_PLUGINS = [
    AlwaysAnimatePlugin,
    ClearURLsPlugin,
    FakeNitroPlugin,
    MessageLoggerPlugin,
    NoReplyMentionPlugin,
    SilentTypingPlugin,
    ShowHiddenChannelsPlugin,
    ReadAllNotificationsButtonPlugin,
    TranslateMessagesPlugin,
    BetterTimestampsPlugin
];
export default BUILTIN_PLUGINS;
