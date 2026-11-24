/**
 * VencordForAndroid - In-App Updater & Version Policy Enforcement
 * Checks and installs updates exclusively from https://github.com/juli22292/vencordforandroid
 * Blocks corrupted versions (0.0.1) and forces an immediate update to 0.0.2+.
 */

import { Settings } from "./Settings.js";

export const CORE_VERSION = "0.0.3";
export const MIN_REQUIRED_VERSION = "0.0.2";
export const CORRUPTED_VERSIONS = ["0.0.1"];
export const CORE_REPO = "juli22292/vencordforandroid";
export const INSTALLER_REPO = "juli22292/vencordandroidapp";
export const CORE_RELEASES_API = `https://api.github.com/repos/${CORE_REPO}/releases/latest`;
export const CORE_MANIFEST_URL = `https://raw.githubusercontent.com/${CORE_REPO}/main/dist/manifest.json`;
export const CORE_BUNDLE_URL = `https://raw.githubusercontent.com/${CORE_REPO}/main/dist/vencordforandroid.js`;
export const INSTALLER_LATEST_RELEASE_URL = `https://github.com/${INSTALLER_REPO}/releases/latest`;

class UpdaterService {
    constructor() {
        this.lastCheck = null;
        this.latestVersion = CORE_VERSION;
        this.updateAvailable = false;
        this.forceUpdateRequired = false;
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

    enforceVersionPolicy(hostInstallerVersion) {
        if (hostInstallerVersion && this.isVersionCorrupted(hostInstallerVersion)) {
            this.forceUpdateRequired = true;
            this.renderCorruptedVersionLockScreen(hostInstallerVersion);
            return false;
        }
        return true;
    }

    renderCorruptedVersionLockScreen(detectedVersion = "0.0.1") {
        if (typeof document === "undefined") return;
        let lock = document.getElementById("vfa-corrupted-lock");
        if (!lock) {
            lock = document.createElement("div");
            lock.id = "vfa-corrupted-lock";
            lock.style.cssText = "position:fixed;inset:0;z-index:2147483647;background:#111214;color:#f2f3f5;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;text-align:center;font-family:sans-serif;";
            document.body.appendChild(lock);
        }
        lock.innerHTML = `
            <div style="background:#2b2d31;border:2px solid #da373c;border-radius:14px;padding:24px;max-width:420px;width:100%;">
                <div style="background:#da373c;color:#fff;display:inline-block;padding:4px 12px;border-radius:999px;font-size:12px;font-weight:700;margin-bottom:12px;">
                    VERSION ${detectedVersion} BESCHÄDIGT & GESPERRT
                </div>
                <h2 style="margin:0 0 10px 0;font-size:20px;color:#fff;">Pflicht-Update auf v${CORE_VERSION} erforderlich</h2>
                <p style="font-size:14px;color:#b5bac1;line-height:1.5;margin:0 0 18px 0;">
                    Die installierte Version <b>v${detectedVersion}</b> ist als beschädigt markiert und wurde deaktiviert, da sie sich nicht direkt in die bestehende offizielle Discord-App integriert hat. Bitte aktualisiere jetzt auf <b>v${CORE_VERSION}</b>.
                </p>
                <a href="${INSTALLER_LATEST_RELEASE_URL}" style="display:block;background:#23a55a;color:#fff;text-decoration:none;padding:13px 18px;border-radius:8px;font-weight:700;font-size:15px;">
                    Update v${CORE_VERSION} jetzt herunterladen
                </a>
            </div>
        `;
    }

    async checkForUpdates() {
        this.status = "checking";
        this.errorMessage = null;

        try {
            let remoteVersion = CORE_VERSION;
            let notes = "";
            let bundleUrl = CORE_BUNDLE_URL;

            // Check manifest first for corrupted version policy
            try {
                const manifestRes = await fetch(CORE_MANIFEST_URL, { cache: "no-store" });
                if (manifestRes.ok) {
                    const manifest = await manifestRes.json();
                    if (Array.isArray(manifest.corruptedVersions)) {
                        this.corruptedVersions = manifest.corruptedVersions;
                    }
                    remoteVersion = manifest.version || CORE_VERSION;
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
                notes = releaseData.body || notes || "Neues Update für VencordForAndroid und Plugins verfügbar.";
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
                updateAvailable: this.updateAvailable,
                corruptedVersions: this.corruptedVersions,
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
