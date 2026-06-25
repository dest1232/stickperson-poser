# Three.js to iPhone and iPad Migration Plan

## Objective

Ship the current Three.js Stickperson Poser on iPhone and iPad with the same
rendering, materials, controls, posing behavior, IK, painting, and interface as
the working web version.

The Three.js application will remain the product source of truth. The iOS app
will package that application instead of reimplementing its 3D behavior in
SceneKit.

## Recommended Direction

Replace the active SwiftUI and SceneKit port with a Capacitor iOS container
using WKWebView.

Capacitor will package the production web build in an Xcode project. Swift will
be used only for native device features such as:

- File storage and export.
- The iOS Share Sheet.
- Haptic feedback.
- App lifecycle integration.
- Future pose submission and background uploads.

Three.js will continue to own:

- Model and baseplate loading.
- Rendering and lighting.
- Camera controls.
- Rig handles.
- Rotation and translation manipulators.
- Hips and ankle IK.
- Pose state and undo.
- Part colors and paint picking.
- Responsive viewport UI.

## Target Architecture

```text
Three.js source
    |
    v
Vite production build
    |
    v
Capacitor iOS project
    |
    +-- WKWebView: rendering, posing, controls, UI
    |
    +-- Native plugins: files, sharing, haptics, submission
```

The browser and iOS builds must execute the same JavaScript and CSS and load
the same GLB assets.

## Phase 1: Create a Self-Contained Web Build

1. Add Vite as the build system.
2. Install Three.js through npm.
3. Replace the external `unpkg.com` import map with bundled imports.
4. Convert absolute asset paths to build-safe URLs.
5. Configure `npm run dev` for local iteration.
6. Configure `npm run build` to produce `dist/`.
7. Include these assets in the build:
   - `stickman_parts.glb`
   - `default_baseplate.glb`
   - CSS, JavaScript, icons, and other required resources
8. Verify that `dist/` works without internet access.

The installed iOS app must not depend on downloading Three.js or core assets at
runtime.

## Phase 2: Preserve the SceneKit Work as Legacy

Before replacing the native implementation:

1. Tag or branch the current SceneKit version.
2. Optionally move it to a clearly named legacy directory.
3. Keep it available for reference until the Capacitor version reaches parity.

The active iOS app should no longer require:

- GLB-to-USDZ conversion.
- Duplicate Swift IK logic.
- Duplicate Swift rig hierarchy.
- Duplicate Swift lighting and materials.
- Manual synchronization between JavaScript and SceneKit.

## Phase 3: Add Capacitor

Install and initialize Capacitor:

```sh
npm install @capacitor/core @capacitor/ios
npm install --save-dev @capacitor/cli vite
npx cap init
npx cap add ios
```

Configure Capacitor with:

```ts
webDir: "dist"
```

