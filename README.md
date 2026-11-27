# VencordForAndroid

**VencordForAndroid** ist das In-App-Plugin-System für Discord auf Android. Es wird über die separate Installer-App [**VencordAndroidApp**](https://github.com/juli22292/vencordandroidapp) in Discord installiert.

## Features in Discord
Nach der Installation über die `VencordAndroidApp` erscheint in den **Discord-Einstellungen** der neue Bereich **`VencordForAndroid`**:
- **Einstellungen:** Allgemeine Optionen, Auto-Updater, Safe Mode & Entwicklermodus
- **Plugins:** Eigene und integrierte Plugins direkt in Discord per Schalter aktivieren/deaktivieren
- **Updater:** Versionsprüfung und Release-Links. Bei einem privaten Repository ist für den Download eine GitHub-Anmeldung im Browser nötig. Die Installer-App liefert das Core-Bundle mit.
- **Backup & Reset:** Einstellungen sichern oder alle Plugins zurücksetzen

## Plugin-Katalog

Der Katalog enthält 170 Definitionen. Einträge ohne mobile Implementierung sind als „Noch nicht für Android portiert“ gekennzeichnet.

## Build
```bash
npm run build
```
Erzeugt `dist/vencordforandroid.js` und `dist/manifest.json`.
