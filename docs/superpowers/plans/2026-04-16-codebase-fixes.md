# Codebase Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all critical bugs, security vulnerabilities, CI/CD pipeline issues, and code quality problems identified in the comprehensive codebase review.

**Architecture:** Fixes are organized into 6 phases, each independently committable. Phase 1 (CI/CD) must go first since it enables reliable validation of all subsequent changes. Each phase targets a specific concern area.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Firebase Realtime Database, GitHub Actions CI/CD

---

## Phase 1: CI/CD Pipeline Fixes

### Task 1: Fix deploy.yml

**Files:**

- Modify: `.github/workflows/deploy.yml`

- [ ] **Step 1: Fix the deploy workflow**

Replace the entire file with:

```yaml
name: Deploy to Firebase Hosting

on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]

concurrency:
  group: deploy-${{ github.ref }}
  cancel-in-progress: true

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest

    permissions:
      contents: read
      deployments: write
      id-token: write
      pull-requests: write

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npx vitest run

      - name: Type check
        run: npx tsc --noEmit

      - name: Generate Firebase configuration
        run: node scripts/generate-firebase-config.cjs
        env:
          FIREBASE_API_KEY: ${{ secrets.FIREBASE_API_KEY }}
          FIREBASE_AUTH_DOMAIN: ${{ secrets.FIREBASE_AUTH_DOMAIN }}
          FIREBASE_DATABASE_URL: ${{ secrets.FIREBASE_DATABASE_URL }}
          FIREBASE_PROJECT_ID: ${{ secrets.FIREBASE_PROJECT_ID }}
          FIREBASE_STORAGE_BUCKET: ${{ secrets.FIREBASE_STORAGE_BUCKET }}
          FIREBASE_MESSAGING_SENDER_ID: ${{ secrets.FIREBASE_MESSAGING_SENDER_ID }}
          FIREBASE_APP_ID: ${{ secrets.FIREBASE_APP_ID }}

      - name: Build application
        run: npm run build

      - name: Deploy to Firebase Hosting
        if: github.ref == 'refs/heads/main' || github.ref == 'refs/heads/master'
        uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: '${{ secrets.GITHUB_TOKEN }}'
          firebaseServiceAccount: '${{ secrets.FIREBASE_SERVICE_ACCOUNT }}'
          channelId: live
          projectId: ${{ secrets.FIREBASE_PROJECT_ID }}

      - name: Deploy Preview to Firebase Hosting
        if: github.event_name == 'pull_request'
        uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: '${{ secrets.GITHUB_TOKEN }}'
          firebaseServiceAccount: '${{ secrets.FIREBASE_SERVICE_ACCOUNT }}'
          channelId: pr-${{ github.event.number }}
          projectId: ${{ secrets.FIREBASE_PROJECT_ID }}
          expires: 7d
          disableComment: true

      - name: Get Preview URL
        if: github.event_name == 'pull_request'
        id: preview
        run: |
          echo "preview_url=https://pr-${{ github.event.number }}--${{ secrets.FIREBASE_PROJECT_ID }}.web.app" >> $GITHUB_OUTPUT

      - name: Comment PR with preview URL
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const previewUrl = '${{ steps.preview.outputs.preview_url }}';
            await github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `**Preview Deployment Ready**\n\nChanges are live at: ${previewUrl}\n\nThis preview expires in 7 days.`
            });
```

Key changes: `npm ci` instead of install+reinstall, `npx vitest run` instead of watch mode, removed `|| echo` from type check, removed `GEMINI_API_KEY` from build env, added concurrency group, removed overly broad `checks: write` and `issues: write` permissions.

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "fix(ci): deploy pipeline - use vitest run, npm ci, blocking type check, concurrency control"
```

---

### Task 2: Fix pr-check.yml

**Files:**

- Modify: `.github/workflows/pr-check.yml`

- [ ] **Step 1: Fix the PR check workflow**

Replace the entire file with:

```yaml
name: Pull Request Checks

on:
  pull_request:
    branches: [main, master]

concurrency:
  group: pr-check-${{ github.ref }}
  cancel-in-progress: true

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests with coverage
        run: npm run test:coverage

      - name: Type check
        run: npx tsc --noEmit

      - name: Build application
        run: npm run build

      - name: Upload coverage reports
        uses: codecov/codecov-action@v4
        with:
          file: ./coverage/lcov.info
          flags: unittests
          name: codecov-umbrella

  security:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run security audit
        run: npm audit --audit-level=moderate

  lint:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run ESLint
        run: npx eslint . --ext .ts,.tsx --max-warnings=0

      - name: Check Prettier formatting
        run: npx prettier --check .
```

Key changes: All gates are now blocking (removed `|| echo` and `continue-on-error`), `npm ci` instead of install+reinstall, removed `GEMINI_API_KEY`, removed Snyk (was pinned to mutable `@master` branch), added concurrency group.

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/pr-check.yml
git commit -m "fix(ci): pr-check pipeline - blocking gates, npm ci, remove snyk mutable ref"
```

---

### Task 3: Fix dependabot auto-merge

**Files:**

- Modify: `.github/workflows/dependabot.yml`

- [ ] **Step 1: Fix dependabot workflow to wait for CI**

Replace the entire file with:

```yaml
name: Dependabot Auto-merge

on:
  pull_request:
    types: [opened, synchronize, reopened]
  pull_request_review:
    types: [submitted]
  status: {}

jobs:
  dependabot:
    runs-on: ubuntu-latest
    if: ${{ github.actor == 'dependabot[bot]' }}

    steps:
      - name: Dependabot metadata
        id: metadata
        uses: dependabot/fetch-metadata@v2
        with:
          github-token: '${{ secrets.GITHUB_TOKEN }}'

      - name: Wait for CI checks
        if: ${{steps.metadata.outputs.update-type == 'version-update:semver-patch' || steps.metadata.outputs.update-type == 'version-update:semver-minor'}}
        run: |
          echo "Waiting for CI checks to pass..."
          gh pr checks "$PR_URL" --wait || exit 1
        env:
          PR_URL: ${{github.event.pull_request.html_url}}
          GITHUB_TOKEN: ${{secrets.GITHUB_TOKEN}}

      - name: Auto-merge Dependabot PRs
        if: ${{steps.metadata.outputs.update-type == 'version-update:semver-patch' || steps.metadata.outputs.update-type == 'version-update:semver-minor'}}
        run: gh pr merge --auto --merge "$PR_URL"
        env:
          PR_URL: ${{github.event.pull_request.html_url}}
          GITHUB_TOKEN: ${{secrets.GITHUB_TOKEN}}
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/dependabot.yml
git commit -m "fix(ci): dependabot waits for CI before auto-merge"
```

---

### Task 4: Fix generate-firebase-config validation

**Files:**

- Modify: `scripts/generate-firebase-config.cjs`

- [ ] **Step 1: Add validation to the config generation script**

Replace the entire file with:

```javascript
#!/usr/bin/env node

/**
 * Generates firebase.ts from environment variables
 * Used in CI/CD to create the Firebase configuration file
 */

const fs = require('fs');
const path = require('path');

const requiredVars = [
  'FIREBASE_API_KEY',
  'FIREBASE_AUTH_DOMAIN',
  'FIREBASE_DATABASE_URL',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_APP_ID',
];

const missing = requiredVars.filter((v) => !process.env[v]);
if (missing.length > 0) {
  console.error('Missing required Firebase config environment variables:', missing.join(', '));
  process.exit(1);
}

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.FIREBASE_DATABASE_URL,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.FIREBASE_APP_ID,
};

const firebaseTs = `// Firebase Configuration
// Auto-generated from environment variables

declare const firebase: any;

