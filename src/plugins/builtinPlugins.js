/**
 * VencordForAndroid plugin catalog and legacy Android plugins
 * Source: https://github.com/Vendicated/Vencord/tree/main/src/plugins
 * Adapted for Android by juli22292
 */

import { definePlugin } from "../core/PluginManager.js";
import { ClearURLs, NoReplyMention, SilentTyping, TextReplace, Unindent } from "./officialChatPlugins.js";

export const AccountPanelServerProfile = definePlugin({
    name: "AccountPanelServerProfile",
    description: "Right click your account panel in the bottom left to view your profile in the current server",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Appearance", "Guilds"],
    enabledByDefault: false,
    options: {
        prioritizeServerProfile: {
            type: "boolean",
            label: "Prioritize Server Profile when tapping your account panel",
            default: false
        }
    }
});

export const AddAttachments = definePlugin({
    name: "AddAttachments",
    description: "Allows you to add new attachments while editing messages",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Chat", "Messages"],
    enabledByDefault: false
});

export const AlwaysAnimate = definePlugin({
    name: "AlwaysAnimate",
    description: "Animates anything that can be animated",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Appearance", "Media"],
    enabledByDefault: true,
    start({ patcher }) {
        const ImageResolver = patcher.findByProps("getUserAvatarURL", "getGuildIconURL");
        if (ImageResolver) {
            if (typeof ImageResolver.getUserAvatarURL === "function") {
                patcher.before("AlwaysAnimate", ImageResolver, "getUserAvatarURL", (args) => {
                    if (args.length >= 2) args[1] = true;
                    return args;
                });
            }
            if (typeof ImageResolver.getGuildIconURL === "function") {
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

export const AlwaysExpandRoles = definePlugin({
    name: "AlwaysExpandRoles",
    description: "Always expands the role list in profile popouts",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Appearance", "Guilds"],
    enabledByDefault: true
});

export const AlwaysTrust = definePlugin({
    name: "AlwaysTrust",
    description: "Removes the annoying untrusted domain and suspicious file popup",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Utility", "Chat"],
    enabledByDefault: false,
    options: {
        domain: {
            type: "boolean",
            label: "Trust all external domains without confirmation popup",
            default: true
        },
        file: {
            type: "boolean",
            label: "Trust all downloaded file extensions",
            default: true
        },
        noDeleteSafety: {
            type: "boolean",
            label: "Skip delete server confirmation prompt",
            default: false
        }
    },
    start({ patcher }) {
        const MaskedLinkStore = patcher.findByProps("isTrustedDomain");
        if (MaskedLinkStore && typeof MaskedLinkStore.isTrustedDomain === "function") {
            patcher.instead("AlwaysTrust", MaskedLinkStore, "isTrustedDomain", () => true);
        }
    }
});

export const AnonymiseFileNames = definePlugin({
    name: "AnonymiseFileNames",
    description: "Anonymise uploaded file names",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Privacy", "Media"],
    enabledByDefault: true,
    options: {
        method: {
            type: "select",
            label: "Anonymising method",
            choices: ["Random Characters", "Timestamp", "Custom Name"],
            default: "Random Characters"
        },
        randomisedLength: {
            type: "select",
            label: "Random characters length",
            choices: ["6", "8", "12", "16"],
            default: "8"
        },
        consistent: {
            type: "boolean",
            label: "Consistent filenames for identical hashes",
            default: true
        }
    }
});

export const AppleMusicRichPresence = definePlugin({
    name: "AppleMusicRichPresence",
    description: "Discord rich presence for your Apple Music status on Android",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Media", "Utility"],
    enabledByDefault: false,
    options: {
        refreshInterval: { type: "select", label: "Refresh interval (seconds)", choices: ["5", "10", "15"], default: "10" }
    }
});

export const AutomodContext = definePlugin({
    name: "AutomodContext",
    description: "Allows you to jump to the message surrounding an Automod hit",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Guilds", "Messages"],
    enabledByDefault: false
});

export const BetterFolders = definePlugin({
    name: "BetterFolders",
    description: "Shows server folders on dedicated sidebar and allows auto-closing folders",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Appearance", "Guilds"],
    enabledByDefault: false,
    options: {
        closeAllFolders: { type: "boolean", label: "Close all folders on startup", default: false },
        closeOthers: { type: "boolean", label: "Close other folders when opening a folder", default: true },
        forceOpen: { type: "boolean", label: "Force open folder of selected server", default: true }
    }
});

export const BetterGifAltText = definePlugin({
    name: "BetterGifAltText",
    description: "Change GIF alt text from simply being 'GIF' to containing the GIF's tags/title",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Media", "Appearance"],
    enabledByDefault: false
});

export const BetterGifPicker = definePlugin({
    name: "BetterGifPicker",
    description: "Makes the gif picker open the favorite category by default",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Media", "Chat"],
    enabledByDefault: true
});

export const BetterNotesBox = definePlugin({
    name: "BetterNotesBox",
    description: "Hide notes or disable spellcheck in user profile notes",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Appearance", "Utility"],
    enabledByDefault: false,
    options: {
        hide: { type: "boolean", label: "Hide the notes box in user profiles", default: false },
        noSpellCheck: { type: "boolean", label: "Disable spellcheck in notes", default: true }
    }
});

export const BetterRoleContext = definePlugin({
    name: "BetterRoleContext",
    description: "Adds options to copy role color / ID / icon when tapping a role in profile popouts",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Guilds", "Utility"],
    enabledByDefault: true,
    options: {
        roleIconFileFormat: { type: "select", label: "Role icon format", choices: ["png", "webp"], default: "png" }
    }
});

export const BetterRoleDot = definePlugin({
    name: "BetterRoleDot",
    description: "Copy role colour on RoleDot click and use both RoleDot and coloured names simultaneously",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Appearance", "Guilds"],
    enabledByDefault: false,
    options: {
        bothStyles: { type: "boolean", label: "Show both RoleDot and coloured usernames", default: true },
        copyRoleColorInProfilePopout: { type: "boolean", label: "Tap RoleDot to copy hex color", default: true }
    }
});

export const BetterSessions = definePlugin({
    name: "BetterSessions",
    description: "Enhances the active sessions (Devices) page with custom device names and notifications",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Privacy", "Notifications"],
    enabledByDefault: true,
    options: {
        backgroundCheck: { type: "boolean", label: "Check for new unknown logins in background", default: true }
    }
});

export const BetterSettings = definePlugin({
    name: "BetterSettings",
    description: "Enhances your settings menu opening speed and navigation experience",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Appearance", "Shortcuts"],
    enabledByDefault: true,
    options: {
        disableFade: { type: "boolean", label: "Disable slow fade animation on settings open", default: true },
        eagerLoad: { type: "boolean", label: "Eagerly preload all settings tabs", default: true }
    }
});

export const BetterUploadButton = definePlugin({
    name: "BetterUploadButton",
    description: "Upload with a single tap instead of opening the attachment menu",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Chat", "Shortcuts"],
    enabledByDefault: false
});

export const BiggerStreamPreview = definePlugin({
    name: "BiggerStreamPreview",
    description: "This plugin allows you to enlarge stream previews in voice channels",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Voice", "Media"],
    enabledByDefault: true
});

export const BlurNSFW = definePlugin({
    name: "BlurNSFW",
    description: "Blur attachments in NSFW channels until you tap them",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Privacy", "Media"],
    enabledByDefault: false,
    options: {
        blurAmount: { type: "select", label: "Blur radius (px)", choices: ["5", "10", "20", "30"], default: "10" }
    }
});

export const CallTimer = definePlugin({
    name: "CallTimer",
    description: "Adds a live duration timer to any voice call or voice channel",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Voice", "Utility"],
    enabledByDefault: true,
    options: {
        format: { type: "select", label: "Timer Format", choices: ["stopwatch", "human"], default: "stopwatch" }
    }
});

export const ClientTheme = definePlugin({
    name: "ClientTheme",
    description: "Recreation of the old Discord client theme experiment with custom hex color picker",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Appearance"],
    enabledByDefault: false,
    options: {
        color: { type: "select", label: "Accent Color Hex", choices: ["#313338", "#1e1f22", "#5865f2", "#111214", "#23a55a"], default: "#313338" }
    }
});

export const ColorSighted = definePlugin({
    name: "ColorSighted",
    description: "Removes the colorblind-friendly icons from status indicators, leaving pure round status dots",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Appearance"],
    enabledByDefault: false
});

export const ConsoleJanitor = definePlugin({
    name: "ConsoleJanitor",
    description: "Disables annoying console logs and warnings from Discord internals",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Utility"],
    enabledByDefault: false,
    options: {
        disableLoggers: { type: "boolean", label: "Disable verbose Discord loggers", default: true },
        disableSpotifyLogger: { type: "boolean", label: "Disable Spotify polling logs", default: true }
    }
});

export const ConsoleShortcuts = definePlugin({
    name: "ConsoleShortcuts",
    description: "Adds shorter aliases for common debugging functions on the global window object",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Utility"],
    enabledByDefault: false
});

export const CopyEmojiMarkdown = definePlugin({
    name: "CopyEmojiMarkdown",
    description: "Allows you to copy the raw markdown (<:name:id>) of an emoji from its popout",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Chat", "Utility"],
    enabledByDefault: true,
    options: {
        copyUnicode: { type: "boolean", label: "Copy unicode character for standard emojis", default: true }
    }
});

export const CopyFileContents = definePlugin({
    name: "CopyFileContents",
    description: "Adds a button to text file attachments to copy their contents to clipboard",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Chat", "Utility"],
    enabledByDefault: true
});

export const CopyUserURLs = definePlugin({
    name: "CopyUserURLs",
    description: "Adds a 'Copy User URL' (<https://discord.com/users/id>) entry to user profiles",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Friends", "Utility"],
    enabledByDefault: true
});

export const CrashHandler = definePlugin({
    name: "CrashHandler",
    description: "Utility plugin for handling and recovering from Discord UI crashes without restarting",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Utility"],
    enabledByDefault: true,
    options: {
        attemptToPreventCrashes: { type: "boolean", label: "Attempt to recover React tree without reloading", default: true },
        attemptToNavigateToHome: { type: "boolean", label: "Navigate to Home DM tab on fatal channel crash", default: false }
    }
});

export const CtrlEnterSend = definePlugin({
    name: "CtrlEnterSend",
    description: "Customize how the Enter / Send key behaves when typing messages",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Chat", "Shortcuts"],
    enabledByDefault: false,
    options: {
        submitRule: { type: "select", label: "Submit rule", choices: ["ctrl+enter", "shift+enter", "enter"], default: "ctrl+enter" }
    }
});

export const CustomIdle = definePlugin({
    name: "CustomIdle",
    description: "Allows you to set a custom idle timeout or disable auto-idle completely",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Utility", "Privacy"],
    enabledByDefault: false,
    options: {
        idleTimeout: { type: "select", label: "Idle timeout (minutes, 0 = disabled)", choices: ["0", "5", "10", "30", "60"], default: "10" },
        remainInIdle: { type: "boolean", label: "Remain in auto-idle until manually confirmed", default: true }
    }
});

export const CustomRPC = definePlugin({
    name: "CustomRPC",
    description: "Add a fully customisable Rich Presence (Game / Stream / Listening status) to your Discord profile",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Appearance", "Utility"],
    enabledByDefault: false,
    options: {
        appName: { type: "select", label: "Application Name", choices: ["VencordForAndroid", "Visual Studio Code", "Spotify", "Custom"], default: "VencordForAndroid" },
        type: { type: "select", label: "Activity Type", choices: ["Playing", "Streaming", "Listening", "Watching", "Competing"], default: "Playing" }
    }
});

export const Dearrow = definePlugin({
    name: "Dearrow",
    description: "Makes YouTube video titles and thumbnails less clickbaity using CrowdSourced DeArrow data",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Media", "Appearance"],
    enabledByDefault: false,
    options: {
        hideButton: { type: "boolean", label: "Hide the DeArrow toggle button on embeds", default: false },
        replaceElements: { type: "select", label: "Elements to replace", choices: ["Everything", "Titles Only", "Thumbnails Only"], default: "Everything" }
    }
});

export const Decor = definePlugin({
    name: "Decor",
    description: "Create and use custom avatar decorations for free with other Vencord users",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Appearance"],
    enabledByDefault: true
});

export const DisableCallIdle = definePlugin({
    name: "DisableCallIdle",
    description: "Disables automatically getting kicked from a DM voice call after 3 minutes alone",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Voice"],
    enabledByDefault: true
});

export const DontRoundMyTimestamps = definePlugin({
    name: "DontRoundMyTimestamps",
    description: "Prevents Discord from rounding relative timestamps up to the next unit",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Messages", "Appearance"],
    enabledByDefault: false
});

export const Experiments = definePlugin({
    name: "Experiments",
    description: "Enable Access to Experiments & other dev-only features in Discord!",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Utility"],
    enabledByDefault: true,
    options: {
        toolbarDevMenu: { type: "boolean", label: "Enable Staging DevMenu in Toolbar", default: false }
    }
});

export const FakeNitro = definePlugin({
    name: "FakeNitro",
    description: "Allows you to stream in nitro quality, send fake emojis/stickers, use client themes and custom icons",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Chat", "Media", "Voice"],
    enabledByDefault: true,
    options: {
        enableEmojiBypass: { type: "boolean", label: "Allow sending external & animated emojis", default: true },
        emojiSize: { type: "select", label: "Emoji Size (px)", choices: ["32", "48", "64", "96"], default: "48" },
        enableStickerBypass: { type: "boolean", label: "Allow sending custom stickers", default: true },
        stickerSize: { type: "select", label: "Sticker Size (px)", choices: ["128", "160", "200"], default: "160" },
        enableStreamQualityBypass: { type: "boolean", label: "Unlock 1080p/1440p 60fps screenshare", default: true },
        useHyperLinks: { type: "boolean", label: "Use masked hyperlinks for fake emojis", default: true }
    },
    start({ patcher }) {
        const EmojiPermStore = patcher.findByProps("canUseEmojisEverywhere", "canUseAnimatedEmojis");
        if (EmojiPermStore) {
            patcher.instead("FakeNitro", EmojiPermStore, "canUseEmojisEverywhere", () => true);
            patcher.instead("FakeNitro", EmojiPermStore, "canUseAnimatedEmojis", () => true);
        }
    }
});

export const FakeProfileThemes = definePlugin({
    name: "FakeProfileThemes",
    description: "Allows profile theming by hiding the colors as invisible 3y3 encoding in your bio",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Appearance"],
    enabledByDefault: true,
    options: {
        nitroFirst: { type: "boolean", label: "Prefer real Nitro theme colors if present", default: true }
    }
});

export const FavoriteEmojiFirst = definePlugin({
    name: "FavoriteEmojiFirst",
    description: "Puts your favorite emojis first in the emoji autocomplete list",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Chat", "Shortcuts"],
    enabledByDefault: true
});

export const FavoriteGifSearch = definePlugin({
    name: "FavoriteGifSearch",
    description: "Adds a search bar to your favorite gifs menu",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Media", "Chat"],
    enabledByDefault: true,
    options: {
        searchOption: { type: "select", label: "Search target", choices: ["Url & Title", "Url Only", "Title Only"], default: "Url & Title" }
    }
});

export const FixCodeblockGap = definePlugin({
    name: "FixCodeblockGap",
    description: "Removes the awkward empty gap below codeblocks in messages",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Appearance", "Messages"],
    enabledByDefault: true
});

export const FixImagesQuality = definePlugin({
    name: "FixImagesQuality",
    description: "Improves quality of images in chat by forcing original WebP/PNG resolution",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Media", "Appearance"],
    enabledByDefault: true
});

export const FixSpotifyEmbeds = definePlugin({
    name: "FixSpotifyEmbeds",
    description: "Fixes spotify embeds being way too loud by letting you configure their default volume",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Media"],
    enabledByDefault: false,
    options: {
        volume: { type: "select", label: "Spotify Embed Volume (%)", choices: ["10", "25", "50", "75", "100"], default: "25" }
    }
});

export const FixYoutubeEmbeds = definePlugin({
    name: "FixYoutubeEmbeds",
    description: "Bypasses youtube videos being blocked from playing inside Discord embeds",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Media"],
    enabledByDefault: true
});

export const ForceOwnerCrown = definePlugin({
    name: "ForceOwnerCrown",
    description: "Force the owner crown next to usernames even if the server is very large",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Appearance", "Guilds"],
    enabledByDefault: true
});

export const FriendInvites = definePlugin({
    name: "FriendInvites",
    description: "Create and manage friend invite links via slash commands (/create friend invite)",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Friends", "Utility"],
    enabledByDefault: false
});

export const FriendsSince = definePlugin({
    name: "FriendsSince",
    description: "Displays when you became friends with someone in their user profile popout",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Friends", "Appearance"],
    enabledByDefault: true
});

export const FullSearchContext = definePlugin({
    name: "FullSearchContext",
    description: "Makes the message context menu in search results have all standard options",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Messages", "Utility"],
    enabledByDefault: true
});

export const GameActivityToggle = definePlugin({
    name: "GameActivityToggle",
    description: "Adds a button next to the mic and deafen button to toggle game activity visibility",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Appearance", "Privacy"],
    enabledByDefault: false,
    options: {
        oldIcon: { type: "boolean", label: "Use classic controller icon", default: false }
    }
});

export const GifPaste = definePlugin({
    name: "GifPaste",
    description: "Makes picking a GIF in the gif picker insert a link into the chatbox instead of instantly sending it",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Chat", "Media"],
    enabledByDefault: false
});

export const GreetStickerPicker = definePlugin({
    name: "GreetStickerPicker",
    description: "Allows you to use any welcome sticker instead of only the random default sticker",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Chat"],
    enabledByDefault: false,
    options: {
        greetMode: { type: "select", label: "Greet mode", choices: ["Greet", "Normal Message"], default: "Greet" }
    }
});

export const HideAttachments = definePlugin({
    name: "HideAttachments",
    description: "Allow hiding attachments and embeds for individual messages via a toggle button",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Media", "Messages"],
    enabledByDefault: false
});

export const IgnoreActivities = definePlugin({
    name: "IgnoreActivities",
    description: "Ignore specific activities from showing up on your status or others' profiles",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Privacy", "Appearance"],
    enabledByDefault: false,
    options: {
        ignorePlaying: { type: "boolean", label: "Hide all 'Playing' statuses", default: false },
        ignoreStreaming: { type: "boolean", label: "Hide all 'Streaming' statuses", default: false },
        ignoreListening: { type: "boolean", label: "Hide all 'Listening' statuses", default: false }
    }
});

export const iLoveSpam = definePlugin({
    name: "iLoveSpam",
    description: "Do not collapse messages from 'likely spammers' automatically",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Chat", "Messages"],
    enabledByDefault: false
});

export const ImageFilename = definePlugin({
    name: "ImageFilename",
    description: "Display the file name of images & videos as a tooltip / overlay",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Media", "Appearance"],
    enabledByDefault: false,
    options: {
        showFullUrl: { type: "boolean", label: "Show full CDN URL instead of filename only", default: false }
    }
});

export const ImageZoom = definePlugin({
    name: "ImageZoom",
    description: "Lets you zoom in to images and gifs inside Discord with a magnifier lens",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Media"],
    enabledByDefault: true,
    options: {
        size: { type: "select", label: "Lens Size", choices: ["100", "200", "300"], default: "200" },
        zoom: { type: "select", label: "Zoom Multiplier", choices: ["2", "3", "4"], default: "2" },
        nearestNeighbour: { type: "boolean", label: "Use Nearest Neighbour (pixel art mode)", default: false }
    }
});

export const ImplicitRelationships = definePlugin({
    name: "ImplicitRelationships",
    description: "Shows your implicit relationships (Discord affinity score) in the Friends tab",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Friends"],
    enabledByDefault: false,
    options: {
        sortByAffinity: { type: "boolean", label: "Sort friends by affinity score", default: true }
    }
});

export const InvisibleChat = definePlugin({
    name: "InvisibleChat",
    description: "Encrypt your messages in invisible zero-width characters so only Vencord users can read them",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Privacy", "Chat"],
    enabledByDefault: false,
    options: {
        savedPasswords: { type: "select", label: "Default Decryption Key", choices: ["password", "vencord", "secret"], default: "password" }
    }
});

export const KeepCurrentChannel = definePlugin({
    name: "KeepCurrentChannel",
    description: "Attempt to navigate back to the exact channel you had open before restarting Discord",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Utility", "Shortcuts"],
    enabledByDefault: true
});

export const LastFMRichPresence = definePlugin({
    name: "LastFMRichPresence",
    description: "Little plugin for Last.fm rich presence status",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Media", "Appearance"],
    enabledByDefault: false,
    options: {
        shareUsername: { type: "boolean", label: "Show Last.fm profile link button", default: false },
        hideWithSpotify: { type: "boolean", label: "Hide status if Spotify is already running", default: true }
    }
});

export const LoadingQuotes = definePlugin({
    name: "LoadingQuotes",
    description: "Replace Discord's loading quotes with custom Vencord quotes",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Appearance"],
    enabledByDefault: true,
    options: {
        replaceEvents: { type: "boolean", label: "Replace special event loading quotes too", default: true },
        enablePluginPresetQuotes: { type: "boolean", label: "Include built-in Vencord quotes", default: true }
    }
});

export const MemberCount = definePlugin({
    name: "MemberCount",
    description: "Shows the amount of online and total members in the server member list and tooltip",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Guilds", "Appearance"],
    enabledByDefault: true,
    options: {
        toolTip: { type: "boolean", label: "Show member count on server icon tooltip", default: true },
        memberList: { type: "boolean", label: "Show member count at the top of member list", default: true }
    }
});

export const MentionAvatars = definePlugin({
    name: "MentionAvatars",
    description: "Shows user avatars inside @mentions in chat",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Appearance", "Messages"],
    enabledByDefault: false,
    options: {
        showAtSymbol: { type: "boolean", label: "Keep the @ symbol next to the avatar", default: true }
    }
});

export const MessageClickActions = definePlugin({
    name: "MessageClickActions",
    description: "Double-tap a message to quick-reply or edit your own message",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Chat", "Shortcuts"],
    enabledByDefault: true,
    options: {
        enableDeleteOnClick: { type: "boolean", label: "Enable quick delete on modifier click", default: true },
        enableDoubleClickToEdit: { type: "boolean", label: "Double tap own message to edit", default: true },
        enableDoubleClickToReply: { type: "boolean", label: "Double tap others' message to reply", default: true }
    }
});

export const MessageLatency = definePlugin({
    name: "MessageLatency",
    description: "Displays an indicator for messages that took >= N seconds to arrive",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Messages", "Utility"],
    enabledByDefault: false,
    options: {
        latency: { type: "select", label: "Threshold in seconds", choices: ["1", "2", "5"], default: "2" },
        detectDiscordKotlin: { type: "boolean", label: "Detect old Discord Android Kotlin clients", default: true },
        showMillis: { type: "boolean", label: "Show milliseconds precision", default: false }
    }
});

export const MessageLinkEmbeds = definePlugin({
    name: "MessageLinkEmbeds",
    description: "Previews the contents of linked Discord messages directly in chat",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Messages", "Chat"],
    enabledByDefault: true,
    options: {
        messageBackgroundColor: { type: "boolean", label: "Use distinct background color for embeds", default: false },
        automodEmbeds: { type: "select", label: "Embed in Automod messages", choices: ["never", "prefer", "always"], default: "never" }
    }
});

export const MessageLogger = definePlugin({
    name: "MessageLogger",
    description: "Temporarily logs deleted and edited messages in chat",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Messages", "Chat", "Utility"],
    enabledByDefault: true,
    options: {
        deleteStyle: { type: "select", label: "Deleted message style", choices: ["text", "overlay"], default: "text" },
        logDeletes: { type: "boolean", label: "Log deleted messages in red", default: true },
        collapseDeleted: { type: "boolean", label: "Collapse deleted messages by default", default: false },
        logEdits: { type: "boolean", label: "Log message edit history inline", default: true },
        inlineEdits: { type: "boolean", label: "Display edited history inline", default: true },
        ignoreBots: { type: "boolean", label: "Ignore messages sent by bots", default: false },
        ignoreSelf: { type: "boolean", label: "Ignore messages sent by yourself", default: false }
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

export const MessageTags = definePlugin({
    name: "MessageTags",
    description: "Allows you to save custom snippets and to send them with a simple slash command",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Chat", "Shortcuts"],
    enabledByDefault: false,
    options: {
        clyde: { type: "boolean", label: "Send confirmation messages via Clyde", default: true }
    }
});

export const MoreCommands = definePlugin({
    name: "MoreCommands",
    description: "Adds various fun and useful slash commands (/echo, /lenny, /mock, /shrug)",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Chat"],
    enabledByDefault: false
});

export const MoreKaomoji = definePlugin({
    name: "MoreKaomoji",
    description: "Adds more Kaomoji to Discord's built-in slash commands",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Chat"],
    enabledByDefault: false
});

export const MoreUserTags = definePlugin({
    name: "MoreUserTags",
    description: "Adds tags for webhooks and moderation roles (Owner, Admin, Mod, Staff, Voice) in chat",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Appearance", "Guilds"],
    enabledByDefault: false,
    options: {
        dontShowForBots: { type: "boolean", label: "Don't show role tags for bots", default: false },
        dontShowBotTag: { type: "boolean", label: "Hide default BOT tag when role tag is shown", default: false }
    }
});

export const Moyai = definePlugin({
    name: "Moyai",
    description: "🗿 Vine boom sound effect whenever someone sends or reacts with 🗿",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Chat", "Media"],
    enabledByDefault: false,
    options: {
        volume: { type: "select", label: "Moyai Volume (%)", choices: ["25", "50", "75", "100"], default: "50" },
        triggerWhenUnfocused: { type: "boolean", label: "Trigger even when Discord is in background", default: true },
        ignoreBots: { type: "boolean", label: "Ignore bots", default: true }
    }
});

export const MutualGroupDMs = definePlugin({
    name: "MutualGroupDMs",
    description: "Shows mutual group DMs in user profiles next to Mutual Servers and Mutual Friends",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Friends", "Appearance"],
    enabledByDefault: true
});

export const NewGuildSettings = definePlugin({
    name: "NewGuildSettings",
    description: "Automatically mute new servers or apply default notification preferences upon joining",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Guilds", "Notifications"],
    enabledByDefault: false,
    options: {
        guild: { type: "boolean", label: "Mute new server automatically", default: false },
        everyone: { type: "boolean", label: "Suppress @everyone and @here", default: true },
        role: { type: "boolean", label: "Suppress all role @mentions", default: true },
        highlights: { type: "boolean", label: "Suppress Community Highlights", default: true },
        muteScheduledEvents: { type: "boolean", label: "Mute new scheduled events", default: false }
    }
});

export const NoBlockedMessages = definePlugin({
    name: "NoBlockedMessages",
    description: "Hides all blocked messages from chat completely",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Chat", "Appearance"],
    enabledByDefault: false,
    options: {
        ignoreBlockedMessages: { type: "boolean", label: "Also ignore unread indicators from blocked users", default: true }
    }
});

export const NoDevtoolsWarning = definePlugin({
    name: "NoDevtoolsWarning",
    description: "Disables the 'Hold Up!' console warning and prevents Self-XSS token logging",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Utility", "Privacy"],
    enabledByDefault: true
});

export const NoF1 = definePlugin({
    name: "NoF1",
    description: "Disables F1 help bind inside Discord",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Shortcuts"],
    enabledByDefault: true
});

export const NoMaskedUrlPaste = definePlugin({
    name: "NoMaskedUrlPaste",
    description: "Pasting a link while having text selected will not paste as a masked URL",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Chat"],
    enabledByDefault: false
});

export const NoMosaic = definePlugin({
    name: "NoMosaic",
    description: "Removes Discord image mosaic layout so multiple images stack cleanly",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Media", "Appearance"],
    enabledByDefault: false,
    options: {
        inlineVideo: { type: "boolean", label: "Apply to multiple videos in a single message too", default: true }
    }
});

export const NoOnboardingDelay = definePlugin({
    name: "NoOnboardingDelay",
    description: "Skips the slow onboarding delay when joining a community server",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Guilds"],
    enabledByDefault: true
});

export const NoPendingCount = definePlugin({
    name: "NoPendingCount",
    description: "Removes the ping count of incoming friend requests, message requests, and nitro offers",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Notifications", "Appearance"],
    enabledByDefault: false,
    options: {
        hideFriendRequestsCount: { type: "boolean", label: "Hide incoming friend requests count", default: true },
        hideMessageRequestsCount: { type: "boolean", label: "Hide message requests badge", default: true },
        hidePremiumOffersCount: { type: "boolean", label: "Hide Nitro promotion badges", default: true }
    }
});

export const NoProfileThemes = definePlugin({
    name: "NoProfileThemes",
    description: "Completely removes Nitro profile themes from everyone's profile popouts",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Appearance"],
    enabledByDefault: false
});

export const NoRPC = definePlugin({
    name: "NoRPC",
    description: "Disables Discord's local RPC server entirely",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Privacy"],
    enabledByDefault: false
});

export const NoScreensharePreview = definePlugin({
    name: "NoScreensharePreview",
    description: "Disables screenshare previews from being sent to reduce mobile data & battery usage",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Voice", "Privacy"],
    enabledByDefault: false
});

export const NoServerEmojis = definePlugin({
    name: "NoServerEmojis",
    description: "Do not show other servers' emojis in the emoji autocomplete menu",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Chat"],
    enabledByDefault: false,
    options: {
        shownEmojis: { type: "select", label: "Shown emojis", choices: ["Only Unicode", "Unicode & Current Server"], default: "Unicode & Current Server" }
    }
});

export const NoSystemBadge = definePlugin({
    name: "NoSystemBadge",
    description: "Disables the unread badge count on the system launcher icon",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Notifications"],
    enabledByDefault: false
});

export const NoTypingAnimation = definePlugin({
    name: "NoTypingAnimation",
    description: "Disables the CPU-intensive typing dots animation in the bottom chat bar",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Appearance", "Utility"],
    enabledByDefault: false
});

export const NoUnblockToJump = definePlugin({
    name: "NoUnblockToJump",
    description: "Allows you to jump to messages of blocked users in search without unblocking them",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Messages", "Utility"],
    enabledByDefault: true
});

export const NormalizeMessageLinks = definePlugin({
    name: "NormalizeMessageLinks",
    description: "Strips canary/ptb subdomains from message links when copying",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Messages", "Utility"],
    enabledByDefault: true
});

export const NotificationVolume = definePlugin({
    name: "NotificationVolume",
    description: "Allows you to set a separate custom volume level for in-app Discord notification sounds",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Notifications"],
    enabledByDefault: false,
    options: {
        notificationVolume: { type: "select", label: "Notification Volume (%)", choices: ["10", "25", "50", "75", "100"], default: "100" }
    }
});

export const NSFWGateBypass = definePlugin({
    name: "NSFWGateBypass",
    description: "Allows you to access NSFW channels without verifying your age on your account",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Guilds", "Utility"],
    enabledByDefault: true
});

export const OnePingPerDM = definePlugin({
    name: "OnePingPerDM",
    description: "If unread messages exist in a DM, suppresses further notification sounds until you read them",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Notifications"],
    enabledByDefault: false,
    options: {
        channelToAffect: { type: "select", label: "Channel types", choices: ["Both DMs and Group DMs", "Private DMs Only", "Group DMs Only"], default: "Both DMs and Group DMs" },
        allowMentions: { type: "boolean", label: "Always play sound for explicit @mentions", default: false },
        allowEveryone: { type: "boolean", label: "Always play sound for @everyone", default: false }
    }
});

export const oneko = definePlugin({
    name: "oneko",
    description: "Cat follow cursor / touch point on screen (oneko)",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Appearance"],
    enabledByDefault: false
});

export const OpenInApp = definePlugin({
    name: "OpenInApp",
    description: "Opens Spotify, Steam, Epic, and Tidal links directly in their native apps",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Utility", "Shortcuts"],
    enabledByDefault: true,
    options: {
        spotify: { type: "boolean", label: "Open Spotify links in Spotify app", default: true },
        steam: { type: "boolean", label: "Open Steam links in Steam app", default: true },
        epic: { type: "boolean", label: "Open Epic Games links in app", default: true },
        tidal: { type: "boolean", label: "Open Tidal links in Tidal app", default: true }
    }
});

export const OverrideForumDefaults = definePlugin({
    name: "OverrideForumDefaults",
    description: "Allows you to override default forum layout (List vs Gallery) and sort order",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Guilds", "Appearance"],
    enabledByDefault: false,
    options: {
        defaultLayout: { type: "select", label: "Default layout", choices: ["List View", "Gallery View"], default: "List View" },
        defaultSortOrder: { type: "select", label: "Default sort order", choices: ["Recently Active", "Date Posted"], default: "Recently Active" }
    }
});

export const PartyMode = definePlugin({
    name: "PartyMode",
    description: "Allows you to use Discord's anniversary Party Mode combos and confetti anytime",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Appearance", "Chat"],
    enabledByDefault: false,
    options: {
        superIntensePartyMode: { type: "select", label: "Intensity", choices: ["Normal", "Better", "Project X"], default: "Normal" }
    }
});

export const PauseInvitesForever = definePlugin({
    name: "PauseInvitesForever",
    description: "Brings back the option to pause server invites indefinitely in server settings",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Guilds"],
    enabledByDefault: false
});

export const PermissionFreeWill = definePlugin({
    name: "PermissionFreeWill",
    description: "Disables client-side permission checks for channel lockouts and server onboarding",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Guilds", "Utility"],
    enabledByDefault: false,
    options: {
        lockout: { type: "boolean", label: "Bypass channel permission lockout warning", default: true },
        onboarding: { type: "boolean", label: "Bypass mandatory onboarding requirements", default: true }
    }
});

export const PermissionsViewer = definePlugin({
    name: "PermissionsViewer",
    description: "View the permissions a user or role has, and the roles of a server",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Guilds", "Utility"],
    enabledByDefault: true,
    options: {
        permissionsSortOrder: { type: "select", label: "Sort method", choices: ["Highest Role", "Lowest Role"], default: "Highest Role" }
    }
});

export const petpet = definePlugin({
    name: "petpet",
    description: "Adds a /petpet slash command to generate headpat GIFs of any user's avatar",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Chat", "Media"],
    enabledByDefault: false
});

export const PictureInPicture = definePlugin({
    name: "PictureInPicture",
    description: "Adds picture in picture button on videos inside Discord",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Media"],
    enabledByDefault: true,
    options: {
        loop: { type: "boolean", label: "Loop PiP videos automatically", default: true }
    }
});

export const PinDMs = definePlugin({
    name: "PinDMs",
    description: "Allows you to pin private messages and categorize them at the top of your DM list",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Friends", "Shortcuts"],
    enabledByDefault: true,
    options: {
        pinOrder: { type: "select", label: "Pin order", choices: ["Most Recent", "Custom Order"], default: "Custom Order" },
        canCollapseDmSection: { type: "boolean", label: "Allow collapsing DM categories", default: true }
    }
});

export const PlainFolderIcon = definePlugin({
    name: "PlainFolderIcon",
    description: "Dont show the small guild icons in server folders",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Appearance", "Guilds"],
    enabledByDefault: false
});

export const PlatformIndicators = definePlugin({
    name: "PlatformIndicators",
    description: "Adds platform indicators (Desktop, Mobile, Web, Embedded) to users",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Appearance", "Friends"],
    enabledByDefault: true,
    options: {
        list: { type: "boolean", label: "Show indicators in the member list", default: true },
        badges: { type: "boolean", label: "Show indicators as profile badges", default: true },
        messages: { type: "boolean", label: "Show indicators next to usernames in chat", default: true },
        colorMobileIndicator: { type: "boolean", label: "Color mobile icon with user status color", default: true }
    }
});

export const PreviewMessage = definePlugin({
    name: "PreviewMessage",
    description: "Lets you preview your formatted message before sending it",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Chat"],
    enabledByDefault: false
});

export const QuickMention = definePlugin({
    name: "QuickMention",
    description: "Adds an @ mention button directly to the message actions bar",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Chat", "Shortcuts"],
    enabledByDefault: true
});

export const QuickReply = definePlugin({
    name: "QuickReply",
    description: "Reply to (and edit) messages via quick shortcut",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Chat", "Shortcuts"],
    enabledByDefault: false,
    options: {
        shouldMention: { type: "select", label: "Mention mode", choices: ["Follow NoReplyMention plugin", "Enabled", "Disabled"], default: "Follow NoReplyMention plugin" }
    }
});

export const ReactErrorDecoder = definePlugin({
    name: "ReactErrorDecoder",
    description: "Replaces 'Minified React Error' crashes with the actual decoded error description",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Utility"],
    enabledByDefault: true
});

export const ReadAllNotificationsButton = definePlugin({
    name: "ReadAllNotificationsButton",
    description: "Read all server notifications with a single button click!",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Notifications", "Shortcuts"],
    enabledByDefault: true
});

export const RelationshipNotifier = definePlugin({
    name: "RelationshipNotifier",
    description: "Notifies you when a friend, group chat, or server removes you",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Friends", "Notifications"],
    enabledByDefault: true,
    options: {
        notices: { type: "boolean", label: "Also show a permanent top notice banner", default: false },
        offlineRemovals: { type: "boolean", label: "Check for removals that happened while offline", default: true },
        friends: { type: "boolean", label: "Notify when a friend removes you", default: true },
        friendRequestCancels: { type: "boolean", label: "Notify when a friend request is cancelled", default: true },
        servers: { type: "boolean", label: "Notify when kicked/banned from a server", default: true },
        groups: { type: "boolean", label: "Notify when removed from a Group DM", default: true }
    }
});

export const ReplaceGoogleSearch = definePlugin({
    name: "ReplaceGoogleSearch",
    description: "Replaces the Google search engine with different Engines (DuckDuckGo, Brave, Startpage)",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Utility"],
    enabledByDefault: false,
    options: {
        customEngineName: { type: "select", label: "Search Engine", choices: ["DuckDuckGo", "Brave", "Startpage", "Google"], default: "DuckDuckGo" }
    }
});

export const ReplyTimestamp = definePlugin({
    name: "ReplyTimestamp",
    description: "Shows a timestamp on replied-message previews",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Messages", "Appearance"],
    enabledByDefault: true
});

export const RevealAllSpoilers = definePlugin({
    name: "RevealAllSpoilers",
    description: "Reveal all spoilers in a message by long-pressing / Ctrl-clicking a spoiler",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Messages", "Shortcuts"],
    enabledByDefault: true
});

export const ReverseImageSearch = definePlugin({
    name: "ReverseImageSearch",
    description: "Adds Image Search options (Google, Yandex, SauceNAO, IQDB, TinEye) to image context menus",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Media", "Utility"],
    enabledByDefault: true
});

export const ReviewDB = definePlugin({
    name: "ReviewDB",
    description: "Review other users and servers (powered by ReviewDB)",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Friends", "Appearance"],
    enabledByDefault: false,
    options: {
        notifyReviews: { type: "boolean", label: "Notify when someone leaves a review on your profile", default: true },
        showWarning: { type: "boolean", label: "Show warning on offensive reviews", default: true },
        hideTimestamps: { type: "boolean", label: "Hide timestamps on reviews", default: false },
        hideBlockedUsers: { type: "boolean", label: "Hide reviews written by blocked users", default: true }
    }
});

export const RoleColorEverywhere = definePlugin({
    name: "RoleColorEverywhere",
    description: "Adds the top role color anywhere possible (chat mentions, typing bar, voice list, member list)",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Appearance", "Guilds"],
    enabledByDefault: true,
    options: {
        chatMentions: { type: "boolean", label: "Use role colors in @mentions in chat", default: true },
        memberList: { type: "boolean", label: "Use role colors in member list group headers", default: true },
        voiceUsers: { type: "boolean", label: "Use role colors in voice channel user lists", default: true },
        reactorsList: { type: "boolean", label: "Use role colors in the message reactions modal", default: true },
        pollResults: { type: "boolean", label: "Use role colors in poll results", default: true },
        colorChatMessages: { type: "boolean", label: "Tint message text with the author's role color", default: false }
    }
});

export const SearchReply = definePlugin({
    name: "SearchReply",
    description: "Adds a reply button to messages in search results",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Messages", "Shortcuts"],
    enabledByDefault: true
});

export const SecretRingToneEnabler = definePlugin({
    name: "SecretRingToneEnabler",
    description: "Always play the rare 0.1% secret Discord call ringtone",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Voice", "Media"],
    enabledByDefault: false,
    options: {
        onlySnow: { type: "boolean", label: "Only play the Snowsgiving remix version", default: false }
    }
});

export const SendTimestamps = definePlugin({
    name: "SendTimestamps",
    description: "Send dynamic Discord timestamps easily via a chat bar picker button",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Chat", "Utility"],
    enabledByDefault: true,
    options: {
        replaceMessageContents: { type: "boolean", label: "Automatically parse {{HH:mm}} into timestamps", default: true }
    }
});

export const ServerInfo = definePlugin({
    name: "ServerInfo",
    description: "Allows you to view detailed info about a server by long-pressing the server icon",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Guilds", "Utility"],
    enabledByDefault: true
});

export const ServerListIndicators = definePlugin({
    name: "ServerListIndicators",
    description: "Add online friend count or total server count indicators to the top of the server list",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Appearance", "Guilds"],
    enabledByDefault: false,
    options: {
        mode: { type: "select", label: "Indicator mode", choices: ["Both", "Online Friends Only", "Server Count Only"], default: "Both" }
    }
});

export const ShikiCodeblocks = definePlugin({
    name: "ShikiCodeblocks",
    description: "Brings VSCode-style Shiki syntax highlighting to codeblocks in chat",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Appearance", "Messages"],
    enabledByDefault: false,
    options: {
        theme: { type: "select", label: "Syntax Theme", choices: ["Dark Plus", "One Dark Pro", "Dracula", "GitHub Dark", "Catppuccin Mocha"], default: "Dark Plus" },
        tryHljs: { type: "select", label: "Fallback to Highlight.js", choices: ["SECONDARY", "NEVER", "PRIMARY"], default: "SECONDARY" },
        useDevIcon: { type: "select", label: "Language Icon Style", choices: ["COLOR", "GREYSCALE", "DISABLED"], default: "COLOR" }
    }
});

export const ShowAllMessageButtons = definePlugin({
    name: "ShowAllMessageButtons",
    description: "Always show all message action buttons without holding Shift",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Messages", "Shortcuts"],
    enabledByDefault: false
});

export const ShowConnections = definePlugin({
    name: "ShowConnections",
    description: "Show connected accounts directly in user popouts",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Appearance", "Friends"],
    enabledByDefault: true,
    options: {
        iconSize: { type: "select", label: "Icon size (px)", choices: ["24", "32", "40"], default: "32" },
        iconSpacing: { type: "select", label: "Icon spacing", choices: ["Compact", "Normal", "Spacious"], default: "Normal" }
    }
});

export const ShowHiddenChannels = definePlugin({
    name: "ShowHiddenChannels",
    description: "Show channels that you do not have access to view!",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Guilds", "Utility"],
    enabledByDefault: true,
    options: {
        hideUnreads: { type: "boolean", label: "Hide unread indicators on locked channels", default: true },
        showMode: { type: "select", label: "Display style", choices: ["Lock Icon", "Hidden Eye Icon", "Muted Style"], default: "Lock Icon" },
        defaultAllowedUsersAndRolesDropdownState: { type: "boolean", label: "Expand allowed roles in lock screen by default", default: true }
    }
});

export const ShowHiddenThings = definePlugin({
    name: "ShowHiddenThings",
    description: "Displays various hidden & moderator-only things regardless of permissions",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Guilds", "Utility"],
    enabledByDefault: true,
    options: {
        showTimeouts: { type: "boolean", label: "Show timeout icons on timed-out members", default: true },
        showInvitesPaused: { type: "boolean", label: "Show when server invites are paused", default: true },
        showModView: { type: "boolean", label: "Enable member Mod View panel", default: true }
    }
});

export const ShowMeYourName = definePlugin({
    name: "ShowMeYourName",
    description: "Display usernames next to display names / nicknames in chat",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Appearance", "Messages"],
    enabledByDefault: false,
    options: {
        mode: { type: "select", label: "Display format", choices: ["user-nick", "nick-user", "user"], default: "user-nick" },
        inReplies: { type: "boolean", label: "Also show in message replies", default: false },
        friendNicknames: { type: "select", label: "Friend nicknames", choices: ["Fallback to username", "Always use friend nickname"], default: "Fallback to username" }
    }
});

export const ShowTimeoutDuration = definePlugin({
    name: "ShowTimeoutDuration",
    description: "Shows how much longer a user's timeout will last, either in the timeout icon tooltip or inline",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Guilds", "Messages"],
    enabledByDefault: true,
    options: {
        displayStyle: { type: "select", label: "Display style", choices: ["ssalggnikool (Inline)", "Tooltip Only"], default: "ssalggnikool (Inline)" }
    }
});

export const SilentMessageToggle = definePlugin({
    name: "SilentMessageToggle",
    description: "Adds a button to the chat bar to toggle sending a @silent message",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Chat", "Notifications"],
    enabledByDefault: false,
    options: {
        persistState: { type: "boolean", label: "Persist silent state across restarts", default: false },
        autoDisable: { type: "boolean", label: "Automatically disable silent mode after sending 1 message", default: true }
    }
});

export const SortFriendRequests = definePlugin({
    name: "SortFriendRequests",
    description: "Sorts friend requests by date of receipt",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Friends"],
    enabledByDefault: false,
    options: {
        showDates: { type: "boolean", label: "Display exact timestamp on pending requests", default: true }
    }
});

export const SpotifyControls = definePlugin({
    name: "SpotifyControls",
    description: "Adds a Spotify player control bar above your account panel",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Media", "Appearance"],
    enabledByDefault: false,
    options: {
        hoverControls: { type: "boolean", label: "Only show controls on tap/hover", default: false },
        useSpotifyUris: { type: "boolean", label: "Open links directly in Spotify app instead of browser", default: true },
        previousButtonRestartsTrack: { type: "boolean", label: "Previous button restarts current track if >3s in", default: true }
    }
});

export const SpotifyCrack = definePlugin({
    name: "SpotifyCrack",
    description: "Free listen along, no auto-pausing in voice chat, and allows activity without Premium",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Media", "Voice"],
    enabledByDefault: true,
    options: {
        noSpotifyAutoPause: { type: "boolean", label: "Disable Discord auto-pausing Spotify when talking in VC", default: true },
        keepSpotifyActivityOnIdle: { type: "boolean", label: "Keep Spotify status visible when idle", default: false }
    }
});

export const SpotifyShareCommands = definePlugin({
    name: "SpotifyShareCommands",
    description: "Share your current Spotify track, album or artist via slash command (/track, /album, /artist)",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Media", "Chat"],
    enabledByDefault: false
});

export const StartupTimings = definePlugin({
    name: "StartupTimings",
    description: "Adds Startup Timings page to the Vencord settings",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Utility"],
    enabledByDefault: false
});

export const StickerPaste = definePlugin({
    name: "StickerPaste",
    description: "Makes picking a sticker in the sticker picker insert it into the chatbox instead of sending immediately",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Chat"],
    enabledByDefault: false
});

export const StreamerModeOnStream = definePlugin({
    name: "StreamerModeOnStream",
    description: "Automatically enables streamer mode when you start streaming in Discord",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Privacy", "Voice"],
    enabledByDefault: false
});

export const Summaries = definePlugin({
    name: "Summaries",
    description: "Enables Discord's AI conversation summaries feature on all servers",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Messages", "Guilds"],
    enabledByDefault: false
});

export const SuperReactionTweaks = definePlugin({
    name: "SuperReactionTweaks",
    description: "Customize the limit of super reactions playing at once, and super react by default",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Chat", "Appearance"],
    enabledByDefault: false,
    options: {
        superReactByDefault: { type: "boolean", label: "Default reaction picker to Super Reactions", default: false },
        unlimitedSuperReactionPlaying: { type: "boolean", label: "Allow unlimited super reaction animations at once", default: false },
        superReactionPlayingLimit: { type: "select", label: "Max simultaneous animations", choices: ["5", "10", "20", "50"], default: "20" }
    }
});

export const ThemeAttributes = definePlugin({
    name: "ThemeAttributes",
    description: "Adds data attributes to various elements for CSS theming purposes",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Appearance"],
    enabledByDefault: false
});

export const TimeBarAllActivities = definePlugin({
    name: "TimeBarAllActivities",
    description: "Adds the Spotify-like progress time bar to all rich presence activities that have start/end timestamps",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Appearance"],
    enabledByDefault: false
});

export const Translate = definePlugin({
    name: "Translate",
    description: "Translate messages with Google Translate or DeepL",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Chat", "Messages", "Utility"],
    enabledByDefault: true,
    options: {
        service: { type: "select", label: "Translation Service", choices: ["Google Translate", "DeepL Free", "DeepL Pro"], default: "Google Translate" },
        showChatBarButton: { type: "boolean", label: "Show translate button in chat bar", default: true },
        autoTranslate: { type: "boolean", label: "Automatically translate your outgoing messages before sending", default: false },
        receivedOutput: { type: "select", label: "Target language for incoming messages", choices: ["de", "en", "fr", "es", "it", "ja", "ru"], default: "de" }
    }
});

export const TypingIndicator = definePlugin({
    name: "TypingIndicator",
    description: "Adds an indicator if someone is typing on a channel in the channel list",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Appearance", "Guilds"],
    enabledByDefault: true,
    options: {
        includeCurrentChannel: { type: "boolean", label: "Show indicator on currently selected channel", default: true },
        includeMutedChannels: { type: "boolean", label: "Show indicator on muted channels", default: false },
        includeBlockedUsers: { type: "boolean", label: "Show indicator when blocked users are typing", default: false },
        indicatorMode: { type: "select", label: "Indicator mode", choices: ["Dots & Avatars", "Animated Dots", "Avatars Only"], default: "Dots & Avatars" }
    }
});

export const TypingTweaks = definePlugin({
    name: "TypingTweaks",
    description: "Show avatars and role colours in the typing indicator",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Appearance", "Chat"],
    enabledByDefault: true,
    options: {
        showAvatars: { type: "boolean", label: "Show user avatars in the typing bar", default: true },
        showRoleColors: { type: "boolean", label: "Color typing usernames with their role color", default: true },
        alternativeFormatting: { type: "boolean", label: "Show exact list instead of 'Several people are typing'", default: true }
    }
});

export const UnlockedAvatarZoom = definePlugin({
    name: "UnlockedAvatarZoom",
    description: "Allows you to zoom in further in the avatar crop tool",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Appearance", "Utility"],
    enabledByDefault: false,
    options: {
        zoomMultiplier: { type: "select", label: "Max Zoom Multiplier", choices: ["4", "8", "16"], default: "4" }
    }
});

export const UnsuppressEmbeds = definePlugin({
    name: "UnsuppressEmbeds",
    description: "Allows you to unsuppress embeds in messages",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Messages"],
    enabledByDefault: true
});

export const UrbanDictionary = definePlugin({
    name: "UrbanDictionary",
    description: "Search for a word on Urban Dictionary via /urban slash command",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Chat", "Utility"],
    enabledByDefault: false
});

export const UserMessagesPronouns = definePlugin({
    name: "UserMessagesPronouns",
    description: "Adds pronouns to chat user messages",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Appearance", "Messages"],
    enabledByDefault: false,
    options: {
        pronounsFormat: { type: "select", label: "Pronouns format", choices: ["LOWERCASE", "CAPITALIZED"], default: "LOWERCASE" },
        showSelf: { type: "boolean", label: "Show pronouns on your own messages", default: true }
    }
});

export const UserVoiceShow = definePlugin({
    name: "UserVoiceShow",
    description: "Shows an indicator when a user is in a Voice Channel",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Voice", "Appearance"],
    enabledByDefault: true,
    options: {
        showInUserProfileModal: { type: "boolean", label: "Show voice channel in User Profile popouts", default: true },
        showInMemberList: { type: "boolean", label: "Show speaker icon next to user in Member List", default: true },
        showInMessages: { type: "boolean", label: "Show speaker icon next to username in chat messages", default: true }
    }
});

export const USRBG = definePlugin({
    name: "USRBG",
    description: "Displays user banners from USRBG database, allowing anyone to get a custom banner without Nitro",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Appearance"],
    enabledByDefault: true,
    options: {
        nitroFirst: { type: "boolean", label: "Prioritize real Nitro banner if user has both", default: true },
        voiceBackground: { type: "boolean", label: "Use USRBG banners as voice call tile backgrounds", default: true }
    }
});

export const ValidReply = definePlugin({
    name: "ValidReply",
    description: "Fixes 'Message could not be loaded' upon hovering/tapping a reply",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Messages"],
    enabledByDefault: true
});

export const ValidUser = definePlugin({
    name: "ValidUser",
    description: "Fix mentions for unknown/uncached users (<@id>) showing up in chat",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Messages"],
    enabledByDefault: true
});

export const VcNarrator = definePlugin({
    name: "VcNarrator",
    description: "Announces when users join, leave, or move in your voice channel via speech synthesis",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Voice"],
    enabledByDefault: false,
    options: {
        volume: { type: "select", label: "Voice Volume (%)", choices: ["25", "50", "75", "100"], default: "100" },
        rate: { type: "select", label: "Speech Speed", choices: ["0.75", "1.0", "1.25", "1.5"], default: "1.0" },
        latinOnly: { type: "boolean", label: "Strip non-latin symbols from usernames before speaking", default: false }
    }
});

export const VencordToolbox = definePlugin({
    name: "VencordToolbox",
    description: "Adds a button to the titlebar/header that houses Vencord quick actions",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Shortcuts", "Utility"],
    enabledByDefault: true,
    options: {
        showPluginMenu: { type: "boolean", label: "Include quick plugin toggle list in toolbox menu", default: true }
    }
});

export const ViewIcons = definePlugin({
    name: "ViewIcons",
    description: "Makes avatars and banners in user profiles clickable, and adds View Icon to context menus",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Media", "Utility"],
    enabledByDefault: true,
    options: {
        format: { type: "select", label: "Static Image Format", choices: ["webp", "png", "jpg"], default: "webp" },
        imgSize: { type: "select", label: "Image Resolution", choices: ["512", "1024", "2048", "4096"], default: "1024" }
    }
});

export const ViewRaw = definePlugin({
    name: "ViewRaw",
    description: "Copy and view the raw content/data of any message, channel or guild",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Utility", "Messages"],
    enabledByDefault: false,
    options: {
        clickMethod: { type: "select", label: "Button click action", choices: ["Left (Modal)", "Right (Copy Raw)"], default: "Left (Modal)" }
    }
});

export const VoiceChatDoubleClick = definePlugin({
    name: "VoiceChatDoubleClick",
    description: "Join voice chats via double-tap instead of single tap to prevent accidental joins",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Voice", "Shortcuts"],
    enabledByDefault: true
});

export const VoiceDownload = definePlugin({
    name: "VoiceDownload",
    description: "Adds a download button to voice messages",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Voice", "Media"],
    enabledByDefault: true
});

export const VoiceMessages = definePlugin({
    name: "VoiceMessages",
    description: "Allows you to send voice messages anywhere, including uploading audio files as voice messages",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Voice", "Chat"],
    enabledByDefault: true,
    options: {
        noiseSuppression: { type: "boolean", label: "Enable WebRTC Noise Suppression", default: true },
        echoCancellation: { type: "boolean", label: "Enable Echo Cancellation", default: true }
    }
});

export const VolumeBooster = definePlugin({
    name: "VolumeBooster",
    description: "Allows you to set the user and stream volume above the default 200% maximum",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Voice"],
    enabledByDefault: true,
    options: {
        multiplier: { type: "select", label: "Max Volume Multiplier (2 = 400%, 3 = 600%)", choices: ["2", "3", "4", "5"], default: "2" }
    }
});

export const WhoReacted = definePlugin({
    name: "WhoReacted",
    description: "Renders the avatars of users who reacted to a message right next to the reaction pill",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Appearance", "Messages"],
    enabledByDefault: true
});

export const Wikisearch = definePlugin({
    name: "Wikisearch",
    description: "Searches Wikipedia for your query via /wiki slash command",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Chat", "Utility"],
    enabledByDefault: false
});

export const YoutubeAdblock = definePlugin({
    name: "YoutubeAdblock",
    description: "Block ads in YouTube embeds inside Discord via Watch2Gether player",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Media", "Privacy"],
    enabledByDefault: true
});

// Required Core Vencord Plugins
export const NoTrack = definePlugin({
    name: "NoTrack",
    description: "Disable Discord's tracking ('science'/analytics) and crash reporting",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Privacy"],
    required: true,
    enabledByDefault: true,
    options: {
        disableAnalytics: { type: "boolean", label: "Disable Discord Science Analytics", default: true }
    }
});

export const SettingsPlugin = definePlugin({
    name: "Settings",
    description: "Adds the Vencord settings section (Vencord, Plugins, Themes, Updater, Cloud, Backup & Restore) to Discord Settings",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Utility"],
    required: true,
    enabledByDefault: true,
    options: {
        settingsLocation: { type: "select", label: "Settings Section Position", choices: ["aboveActivity", "belowNitro", "top", "bottom"], default: "belowNitro" }
    }
});

export const SupportHelper = definePlugin({
    name: "SupportHelper",
    description: "Helps us provide support to you and provides debug diagnostics",
    authors: [{ name: "Vendicated" }, { name: "juli22292" }],
    tags: ["Utility"],
    required: true,
    enabledByDefault: true
});

export const BUILTIN_PLUGINS = [
    AccountPanelServerProfile,
    AddAttachments,
    AlwaysAnimate,
    AlwaysExpandRoles,
    AlwaysTrust,
    AnonymiseFileNames,
    AppleMusicRichPresence,
    AutomodContext,
    BetterFolders,
    BetterGifAltText,
    BetterGifPicker,
    BetterNotesBox,
    BetterRoleContext,
    BetterRoleDot,
    BetterSessions,
    BetterSettings,
    BetterUploadButton,
    BiggerStreamPreview,
    BlurNSFW,
    CallTimer,
    ClearURLs,
    ClientTheme,
    ColorSighted,
    ConsoleJanitor,
    ConsoleShortcuts,
    CopyEmojiMarkdown,
    CopyFileContents,
    CopyUserURLs,
    CrashHandler,
    CtrlEnterSend,
    CustomIdle,
    CustomRPC,
    Dearrow,
    Decor,
    DisableCallIdle,
    DontRoundMyTimestamps,
    Experiments,
    FakeNitro,
    FakeProfileThemes,
    FavoriteEmojiFirst,
    FavoriteGifSearch,
    FixCodeblockGap,
    FixImagesQuality,
    FixSpotifyEmbeds,
    FixYoutubeEmbeds,
    ForceOwnerCrown,
    FriendInvites,
    FriendsSince,
    FullSearchContext,
    GameActivityToggle,
    GifPaste,
    GreetStickerPicker,
    HideAttachments,
    IgnoreActivities,
    iLoveSpam,
    ImageFilename,
    ImageZoom,
    ImplicitRelationships,
    InvisibleChat,
    KeepCurrentChannel,
    LastFMRichPresence,
    LoadingQuotes,
    MemberCount,
    MentionAvatars,
    MessageClickActions,
    MessageLatency,
    MessageLinkEmbeds,
    MessageLogger,
    MessageTags,
    MoreCommands,
    MoreKaomoji,
    MoreUserTags,
    Moyai,
    MutualGroupDMs,
    NewGuildSettings,
    NoBlockedMessages,
    NoDevtoolsWarning,
    NoF1,
    NoMaskedUrlPaste,
    NoMosaic,
    NoOnboardingDelay,
    NoPendingCount,
    NoProfileThemes,
    NoReplyMention,
    NoRPC,
    NoScreensharePreview,
    NoServerEmojis,
    NoSystemBadge,
    NoTrack,
    NoTypingAnimation,
    NoUnblockToJump,
    NormalizeMessageLinks,
    NotificationVolume,
    NSFWGateBypass,
    OnePingPerDM,
    oneko,
    OpenInApp,
    OverrideForumDefaults,
    PartyMode,
    PauseInvitesForever,
    PermissionFreeWill,
    PermissionsViewer,
    petpet,
    PictureInPicture,
    PinDMs,
    PlainFolderIcon,
    PlatformIndicators,
    PreviewMessage,
    QuickMention,
    QuickReply,
    ReactErrorDecoder,
    ReadAllNotificationsButton,
    RelationshipNotifier,
    ReplaceGoogleSearch,
    ReplyTimestamp,
    RevealAllSpoilers,
    ReverseImageSearch,
    ReviewDB,
    RoleColorEverywhere,
    SearchReply,
    SecretRingToneEnabler,
    SendTimestamps,
    ServerInfo,
    ServerListIndicators,
    SettingsPlugin,
    ShikiCodeblocks,
    ShowAllMessageButtons,
    ShowConnections,
    ShowHiddenChannels,
    ShowHiddenThings,
    ShowMeYourName,
    ShowTimeoutDuration,
    SilentMessageToggle,
    SilentTyping,
    SortFriendRequests,
    SpotifyControls,
    SpotifyCrack,
    SpotifyShareCommands,
    StartupTimings,
    StickerPaste,
    StreamerModeOnStream,
    Summaries,
    SuperReactionTweaks,
    SupportHelper,
    TextReplace,
    ThemeAttributes,
    TimeBarAllActivities,
    Translate,
    TypingIndicator,
    TypingTweaks,
    Unindent,
    UnlockedAvatarZoom,
    UnsuppressEmbeds,
    UrbanDictionary,
    UserMessagesPronouns,
    UserVoiceShow,
    USRBG,
    ValidReply,
    ValidUser,
    VcNarrator,
    VencordToolbox,
    ViewIcons,
    ViewRaw,
    VoiceChatDoubleClick,
    VoiceDownload,
    VoiceMessages,
    VolumeBooster,
    WhoReacted,
    Wikisearch,
    YoutubeAdblock
];

export default BUILTIN_PLUGINS;
