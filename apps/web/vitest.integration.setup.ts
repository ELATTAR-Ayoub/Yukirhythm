/**
 * Points the Admin SDK at the local Firestore + Auth emulators before any test
 * module loads. These hosts make firebase-admin talk to the real emulator
 * engine with no production credential.
 */
process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= "127.0.0.1:9099";
process.env.GCLOUD_PROJECT ??= "demo-yukirhythm";
process.env.NEXT_PUBLIC_PROJECTID ??= "demo-yukirhythm";
