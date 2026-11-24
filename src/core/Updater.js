/**
 * VencordForAndroid - In-App Updater
 * Checks and installs updates exclusively from https://github.com/juli22292/vencordforandroid
 * (Strictly separated from the installer repository juli22292/vencordandroidapp)
 */

import { Settings } from "./Settings.js";

export const CORE_VERSION = "0.0.1";
export const CORE_REPO = "juli22292/vencordforandroid";
export const CORE_RELEASES_API = `https://api.github.com/repos/${CORE_REPO}/releases/latest`;
export const CORE_MANIFEST_URL = `https://raw.githubusercontent.com/${CORE_REPO}/main/dist/manifest.json`;
export const CORE_BUNDLE_URL = `https://raw.githubusercontent.com/${CORE_REPO}/main/dist/vencordforandroid.js`;

class UpdaterService {
    constructor() {
        this.lastCheck = null;
        this.latestVersion = CORE_VERSION;
        this.updateAvailable = false;
        this.releaseNotes = "";
        this.downloadUrl = CORE_BUNDLE_URL;
        this.status = "idle"; // idle | checking | update-available | downloading | up-to-date | error
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

    async checkForUpdates() {
        this.status = "checking";
        this.errorMessage = null;

        try {
            let remoteVersion = CORE_VERSION;
            let notes = "";
            let bundleUrl = CORE_BUNDLE_URL;

            // 1. Check latest GitHub Release of juli22292/vencordforandroid
            const releaseRes = await fetch(CORE_RELEASES_API, {
                headers: { Accept: "application/vnd.github+json" }
            });

            if (releaseRes.ok) {
                const releaseData = await releaseRes.json();
                remoteVersion = (releaseData.tag_name || releaseData.name || CORE_VERSION).replace(/^v/i, "");
                notes = releaseData.body || "Neues Update für VencordForAndroid und Plugins verfügbar.";
                const asset = (releaseData.assets || []).find((a) => a.name === "vencordforandroid.js");
                if (asset && asset.browser_download_url) {
                    bundleUrl = asset.browser_download_url;
                }
            } else {
                // Fallback to manifest.json on main branch
                const manifestRes = await fetch(CORE_MANIFEST_URL, { cache: "no-store" });
                if (manifestRes.ok) {
                    const manifest = await manifestRes.json();
                    remoteVersion = manifest.version || CORE_VERSION;
                    notes = manifest.changelog || "Update über main-Branch verfügbar.";
                    bundleUrl = manifest.bundleUrl || CORE_BUNDLE_URL;
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
                updateAvailable: this.updateAvailable,
                releaseNotes: this.releaseNotes,
                downloadUrl: this.downloadUrl,
                repository: CORE_REPO
            };
        } catch (err) {
            this.status = "error";
            this.errorMessage = err?.message || "Verbindung zu GitHub fehlgeschlagen";
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
                throw new Error(`Download fehlgeschlagen (HTTP ${res.status})`);
            }
            const bundleCode = await res.text();

            // Persist bundle into local hot-update cache for immediate load on Discord restart
            if (typeof globalThis !== "undefined") {
                if (globalThis.__VENCORD_ANDROID_BRIDGE__?.saveBundleUpdate) {
                    await globalThis.__VENCORD_ANDROID_BRIDGE__.saveBundleUpdate(bundleCode, this.latestVersion);
                } else if (globalThis.localStorage) {
                    globalThis.localStorage.setItem("VencordForAndroid_CachedBundle", bundleCode);
                    globalThis.localStorage.setItem("VencordForAndroid_CachedVersion", this.latestVersion);
                }
            }

            Settings.set("version", this.latestVersion);
            this.updateAvailable = false;
            this.status = "up-to-date";

            return {
                success: true,
                installedVersion: this.latestVersion
            };
        } catch (err) {
            this.status = "error";
            this.errorMessage = err?.message || "Update konnte nicht installiert werden";
            return {
                success: false,
                error: this.errorMessage
            };
        }
    }
}

export const Updater = new UpdaterService();
export default Updater;
