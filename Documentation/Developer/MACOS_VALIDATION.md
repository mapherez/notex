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

`src-tauri/tauri.macos.conf.json` enables the native macOS title bar and traffic
light controls for development, validation and eventual public macOS builds.
The frontend checks the window's decorated state and uses the custom title bar
only for undecorated windows, retaining the Windows controls and layout. Native
macOS close requests still pass through the existing pending-backup guard.

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

Status: **CI passed; user-reported functional checks passed on a real Mac;
targeted remaining checks and native-title-bar retest pending**.

CI evidence last verified on `main`, commit
`94f48bf5340cb878466ed25bf3b98870ccbf6577`:

- [macOS ARM64 validation](https://github.com/mapherez/notex/actions/runs/37562603363)
  passed Rust tests, bundle architecture/signature checks and artefact upload.
- [Windows desktop CI](https://github.com/mapherez/notex/actions/runs/37562535549)
  passed tests and the desktop release build.

User-reported smoke test on **2026-10-07**, performed by the repository owner on
a **MacBook Air M3**:

- NoteX launched after granting the app-specific Gatekeeper exception.
- NoteX **2.4.1** was installed from the DMG inside the validation workflow ZIP.
- macOS was reported as the latest version; its exact version/build was not
  supplied.
- Google sign-in succeeded, and notes were restored from the Drive backup.
- Notes were edited and backed up; the changes appeared on other devices and
  in the web app.
- Local MCP connected to Codex and successfully edited notes.
- After closing and reopening, notes persisted and Google stayed signed in.
- Attachments, imports/exports, the interface and local MCP were reported as
  working normally.
- Reinstallation of the same version worked. Reinstallation of a newer version
  has not yet been tested.
- The remaining reported UI issue was the Windows-style custom title bar. The
  next build enables the native macOS controls and needs a Mac retest.

The tested artefact's Actions run/commit and exact macOS version/build have not
yet been recorded. Record those details and results for the remaining checks.
Use a dedicated test account and disposable notes; do not import over an
existing library. Opening an ad hoc test build may require macOS's explicit
Open Anyway action. Do not disable Gatekeeper globally.

- [x] CI is green, including Rust tests and bundle architecture/signature checks.
- [x] Launch the validation app after the app-specific Gatekeeper exception.
- [x] Confirm installation from the DMG and record the installed app's version.
- [ ] Create, edit, search and reopen notes offline; restart and verify content.
- [x] Google login finishes and existing notes can be restored from Drive.
- [x] Edit notes and back them up; verify the changes on other devices and web.
- [x] Quit and reopen; verify notes persist and Google remains signed in.
- [ ] Verify authenticated token refresh and Drive backup after reopening.
- [ ] Back up an attachment and recover it alongside its note.
- [x] Attachments work in the installed macOS app (user report).
- [ ] Verify attachment previews, external opening and save dialogs.
- [x] Import/export works in the installed macOS app (user report).
- [x] Connect Codex through local MCP and edit notes.
- [x] Local MCP functionality works normally (user report).
- [x] The interface works as on Windows (user report).
- [ ] Retest the native macOS title bar: drag, minimize, full screen and close,
      including cancelling a close request when backups are pending.
- [ ] Confirm the pending-backup close guard and cancellation behavior.
- [x] Reinstall the same validation version successfully.
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
