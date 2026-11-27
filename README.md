# VencordForAndroid

**VencordForAndroid** ist das In-App-Plugin-System für Discord auf Android. Es wird über die separate Installer-App [**VencordAndroidApp**](https://github.com/juli22292/vencordandroidapp) in Discord installiert.

## Features in Discord
Der Abschnitt **Vencord** verwendet in Discord für Android den vorhandenen Einstellungsrenderer, einschließlich Navigation, Zeilen und Schaltern.

Öffne in Discord dein Profil, tippe auf das Zahnrad und suche **Vencord** zwischen **Accounteinstellungen** und **Rechnungseinstellungen**. Core `0.1.2` bindet den Abschnitt auch in die durchsuchbare Einstellungsübersicht von Discord `355.10` ein. [Installer herunterladen](https://github.com/juli22292/vencordandroidapp/releases/tag/0.1.1)

- **Vencord:** Version, automatische Update-Prüfung und abgesicherter Modus
- **Plugins:** Android-Portierungen in Discord aktivieren, deaktivieren und konfigurieren
- **Updater:** Versionsprüfung und Release-Links. Bei einem privaten Repository ist für den Download eine GitHub-Anmeldung im Browser nötig. Die Installer-App liefert das Core-Bundle mit.
- **Backup & Reset:** Einstellungen sichern oder alle Plugins zurücksetzen

## Plugin-Katalog

Der Katalog enthält auch Definitionen für noch ausstehende Portierungen. Die native Plugin-Seite zeigt die Einträge mit Android-Implementierung.

## Build
```bash
npm ci
npm test
npm run build
```
Erzeugt `dist/vencordforandroid.js` und `dist/manifest.json`.