const firebaseConfig = {
  apiKey: "${firebaseConfig.apiKey}",
  authDomain: "${firebaseConfig.authDomain}",
  databaseURL: "${firebaseConfig.databaseURL}",
  projectId: "${firebaseConfig.projectId}",
  storageBucket: "${firebaseConfig.storageBucket}",
  messagingSenderId: "${firebaseConfig.messagingSenderId}",
  appId: "${firebaseConfig.appId}"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firebase Authentication and sign in anonymously
export const auth = firebase.auth();
export const db = firebase.database();
export const ServerValue = firebase.database.ServerValue;

// Sign in anonymously - this maintains privacy while securing the database
let authInitialized = false;
export const ensureAuthenticated = async (): Promise<void> => {
  if (authInitialized && auth.currentUser) {
    return;
  }

  try {
    await auth.signInAnonymously();
    authInitialized = true;
    console.log('Authenticated anonymously');
  } catch (error) {
    console.error('Authentication error:', error);
    throw error;
  }
};

// Auto-authenticate on page load
auth.onAuthStateChanged((user: any) => {
  if (user) {
    authInitialized = true;
  }
});
`;

const outputPath = path.join(__dirname, '..', 'firebase.ts');
fs.writeFileSync(outputPath, firebaseTs, 'utf8');
console.log('firebase.ts generated successfully');
```

- [ ] **Step 2: Commit**

```bash
git add scripts/generate-firebase-config.cjs
git commit -m "fix(ci): validate firebase config secrets before generating"
```

---

## Phase 2: Security Fixes

### Task 5: Fix Firebase security rules

**Files:**

- Modify: `database.rules.json`

- [ ] **Step 1: Rewrite Firebase security rules**

Replace the entire file with:

```json
{
  "rules": {
    "calls": {
      "$callId": {
        ".read": "auth != null",
        ".write": "auth != null && (!data.exists() && newData.hasChildren(['callerId']) || data.child('callerId').val() === auth.uid || data.child('joinerId').val() === auth.uid || (data.exists() && !data.hasChild('answer') && newData.hasChild('answer')))",
        ".validate": "newData.hasChildren(['callerId'])",
        "callerId": {
          ".validate": "newData.isString() && newData.val() === auth.uid"
        },
        "callId": {
          ".validate": "newData.isString() && newData.val() === $callId"
        },
        "joinerId": {
          ".validate": "newData.isString()"
        },
        "offer": {
          ".validate": "newData.isString()"
        },
        "answer": {
          ".validate": "newData.isString()"
        },
        "encryptionKey": {
          ".validate": "newData.hasChildren()"
        },
        "declined": {
          ".validate": "newData.isBoolean()"
        },
        "offerCandidates": {
          "$candidateId": {
            ".validate": "newData.hasChildren(['candidate', 'sdpMLineIndex', 'sdpMid'])"
          }
        },
        "answerCandidates": {
          "$candidateId": {
            ".validate": "newData.hasChildren(['candidate', 'sdpMLineIndex', 'sdpMid'])"
          }
        }
      }
    },
    "users": {
      "$userId": {
        ".read": "auth != null && auth.uid === $userId",
        ".write": "auth != null",
        "incomingCall": {
          ".validate": "newData.hasChildren(['from', 'callId'])",
          "from": {
            ".validate": "newData.isString() && newData.val() === auth.uid"
          },
          "callId": {
            ".validate": "newData.isString()"
          },
          "callerAlias": {
            ".validate": "newData.isString()"
          }
        }
      }
    },
    "status": {
      "$userId": {
        ".read": "auth != null",
        ".write": "auth != null && auth.uid === $userId",
        ".validate": "newData.hasChildren(['isOnline', 'lastChanged'])",
        "isOnline": {
          ".validate": "newData.isBoolean()"
        },
        "lastChanged": {
          ".validate": "newData.isNumber()"
        }
      }
    }
  }
}
```

Key changes: `.read: true` replaced with `auth != null` on calls, `callerId` must equal `auth.uid` (prevents spoofing), `from` in `incomingCall` must equal `auth.uid` (prevents impersonation), removed `declined === true` write bypass.

- [ ] **Step 2: Commit**

```bash
git add database.rules.json
git commit -m "fix(security): require auth for reads, prevent caller impersonation"
```

---

### Task 6: Remove GEMINI_API_KEY from client bundle

**Files:**

- Modify: `vite.config.ts`

- [ ] **Step 1: Remove GEMINI_API_KEY injection**

Replace `vite.config.ts` with:

```typescript
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add vite.config.ts
git commit -m "fix(security): remove GEMINI_API_KEY injection from client bundle"
```

---

### Task 7: Add CSP header to firebase.json

**Files:**

- Modify: `firebase.json`

- [ ] **Step 1: Add CSP and cache headers**

Replace the `headers` section in `firebase.json`. The full file becomes:

```json
{
  "database": {
    "rules": "database.rules.json"
  },
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**", "firebase.ts"],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ],
    "headers": [
      {
        "source": "**",
        "headers": [
          {
            "key": "Strict-Transport-Security",
            "value": "max-age=31536000; includeSubDomains"
          },
          {
            "key": "X-Content-Type-Options",
            "value": "nosniff"
          },
          {
            "key": "X-Frame-Options",
            "value": "DENY"
          },
          {
            "key": "X-XSS-Protection",
            "value": "1; mode=block"
          },
          {
            "key": "Referrer-Policy",
            "value": "strict-origin-when-cross-origin"
          },
          {
            "key": "Content-Security-Policy",
            "value": "default-src 'self'; script-src 'self' 'unsafe-eval' https://www.gstatic.com https://aistudiocdn.com; connect-src * data: blob:; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; media-src * blob:; font-src 'self'"
          }
        ]
      }
    ]
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add firebase.json
git commit -m "fix(security): add Content-Security-Policy header"
```

---

## Phase 3: Critical Bug Fixes in useWebRTC

### Task 8: Fix double initMedia and stale closures

**Files:**

- Modify: `hooks/useWebRTC.ts`

This is the most complex change. The fixes are:

1. Remove the `useEffect` that re-calls `initMedia` when `callState` becomes `LOBBY`
2. Remove `isMuted`/`isVideoOff` from `initMedia` deps (don't re-init stream on mute toggle)
3. Use refs for values read inside Firebase callbacks to avoid stale closures
4. Add try/catch around all async WebRTC operations
5. Add a guard flag to prevent concurrent `initiateCall`/`joinCall`
6. Fix `cleanUp` to use ref for remote stream

- [ ] **Step 1: Rewrite useWebRTC.ts**

Replace the entire file with:

```typescript
import { useState, useRef, useCallback, useEffect } from 'react';
import { STUN_SERVERS } from '../constants';
import { CallState, CallStats, PinnedEntry } from '../types';
import { db } from '../firebase';
import { generateCallId } from '../utils/id';
import { getUserId, getUserDisplayName } from '../utils/user';
import { generateKey, importKey, setupE2EE } from '../utils/crypto';

const MAX_RECONNECTION_ATTEMPTS = 3;
const RING_TIMEOUT_MS = 30000;

const RESOLUTION_CONSTRAINTS = {
  '1080p': { width: { ideal: 1920 }, height: { ideal: 1080 } },
  '720p': { width: { ideal: 1280 }, height: { ideal: 720 } },
  '480p': { width: { ideal: 854 }, height: { ideal: 480 } },
};

export const useWebRTC = (initialResolution: string) => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>('new');
  const [callState, setCallState] = useState<CallState>(CallState.IDLE);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isRemoteMuted, setIsRemoteMuted] = useState(false);
  const [isRemoteVideoOff, setIsRemoteVideoOff] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [callId, setCallId] = useState<string | null>(null);
  const [peerId, setPeerId] = useState<string | null>(null);
  const [isE2EEActive, setIsE2EEActive] = useState(false);
  const [callStats, setCallStats] = useState<CallStats | null>(null);
  const [resolution, setResolution] = useState<string>(initialResolution);
  const [enableE2EE, setEnableE2EE] = useState(true);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const encryptionKeyRef = useRef<CryptoKey | null>(null);
  const callDocRef = useRef<any>(null);
  const answerCandidatesRef = useRef<any>(null);
  const offerCandidatesRef = useRef<any>(null);

  const reconnectionAttemptsRef = useRef(0);
  const isCallerRef = useRef(false);
  const reconnectionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ringingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastStatsRef = useRef<{
    timestamp: number;
    totalBytesSent: number;
    totalBytesReceived: number;
  } | null>(null);
  const hasConnectedOnceRef = useRef(false);

  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const onChatMessageCallbackRef = useRef<((data: string) => void) | null>(null);

  // Ref-based flag to prevent concurrent async call operations
  const isOperationInProgressRef = useRef(false);

  // Keep state refs current for use inside callbacks without stale closures
  const callStateRef = useRef<CallState>(callState);
  const peerIdRef = useRef<string | null>(peerId);
  const enableE2EERef = useRef(enableE2EE);
  const isMutedRef = useRef(isMuted);
  const isVideoOffRef = useRef(isVideoOff);

  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);
  useEffect(() => {
    peerIdRef.current = peerId;
  }, [peerId]);
  useEffect(() => {
    enableE2EERef.current = enableE2EE;
  }, [enableE2EE]);
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);
  useEffect(() => {
    isVideoOffRef.current = isVideoOff;
  }, [isVideoOff]);
  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);
  useEffect(() => {
    remoteStreamRef.current = remoteStream;
  }, [remoteStream]);

  const setOnChatMessage = useCallback((callback: (data: string) => void) => {
    onChatMessageCallbackRef.current = callback;
  }, []);

  const sendDataChannelMessage = useCallback((message: object) => {
    if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
      dataChannelRef.current.send(JSON.stringify(message));
    }
  }, []);

  const sendMessage = useCallback(
    (chatMessage: string) => {
      sendDataChannelMessage({ type: 'chat', payload: chatMessage });
    },
    [sendDataChannelMessage],
  );

  const handleDataChannelMessage = useCallback((event: MessageEvent) => {
    try {
      const message = JSON.parse(event.data);
      if (message.type === 'chat' && typeof message.payload === 'string') {
        onChatMessageCallbackRef.current?.(message.payload);
      } else if (message.type === 'control') {
        const { type, value } = message.payload;
        if (type === 'mute') {
          setIsRemoteMuted(!!value);
        } else if (type === 'video') {
          setIsRemoteVideoOff(!!value);
        }
      }
    } catch (e) {
      if (typeof event.data === 'string') {
        onChatMessageCallbackRef.current?.(event.data);
      }
      console.warn('Could not parse data channel message:', event.data, e);
    }
  }, []);

  const cleanUp = useCallback((keepCallDoc = false) => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    setLocalStream(null);

    const rs = remoteStreamRef.current;
    if (rs) {
      rs.getTracks().forEach((track) => track.stop());
      setRemoteStream(null);
    }

    if (callDocRef.current) callDocRef.current.off();
    if (answerCandidatesRef.current) answerCandidatesRef.current.off();
    if (offerCandidatesRef.current) offerCandidatesRef.current.off();

    if (reconnectionTimerRef.current) clearTimeout(reconnectionTimerRef.current);
    if (ringingTimeoutRef.current) clearTimeout(ringingTimeoutRef.current);
    if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);

    reconnectionTimerRef.current = null;
    ringingTimeoutRef.current = null;
    statsIntervalRef.current = null;

    if (callDocRef.current && !keepCallDoc) callDocRef.current.remove();

    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }
    onChatMessageCallbackRef.current = null;

    callDocRef.current = null;
    answerCandidatesRef.current = null;
    offerCandidatesRef.current = null;
    encryptionKeyRef.current = null;
    lastStatsRef.current = null;
    hasConnectedOnceRef.current = false;
    isOperationInProgressRef.current = false;
    setIsE2EEActive(false);
    setIsRemoteMuted(false);
    setIsRemoteVideoOff(false);
    setCallStats(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
      if (reconnectionTimerRef.current) clearTimeout(reconnectionTimerRef.current);
      if (ringingTimeoutRef.current) clearTimeout(ringingTimeoutRef.current);
    };
  }, []);

  const hangUp = useCallback(() => {
    cleanUp();
    setCallState(CallState.ENDED);
  }, [cleanUp]);

  const declineCall = useCallback(
    async (incomingCallId: string, peerToRingId?: string) => {
      const myUserId = getUserId();
      const callRef = db.ref(`calls/${incomingCallId}`);

      try {
        if (peerToRingId) {
          const calleeIncomingCallRef = db.ref(`users/${peerToRingId}/incomingCall`);
          await calleeIncomingCallRef.remove();
        } else {
          const myIncomingCallRef = db.ref(`users/${myUserId}/incomingCall`);
          await myIncomingCallRef.remove();
        }

        await callRef.update({ declined: true });
      } catch (error) {
        console.error('Error declining call:', error);
      }

      cleanUp(true);
      setTimeout(() => callRef.remove(), 2000);
      setCallState(CallState.IDLE);
    },
    [cleanUp],
  );

  const reset = useCallback(() => {
    cleanUp();
    setCallId(null);
    setPeerId(null);
    setErrorMessage(null);
    setConnectionState('new');
    setCallState(CallState.IDLE);
  }, [cleanUp]);

  const initMedia = useCallback(async (res: string) => {
    try {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }

      setErrorMessage(null);

      const videoConstraints =
        RESOLUTION_CONSTRAINTS[res as keyof typeof RESOLUTION_CONSTRAINTS] ||
        RESOLUTION_CONSTRAINTS['720p'];
      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: true,
      });

      // Apply current mute/video state to new stream via refs to avoid dependency
      const currentMuted = isMutedRef.current;
      const currentVideoOff = isVideoOffRef.current;
      stream.getAudioTracks().forEach((t) => {
        t.enabled = !currentMuted;
      });
      stream.getVideoTracks().forEach((t) => {
        t.enabled = !currentVideoOff;
      });
      setLocalStream(stream);
      return stream;
    } catch (error) {
      console.error('Error accessing media devices.', error);
      let message =
        'Could not access camera and microphone. Please check your system settings and browser permissions.';
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          message =
            'Permission denied. Please allow this site to access your camera and microphone in your browser settings.';
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
          message =
            'No camera or microphone found. Please ensure your devices are connected and enabled.';
        } else if (error.name === 'OverconstrainedError') {
          message = `The selected resolution (${res}) is not supported by your device. Try a lower quality.`;
        }
      }
      setErrorMessage(message);
      setCallState(CallState.MEDIA_ERROR);
      return null;
    }
  }, []);

  const enterLobby = useCallback(async () => {
    const stream = await initMedia(resolution);
    if (stream) {
      setCallState(CallState.LOBBY);
    }
  }, [initMedia, resolution]);

  const restartIce = useCallback(async () => {
    const pc = peerConnectionRef.current;
    if (!pc || !callDocRef.current) return;

    try {
      const offerDescription = await pc.createOffer({ iceRestart: true });
      await pc.setLocalDescription(offerDescription);

      const offer = {
        sdp: offerDescription.sdp,
        type: offerDescription.type,
      };

      await callDocRef.current.update({ offer });
    } catch (error) {
      console.error('Failed to restart ICE connection:', error);
      hangUp();
    }
  }, [hangUp]);

  const createPeerConnection = useCallback(
    (stream: MediaStream) => {
      const pc = new RTCPeerConnection(STUN_SERVERS);

      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      pc.ontrack = (event) => {
        remoteStreamRef.current = event.streams[0];
        setRemoteStream(event.streams[0]);
      };

      pc.ondatachannel = (event) => {
        dataChannelRef.current = event.channel;
        dataChannelRef.current.onmessage = handleDataChannelMessage;
        dataChannelRef.current.onopen = () => {
          console.log('Data channel opened.');
          sendDataChannelMessage({ type: 'control', payload: { type: 'mute', value: isMuted } });
          sendDataChannelMessage({
            type: 'control',
            payload: { type: 'video', value: isVideoOff },
          });
        };
        dataChannelRef.current.onclose = () => console.log('Data channel closed by peer.');
      };

      pc.onconnectionstatechange = () => {
        if (!pc) return;
        setConnectionState(pc.connectionState);

        if (pc.connectionState === 'connected') {
          hasConnectedOnceRef.current = true;
          if (ringingTimeoutRef.current) clearTimeout(ringingTimeoutRef.current);
          reconnectionAttemptsRef.current = 0;
          if (reconnectionTimerRef.current) {
            clearTimeout(reconnectionTimerRef.current);
            reconnectionTimerRef.current = null;
          }
          if (statsIntervalRef.current) {
            clearInterval(statsIntervalRef.current);
          }
          statsIntervalRef.current = setInterval(async () => {
            if (peerConnectionRef.current) {
              const stats = await peerConnectionRef.current.getStats();
              const newStats: CallStats = {
                packetsLost: null,
                jitter: null,
                roundTripTime: null,
                uploadBitrate: null,
                downloadBitrate: null,
              };
              let totalBytesSent = 0;
              let totalBytesReceived = 0;
              const now = Date.now();

              stats.forEach((report) => {
                if (report.type === 'remote-inbound-rtp' && report.kind === 'video') {
                  newStats.packetsLost = report.packetsLost;
                  newStats.jitter = report.jitter ? Math.round(report.jitter * 1000) : null;
                }
                if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                  newStats.roundTripTime = report.currentRoundTripTime
                    ? Math.round(report.currentRoundTripTime * 1000)
                    : null;
                }
                if (report.type === 'outbound-rtp') {
                  totalBytesSent += report.bytesSent;
                }
                if (report.type === 'inbound-rtp') {
                  totalBytesReceived += report.bytesReceived;
                }
              });

              if (lastStatsRef.current) {
                const timeDiffSeconds = (now - lastStatsRef.current.timestamp) / 1000;
                if (timeDiffSeconds > 0) {
                  const sentDiff = totalBytesSent - lastStatsRef.current.totalBytesSent;
                  const receivedDiff = totalBytesReceived - lastStatsRef.current.totalBytesReceived;
                  newStats.uploadBitrate = Math.round((sentDiff * 8) / (timeDiffSeconds * 1000));
                  newStats.downloadBitrate = Math.round(
                    (receivedDiff * 8) / (timeDiffSeconds * 1000),
                  );
                }
              }
              lastStatsRef.current = { timestamp: now, totalBytesSent, totalBytesReceived };
              setCallStats(newStats);
            }
          }, 1000);

          setCallState(CallState.CONNECTED);
          if (encryptionKeyRef.current) {
            if (setupE2EE(pc, encryptionKeyRef.current)) {
              setIsE2EEActive(true);
            }
          }
        } else if (pc.connectionState === 'failed') {
          console.error('Peer connection failed. Hanging up.');
          hangUp();
        } else if (pc.connectionState === 'disconnected') {
          setIsE2EEActive(false);
          setCallStats(null);
          if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
          lastStatsRef.current = null;

          if (
            isCallerRef.current &&
            reconnectionAttemptsRef.current < MAX_RECONNECTION_ATTEMPTS &&
            !reconnectionTimerRef.current
          ) {
            reconnectionTimerRef.current = setTimeout(() => {
              reconnectionAttemptsRef.current++;
              console.log(
                `Connection lost. Attempting to reconnect... (Attempt ${reconnectionAttemptsRef.current})`,
              );
              setCallState(CallState.RECONNECTING);

              reconnectionTimerRef.current = null;

              restartIce();
            }, 2000 * reconnectionAttemptsRef.current);
          } else if (
            reconnectionAttemptsRef.current >= MAX_RECONNECTION_ATTEMPTS &&
            callStateRef.current !== CallState.ENDED
          ) {
            console.log('Reconnection failed after maximum attempts.');
            hangUp();
          }
        } else if (pc.connectionState === 'closed') {
          setIsE2EEActive(false);
          setCallStats(null);
          if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
          lastStatsRef.current = null;
        }
      };

      peerConnectionRef.current = pc;
      setConnectionState(pc.connectionState);
      return pc;
    },
    [restartIce, hangUp, handleDataChannelMessage, sendDataChannelMessage, isMuted, isVideoOff],
  );

  const initiateCall = useCallback(
    async (id: string, isRinging: boolean = false) => {
      if (isOperationInProgressRef.current) return;
      if (!localStreamRef.current) {
        console.error('Cannot initiate call without a local stream.');
        setCallState(CallState.MEDIA_ERROR);
        return;
      }
      isOperationInProgressRef.current = true;
      setCallState(isRinging ? CallState.RINGING : CallState.CREATING_OFFER);
      isCallerRef.current = true;
      reconnectionAttemptsRef.current = 0;

      try {
        const pc = createPeerConnection(localStreamRef.current);
        setCallId(id);

        const dc = pc.createDataChannel('chat');
        dc.onclose = () => console.log('Data channel closed.');
        dc.onmessage = handleDataChannelMessage;
        dataChannelRef.current = dc;

        callDocRef.current = db.ref(`calls/${id}`);
        offerCandidatesRef.current = callDocRef.current.child('offerCandidates');
        answerCandidatesRef.current = callDocRef.current.child('answerCandidates');

        pc.onicecandidate = (event) => {
          if (event.candidate && offerCandidatesRef.current) {
            offerCandidatesRef.current.push(event.candidate.toJSON());
          }
        };

        const offerDescription = await pc.createOffer();
        await pc.setLocalDescription(offerDescription);

        const offer = {
          sdp: offerDescription.sdp,
          type: offerDescription.type,
        };

        const callerId = getUserId();
        const callDataToSet: { [key: string]: any } = { offer, callerId, callId: id };

        if (enableE2EERef.current) {
          const { key, rawKey } = await generateKey();
          encryptionKeyRef.current = key;
          const exportableKey = Array.from(new Uint8Array(rawKey));
          callDataToSet.encryptionKey = exportableKey;
        } else {
          encryptionKeyRef.current = null;
        }

        await callDocRef.current.set(callDataToSet);

        callDocRef.current.on('value', async (snapshot: any) => {
          const data = snapshot.val();
          if (!data) {
            if (
              callStateRef.current !== CallState.IDLE &&
              callStateRef.current !== CallState.ENDED
            ) {
              hangUp();
            }
            return;
          }

          if (data?.declined) {
            setCallState(CallState.DECLINED);
            cleanUp();
            return;
          }

          if (data?.joinerId && !peerIdRef.current) {
            setPeerId(data.joinerId);
          }

          if (
            data?.answer &&
            (!pc.currentRemoteDescription || pc.currentRemoteDescription.sdp !== data.answer.sdp)
          ) {
            try {
              const answerDescription = new RTCSessionDescription(data.answer);
              await pc.setRemoteDescription(answerDescription);
            } catch (error) {
              console.error('Error setting remote description:', error);
            }
          }
        });

        answerCandidatesRef.current.on('child_added', (snapshot: any) => {
          try {
            const candidate = new RTCIceCandidate(snapshot.val());
            pc.addIceCandidate(candidate);
          } catch (error) {
            console.error('Error adding ICE candidate:', error);
          }
        });

        if (!isRinging) {
          setCallState(CallState.WAITING_FOR_ANSWER);
        }

        // Open data channel after setup
        dc.onopen = () => {
          console.log('Data channel opened.');
          sendDataChannelMessage({ type: 'control', payload: { type: 'mute', value: isMuted } });
          sendDataChannelMessage({
            type: 'control',
            payload: { type: 'video', value: isVideoOff },
          });
        };
      } catch (error) {
        console.error('Error initiating call:', error);
        cleanUp();
        setCallState(CallState.IDLE);
      }
    },
    [
      createPeerConnection,
      hangUp,
      cleanUp,
      handleDataChannelMessage,
      sendDataChannelMessage,
      isMuted,
      isVideoOff,
    ],
  );

  const ringUser = useCallback(
    async (peer: PinnedEntry) => {
      if (!peer.peerId) {
        console.error('Cannot ring user without a peer ID.');
        return;
      }
      const newCallId = generateCallId();
      setPeerId(peer.peerId);
      setCallId(newCallId);

      const myUserId = getUserId();
      const myDisplayName = getUserDisplayName();
      const incomingCallRef = db.ref(`users/${peer.peerId}/incomingCall`);

      const callPayload: { from: string; callId: string; callerAlias?: string } = {
        from: myUserId,
        callId: newCallId,
      };

      if (myDisplayName) {
        callPayload.callerAlias = myDisplayName;
      }

      await incomingCallRef.set(callPayload);

      await initiateCall(newCallId, true);

      ringingTimeoutRef.current = setTimeout(() => {
        declineCall(newCallId, peer.peerId);
      }, RING_TIMEOUT_MS);
    },
    [initiateCall, declineCall],
  );

  const startCall = useCallback(async () => {
    const newCallId = generateCallId();
    await initiateCall(newCallId);
  }, [initiateCall]);

  const joinCall = useCallback(
    async (id: string) => {
      if (isOperationInProgressRef.current) return;
      isOperationInProgressRef.current = true;
      isCallerRef.current = false;
      reconnectionAttemptsRef.current = 0;

      try {
        const callRef = db.ref(`calls/${id}`);
        const callSnapshot = await callRef.get();
        const callData = callSnapshot.val();

        if (callData?.offer) {
          if (!localStreamRef.current) {
            console.error('Cannot join call without a local stream.');
            setCallState(CallState.MEDIA_ERROR);
            isOperationInProgressRef.current = false;
            return;
          }
          setCallState(CallState.JOINING);

          const initialOfferSdp = callData.offer.sdp;

          if (callData.callerId) {
            setPeerId(callData.callerId);
          }

          if (callData.encryptionKey) {
            const rawKey = new Uint8Array(callData.encryptionKey).buffer;
            encryptionKeyRef.current = await importKey(rawKey);
          } else {
            console.warn('Call does not support E2EE: encryption key missing.');
          }

          const pc = createPeerConnection(localStreamRef.current);
          setCallId(id);

          callDocRef.current = callRef;
          offerCandidatesRef.current = callDocRef.current.child('offerCandidates');
          answerCandidatesRef.current = callDocRef.current.child('answerCandidates');

          pc.onicecandidate = (event) => {
            if (event.candidate && answerCandidatesRef.current) {
              answerCandidatesRef.current.push(event.candidate.toJSON());
            }
          };

          await pc.setRemoteDescription(new RTCSessionDescription(callData.offer));

          const answerDescription = await pc.createAnswer();
          await pc.setLocalDescription(answerDescription);

          const answer = {
            type: answerDescription.type,
            sdp: answerDescription.sdp,
          };

          const joinerId = getUserId();
          await callDocRef.current.update({ answer, joinerId });

          const calleeIncomingCallRef = db.ref(`users/${joinerId}/incomingCall`);
          await calleeIncomingCallRef.remove();

          offerCandidatesRef.current.on('child_added', (snapshot: any) => {
            try {
              const candidate = new RTCIceCandidate(snapshot.val());
              pc.addIceCandidate(candidate);
            } catch (error) {
              console.error('Error adding ICE candidate:', error);
            }
          });

          callDocRef.current.on('value', async (snapshot: any) => {
            const data = snapshot.val();
            if (!data) {
              if (
                callStateRef.current !== CallState.IDLE &&
                callStateRef.current !== CallState.ENDED
              ) {
                hangUp();
              }
              return;
            }

            if (data?.offer && data.offer.sdp !== initialOfferSdp) {
              console.log('Received a new offer for reconnection.');
              setCallState(CallState.RECONNECTING);
              try {
                await pc.setRemoteDescription(new RTCSessionDescription(data.offer));

                const newAnswerDescription = await pc.createAnswer();
                await pc.setLocalDescription(newAnswerDescription);

                const newAnswer = {
                  type: newAnswerDescription.type,
                  sdp: newAnswerDescription.sdp,
                };

                await callDocRef.current.update({ answer: newAnswer });
              } catch (error) {
                console.error('Error handling reconnection offer:', error);
              }
            }
          });

          setCallState(CallState.CREATING_ANSWER);
        } else {
          console.log(`Call ID "${id}" is available. Initializing a new call.`);
          await initiateCall(id);
        }
      } catch (error) {
        console.error('Error joining call:', error);
        cleanUp();
        setCallState(CallState.IDLE);
      }
    },
    [createPeerConnection, hangUp, initiateCall, cleanUp],
  );

  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const newMutedState = !isMuted;
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !newMutedState;
      });
      setIsMuted(newMutedState);
      sendDataChannelMessage({ type: 'control', payload: { type: 'mute', value: newMutedState } });
    }
  }, [isMuted, sendDataChannelMessage]);

  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const newVideoState = !isVideoOff;
      localStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = newVideoState;
      });
      setIsVideoOff(!newVideoState);
      sendDataChannelMessage({
        type: 'control',
        payload: { type: 'video', value: !newVideoState },
      });
    }
  }, [isVideoOff, sendDataChannelMessage]);

  // Clean up on page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (callStateRef.current !== CallState.IDLE && callStateRef.current !== CallState.ENDED) {
        if (callDocRef.current) {
          callDocRef.current.remove();
        }
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  return {
    localStream,
    remoteStream,
    connectionState,
    isMuted,
    isVideoOff,
    callState,
    setCallState,
    errorMessage,
    callId,
    peerId,
    isE2EEActive,
    callStats,
    resolution,
    setResolution,
    isRemoteMuted,
    isRemoteVideoOff,
    enableE2EE,
    setEnableE2EE,
    enterLobby,
    startCall,
    joinCall,
    ringUser,
    declineCall,
    toggleMute,
    toggleVideo,
    hangUp,
    reset,
    setOnChatMessage,
    sendMessage,
  };
};
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors (or only pre-existing errors unrelated to this file)

- [ ] **Step 3: Commit**

```bash
git add hooks/useWebRTC.ts
git commit -m "fix(webrtc): double initMedia, stale closures, concurrent call guards, try/catch"
```

---

## Phase 4: Code Quality & Deduplication

### Task 9: Extract shared icon components

**Files:**

- Create: `components/icons.tsx`
- Modify: `components/Controls.tsx`
- Modify: `components/Lobby.tsx`
- Modify: `components/CallHistory.tsx`
- Modify: `components/PinnedCalls.tsx`
- Modify: `components/ChatPanel.tsx`
- Modify: `components/ConnectionManager.tsx`
- Modify: `components/FloatingVideo.tsx`
- Modify: `components/IncomingCall.tsx`
- Modify: `components/LocalVideoPreview.tsx`
- Modify: `components/Tools.tsx`
- Modify: `components/MediaErrorScreen.tsx`

- [ ] **Step 1: Create `components/icons.tsx`**

Create a new file that exports all shared icons used across the app. This file should contain every icon SVG component currently duplicated across component files. Use this pattern:

```typescript
import React from 'react';

type IconProps = { className?: string };

export const MuteIcon: React.FC<IconProps> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
  </svg>
);

export const UnmuteIcon: React.FC<IconProps> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
  </svg>
);

