# Google Drive & browser mode

Signing in with Google automatically backs up your account library to your
own Drive, on desktop and in the browser. Desktop also works without an
account; browser mode requires Google sign-in.

## Connect Google on desktop

Open **Profile** and choose **Continue with Google** in the local-account card.
NoteX opens your default browser, where you choose an account and grant access
to NoteX's own application data in Google Drive. Return to NoteX when prompted.

Your existing local notes and attachments are incorporated into that account's
local library. Other Google accounts have separate libraries. After signing
out, desktop returns to its local library; account notes remain stored and
become available when you sign back into that account.

## Automatic backups

Backups start automatically after sign-in. There is no separate switch to
enable them for the account library.

Edits are saved locally first. Google Drive backups are grouped: normally after
30 seconds without changes, or after two minutes of pending changes during
continuous editing. Multiple edits to a note update one pending backup.
Opening a note without changing it does not trigger a backup.

The transfer banner appears when there is pending work or an error. Expand it
to see progress and available actions, or collapse it to keep editing. Use
**Back up now** in Profile to start a backup without waiting for the timer.

The cloud control on an individual note lets you exclude that note from backups
or include it again. Pausing library downloads is a separate control: it does
not turn off automatic backups of your edits.

Wait for backups to finish before closing NoteX or switching devices. NoteX
does not prevent simultaneous use on multiple devices; avoid editing the same
library in two places at once. When conflicting changes need a decision,
review the local and cloud choices before selecting which version to keep.

## Continue in the browser

Sign in with the same Google account. NoteX loads the library catalogue first,
then downloads notes and attachments progressively. You can start using notes
as they become available, prioritize notes or collections/tags, and pause or
resume library downloads.

Search may be incomplete while some note contents have not yet downloaded.
Notes you edit in the browser are saved in persistent IndexedDB storage before
being backed up to Drive. The browser does not open your desktop SQLite file
or store its library in your desktop application's data folder.

## Refresh and offline work

The account is remembered, and a valid Drive access token survives refreshes
in the same tab. When the token expires or access is rejected, NoteX offers
**Authorize Google again** and keeps your pending edits.

After the production webapp and required notes have been cached, you can
refresh and continue editing those downloaded notes offline. Backups resume
when the internet connection returns and authorization is valid. A first visit
or a note not yet downloaded needs internet access.

Clearing site data or using a different browser/profile can remove the local
browser library and pending edits. Completed Drive backups can be downloaded
again after login; changes that have not been backed up cannot be recovered
from Drive.

## Sign out and switch accounts

Signing out preserves the account's local notes but removes its active access.
The browser immediately returns to the login screen and does not allow guest
editing. Desktop can continue creating notes in its separate local library.

Sign back into the original account to reopen that library. Signing into a
different account shows only that account's notes.

## Where backups are stored

NoteX uses Google Drive's hidden application-data area. Backups contain a
metadata catalogue plus JSON and attachments for each note, rather than a
copy of the desktop SQLite database. They do not appear as ordinary folders in
the Drive file list. NoteX's host serves the webapp; it does not store your
notes or Google tokens.

Manual desktop [exports](import-export.md) remain available for portable copies
that you can store or share yourself. Read the [Privacy Policy](../privacy.html)
for account and data-handling information.
