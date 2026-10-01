# 🎵 SpotiFree

<div align="center">

![Next.js 14](https://img.shields.io/badge/Next.js%2014-black?style=for-the-badge&logo=next.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Tauri](https://img.shields.io/badge/Tauri_v2-FFC131?style=for-the-badge&logo=tauri&logoColor=black)
![Capacitor](https://img.shields.io/badge/Capacitor_6-119EFF?style=for-the-badge&logo=capacitor&logoColor=white)
![IndexedDB](https://img.shields.io/badge/Dexie.js-IndexedDB-2C3E50?style=for-the-badge)
![Status: Verified](https://img.shields.io/badge/Tests-100%25%20Passing-1DB954?style=for-the-badge)
![License: MIT](https://img.shields.io/badge/License-MIT-1DB954?style=for-the-badge)

<p align="center">
  <b>A zero-cost, local-first music streaming ecosystem and progressive web app (PWA).</b><br>
  Built with Next.js 14 App Router, Dexie.js IndexedDB binary caching, Zustand state machine, and multi-cloud serverless deployment.
</p>

[Live Demo](https://spotifree-three.vercel.app) • [Architecture](#-the-antigravity-philosophy) • [Features](#-key-features) • [Installation](#-local-development-guide) • [Disclaimer](#-legal-disclaimer)

</div>

---

## 🚀 The "Antigravity" Philosophy

**SpotiFree** challenges the conventional server-heavy paradigm of modern SaaS. Instead of paying monthly hosting bills for cloud databases, user authentication servers, and CDN egress, SpotiFree offloads 100% of its storage and compute directly to the edge user device.

* **Zero-Cost Database:** Uses **Dexie.js (IndexedDB v2)** as a persistent, high-performance local database storing playlists, liked songs, play history, and raw binary audio/artwork Blobs.
* **Headless Audio Proxying:** Resolves streams dynamically using multi-region Piped instances and private Express audio proxies, eliminating API vendor lock-in and rate limits.
* **Tri-Platform Native Compilation:** A single shared React codebase exports into a Progressive Web App, native Windows desktop executable (`.exe`) via **Tauri v2**, and native Android/iOS apps (`.apk`) via **Capacitor 6**.
* **Zero Telemetry Leakage:** In-browser crash recording with on-demand JSON telemetry diagnostics—no third-party trackers, cookies, or telemetry fees.

---

## ✨ Key Features

- 🎧 **High-Fidelity Audio Streaming:** Automatic resolution of highest-bitrate `audio/webm` and `audio/m4a` streams with origin masking.
- 💾 **Binary Offline Mode:** Download tracks directly into local IndexedDB Blobs for true offline playback without internet connectivity.
- 🔄 **Fisher-Yates Shuffle Engine:** Unbiased $O(n)$ shuffle algorithm that keeps the currently active track playing at index `0` while randomizing the remaining queue.
- 🎚️ **Throttled Audio Engine:** Custom singleton HTML5 audio engine with 500ms throttled `timeupdate` listeners to eradicate React re-render lag.
- 📱 **Mobile Fullscreen Drawer:** Native-feeling Framer Motion mobile player with spring physics and drag-to-dismiss gesture tracking.
- 🖱️ **Drag-and-Drop Playlists:** Fluid `@dnd-kit` pointer interactions allowing songs to be dragged directly from cards into sidebar playlists.
- 📑 **Non-Clipping Context Menus:** Radix UI `ContextMenu.Portal` providing quick queue additions, playlist mapping, and offline downloads without CSS overflow clipping.
- 📲 **Lockscreen & Background Audio:** Full integration with the browser **MediaSession API**, Android `FOREGROUND_SERVICE_MEDIA_PLAYBACK`, and `WAKE_LOCK`.
- 🛡️ **Self-Healing Telemetry:** React Error Boundary catching exceptions with one-click disaster recovery state wipes and JSON diagnostic exports.

---

## 🏛️ System Architecture

```mermaid
flowchart TD
    subgraph UI ["User Interface Layer"]
        A[Next.js 14 App Router] --> B[SiteLayout & CSS Grid]
        B --> C[Sidebar / Playlists]
        B --> D[HomePage / Cards]
        B --> E[PlayerBar / MobilePlayer]
    end

    subgraph Interaction ["Interaction & State Engine"]
        D -->|Right Click / Long Press| CM[Radix ContextMenu Portal]
        D -->|Drag Track| DND[@dnd-kit PointerSensor]
        DND -->|Drop on Playlist| DB_PL[(Dexie Playlists)]
        E -->|Playback Actions| ZS[Zustand usePlayerStore]
        ZS -->|Persist without isPlaying| LS[(LocalStorage)]
    end

    subgraph AudioEngine ["Audio Engine & Streaming"]
        ZS -->|Track Change| AE[useAudioEngine Singleton]
        AE -->|1. Intercept Offline| DB_BLOB[(Dexie offlineBlobs)]
        DB_BLOB -->|Hit: Blob Exists| OBJ[URL.createObjectURL]
        OBJ -->|Safe Revocation| HTML5[HTML5 Audio Instance]
        
        AE -->|2. Miss: Network Fetch| AP[src/lib/api.ts]
        AP -->|Primary| PROXY[Private Express Audio Proxy]
        AP -->|Fallback 429/500| PIPED[Public Piped API Cluster]
        PIPED -->|High-Bitrate Stream| HTML5
    end

    subgraph NativeLayer ["Native Packaging"]
        A -->|output: 'export'| OUT[/out Static Directory]
        OUT --> TAURI[Tauri v2 Desktop .exe]
        OUT --> CAP[Capacitor 6 Android .apk / iOS]
        OUT --> CLOUD[Cloudflare Pages / Vercel]
    end
```

---

## 📂 Project Structure

```text
SpotiFree/
├── .github/workflows/
│   └── deploy.yml              # CI/CD Static Export & Artifact Pipeline
├── proxy-server/               # Phase 8 Private Audio Proxy Microservice
│   ├── src/index.ts            # Express + @distube/ytdl-core Audio Stream Pipe
│   ├── ecosystem.config.js     # PM2 Cluster Production Configuration
│   └── package.json
├── public/
│   ├── _headers                # Cloudflare Pages CSP & Security Headers
│   ├── manifest.json           # Standalone PWA Web App Manifest
│   └── icon.svg
├── src/
│   ├── app/
│   │   ├── (site)/
│   │   │   ├── layout.tsx      # Responsive Layout Engine (Grid + Safe-Area)
│   │   │   └── page.tsx        # Interactive Home View
│   │   ├── globals.css         # Spotify Dark Tokens & Scrollbars
│   │   └── layout.tsx          # Root HTML/PWA Viewport
│   ├── components/
│   │   ├── common/
│   │   │   ├── DownloadButton.tsx  # Reactive Offline State Indicator
│   │   │   └── ErrorBoundary.tsx   # React Error Boundary & Disaster Recovery
│   │   ├── developer/
│   │   │   └── DiagnosticsModal.tsx # Offline Crash Logs & JSON Exporter
│   │   ├── dnd/
│   │   │   └── DragContext.tsx     # @dnd-kit Drag-and-Drop Wrapper
│   │   ├── layout/
│   │   │   ├── MobileNav.tsx       # 64px iOS Safe-Area Bottom Nav
│   │   │   ├── MobilePlayer.tsx    # Framer Motion Drag-to-Dismiss Drawer
│   │   │   ├── PlayerBar.tsx       # Desktop Scrubber & Audio Controls
│   │   │   └── Sidebar.tsx         # Droppable Playlist Navigation
│   │   └── ui/
│   │       └── TrackContextMenu.tsx # Radix UI Context Menu with Portal
│   ├── hooks/
│   │   ├── useAudioEngine.ts       # Singleton HTML5 Audio & Blob Interception
│   │   └── useDownloadManager.ts   # ArrayBuffer-to-Blob Streaming Manager
│   ├── lib/
│   │   ├── api.ts                  # Multi-Instance Piped & Proxy Resolving
│   │   └── db.ts                   # Dexie.js Schema v2 (Playlists, Blobs, Telemetry)
│   └── store/
│       └── usePlayerStore.ts       # Zustand State Machine + Fisher-Yates Shuffle
├── src-tauri/
│   ├── capabilities/default.json   # Desktop Native Filesystem Permissions
│   └── tauri.conf.json             # Tauri v2 Windows/macOS Configuration
├── capacitor.config.ts             # Capacitor 6 Android/iOS Native Config
├── next.config.js                  # Static Site Export (output: 'export') + next-pwa
├── tailwind.config.ts              # Spotify Color System & Utility Plugins
└── vercel.json                     # Strict Vercel CSP Security Headers
```

---

## 🛠️ Local Development Guide

### Prerequisites
* **Node.js**: `v20.x` or higher
* **npm**: `v10.x` or higher
* **Rust & Cargo** *(Optional, for Tauri desktop builds)*
* **Android Studio & Java 17** *(Optional, for Capacitor Android builds)*

### 1. Web / PWA Development

```bash
# Clone the repository
git clone https://github.com/SEVKET210/spotifree.git
cd spotifree

# Install frontend dependencies
npm install

# Start Next.js development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

### 2. Private Audio Proxy Microservice (Optional)

```bash
# Navigate to the proxy service
cd proxy-server

# Install microservice dependencies
npm install

# Start proxy in live-reload watch mode
npm run dev

# Or build and launch with PM2 cluster in production
npm run build
pm2 start ecosystem.config.js
```

---

### 3. Build Desktop Native Binary (`.exe`) via Tauri

```bash
# 1. Build the Next.js static export
npm run build

# 2. Run Tauri in desktop dev mode
npx tauri dev

# 3. Compile native production installer (.exe / .msi)
npx tauri build
```

*Output executable will be generated in:* `src-tauri/target/release/bundle/nsis/`

---

### 4. Build Android Native Binary (`.apk`) via Capacitor

```bash
# 1. Build static export
npm run build

# 2. Add Android platform
npx cap add android

# 3. Synchronize assets and plugins
npx cap sync android

# 4. Open in Android Studio or compile directly via Gradle
cd android
./gradlew assembleDebug
```

*Debug APK output:* `android/app/build/outputs/apk/debug/app-debug.apk`

---

## ⚖️ Legal Disclaimer

**SpotiFree** is an open-source project created strictly for educational and portfolio purposes to demonstrate modern local-first web architecture, Web Audio API streaming, and cross-platform native compilation.

* SpotiFree **does not host, store, or distribute copyrighted media** on its own servers.
* Audio streams are dynamically resolved via public third-party reverse proxies or self-hosted extraction scripts for personal educational use.
* This project is not affiliated with, endorsed by, or associated with Spotify AB or Google LLC.
* All trademarks, logos, and brand names are the property of their respective owners. Please respect content creators and copyright holders under the Digital Millennium Copyright Act (DMCA).

---

## 📄 License

Distributed under the **MIT License**. See `LICENSE` for more information.

<div align="center">
  <sub>Crafted with passion using Antigravity Agentic Systems.</sub>
</div>
