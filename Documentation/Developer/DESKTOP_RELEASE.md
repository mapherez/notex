# Windows and macOS desktop releases

The release pipeline targets Windows x86_64 and macOS Apple Silicon (M1 and
newer). Intel Macs are not supported. macOS uses ad hoc code signing, without
Developer ID, notarization or a paid Apple Developer account. This does not
remove Gatekeeper's first-launch warning. Install the DMG into Applications and
use **System Settings → Privacy & Security → Open Anyway** when needed.

Apple code signing and the Tauri updater signature serve different purposes.
Both platforms still require the existing Tauri private key, and
`src-tauri/tauri.conf.json` retains its current updater public key. Do not rotate
the key to add macOS: existing Windows installations must continue verifying
updates. The macOS overlay `tauri.macos-release.conf.json` keeps the production
identifier `com.mapherez.notex`, enables updater artefacts and sets
`bundle.macOS.signingIdentity` to `-`.

Official references: [Tauri macOS signing](https://v2.tauri.app/distribute/sign/macos/),
[Tauri updater](https://v2.tauri.app/plugin/updater/) and
[Apple's opening instructions](https://support.apple.com/en-us/102445).

## Pipeline and secrets

`.github/workflows/release.yml` is manually dispatched. Its Windows and macOS
build jobs have `contents: read`, do not persist checkout credentials and never
invoke the publisher. macOS is pinned to `macos-15` with Node 24 and the explicit
`aarch64-apple-darwin` target. It logs and validates `uname -m`, `rustc -vV`, the
Rust host and installed target. Rust caches are separated by OS/target. Both
jobs use the existing npm build wrapper and run frontend, contract, release
and Rust tests. Credential-store tests use fakes, without interacting with the
runner's real Keychain.

Build secrets remain:

- `TAURI_SIGNING_PRIVATE_KEY` and its existing `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.
- Existing Google OAuth secrets: `GOOGLE_WEB_CLIENT_ID`,
  `GOOGLE_DESKTOP_CLIENT_ID`, `GOOGLE_DESKTOP_CLIENT_SECRET`, `GOOGLE_WEB_ORIGIN`.

No Apple certificate, Apple API key, Apple account or notarization secrets are
used. `verify-macos-release.sh` checks ARM64, production bundle ID, version and
valid ad hoc code signatures, both in the app bundle and in the extracted
updater archive. It requires the DMG and updater `.sig` to be present.

The single final `publish` job requires both builds to succeed. Only this job
has `contents: write` and passes `GITHUB_TOKEN` to the publisher. It downloads
the two platform artefacts, validates them without API calls, saves the
combined `latest.json` as an Actions artefact, then publishes.

The separate `.github/workflows/macos-validation.yml` remains unchanged and
read-only. Its identifier is `com.mapherez.notex.validation`; it needs neither
the Tauri signing key nor publishing credentials and disables updater artefacts
and automatic update checks.

## Artefacts and publication

Each build collects artefacts with an explicit platform and Rust target. Names
do not determine architecture. The internal `artifact-manifest.json` records
version, commit, target, existing updater public key and SHA-256 of each file.
The final publisher requires both manifests to match the selected version,
workflow commit and public key, and rejects missing signatures, mixed versions,
unexpected files and altered artefacts.

| Public asset | Purpose |
| --- | --- |
| `NoteX-windows-x86_64-setup.exe` and `.sig` | Windows installer and updater payload |
| `NoteX-windows-x86_64.msi` and `.sig` | Windows MSI installer |
| `NoteX-macos-arm64.dmg` | Apple Silicon installation |
| `NoteX-macos-arm64.app.tar.gz` and `.sig` | Apple Silicon updater payload |
| `latest.json` | One manifest with `windows-x86_64` and `darwin-aarch64` |

The publisher creates a draft, uploads all assets with `latest.json` last, and
only then publishes. An upload failure leaves a draft rather than a partially
published release. A retry can replace expected assets in that draft; unexpected
draft assets cause a failure. Already published releases are never modified.
Choose a new version/tag when an existing tag is public. Drafts and prereleases
are not marked latest.

Local preparation can be inspected without GitHub API calls after downloading
and extracting both platform artefacts into:

```text
output/release/windows-x86_64/
output/release/darwin-aarch64/
```

Each directory must contain the collected files and `artifact-manifest.json`.
From the matching checkout:

```bash
npm run test:release
npm run release:tauri -- --dry-run --repo mapherez/notex
```

The output is `output/release-metadata/latest.json`. This is a local dry run,
even when a token exists in the environment. GitHub publishing is a separate
operation. The prepared public Mac download URL becomes valid only after the
first combined public release; deploy website changes after that release.

## Required real update test on an Apple Silicon Mac

Status: **not yet performed**. The earlier 2.4.1 validation DMG smoke test did
not exercise the updater. A successful signature check in CI does not establish
that macOS will relaunch an updated ad hoc app without another approval prompt.
Record actual Gatekeeper and Keychain behavior during this test.

Both test versions must use the production identifier `com.mapherez.notex` and
the existing Tauri updater key. The `.validation` app cannot be version A: its
updater is disabled and its local files are stored separately. Installing the
production app does not migrate that validation library automatically. Export
the validation workspace or restore the Google backup in the production app
when needed; no note-format migration is required.

1. Prepare versions A and B with B greater than A (for example 2.5.0 and 2.5.1).
   Publish B as a non-draft prerelease using the combined workflow, with a
   dedicated tag such as `v2.5.1-updater-test`. A prerelease keeps the existing
   public latest release unchanged. This requires a separate, deliberate
   workflow dispatch; it is not performed by these local changes.
2. Build A locally on the Mac, using its version's checkout, existing Google
   configuration and the existing Tauri updater private key/password. Create
   `output/updater-test-a.json` with the following overlay, changing the version
   and B tag to match the chosen test:

   ```json
   {
     "version": "2.5.0",
     "bundle": {
       "createUpdaterArtifacts": true,
       "macOS": { "signingIdentity": "-", "hardenedRuntime": true }
     },
     "plugins": {
       "updater": {
         "endpoints": ["https://github.com/mapherez/notex/releases/download/v2.5.1-updater-test/latest.json"]
       }
     }
   }
   ```

   ```bash
   npm ci
   rustup target add aarch64-apple-darwin
   npm run tauri:build -- --target aarch64-apple-darwin --bundles app,dmg --config output/updater-test-a.json --ci -- --locked
   ```

3. Install A's DMG into Applications, approve its first launch if needed, and
   record the version. Keep an independent workspace export before testing.
   Create offline notes and attachments, sign into Google and confirm backup.
   Record note IDs/content and attachment contents before updating.
4. In Profile, check for updates, install B through the app's updater and let
   NoteX relaunch. Record any macOS approval or Keychain prompts, confirm that
   the app now reports B and verify it is the app in Applications.
5. Confirm notes, search, account selection/login, attachments and imports/
   exports survived. Reopen offline, then reconnect and verify a Drive backup
   appears on another device. Check local MCP and native window controls.
6. Record exact macOS version/build, machine, A/B versions and commits, B's
   workflow run, updater result and any prompts. B's normal build restores the
   normal public updater endpoint. Repeat the check on Windows before treating
   the combined release as validated.

Do not mark the update test passed until the actual installation and relaunch
preserve the library and account on the Mac. Remaining targeted smoke checks
are tracked in [macOS validation](MACOS_VALIDATION.md).
