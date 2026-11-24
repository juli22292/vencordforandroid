/**
 * Build script for VencordForAndroid v0.0.7
 * Compiles the Hermes/React-Native compatible bundle dist/vencordforandroid.js and dist/manifest.json
 * for direct injection into the official Discord Android app (com.discord) via LSPatch / Xposed.
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
const version = pkg.version || "0.0.7";

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
 * VencordForAndroid v${version} (React Native / Hermes Bundle for com.discord)
 * Repository: https://github.com/juli22292/vencordforandroid
 * Official Vencord Plugins adapted for Android (${BUILTIN_PLUGINS.length} plugins)
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
fs.writeFileSync(path.join(distDir, "vencordforandroid.js"), bundleContent, "utf8");

const sha256 = crypto.createHash("sha256").update(bundleContent).digest("hex");

const manifest = {
    name: "VencordForAndroid",
    version,
    minRequiredVersion: "0.0.2",
    minInstallerVersion: "0.0.2",
    corruptedVersions: ["0.0.1"],
    targetApp: "com.discord",
    repository: "juli22292/vencordforandroid",
    installerRepository: "juli22292/vencordandroidapp",
    bundleFile: "vencordforandroid.js",
    bundleUrl: `https://github.com/juli22292/vencordforandroid/releases/download/${version}/vencordforandroid.js`,
    rawBundleUrl: "https://raw.githubusercontent.com/juli22292/vencordforandroid/main/dist/vencordforandroid.js",
    sha256,
    pluginCount: BUILTIN_PLUGINS.length,
    builtAt: new Date().toISOString(),
    changelog: `v${version}: Echtes React-Native/Hermes-Bundle (direkter __r- & SETTING_RENDERER_CONFIG-Hook in die offizielle com.discord-App via LSPatch) mit ${BUILTIN_PLUGINS.length} offiziellen Vencord-Plugins.`
};

fs.writeFileSync(path.join(distDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
console.log(`[Build] Built dist/vencordforandroid.js v${version} (${bundleContent.length} bytes, ${BUILTIN_PLUGINS.length} plugins, sha256=${sha256.slice(0, 12)})`);
