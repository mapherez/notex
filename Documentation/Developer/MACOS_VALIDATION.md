# macOS Apple Silicon validation

NoteX's macOS support is initially a validation build, not a public release.
Intel Macs are not included. The Windows release workflow and publisher remain
unchanged until the macOS build and functional smoke test below have passed.

## Isolated CI

`.github/workflows/macos-validation.yml` runs on the pinned `macos-15` ARM64
runner with Node 24 and the explicit `aarch64-apple-darwin` Rust target. It fails
if `uname -m` is not `arm64`, if `rustc -vV` reports a different host, or if the
target is missing. The logs include the Rust host, target configuration, Xcode
version and complete build command. The resulting executable is also checked
with `lipo` to ensure it contains only ARM64.

The workflow has only `contents: read`, does not persist checkout credentials,
does not expose publishing tokens, and never invokes the release publisher or
GitHub Releases API. Results are GitHub Actions artefacts retained for 14 days.
There is no route from this workflow to publishing or modifying a GitHub Release.

`src-tauri/tauri.macos-ci.conf.json` is an explicit build overlay. It disables
updater artefact generation and selects ad hoc signing (`-`), so no Apple
certificate, notarization credentials or Tauri updater signing key are needed.
The normal configuration keeps its existing updater settings.

The validation identifier is `com.mapherez.notex.validation`, which isolates
notes, account selection and attachments from an eventual production install.
The `.app` is archived with `ditto` to preserve bundle metadata; the artefact
also contains the DMG. Both are test builds, not notarized public downloads.

Google OAuth configuration is supplied through the existing Google repository
secrets during the build. These values configure login; they are not publishing
credentials. A fork PR may build without them, but its artefact cannot pass the
Google smoke test. Use a manual run in the main repository with configured
Google secrets for that test. Do not pass an Apple or publishing token.

## Local build on an Apple Silicon Mac

Install Node 24, Rust and Xcode command-line tools. Configure Google OAuth as
described in [Google setup](GOOGLE_DRIVE_SETUP.md), then run from the repo root:

```bash
npm ci
rustup target add aarch64-apple-darwin
uname -m
rustc -vV
rustup target list --installed
npm test
cargo test --locked --manifest-path src-tauri/Cargo.toml --target aarch64-apple-darwin
npm run tauri:build -- --target aarch64-apple-darwin --bundles app,dmg --config src-tauri/tauri.macos-ci.conf.json --ci -- --locked
```

Bundles are under `src-tauri/target/aarch64-apple-darwin/release/bundle/`.
For interactive development use `npm run tauri:dev`, which retains the existing
isolated `.dev` identifier instead of the validation identifier.

## Credential storage and automatic tests

Cargo keeps `keyring` target-specific: `windows-native` for Windows and
`apple-native` for macOS, with default features disabled. Google and the
preserved remote MCP bridge share the Rust `SecretStore` abstraction and native
implementation. Unsupported platforms retain their unavailable-storage behavior.
Local MCP does not require the native credential store.

Automatic tests inject an in-memory fake for credential round trips, missing
entries, account/service isolation, malformed remote credentials and backend
errors. Backend-selection tests inspect the native builder type without creating
an entry. No automatic test reads or writes the runner's real Keychain or
Windows Credential Manager, or requires an OS authorization prompt.

Google and MCP keep their existing credential service/account identifiers.
The validation app's files are isolated, but its Keychain entries can be shared
with development or production builds. Use a dedicated Google test account.

## Functional smoke test — required before public-release integration

Status: **pending an Apple Silicon CI run and real Mac smoke test**.
Record the commit, Actions run URL, macOS version, Mac model, tester and results.
Use a dedicated test account and disposable notes; do not import over an
existing library. Opening an ad hoc test build may require macOS's explicit
Open Anyway action. Do not disable Gatekeeper globally.

- [ ] CI is green, including Rust tests and bundle architecture/signature checks.
- [ ] Install from the DMG, launch, and confirm the installed app's version.
- [ ] Create, edit, search and reopen notes offline; restart and verify content.
- [ ] Google login finishes. Permit Keychain access when requested, quit and
      reopen, and verify authenticated access/refresh and Drive backup.
- [ ] Back up a note and attachment, then recover them using the test account.
- [ ] Attach images and files; verify previews, external opening and save dialogs.
- [ ] Export/import a `.notex-note` package and a disposable `.notex` library.
- [ ] Start local MCP, connect a compatible client, read/write a test note, stop.
- [ ] Check editing/formatting, `⌘` shortcuts, drag, minimize, maximize and close.
- [ ] Confirm the pending-backup close guard and cancellation behavior.
- [ ] Reinstall a newer validation build and confirm local notes/accounts/files
      survive. This is a persistence check, not an automatic-update test.

macOS now uses the normal plugin-process relaunch after an installed update,
without clearing Application Support. Windows still schedules its existing
cleanup helper, guarded against clearing persistent data. These choices are
covered by automatic tests. An actual automatic update must be tested later
with two updater-signed macOS versions; this validation build does not generate
updater artefacts or publish a manifest.

## Gate for phase 3 — public release

Do not change `.github/workflows/release.yml` or invoke the current publisher
for macOS until the build and functional smoke test above pass. Keep unsigned
validation available for PRs independently of release secrets.

After that gate, the remaining public-release work is:

1. Configure Developer ID Application signing and App Store Connect API
   notarization credentials separately from the Tauri updater key.
2. Build Windows and macOS separately and aggregate their artefacts in one final
   publishing job, only after both builds pass.
3. Make platform/architecture identification explicit in the publisher, include
   the DMG, and generate one `latest.json` containing `windows-x86_64` and
   `darwin-aarch64`, keeping the current updater public key.
4. Publish the DMG for installation and `.app.tar.gz` plus `.sig` for updates.
5. Validate a real update between two versions and verify all notes, accounts
   and attachments survive.
6. Add the public Apple Silicon download and macOS support to the landing page,
   README and user documentation only when the public build is ready.

No note-format migration is required.
