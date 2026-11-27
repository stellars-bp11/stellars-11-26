# STELLARS Firebase Setup — Academic Portal

This guide documents the shared sign-in flow and the separation between the
existing STELLARS Library administrator and the Academic Portal accounts.

## Firebase Authentication

1. Open Firebase Console and select project `class-web-7241e`.
2. Confirm Authentication > Sign-in method has Email/Password enabled.
3. The Academic Portal accounts are provisioned through a trusted local
   Firebase Admin SDK process. Do not commit the service-account JSON file,
   private key, roster, or password list to this repository.
4. The visible login username is the user's full name. The site maps it to an
   internal Firebase email alias:
   - Normalize to lowercase.
   - Remove accents.
   - Replace runs of non-alphanumeric characters with a dot.
   - Append `@class-web-7241e.firebaseapp.com`.

For example, `Student Example` becomes
`student.example@class-web-7241e.firebaseapp.com`.

The shared sign-in dialog is available from the account menu on the main
STELLARS pages. After signing in, Firebase's local browser persistence keeps
the session available when navigating between pages. The Academics page reads
the same signed-in session; it does not have a separate login form.

When a visitor opens Academics while signed out, the page shows an access
prompt. Its sign-in link opens the main STELLARS sign-in dialog and returns to
Academics after successful sign-in.

## Library deletion access

The Library uses the same Firebase Authentication session as the main STELLARS
website. There is no separate Library Admin login.

Delete controls are shown only when the signed-in account has an active
`users/{uid}` profile with:

- `role: "superAdmin"`
- `isActive: true`

The `/memories/{memoryId}` Firestore delete rule independently checks that
same active superAdmin role. This allows the provisioned STELLARS superAdmin
accounts to delete memories without relying on the former Library-only UID.

After changing `firestore.rules`, publish the complete rules in Firebase
Console (Firestore Database > Rules). A GitHub commit alone does not deploy
Firestore Rules.

## Academic Results importer

The Academic admin workspace reads `.xlsx`, `.xls`, and `.csv` files with
SheetJS 0.20.3. It can also extract selectable text from PDF files using
Mozilla PDF.js 6.5.438. Scanned/image-only PDFs are not OCR-processed.

The administrator chooses the worksheet and header row, maps the student name
and NIM columns, and reviews dynamically detected assessment columns. Each
selected worksheet is treated as one subject. The importer matches NIMs against
the protected `nimIndex` collection and requires unmatched or invalid rows to
be corrected or excluded before saving.

The uploaded source file stays in the browser. Import metadata is stored under
`uploads`, while subjects, draft assessments, and draft scores are stored in
their respective collections. A saved draft is not visible to students.
Publishing is available to `superAdmin` accounts and admins whose profile has
`canPublish: true`.

This importer uses the existing Academic collections plus a minimal
`publishedImports/{uploadId}` manifest for student visibility. The manifest is
created only after all score and assessment batches are published, and it is
moved to `withdrawing` before a published import is deleted. The updated
`firestore.rules` must be deployed so student queries can read published
manifests and only their own scores scoped to each source import.

## Firestore data schema

The trusted provisioning process creates:

- `users/{firebaseUid}` — profile with `fullName`, `username`, `nim`,
  `role`, and `isActive`.
- `nimIndex/{nim}` — private mapping containing `uid`, `fullName`, and
  `isActive`.

The document ID in `users` must match the Firebase Authentication UID.

See `ACADEMIC_DATA_SCHEMA.md` for the full schema of subjects, assessments,
scores, uploads, and activity logs.

## Publish Firestore rules

1. Open Firestore Database > Rules in Firebase Console.
2. Confirm the project is `class-web-7241e`.
3. Copy the complete contents of `firestore.rules` from this branch.
4. Review it, especially the retained `/memories` rule, then publish.
5. Test the existing Library public memory list and upload flow.
6. Do not add permissive catch-all rules such as `allow read, write: if true`.

