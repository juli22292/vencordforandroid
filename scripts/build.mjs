/**
 * Build script for VencordForAndroid
 * Compiles the Hermes/React-Native compatible bundle dist/vencordforandroid.js and dist/manifest.json
 * for direct injection into the official Discord Android app (com.discord) via LSPatch / Xposed.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { transformSync } from "@babel/core";
import transformClasses from "@babel/plugin-transform-classes";
import { BUILTIN_PLUGINS } from "../src/plugins/builtinPlugins.js";
import { CORE_VERSION } from "../src/core/Version.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");

const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8"));
const version = pkg.version;
if (version !== CORE_VERSION || !/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error("package.json and the runtime must declare the same release version.");
}
const builtAt = new Date().toISOString();

const moduleOrder = [
    "src/core/Version.js",
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
 * Includes ${BUILTIN_PLUGINS.length} plugin definitions
 * Built: ${builtAt}
 */
(function (global) {
"use strict";
try {
`;

const footer = `
} catch (error) {
    const message = "[VencordForAndroid] Bundle startup failed: " + (error?.stack || error);
    if (typeof global.nativeLoggingHook === "function") global.nativeLoggingHook(message, 3);
    else global.console?.error?.(message);
}
})(typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : this);
`;

const transformed = transformSync(`${banner}\n${chunks.join("\n\n")}\n${footer}`, {
    babelrc: false,
    configFile: false,
    sourceType: "script",
    plugins: [transformClasses]
}).code;
const bundleContent = `(function () {\n${transformed}\n})();\n`;

fs.mkdirSync(distDir, { recursive: true });
fs.writeFileSync(path.join(distDir, "vencordforandroid.js"), bundleContent, "utf8");

const sha256 = crypto.createHash("sha256").update(bundleContent).digest("hex");

const manifest = {
    name: "VencordForAndroid",
    version,
    minRequiredVersion: "0.0.2",
    minInstallerVersion: pkg.minInstallerVersion,
    corruptedVersions: pkg.corruptedVersions,
    targetApp: "com.discord",
    repository: "juli22292/vencordforandroid",
    installerRepository: "juli22292/vencordandroidapp",
    bundleFile: "vencordforandroid.js",
    bundleUrl: `https://github.com/juli22292/vencordforandroid/releases/download/${version}/vencordforandroid.js`,
    rawBundleUrl: "https://raw.githubusercontent.com/juli22292/vencordforandroid/main/dist/vencordforandroid.js",
    sha256,
    pluginCount: BUILTIN_PLUGINS.length,
    builtAt,
    changelog: `v${version}: Der Vencord-Abschnitt wird auch in der durchsuchbaren Einstellungsübersicht von Discord 355.10 eingebunden.`
};

fs.writeFileSync(path.join(distDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
console.log(`[Build] Built dist/vencordforandroid.js v${version} (${bundleContent.length} bytes, ${BUILTIN_PLUGINS.length} plugins, sha256=${sha256.slice(0, 12)})`);
