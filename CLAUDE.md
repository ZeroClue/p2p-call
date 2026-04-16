# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Peer-to-peer video calling web app built with React 19, TypeScript, and WebRTC. No accounts or tracking — users share human-readable call IDs (format: `adjective-noun-verb`) to connect directly. Optional AES-GCM 256-bit end-to-end encryption. Firebase Realtime Database serves as the signaling server; Firebase Anonymous Auth secures database access.

## Development Commands

```bash
npm install                            # Install dependencies
npm run dev                            # Dev server at http://localhost:5173
npm run build                          # Production build → dist/
npm run preview                        # Preview production build
npm test                               # Run tests (vitest, watch mode by default)
npm run test:ui                        # Vitest UI dashboard
vitest run path/to/test.test.ts        # Run a single test file
npm run test:coverage                  # Tests with coverage
npx tsc --noEmit                       # Type check (non-blocking in CI)
```

No local linting/formatting npm scripts are configured. CI runs ESLint and Prettier as non-blocking checks.

## Architecture

### Dependency Loading

React 19 and Firebase SDK (v8 compat) are loaded via CDN in `index.html`, not bundled. Only Tailwind CSS and other dev dependencies are npm-managed. The app uses an import map for React module resolution. Firebase is loaded as global `<script>` tags and accessed as the `firebase` global — the `firebase.ts` file initializes it and exports a `db` reference (`firebase.database()`). Do not `import firebase from 'firebase'`.

### Path Aliases

`@/*` maps to `./*` (project root) in both `tsconfig.json` and `vite.config.ts`.

### WebRTC Signaling Flow

Firebase Realtime Database is the signaling server. Key paths:
- `/calls/{callId}` — SDP offer/answer, ICE candidates, encryption key
- `/users/{userId}/incomingCall` — direct peer ringing (includes `from`, `callId`, `callerAlias`)
- `/status/{userId}` — online presence with timestamps

Call flow: Caller generates call ID → writes SDP offer to Firebase → Joiner reads offer, writes answer → ICE candidates exchanged → direct P2P connection established. All signaling logic lives in `hooks/useWebRTC.ts`.

### Call State Machine

`CallState` enum in `types.ts` manages the lifecycle:

`IDLE` → `LOBBY` → `CREATING_OFFER` → `WAITING_FOR_ANSWER` → `CONNECTED`
`IDLE` → `LOBBY` → `JOINING` → `CREATING_ANSWER` → `CONNECTED`

Special states: `INCOMING_CALL`, `RINGING` (caller ringing a pinned peer), `RECONNECTING`, `DECLINED`, `MEDIA_ERROR`, `ENDED`

The lobby (`enterLobby()`) is entered before creating, joining, or accepting calls — it provides media preview with resolution and E2EE toggles.

### End-to-End Encryption

Optional E2EE in `utils/crypto.ts`:
- AES-GCM 256-bit with per-frame counter-based IVs
- Transform streams on RTCRtpSender/RTCRtpReceiver encoded frames
- Key exchange: caller generates key, joiner imports from `/calls/{callId}/encryptionKey`
- Browser support check: `RTCRtpSender.prototype.createEncodedStreams` existence

### Data Channel Protocol

WebRTC data channel sends JSON messages:
```typescript
{ type: 'chat', payload: string }
{ type: 'control', payload: { type: 'mute' | 'video', value: boolean } }
```

### Key Hooks

- `useWebRTC` — core WebRTC: peer connection, media streams, signaling, reconnection, E2EE, chat, `ringUser()` for calling pinned peers directly
- `useAuth` — Firebase anonymous auth state
- `usePresence` — Firebase presence tracking (online/offline)
- `usePeerStatus` — monitors presence of pinned contacts
- `useDraggable` — drag-and-drop for floating video
- `usePinchToZoom` — pinch-to-zoom on remote video stream

### Shared Icons

Reusable SVG icon components live in `components/icons.tsx`. Import from there instead of defining icons locally in component files. FloatingVideo has unique icons that stay local.

### useWebRTC Stale Closure Pattern

Firebase callbacks (`on('value', ...)`) and WebRTC handlers capture state at registration time. To read current state inside these callbacks, use the sync refs: `callStateRef`, `peerIdRef`, `enableE2EERef`, `isMutedRef`, `isVideoOffRef`, `remoteStreamRef`. Do not read state variables directly in callbacks.

### Configuration

- ICE servers (STUN + TURN) in `constants.ts`
- Resolution presets in `useWebRTC.ts`: 480p, 720p (default), 1080p
- Ring timeout: 30 seconds (`RING_TIMEOUT_MS`)
- Reconnection: exponential backoff (2000ms × attempt), max 3 attempts, caller-only

## Firebase Setup

1. Copy `firebase.ts.example` to `firebase.ts` and add config
2. Enable Anonymous Authentication in Firebase Console
3. Deploy security rules: `firebase deploy --only database`
4. `firebase.ts` is gitignored — never commit credentials

In CI, `firebase.ts` is generated from GitHub Secrets via `scripts/generate-firebase-config.cjs`. `firebase.ts` does not exist locally until generated. Type checking and builds will fail with a missing module error — this is expected without a local config.

## Testing

Vitest with jsdom environment. Test setup in `test/setup.ts` mocks Firebase (with `.child()` chaining), WebRTC (`RTCPeerConnection` with all methods), and crypto APIs. The `@/` path alias is configured in `vitest.config.ts`.

```bash
npm test                          # Watch mode
vitest run test/utils/id.test.ts  # Single test
npm run test:coverage             # With coverage
```

## CI/CD

- **`deploy.yml`**: Deploys to Firebase Hosting on main/master push. Uses `npm ci`, `npx vitest run`, blocking `tsc --noEmit`. PRs get preview deployments (7-day expiry).
- **`pr-check.yml`**: PR checks — tests with coverage, type check, build, security audit (`npm audit`), ESLint, Prettier. All gates are blocking.
- **`dependabot.yml`**: Auto-merges patch/minor updates after CI passes.

## Deployment

```bash
npm run build && firebase deploy          # Full deploy
firebase deploy --only database           # Rules only
firebase deploy --only hosting            # Hosting only
```

`firebase.json` configures `dist/` hosting with SPA rewrites and security headers (HSTS, CSP, X-Frame-Options).

## Styling

Tailwind CSS with dark theme and glassmorphism effects. Custom animations in `tailwind.config.js`. Styles in `index.css`.

## Important Constraints

- Call IDs must match `/^[a-z]+-[a-z]+-[a-z]+$/` (validated in `App.tsx`)
- HTTPS required in production (enforced in `utils/security.ts`) for `getUserMedia`
- User IDs are anonymous UUIDs stored in localStorage (`p2p-user-id`)
- Service worker caching may require hard refresh during development
