/**
 * VencordForAndroid - Official Vencord Settings UI in Discord Settings (v0.0.3)
 * Replicates the exact official Vencord Settings section inside Discord Settings:
 * - Vencord (Einstellungen)
 * - Plugins (with Plugin Management box, Manage plugin UI elements, Search + Show All + Filter by Tags, 2-column grid, Cog wheel / Info icon & Blurple checkmark toggle)
 * - Themes
 * - Updater
 * - Cloud
 * - Backup & Restore
 */

import { Settings } from "../core/Settings.js";
import { PluginManager } from "../core/PluginManager.js";
import { Updater, CORE_VERSION, CORE_REPO } from "../core/Updater.js";
import { Patcher } from "../core/Patcher.js";

const SVG_ICONS = {
    vencord: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>`,
    plugins: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20.5 11H19V7c0-1.1-.9-2-2-2h-4V3.5C13 2.12 11.88 1 10.5 1S8 2.12 8 3.5V5H4c-1.1 0-1.99.9-1.99 2v3.8H3.5c1.49 0 2.7 1.21 2.7 2.7s-1.21 2.7-2.7 2.7H2V20c0 1.1.9 2 2 2h3.8v-1.5c0-1.49 1.21-2.7 2.7-2.7 1.49 0 2.7 1.21 2.7 2.7V22H17c1.1 0 2-.9 2-2v-4h1.5c1.38 0 2.5-1.12 2.5-2.5S21.88 11 20.5 11z"/></svg>`,
    themes: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 9 6.5 9 8 9.67 8 10.5 7.33 12 6.5 12zm3-4C8.67 8 8 7.33 8 6.5S8.67 5 9.5 5s1.5.67 1.5 1.5S10.33 8 9.5 8zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 5 14.5 5s1.5.67 1.5 1.5S15.33 8 14.5 8zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 9 17.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>`,
    updater: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>`,
    cloud: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/></svg>`,
    backup: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>`,
    cog: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>`,
    info: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>`,
    check: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5865f2" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    cross: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#72767d" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    chevronRight: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`,
    close: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    sidebar: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`
};

export class DiscordSettingsInjector {
    constructor() {
        this.activeModalTab = "plugins"; // vencord | plugins | themes | updater | cloud | backup
        this.searchQuery = "";
        this.filterMode = "all"; // all | enabled | disabled
        this.tagFilter = "all";
        this.sidebarOpenMobile = false;
        this.activePluginModal = null;
        this.uiElementsModalOpen = false;
    }

    init() {
        this._patchReactNativeSettings();
        if (typeof document !== "undefined") {
            this._injectStylesAndObserver();
        }
    }

    _patchReactNativeSettings() {
        try {
            const SettingsOverview = Patcher.findByName("SettingsOverviewScreen") || Patcher.findByProps("useOverviewSettings");
            if (SettingsOverview && typeof SettingsOverview.useOverviewSettings === "function") {
                Patcher.after("VencordSettingsInjector", SettingsOverview, "useOverviewSettings", (_args, sections) => {
                    if (!Array.isArray(sections)) return sections;
                    if (sections.some((s) => s?.title === "Vencord Settings" || s?.title === "VencordForAndroid")) return sections;

                    const vencordSection = {
                        title: "Vencord Settings",
                        settings: [
                            "VENCORD_SETTINGS_MAIN",
                            "VENCORD_SETTINGS_PLUGINS",
                            "VENCORD_SETTINGS_THEMES",
                            "VENCORD_SETTINGS_UPDATER",
                            "VENCORD_SETTINGS_CLOUD",
                            "VENCORD_SETTINGS_BACKUP"
                        ]
                    };
                    // Insert right before Billing / Nitro section if found, else after Account section
                    const billingIdx = sections.findIndex((s) =>
                        String(s?.title || "").toLowerCase().includes("billing") ||
                        String(s?.title || "").toLowerCase().includes("zahlung")
                    );
                    if (billingIdx > 0) {
                        const copy = [...sections];
                        copy.splice(billingIdx, 0, vencordSection);
                        return copy;
                    }
                    return [sections[0], vencordSection, ...sections.slice(1)];
                });
            }
        } catch (err) {
            console.warn("[VencordForAndroid] React Native settings hook skipped:", err);
        }
    }