export const VideoOnIcon: React.FC<IconProps> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);

export const VideoOffIcon: React.FC<IconProps> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
  </svg>
);

export const HangUpIcon: React.FC<IconProps> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
  </svg>
);

export const ChatIcon: React.FC<IconProps> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
  </svg>
);

export const SendIcon: React.FC<IconProps> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
  </svg>
);

export const CheckIcon: React.FC<IconProps> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

export const CancelIcon: React.FC<IconProps> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

export const EditIcon: React.FC<IconProps> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);

export const PinIcon: React.FC<IconProps> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
  </svg>
);

export const PinnedIcon: React.FC<IconProps> = ({ className }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
  </svg>
);

export const CallIcon: React.FC<IconProps> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
  </svg>
);

export const DownloadIcon: React.FC<IconProps> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

export const UploadIcon: React.FC<IconProps> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
  </svg>
);

export const DeleteIcon: React.FC<IconProps> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

export const CopyIcon: React.FC<IconProps> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
  </svg>
);

export const UserIcon: React.FC<IconProps> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

export const HistoryIcon: React.FC<IconProps> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

export const RejoinIcon: React.FC<IconProps> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
  </svg>
);

export const ErrorIcon: React.FC<IconProps> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

export const AcceptCallIcon: React.FC<IconProps> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
  </svg>
);

