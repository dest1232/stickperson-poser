# Web-to-iOS Sync Workflow

This repo has two deliverables:

- `index.html`, `src/`, `public/`: the Windows-friendly web prototype.
- `ios/StickpersonPoser/`: the native SwiftUI + SceneKit iPhone/iPad app.

The web app remains the fastest place to iterate on rig behavior and visual intent. The iOS app mirrors those decisions in native Swift. Treat the sections below as the handoff checklist whenever the web app changes.

## Source of Truth

- Character asset source: `public/stickman_default.glb`.
- iOS source copy: `ios/StickpersonPoser/StickpersonPoser/Resources/stickman_default.glb`.
- iOS runtime asset: `ios/StickpersonPoser/StickpersonPoser/Resources/stickman_default.usdz`.
- Rig behavior source of truth for product intent: current web app behavior in `src/main.js`.
- Native implementation mirror: `PoseSceneController.swift`, `IKSolver.swift`, `RigTypes.swift`.

## Windows Iteration Loop

1. Update/test the web app on Windows:

   ```powershell
   npm run dev
   ```

2. If the GLB changes, sync it into the iOS project:

   ```powershell
   .\scripts\sync-ios-assets.ps1
   ```

3. If rig behavior changes in `src/main.js`, update the native mirror:

   - handle roles and parenting: `RigTypes.swift` and `PoseSceneController.createHandles()`
   - IK solve behavior: `IKSolver.swift`
   - scene visuals or controls: `PoseSceneController.swift` and `ContentView.swift`

4. Commit and push to GitHub:

   ```powershell
   git add .
   git commit -m "Update stickperson poser"
   git push
   ```

## MacBook Build / Publish Loop

1. First time on the MacBook, clone the repo:

   ```sh
   git clone https://github.com/dest1232/stickperson-poser.git
   cd stickperson-poser
   ```

   On later visits, pull the latest Windows changes:

   ```sh
   cd /path/to/stickperson-poser
   git pull
   ```

2. Convert the synced GLB to USDZ:

   ```sh
   ./scripts/prepare-ios-on-mac.sh
   ```

3. Open:

   ```sh
   open ios/StickpersonPoser/StickpersonPoser.xcodeproj
   ```

4. In Xcode:

   - Choose a development team and bundle identifier.
   - Run on iPhone/iPad simulator or device.
   - Replace the placeholder app icon before App Store/TestFlight submission.
   - Archive from Product > Archive when ready.

## Sync Checklist

After any web change, answer these before publishing native:

- Did the GLB change? Run `sync-ios-assets.ps1` on Windows and `prepare-ios-on-mac.sh` on Mac.
- Did handle names, parent hierarchy, pole vectors, or IK chains change? Mirror in `PoseSceneController.createHandles()`.
- Did IK math change? Mirror in `IKSolver.swift`.
- Did save/load pose shape change? Mirror in `RigTypes.swift` and `PoseStore.swift`.
- Did visual styling change? Mirror lighting/material/UI in `PoseSceneController.swift` and `ContentView.swift`.
- Did mobile UI change? Check iPhone portrait, iPhone landscape, and iPad in Xcode.

## Current Known Native Gap

This Windows workspace cannot generate a real `stickman_default.usdz`. The checked-in USDZ is a placeholder so the Xcode project has a stable file reference. Always replace it on macOS before running the app.
