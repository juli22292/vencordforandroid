/**
 * Build script for VencordForAndroid
 * Produces dist/vencordforandroid.js and dist/manifest.json
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");

const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8"));
const version = pkg.version || "0.0.1";

const moduleOrder = [
    "src/core/Settings.js",
    "src/core/Patcher.js",
    "src/core/PluginManager.js",
    "src/core/Updater.js",
    "src/plugins/builtinPlugins.js",
    "src/ui/DiscordSettingsInjector.js",
    "src/index.js"
];

function stripImportsExports(code) {
    return code
        .replace(/^\s*import\s+[\s\S]*?from\s+["'][^"']+["'];?\s*$/gm, "")
        .replace(/^\s*export\s+default\s+.*$/gm, "")
        .replace(/^\s*export\s+(const|let|var|class|function)\s+/gm, "$1 ");
}

const chunks = [];
for (const relPath of moduleOrder) {
    const absPath = path.join(rootDir, relPath);
    const raw = fs.readFileSync(absPath, "utf8");
    chunks.push(`// --- Module: ${relPath} ---\n${stripImportsExports(raw).trim()}`);
}

const banner = `/**
 * VencordForAndroid v${version}
 * Repository: https://github.com/juli22292/vencordforandroid
 * Built: ${new Date().toISOString()}
 */
(function (global) {
"use strict";
`;

const footer = `
})(typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : this);
`;

const bundleContent = `${banner}\n${chunks.join("\n\n")}\n${footer}`;

fs.mkdirSync(distDir, { recursive: true });
const bundlePath = path.join(distDir, "vencordforandroid.js");
fs.writeFileSync(bundlePath, bundleContent, "utf8");

const sha256 = crypto.createHash("sha256").update(bundleContent).digest("hex");

const manifest = {
    name: "VencordForAndroid",
    version,
    repository: "juli22292/vencordforandroid",
    installerRepository: "juli22292/vencordandroidapp",
    bundleFile: "vencordforandroid.js",
    bundleUrl: `https://github.com/juli22292/vencordforandroid/releases/download/${version}/vencordforandroid.js`,
    rawBundleUrl: "https://raw.githubusercontent.com/juli22292/vencordforandroid/main/dist/vencordforandroid.js",
    sha256,
    builtAt: new Date().toISOString(),
    plugins: [
        { name: "AlwaysAnimate", version, enabledByDefault: true, description: "Animiert Server-Icons, Avatare, Banner und Nitro-Emojis dauerhaft ohne Antippen." },
        { name: "ClearURLs", version, enabledByDefault: true, description: "Entfernt automatisch Tracking-Parameter (utm_*, fbclid, si, igshid) beim Senden von Links." },
        { name: "FakeNitro", version, enabledByDefault: true, description: "Ermöglicht das Senden von animierten & externen Custom-Emojis sowie Stickern ohne Nitro als eingebettete Links." },
        { name: "MessageLogger", version, enabledByDefault: true, description: "Speichert gelöschte und bearbeitete Nachrichten lokal im Chat und markiert sie farblich." },
        { name: "NoReplyMention", version, enabledByDefault: true, description: "Deaktiviert standardmäßig den @Ping beim Antworten auf Nachrichten." },
        { name: "SilentTyping", version, enabledByDefault: false, description: "Verbirgt deinen 'Schreibt gerade...'-Indikator für andere Nutzer im Chat." },
        { name: "ShowHiddenChannels", version, enabledByDefault: false, description: "Zeigt versteckte Kanäle auf Servern inklusive Kanal-Thema und Berechtigungsübersicht an." },
        { name: "ReadAllNotificationsButton", version, enabledByDefault: true, description: "Fügt einen Button hinzu, um alle ungelesenen Server und Kanäle mit einem Tipp als gelesen zu markieren." },
        { name: "Translate", version, enabledByDefault: true, description: "Übersetzt fremdsprachige Nachrichten direkt im Nachrichtenmenü auf Deutsch." },
        { name: "BetterTimestamps", version, enabledByDefault: false, description: "Zeigt genaue Uhrzeiten (inkl. Sekunden) und vollständige Datumsangaben bei Nachrichten an." }
    ]
};

fs.writeFileSync(path.join(distDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
console.log(`[Build] Built dist/vencordforandroid.js (${bundleContent.length} bytes, sha256=${sha256.slice(0, 12)}...)`);
