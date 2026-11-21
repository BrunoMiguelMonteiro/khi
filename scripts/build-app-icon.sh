#!/bin/sh
# Compiles the Liquid Glass icon (src-tauri/icons/Khi.icon, made for Icon
# Composer) into src-tauri/icons/Assets.car, which the bundle ships in
# Contents/Resources. Tauri's own .icon support fails under Xcode 27
# (tauri-apps/tauri#16386), so the catalog is precompiled and committed.
# Run again after editing Khi.icon. Needs Xcode 26 or later.
# If actool fails with "Bad file descriptor", a stale ibtoold daemon (often
# left by a tauri build) is to blame: quit it and run this again.
set -eu
cd "$(dirname "$0")/../src-tauri/icons"
out=$(mktemp -d)
trap 'rm -rf "$out"' EXIT
xcrun actool "$PWD/Khi.icon" --compile "$out" --platform macosx \
  --minimum-deployment-target 13.3 --app-icon Khi --include-all-app-icons \
  --output-partial-info-plist "$out/partial.plist" </dev/null
[ -s "$out/Assets.car" ] || { echo "actool produced no Assets.car" >&2; exit 1; }
cp "$out/Assets.car" .Assets.car.new
mv .Assets.car.new Assets.car
echo "Wrote src-tauri/icons/Assets.car"