export const DeclineCallIcon: React.FC<IconProps> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" transform="rotate(135 12 12)" />
  </svg>
);
```

- [ ] **Step 2: Update each component to import from `icons.tsx`**

For each component file, remove the locally-defined icon components and add an import like:

```typescript
import { MuteIcon, UnmuteIcon } from './icons';
```

The exact imports depend on which icons each file uses. This is a mechanical change: delete the local icon definitions, add the import, verify the names match.

Files to update:

- `components/Controls.tsx` — uses `MuteIcon`, `UnmuteIcon`, `VideoOnIcon`, `VideoOffIcon`, `HangUpIcon`, `ChatIcon`
- `components/Lobby.tsx` — uses `MuteIcon`, `UnmuteIcon`, `VideoOnIcon`, `VideoOffIcon`
- `components/CallHistory.tsx` — uses `RejoinIcon`, `EditIcon`, `CheckIcon`, `CancelIcon`, `PinIcon`, `PinnedIcon`, `UserIcon`, `HistoryIcon`, `DeleteIcon`
- `components/PinnedCalls.tsx` — uses `CallIcon`, `EditIcon`, `CheckIcon`, `CancelIcon`, `PinIcon`
- `components/ChatPanel.tsx` — uses `SendIcon`
- `components/ConnectionManager.tsx` — uses `CheckIcon`, `CopyIcon`
- `components/FloatingVideo.tsx` — uses `MutedIcon` (may need slight rename)
- `components/IncomingCall.tsx` — uses `AcceptIcon`, `DeclineIcon`
- `components/LocalVideoPreview.tsx` — uses `UnmuteIcon`, `VideoOffIcon`
- `components/Tools.tsx` — uses `DownloadIcon`, `UploadIcon`
- `components/MediaErrorScreen.tsx` — uses `ErrorIcon`

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Successful build

- [ ] **Step 4: Commit**

```bash
git add components/icons.tsx components/Controls.tsx components/Lobby.tsx components/CallHistory.tsx components/PinnedCalls.tsx components/ChatPanel.tsx components/ConnectionManager.tsx components/FloatingVideo.tsx components/IncomingCall.tsx components/LocalVideoPreview.tsx components/Tools.tsx components/MediaErrorScreen.tsx
git commit -m "refactor: extract shared icon components to icons.tsx"
```

---

### Task 10: Deduplicate generateUUID and fix imports

**Files:**

- Modify: `utils/user.ts`
- Modify: `utils/history.ts`
- Modify: `utils/pins.ts`

- [ ] **Step 1: Update `utils/user.ts` to import generateUUID from `utils/id.ts`**

```typescript
import { generateUUID } from './id';

