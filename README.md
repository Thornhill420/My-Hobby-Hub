# My Hobby Hub

A personal React site for storing all your 3D printing, Arduino, ESP32, apps, programs and other hobby projects.

## Features

- Add, edit and delete projects
- Store images, files (PDF, .ino, .zip, etc.) and resource links
- Tech-style dark UI with neon accents
- A local `localStorage` cache so the app works offline
- Google Drive sync: the shared project list lives in your Drive, so every
  device you connect sees the same projects (additions, edits and deletions)

## Getting Started

1. Make sure you have Node.js installed.
2. Install dependencies:

```bash
npm install
```

3. Start the development server:

```bash
npm run dev
```

4. Open the URL shown in the terminal (usually `http://localhost:5173`).

## Building for Production

```bash
npm run build
```

The build output will be in the `dist` folder.

## Notes on Storage

- Projects are cached in `localStorage`, which is great for small images and text.
- When Google Drive is connected, your Drive is the source of truth: the app
  pulls the shared list on load, refocuses and every 60 seconds, merges it with
  local changes, and pushes the result back after each change (debounced).
- Large files (high-res photos, big PDFs) may exceed browser storage limits —
  connect Drive to share them across devices.

## Google Drive Integration

Everything is stored in one shared folder in your Drive:

```
Hobby Hub/
  projects.json          <- the shared project list (all devices read/write this)
  [Category] - [Project Title]/   <- optional per-project export
    Images/
    Files/
    project-info.json
    README.md
```

### How syncing works

- On load (and when you refocus the tab), the app downloads `projects.json`,
  merges it with your local data and, if anything differs, uploads the result.
- Adds, edits and deletes are pushed automatically about 1.5 seconds after you
  make them. Deletions are recorded as tombstones so they propagate instead of
  coming back from other devices.
- Merging is per project: the most recently edited version of a project wins,
  so two devices can work offline and reconcile without losing data.
- A status pill in the header shows `Loading…`, `Syncing…`, `Synced`,
  `Sync error` or `Local only`.
- The first time a device connects, it also imports any per-project folders
  uploaded by the old "Sync to Drive" button (metadata plus images/files).

### Using it on multiple devices

1. Connect Google Drive on each device with the **same Client ID** and the
   **same Google account** — the `drive.file` scope only exposes files created
   by that Client ID, so a different one would see an empty folder.
2. To avoid pasting the Client ID everywhere, set it once as an environment
   variable (it is not a secret):
   ```
   VITE_GOOGLE_CLIENT_ID=xxxxxx.apps.googleusercontent.com
   ```
   For GitHub Pages, add a repository **secret** with that name — the deploy
   workflow passes it to the build, so the Client ID is pre-filled on every
   device.
3. The app password must also be entered per device (it only unlocks the UI).

### Setup

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a project (or select an existing one).
3. Enable the **Drive API**.
4. Configure the **OAuth consent screen** and add your Google account as a test user.
5. Go to **Credentials → Create Credentials → OAuth Client ID**.
6. Choose **Web application**.
7. Under **Authorized JavaScript origins**, add:
   ```
   http://localhost:5173
   https://thornhill420.github.io
   ```
8. Copy the **Client ID**.

### Connecting in the app

1. Click **☁️ Connect Drive** in the header.
2. Paste your Client ID.
3. Click **Connect Google Drive** and approve access.

When adding or editing a project, you can tick **Also upload this project to Google Drive**. You can also click **Sync to Drive** on any project page to upload or update it later.

### Security note

This uses an OAuth **Client ID** (not an API key) and only requests the `drive.file` scope, which limits access to files created by this app. The refresh token is stored in your browser's `localStorage`, so only use this on devices you trust.

## Password Protection

The site is password-protected to prevent casual access.

### Setting the password

1. Create a `.env` file in the project root:
   ```
   VITE_APP_PASSWORD=your-secret-password
   ```
2. Add this line to `.gitignore` (already done):
   ```
   .env
   ```
3. For GitHub Pages deployment, set a repository secret:
   - Name: `VITE_APP_PASSWORD`
   - Value: your-secret-password

The password is never visible in the source code or built files.

### Default password

If no password is set, the default is `hobby2026` (for development only).
