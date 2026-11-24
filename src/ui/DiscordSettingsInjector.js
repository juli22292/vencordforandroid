/**
 * VencordForAndroid - Discord Settings Injector
 * Injects the "VencordForAndroid" section into Discord's mobile settings menu with paths:
 * - Einstellungen (General Settings)
 * - Plugins (Manage & Toggle Plugins)
 * - Updater (In-App Updates from juli22292/vencordforandroid)
 * - Backup & Reset (Export, Import & Uninstall)
 */

import { Settings } from "../core/Settings.js";
import { PluginManager } from "../core/PluginManager.js";
import { Updater, CORE_VERSION, CORE_REPO } from "../core/Updater.js";
import { Patcher } from "../core/Patcher.js";

export class DiscordSettingsInjector {
    constructor() {
        this.activeModalTab = "plugins";
        this.searchQuery = "";
        this.filterMode = "all"; // all | enabled | disabled
    }

    init() {
        this._patchReactNativeSettings();
        if (typeof document !== "undefined") {
            this._injectWebAndHybridSettingsUI();
        }
    }

    /**
     * Hooks into Discord Android React Native SettingsOverviewScreen sections
     */
    _patchReactNativeSettings() {
        try {
            const SettingsOverview = Patcher.findByName("SettingsOverviewScreen") || Patcher.findByProps("useOverviewSettings");
            if (SettingsOverview && typeof SettingsOverview.useOverviewSettings === "function") {
                Patcher.after("VencordSettingsInjector", SettingsOverview, "useOverviewSettings", (_args, sections) => {
                    if (!Array.isArray(sections)) return sections;
                    if (sections.some((s) => s?.title === "VencordForAndroid")) return sections;

                    const vencordSection = {
                        title: "VencordForAndroid",
                        settings: [
                            "VENCORD_FOR_ANDROID_SETTINGS",
                            "VENCORD_FOR_ANDROID_PLUGINS",
                            "VENCORD_FOR_ANDROID_UPDATER",
                            "VENCORD_FOR_ANDROID_BACKUP"
                        ]
                    };
                    return [vencordSection, ...sections];
                });
            }
        } catch (err) {
            console.warn("[VencordForAndroid] React Native settings hook skipped:", err);
        }
    }

