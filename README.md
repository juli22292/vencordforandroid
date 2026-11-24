# VencordForAndroid

**VencordForAndroid** ist das In-App-Plugin-System für Discord auf Android. Es wird über die separate Installer-App [**VencordAndroidApp**](https://github.com/juli22292/vencordandroidapp) in Discord installiert.

## Features in Discord
Nach der Installation über die `VencordAndroidApp` erscheint in den **Discord-Einstellungen** der neue Bereich **`VencordForAndroid`**:
- **Einstellungen:** Allgemeine Optionen, Auto-Updater, Safe Mode & Entwicklermodus
- **Plugins:** Eigene und integrierte Plugins direkt in Discord per Schalter aktivieren/deaktivieren
- **Updater:** Direkte In-App-Updates aus diesem Repository (`juli22292/vencordforandroid`)
- **Backup & Reset:** Einstellungen sichern oder alle Plugins zurücksetzen

## Integrierte Plugins (v0.0.1)
- `AlwaysAnimate`
- `ClearURLs`
- `FakeNitro`
- `MessageLogger`
- `NoReplyMention`
- `SilentTyping`
- `ShowHiddenChannels`
- `ReadAllNotificationsButton`
- `Translate`
- `BetterTimestamps`

## Build
```bash
npm run build
```
Erzeugt `dist/vencordforandroid.js` und `dist/manifest.json`.