Committing `firestore.rules` to GitHub does not publish rules to Firebase.

## Smoke test

1. Open the main STELLARS website.
2. Open the account menu and use **Sign In**.
3. Sign in using the full-name username and password provided by the
   administrator.
4. Navigate to Academics. Confirm that the page recognizes the existing
   session and displays only the signed-in user's own academic view.
5. Sign out, then open Academics again. Confirm it shows the sign-in prompt
   rather than private results.
6. Use the Academics sign-in link. Confirm it opens the main site's sign-in
   dialog and returns to Academics after successful authentication.
7. Confirm students can only read their own published score records.

Use strong, unique passwords where possible. Initial passwords based on
student identifiers are easier to guess and should be replaced with private
passwords before broad distribution.


## STELLARS Radio — Daily Music Diary

The Radio page uses the same Firebase Authentication session and the existing
`users/{uid}` member profile. Active members can read today's song wall.
Each member's submission is stored at:

`radioDays/{YYYY-MM-DD}/songs/{firebaseUid}`

The Firebase UID is the document ID, which limits each member to one current
entry per Jakarta calendar day. Members can edit their own entry until reset.
Artwork lookup uses the public Apple/iTunes Search API; a member may replace
the result with an uploaded image using the existing Cloudinary
`stellar-library` unsigned upload preset (maximum 5 MB).

### Required Firebase deployment

A GitHub Pages publish does not deploy Firestore Rules or Cloud Functions.
The Radio UI may show a permission error until the updated rules are published.

1. In a terminal at the repository root, install the Firebase CLI if it is not
   already installed, then sign in to the Firebase account that owns
   `class-web-7241e`.
2. Run `npm install` inside `functions/`.
3. Publish the complete Firestore rules with `firebase deploy --only firestore:rules`.
4. Deploy the scheduled cleanup with `firebase deploy --only functions:clearExpiredRadioSongs`.

The scheduled function runs at 00:05 Asia/Jakarta and permanently deletes
Radio song documents whose date is earlier than the current Jakarta date.
The page switches to a new, empty date-keyed song wall at 00:00 WIB. The
scheduled function is what physically deletes yesterday's documents; without
deploying it, old submissions stay hidden from the page but remain in
Firestore.

Scheduled Cloud Functions use Cloud Scheduler and may require the Firebase
project to be on the Blaze (pay-as-you-go) plan. Review the billing setup in
Firebase Console before deploying the scheduled cleanup.

## STELLARS Pulse — Daily Random Poll

STELLARS Pulse selects one question and four nominees per Jakarta calendar
day. The daily selection is generated deterministically from the date and
stored once at `pulseDays/{YYYY-MM-DD}`, so every member sees the same
question and A–D candidates. The roster is read from the 45 names shown on
the Crewmates page.

Active members can read today's poll and votes. Each member can create only
one vote document at `pulseDays/{dayKey}/votes/{firebaseUid}`. Poll creation
and vote submission are restricted by Firestore Rules to 09:30–13:00
Asia/Jakarta server time. Votes cannot be changed or deleted after submission.
The Home page reveals the highest-vote nominee(s) after 13:00 WIB; ties are
shown as shared winners.

The poll document is initialized by the first active member who loads Home
during the voting window. Firestore Rules enforce the server-side voting
window even if a browser clock is changed.

After updating `firestore.rules`, deploy the full rules file from the repository
root with:

```bash
firebase deploy --only firestore:rules --project class-web-7241e
```


## Correct a student's NIM after account registration (Spark-compatible)

If a student's NIM was corrected manually in `users/{uid}.nim`, the profile
field alone is not enough: the login email alias, `users.username`,
`nimIndex`, and redeemed activation record must also be synchronized.

Cloud Functions deployment requires the Blaze plan. For a one-time correction
while keeping the project on Spark, use the local Admin SDK script
`functions/repair-student-nim-local.js`. It checks the corrected profile,
the current Auth alias, NIM-index ownership, and the redeemed activation
record before making changes. It then updates the Authentication email alias,
`users.username`, `nimIndex`, and the redeemed activation record. The
Firebase UID and academic score ownership remain unchanged.