    /**
     * Injects the VencordForAndroid section into Discord Settings & provides a full interactive Settings/Plugins drawer
     */
    _injectWebAndHybridSettingsUI() {
        if (document.getElementById("vencordforandroid-styles")) return;

        const style = document.createElement("style");
        style.id = "vencordforandroid-styles";
        style.textContent = `
            .vfa-overlay {
                position: fixed;
                inset: 0;
                background: rgba(0, 0, 0, 0.72);
                z-index: 999999;
                display: flex;
                flex-direction: column;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                color: #f2f3f5;
            }
            .vfa-sheet {
                background: #1e1f22;
                width: 100%;
                height: 100%;
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }
            .vfa-header {
                background: #2b2d31;
                padding: 16px 18px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                border-bottom: 1px solid #3f4147;
            }
            .vfa-header-title {
                display: flex;
                align-items: center;
                gap: 10px;
                font-size: 18px;
                font-weight: 700;
                color: #ffffff;
            }
            .vfa-badge {
                background: #5865f2;
                color: #fff;
                font-size: 11px;
                padding: 2px 8px;
                border-radius: 999px;
                font-weight: 600;
            }
            .vfa-tabs {
                display: flex;
                background: #232428;
                border-bottom: 1px solid #3f4147;
                overflow-x: auto;
            }
            .vfa-tab {
                padding: 13px 16px;
                font-size: 14px;
                font-weight: 600;
                color: #b5bac1;
                background: transparent;
                border: none;
                border-bottom: 2px solid transparent;
                cursor: pointer;
                white-space: nowrap;
            }
            .vfa-tab.active {
                color: #ffffff;
                border-bottom-color: #5865f2;
            }
            .vfa-body {
                flex: 1;
                overflow-y: auto;
                padding: 16px;
            }
            .vfa-card {
                background: #2b2d31;
                border: 1px solid #3f4147;
                border-radius: 12px;
                padding: 14px 16px;
                margin-bottom: 12px;
            }
            .vfa-plugin-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 6px;
            }
            .vfa-plugin-name {
                font-size: 15px;
                font-weight: 700;
                color: #ffffff;
            }
            .vfa-plugin-desc {
                font-size: 13px;
                color: #b5bac1;
                line-height: 1.4;
            }
            .vfa-switch {
                position: relative;
                width: 46px;
                height: 26px;
                background: #4e5058;
                border-radius: 999px;
                border: none;
                cursor: pointer;
                transition: background 0.2s;
            }
            .vfa-switch.on {
                background: #23a55a;
            }
            .vfa-switch::after {
                content: "";
                position: absolute;
                top: 3px;
                left: 3px;
                width: 20px;
                height: 20px;
                background: #ffffff;
                border-radius: 50%;
                transition: transform 0.2s;
            }
            .vfa-switch.on::after {
                transform: translateX(20px);
            }
            .vfa-btn {
                background: #5865f2;
                color: #ffffff;
                border: none;
                border-radius: 8px;
                padding: 10px 16px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
            }
            .vfa-btn.danger {
                background: #da373c;
            }
            .vfa-btn.secondary {
                background: #4e5058;
            }
            .vfa-search {
                width: 100%;
                box-sizing: border-box;
                background: #111214;
                border: 1px solid #3f4147;
                color: #fff;
                padding: 11px 14px;
                border-radius: 8px;
                margin-bottom: 14px;
                font-size: 14px;
            }
        `;
        document.head.appendChild(style);

        // Observe Discord settings sidebar / list and inject the "VencordForAndroid" section automatically
        const observer = new MutationObserver(() => {
            this._tryInjectSettingsSidebarSection();
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    _tryInjectSettingsSidebarSection() {
        if (document.getElementById("vfa-discord-settings-section")) return;
        const navList = document.querySelector('[role="tablist"], [aria-label*="Settings"], [class*="sidebar"]');
        if (!navList) return;

        const section = document.createElement("div");
        section.id = "vfa-discord-settings-section";
        section.style.cssText = "padding: 8px 10px; margin-top: 8px; border-top: 1px solid rgba(255,255,255,0.08);";

        const header = document.createElement("div");
        header.textContent = "VencordForAndroid";
        header.style.cssText = "font-size: 12px; font-weight: 700; text-transform: uppercase; color: #949ba4; padding: 6px 10px;";
        section.appendChild(header);

        const items = [
            { id: "settings", label: "Einstellungen" },
            { id: "plugins", label: "Plugins" },
            { id: "updater", label: "Updater" },
            { id: "backup", label: "Backup & Reset" }
        ];

        for (const item of items) {
            const row = document.createElement("div");
            row.textContent = item.label;
            row.style.cssText = "padding: 8px 10px; border-radius: 6px; color: #dbdee1; font-size: 15px; font-weight: 500; cursor: pointer;";
            row.addEventListener("click", () => this.openSettingsModal(item.id));
            section.appendChild(row);
        }

        navList.appendChild(section);
    }

    openSettingsModal(initialTab = "plugins") {
        this.activeModalTab = initialTab;
        if (typeof document === "undefined") return;

        let overlay = document.getElementById("vfa-settings-overlay");
        if (!overlay) {
            overlay = document.createElement("div");
            overlay.id = "vfa-settings-overlay";
            overlay.className = "vfa-overlay";
            document.body.appendChild(overlay);
        }
        this._renderModalContent(overlay);
    }

    closeSettingsModal() {
        const overlay = document.getElementById("vfa-settings-overlay");
        if (overlay) overlay.remove();
    }

    _renderModalContent(overlay) {
        const plugins = PluginManager.getAllPlugins();
        const enabledCount = plugins.filter((p) => p.enabled).length;

        overlay.innerHTML = `
            <div class="vfa-sheet">
                <div class="vfa-header">
                    <div class="vfa-header-title">
                        <span>VencordForAndroid</span>
                        <span class="vfa-badge">v${CORE_VERSION}</span>
                    </div>
                    <button class="vfa-btn secondary" id="vfa-close-btn">Schließen</button>
                </div>
                <div class="vfa-tabs">
                    <button class="vfa-tab ${this.activeModalTab === "settings" ? "active" : ""}" data-tab="settings">Einstellungen</button>
                    <button class="vfa-tab ${this.activeModalTab === "plugins" ? "active" : ""}" data-tab="plugins">Plugins (${enabledCount}/${plugins.length})</button>
                    <button class="vfa-tab ${this.activeModalTab === "updater" ? "active" : ""}" data-tab="updater">Updater</button>
                    <button class="vfa-tab ${this.activeModalTab === "backup" ? "active" : ""}" data-tab="backup">Backup & Reset</button>
                </div>
                <div class="vfa-body" id="vfa-tab-body"></div>
            </div>
        `;

        overlay.querySelector("#vfa-close-btn").addEventListener("click", () => this.closeSettingsModal());
        overlay.querySelectorAll(".vfa-tab").forEach((btn) => {
            btn.addEventListener("click", () => {
                this.activeModalTab = btn.getAttribute("data-tab");
                this._renderModalContent(overlay);
            });
        });

        const body = overlay.querySelector("#vfa-tab-body");
        if (this.activeModalTab === "plugins") {
            this._renderPluginsTab(body, overlay);
        } else if (this.activeModalTab === "settings") {
            this._renderGeneralSettingsTab(body, overlay);
        } else if (this.activeModalTab === "updater") {
            this._renderUpdaterTab(body, overlay);
        } else if (this.activeModalTab === "backup") {
            this._renderBackupTab(body, overlay);
        }
    }

    _renderPluginsTab(container, overlay) {
        const allPlugins = PluginManager.getAllPlugins().filter((p) => {
            if (!this.searchQuery) return true;
            const q = this.searchQuery.toLowerCase();
            return p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
        });

        container.innerHTML = `
            <input type="text" class="vfa-search" id="vfa-plugin-search" placeholder="Plugins durchsuchen..." value="${this.searchQuery}" />
            <div id="vfa-plugin-list"></div>
        `;

        const searchInput = container.querySelector("#vfa-plugin-search");
        searchInput.addEventListener("input", (e) => {
            this.searchQuery = e.target.value;
            this._renderPluginsTab(container, overlay);
            const input = container.querySelector("#vfa-plugin-search");
            input.focus();
            input.setSelectionRange(input.value.length, input.value.length);
        });

        const list = container.querySelector("#vfa-plugin-list");
        for (const plugin of allPlugins) {
            const card = document.createElement("div");
            card.className = "vfa-card";
            card.innerHTML = `
                <div class="vfa-plugin-header">
                    <div>
                        <div class="vfa-plugin-name">${plugin.name}</div>
                        <div style="font-size: 11px; color: #949ba4;">von ${plugin.authors.map((a) => a.name).join(", ")} • v${plugin.version}</div>
                    </div>
                    <button class="vfa-switch ${plugin.enabled ? "on" : ""}" data-plugin="${plugin.name}"></button>
                </div>
                <div class="vfa-plugin-desc">${plugin.description}</div>
            `;
            card.querySelector(".vfa-switch").addEventListener("click", () => {
                PluginManager.togglePlugin(plugin.name);
                this._renderModalContent(overlay);
            });
            list.appendChild(card);
        }
    }

    _renderGeneralSettingsTab(container, overlay) {
        const autoUpdate = Settings.get("autoUpdateCheck");
        const safeMode = Settings.get("safeMode");
        const devMode = Settings.get("developerMode");

        container.innerHTML = `
            <div class="vfa-card">
                <div class="vfa-plugin-header">
                    <div>
                        <div class="vfa-plugin-name">Automatisch nach Updates suchen</div>
                        <div class="vfa-plugin-desc">Prüft beim Start von Discord im Repository ${CORE_REPO} auf neue Plugin- und Core-Updates.</div>
                    </div>
                    <button class="vfa-switch ${autoUpdate ? "on" : ""}" id="vfa-toggle-autoupdate"></button>
                </div>
            </div>
            <div class="vfa-card">
                <div class="vfa-plugin-header">
                    <div>
                        <div class="vfa-plugin-name">Abgesicherter Modus (Safe Mode)</div>
                        <div class="vfa-plugin-desc">Startet VencordForAndroid temporär ohne zusätzliche Plugins, falls ein Plugin Probleme verursacht.</div>
                    </div>
                    <button class="vfa-switch ${safeMode ? "on" : ""}" id="vfa-toggle-safemode"></button>
                </div>
            </div>
            <div class="vfa-card">
                <div class="vfa-plugin-header">
                    <div>
                        <div class="vfa-plugin-name">Entwicklermodus</div>
                        <div class="vfa-plugin-desc">Aktiviert erweiterte Protokolle und den Modul-Inspektor in Discord.</div>
                    </div>
                    <button class="vfa-switch ${devMode ? "on" : ""}" id="vfa-toggle-devmode"></button>
                </div>
            </div>
            <div class="vfa-card">
                <div class="vfa-plugin-name">VencordForAndroid Info</div>
                <div class="vfa-plugin-desc" style="margin-top:6px;">
                    Version: <b>${CORE_VERSION}</b><br/>
                    Plugin-Repository: <b>https://github.com/${CORE_REPO}</b><br/>
                    Installer-App: <b>VencordAndroidApp</b>
                </div>
            </div>
        `;

        container.querySelector("#vfa-toggle-autoupdate").addEventListener("click", () => {
            Settings.set("autoUpdateCheck", !autoUpdate);
            this._renderModalContent(overlay);
        });
        container.querySelector("#vfa-toggle-safemode").addEventListener("click", () => {
            Settings.set("safeMode", !safeMode);
            this._renderModalContent(overlay);
        });
        container.querySelector("#vfa-toggle-devmode").addEventListener("click", () => {
            Settings.set("developerMode", !devMode);
            this._renderModalContent(overlay);
        });
    }

    _renderUpdaterTab(container, overlay) {
        container.innerHTML = `
            <div class="vfa-card">
                <div class="vfa-plugin-name">VencordForAndroid In-App Updater</div>
                <div class="vfa-plugin-desc" style="margin-top: 6px;">
                    Installierte Version: <b>v${CORE_VERSION}</b><br/>
                    Neueste Version: <b>v${Updater.latestVersion}</b><br/>
                    Quelle: <b>github.com/${CORE_REPO}</b>
                </div>
                <div style="margin-top: 14px; display: flex; gap: 10px;">
                    <button class="vfa-btn" id="vfa-check-update-btn">Auf Updates prüfen</button>
                    ${Updater.updateAvailable ? `<button class="vfa-btn" style="background:#23a55a;" id="vfa-install-update-btn">Update jetzt installieren</button>` : ""}
                </div>
                <div id="vfa-updater-status" style="margin-top: 10px; font-size: 13px; color: #b5bac1;">
                    ${Updater.status === "up-to-date" ? "VencordForAndroid und alle Plugins sind auf dem neuesten Stand." : ""}
                    ${Updater.status === "update-available" ? `Neues Update v${Updater.latestVersion} verfügbar!` : ""}
                    ${Updater.errorMessage ? `Fehler: ${Updater.errorMessage}` : ""}
                </div>
            </div>
        `;

        container.querySelector("#vfa-check-update-btn").addEventListener("click", async () => {
            const statusEl = container.querySelector("#vfa-updater-status");
            statusEl.textContent = "Suche nach Updates auf GitHub...";
            await Updater.checkForUpdates();
            this._renderModalContent(overlay);
        });

        const installBtn = container.querySelector("#vfa-install-update-btn");
        if (installBtn) {
            installBtn.addEventListener("click", async () => {
                installBtn.disabled = true;
                installBtn.textContent = "Installiere Update...";
                await Updater.downloadAndApplyUpdate();
                this._renderModalContent(overlay);
            });
        }
    }

    _renderBackupTab(container, overlay) {
        container.innerHTML = `
            <div class="vfa-card">
                <div class="vfa-plugin-name">Plugins & Einstellungen zurücksetzen</div>
                <div class="vfa-plugin-desc" style="margin-top: 6px;">
                    Setzt alle aktivierten Plugins und Einstellungen von VencordForAndroid auf die Standardwerte zurück.
                </div>
                <div style="margin-top: 12px;">
                    <button class="vfa-btn danger" id="vfa-reset-all-btn">Alle Plugins zurücksetzen</button>
                </div>
            </div>
        `;

        container.querySelector("#vfa-reset-all-btn").addEventListener("click", () => {
            PluginManager.stopAll();
            Settings.wipeAll();
            PluginManager.startAllEnabled();
            this._renderModalContent(overlay);
        });
    }
}

export const SettingsInjector = new DiscordSettingsInjector();
export default SettingsInjector;
