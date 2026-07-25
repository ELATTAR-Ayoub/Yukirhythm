<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/readme/hero-dark.png">
  <img src="docs/readme/hero-light.png" alt="Yukirhythm, listen your way" width="100%">
</picture>

<br>
<br>

**Free music, zero ads, zero interruptions.**
<br>
Your library, your queue, your volume. All remembered, every time you come back.

<br>

[![Open Yukirhythm](https://img.shields.io/badge/%E2%96%B6%EF%B8%8E%20%20Open%20Yukirhythm-1450F0?style=for-the-badge&labelColor=191919)](https://yukirhythm-web.vercel.app)

<br>

![No ads](https://img.shields.io/badge/ads-none%2C%20ever-7DF08A?style=flat-square&labelColor=191919)
![Price](https://img.shields.io/badge/price-free-7DF08A?style=flat-square&labelColor=191919)
![Catalog](https://img.shields.io/badge/catalog-all%20of%20YouTube-1450F0?style=flat-square&labelColor=191919)
![Session](https://img.shields.io/badge/your%20session-always%20remembered-1450F0?style=flat-square&labelColor=191919)

</div>

<br>

## What is this?

Yukirhythm is a music player for people who just want to **press play**. It streams
from YouTube's endless catalog: every song, every remix, every 3-hour lofi mix, all
wrapped in a fast, focused player with **no ads, no upsells, and no "premium" nags**.

Sign in once, and the app remembers everything: the song you were on, the second you
paused at, your queue, even your volume. Close the tab at 2:06 of a track, come back
tomorrow, and it's waiting at 2:06.

<br>

## How to use it

<img src="docs/readme/step-01-signin.png" alt="Step 01, Sign in" width="100%">

One tap. Continue with **Google** or **Facebook**. No forms, no passwords to invent,
no email verification scavenger hunt. Signing in is what lets Yukirhythm keep your
likes, playlists and session across devices.

<img src="docs/readme/mock-01-signin.jpg" alt="The Yukirhythm sign-in screen" width="100%">

<br>

<img src="docs/readme/step-02-search.png" alt="Step 02, Search" width="100%">

You land straight on **Search**, already filled with music:

1. **You might like**, picks that learn from what you play
2. **New releases**, fresh drops
3. **Browse by mood**, one-tap tiles: Lo-fi, Ambient, Focus, Night, and more

Type anything. A song, an artist, half a lyric you barely remember. Press
<kbd>Enter</kbd>, and if YouTube has it, you can play it.

> [!TIP]
> Searching only fires when you press <kbd>Enter</kbd>. Type in peace, with no
> flickering results while you think.

<img src="docs/readme/mock-02-search.jpg" alt="Search with the You might like and New releases shelves" width="100%">

<br>

<img src="docs/readme/step-03-play.png" alt="Step 03, Play" width="100%">

Click any card and it plays. The vinyl starts spinning in the player rail, with your
queue underneath.

- **Seek anywhere.** Click any point on the progress bar to jump straight to that second
- **Like from the player.** The ♥ sits right on the transport, one click while it spins
- **Queue it up.** Add tracks to play next or last, straight from any card's menu

> [!NOTE]
> Leave whenever you want. When you come back, your song is restored **paused at the
> exact second you left**, volume included. Press play and continue.

<img src="docs/readme/mock-03-play.jpg" alt="The player spinning a record with the queue rail" width="100%">

<br>

<img src="docs/readme/step-04-library.png" alt="Step 04, Library" width="100%">

Everything you ♥ lands in **Liked Songs**, a permanent playlist that's always pinned.
Build your own playlists with the create flow (name, mood tags, cover), and add to
them from anywhere in the app.

<img src="docs/readme/mock-04-library.jpg" alt="The library with Liked Songs" width="100%">

<br>

## Questions you might have

<details>
<summary><b>Is it really free? What's the catch?</b></summary>
<br>

It's free. No ads, no premium tier, no trial countdown. Yukirhythm is an independent
project built for the love of it. The music plays through YouTube's own embedded
player, so artists still get their plays counted.

</details>

<details>
<summary><b>Where does the music come from?</b></summary>
<br>

YouTube. Every track plays through YouTube's official embedded player behind the
scenes, which is why the catalog is effectively everything: releases, live
versions, remixes, full albums, DJ sets, that one bootleg with 40k views.

</details>

<details>
<summary><b>Do I need an account?</b></summary>
<br>

Yes, one tap with Google or Facebook. That's what makes your likes, playlists,
queue and session follow you between visits and devices.

</details>

<details>
<summary><b>Does it work on my phone?</b></summary>
<br>

Yes. The whole app is responsive. On mobile you get a bottom tab bar, a mini
player, and a full-screen player with the same spinning vinyl.

</details>

<br>

<details>
<summary><h3>🛠 For developers</h3></summary>

![Next.js](https://img.shields.io/badge/Next.js%2016-191919?style=flat-square&logo=nextdotjs)
![React](https://img.shields.io/badge/React%2019-191919?style=flat-square&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-191919?style=flat-square&logo=typescript)
![Tailwind](https://img.shields.io/badge/Tailwind%204-191919?style=flat-square&logo=tailwindcss)
![Firebase](https://img.shields.io/badge/Firebase%2012-191919?style=flat-square&logo=firebase)
![Zustand](https://img.shields.io/badge/Zustand-191919?style=flat-square)
![Vitest](https://img.shields.io/badge/Vitest-191919?style=flat-square&logo=vitest)
![Vercel](https://img.shields.io/badge/Vercel-191919?style=flat-square&logo=vercel)

An npm-workspaces monorepo; the app lives in `apps/web` (Next.js App Router).
Firestore is only ever touched server-side through route handlers under
`apps/web/app/api/` (Firebase Admin, uid from the verified token); the browser
talks to the API only. Playback is YouTube's IFrame player hidden behind a
custom vinyl UI.

```bash
git clone https://github.com/ELATTAR-Ayoub/Yukirhythm.git
cd Yukirhythm
npm ci

cd apps/web
npm run emulator    # Firebase auth + firestore emulators (terminal 1)
npm run dev:emu     # the app, pointed at the emulators (terminal 2)
```

Then open `http://localhost:3000`. Sign-in works against the local auth
emulator, no production credentials needed.

```bash
npm test                 # unit suite
npm run test:integration # against the emulator
npm run typecheck && npm run lint && npm run format:check
```

</details>

<br>

<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/readme/hero-light.png">
  <img src="docs/readme/hero-dark.png" alt="Yukirhythm, no ads, just music" width="100%">
</picture>

<br>
<br>

Made with 🎵 by [ELATTAR Ayoub](https://github.com/ELATTAR-Ayoub)
<br>
<sub>If Yukirhythm made your day a little louder, a ⭐ makes mine.</sub>

</div>
