# Web-to-iOS Sync Workflow

The browser and iPhone/iPad apps now run the same Three.js source, CSS, and GLB
assets. The active iOS project is a Capacitor container in `ios/App/`.

## Windows Iteration

```powershell
git pull
npm install
npm run dev
```

After testing:

```powershell
git add .
git commit -m "Update stickperson poser"
git push
```

No USDZ conversion or separate Swift posing implementation is required.

## Mac iOS Sync

```sh
git pull
npm install
npm run ios:sync
npm run ios:open
```

On this Mac, when using the project-local Node installation:

```sh
./scripts/use-project-node.sh npm install
./scripts/use-project-node.sh npm run ios:sync
./scripts/use-project-node.sh npm run ios:open
```

In Xcode:

1. Select the `App` scheme.
2. Select the development team.
3. Choose an iPhone or iPad.
4. Run the app.

## Verification Checklist

- Run `npm run build`.
- Confirm the model and baseplate load with Wi-Fi disabled.
- Test iPhone portrait and landscape.
- Test iPad portrait and landscape.
- Test posing, IK, painting, camera controls, undo, save, and load.
- Confirm app background/foreground behavior before release.

The previous SwiftUI/SceneKit app and its conversion scripts are preserved in
`legacy/SceneKit-iOS/` for reference only.
