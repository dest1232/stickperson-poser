# Stickperson Poser

This repo contains the Windows-friendly web prototype and a native iPhone/iPad app scaffold.

GitHub repo:

```text
https://github.com/dest1232/stickperson-poser
```

## Web Prototype

Run locally on Windows:

```powershell
npm run dev
```

The browser app uses:

- `index.html`
- `src/`
- `public/stickman_default.glb`

## iPhone / iPad App

The native SwiftUI + SceneKit app lives in:

```text
ios/StickpersonPoser/
```

First time on the MacBook:

```sh
git clone https://github.com/dest1232/stickperson-poser.git
cd stickperson-poser
```

After future Windows updates:

```sh
git pull
```

When the GLB changes on Windows, sync it into the iOS project:

```powershell
npm run sync:ios-assets
```

On macOS, convert the synced GLB to USDZ before opening Xcode:

```sh
./scripts/prepare-ios-on-mac.sh
open ios/StickpersonPoser/StickpersonPoser.xcodeproj
```

See `APP_SYNC_WORKFLOW.md` for the full Windows-to-Mac update checklist.
