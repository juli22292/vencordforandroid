/**
 * VencordForAndroid - Mobile Bridge & In-App Updater Integration (v0.0.6)
 * Connects the official Vencord runtime (browser.js) to VencordAndroidApp on Android.
 */
!(() => {
    function injectCss() {
        if (document.getElementById("vencord-for-android-css")) return;
        const cssText = (typeof VencordAndroidNative !== "undefined" && VencordAndroidNative.getVencordCss)
            ? VencordAndroidNative.getVencordCss()
            : "";
        if (!cssText) return;
        const style = document.createElement("style");
        style.id = "vencord-for-android-css";
        style.textContent = cssText;
        (document.head || document.documentElement).appendChild(style);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", injectCss, { once: true });
    } else {
        injectCss();
    }

    function initMobileVencordIntegration() {
        if (typeof Vencord === "undefined" || !Vencord.Webpack || !Vencord.Plugins) {
            setTimeout(initMobileVencordIntegration, 150);
            return;
        }

        try {
            const {
                Webpack: { findLazy, onceReady, Common },
                Components: { Button, Flex, WebsiteIcon, UpdaterIcon, MainSettingsIcon },
                Plugins: {
                    plugins: { Settings: SettingsPlugin }
                }
            } = Vencord;

            const ModalEscapeHandler = findLazy((m) => m.binds?.length === 1 && m.binds[0] === "esc");
            let isSidebarOpen = false;

            function VencordForAndroidUpdaterPanel() {
                const { React } = Common;
                return React.createElement(
                    Flex,
                    { flexDirection: "column", style: { gap: "12px" } },
                    React.createElement(
                        "div",
                        {
                            style: {
                                background: "var(--background-secondary)",
                                border: "1px solid var(--background-modifier-accent)",
                                borderRadius: "8px",
                                padding: "16px",
                                color: "var(--text-normal)"
                            }
                        },
                        React.createElement("h3", { style: { margin: "0 0 6px 0", fontSize: "16px", fontWeight: 700 } }, "VencordForAndroid Updater"),
                        React.createElement(
                            "p",
                            { style: { margin: "0 0 12px 0", fontSize: "13px", color: "var(--text-muted)" } },
                            "Repository: https://github.com/juli22292/vencordforandroid (v0.0.6)"
                        ),
                        React.createElement(
                            Flex,
                            { style: { gap: "10px", flexWrap: "wrap" } },
                            React.createElement(
                                Button,
                                {
                                    onClick: () => {
                                        if (typeof VencordAndroidNative !== "undefined") {
                                            VencordAndroidNative.openVencordUpdater();
                                        }
                                    }
                                },
                                "Nach Updates suchen & installieren"
                            ),
                            React.createElement(
                                Button,
                                {
                                    color: Button.Colors?.PRIMARY,
                                    onClick: () => {
                                        if (typeof VencordAndroidNative !== "undefined") {
                                            VencordAndroidNative.openMobileSettings();
                                        }
                                    }
                                },
                                "Android-Ansicht & Branch"
                            ),
                            React.createElement(
                                Button,
                                {
                                    color: Button.Colors?.PRIMARY,
                                    onClick: () => {
                                        if (typeof VencordAndroidNative !== "undefined") {
                                            VencordAndroidNative.openInstallerGui();
                                        }
                                    }
                                },
                                "VencordAndroidApp Installer öffnen"
                            )
                        )
                    )
                );
            }

            if (SettingsPlugin && Array.isArray(SettingsPlugin.customEntries)) {
                if (!SettingsPlugin.customEntries.some((e) => e.key === "vencord_android_updater")) {
                    SettingsPlugin.customEntries.push({
                        key: "vencord_android_updater",
                        title: "Updater",
                        panelTitle: "VencordForAndroid Updater",
                        Icon: UpdaterIcon || WebsiteIcon || MainSettingsIcon,
                        Component: VencordForAndroidUpdaterPanel
                    });
                }
                if (!SettingsPlugin.customEntries.some((e) => e.key === "vencord_android_mobile")) {
                    SettingsPlugin.customEntries.push({
                        key: "vencord_android_mobile",
                        title: "VencordForAndroid",
                        panelTitle: "VencordForAndroid Einstellungen",
                        Icon: WebsiteIcon || MainSettingsIcon,
                        Component: VencordForAndroidUpdaterPanel
                    });
                }
            }

            onceReady.then(() => {
                const { FluxDispatcher } = Common;
                if (FluxDispatcher) {
                    FluxDispatcher.subscribe("MOBILE_WEB_SIDEBAR_OPEN", () => {
                        isSidebarOpen = true;
                    });
                    FluxDispatcher.subscribe("MOBILE_WEB_SIDEBAR_CLOSE", () => {
                        isSidebarOpen = false;
                    });
                }
            });

            window.VencordMobile = {
                onBackPress() {
                    try {
                        if (ModalEscapeHandler?.action && ModalEscapeHandler.action() === false) {
                            return true;
                        }
                        if (!isSidebarOpen && Common?.FluxDispatcher) {
                            Common.FluxDispatcher.dispatch({ type: "MOBILE_WEB_SIDEBAR_OPEN" });
                            return true;
                        }
                    } catch (_) {}
                    return false;
                }
            };
        } catch (err) {
            console.error("[VencordForAndroid] Mobile integration error:", err);
        }
    }

    initMobileVencordIntegration();
})();
