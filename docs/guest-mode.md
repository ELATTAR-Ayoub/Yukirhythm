# Guest mode

The login page offers **Continue as guest**. Guest access creates a stable browser identity, without creating a Firebase account or signing in anonymously through Firebase.

Guest personal data is stored in this browser's local storage:

- Likes, full track metadata, playlists, membership/order, and pins.
- Privacy preferences and local profile information.
- Listening history and statistics (the most recent 2,000 recorded listens).
- Queue, playback position, volume, shuffle, cached discovery feeds, and appearance.

Signing out ends access to the guest session but retains its identity and saved data. Choosing guest access again in the same browser restores it. Guest data remains separate from signed-in account data; signing in does not upload or merge it.

The guest client handles personal operations locally. Music metadata goes through the read-only `/api/guest/catalog` provider route; this route neither verifies Firebase accounts nor reads or writes Firestore. Search, artwork, recommendations, Spotify connection/import, and YouTube playback still require internet access. This is device-local storage, not downloaded or offline music. Anonymous discovery queries may use the server's short-lived catalog cache.

Guest playlists remain private to the device. Online playlist sharing, public profiles, and social actions require a signed-in account. Track sharing can still use the official YouTube URL. The UI explains these limits instead of generating unusable guest playlist links.

Clearing this site's browser data removes guest data. A different browser, browser profile, device, port, or origin has separate storage. In particular, localhost data does not transfer to the hosted app. Private browsing may remove data when its session closes. Storage failures are reported when saving guest libraries and history; invalid guest library records are not silently overwritten.

## Verification

Regression coverage includes session recovery without waiting for Firebase, sign-out/re-entry, local-only personal operations, playlist order/pins, likes, history/stats/clearing, privacy preferences, delayed catalog responses, session isolation, storage failures, corrupt records, and the public catalog's database-free behavior.

Manual checks used the local app with Firebase emulators stopped: guest login, live catalog search, YouTube playback, liking, creating a playlist with a selected song, full-page reloads, guest account labeling, and sign-out/re-entry with the saved library and playback position retained.

No production deployment is included in this change.
