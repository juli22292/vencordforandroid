/**
 * VencordForAndroid v0.0.4 - In-App Updater
 * Follows Vendicated/Vencord/src/utils/updater.ts and Vencord/Vendroid/VencordUpdater.java
 * Pulls updates exclusively from https://github.com/juli22292/vencordforandroid
 */

import { Settings } from "./Settings.js";

export const CORE_VERSION = "0.0.4";
export const MIN_REQUIRED_VERSION = "0.0.4";
export const CORRUPTED_VERSIONS = ["0.0.1", "0.0.2", "0.0.3"];
export const CORE_REPO = "juli22292/vencordforandroid";
export const INSTALLER_REPO = "juli22292/vencordandroidapp";
export const CORE_RELEASES_API = `https://api.github.com/repos/${CORE_REPO}/releases/latest`;
export const CORE_MANIFEST_URL = `https://raw.githubusercontent.com/${CORE_REPO}/main/dist/manifest.json`;
export const CORE_BUNDLE_URL = `https://raw.githubusercontent.com/${CORE_REPO}/main/dist/vencordforandroid.js`;

class UpdaterService {
    constructor() {
        this.lastCheck = null;
        this.latestVersion = CORE_VERSION;
        this.latestHash = "main";
        this.updateAvailable = false;
        this.hasPendingRestart = false;
        this.changes = [];
        this.corruptedVersions = [...CORRUPTED_VERSIONS];
        this.releaseNotes = "";
        this.downloadUrl = CORE_BUNDLE_URL;
        this.status = "idle";
        this.errorMessage = null;
    }

    compareVersions(current, remote) {
        const clean = (v) => String(v || "0.0.0").replace(/^v/i, "").split(".").map((n) => parseInt(n, 10) || 0);
        const a = clean(current);
        const b = clean(remote);
        const len = Math.max(a.length, b.length);
        for (let i = 0; i < len; i++) {
            const av = a[i] || 0;
            const bv = b[i] || 0;
            if (bv > av) return 1;
            if (bv < av) return -1;
        }
        return 0;
    }

    isVersionCorrupted(versionStr) {
        const cleanVer = String(versionStr || "").replace(/^v/i, "").trim();
        if (this.corruptedVersions.includes(cleanVer)) return true;
        if (this.compareVersions(cleanVer, MIN_REQUIRED_VERSION) > 0) return true;
        return false;
    }

    async checkForUpdates() {
        this.status = "checking";
        this.errorMessage = null;

        try {
            let remoteVersion = CORE_VERSION;
            let notes = "";
            let bundleUrl = CORE_BUNDLE_URL;

            try {
                const manifestRes = await fetch(CORE_MANIFEST_URL, { cache: "no-store" });
                if (manifestRes.ok) {
                    const manifest = await manifestRes.json();
                    if (Array.isArray(manifest.corruptedVersions)) {
                        this.corruptedVersions = manifest.corruptedVersions;
                    }
                    remoteVersion = manifest.version || CORE_VERSION;
                    this.latestHash = (manifest.sha256 || "main").slice(0, 7);
                    notes = manifest.changelog || "";
                    bundleUrl = manifest.rawBundleUrl || CORE_BUNDLE_URL;
                }
            } catch (_) {}

            const releaseRes = await fetch(CORE_RELEASES_API, {
                headers: { Accept: "application/vnd.github+json" }
            });

            if (releaseRes.ok) {
                const releaseData = await releaseRes.json();
                remoteVersion = (releaseData.tag_name || releaseData.name || remoteVersion).replace(/^v/i, "");
                notes = releaseData.body || notes;
                const asset = (releaseData.assets || []).find((a) => a.name === "vencordforandroid.js");
                if (asset && asset.browser_download_url) {
                    bundleUrl = asset.browser_download_url;
                }
            }

            this.lastCheck = new Date().toISOString();
            this.latestVersion = remoteVersion;
            this.releaseNotes = notes;
            this.downloadUrl = bundleUrl;
            this.updateAvailable = this.compareVersions(CORE_VERSION, remoteVersion) > 0;
            this.status = this.updateAvailable ? "update-available" : "up-to-date";

            return {
                currentVersion: CORE_VERSION,
                latestVersion: this.latestVersion,
                latestHash: this.latestHash,
                updateAvailable: this.updateAvailable,
                releaseNotes: this.releaseNotes,
                downloadUrl: this.downloadUrl,
                repository: CORE_REPO
            };
        } catch (err) {
            this.status = "error";
            this.errorMessage = err?.message || "Failed to fetch updates from GitHub";
            return {
                currentVersion: CORE_VERSION,
                latestVersion: this.latestVersion,
                updateAvailable: false,
                error: this.errorMessage,
                repository: CORE_REPO
            };
        }
    }

    async downloadAndApplyUpdate() {
        this.status = "downloading";
        try {
            const res = await fetch(this.downloadUrl, { cache: "no-store" });
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }
            const bundleCode = await res.text();

            if (typeof globalThis !== "undefined") {
                if (globalThis.__VENCORD_NATIVE_BRIDGE__?.saveBundleUpdate) {
                    await globalThis.__VENCORD_NATIVE_BRIDGE__.saveBundleUpdate(bundleCode, this.latestVersion);
                } else if (globalThis.mmkvStorage) {
                    globalThis.mmkvStorage.set("VencordForAndroid_CachedBundle", bundleCode);
                    globalThis.mmkvStorage.set("VencordForAndroid_CachedVersion", this.latestVersion);
                } else if (globalThis.localStorage) {
                    globalThis.localStorage.setItem("VencordForAndroid_CachedBundle", bundleCode);
                    globalThis.localStorage.setItem("VencordForAndroid_CachedVersion", this.latestVersion);
                }
            }

            Settings.set("version", this.latestVersion);
            this.updateAvailable = false;
            this.hasPendingRestart = true;
            this.status = "up-to-date";

            return {
                success: true,
                installedVersion: this.latestVersion
            };
        } catch (err) {
            this.status = "error";
            this.errorMessage = err?.message || "Update installation failed";
            return {
                success: false,
                error: this.errorMessage
            };
        }
    }
}

export const Updater = new UpdaterService();
export default Updater;