const USER_ID_KEY = 'p2p-user-id';

export const getUserId = (): string => {
  let userId = localStorage.getItem(USER_ID_KEY);
  if (!userId) {
    userId = generateUUID();
    localStorage.setItem(USER_ID_KEY, userId);
  }
  return userId;
};

const USER_DISPLAY_NAME_KEY = 'p2p-user-display-name';

export const getUserDisplayName = (): string | null => {
  return localStorage.getItem(USER_DISPLAY_NAME_KEY);
};

export const saveUserDisplayName = (name: string): void => {
  if (name && name.trim()) {
    localStorage.setItem(USER_DISPLAY_NAME_KEY, name.trim());
  } else {
    localStorage.removeItem(USER_DISPLAY_NAME_KEY);
  }
};
```

- [ ] **Step 2: Fix relative imports in `utils/history.ts` and `utils/pins.ts`**

In `utils/history.ts`, change:

```typescript
import { CallHistoryEntry } from '../types';
```

to:

```typescript
import { CallHistoryEntry } from '@/types';
```

In `utils/pins.ts`, change:

```typescript
import { PinnedEntry } from '../types';
```

to:

```typescript
import { PinnedEntry } from '@/types';
```

- [ ] **Step 3: Commit**

```bash
git add utils/user.ts utils/history.ts utils/pins.ts
git commit -m "refactor: deduplicate generateUUID, use @/ path alias consistently"
```

---

### Task 11: Delete empty QRScanner and fix minor issues

**Files:**

- Delete: `components/QRScanner.tsx`
- Modify: `index.css`

- [ ] **Step 1: Delete empty QRScanner**

```bash
git rm components/QRScanner.tsx
```

- [ ] **Step 2: Fix conflicting background color in `index.css`**

In `index.css`, change line 11-12 from:

```css
@apply bg-gray-950 text-slate-200 antialiased font-sans;
background-color: #0d1117;
```

to:

```css
@apply text-slate-200 antialiased font-sans;
background-color: #0d1117;
```

Also change line 36 from:

```css
border: transparent;
```

to:

```css
border-color: transparent;
```

- [ ] **Step 3: Commit**

```bash
git add index.css
git commit -m "chore: remove empty QRScanner, fix conflicting CSS"
```

---

## Phase 5: Hook Fixes

### Task 12: Fix usePresence cleanup

**Files:**

- Modify: `hooks/usePresence.ts`

- [ ] **Step 1: Rewrite usePresence with proper cleanup**

```typescript
import { useEffect, useRef } from 'react';
import { db, ServerValue } from '../firebase';

