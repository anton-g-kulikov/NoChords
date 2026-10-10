#!/usr/bin/env bash
# Builds the native-app and store icons from the mark (ADR-104). Run from the repository root:
#
#   bash assets/build.sh
#
# Every file is the same two brackets as public/icons/icon.svg — the heavy cut, which holds at small
# sizes — placed and coloured for where it goes. SVG sources are written next to their PNGs so the
# drawing can be checked; the PNGs are what Xcode, Android Studio and the stores take.
set -euo pipefail
cd "$(dirname "$0")/.."

OPEN='M162.4 120H250.4L244.2 152H196.2L155.8 360H203.8L197.6 392H109.6Z'
CLOSE='M402.4 120H314.4L308.2 152H356.2L315.8 360H267.8L261.6 392H349.6Z'
INK='#1d1a16'      # the icon's tile
AMBER='#e9a15c'    # the second ink on the night scheme
PAPER='#f4efe6'    # the light page
VERMILION='#b4441f'
NIGHT='#15120e'

# brackets <size> <scale> <fill>: the mark centred on a square canvas, scaled about its middle.
brackets() {
  local size=$1 scale=$2 fill=$3
  echo "<g transform=\"translate($((size / 2)) $((size / 2))) scale($scale) translate(-256 -256)\" fill=\"$fill\"><path d=\"$OPEN\"/><path d=\"$CLOSE\"/></g>"
}

# svg <file> <size> <background or none> <scale> <fill>
svg() {
  local file=$1 size=$2 bg=$3 scale=$4 fill=$5 rect=''
  [ "$bg" != none ] && rect="<rect width=\"$size\" height=\"$size\" fill=\"$bg\"/>"
  echo "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"$size\" height=\"$size\" viewBox=\"0 0 $size $size\">$rect$(brackets "$size" "$scale" "$fill")</svg>" > "$file"
}

# opaque <svg> <png>: no alpha channel at all — App Store Connect rejects an icon that has one, even
# when every pixel is solid.
opaque() { magick -background none "$1" -flatten -alpha off "PNG24:$2"; }
clear() { magick -background none "$1" "PNG32:$2"; }

# The square icon: the tile's ink to the edges, brackets at the same share of it as the web icon
# (icon-apple.svg: 293 of 564, 52%; 292.8 × 1.82 = 533 of 1024). The platforms cut their own corners,
# so it carries none.
svg assets/icon-only.svg 1024 "$INK" 1.82 "$AMBER"
opaque assets/icon-only.svg assets/icon-only.png

# Android's adaptive icon, as two layers. A launcher shows the middle 72 of 108 units and may cut it
# to any shape inside the 66-unit safe circle, so the brackets sit well inside it.
svg assets/icon-foreground.svg 1024 none 1.25 "$AMBER"
clear assets/icon-foreground.svg assets/icon-foreground.png
svg assets/icon-background.svg 1024 "$INK" 1 "$INK"
opaque assets/icon-background.svg assets/icon-background.png
# Android 13's themed icon: one colour, which the system tints.
svg assets/icon-monochrome.svg 1024 none 1.25 '#ffffff'
clear assets/icon-monochrome.svg assets/icon-monochrome.png

# iOS 18's dark and tinted icons: no tile, which the system supplies. Tinted is greyscale, tinted by
# the system; dark keeps the amber.
svg assets/icon-ios-dark.svg 1024 none 1.82 "$AMBER"
clear assets/icon-ios-dark.svg assets/icon-ios-dark.png
svg assets/icon-ios-tinted.svg 1024 none 1.82 '#ffffff'
clear assets/icon-ios-tinted.svg assets/icon-ios-tinted.png

# Splash screens, light and dark, in the app's own page colours: the brackets small in the middle,
# as the app opens onto the library.
svg assets/splash.svg 2732 "$PAPER" 1.67 "$VERMILION"
opaque assets/splash.svg assets/splash.png
svg assets/splash-dark.svg 2732 "$NIGHT" 1.67 "$AMBER"
opaque assets/splash-dark.svg assets/splash-dark.png

# Store listings.
magick assets/icon-only.png -resize 1024x1024 -alpha off PNG24:store/app-store-icon-1024.png
magick assets/icon-only.png -resize 512x512 -alpha off PNG24:store/google-play-icon-512.png

echo "built: $(ls assets/*.png store/*.png | wc -l | tr -d ' ') PNGs"
