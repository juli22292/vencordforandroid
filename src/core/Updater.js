/**
 * VencordForAndroid v0.0.4 - In-App Updater
 * Follows Vendicated/Vencord/src/utils/updater.ts and Vencord/Vendroid/VencordUpdater.java
 * Pulls updates exclusively from https://github.com/juli22292/vencordforandroid
 */

import { CORE_VERSION } from "./Version.js";

export { CORE_VERSION };
export const MIN_REQUIRED_VERSION = "0.0.2";
export const CORRUPTED_VERSIONS = ["0.0.1"];
export const CORE_REPO = "juli22292/vencordforandroid";
export const INSTALLER_REPO = "juli22292/vencordandroidapp";
export const CORE_RELEASES_API = `https://api.github.com/repos/${CORE_REPO}/releases/latest`;
export const CORE_MANIFEST_URL = `https://raw.githubusercontent.com/${CORE_REPO}/main/dist/manifest.json`;
export const CORE_BUNDLE_URL = `https://raw.githubusercontent.com/${CORE_REPO}/main/dist/vencordforandroid.js`;

function parseReleaseVersion(value) {
    const version = typeof value === "string" ? value.trim().replace(/^v/i, "") : "";
    return /^\d+\.\d+\.\d+$/.test(version) ? version : null;
}

async function fetchUpdateMetadata(url) {
    const response = await fetch(url, { cache: "no-store", headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
}

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
        this.downloadUrl = null;
        this.status = "idle";
        this.errorMessage = null;
    }

    get canApplyUpdate() {
        return !!this.downloadUrl && typeof globalThis.__VENCORD_NATIVE_BRIDGE__?.saveBundleUpdate === "function";
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
        if (!parseReleaseVersion(cleanVer)) return false;
        return this.corruptedVersions.includes(cleanVer) || this.compareVersions(cleanVer, MIN_REQUIRED_VERSION) > 0;
    }

    async checkForUpdates() {
        this.status = "checking";
        this.errorMessage = null;

        try {
            const [manifestResult, releaseResult] = await Promise.allSettled([
                fetchUpdateMetadata(CORE_MANIFEST_URL),
                fetchUpdateMetadata(CORE_RELEASES_API)
            ]);
            const manifest = manifestResult.value;
            const release = releaseResult.value;
            const manifestVersion = parseReleaseVersion(manifest?.version);
            const releaseVersion = parseReleaseVersion(release?.tag_name);
            if (!manifestVersion && !releaseVersion) {
                const unavailable = [manifestResult, releaseResult].every((result) => result.reason?.message === "HTTP 404");
                throw new Error(unavailable
                    ? "GitHub-Releases sind ohne Anmeldung nicht zugänglich. Öffne die Releases im Browser."
                    : "Die Update-Informationen konnten nicht geladen werden.");
            }
            if (Array.isArray(manifest?.corruptedVersions)) {
                this.corruptedVersions = manifest.corruptedVersions.filter((version) => parseReleaseVersion(version) === version);
            }

            const useRelease = releaseVersion && (!manifestVersion || this.compareVersions(manifestVersion, releaseVersion) >= 0);
            const remoteVersion = useRelease ? releaseVersion : manifestVersion;
            const releaseAssetUrl = useRelease
                ? `https://github.com/${CORE_REPO}/releases/download/${release.tag_name}/vencordforandroid.js`
                : null;
            const hasReleaseBundle = useRelease && Array.isArray(release.assets)
                && release.assets.some((asset) => asset?.name === "vencordforandroid.js" && asset.browser_download_url === releaseAssetUrl);

            this.lastCheck = new Date().toISOString();
            this.latestVersion = remoteVersion;
            this.latestHash = remoteVersion === manifestVersion && /^[0-9a-f]{64}$/.test(manifest.sha256)
                ? manifest.sha256.slice(0, 7) : "main";
            this.releaseNotes = useRelease ? (release.body || "") : (manifest.changelog || "");
            this.downloadUrl = hasReleaseBundle ? releaseAssetUrl : remoteVersion === manifestVersion ? CORE_BUNDLE_URL : null;
            this.updateAvailable = this.compareVersions(CORE_VERSION, remoteVersion) > 0 && !this.isVersionCorrupted(remoteVersion);
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
            this.updateAvailable = false;
            this.downloadUrl = null;
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
        if (this.status === "downloading") return { success: false };
        this.status = "downloading";
        this.errorMessage = null;
        try {
            if (!this.updateAvailable || !this.canApplyUpdate) {
                throw new Error("Installiere das Update über die aktuelle VencordAndroidApp.");
            }
            const version = this.latestVersion;
            const res = await fetch(this.downloadUrl, { cache: "no-store" });
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }
            const bundleCode = await res.text();

            const applied = await globalThis.__VENCORD_NATIVE_BRIDGE__.saveBundleUpdate(bundleCode, version);
            if (applied === false) {
                throw new Error("Das Update konnte nicht gespeichert werden.");
            }

            this.updateAvailable = false;
            this.hasPendingRestart = true;
            this.status = "restart-required";

            return {
                success: true,
                installedVersion: version
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
