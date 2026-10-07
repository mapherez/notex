#!/usr/bin/env bash
set -euo pipefail
: "${NOTEX_RELEASE_TARGET:?}" "${RUNNER_TEMP:?}"
bundle_dir="src-tauri/target/$NOTEX_RELEASE_TARGET/release/bundle"
expected_version="$(node -p 'JSON.parse(require("node:fs").readFileSync("src-tauri/tauri.conf.json", "utf8")).version')"
verify_app() {
  local app="$1"
  test -d "$app"
  test "$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$app/Contents/Info.plist")" = com.mapherez.notex
  test "$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$app/Contents/Info.plist")" = "$expected_version"
  local executable
  executable="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleExecutable' "$app/Contents/Info.plist")"
  file "$app/Contents/MacOS/$executable"
  test "$(lipo -archs "$app/Contents/MacOS/$executable")" = arm64
  codesign --verify --deep --strict --verbose=2 "$app"
  local signing_info
  signing_info="$(codesign -dv --verbose=2 "$app" 2>&1)"
  printf '%s\n' "$signing_info"
  printf '%s\n' "$signing_info" | grep -Fx 'Signature=adhoc'
}
verify_app "$bundle_dir/macos/NoteX.app"
archives=("$bundle_dir"/macos/*.app.tar.gz)
test "${#archives[@]}" = 1
test -f "${archives[0]}"
test -s "${archives[0]}.sig"
archive_check_dir="$(mktemp -d "$RUNNER_TEMP/notex-updater-check.XXXXXX")"
trap 'rm -rf -- "$archive_check_dir"' EXIT
tar -xzf "${archives[0]}" -C "$archive_check_dir"
verify_app "$archive_check_dir/NoteX.app"
dmgs=("$bundle_dir"/dmg/*.dmg)
test "${#dmgs[@]}" = 1
test -s "${dmgs[0]}"
echo 'Verified ARM64 app and updater payload with ad hoc signing. Apple notarization is intentionally not used.'
