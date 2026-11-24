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
