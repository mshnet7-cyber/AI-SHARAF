# AI SHARAF Android v2.0

This is the Android client for the AI SHARAF Brain.

## Included UI
- Chat
- Memory
- Knowledge
- Research workspace
- Tasks
- Files workspace
- Settings
- Arabic / English input
- Central API connection

## Backend
The app is designed to connect to the AI SHARAF backend.

For Android Emulator: `http://10.0.2.2:8000`

For a real phone, change `API_BASE` in `MainActivity.kt` to the LAN IP of the machine running the backend.

## Build
Use GitHub Actions workflow `Build AI SHARAF APK` or open the project in Android Studio and run `assembleDebug`.

Expected output: `app/build/outputs/apk/debug/app-debug.apk`

## Current limitation
The backend still needs server-side multipart file upload and web research endpoints for the corresponding UI sections.
