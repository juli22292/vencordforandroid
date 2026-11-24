/**
 * Build script for VencordForAndroid v0.0.3
 * Produces dist/vencordforandroid.js and dist/manifest.json
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { BUILTIN_PLUGINS } from "../src/plugins/builtinPlugins.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");

const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8"));
const version = pkg.version || "0.0.3";

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
        .replace(/^\s*export\s*\{[^}]*\};?\s*$/gm, "")
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
 * Official Vencord Plugins adapted for Android (${BUILTIN_PLUGINS.length} plugins)
 * Target: Official Discord Android App (com.discord / com.discord.ptb / com.discord.canary)
 * Corrupted/Blocked Versions: 0.0.1
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
    minRequiredVersion: "0.0.2",
    minInstallerVersion: "0.0.2",
    corruptedVersions: ["0.0.1"],
    forceUpdateFrom: ["0.0.1"],
    corruptedMessage: "Version 0.0.1 ist veraltet. Bitte aktualisiere auf Version 0.0.5.",
    targetApp: "com.discord",
    repository: "juli22292/vencordforandroid",
    installerRepository: "juli22292/vencordandroidapp",
    bundleFile: "vencordforandroid.js",
    bundleUrl: `https://github.com/juli22292/vencordforandroid/releases/download/${version}/vencordforandroid.js`,
    rawBundleUrl: "https://raw.githubusercontent.com/juli22292/vencordforandroid/main/dist/vencordforandroid.js",
    sha256,
    builtAt: new Date().toISOString(),
    pluginCount: BUILTIN_PLUGINS.length,
    changelog: `v${version}: Offizielle Vencord Settings-Oberfläche (Vencord, Plugins, Themes, Updater, Cloud, Backup & Restore) in den Discord-Einstellungen sowie ${BUILTIN_PLUGINS.length} offizielle Vencord-Plugins für Android.`,
    plugins: BUILTIN_PLUGINS.map((p) => ({
        name: p.name,
        version,
        description: p.description,
        tags: p.tags,
        hasSettings: p.hasSettings,
        required: p.required,
        enabledByDefault: p.enabledByDefault
    }))
};

fs.writeFileSync(path.join(distDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
console.log(`[Build] Built dist/vencordforandroid.js v${version} (${bundleContent.length} bytes, ${BUILTIN_PLUGINS.length} plugins, sha256=${sha256.slice(0, 12)}...)`);
