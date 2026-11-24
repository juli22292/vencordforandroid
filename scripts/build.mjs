/**
 * Build script for VencordForAndroid v0.0.6
 * Packages the official compiled Vencord bundle (browser.js + browser.css)
 * together with Android mobile adaptations (mobile_bridge.js + mobile_styles.css).
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");

const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8"));
const version = pkg.version || "0.0.6";

fs.mkdirSync(distDir, { recursive: true });

// 1. Official Vencord browser.js (contains ALL official Vencord plugins & Settings UI)
const officialBrowserJs = fs.readFileSync(path.join(rootDir, "vendor", "browser.js"), "utf8");
fs.writeFileSync(path.join(distDir, "browser.js"), officialBrowserJs, "utf8");
// Also write as vencordforandroid.js for backwards compatibility
fs.writeFileSync(path.join(distDir, "vencordforandroid.js"), officialBrowserJs, "utf8");

// 2. Official Vencord browser.css + Android mobile adaptation styles
const officialBrowserCss = fs.readFileSync(path.join(rootDir, "vendor", "browser.css"), "utf8");
const mobileStylesCss = fs.readFileSync(path.join(rootDir, "src", "mobile", "mobile_styles.css"), "utf8");
const combinedCss = `${officialBrowserCss}\n\n/* --- VencordForAndroid Mobile Styles --- */\n${mobileStylesCss}`;
fs.writeFileSync(path.join(distDir, "browser.css"), combinedCss, "utf8");

// 3. Android mobile bridge script (hooks Vencord Settings Updater & Android Back Button)
const mobileBridgeJs = fs.readFileSync(path.join(rootDir, "src", "mobile", "mobile_bridge.js"), "utf8");
fs.writeFileSync(path.join(distDir, "mobile_bridge.js"), mobileBridgeJs, "utf8");

const sha256Js = crypto.createHash("sha256").update(officialBrowserJs).digest("hex");
const sha256Css = crypto.createHash("sha256").update(combinedCss).digest("hex");
const sha256Bridge = crypto.createHash("sha256").update(mobileBridgeJs).digest("hex");

const manifest = {
    name: "VencordForAndroid",
    version,
    minRequiredVersion: "0.0.2",
    minInstallerVersion: "0.0.2",
    corruptedVersions: ["0.0.1"],
    repository: "juli22292/vencordforandroid",
    installerRepository: "juli22292/vencordandroidapp",
    files: {
        browserJs: `https://github.com/juli22292/vencordforandroid/releases/download/${version}/browser.js`,
        browserCss: `https://github.com/juli22292/vencordforandroid/releases/download/${version}/browser.css`,
        mobileBridgeJs: `https://github.com/juli22292/vencordforandroid/releases/download/${version}/mobile_bridge.js`
    },
    rawFiles: {
        browserJs: "https://raw.githubusercontent.com/juli22292/vencordforandroid/main/dist/browser.js",
        browserCss: "https://raw.githubusercontent.com/juli22292/vencordforandroid/main/dist/browser.css",
        mobileBridgeJs: "https://raw.githubusercontent.com/juli22292/vencordforandroid/main/dist/mobile_bridge.js"
    },
    sha256: sha256Js,
    hashes: {
        browserJs: sha256Js,
        browserCss: sha256Css,
        mobileBridgeJs: sha256Bridge
    },
    builtAt: new Date().toISOString(),
    changelog: `v${version}: Offizielles kompiliertes Vencord (browser.js + browser.css) mit ALLEN offiziellen Vencord-Plugins voll funktionsfähig und speziell für Android-Handys angepasst.`
};

fs.writeFileSync(path.join(distDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
console.log(`[Build] Built VencordForAndroid v${version}:`);
console.log(`  - dist/browser.js (${officialBrowserJs.length} bytes, sha256=${sha256Js.slice(0, 12)})`);
console.log(`  - dist/browser.css (${combinedCss.length} bytes, sha256=${sha256Css.slice(0, 12)})`);
console.log(`  - dist/mobile_bridge.js (${mobileBridgeJs.length} bytes)`);
