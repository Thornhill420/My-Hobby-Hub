# My Hobby Hub

A personal React site for storing all your 3D printing, Arduino, ESP32, apps, programs and other hobby projects.

## Features

- Add, edit and delete projects
- Store images, files (PDF, .ino, .zip, etc.) and resource links
- Tech-style dark UI with neon accents
- Data is saved in your browser's `localStorage`
- Optional Google Drive sync: uploads each project to a neatly labelled folder structure

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

- Projects are stored in `localStorage`, which is great for small images and text.
- Large files (high-res photos, big PDFs) may exceed browser storage limits.
- For larger files, use the built-in Google Drive sync to keep the actual files in your Drive.

## Google Drive Integration

The site can upload each project to your Google Drive in a neat, labelled structure:

```
Hobby Hub/
  [Category] - [Project Title]/
    Images/
    Files/
    project-info.json
    README.md
```

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
   ```
8. Copy the **Client ID**.

### Connecting in the app

1. Click **☁️ Connect Drive** in the header.
2. Paste your Client ID.
3. Click **Connect Google Drive** and approve access.

When adding or editing a project, you can tick **Also upload this project to Google Drive**. You can also click **Sync to Drive** on any project page to upload or update it later.

### Security note

This uses an OAuth **Client ID** (not an API key) and only requests the `drive.file` scope, which limits access to files created by this app. The refresh token is stored in your browser's `localStorage`, so only use this on devices you trust.