export const usePresence = (userId: string | null) => {
  const onDisconnectRef = useRef<any>(null);

  useEffect(() => {
    if (!userId) return;

    const userStatusRef = db.ref(`/status/${userId}`);
    const connectedRef = db.ref('.info/connected');

    const listener = connectedRef.on('value', (snapshot: any) => {
      if (snapshot.val() === false) {
        return;
      }

      const onDisconnect = userStatusRef.onDisconnect();
      onDisconnectRef.current = onDisconnect;

      onDisconnect
        .set({
          isOnline: false,
          lastChanged: ServerValue.TIMESTAMP,
        })
        .then(() => {
          userStatusRef.set({
            isOnline: true,
            lastChanged: ServerValue.TIMESTAMP,
          });
        })
        .catch((error: Error) => {
          console.error('Error setting presence:', error);
        });
    });

    return () => {
      connectedRef.off('value', listener);
      // Cancel onDisconnect handler and explicitly go offline
      if (onDisconnectRef.current) {
        onDisconnectRef.current.cancel().catch(() => {});
        onDisconnectRef.current = null;
      }
      userStatusRef
        .set({
          isOnline: false,
          lastChanged: ServerValue.TIMESTAMP,
        })
        .catch(() => {});
    };
  }, [userId]);
};
```

- [ ] **Step 2: Commit**

```bash
git add hooks/usePresence.ts
git commit -m "fix(presence): cancel onDisconnect and set offline on unmount"
```

---

### Task 13: Fix usePeerStatus array stability

**Files:**

- Modify: `hooks/usePeerStatus.ts`
- Modify: `App.tsx` (to stabilize the peerIds memo)

- [ ] **Step 1: Rewrite usePeerStatus to handle stale entries**

```typescript
import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { PeerStatus } from '../types';