    _injectStylesAndObserver() {
        if (document.getElementById("vencordforandroid-styles")) return;

        const style = document.createElement("style");
        style.id = "vencordforandroid-styles";
        style.textContent = `
            .vfa-overlay {
                position: fixed;
                inset: 0;
                background: #313338;
                z-index: 999999;
                display: flex;
                font-family: "gg sans", "Noto Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                color: #f2f3f5;
                user-select: none;
            }
            .vfa-layout {
                display: flex;
                width: 100%;
                height: 100%;
                overflow: hidden;
            }
            /* Left Discord Settings Sidebar (1:1 like Screenshot) */
            .vfa-sidebar {
                width: 240px;
                min-width: 240px;
                background: #2b2d31;
                display: flex;
                flex-direction: column;
                padding: 16px 8px 16px 14px;
                overflow-y: auto;
                border-right: 1px solid rgba(255, 255, 255, 0.04);
            }
            .vfa-sidebar-profile {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 6px 8px 14px 8px;
            }
            .vfa-avatar {
                width: 40px;
                height: 40px;
                border-radius: 50%;
                background: linear-gradient(135deg, #5865f2, #eb459e);
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: 800;
                font-size: 16px;
                color: #fff;
            }
            .vfa-profile-name {
                font-size: 15px;
                font-weight: 700;
                color: #f2f3f5;
            }
            .vfa-profile-sub {
                font-size: 12px;
                color: #949ba4;
            }
            .vfa-sidebar-search {
                background: #1e1f22;
                border: none;
                border-radius: 4px;
                color: #dbdee1;
                padding: 7px 10px;
                font-size: 13px;
                margin: 0 6px 12px 6px;
            }
            .vfa-nav-cat {
                font-size: 12px;
                font-weight: 700;
                color: #949ba4;
                padding: 12px 10px 4px 10px;
            }
            .vfa-nav-sep {
                height: 1px;
                background: #3f4147;
                margin: 8px 10px;
            }
            .vfa-nav-item {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 7px 10px;
                margin: 1px 4px;
                border-radius: 4px;
                font-size: 14px;
                font-weight: 500;
                color: #b5bac1;
                cursor: pointer;
                transition: background 0.12s, color 0.12s;
            }
            .vfa-nav-item:hover {
                background: #35373c;
                color: #dbdee1;
            }
            .vfa-nav-item.active {
                background: #404249;
                color: #ffffff;
            }
            .vfa-nav-item.muted {
                opacity: 0.75;
            }
            /* Right Main Content Area */
            .vfa-content-wrap {
                flex: 1;
                background: #313338;
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }
            .vfa-topbar {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 18px 24px 14px 24px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.04);
            }
            .vfa-topbar-left {
                display: flex;
                align-items: center;
                gap: 12px;
            }
            .vfa-mobile-menu-btn {
                display: none;
                background: #2b2d31;
                border: 1px solid #3f4147;
                color: #dbdee1;
                border-radius: 6px;
                padding: 6px 8px;
                cursor: pointer;
            }
            .vfa-page-title {
                font-size: 20px;
                font-weight: 700;
                color: #f2f3f5;
                margin: 0;
            }
            .vfa-close-circle {
                background: transparent;
                border: 2px solid #b5bac1;
                color: #b5bac1;
                width: 34px;
                height: 34px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
            }
            .vfa-close-circle:hover {
                color: #fff;
                border-color: #fff;
            }
            .vfa-scroll-area {
                flex: 1;
                overflow-y: auto;
                padding: 20px 24px 60px 24px;
                max-width: 820px;
                width: 100%;
                margin: 0 auto;
            }
            /* Vencord Info Boxes (Plugin Management & Manage UI elements) */
            .vfa-info-box {
                background: #2b2d31;
                border: 1px solid #3f4147;
                border-radius: 8px;
                padding: 16px 18px;
                margin-bottom: 14px;
            }
            .vfa-info-box.clickable {
                display: flex;
                align-items: center;
                justify-content: space-between;
                cursor: pointer;
                transition: background 0.15s;
            }
            .vfa-info-box.clickable:hover {
                background: #35373c;
            }
            .vfa-box-title {
                font-size: 16px;
                font-weight: 700;
                color: #f2f3f5;
                margin-bottom: 4px;
            }
            .vfa-box-sub {
                font-size: 13px;
                color: #b5bac1;
                line-height: 1.45;
            }
            /* Filters Section */
            .vfa-section-heading {
                font-size: 16px;
                font-weight: 700;
                color: #f2f3f5;
                margin: 22px 0 10px 0;
            }
            .vfa-search-input {
                width: 100%;
                box-sizing: border-box;
                background: #1e1f22;
                border: 1px solid #111214;
                border-radius: 6px;
                color: #dbdee1;
                padding: 10px 12px;
                font-size: 14px;
                margin-bottom: 10px;
                outline: none;
            }
            .vfa-search-input:focus {
                border-color: #5865f2;
            }
            .vfa-filter-row {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 10px;
                margin-bottom: 16px;
            }
            .vfa-select {
                width: 100%;
                background: #1e1f22;
                border: 1px solid #111214;
                border-radius: 6px;
                color: #dbdee1;
                padding: 10px 12px;
                font-size: 14px;
                outline: none;
                cursor: pointer;
            }
            /* 2-Column Official Vencord Plugins Grid */
            .vfa-plugins-grid {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 12px;
            }
            @media (max-width: 640px) {
                .vfa-plugins-grid {
                    grid-template-columns: 1fr;
                }
                .vfa-sidebar {
                    position: absolute;
                    left: 0;
                    top: 0;
                    bottom: 0;
                    z-index: 20;
                    transform: translateX(-100%);
                    transition: transform 0.2s ease;
                    box-shadow: 4px 0 20px rgba(0, 0, 0, 0.6);
                }
                .vfa-sidebar.mobile-open {
                    transform: translateX(0);
                }
                .vfa-mobile-menu-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .vfa-scroll-area {
                    padding: 14px 16px 60px 16px;
                }
                .vfa-topbar {
                    padding: 14px 16px;
                }
            }
            .vfa-plugin-card {
                background: #2b2d31;
                border: 1px solid rgba(255, 255, 255, 0.05);
                border-radius: 8px;
                padding: 14px 16px;
                display: flex;
                flex-direction: column;
                justify-content: flex-start;
                min-height: 92px;
            }
            .vfa-plugin-top {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
                margin-bottom: 8px;
            }
            .vfa-plugin-title {
                font-size: 15px;
                font-weight: 700;
                color: #f2f3f5;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            .vfa-plugin-controls {
                display: flex;
                align-items: center;
                gap: 10px;
                flex-shrink: 0;
            }
            .vfa-icon-btn {
                background: transparent;
                border: none;
                color: #b5bac1;
                padding: 2px;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                transition: color 0.15s;
            }
            .vfa-icon-btn:hover {
                color: #ffffff;
            }
            /* Official Vencord / Discord Toggle Switch with Checkmark / Cross */
            .vfa-toggle {
                position: relative;
                width: 40px;
                height: 24px;
                background: #72767d;
                border-radius: 14px;
                border: none;
                cursor: pointer;
                padding: 0;
                transition: background 0.18s ease;
                display: flex;
                align-items: center;
            }
            .vfa-toggle.checked {
                background: #5865f2;
            }
            .vfa-toggle:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            .vfa-toggle-knob {
                position: absolute;
                top: 3px;
                left: 3px;
                width: 18px;
                height: 18px;
                background: #ffffff;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: transform 0.18s ease;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
            }
            .vfa-toggle.checked .vfa-toggle-knob {
                transform: translateX(16px);
            }
            .vfa-plugin-desc {
                font-size: 13px;
                color: #b5bac1;
                line-height: 1.4;
            }
            /* Plugin Settings / Info Sub-Modal */
            .vfa-modal-backdrop {
                position: fixed;
                inset: 0;
                background: rgba(0, 0, 0, 0.72);
                z-index: 1000001;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 16px;
            }
            .vfa-modal-dialog {
                background: #313338;
                border: 1px solid #3f4147;
                border-radius: 10px;
                max-width: 500px;
                width: 100%;
                max-height: 85vh;
                display: flex;
                flex-direction: column;
                overflow: hidden;
                box-shadow: 0 12px 32px rgba(0, 0, 0, 0.6);
            }
            .vfa-modal-head {
                padding: 16px 20px;
                background: #2b2d31;
                display: flex;
                align-items: center;
                justify-content: space-between;
                border-bottom: 1px solid #3f4147;
            }
            .vfa-modal-body {
                padding: 18px 20px;
                overflow-y: auto;
            }
            .vfa-btn {
                background: #5865f2;
                color: #ffffff;
                border: none;
                border-radius: 4px;
                padding: 10px 16px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
            }
            .vfa-btn.green { background: #248046; }
            .vfa-btn.danger { background: #da373c; }
            .vfa-btn.secondary { background: #4e5058; }
        `;
        document.head.appendChild(style);

        const observer = new MutationObserver(() => {
            this._tryInjectSettingsSidebarSection();
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    /**
     * Injects the "Vencord Settings" section directly into Discord's settings sidebar
     */
    _tryInjectSettingsSidebarSection() {
        if (document.getElementById("vfa-discord-settings-section")) return;
        const navList = document.querySelector('[role="tablist"], [aria-label*="Settings"], [class*="sidebar"]');
        if (!navList) return;

        const section = document.createElement("div");
        section.id = "vfa-discord-settings-section";
        section.style.cssText = "padding: 6px 0; margin-top: 6px; border-top: 1px solid #3f4147;";

        const header = document.createElement("div");
        header.textContent = "Vencord Settings";
        header.style.cssText = "font-size: 12px; font-weight: 700; color: #949ba4; padding: 6px 10px;";
        section.appendChild(header);

        const items = [
            { id: "vencord", label: "Vencord", icon: SVG_ICONS.vencord },
            { id: "plugins", label: "Plugins", icon: SVG_ICONS.plugins },
            { id: "themes", label: "Themes", icon: SVG_ICONS.themes },
            { id: "updater", label: "Updater", icon: SVG_ICONS.updater },
            { id: "cloud", label: "Cloud", icon: SVG_ICONS.cloud },
            { id: "backup", label: "Backup & Restore", icon: SVG_ICONS.backup }
        ];

        for (const item of items) {
            const row = document.createElement("div");
            row.style.cssText = "display:flex;align-items:center;gap:10px;padding:7px 10px;border-radius:4px;color:#b5bac1;font-size:14px;font-weight:500;cursor:pointer;";
            row.innerHTML = `${item.icon}<span>${item.label}</span>`;
            row.addEventListener("click", () => this.openSettingsModal(item.id));
            section.appendChild(row);
        }

        navList.appendChild(section);
    }

    openSettingsModal(initialTab = "plugins") {
        if (initialTab === "settings") initialTab = "vencord";
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
        if (typeof globalThis !== "undefined" && globalThis.__VENCORD_ANDROID_BRIDGE__?.closeOverlay) {
            try {
                globalThis.__VENCORD_ANDROID_BRIDGE__.closeOverlay();
            } catch (_) {}
        }
    }

    _getTabTitle(tab) {
        const titles = {
            vencord: "Vencord",
            plugins: "Plugins",
            themes: "Themes",
            updater: "Updater",
            cloud: "Cloud",
            backup: "Backup & Restore"
        };
        return titles[tab] || "Plugins";
    }

    _renderModalContent(overlay) {
        const vencordItems = [
            { id: "vencord", label: "Vencord", icon: SVG_ICONS.vencord },
            { id: "plugins", label: "Plugins", icon: SVG_ICONS.plugins },
            { id: "themes", label: "Themes", icon: SVG_ICONS.themes },
            { id: "updater", label: "Updater", icon: SVG_ICONS.updater },
            { id: "cloud", label: "Cloud", icon: SVG_ICONS.cloud },
            { id: "backup", label: "Backup & Restore", icon: SVG_ICONS.backup }
        ];

        overlay.innerHTML = `
            <div class="vfa-layout">
                <!-- Left Discord Settings Sidebar matching screenshot -->
                <div class="vfa-sidebar ${this.sidebarOpenMobile ? "mobile-open" : ""}" id="vfa-sidebar">
                    <div class="vfa-sidebar-profile">
                        <div class="vfa-avatar">V</div>
                        <div>
                            <div class="vfa-profile-name">Discord Android</div>
                            <div class="vfa-profile-sub">Profile bearbeiten ✎</div>
                        </div>
                    </div>
                    <input type="text" class="vfa-sidebar-search" placeholder="🔍 Suche" id="vfa-sidebar-quick-search" />

                    <div class="vfa-nav-item muted" data-close-native="1">👤 <span>Account</span></div>
                    <div class="vfa-nav-item muted" data-close-native="1">🛡️ <span>Daten &amp; Privatsphäre</span></div>
                    <div class="vfa-nav-item muted" data-close-native="1">💬 <span>Berechtigungen für Nachrichten</span></div>
                    <div class="vfa-nav-item muted" data-close-native="1">🔔 <span>Benachrichtigungen</span></div>

                    <div class="vfa-nav-sep"></div>
                    <div class="vfa-nav-cat">Vencord Settings</div>
                    ${vencordItems.map((item) => `
                        <div class="vfa-nav-item ${this.activeModalTab === item.id ? "active" : ""}" data-tab="${item.id}">
                            ${item.icon}
                            <span>${item.label}</span>
                        </div>
                    `).join("")}

                    <div class="vfa-nav-sep"></div>
                    <div class="vfa-nav-cat">Zahlungsabwicklung</div>
                    <div class="vfa-nav-item muted" data-close-native="1">💎 <span>Nitro</span></div>
                    <div class="vfa-nav-item muted" data-close-native="1">🚀 <span>Server-Boost</span></div>
                    <div class="vfa-nav-item muted" data-close-native="1">🔄 <span>Abonnements</span></div>
                    <div class="vfa-nav-item muted" data-close-native="1">🎁 <span>Geschenkinventar</span></div>
                    <div class="vfa-nav-item muted" data-close-native="1">💳 <span>Zahlungsabwicklung</span></div>
                </div>

                <!-- Main Settings Page Content -->
                <div class="vfa-content-wrap">
                    <div class="vfa-topbar">
                        <div class="vfa-topbar-left">
                            <button class="vfa-mobile-menu-btn" id="vfa-mobile-menu-toggle" title="Discord Einstellungen Seitenleiste">
                                ${SVG_ICONS.sidebar}
                            </button>
                            <h1 class="vfa-page-title">${this._getTabTitle(this.activeModalTab)}</h1>
                        </div>
                        <button class="vfa-close-circle" id="vfa-close-btn" title="Schließen">
                            ${SVG_ICONS.close}
                        </button>
                    </div>
                    <div class="vfa-scroll-area" id="vfa-tab-body"></div>
                </div>
            </div>
        `;

        overlay.querySelector("#vfa-close-btn").addEventListener("click", () => this.closeSettingsModal());
        overlay.querySelector("#vfa-mobile-menu-toggle").addEventListener("click", () => {
            this.sidebarOpenMobile = !this.sidebarOpenMobile;
            const sb = overlay.querySelector("#vfa-sidebar");
            if (sb) sb.classList.toggle("mobile-open", this.sidebarOpenMobile);
        });

        overlay.querySelectorAll(".vfa-nav-item[data-tab]").forEach((el) => {
            el.addEventListener("click", () => {
                this.activeModalTab = el.getAttribute("data-tab");
                this.sidebarOpenMobile = false;
                this._renderModalContent(overlay);
            });
        });

        overlay.querySelectorAll(".vfa-nav-item[data-close-native]").forEach((el) => {
            el.addEventListener("click", () => this.closeSettingsModal());
        });

        const body = overlay.querySelector("#vfa-tab-body");
        if (this.activeModalTab === "plugins") {
            this._renderPluginsTab(body, overlay);
        } else if (this.activeModalTab === "vencord") {
            this._renderVencordTab(body, overlay);
        } else if (this.activeModalTab === "themes") {
            this._renderThemesTab(body, overlay);
        } else if (this.activeModalTab === "updater") {
            this._renderUpdaterTab(body, overlay);
        } else if (this.activeModalTab === "cloud") {
            this._renderCloudTab(body, overlay);
        } else if (this.activeModalTab === "backup") {
            this._renderBackupTab(body, overlay);
        }

        if (this.activePluginModal) {
            this._renderPluginDetailModal(overlay, this.activePluginModal);
        }
        if (this.uiElementsModalOpen) {
            this._renderUiElementsModal(overlay);
        }
    }

    _renderPluginsTab(container, overlay) {
        const allTags = ["Appearance", "Chat", "Friends", "Guilds", "Media", "Messages", "Notifications", "Privacy", "Shortcuts", "Utility", "Voice"];

        container.innerHTML = `
            <!-- 1. Plugin Management Info Card (1:1 like Screenshot) -->
            <div class="vfa-info-box">
                <div class="vfa-box-title">Plugin Management</div>
                <div class="vfa-box-sub">
                    Press the cog wheel or info icon to get more info on a plugin<br/>
                    Plugins with a cog wheel have settings you can modify!
                </div>
            </div>

            <!-- 2. Manage plugin UI elements Card (1:1 like Screenshot) -->
            <div class="vfa-info-box clickable" id="vfa-manage-ui-elements">
                <div>
                    <div class="vfa-box-title">Manage plugin UI elements</div>
                    <div class="vfa-box-sub">Allows you to hide buttons you don't like</div>
                </div>
                <div style="color:#b5bac1;">${SVG_ICONS.chevronRight}</div>
            </div>

            <!-- 3. Filters Section (1:1 like Screenshot) -->
            <div class="vfa-section-heading">Filters</div>
            <input type="text" class="vfa-search-input" id="vfa-plugin-search" placeholder="Search for a plugin..." value="${this.searchQuery}" />
            <div class="vfa-filter-row">
                <select class="vfa-select" id="vfa-filter-status">
                    <option value="all" ${this.filterMode === "all" ? "selected" : ""}>Show All</option>
                    <option value="enabled" ${this.filterMode === "enabled" ? "selected" : ""}>Show Enabled</option>
                    <option value="disabled" ${this.filterMode === "disabled" ? "selected" : ""}>Show Disabled</option>
                </select>
                <select class="vfa-select" id="vfa-filter-tags">
                    <option value="all" ${this.tagFilter === "all" ? "selected" : ""}>Filter by Tags</option>
                    ${allTags.map((t) => `<option value="${t}" ${this.tagFilter === t ? "selected" : ""}>${t}</option>`).join("")}
                </select>
            </div>

            <!-- 4. Plugins 2-Column Grid -->
            <div class="vfa-section-heading">Plugins</div>
            <div class="vfa-plugins-grid" id="vfa-plugin-grid"></div>

            <!-- 5. Required Plugins Grid -->
            <div class="vfa-section-heading" style="margin-top:28px;">Required Plugins</div>
            <div class="vfa-plugins-grid" id="vfa-required-plugin-grid"></div>
        `;

        container.querySelector("#vfa-manage-ui-elements").addEventListener("click", () => {
            this.uiElementsModalOpen = true;
            this._renderModalContent(overlay);
        });

        const searchInput = container.querySelector("#vfa-plugin-search");
        searchInput.addEventListener("input", (e) => {
            this.searchQuery = e.target.value;
            this._populatePluginCards(container, overlay);
        });

        container.querySelector("#vfa-filter-status").addEventListener("change", (e) => {
            this.filterMode = e.target.value;
            this._populatePluginCards(container, overlay);
        });

        container.querySelector("#vfa-filter-tags").addEventListener("change", (e) => {
            this.tagFilter = e.target.value;
            this._populatePluginCards(container, overlay);
        });

        this._populatePluginCards(container, overlay);
    }

    _populatePluginCards(container, overlay) {
        const all = PluginManager.getAllPlugins().filter((p) => {
            if (this.searchQuery) {
                const q = this.searchQuery.toLowerCase();
                if (!p.name.toLowerCase().includes(q) && !p.description.toLowerCase().includes(q)) {
                    return false;
                }
            }
            if (this.filterMode === "enabled" && !p.enabled) return false;
            if (this.filterMode === "disabled" && p.enabled) return false;
            if (this.tagFilter !== "all" && !(p.tags || []).includes(this.tagFilter)) return false;
            return true;
        });

        const regularPlugins = all.filter((p) => !p.required);
        const requiredPlugins = all.filter((p) => p.required);

        const grid = container.querySelector("#vfa-plugin-grid");
        const reqGrid = container.querySelector("#vfa-required-plugin-grid");
        grid.innerHTML = "";
        reqGrid.innerHTML = "";

        const createCard = (plugin) => {
            const card = document.createElement("div");
            card.className = "vfa-plugin-card";
            const iconSvg = plugin.hasSettings ? SVG_ICONS.cog : SVG_ICONS.info;
            const knobIcon = plugin.enabled ? SVG_ICONS.check : SVG_ICONS.cross;

            card.innerHTML = `
                <div class="vfa-plugin-top">
                    <div class="vfa-plugin-title" title="${plugin.name}">${plugin.name}</div>
                    <div class="vfa-plugin-controls">
                        <button class="vfa-icon-btn" data-info="${plugin.name}" title="${plugin.hasSettings ? "Plugin Settings" : "Plugin Info"}">
                            ${iconSvg}
                        </button>
                        <button class="vfa-toggle ${plugin.enabled ? "checked" : ""}" ${plugin.required ? "disabled" : ""} data-toggle="${plugin.name}">
                            <span class="vfa-toggle-knob">${knobIcon}</span>
                        </button>
                    </div>
                </div>
                <div class="vfa-plugin-desc">${plugin.description}</div>
            `;

            card.querySelector("[data-info]").addEventListener("click", () => {
                this.activePluginModal = plugin.name;
                this._renderModalContent(overlay);
            });

            if (!plugin.required) {
                card.querySelector("[data-toggle]").addEventListener("click", () => {
                    PluginManager.togglePlugin(plugin.name);
                    this._populatePluginCards(container, overlay);
                });
            }
            return card;
        };

        for (const p of regularPlugins) {
            grid.appendChild(createCard(p));
        }
        for (const p of requiredPlugins) {
            reqGrid.appendChild(createCard(p));
        }
    }

    _renderPluginDetailModal(overlay, pluginName) {
        const plugin = PluginManager.getAllPlugins().find((p) => p.name === pluginName);
        if (!plugin) return;

        const backdrop = document.createElement("div");
        backdrop.className = "vfa-modal-backdrop";

        const optionEntries = Object.entries(plugin.options || {});
        const authorsText = (plugin.authors || []).map((a) => a.name).join(", ");
        const tagsText = (plugin.tags || []).join(" • ");

        backdrop.innerHTML = `
            <div class="vfa-modal-dialog">
                <div class="vfa-modal-head">
                    <div>
                        <div style="font-size:18px;font-weight:700;color:#fff;">${plugin.name}</div>
                        <div style="font-size:12px;color:#949ba4;">by ${authorsText} ${tagsText ? `• ${tagsText}` : ""}</div>
                    </div>
                    <button class="vfa-icon-btn" id="vfa-close-plugin-modal">${SVG_ICONS.close}</button>
                </div>
                <div class="vfa-modal-body">
                    <div style="font-size:14px;color:#dbdee1;line-height:1.5;margin-bottom:16px;">
                        ${plugin.description}
                    </div>
                    <div style="font-size:14px;font-weight:700;color:#f2f3f5;margin-bottom:10px;border-top:1px solid #3f4147;padding-top:14px;">
                        ${optionEntries.length > 0 ? "Settings" : "No configurable settings for this plugin."}
                    </div>
                    <div id="vfa-plugin-options-list"></div>
                </div>
            </div>
        `;

        const optsContainer = backdrop.querySelector("#vfa-plugin-options-list");
        for (const [optKey, optDef] of optionEntries) {
            const currentVal = plugin.optionValues[optKey] !== undefined ? plugin.optionValues[optKey] : optDef.default;
            const row = document.createElement("div");
            row.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.05);";

            if (optDef.type === "boolean") {
                const isOn = Boolean(currentVal);
                row.innerHTML = `
                    <div style="font-size:13px;color:#dbdee1;">${optDef.label || optKey}</div>
                    <button class="vfa-toggle ${isOn ? "checked" : ""}">
                        <span class="vfa-toggle-knob">${isOn ? SVG_ICONS.check : SVG_ICONS.cross}</span>
                    </button>
                `;
                row.querySelector(".vfa-toggle").addEventListener("click", () => {
                    Settings.setPluginOption(plugin.name, optKey, !isOn);
                    this._renderModalContent(overlay);
                });
            } else if (optDef.type === "select") {
                row.innerHTML = `
                    <div style="font-size:13px;color:#dbdee1;">${optDef.label || optKey}</div>
                    <select class="vfa-select" style="width:auto;min-width:140px;padding:6px 10px;">
                        ${(optDef.choices || []).map((c) => `<option value="${c}" ${String(currentVal) === String(c) ? "selected" : ""}>${c}</option>`).join("")}
                    </select>
                `;
                row.querySelector("select").addEventListener("change", (e) => {
                    Settings.setPluginOption(plugin.name, optKey, e.target.value);
                });
            }
            optsContainer.appendChild(row);
        }

        backdrop.querySelector("#vfa-close-plugin-modal").addEventListener("click", () => {
            this.activePluginModal = null;
            this._renderModalContent(overlay);
        });
        backdrop.addEventListener("click", (e) => {
            if (e.target === backdrop) {
                this.activePluginModal = null;
                this._renderModalContent(overlay);
            }
        });

        overlay.appendChild(backdrop);
    }

    _renderUiElementsModal(overlay) {
        const uiCfg = Settings.get("uiElements") || { chatBarButtons: true, messagePopoverButtons: true };
        const backdrop = document.createElement("div");
        backdrop.className = "vfa-modal-backdrop";

        backdrop.innerHTML = `
            <div class="vfa-modal-dialog">
                <div class="vfa-modal-head">
                    <div style="font-size:18px;font-weight:700;color:#fff;">Manage plugin UI elements</div>
                    <button class="vfa-icon-btn" id="vfa-close-ui-modal">${SVG_ICONS.close}</button>
                </div>
                <div class="vfa-modal-body">
                    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid #3f4147;">
                        <div>
                            <div style="font-size:14px;font-weight:600;color:#fff;">Chatbar Buttons</div>
                            <div style="font-size:12px;color:#b5bac1;">Show plugin quick-action icons (Translate, SilentTyping, SendTimestamps) in the chat bar</div>
                        </div>
                        <button class="vfa-toggle ${uiCfg.chatBarButtons ? "checked" : ""}" id="vfa-toggle-chatbar">
                            <span class="vfa-toggle-knob">${uiCfg.chatBarButtons ? SVG_ICONS.check : SVG_ICONS.cross}</span>
                        </button>
                    </div>
                    <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 0;">
                        <div>
                            <div style="font-size:14px;font-weight:600;color:#fff;">Message Popover Buttons</div>
                            <div style="font-size:12px;color:#b5bac1;">Show plugin buttons in message long-press and hover menus</div>
                        </div>
                        <button class="vfa-toggle ${uiCfg.messagePopoverButtons ? "checked" : ""}" id="vfa-toggle-popover">
                            <span class="vfa-toggle-knob">${uiCfg.messagePopoverButtons ? SVG_ICONS.check : SVG_ICONS.cross}</span>
                        </button>
                    </div>
                </div>
            </div>
        `;

        backdrop.querySelector("#vfa-toggle-chatbar").addEventListener("click", () => {
            Settings.set("uiElements", { ...uiCfg, chatBarButtons: !uiCfg.chatBarButtons });
            this._renderModalContent(overlay);
        });
        backdrop.querySelector("#vfa-toggle-popover").addEventListener("click", () => {
            Settings.set("uiElements", { ...uiCfg, messagePopoverButtons: !uiCfg.messagePopoverButtons });
            this._renderModalContent(overlay);
        });
        backdrop.querySelector("#vfa-close-ui-modal").addEventListener("click", () => {
            this.uiElementsModalOpen = false;
            this._renderModalContent(overlay);
        });
        overlay.appendChild(backdrop);
    }

    _renderVencordTab(container, overlay) {
        const autoUpdate = Settings.get("autoUpdateCheck");
        const notifyOnUpdates = Settings.get("notifyOnUpdates");
        const safeMode = Settings.get("safeMode");
        const devMode = Settings.get("developerMode");

        container.innerHTML = `
            <div class="vfa-info-box">
                <div class="vfa-box-title">Quick Actions</div>
                <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:12px;">
                    <button class="vfa-btn" id="vfa-qa-quickcss">Open QuickCSS File</button>
                    <button class="vfa-btn secondary" id="vfa-qa-plugins">Manage Plugins</button>
                    <button class="vfa-btn danger" id="vfa-qa-reset">Reset Vencord</button>
                </div>
            </div>

            <div class="vfa-section-heading">Settings</div>
            <div class="vfa-info-box" style="display:flex;flex-direction:column;gap:16px;">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
                    <div>
                        <div class="vfa-box-title" style="font-size:15px;">Automatically check for updates</div>
                        <div class="vfa-box-sub">Checks for new VencordForAndroid &amp; Plugin updates on Discord startup (${CORE_REPO})</div>
                    </div>
                    <button class="vfa-toggle ${autoUpdate ? "checked" : ""}" id="vfa-toggle-autoupdate">
                        <span class="vfa-toggle-knob">${autoUpdate ? SVG_ICONS.check : SVG_ICONS.cross}</span>
                    </button>
                </div>

                <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
                    <div>
                        <div class="vfa-box-title" style="font-size:15px;">Get notified about new updates</div>
                        <div class="vfa-box-sub">Shows an in-app alert whenever a new version is available</div>
                    </div>
                    <button class="vfa-toggle ${notifyOnUpdates ? "checked" : ""}" id="vfa-toggle-notify">
                        <span class="vfa-toggle-knob">${notifyOnUpdates ? SVG_ICONS.check : SVG_ICONS.cross}</span>
                    </button>
                </div>

                <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
                    <div>
                        <div class="vfa-box-title" style="font-size:15px;">Safe Mode (Disable non-required plugins)</div>
                        <div class="vfa-box-sub">Temporarily disables optional plugins for troubleshooting</div>
                    </div>
                    <button class="vfa-toggle ${safeMode ? "checked" : ""}" id="vfa-toggle-safemode">
                        <span class="vfa-toggle-knob">${safeMode ? SVG_ICONS.check : SVG_ICONS.cross}</span>
                    </button>
                </div>

                <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
                    <div>
                        <div class="vfa-box-title" style="font-size:15px;">Enable Developer Tools</div>
                        <div class="vfa-box-sub">Enables React Native / Metro module inspection and debug logging</div>
                    </div>
                    <button class="vfa-toggle ${devMode ? "checked" : ""}" id="vfa-toggle-devmode">
                        <span class="vfa-toggle-knob">${devMode ? SVG_ICONS.check : SVG_ICONS.cross}</span>
                    </button>
                </div>
            </div>
        `;

        container.querySelector("#vfa-qa-quickcss").addEventListener("click", () => {
            this.activeModalTab = "themes";
            this._renderModalContent(overlay);
        });
        container.querySelector("#vfa-qa-plugins").addEventListener("click", () => {
            this.activeModalTab = "plugins";
            this._renderModalContent(overlay);
        });
        container.querySelector("#vfa-qa-reset").addEventListener("click", () => {
            PluginManager.stopAll();
            Settings.wipeAll();
            PluginManager.startAllEnabled();
            this._renderModalContent(overlay);
        });

        container.querySelector("#vfa-toggle-autoupdate").addEventListener("click", () => {
            Settings.set("autoUpdateCheck", !autoUpdate);
            this._renderModalContent(overlay);
        });
        container.querySelector("#vfa-toggle-notify").addEventListener("click", () => {
            Settings.set("notifyOnUpdates", !notifyOnUpdates);
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

    _renderThemesTab(container) {
        const quickCss = Settings.get("quickCss") || "";
        container.innerHTML = `
            <div class="vfa-info-box">
                <div class="vfa-box-title">QuickCSS &amp; Online Themes</div>
                <div class="vfa-box-sub">Paste custom Discord CSS rules or @import links below to style Discord Mobile.</div>
                <textarea id="vfa-quickcss-input" style="width:100%;height:200px;margin-top:12px;background:#1e1f22;color:#dbdee1;border:1px solid #111214;border-radius:6px;padding:12px;font-family:monospace;font-size:13px;" placeholder="/* Custom QuickCSS */">${quickCss}</textarea>
                <div style="margin-top:10px;">
                    <button class="vfa-btn green" id="vfa-save-css">Save QuickCSS</button>
                </div>
            </div>
        `;
        container.querySelector("#vfa-save-css").addEventListener("click", () => {
            const val = container.querySelector("#vfa-quickcss-input").value;
            Settings.set("quickCss", val);
        });
    }

    _renderUpdaterTab(container, overlay) {
        container.innerHTML = `
            <div class="vfa-info-box">
                <div class="vfa-box-title">Repo</div>
                <div class="vfa-box-sub">
                    <a href="https://github.com/${CORE_REPO}" target="_blank" style="color:#00a8fc;text-decoration:none;">https://github.com/${CORE_REPO}</a>
                    (Installed: <b>v${CORE_VERSION}</b> • Latest: <b>v${Updater.latestVersion}</b>)
                </div>
            </div>

            <div class="vfa-info-box">
                <div class="vfa-box-title">Updates</div>
                <div class="vfa-box-sub" id="vfa-updater-status">
                    ${Updater.updateAvailable ? `New update v${Updater.latestVersion} is available!` : "Your VencordForAndroid is up to date!"}
                    ${Updater.errorMessage ? `<br/><span style="color:#da373c;">${Updater.errorMessage}</span>` : ""}
                </div>
                <div style="margin-top:14px;display:flex;gap:10px;">
                    <button class="vfa-btn" id="vfa-check-update-btn">Check for Updates</button>
                    ${Updater.updateAvailable ? `<button class="vfa-btn green" id="vfa-install-update-btn">Update Now</button>` : ""}
                </div>
            </div>
        `;

        container.querySelector("#vfa-check-update-btn").addEventListener("click", async () => {
            const statusEl = container.querySelector("#vfa-updater-status");
            statusEl.textContent = "Checking for updates on GitHub...";
            await Updater.checkForUpdates();
            this._renderModalContent(overlay);
        });

        const installBtn = container.querySelector("#vfa-install-update-btn");
        if (installBtn) {
            installBtn.addEventListener("click", async () => {
                installBtn.disabled = true;
                installBtn.textContent = "Installing Update...";
                await Updater.downloadAndApplyUpdate();
                this._renderModalContent(overlay);
            });
        }
    }

    _renderCloudTab(container) {
        container.innerHTML = `
            <div class="vfa-info-box">
                <div class="vfa-box-title">Vencord Cloud</div>
                <div class="vfa-box-sub">
                    Synchronize your enabled plugins and settings across devices securely.
                </div>
            </div>
        `;
    }

    _renderBackupTab(container, overlay) {
        container.innerHTML = `
            <div class="vfa-info-box">
                <div class="vfa-box-title">Backup &amp; Restore Settings</div>
                <div class="vfa-box-sub">Export your current plugin configuration as JSON or restore from a backup.</div>
                <textarea id="vfa-backup-json" style="width:100%;height:160px;margin-top:12px;background:#1e1f22;color:#dbdee1;border:1px solid #111214;border-radius:6px;padding:10px;font-family:monospace;font-size:12px;">${Settings.exportJSON()}</textarea>
                <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;">
                    <button class="vfa-btn" id="vfa-import-btn">Import Settings JSON</button>
                    <button class="vfa-btn danger" id="vfa-reset-all-btn">Reset All Plugins</button>
                </div>
            </div>
        `;

        container.querySelector("#vfa-import-btn").addEventListener("click", () => {
            try {
                Settings.importJSON(container.querySelector("#vfa-backup-json").value);
                PluginManager.stopAll();
                PluginManager.startAllEnabled();
                this._renderModalContent(overlay);
            } catch (e) {
                alert("Invalid JSON: " + e.message);
            }
        });

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