A trusted project owner or adult administrator should run this maintenance
script on a secured computer. The service-account JSON key is highly
sensitive: keep it outside the repository, never commit or share it, and
revoke/delete the temporary key after the repair.

1. In Firebase Console, open Project settings > Service accounts and create
   a private key for the Firebase Admin SDK. Save it outside the repository.
2. Open a terminal in the repository's `functions/` directory.
3. Set `GOOGLE_APPLICATION_CREDENTIALS` to the full path of that private key.
   In Git Bash, for example:

   ```bash
   export GOOGLE_APPLICATION_CREDENTIALS="/c/secure-folder/stellars-admin-key.json"
   ```

4. Run the script with the corrected NIM and exact registered student name:

   ```bash
   node repair-student-nim-local.js 202612010118 "Carmella Wibowo Widhianto"
   ```

5. Check the student name, NIM, and detected old NIM values shown by the
   script. Continue only by typing the exact confirmation phrase it requests.
6. After the script reports success, the student signs in using the corrected
   NIM and their existing password.

If a profile, alias, index, or activation-code conflict is reported, stop.
Do not delete or recreate the account, and do not manually alter additional
records until the conflict has been reviewed.


## STELLARS World — Realtime multiplayer setup

STELLARS World uses Firebase Realtime Database for live player presence, not
Firestore movement writes. The page checks the signed-in Firebase profile,
while Realtime Database Rules also require each UID to exist in the
read-only `worldMembers` allowlist. Visitors cannot add their own UID.

### One-time database setup

1. In Firebase Console, open project `class-web-7241e` → **Realtime Database**
   → **Create Database**. Create the default database in **Singapore
   (asia-southeast1)** and choose locked/production rules, not test mode.
2. The expected URL is
   `https://class-web-7241e-default-rtdb.asia-southeast1.firebasedatabase.app`.
   If the console shows a different URL, update `databaseURL` in `world.js`
   to the exact URL shown.
3. Sign in to STELLARS using the active Super Admin account and open
   `world-members-export.html`. Click **Generate member list**, then download
   `stellars-world-members.json`. The file contains only UIDs for active
   class accounts, not names, NIMs, or email addresses.
4. In Realtime Database → **Data**, create/select the top-level
   `worldMembers` node and import the downloaded JSON into that node. Do not
   import the JSON at the database root after World is in use.
5. Pull the latest repository changes in the local clone, then publish the
   Realtime Database Rules:

   ```bash
   firebase deploy --only database --project class-web-7241e
   ```

6. Open `world.html` using two active STELLARS class accounts in separate
   browsers/devices. The header should show **WORLD LIVE** and online player
   count. Walk around and enter the same building to confirm both characters
   appear together.

The rules keep `worldMembers` read-only to clients and let each allowlisted
member write only their own live presence. Regenerate and re-import the
allowlist when membership or activation status changes. A GitHub Pages
publish does not create a Firebase database or publish its Rules. Multiplayer
stays in setup mode until the database exists, the allowlist is imported, and
the deploy command succeeds.

For this first networking stage, live character positions, first names,
profession labels, and building/area are shared. Inventory, crops, coins, and
profession progress remain local to each browser and are not yet a shared
economy.


## STELLARS World — live town chat

The World chat uses the same Realtime Database and active-member allowlist as
multiplayer presence. It stores only the sender UID, first name, message text,
and server timestamp. Messages are limited to 180 characters; the client shows
the latest 40 messages. Members can create messages but cannot edit or delete
messages from the client.

After pulling the latest repository changes, publish the updated database rules:

```bash
firebase deploy --only database --project class-web-7241e
```

The chat becomes available after the member is allowlisted and the Realtime
Database Rules deployment succeeds. GitHub Pages deployment alone does not
publish these rules.
