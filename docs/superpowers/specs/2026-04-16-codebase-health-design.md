# Codebase Health: Comprehensive Fix Design

Date: 2026-04-16

## Problem

The P2P video call app has accumulated technical debt across five dimensions: missing test coverage for critical paths, resource leaks in the WebRTC hook, no TypeScript strict mode, oversized files needing decomposition, and permissive security configuration.

## Approach

Refactor first, then fix leaks and add tests against the clean structure. This avoids writing tests twice and makes leaks easier to spot in small, single-purpose hooks.

## Step 1: Enable TypeScript Strict Mode

Enable `"strict": true` in `tsconfig.json`. Fix ~15 resulting type errors:

- Replace 9 `any` types in Firebase refs/snapshots with proper interfaces
- Type the `installPrompt` state (`BeforeInstallPromptEvent`)
- Add null checks where strict mode requires them

Files: `tsconfig.json`, `hooks/useWebRTC.ts`, `App.tsx`, `hooks/useAuth.ts`

## Step 2: Split `useWebRTC.ts` into Focused Hooks

The 685-line hook becomes 3 sub-hooks + a composer:

### `useMediaStream` (~80 lines)

- Handles `getUserMedia`, track enable/disable, resolution switching
- Owns: `localStream`, `isMuted`, `isVideoOff`
- Exposes: `initMedia`, `toggleMute`, `toggleVideo`, `cleanupMedia`

### `useSignaling` (~200 lines)

- Handles Firebase signaling: offers/answers, ICE candidates, reconnection
- Owns: `callDocRef`, `offerCandidatesRef`, `answerCandidatesRef`
- Exposes: `initiateCall`, `joinCall`, `ringUser`, `declineCall`, `cleanupSignaling`
- Receives `RTCPeerConnection` from the composer for `onicecandidate`, `createOffer`/`createAnswer` calls

### `useDataChannel` (~50 lines)

- Handles chat send/receive and control messages (mute/video sync)
- Owns: `dataChannelRef`, `onChatMessage` callback
- Exposes: `sendMessage`, `setOnChatMessage`

### `useWebRTC` (composer, ~150 lines)

- Creates `RTCPeerConnection`, wires sub-hooks
- Owns: `callState`, `remoteStream`, `connectionState`, stats, E2EE
- Manages peer connection lifecycle, delegates to sub-hooks

No duplicate state — each piece lives in exactly one hook. The composer passes refs/callbacks between hooks.

## Step 3: Extract State from `App.tsx`

The 573-line `App.tsx` shrinks to ~250 lines via extraction:

### `CallContext`

React context providing call state, streams, and core actions to deeply nested components. Eliminates props drilling.

### `useCallHistory` (~40 lines)

Manages history state, persistence, alias updates, deletion, pin/unpin. Extracted from App.tsx lines 31, 192-194, 288-294.

### `useIncomingCall` (~50 lines)

Manages Firebase `/users/{userId}/incomingCall` listener, incoming call state, accept/decline handlers. Extracted from App.tsx lines 90-109, 243-255.

### `useCallNotifications` (~60 lines)

Manages sound effects for call state transitions, call timer, history entry creation. Extracted from App.tsx lines 111-169.

## Step 4: Fix Resource Leaks

Targeted fixes in the now-split hooks:

### `useSignaling`

- Firebase `on('value')` and `on('child_added')` listeners: ensure cleanup always runs even if refs are nulled early by error handling
- `ringingTimeoutRef`: clear explicitly in `declineCall()` before the timeout fires
- `reconnectionTimerRef`: unmount cleanup in the composer handles this

### `useWebRTC` (composer)

- `statsIntervalRef`: always clear before creating a new interval to prevent duplicates during reconnection
- `beforeunload` handler: note that `remove()` is async and not awaited (low risk)

### `useCallNotifications`

- `timerRef` (call duration): add unmount cleanup to prevent interval leak

### `useIncomingCall`

- Firebase listener uses ref for current callState instead of stale closure value

## Step 5: Add Tests

Tests target the split hooks using existing `test/setup.ts` mocks:

### `test/hooks/useMediaStream.test.ts` (~80 lines)

- `initMedia` success and failure cases (permission denied, not found, overconstrained)
- `toggleMute` and `toggleVideo` track enable/disable
- Cleanup releases all tracks

### `test/hooks/useSignaling.test.ts` (~120 lines)

- `initiateCall` writes offer to Firebase
- `joinCall` reads offer, writes answer
- ICE candidate exchange
- Decline writes `declined: true` and cleans up
- Reconnection attempts up to max
- `ringUser` sets incoming call + ringing timeout

### `test/hooks/useDataChannel.test.ts` (~50 lines)

- `sendMessage` sends JSON via data channel
- Receiving chat messages triggers callback
- Control messages update mute/video state
- Malformed messages handled gracefully

### `test/hooks/useWebRTC.test.ts` (~100 lines)

- Composer wires sub-hooks correctly
- `enterLobby` -> `startCall` flow
- `hangUp` cleans up everything
- E2EE setup when enabled vs disabled

### `test/hooks/useCallHistory.test.ts` (~50 lines)

- History persistence and retrieval
- Alias updates and deletion
- Pin/unpin toggle

### `test/hooks/useIncomingCall.test.ts` (~50 lines)

- Firebase listener setup
- Incoming call state transitions
- Accept and decline flows

Mock improvements: add `localStorage` mock for history/pins tests.

## Step 6: Tighten CSP + Database Rules

### CSP (`firebase.json`)

Replace `connect-src * data: blob:` with:

```
connect-src 'self' wss://*.firebaseio.com https://*.googleapis.com https://*.gstatic.com stun:*.l.google.com:19302 turn:openrelay.metered.ca:80 turn:openrelay.metered.ca:443 data: blob:
```

Keep `'unsafe-eval'` in `script-src` (Firebase SDK v8 requires it). Add comment noting tech debt for SDK v9 migration.

### Database Rules (`database.rules.json`)

- `calls/$callId/.read`: restrict from `auth != null` to caller or joiner only (allow any auth user when call has no joiner yet, needed for join flow)
- Add `".indexOn": ["callerId", "joinerId"]` to `calls` node
- `users/$userId/.write`: restrict from `auth != null` to `auth.uid === $userId`

## File Changes Summary

### New Files

- `hooks/useMediaStream.ts`
- `hooks/useSignaling.ts`
- `hooks/useDataChannel.ts`
- `contexts/CallContext.tsx`
- `hooks/useCallHistory.ts`
- `hooks/useIncomingCall.ts`
- `hooks/useCallNotifications.ts`
- `test/hooks/useMediaStream.test.ts`
- `test/hooks/useSignaling.test.ts`
- `test/hooks/useDataChannel.test.ts`
- `test/hooks/useWebRTC.test.ts`
- `test/hooks/useCallHistory.test.ts`
- `test/hooks/useIncomingCall.test.ts`

### Modified Files

- `tsconfig.json` (strict mode)
- `hooks/useWebRTC.ts` (rewrite as composer)
- `App.tsx` (shrink to layout + extracted hooks)
- `firebase.json` (CSP tightening)
- `database.rules.json` (access restrictions)
- `test/setup.ts` (localStorage mock)

### Unchanged Files

- All components remain unchanged
- `utils/*` remain unchanged
- `constants.ts`, `types.ts` remain unchanged
