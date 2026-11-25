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
