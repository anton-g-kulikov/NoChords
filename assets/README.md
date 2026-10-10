# App and store icons

Built from the mark by `bash assets/build.sh` (ImageMagick). Every file is the same two brackets as
`public/icons/icon.svg`, in the heavy cut that holds at small sizes (ADR-074, ADR-104). Edit the
script, not the PNGs.

## Into the native projects

The file names follow [`@capacitor/assets`](https://github.com/ionic-team/capacitor-assets):

```bash
npx @capacitor/assets generate --iconBackgroundColor '#1d1a16' --splashBackgroundColor '#f4efe6' --splashBackgroundColorDark '#15120e'
```

It writes every size into `ios/App/App/Assets.xcassets` and `android/app/src/main/res`. Two files it
does not place, which go in by hand:

| File | Where |
|---|---|
| `icon-ios-dark.png`, `icon-ios-tinted.png` | Xcode → AppIcon → Appearances: Any, Dark, Tinted (iOS 18) |
| `icon-monochrome.png` | Android `ic_launcher.xml`, as `<monochrome>` (Android 13 themed icons) |

| File | What it is |
|---|---|
| `icon-only.png` | The square icon, 1024, opaque: ink tile to the edges, amber brackets at 52% of its width. No corners; each platform cuts its own |
| `icon-foreground.png` + `icon-background.png` | Android's adaptive icon. The brackets stay within the 66-unit safe circle of the 108-unit canvas, so any launcher shape keeps them whole |
| `icon-monochrome.png` | One colour for Android's themed icons |
| `icon-ios-dark.png`, `icon-ios-tinted.png` | iOS 18 dark and tinted icons: no tile, the system supplies the ground |
| `splash.png`, `splash-dark.png` | 2732 launch screens in the app's paper and night colours |

## Store listings (`store/`)

| File | Store | Requirements it meets |
|---|---|---|
| `app-store-icon-1024.png` | App Store Connect | 1024×1024 PNG, sRGB, **no alpha channel** (rejected otherwise, even if opaque), no rounded corners |
| `google-play-icon-512.png` | Google Play Console | 512×512 PNG, sRGB, full square (Play applies its own mask), well under 1 MB |

Google Play also asks for a 1024×500 feature graphic, which is not here yet.