Add package scripts similar to:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "ios:sync": "npm run build && npx cap sync ios",
    "ios:open": "npx cap open ios"
  }
}
```

The normal iOS synchronization path becomes:

```sh
npm install
npm run ios:sync
npm run ios:open
```

## Phase 4: Make the Existing UI Device-Native

Preserve the current visual design while adding mobile-specific behavior:

- Respect all iOS safe-area insets.
- Prevent page scrolling, text selection, callouts, and rubber-band overscroll.
- Preserve the camera and pose when the device rotates.
- Support pointer input from touch, mouse, trackpad, and Apple Pencil.
- Increase invisible touch hit areas without enlarging the visible controls.
- Keep one-finger handle manipulation predictable.
- Define deliberate orbit and zoom gestures that do not conflict with handles.
- Prevent painting during camera gestures.
- Restore the WebGL context after interruption or memory pressure.
- Cap renderer pixel ratio to maintain performance and battery life.
- Preserve unsaved state when the app backgrounds.

## Phase 5: Add a Shared Platform Adapter

Create one interface used by the Three.js app:

```js
AppPlatform.savePose(pose)
AppPlatform.loadPose()
AppPlatform.exportPose(packageData)
AppPlatform.shareFiles(files)
AppPlatform.haptic(type)
AppPlatform.submitPose(packageData)
AppPlatform.setUnsavedChanges(value)
```

The browser implementation should use web APIs and local storage. The iOS
implementation should use Capacitor plugins or small custom Swift plugins.

This keeps platform checks out of the rig and rendering code.

## Phase 6: Native iOS Features

Add native integrations incrementally:

### Filesystem

- Save pose JSON and preview images locally.
- Store pending submission packages.
- Recover unsaved poses after interruption.

### Share Sheet

- Share pose JSON.
- Share preview images.
- Later share complete pose packages.

### Haptics

- Handle selection.
- Tool mode changes.
- Save and reset.
- Snap or constrained movement feedback.

### App Lifecycle

- Autosave before suspension.
- Restore after process termination.
- Warn before discarding an unsaved pose when appropriate.

### Submission

- Integrate the future workflow in `GOOGLE_SUBMISSION_PLAN.md`.
- Upload through a native background-capable service.
- Keep Google credentials on the backend, never in the app.

## Phase 7: Parity Testing

Do not retire the SceneKit build until the Capacitor build passes the following
comparison tests.

### Visual Parity

- Background and lighting.
- Default camera framing.
- Default pose and part colors.
- Model and baseplate dimensions.
- Grid and shadows.
- Handle sizes, colors, and disabled states.
- Rotation and translation manipulators.

### Functional Parity

- Joint rotation.
- Hips translation.
- Ankle translation and leg IK.
- Anchored feet behavior.
- Undo.
- New Pose and Reset.
- Save and Load.
- Mesh, skeleton, grid, and baseplate toggles.
- Individual part painting.
- Camera orbit and zoom.

### Device Coverage

- Small iPhone portrait.
- Large iPhone portrait.
- iPhone landscape.
- iPad portrait.
- iPad landscape.
- Apple Pencil when available.
- Offline launch.
- Background and foreground restoration.
- Device rotation during an active pose.

Use matching screenshots from the web build and iOS build as a visual parity
gate.

## App Store Readiness

The application must feel like a real creative tool rather than a remote
website:

- Bundle all core functionality and assets for offline use.
- Include native file export and sharing.
- Add native haptics and state restoration.
- Include the future submission workflow.
- Provide a complete app icon, launch experience, privacy policy, and support
  URL.
- Document the native features clearly in App Review notes.

## MacBook Setup

After pulling the repository:

```sh
git clone https://github.com/dest1232/stickperson-poser.git
cd stickperson-poser
npm install
npm run build
npx cap sync ios
npx cap open ios
```

In Xcode:

1. Set the development team.
2. Confirm the bundle identifier.
3. Select a simulator or connected iPhone/iPad.
4. Run the app.
5. Test with airplane mode enabled.
6. Test portrait and landscape.
7. Archive through Product > Archive when ready.

Before selecting the Capacitor major version, confirm the installed Xcode and
macOS versions meet its requirements. Pin a compatible Capacitor release if
the MacBook cannot run the newest required Xcode.

## Ongoing Windows-to-Mac Workflow

### Windows

```powershell
git pull
npm install
npm run dev
```

After testing:

```powershell
git add .
git commit -m "Update poser"
git push
```

### MacBook

```sh
git pull
npm install
npm run ios:sync
npm run ios:open
```

There should be no USDZ conversion and no manual JavaScript-to-Swift port.

## Success Criteria

The migration is complete when:

- Web and iOS use the same JavaScript, CSS, and GLB assets.
- A given pose produces the same result in both builds.
- All current web features work on iPhone and iPad.
- The app launches and works offline.
- Windows changes reach Xcode through one build-and-sync command.
- Swift contains native integrations, not duplicated 3D or posing logic.
- The legacy SceneKit app is no longer required for production.
