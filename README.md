# Stickperson Poser

The Three.js application is the product source of truth for both the browser
and the iPhone/iPad app. Capacitor packages the production Vite build in a
native iOS WKWebView.

## Web Development

```sh
npm install
npm run dev
```

Create the offline production build with:

```sh
npm run build
```

The build output is written to `dist/` and includes Three.js and the required
GLB assets.

## iPhone and iPad

On a Mac with Node.js 22 LTS:

```sh
npm install
npm run ios:sync
npm run ios:open
```

If Node.js is not installed on the Mac, install the project-local toolchain:

```sh
./scripts/setup-mac-node.sh
./scripts/use-project-node.sh npm install
./scripts/use-project-node.sh npm run ios:sync
./scripts/use-project-node.sh npm run ios:open
```

In Xcode, select the development team, choose an iPhone or iPad, and run the
`App` scheme.

The previous SwiftUI and SceneKit implementation remains available for
reference in `legacy/SceneKit-iOS/`. It is not used by the production app.

See `THREEJS_IOS_MIGRATION_PLAN.md` for the migration roadmap.