export const usePeerStatus = (peerIds: string[]) => {
  const [peerStatus, setPeerStatus] = useState<{ [key: string]: PeerStatus }>({});

  useEffect(() => {
    const listeners: { [key: string]: (snapshot: any) => void } = {};

    // Clear stale entries for peers no longer in the list
    setPeerStatus((prev) => {
      const next: { [key: string]: PeerStatus } = {};
      peerIds.forEach((id) => {
        if (prev[id]) next[id] = prev[id];
      });
      return next;
    });

    peerIds.forEach((id) => {
      const peerStatusRef = db.ref(`/status/${id}`);

      const listener = (snapshot: any) => {
        const status = snapshot.val();
        if (status) {
          setPeerStatus((prev) => ({
            ...prev,
            [id]: status,
          }));
        } else {
          // Peer has no status document — treat as offline
          setPeerStatus((prev) => ({
            ...prev,
            [id]: { isOnline: false, lastChanged: 0 },
          }));
        }
      };

      peerStatusRef.on('value', listener);
      listeners[id] = listener;
    });

    return () => {
      peerIds.forEach((id) => {
        const peerStatusRef = db.ref(`/status/${id}`);
        if (listeners[id]) {
          peerStatusRef.off('value', listeners[id]);
        }
      });
    };
  }, [peerIds]);

  return peerStatus;
};
```

- [ ] **Step 2: In App.tsx, ensure the peerIds memo is stable**

The existing code at line 53 already uses `useMemo`:

```typescript
const peerIdsToWatch = useMemo(
  () => pinned.map((p) => p.peerId).filter((id): id is string => !!id),
  [pinned],
);
```

This is already correct — it only recalculates when `pinned` changes. No change needed here.

- [ ] **Step 3: Commit**

```bash
git add hooks/usePeerStatus.ts
git commit -m "fix(peer-status): clear stale entries, handle null snapshots"
```

---

### Task 14: Fix useAuth concurrent init guard

**Files:**

- Modify: `hooks/useAuth.ts`

- [ ] **Step 1: Add init guard to useAuth**

```typescript
import { useState, useEffect, useRef } from 'react';
import { auth, ensureAuthenticated } from '../firebase';

export const useAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const initCalledRef = useRef(false);

  useEffect(() => {
    const initAuth = async () => {
      if (initCalledRef.current) return;
      initCalledRef.current = true;

      try {
        await ensureAuthenticated();
        setIsAuthenticated(true);
        setAuthError(null);
      } catch (error: any) {
        console.error('Failed to authenticate:', error);

        let errorMessage = 'Authentication failed';
        if (
          error.code === 'auth/configuration-not-found' ||
          (error.message && error.message.includes('CONFIGURATION_NOT_FOUND'))
        ) {
          errorMessage =
            'Anonymous authentication is not enabled. Please enable it in Firebase Console: Authentication > Sign-in method > Anonymous';
        } else if (error.message) {
          errorMessage = error.message;
        }

        setAuthError(errorMessage);
        initCalledRef.current = false;
      } finally {
        setIsAuthenticating(false);
      }
    };

    const unsubscribe = auth.onAuthStateChanged((user: any) => {
      if (user) {
        setIsAuthenticated(true);
        setIsAuthenticating(false);
        setAuthError(null);
      } else {
        initAuth();
      }
    });

    return () => unsubscribe();
  }, []);

  return { isAuthenticated, isAuthenticating, authError };
};
```

- [ ] **Step 2: Commit**

```bash
git add hooks/useAuth.ts
git commit -m "fix(auth): prevent concurrent initAuth calls"
```

---

### Task 15: Fix useDraggable listener leak

**Files:**

- Modify: `hooks/useDraggable.ts`

- [ ] **Step 1: Add cleanup for active drag listeners**

```typescript
import { useRef, useCallback, useEffect } from 'react';

export const useDraggable = (ref: React.RefObject<HTMLDivElement | null>) => {
  const posRef = useRef({ x: 0, y: 0 });
  const offsetRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      if (!ref.current) return;
      event.preventDefault();

      const newX = event.clientX - offsetRef.current.x;
      const newY = event.clientY - offsetRef.current.y;

      posRef.current = { x: newX, y: newY };
      ref.current.style.transform = `translate(${newX}px, ${newY}px)`;
    },
    [ref],
  );

  const handlePointerUp = useCallback(
    (event: PointerEvent) => {
      event.preventDefault();
      if (!ref.current) return;

      try {
        ref.current.releasePointerCapture(event.pointerId);
      } catch {
        // Pointer may not be captured (e.g., element removed during drag)
      }
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
      isDraggingRef.current = false;

      if (ref.current) ref.current.style.cursor = 'move';
      document.body.style.userSelect = 'auto';
    },
    [ref, handlePointerMove],
  );

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if ((event.target as HTMLElement).closest('button')) {
        return;
      }
      event.preventDefault();
      if (!ref.current) return;

      offsetRef.current = {
        x: event.clientX - posRef.current.x,
        y: event.clientY - posRef.current.y,
      };

      ref.current.setPointerCapture(event.pointerId);
      document.addEventListener('pointermove', handlePointerMove);
      document.addEventListener('pointerup', handlePointerUp);
      isDraggingRef.current = true;

      ref.current.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none';
    },
    [ref, handlePointerMove, handlePointerUp],
  );

  // Reset position on window resize
  useEffect(() => {
    const handleResize = () => {
      if (ref.current) {
        ref.current.style.transform = 'translate(0px, 0px)';
        posRef.current = { x: 0, y: 0 };
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [ref]);

  // Clean up document listeners on unmount if drag is active
  useEffect(() => {
    return () => {
      if (isDraggingRef.current) {
        document.removeEventListener('pointermove', handlePointerMove);
        document.removeEventListener('pointerup', handlePointerUp);
        document.body.style.userSelect = 'auto';
      }
    };
  }, [handlePointerMove, handlePointerUp]);

  return { onPointerDown };
};
```

- [ ] **Step 2: Commit**

```bash
git add hooks/useDraggable.ts
git commit -m "fix(draggable): cleanup document listeners on unmount, try/catch releasePointerCapture"
```

---

## Phase 6: Security Hardening

### Task 16: Use crypto.getRandomValues for ID generation

**Files:**

- Modify: `utils/id.ts`

- [ ] **Step 1: Rewrite id.ts with secure random**

```typescript
const adjectives = [
  'quick',
  'happy',
  'bright',
  'calm',
  'brave',
  'eager',
  'fancy',
  'giant',
  'jolly',
  'kind',
  'lively',
  'magic',
  'noble',
  'proud',
  'silly',
  'sunny',
  'tiny',
  'wise',
  'zesty',
  'vivid',
];
const nouns = [
  'river',
  'ocean',
  'cloud',
  'forest',
  'meadow',
  'comet',
  'star',
  'dream',
  'wave',
  'glade',
  'haven',
  'light',
  'peak',
  'spirit',
  'storm',
  'stream',
  'world',
  'vista',
  'zephyr',
  'echo',
];
const verbs = [
  'sings',
  'dances',
  'jumps',
  'flies',
  'runs',
  'glows',
  'shines',
  'soars',
  'glides',
  'floats',
  'beams',
  'drifts',
  'wanders',
  'rises',
  'falls',
  'spins',
  'weaves',
  'blooms',
  'thrives',
  'starts',
];

function secureRandomIndex(max: number): number {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return array[0] % max;
}

export const generateCallId = (): string => {
  const adj = adjectives[secureRandomIndex(adjectives.length)];
  const noun = nouns[secureRandomIndex(nouns.length)];
  const verb = verbs[secureRandomIndex(verbs.length)];
  return `${adj}-${noun}-${verb}`;
};

export const generateUUID = (): string => {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};
```

- [ ] **Step 2: Commit**

```bash
git add utils/id.ts
git commit -m "fix(security): use crypto.getRandomValues for call IDs and UUIDs"
```

---

### Task 17: Pin CDN version and fix manifest orientation

**Files:**

- Modify: `index.html`
- Modify: `public/manifest.json`

- [ ] **Step 1: Pin React version in import map**

In `index.html`, change the import map from:

```html
<script type="importmap">
  {
    "imports": {
      "react": "https://aistudiocdn.com/react@^19.1.1",
      "react-dom/": "https://aistudiocdn.com/react-dom@^19.1.1/",
      "react/": "https://aistudiocdn.com/react@^19.1.1/"
    }
  }
</script>
```

to:

```html
<script type="importmap">
  {
    "imports": {
      "react": "https://aistudiocdn.com/react@19.1.1",
      "react-dom/": "https://aistudiocdn.com/react-dom@19.1.1/",
      "react/": "https://aistudiocdn.com/react@19.1.1/"
    }
  }
</script>
```

- [ ] **Step 2: Fix manifest.json orientation**

In `public/manifest.json`, change:

```json
  "orientation": "portrait-primary",
```

to:

```json
  "orientation": "any",
```

- [ ] **Step 3: Commit**

```bash
git add index.html public/manifest.json
git commit -m "fix(security): pin CDN version, allow any orientation"
```

---

### Task 18: Fix vitest.config.ts path alias

**Files:**

- Modify: `vitest.config.ts`

- [ ] **Step 1: Add path alias to vitest config**

```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './test/setup.ts',
    css: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add vitest.config.ts
git commit -m "fix(test): add @/ path alias to vitest config"
```

---

### Task 19: Improve test setup mocks

**Files:**

- Modify: `test/setup.ts`

- [ ] **Step 1: Rewrite test setup with deeper mocks**

```typescript
import '@testing-library/jest-dom';
import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});

