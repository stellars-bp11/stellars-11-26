# STELLARS Firebase Setup — First Admin

This checklist prepares the existing Firebase project for the Academic Portal.
It does not create accounts automatically and does not contain passwords or
service-account credentials.

## Before changing Firebase

1. Open Firebase Console and select project `class-web-7241e`.
2. Confirm that Authentication > Sign-in method has Email/Password enabled.
3. Open Authentication > Users and check whether the existing Library admin
   account is present.
4. In the repository's `library.js`, the current Library delete permission is
   tied to the existing `ADMIN_UID`. Reuse that account for the first
   Super Admin only if the UID shown in Firebase Authentication is exactly the
   same and you control that account.
5. If the account is missing or the UID does not match, stop before creating a
   replacement. The Library admin UID and first Super Admin account must be
   coordinated so Gallery delete permissions are not accidentally lost.

## Publish Firestore rules

1. Open Firestore Database > Rules in Firebase Console.
2. Confirm the project is `class-web-7241e`.
3. Copy the complete contents of `firestore.rules` from this branch.
4. Review it, then publish.
5. Test the existing Library: public memory list, upload, and delete using the
   authorized Library admin account.
6. Do not add permissive catch-all rules such as `allow read, write: if true`.

Committing `firestore.rules` to GitHub does not publish it to Firebase.

## Create the first Super Admin profile

Only do this after verifying the Authentication account and its UID.

1. Open Firestore Database > Data.
2. Create collection `users`.
3. Set the document ID to the exact Firebase Authentication UID.
4. Add these fields:

| Field | Type | Value |
|---|---|---|
| fullName | string | Your full name |
| username | string | The exact username used on the Academic Portal login |
| nim | string | Your NIM, or empty string if this is not a student account |
| role | string | `superAdmin` |
| isActive | boolean | `true` |
| birthDate | string | Empty string initially |
| slogan | string | Empty string initially |

Do not create the document with an auto-generated ID. The document ID must
match the Auth UID exactly.

## Login username mapping

The Academic Portal currently converts the entered username to an internal
Firebase email alias:

- Normalize the username to lowercase.
- Remove accents.
- Replace runs of non-alphanumeric characters with a dot.
- Append `@class-web-7241e.firebaseapp.com`.

For example, `Student Example` becomes
`student.example@class-web-7241e.firebaseapp.com`.

The Firebase Authentication account's email must match that alias exactly
for this login flow. If the existing Library admin account uses a different
email, do not assume that its current password will work with the alias.
Coordinate a separate alias account and update the Gallery admin UID only
after verifying the new account.

## Smoke test

After publishing rules and creating the profile:

1. Open `academic.html` using the deployed site or Live Server.
2. Sign in with the provisioned username and password.
3. Confirm the portal opens and the profile shows the correct name and role.
4. Open My Profile, save a birth date and a short slogan, then reload and
   confirm both values persist.
5. Confirm the Admin Dashboard is visible for the Super Admin.
6. Confirm an unauthenticated visitor cannot read private Academic Portal
   collections and a student cannot read another student's scores.

Do not put passwords, private keys, or service-account JSON files in this
repository. Use a unique strong password and store it in a password manager.
