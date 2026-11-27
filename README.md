# VencordForAndroid

**VencordForAndroid** ist das In-App-Plugin-System für Discord auf Android. Es wird über die separate Installer-App [**VencordAndroidApp**](https://github.com/juli22292/vencordandroidapp) in Discord installiert.

## Features in Discord
Der Abschnitt **Vencord** verwendet in Discord für Android den vorhandenen Einstellungsrenderer, einschließlich Navigation, Zeilen und Schaltern.

Öffne in Discord dein Profil, tippe auf das Zahnrad und suche **Vencord** zwischen **Accounteinstellungen** und **Rechnungseinstellungen**. Core `0.1.3` verwendet native Discord-Symbole für die vier Einstellungszeilen. [Installer herunterladen](https://github.com/juli22292/vencordandroidapp/releases/tag/0.1.2)

- **Vencord:** Version, automatische Update-Prüfung und abgesicherter Modus
- **Plugins:** Android-Portierungen in Discord aktivieren, deaktivieren und konfigurieren
- **Updater:** Versionsprüfung und Release-Links. Bei einem privaten Repository ist für den Download eine GitHub-Anmeldung im Browser nötig. Die Installer-App liefert das Core-Bundle mit.
- **Backup & Restore:** Einstellungen über die Zwischenablage sichern und wiederherstellen. Ein Zurücksetzen bleibt ebenfalls möglich.

## Plugin-Katalog

Unter **Vencord → Plugins** findest du die Android-Portierungen. Bei verfügbaren Optionen öffnet die Zeile **Einstellungen** die Konfiguration des Plugins.

| Plugin | Verhalten in Android |
| --- | --- |
| ClearURLs | Entfernt Tracking-Parameter aus Links beim Senden und Bearbeiten. Bei fehlender Verbindung zu GitHub greift eine lokale Grundliste. |
| NoReplyMention | Unterdrückt standardmäßige Erwähnungen beim Antworten. Nutzer- und Rollen-IDs können als Ausnahmen konfiguriert werden. |
| SilentTyping | Unterdrückt die Tippanzeige. In den Plugin-Einstellungen lassen sich Kanal-IDs als Ausnahmen hinterlegen. |
| TextReplace | Wendet Text- und Regex-Regeln beim Senden an. Regeln lassen sich in den Plugin-Einstellungen hinzufügen, bearbeiten und löschen. |
| Unindent | Entfernt beim Senden und Bearbeiten die gemeinsame Einrückung aus mehrzeiligen Codeblöcken. |

Diese fünf Portierungen basieren auf dem offiziellen Vencord-Quellcode, Stand `ff5810de`. Der übrige Desktop-Katalog wird nach und nach portiert. [Offizieller Plugin-Quellcode](https://github.com/Vendicated/Vencord/tree/ff5810de5ac334c912321d7528d6d923d28c2db5/src/plugins)

Die Portierungen und das mit ihnen gebündelte Core-Bundle stehen unter GPL-3.0-or-later ([COPYING](COPYING)). Die Apache-2.0-Lizenz für den früheren Projektcode bleibt unter [LICENSE](LICENSE) dokumentiert.

## Build
```bash
npm ci
npm test
npm run build
```
Erzeugt `dist/vencordforandroid.js` und `dist/manifest.json`.