// Mock Firebase
const mockRef = {
  on: vi.fn(),
  off: vi.fn(),
  set: vi.fn().mockResolvedValue(undefined),
  update: vi.fn().mockResolvedValue(undefined),
  remove: vi.fn().mockResolvedValue(undefined),
  push: vi.fn().mockResolvedValue({ key: 'mock-key' }),
  child: vi.fn().mockReturnThis(),
  get: vi.fn().mockResolvedValue({ val: () => null, exists: () => false }),
};

global.firebase = {
  initializeApp: vi.fn(),
  auth: vi.fn(() => ({
    onAuthStateChanged: vi.fn((cb: any) => {
      cb(null);
      return vi.fn();
    }),
    signInAnonymously: vi.fn().mockResolvedValue({ user: { uid: 'test-user-id' } }),
    currentUser: { uid: 'test-user-id' },
  })),
  database: vi.fn(() => ({
    ref: vi.fn().mockReturnValue(mockRef),
    ServerValue: { TIMESTAMP: { '.sv': 'timestamp' } },
  })),
} as any;

// Mock WebRTC APIs
const mockPeerConnection = {
  createOffer: vi.fn().mockResolvedValue({ sdp: 'mock-offer', type: 'offer' }),
  createAnswer: vi.fn().mockResolvedValue({ sdp: 'mock-answer', type: 'answer' }),
  setLocalDescription: vi.fn().mockResolvedValue(undefined),
  setRemoteDescription: vi.fn().mockResolvedValue(undefined),
  addIceCandidate: vi.fn().mockResolvedValue(undefined),
  addTrack: vi.fn(),
  getSenders: vi.fn().mockReturnValue([]),
  getReceivers: vi.fn().mockReturnValue([]),
  getStats: vi.fn().mockResolvedValue(new Map()),
  createDataChannel: vi.fn().mockReturnValue({
    onopen: null,
    onclose: null,
    onmessage: null,
    close: vi.fn(),
    send: vi.fn(),
    readyState: 'open',
  }),
  close: vi.fn(),
  connectionState: 'new',
  onconnectionstatechange: null,
  onicecandidate: null,
  ontrack: null,
  ondatachannel: null,
  currentRemoteDescription: null,
};

global.RTCPeerConnection = vi.fn().mockImplementation(() => mockPeerConnection) as any;
global.RTCSessionDescription = vi.fn().mockImplementation((init: any) => init) as any;
global.RTCIceCandidate = vi.fn().mockImplementation((init: any) => init) as any;

// Mock getUserMedia
const mockStream = {
  getTracks: () => [],
  getAudioTracks: () => [{ enabled: true, stop: vi.fn() }],
  getVideoTracks: () => [{ enabled: true, stop: vi.fn() }],
};

global.navigator.mediaDevices = {
  getUserMedia: vi.fn().mockResolvedValue(mockStream),
} as any;

// Mock Web Crypto API
const mockCryptoKey = { type: 'secret', algorithm: { name: 'AES-GCM' } };
global.crypto = {
  subtle: {
    generateKey: vi.fn().mockResolvedValue({ key: mockCryptoKey, rawKey: new ArrayBuffer(32) }),
    exportKey: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
    importKey: vi.fn().mockResolvedValue(mockCryptoKey),
    encrypt: vi.fn().mockResolvedValue(new ArrayBuffer(64)),
    decrypt: vi.fn().mockResolvedValue(new ArrayBuffer(48)),
  },
  getRandomValues: vi.fn((arr: any) => {
    for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
    return arr;
  }),
} as any;
```

- [ ] **Step 2: Run existing tests to verify they pass**

Run: `npx vitest run`
Expected: All existing tests pass

- [ ] **Step 3: Commit**

```bash
git add test/setup.ts
git commit -m "fix(test): improve Firebase, WebRTC, and crypto mocks with realistic return values"
```

---

## Summary

**19 tasks across 6 phases:**

| Phase             | Tasks       | Commit Message Prefix           |
| ----------------- | ----------- | ------------------------------- |
| 1. CI/CD Pipeline | Tasks 1-4   | `fix(ci):`                      |
| 2. Security       | Tasks 5-7   | `fix(security):`                |
| 3. Critical Bugs  | Task 8      | `fix(webrtc):`                  |
| 4. Code Quality   | Tasks 9-11  | `refactor:` / `chore:`          |
| 5. Hook Fixes     | Tasks 12-15 | `fix(...):`                     |
| 6. Hardening      | Tasks 16-19 | `fix(security):` / `fix(test):` |

**Dependencies:** Phase 1 must go first. Phases 2-6 are independent of each other and can run in parallel. Within Phase 4, Task 9 (icons) should precede Task 10 since both modify component files.

**Out of scope for this plan (deferred to follow-up):**

- App.tsx decomposition (574 lines → smaller components/hooks)
- Writing new test cases (only test infrastructure is improved here)
- Alias editing logic extraction from CallHistory/PinnedCalls
- FloatingVideo-specific icons (ResizeIcon, LockIcon, SignalBarsIcon) — leave in place
- Service worker improvements (cache strategy, integrity checks)
- crypto.ts counter scoping (requires API redesign)

**Note on Task 9, Step 2:** This step is mechanical — delete local icon definitions and add imports. The executor should read each component, identify the local icon components (they follow the pattern `const XxxIcon: React.FC<{className?: string}> = ...` with SVG content), remove them, and add the corresponding import from `./icons`. The exact icon names are listed per-file in Step 2.
