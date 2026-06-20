# Model Asset

`stickman_default.glb` is included as the source model copied from the web prototype.

For the native SceneKit app, convert it to `stickman_default.usdz` on macOS and place the result in this folder.

```sh
../../../../scripts/prepare-ios-on-mac.sh
```

If your Xcode toolchain does not include `usdz_converter`, open the GLB in Reality Converter, Blender with USD export, or another USDZ-capable tool and export `stickman_default.usdz`.

The checked-in `.usdz` may be a placeholder when edited from Windows. Replace it before running or archiving the iOS app.
