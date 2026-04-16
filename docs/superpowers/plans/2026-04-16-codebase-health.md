# Codebase Health Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all five codebase health issues (strict mode, refactoring, resource leaks, tests, security) in one pass.

**Architecture:** Split `useWebRTC.ts` into 3 sub-hooks + composer, extract 3 hooks from `App.tsx`, add `CallContext`, fix leaks in the new smaller hooks, write tests against the clean structure, tighten CSP and database rules.

**Tech Stack:** React 19, TypeScript (strict mode), Vitest, Firebase RTDB, WebRTC

---

## Task 1: Enable TypeScript Strict Mode

**Files:**

- Modify: `tsconfig.json`
- Modify: `hooks/useAuth.ts`
- Modify: `hooks/usePresence.ts`
- Modify: `hooks/usePeerStatus.ts`

- [ ] **Step 1: Enable strict mode in tsconfig.json**

Add `"strict": true` to `compilerOptions` in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2022",
```

- [ ] **Step 2: Run type check to see all errors**

Run: `npx tsc --noEmit 2>&1 | head -80`
Expected: Multiple type errors across files

- [ ] **Step 3: Fix hooks/useAuth.ts**

Replace `error: any` with typed catch and `user: any` with proper Firebase user type:

```typescript
import { useState, useEffect, useRef } from 'react';
import { auth, ensureAuthenticated } from '../firebase';

interface FirebaseUser {
  uid: string;
}

interface FirebaseError {
  code?: string;
  message?: string;
}

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
      } catch (error: unknown) {
        console.error('Failed to authenticate:', error);

        let errorMessage = 'Authentication failed';
        const firebaseError = error as FirebaseError;
        if (
          firebaseError.code === 'auth/configuration-not-found' ||
          (firebaseError.message && firebaseError.message.includes('CONFIGURATION_NOT_FOUND'))
        ) {
          errorMessage =
            'Anonymous authentication is not enabled. Please enable it in Firebase Console: Authentication > Sign-in method > Anonymous';
        } else if (firebaseError.message) {
          errorMessage = firebaseError.message;
        }

        setAuthError(errorMessage);
        initCalledRef.current = false;
      } finally {
        setIsAuthenticating(false);
      }
    };

    const unsubscribe = auth.onAuthStateChanged((user: FirebaseUser | null) => {
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

- [ ] **Step 4: Fix hooks/usePresence.ts**

Replace `any` snapshot and `any` onDisconnect ref with typed versions:

```typescript
import { useEffect, useRef } from 'react';
import { db, ServerValue } from '../firebase';

interface FirebaseSnapshot {
  val(): unknown;
}

interface OnDisconnect {
  set(data: object): Promise<void>;
  cancel(): Promise<void>;
}

export const usePresence = (userId: string | null) => {
  const onDisconnectRef = useRef<OnDisconnect | null>(null);

  useEffect(() => {
    if (!userId) return;

    const userStatusRef = db.ref(`/status/${userId}`);
    const connectedRef = db.ref('.info/connected');

    const listener = connectedRef.on('value', (snapshot: FirebaseSnapshot) => {
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

- [ ] **Step 5: Fix hooks/usePeerStatus.ts**

Replace `any` snapshot types:

```typescript
import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { PeerStatus } from '../types';

interface FirebaseSnapshot {
  val(): unknown;
}

export const usePeerStatus = (peerIds: string[]) => {
  const [peerStatus, setPeerStatus] = useState<{ [key: string]: PeerStatus }>({});

  useEffect(() => {
    const listeners: { [key: string]: (snapshot: FirebaseSnapshot) => void } = {};

    setPeerStatus((prev) => {
      const next: { [key: string]: PeerStatus } = {};
      peerIds.forEach((id) => {
        if (prev[id]) next[id] = prev[id];
      });
      return next;
    });

    peerIds.forEach((id) => {
      const peerStatusRef = db.ref(`/status/${id}`);

      const listener = (snapshot: FirebaseSnapshot) => {
        const status = snapshot.val() as PeerStatus | null;
        if (status) {
          setPeerStatus((prev) => ({
            ...prev,
            [id]: status,
          }));
        } else {
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

- [ ] **Step 6: Run type check**

Run: `npx tsc --noEmit 2>&1 | head -40`
Expected: Errors only in `hooks/useWebRTC.ts` and `App.tsx` (those get rewritten in Tasks 2-3)

- [ ] **Step 7: Run existing tests**

Run: `npx vitest run`
Expected: All existing tests pass

- [ ] **Step 8: Commit**

```bash
git add tsconfig.json hooks/useAuth.ts hooks/usePresence.ts hooks/usePeerStatus.ts
git commit -m "feat: enable TypeScript strict mode, fix type errors in auth/presence/peer hooks"
```

---

## Task 2: Create useMediaStream Hook

**Files:**

- Create: `hooks/useMediaStream.ts`
- Modify: `hooks/useWebRTC.ts` (later — this task creates the new file only)

- [ ] **Step 1: Write the failing test**

Create `test/hooks/useMediaStream.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMediaStream } from '../../hooks/useMediaStream';

describe('useMediaStream', () => {
  const mockStop = vi.fn();
  const mockGetTracks = () => [
    { enabled: true, stop: mockStop, kind: 'audio' },
    { enabled: true, stop: mockStop, kind: 'video' },
  ];
  const mockGetAudioTracks = () => [{ enabled: true, stop: mockStop }];
  const mockGetVideoTracks = () => [{ enabled: true, stop: mockStop }];

  beforeEach(() => {
    vi.clearAllMocks();
    const mockStream = {
      getTracks: mockGetTracks,
      getAudioTracks: mockGetAudioTracks,
      getVideoTracks: mockGetVideoTracks,
    };
    vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValue(
      mockStream as unknown as MediaStream,
    );
  });

  it('should initialize media with default resolution', async () => {
    const { result } = renderHook(() => useMediaStream('720p'));

    let stream: MediaStream | null = null;
    await act(async () => {
      stream = await result.current.initMedia('720p');
    });

    expect(stream).not.toBeNull();
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith(
      expect.objectContaining({ video: expect.any(Object), audio: true }),
    );
  });

  it('should set error state on permission denied', async () => {
    const error = new DOMException('Permission denied', 'NotAllowedError');
    vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValue(error);

    const { result } = renderHook(() => useMediaStream('720p'));

    await act(async () => {
      await result.current.initMedia('720p');
    });

    expect(result.current.errorMessage).toContain('Permission denied');
  });

  it('should set error state on device not found', async () => {
    const error = new DOMException('Device not found', 'NotFoundError');
    vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValue(error);

    const { result } = renderHook(() => useMediaStream('720p'));

    await act(async () => {
      await result.current.initMedia('720p');
    });

    expect(result.current.errorMessage).toContain('No camera or microphone found');
  });

  it('should set error state on overconstrained error', async () => {
    const error = new OverconstrainedError();
    vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValue(error);

    const { result } = renderHook(() => useMediaStream('1080p'));

    await act(async () => {
      await result.current.initMedia('1080p');
    });

    expect(result.current.errorMessage).toContain('not supported');
  });

  it('should toggle mute state', async () => {
    const { result } = renderHook(() => useMediaStream('720p'));

    await act(async () => {
      await result.current.initMedia('720p');
    });

    expect(result.current.isMuted).toBe(false);

    act(() => {
      result.current.toggleMute();
    });

    expect(result.current.isMuted).toBe(true);
  });

  it('should toggle video state', async () => {
    const { result } = renderHook(() => useMediaStream('720p'));

    await act(async () => {
      await result.current.initMedia('720p');
    });

    expect(result.current.isVideoOff).toBe(false);

    act(() => {
      result.current.toggleVideo();
    });

    expect(result.current.isVideoOff).toBe(true);
  });

  it('should stop all tracks on cleanup', async () => {
    const { result } = renderHook(() => useMediaStream('720p'));

    await act(async () => {
      await result.current.initMedia('720p');
    });

    act(() => {
      result.current.cleanupMedia();
    });

    expect(mockStop).toHaveBeenCalled();
    expect(result.current.localStream).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/hooks/useMediaStream.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the hook implementation**

Create `hooks/useMediaStream.ts`:

```typescript
import { useState, useRef, useCallback } from 'react';

const RESOLUTION_CONSTRAINTS: Record<string, MediaTrackConstraints> = {
  '1080p': { width: { ideal: 1920 }, height: { ideal: 1080 } },
  '720p': { width: { ideal: 1280 }, height: { ideal: 720 } },
  '480p': { width: { ideal: 854 }, height: { ideal: 480 } },
};

export const useMediaStream = (initialResolution: string) => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resolution, setResolution] = useState<string>(initialResolution);

  const localStreamRef = useRef<MediaStream | null>(null);
  const isMutedRef = useRef(isMuted);
  const isVideoOffRef = useRef(isVideoOff);

  isMutedRef.current = isMuted;
  isVideoOffRef.current = isVideoOff;

  // Sync ref when stream changes
  const updateStream = useCallback((stream: MediaStream | null) => {
    localStreamRef.current = stream;
    setLocalStream(stream);
  }, []);

  const initMedia = useCallback(
    async (res: string) => {
      try {
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach((track) => track.stop());
        }

        setErrorMessage(null);

        const videoConstraints = RESOLUTION_CONSTRAINTS[res] || RESOLUTION_CONSTRAINTS['720p'];
        const stream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
          audio: true,
        });

        stream.getAudioTracks().forEach((t) => {
          t.enabled = !isMutedRef.current;
        });
        stream.getVideoTracks().forEach((t) => {
          t.enabled = !isVideoOffRef.current;
        });
        updateStream(stream);
        return stream;
      } catch (error) {
        console.error('Error accessing media devices.', error);
        let message =
          'Could not access camera and microphone. Please check your system settings and browser permissions.';
        if (error instanceof DOMException) {
          if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
            message =
              'Permission denied. Please allow this site to access your camera and microphone in your browser settings.';
          } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
            message =
              'No camera or microphone found. Please ensure your devices are connected and enabled.';
          }
        } else if (error instanceof OverconstrainedError) {
          message = `The selected resolution (${res}) is not supported by your device. Try a lower quality.`;
        }
        setErrorMessage(message);
        return null;
      }
    },
    [updateStream],
  );

  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const newMutedState = !isMutedRef.current;
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !newMutedState;
      });
      setIsMuted(newMutedState);
    }
  }, []);

  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const newVideoState = !isVideoOffRef.current;
      localStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = newVideoState;
      });
      setIsVideoOff(!newVideoState);
    }
  }, []);

  const cleanupMedia = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    updateStream(null);
  }, [updateStream]);

  return {
    localStream,
    isMuted,
    isVideoOff,
    errorMessage,
    resolution,
    setResolution,
    isMutedRef,
    isVideoOffRef,
    localStreamRef,
    initMedia,
    toggleMute,
    toggleVideo,
    cleanupMedia,
  };
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/hooks/useMediaStream.test.ts`
Expected: PASS (all 7 tests)

- [ ] **Step 5: Commit**

```bash
git add hooks/useMediaStream.ts test/hooks/useMediaStream.test.ts
git commit -m "feat: extract useMediaStream hook with tests"
```

---

## Task 3: Create useDataChannel Hook

**Files:**

- Create: `hooks/useDataChannel.ts`

- [ ] **Step 1: Write the failing test**

Create `test/hooks/useDataChannel.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDataChannel } from '../../hooks/useDataChannel';

describe('useDataChannel', () => {
  const mockSend = vi.fn();
  const mockChannel = {
    send: mockSend,
    readyState: 'open',
    onmessage: null as ((event: MessageEvent) => void) | null,
    onopen: null as (() => void) | null,
    onclose: null as (() => void) | null,
    close: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should send a chat message via data channel', () => {
    const { result } = renderHook(() => useDataChannel());

    act(() => {
      result.current.setDataChannel(mockChannel as unknown as RTCDataChannel);
    });

    act(() => {
      result.current.sendMessage('Hello peer');
    });

    expect(mockSend).toHaveBeenCalledWith(JSON.stringify({ type: 'chat', payload: 'Hello peer' }));
  });

  it('should not send when channel is not open', () => {
    const { result } = renderHook(() => useDataChannel());

    act(() => {
      result.current.setDataChannel({
        ...mockChannel,
        readyState: 'closed',
      } as unknown as RTCDataChannel);
    });

    act(() => {
      result.current.sendMessage('Hello');
    });

    expect(mockSend).not.toHaveBeenCalled();
  });

  it('should trigger callback on incoming chat message', () => {
    const onChatMessage = vi.fn();
    const { result } = renderHook(() => useDataChannel());

    act(() => {
      result.current.setOnChatMessage(onChatMessage);
    });

    act(() => {
      result.current.setDataChannel(mockChannel as unknown as RTCDataChannel);
    });

    // Simulate incoming message
    const event = new MessageEvent('message', {
      data: JSON.stringify({ type: 'chat', payload: 'Hi there' }),
    });
    act(() => {
      if (mockChannel.onmessage) mockChannel.onmessage(event);
    });

    expect(onChatMessage).toHaveBeenCalledWith('Hi there');
  });

  it('should update remote mute state on control message', () => {
    const { result } = renderHook(() => useDataChannel());

    act(() => {
      result.current.setDataChannel(mockChannel as unknown as RTCDataChannel);
    });

    const event = new MessageEvent('message', {
      data: JSON.stringify({ type: 'control', payload: { type: 'mute', value: true } }),
    });
    act(() => {
      if (mockChannel.onmessage) mockChannel.onmessage(event);
    });

    expect(result.current.isRemoteMuted).toBe(true);
  });

  it('should update remote video state on control message', () => {
    const { result } = renderHook(() => useDataChannel());

    act(() => {
      result.current.setDataChannel(mockChannel as unknown as RTCDataChannel);
    });

    const event = new MessageEvent('message', {
      data: JSON.stringify({ type: 'control', payload: { type: 'video', value: true } }),
    });
    act(() => {
      if (mockChannel.onmessage) mockChannel.onmessage(event);
    });

    expect(result.current.isRemoteVideoOff).toBe(true);
  });

  it('should handle malformed messages gracefully', () => {
    const onChatMessage = vi.fn();
    const { result } = renderHook(() => useDataChannel());

    act(() => {
      result.current.setOnChatMessage(onChatMessage);
    });

    act(() => {
      result.current.setDataChannel(mockChannel as unknown as RTCDataChannel);
    });

    const event = new MessageEvent('message', { data: 'not-json' });
    act(() => {
      if (mockChannel.onmessage) mockChannel.onmessage(event);
    });

    // Should not throw, should pass raw string to chat callback
    expect(onChatMessage).toHaveBeenCalledWith('not-json');
  });

  it('should close data channel on cleanup', () => {
    const { result } = renderHook(() => useDataChannel());

    act(() => {
      result.current.setDataChannel(mockChannel as unknown as RTCDataChannel);
    });

    act(() => {
      result.current.cleanupDataChannel();
    });

    expect(mockChannel.close).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/hooks/useDataChannel.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the hook implementation**

Create `hooks/useDataChannel.ts`:

```typescript
import { useState, useRef, useCallback } from 'react';

export const useDataChannel = () => {
  const [isRemoteMuted, setIsRemoteMuted] = useState(false);
  const [isRemoteVideoOff, setIsRemoteVideoOff] = useState(false);

  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const onChatMessageCallbackRef = useRef<((data: string) => void) | null>(null);

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
    } catch {
      if (typeof event.data === 'string') {
        onChatMessageCallbackRef.current?.(event.data);
      }
      console.warn('Could not parse data channel message:', event.data);
    }
  }, []);

  const setDataChannel = useCallback(
    (channel: RTCDataChannel) => {
      dataChannelRef.current = channel;
      channel.onmessage = handleDataChannelMessage;
    },
    [handleDataChannelMessage],
  );

  const sendRaw = useCallback((message: object) => {
    if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
      dataChannelRef.current.send(JSON.stringify(message));
    }
  }, []);

  const sendMessage = useCallback(
    (chatMessage: string) => {
      sendRaw({ type: 'chat', payload: chatMessage });
    },
    [sendRaw],
  );

  const sendControl = useCallback(
    (type: 'mute' | 'video', value: boolean) => {
      sendRaw({ type: 'control', payload: { type, value } });
    },
    [sendRaw],
  );

  const setOnChatMessage = useCallback((callback: (data: string) => void) => {
    onChatMessageCallbackRef.current = callback;
  }, []);

  const cleanupDataChannel = useCallback(() => {
    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }
    onChatMessageCallbackRef.current = null;
    setIsRemoteMuted(false);
    setIsRemoteVideoOff(false);
  }, []);

  return {
    isRemoteMuted,
    isRemoteVideoOff,
    dataChannelRef,
    setDataChannel,
    sendMessage,
    sendControl,
    sendRaw,
    setOnChatMessage,
    cleanupDataChannel,
  };
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/hooks/useDataChannel.test.ts`
Expected: PASS (all 7 tests)

- [ ] **Step 5: Commit**

```bash
git add hooks/useDataChannel.ts test/hooks/useDataChannel.test.ts
git commit -m "feat: extract useDataChannel hook with tests"
```

---

## Task 4: Create useSignaling Hook

**Files:**

- Create: `hooks/useSignaling.ts`

- [ ] **Step 1: Write the failing test**

Create `test/hooks/useSignaling.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSignaling } from '../../hooks/useSignaling';
import { CallState } from '../../types';

describe('useSignaling', () => {
  const mockPush = vi.fn();
  const mockSet = vi.fn().mockResolvedValue(undefined);
  const mockUpdate = vi.fn().mockResolvedValue(undefined);
  const mockRemove = vi.fn().mockResolvedValue(undefined);
  const mockChild = vi.fn().mockReturnThis();
  const mockOn = vi.fn();
  const mockOff = vi.fn();
  const mockGet = vi.fn().mockResolvedValue({ val: () => null, exists: () => false });

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset firebase mock ref chain
    const mockRef = {
      on: mockOn,
      off: mockOff,
      set: mockSet,
      update: mockUpdate,
      remove: mockRemove,
      push: mockPush,
      child: mockChild,
      get: mockGet,
    };
    mockChild.mockReturnValue(mockRef);
    vi.mocked(global.firebase.database).mockReturnValue({
      ref: vi.fn().mockReturnValue(mockRef),
      ServerValue: { TIMESTAMP: { '.sv': 'timestamp' } },
    } as any);
  });

  it('should initiate a call by writing offer to Firebase', async () => {
    const onCallStateChange = vi.fn();
    const { result } = renderHook(() => useSignaling({ onCallStateChange }));

    const mockPC = {
      createOffer: vi.fn().mockResolvedValue({ sdp: 'offer-sdp', type: 'offer' }),
      setLocalDescription: vi.fn().mockResolvedValue(undefined),
      onicecandidate: null as ((e: RTCPeerConnectionIceEvent) => void) | null,
    } as unknown as RTCPeerConnection;

    const mockStream = { getTracks: () => [] } as unknown as MediaStream;

    await act(async () => {
      await result.current.initiateCall('test-call-id', mockPC, mockStream, true, false);
    });

    expect(mockSet).toHaveBeenCalled();
    expect(onCallStateChange).toHaveBeenCalledWith(CallState.WAITING_FOR_ANSWER);
  });

  it('should join a call by writing answer to Firebase', async () => {
    const onCallStateChange = vi.fn();
    const mockPC = {
      setRemoteDescription: vi.fn().mockResolvedValue(undefined),
      createAnswer: vi.fn().mockResolvedValue({ sdp: 'answer-sdp', type: 'answer' }),
      setLocalDescription: vi.fn().mockResolvedValue(undefined),
      onicecandidate: null as ((e: RTCPeerConnectionIceEvent) => void) | null,
    } as unknown as RTCPeerConnection;

    const mockStream = { getTracks: () => [] } as unknown as MediaStream;

    // Mock call data with an offer
    mockGet.mockResolvedValueOnce({
      val: () => ({
        offer: { sdp: 'existing-offer', type: 'offer' },
        callerId: 'caller-123',
      }),
      exists: () => true,
    });

    const { result } = renderHook(() => useSignaling({ onCallStateChange }));

    await act(async () => {
      await result.current.joinCall('test-call-id', mockPC, mockStream, false);
    });

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ answer: expect.objectContaining({ type: 'answer' }) }),
    );
  });

  it('should decline a call by writing declined flag', async () => {
    const onCallStateChange = vi.fn();
    const { result } = renderHook(() => useSignaling({ onCallStateChange }));

    await act(async () => {
      await result.current.declineCall('test-call-id');
    });

    expect(mockUpdate).toHaveBeenCalledWith({ declined: true });
    expect(mockRemove).toHaveBeenCalled();
  });

  it('should not initiate if operation is in progress', async () => {
    const onCallStateChange = vi.fn();
    const { result } = renderHook(() => useSignaling({ onCallStateChange }));

    const mockPC = {} as RTCPeerConnection;
    const mockStream = {} as MediaStream;

    // First call blocks the operation flag
    result.current.setOperationInProgress(true);

    await act(async () => {
      await result.current.initiateCall('test-call-id', mockPC, mockStream, true, false);
    });

    expect(mockSet).not.toHaveBeenCalled();
  });

  it('should clean up Firebase listeners', async () => {
    const onCallStateChange = vi.fn();
    const { result } = renderHook(() => useSignaling({ onCallStateChange }));

    const mockPC = {
      createOffer: vi.fn().mockResolvedValue({ sdp: 'offer-sdp', type: 'offer' }),
      setLocalDescription: vi.fn().mockResolvedValue(undefined),
      onicecandidate: null as ((e: RTCPeerConnectionIceEvent) => void) | null,
    } as unknown as RTCPeerConnection;
    const mockStream = { getTracks: () => [] } as unknown as MediaStream;

    await act(async () => {
      await result.current.initiateCall('test-call-id', mockPC, mockStream, true, false);
    });

    act(() => {
      result.current.cleanupSignaling();
    });

    expect(mockOff).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/hooks/useSignaling.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the hook implementation**

Create `hooks/useSignaling.ts`:

```typescript
import { useRef, useCallback } from 'react';
import { db } from '../firebase';
import { CallState, PinnedEntry } from '../types';
import { generateCallId } from '../utils/id';
import { getUserId, getUserDisplayName } from '../utils/user';
import { generateKey, importKey } from '../utils/crypto';

const MAX_RECONNECTION_ATTEMPTS = 3;
const RING_TIMEOUT_MS = 30000;

interface FirebaseRef {
  on(event: string, callback: (snapshot: { val(): unknown }) => void): void;
  off(event?: string, callback?: (...args: unknown[]) => void): void;
  set(data: unknown): Promise<void>;
  update(data: object): Promise<void>;
  remove(): Promise<void>;
  push(data: unknown): Promise<{ key: string }>;
  child(path: string): FirebaseRef;
  get(): Promise<{ val(): unknown; exists(): boolean }>;
  onDisconnect(): { set(data: object): Promise<void>; cancel(): Promise<void> };
}

interface SignalingCallbacks {
  onCallStateChange: (state: CallState) => void;
  onSetCallId: (id: string | null) => void;
  onSetPeerId: (id: string | null) => void;
  onSetE2EEActive: (active: boolean) => void;
}

export const useSignaling = (callbacks: SignalingCallbacks) => {
  const { onCallStateChange } = callbacks;

  const callDocRef = useRef<FirebaseRef | null>(null);
  const answerCandidatesRef = useRef<FirebaseRef | null>(null);
  const offerCandidatesRef = useRef<FirebaseRef | null>(null);
  const encryptionKeyRef = useRef<CryptoKey | null>(null);
  const reconnectionAttemptsRef = useRef(0);
  const isCallerRef = useRef(false);
  const ringingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isOperationInProgressRef = useRef(false);

  const callStateRef = useRef<CallState>(CallState.IDLE);
  const peerIdRef = useRef<string | null>(null);
  const enableE2EERef = useRef(true);

  // Listeners tracked for cleanup
  const activeListenersRef = useRef<
    { ref: FirebaseRef; event: string; callback: (snapshot: { val(): unknown }) => void }[]
  >([]);

  const addTrackedListener = useCallback(
    (ref: FirebaseRef, event: string, callback: (snapshot: { val(): unknown }) => void) => {
      activeListenersRef.current.push({ ref, event, callback });
      ref.on(event, callback);
    },
    [],
  );

  const cleanupSignaling = useCallback((keepCallDoc = false) => {
    // Remove all tracked listeners
    activeListenersRef.current.forEach(({ ref, event, callback }) => {
      ref.off(event, callback);
    });
    activeListenersRef.current = [];

    if (ringingTimeoutRef.current) {
      clearTimeout(ringingTimeoutRef.current);
      ringingTimeoutRef.current = null;
    }

    if (callDocRef.current && !keepCallDoc) {
      callDocRef.current.remove();
    }

    callDocRef.current = null;
    answerCandidatesRef.current = null;
    offerCandidatesRef.current = null;
    encryptionKeyRef.current = null;
    isOperationInProgressRef.current = false;
  }, []);

  const initiateCall = useCallback(
    async (
      id: string,
      pc: RTCPeerConnection,
      stream: MediaStream,
      enableE2EE: boolean,
      isRinging: boolean,
    ) => {
      if (isOperationInProgressRef.current) return;
      isOperationInProgressRef.current = true;
      onCallStateChange(isRinging ? CallState.RINGING : CallState.CREATING_OFFER);
      isCallerRef.current = true;
      reconnectionAttemptsRef.current = 0;

      try {
        callbacks.onSetCallId(id);

        callDocRef.current = db.ref(`calls/${id}`) as unknown as FirebaseRef;
        offerCandidatesRef.current = callDocRef.current.child('offerCandidates');
        answerCandidatesRef.current = callDocRef.current.child('answerCandidates');

        pc.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
          if (event.candidate && offerCandidatesRef.current) {
            offerCandidatesRef.current.push(event.candidate.toJSON());
          }
        };

        const offerDescription = await pc.createOffer();
        await pc.setLocalDescription(offerDescription);

        const offer = { sdp: offerDescription.sdp, type: offerDescription.type };
        const callerId = getUserId();
        const callDataToSet: Record<string, unknown> = { offer, callerId, callId: id };

        if (enableE2EE) {
          const { key, rawKey } = await generateKey();
          encryptionKeyRef.current = key;
          callDataToSet.encryptionKey = Array.from(new Uint8Array(rawKey));
        } else {
          encryptionKeyRef.current = null;
        }

        await callDocRef.current.set(callDataToSet);

        // Track the value listener for cleanup
        const callDocListener = (snapshot: { val(): unknown }) => {
          const data = snapshot.val() as Record<string, unknown> | null;
          if (!data) {
            if (
              callStateRef.current !== CallState.IDLE &&
              callStateRef.current !== CallState.ENDED
            ) {
              onCallStateChange(CallState.ENDED);
            }
            return;
          }
          if ((data as Record<string, unknown>).declined) {
            onCallStateChange(CallState.DECLINED);
            return;
          }
          if ((data as Record<string, unknown>).joinerId && !peerIdRef.current) {
            callbacks.onSetPeerId((data as Record<string, unknown>).joinerId as string);
          }
        };
        addTrackedListener(callDocRef.current, 'value', callDocListener);

        // Track answer candidates listener
        const answerListener = (snapshot: { val(): unknown }) => {
          try {
            const candidate = new RTCIceCandidate(snapshot.val() as RTCIceCandidateInit);
            pc.addIceCandidate(candidate);
          } catch (error) {
            console.error('Error adding ICE candidate:', error);
          }
        };
        addTrackedListener(answerCandidatesRef.current, 'child_added', answerListener);

        if (!isRinging) {
          onCallStateChange(CallState.WAITING_FOR_ANSWER);
        }
      } catch (error) {
        console.error('Error initiating call:', error);
        cleanupSignaling();
        onCallStateChange(CallState.IDLE);
      }
    },
    [onCallStateChange, callbacks, cleanupSignaling, addTrackedListener],
  );

  const joinCall = useCallback(
    async (id: string, pc: RTCPeerConnection, stream: MediaStream, enableE2EE: boolean) => {
      if (isOperationInProgressRef.current) return;
      isOperationInProgressRef.current = true;
      isCallerRef.current = false;
      reconnectionAttemptsRef.current = 0;

      try {
        const callRef = db.ref(`calls/${id}`) as unknown as FirebaseRef;
        const callSnapshot = await callRef.get();
        const callData = callSnapshot.val() as Record<string, unknown> | null;

        if (callData?.offer) {
          onCallStateChange(CallState.JOINING);
          const initialOfferSdp = (callData.offer as RTCSessionDescriptionInit).sdp;

          if (callData.callerId) {
            callbacks.onSetPeerId(callData.callerId as string);
          }

          if (callData.encryptionKey) {
            const rawKey = new Uint8Array(callData.encryptionKey as Iterable<number>).buffer;
            encryptionKeyRef.current = await importKey(rawKey);
          }

          callbacks.onSetCallId(id);
          callDocRef.current = callRef;
          offerCandidatesRef.current = callDocRef.current.child('offerCandidates');
          answerCandidatesRef.current = callDocRef.current.child('answerCandidates');

          pc.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
            if (event.candidate && answerCandidatesRef.current) {
              answerCandidatesRef.current.push(event.candidate.toJSON());
            }
          };

          await pc.setRemoteDescription(
            new RTCSessionDescription(callData.offer as RTCSessionDescriptionInit),
          );
          const answerDescription = await pc.createAnswer();
          await pc.setLocalDescription(answerDescription);

          const answer = { type: answerDescription.type, sdp: answerDescription.sdp };
          const joinerId = getUserId();
          await callDocRef.current.update({ answer, joinerId });

          const calleeIncomingCallRef = db.ref(
            `users/${joinerId}/incomingCall`,
          ) as unknown as FirebaseRef;
          await calleeIncomingCallRef.remove();

          // Track offer candidates listener
          const offerListener = (snapshot: { val(): unknown }) => {
            try {
              const candidate = new RTCIceCandidate(snapshot.val() as RTCIceCandidateInit);
              pc.addIceCandidate(candidate);
            } catch (error) {
              console.error('Error adding ICE candidate:', error);
            }
          };
          addTrackedListener(offerCandidatesRef.current, 'child_added', offerListener);

          // Track call doc listener for reconnection
          const callDocListener = (snapshot: { val(): unknown }) => {
            const data = snapshot.val() as Record<string, unknown> | null;
            if (!data) {
              if (
                callStateRef.current !== CallState.IDLE &&
                callStateRef.current !== CallState.ENDED
              ) {
                onCallStateChange(CallState.ENDED);
              }
              return;
            }
            if (data.offer && (data.offer as RTCSessionDescriptionInit).sdp !== initialOfferSdp) {
              console.log('Received a new offer for reconnection.');
              onCallStateChange(CallState.RECONNECTING);
              pc.setRemoteDescription(
                new RTCSessionDescription(data.offer as RTCSessionDescriptionInit),
              )
                .then(() => pc.createAnswer())
                .then(async (newAnswer) => {
                  await pc.setLocalDescription(newAnswer);
                  if (callDocRef.current) {
                    await callDocRef.current.update({
                      answer: { type: newAnswer.type, sdp: newAnswer.sdp },
                    });
                  }
                })
                .catch((error) => console.error('Error handling reconnection offer:', error));
            }
          };
          addTrackedListener(callDocRef.current, 'value', callDocListener);

          onCallStateChange(CallState.CREATING_ANSWER);
        } else {
          // No offer exists — become the caller
          isOperationInProgressRef.current = false;
          await initiateCall(id, pc, stream, enableE2EE);
        }
      } catch (error) {
        console.error('Error joining call:', error);
        cleanupSignaling();
        onCallStateChange(CallState.IDLE);
      }
    },
    [onCallStateChange, callbacks, cleanupSignaling, initiateCall, addTrackedListener],
  );

  const declineCall = useCallback(
    async (incomingCallId: string, peerToRingId?: string) => {
      const myUserId = getUserId();
      const callRef = db.ref(`calls/${incomingCallId}`) as unknown as FirebaseRef;

      try {
        if (peerToRingId) {
          const calleeIncomingCallRef = db.ref(
            `users/${peerToRingId}/incomingCall`,
          ) as unknown as FirebaseRef;
          await calleeIncomingCallRef.remove();
        } else {
          const myIncomingCallRef = db.ref(
            `users/${myUserId}/incomingCall`,
          ) as unknown as FirebaseRef;
          await myIncomingCallRef.remove();
        }
        await callRef.update({ declined: true });
      } catch (error) {
        console.error('Error declining call:', error);
      }

      // Clear ringing timeout to prevent double-decline
      if (ringingTimeoutRef.current) {
        clearTimeout(ringingTimeoutRef.current);
        ringingTimeoutRef.current = null;
      }

      cleanupSignaling(true);
      setTimeout(() => callRef.remove(), 2000);
      onCallStateChange(CallState.IDLE);
    },
    [cleanupSignaling, onCallStateChange],
  );

  const ringUser = useCallback(
    async (peer: PinnedEntry, pc: RTCPeerConnection, stream: MediaStream, enableE2EE: boolean) => {
      if (!peer.peerId) {
        console.error('Cannot ring user without a peer ID.');
        return;
      }
      const newCallId = generateCallId();
      callbacks.onSetPeerId(peer.peerId);
      callbacks.onSetCallId(newCallId);

      const myUserId = getUserId();
      const myDisplayName = getUserDisplayName();
      const incomingCallRef = db.ref(`users/${peer.peerId}/incomingCall`) as unknown as FirebaseRef;

      const callPayload: { from: string; callId: string; callerAlias?: string } = {
        from: myUserId,
        callId: newCallId,
      };

      if (myDisplayName) {
        callPayload.callerAlias = myDisplayName;
      }

      await incomingCallRef.set(callPayload);
      await initiateCall(newCallId, pc, stream, enableE2EE, true);

      ringingTimeoutRef.current = setTimeout(() => {
        declineCall(newCallId, peer.peerId);
      }, RING_TIMEOUT_MS);
    },
    [callbacks, initiateCall, declineCall],
  );

  const setOperationInProgress = useCallback((value: boolean) => {
    isOperationInProgressRef.current = value;
  }, []);

  return {
    initiateCall,
    joinCall,
    declineCall,
    ringUser,
    cleanupSignaling,
    setOperationInProgress,
    encryptionKeyRef,
    reconnectionAttemptsRef,
    isCallerRef,
    callDocRef,
    ringingTimeoutRef,
    callStateRef,
    peerIdRef,
    enableE2EERef,
    MAX_RECONNECTION_ATTEMPTS,
  };
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/hooks/useSignaling.test.ts`
Expected: PASS (all 5 tests)

- [ ] **Step 5: Commit**

```bash
git add hooks/useSignaling.ts test/hooks/useSignaling.test.ts
git commit -m "feat: extract useSignaling hook with tracked listener cleanup and tests"
```

---

## Task 5: Rewrite useWebRTC as Composer

**Files:**

- Modify: `hooks/useWebRTC.ts` (complete rewrite)

- [ ] **Step 1: Write the failing test**

Create `test/hooks/useWebRTC.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWebRTC } from '../../hooks/useWebRTC';
import { CallState } from '../../types';

describe('useWebRTC', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should start in IDLE state', () => {
    const { result } = renderHook(() => useWebRTC('720p'));
    expect(result.current.callState).toBe(CallState.IDLE);
  });

  it('should enter LOBBY state on enterLobby', async () => {
    const { result } = renderHook(() => useWebRTC('720p'));

    await act(async () => {
      await result.current.enterLobby();
    });

    expect(result.current.callState).toBe(CallState.LOBBY);
    expect(result.current.localStream).not.toBeNull();
  });

  it('should transition to WAITING_FOR_ANSWER on startCall', async () => {
    const { result } = renderHook(() => useWebRTC('720p'));

    await act(async () => {
      await result.current.enterLobby();
    });

    await act(async () => {
      await result.current.startCall();
    });

    expect(result.current.callState).toBe(CallState.WAITING_FOR_ANSWER);
    expect(result.current.callId).not.toBeNull();
  });

  it('should reset to IDLE on hangUp', async () => {
    const { result } = renderHook(() => useWebRTC('720p'));

    await act(async () => {
      await result.current.enterLobby();
    });

    await act(async () => {
      await result.current.startCall();
    });

    act(() => {
      result.current.hangUp();
    });

    expect(result.current.callState).toBe(CallState.ENDED);
  });

  it('should reset all state on reset', async () => {
    const { result } = renderHook(() => useWebRTC('720p'));

    await act(async () => {
      await result.current.enterLobby();
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.callState).toBe(CallState.IDLE);
    expect(result.current.callId).toBeNull();
    expect(result.current.peerId).toBeNull();
    expect(result.current.errorMessage).toBeNull();
  });

  it('should clean up beforeunload listener on unmount', async () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => useWebRTC('720p'));

    expect(addSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));

    unmount();

    expect(removeSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/hooks/useWebRTC.test.ts`
Expected: FAIL — the old useWebRTC doesn't export `enterLobby` with the same behavior (or it may partially pass)

- [ ] **Step 3: Rewrite useWebRTC.ts as composer**

Rewrite `hooks/useWebRTC.ts` completely:

```typescript
import { useState, useRef, useCallback, useEffect } from 'react';
import { STUN_SERVERS } from '../constants';
import { CallState, CallStats, PinnedEntry } from '../types';
import { setupE2EE } from '../utils/crypto';
import { generateCallId } from '../utils/id';
import { useMediaStream } from './useMediaStream';
import { useSignaling } from './useSignaling';
import { useDataChannel } from './useDataChannel';

export const useWebRTC = (initialResolution: string) => {
  const [callState, setCallState] = useState<CallState>(CallState.IDLE);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>('new');
  const [callId, setCallId] = useState<string | null>(null);
  const [peerId, setPeerId] = useState<string | null>(null);
  const [isE2EEActive, setIsE2EEActive] = useState(false);
  const [callStats, setCallStats] = useState<CallStats | null>(null);
  const [enableE2EE, setEnableE2EE] = useState(true);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const statsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastStatsRef = useRef<{
    timestamp: number;
    totalBytesSent: number;
    totalBytesReceived: number;
  } | null>(null);
  const hasConnectedOnceRef = useRef(false);
  const reconnectionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const media = useMediaStream(initialResolution);
  const dataChannel = useDataChannel();

  // Keep state refs current for signaling callbacks
  const callStateRef = useRef<CallState>(callState);
  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  const signaling = useSignaling({
    onCallStateChange: setCallState,
    onSetCallId: setCallId,
    onSetPeerId: setPeerId,
    onSetE2EEActive: setIsE2EEActive,
  });

  // Sync signaling refs
  useEffect(() => {
    signaling.callStateRef.current = callState;
  }, [callState, signaling.callStateRef]);
  useEffect(() => {
    signaling.peerIdRef.current = peerId;
  }, [peerId, signaling.peerIdRef]);
  useEffect(() => {
    signaling.enableE2EERef.current = enableE2EE;
  }, [enableE2EE, signaling.enableE2EERef]);

  const restartIce = useCallback(async () => {
    const pc = peerConnectionRef.current;
    if (!pc || !signaling.callDocRef.current) return;

    try {
      const offerDescription = await pc.createOffer({ iceRestart: true });
      await pc.setLocalDescription(offerDescription);
      await (
        signaling.callDocRef.current as unknown as { update(data: object): Promise<void> }
      ).update({
        offer: { sdp: offerDescription.sdp, type: offerDescription.type },
      });
    } catch (error) {
      console.error('Failed to restart ICE connection:', error);
      setCallState(CallState.ENDED);
    }
  }, [signaling.callDocRef]);

  const clearStatsInterval = useCallback(() => {
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
      statsIntervalRef.current = null;
    }
  }, []);

  const createPeerConnection = useCallback(
    (stream: MediaStream): RTCPeerConnection => {
      const pc = new RTCPeerConnection(STUN_SERVERS);

      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      pc.ontrack = (event) => {
        remoteStreamRef.current = event.streams[0];
        setRemoteStream(event.streams[0]);
      };

      pc.ondatachannel = (event) => {
        dataChannel.setDataChannel(event.channel);
        event.channel.onopen = () => {
          console.log('Data channel opened.');
          dataChannel.sendControl('mute', media.isMutedRef.current);
          dataChannel.sendControl('video', media.isVideoOffRef.current);
        };
        event.channel.onclose = () => console.log('Data channel closed by peer.');
      };

      pc.onconnectionstatechange = () => {
        if (!pc) return;
        setConnectionState(pc.connectionState);

        if (pc.connectionState === 'connected') {
          hasConnectedOnceRef.current = true;
          if (signaling.ringingTimeoutRef.current)
            clearTimeout(signaling.ringingTimeoutRef.current);
          signaling.reconnectionAttemptsRef.current = 0;
          if (reconnectionTimerRef.current) {
            clearTimeout(reconnectionTimerRef.current);
            reconnectionTimerRef.current = null;
          }

          // Always clear before creating new interval (fixes duplicate interval leak)
          clearStatsInterval();

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
          if (signaling.encryptionKeyRef.current) {
            if (setupE2EE(pc, signaling.encryptionKeyRef.current)) {
              setIsE2EEActive(true);
            }
          }
        } else if (pc.connectionState === 'failed') {
          console.error('Peer connection failed. Hanging up.');
          setCallState(CallState.ENDED);
        } else if (pc.connectionState === 'disconnected') {
          setIsE2EEActive(false);
          setCallStats(null);
          clearStatsInterval();
          lastStatsRef.current = null;

          if (
            signaling.isCallerRef.current &&
            signaling.reconnectionAttemptsRef.current < signaling.MAX_RECONNECTION_ATTEMPTS &&
            !reconnectionTimerRef.current
          ) {
            reconnectionTimerRef.current = setTimeout(() => {
              signaling.reconnectionAttemptsRef.current++;
              console.log(
                `Connection lost. Attempting to reconnect... (Attempt ${signaling.reconnectionAttemptsRef.current})`,
              );
              setCallState(CallState.RECONNECTING);
              reconnectionTimerRef.current = null;
              restartIce();
            }, 2000 * signaling.reconnectionAttemptsRef.current);
          } else if (
            signaling.reconnectionAttemptsRef.current >= signaling.MAX_RECONNECTION_ATTEMPTS &&
            callStateRef.current !== CallState.ENDED
          ) {
            console.log('Reconnection failed after maximum attempts.');
            setCallState(CallState.ENDED);
          }
        } else if (pc.connectionState === 'closed') {
          setIsE2EEActive(false);
          setCallStats(null);
          clearStatsInterval();
          lastStatsRef.current = null;
        }
      };

      peerConnectionRef.current = pc;
      setConnectionState(pc.connectionState);
      return pc;
    },
    [restartIce, dataChannel, media.isMutedRef, media.isVideoOffRef, clearStatsInterval, signaling],
  );

  const cleanUp = useCallback(
    (keepCallDoc = false) => {
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }

      media.cleanupMedia();

      const rs = remoteStreamRef.current;
      if (rs) {
        rs.getTracks().forEach((track) => track.stop());
        setRemoteStream(null);
      }

      signaling.cleanupSignaling(keepCallDoc);
      dataChannel.cleanupDataChannel();

      if (reconnectionTimerRef.current) clearTimeout(reconnectionTimerRef.current);
      clearStatsInterval();

      reconnectionTimerRef.current = null;
      lastStatsRef.current = null;
      hasConnectedOnceRef.current = false;
      setIsE2EEActive(false);
      setCallStats(null);
      setCallId(null);
      setPeerId(null);
      setConnectionState('new');
    },
    [media, signaling, dataChannel, clearStatsInterval],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearStatsInterval();
      if (reconnectionTimerRef.current) clearTimeout(reconnectionTimerRef.current);
      if (signaling.ringingTimeoutRef.current) clearTimeout(signaling.ringingTimeoutRef.current);
    };
  }, [clearStatsInterval, signaling.ringingTimeoutRef]);

  const hangUp = useCallback(() => {
    cleanUp();
    setCallState(CallState.ENDED);
  }, [cleanUp]);

  const reset = useCallback(() => {
    cleanUp();
    setCallState(CallState.IDLE);
  }, [cleanUp]);

  const enterLobby = useCallback(async () => {
    const stream = await media.initMedia(media.resolution);
    if (stream) {
      setCallState(CallState.LOBBY);
    }
  }, [media]);

  const startCall = useCallback(async () => {
    const stream = media.localStreamRef.current;
    if (!stream) return;
    const pc = createPeerConnection(stream);

    // Create data channel as caller
    const dc = pc.createDataChannel('chat');
    dc.onclose = () => console.log('Data channel closed.');
    dataChannel.setDataChannel(dc);
    dc.onopen = () => {
      console.log('Data channel opened.');
      dataChannel.sendControl('mute', media.isMutedRef.current);
      dataChannel.sendControl('video', media.isVideoOffRef.current);
    };

    await signaling.initiateCall(generateCallId(), pc, stream, enableE2EE, false);
  }, [media, createPeerConnection, dataChannel, signaling, enableE2EE]);

  // Need to import generateCallId
  // Actually signaling.initiateCall takes the call ID, so we generate it here

  const joinCall = useCallback(
    async (id: string) => {
      const stream = media.localStreamRef.current;
      if (!stream) return;
      const pc = createPeerConnection(stream);
      await signaling.joinCall(id, pc, stream, enableE2EE);
    },
    [media, createPeerConnection, signaling, enableE2EE],
  );

  const ringUser = useCallback(
    async (peer: PinnedEntry) => {
      const stream = media.localStreamRef.current;
      if (!stream) return;
      const pc = createPeerConnection(stream);

      const dc = pc.createDataChannel('chat');
      dc.onclose = () => console.log('Data channel closed.');
      dataChannel.setDataChannel(dc);
      dc.onopen = () => {
        console.log('Data channel opened.');
        dataChannel.sendControl('mute', media.isMutedRef.current);
        dataChannel.sendControl('video', media.isVideoOffRef.current);
      };

      await signaling.ringUser(peer, pc, stream, enableE2EE);
    },
    [media, createPeerConnection, dataChannel, signaling, enableE2EE],
  );

  // Clean up on page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (callStateRef.current !== CallState.IDLE && callStateRef.current !== CallState.ENDED) {
        if (signaling.callDocRef.current) {
          (signaling.callDocRef.current as unknown as { remove(): void }).remove();
        }
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [signaling.callDocRef]);

  return {
    localStream: media.localStream,
    remoteStream,
    connectionState,
    isMuted: media.isMuted,
    isVideoOff: media.isVideoOff,
    callState,
    setCallState,
    errorMessage: media.errorMessage,
    callId,
    peerId,
    isE2EEActive,
    callStats,
    resolution: media.resolution,
    setResolution: media.setResolution,
    isRemoteMuted: dataChannel.isRemoteMuted,
    isRemoteVideoOff: dataChannel.isRemoteVideoOff,
    enableE2EE,
    setEnableE2EE,
    enterLobby,
    startCall,
    joinCall,
    ringUser,
    declineCall: signaling.declineCall,
    toggleMute: media.toggleMute,
    toggleVideo: media.toggleVideo,
    hangUp,
    reset,
    setOnChatMessage: dataChannel.setOnChatMessage,
    sendMessage: dataChannel.sendMessage,
  };
};
```

- [ ] **Step 4: Run all tests**

Run: `npx vitest run`
Expected: All tests pass including the new useWebRTC tests

- [ ] **Step 5: Fix any type errors**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: No errors, or fix any remaining issues

- [ ] **Step 6: Commit**

```bash
git add hooks/useWebRTC.ts test/hooks/useWebRTC.test.ts
git commit -m "refactor: rewrite useWebRTC as thin composer over sub-hooks"
```

---

## Task 6: Create CallContext and Extract App Hooks

**Files:**

- Create: `contexts/CallContext.tsx`
- Create: `hooks/useCallHistory.ts`
- Create: `hooks/useIncomingCall.ts`
- Create: `hooks/useCallNotifications.ts`
- Modify: `App.tsx`

- [ ] **Step 1: Write tests for useCallHistory**

Create `test/hooks/useCallHistory.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCallHistory } from '../../hooks/useCallHistory';
import { CallHistoryEntry, PinnedEntry } from '../../types';

const mockHistory: CallHistoryEntry[] = [
  { callId: 'happy-river-sings', timestamp: 1000, duration: 60, alias: 'Alice' },
  { callId: 'brave-ocean-runs', timestamp: 2000, duration: 120 },
];

const mockPinned: PinnedEntry[] = [
  { callId: 'happy-river-sings', alias: 'Alice', peerId: 'peer-1' },
];

describe('useCallHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('should initialize with empty history and pinned', () => {
    const { result } = renderHook(() => useCallHistory());

    expect(result.current.history).toEqual([]);
    expect(result.current.pinned).toEqual([]);
  });

  it('should update alias in history', () => {
    const { result } = renderHook(() => useCallHistory());

    // Add a history entry first
    act(() => {
      result.current.addHistoryEntry({
        callId: 'test-call',
        timestamp: Date.now(),
        duration: 30,
      });
    });

    act(() => {
      result.current.updateHistoryAlias(result.current.history[0].timestamp, 'Bob');
    });

    expect(result.current.history[0].alias).toBe('Bob');
  });

  it('should delete history entry', () => {
    const { result } = renderHook(() => useCallHistory());

    act(() => {
      result.current.addHistoryEntry({
        callId: 'test-call',
        timestamp: Date.now(),
        duration: 30,
      });
    });

    expect(result.current.history).toHaveLength(1);

    act(() => {
      result.current.deleteHistory(result.current.history[0].timestamp);
    });

    expect(result.current.history).toHaveLength(0);
  });

  it('should toggle pin on/off', () => {
    const { result } = renderHook(() => useCallHistory());

    const entry = { callId: 'test-call', timestamp: Date.now(), duration: 30 };

    // Pin
    act(() => {
      result.current.togglePin(entry);
    });
    expect(result.current.pinned).toHaveLength(1);

    // Unpin
    act(() => {
      result.current.togglePin(entry);
    });
    expect(result.current.pinned).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Write useCallHistory hook**

Create `hooks/useCallHistory.ts`:

```typescript
import { useState, useEffect, useCallback } from 'react';
import { CallHistoryEntry, PinnedEntry } from '../types';
import { getHistory, saveHistory } from '../utils/history';
import { getPinned, savePinned } from '../utils/pins';

export const useCallHistory = () => {
  const [history, setHistory] = useState<CallHistoryEntry[]>(() => getHistory());
  const [pinned, setPinned] = useState<PinnedEntry[]>(() => getPinned());

  useEffect(() => {
    saveHistory(history);
  }, [history]);
  useEffect(() => {
    savePinned(pinned);
  }, [pinned]);

  const addHistoryEntry = useCallback((entry: CallHistoryEntry) => {
    setHistory((prev) => [entry, ...prev]);
  }, []);

  const updateHistoryAlias = useCallback((timestamp: number, alias: string) => {
    setHistory((prev) => prev.map((h) => (h.timestamp === timestamp ? { ...h, alias } : h)));
  }, []);

  const deleteHistory = useCallback((timestamp: number) => {
    setHistory((prev) => prev.filter((h) => h.timestamp !== timestamp));
  }, []);

  const togglePin = useCallback((entry: CallHistoryEntry) => {
    setPinned((prev) => {
      if (prev.some((p) => p.callId === entry.callId)) {
        return prev.filter((p) => p.callId !== entry.callId);
      }
      const { callId, alias, peerId } = entry;
      return [{ callId, alias, peerId }, ...prev];
    });
  }, []);

  const updatePinAlias = useCallback((callId: string, alias: string) => {
    setPinned((prev) => prev.map((p) => (p.callId === callId ? { ...p, alias } : p)));
  }, []);

  const unpin = useCallback((callId: string) => {
    setPinned((prev) => prev.filter((p) => p.callId !== callId));
  }, []);

  const restoreData = useCallback(
    (data: { history: CallHistoryEntry[]; pinned: PinnedEntry[] }) => {
      setHistory(data.history);
      setPinned(data.pinned);
    },
    [],
  );

  return {
    history,
    pinned,
    addHistoryEntry,
    updateHistoryAlias,
    deleteHistory,
    togglePin,
    updatePinAlias,
    unpin,
    restoreData,
  };
};
```

- [ ] **Step 3: Run useCallHistory test**

Run: `npx vitest run test/hooks/useCallHistory.test.ts`
Expected: PASS

- [ ] **Step 4: Write tests for useIncomingCall**

Create `test/hooks/useIncomingCall.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIncomingCall } from '../../hooks/useIncomingCall';
import { CallState, IncomingCall } from '../../types';

const mockCall: IncomingCall = { from: 'caller-123', callId: 'test-call-id' };

describe('useIncomingCall', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with no incoming call', () => {
    const onCallStateChange = vi.fn();
    const { result } = renderHook(() =>
      useIncomingCall('user-1', CallState.IDLE, onCallStateChange),
    );

    expect(result.current.incomingCall).toBeNull();
  });

  it('should expose accept and decline handlers', () => {
    const onCallStateChange = vi.fn();
    const { result } = renderHook(() =>
      useIncomingCall('user-1', CallState.IDLE, onCallStateChange),
    );

    expect(result.current.handleAcceptCall).toBeInstanceOf(Function);
    expect(result.current.handleDeclineCall).toBeInstanceOf(Function);
  });
});
```

- [ ] **Step 5: Write useIncomingCall hook**

Create `hooks/useIncomingCall.ts`:

```typescript
import { useState, useEffect, useRef, useCallback } from 'react';
import { CallState, IncomingCall } from '../types';
import { db } from '../firebase';

interface FirebaseSnapshot {
  val(): unknown;
}

export const useIncomingCall = (
  userId: string | null,
  callState: CallState,
  onCallStateChange: (state: CallState) => void,
) => {
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const callStateRef = useRef<CallState>(callState);
  callStateRef.current = callState;

  useEffect(() => {
    if (!userId) return;
    const incomingCallRef = db.ref(`users/${userId}/incomingCall`);

    const listener = (snapshot: FirebaseSnapshot) => {
      const call = snapshot.val() as IncomingCall | null;
      if (call) {
        if ([CallState.IDLE, CallState.ENDED, CallState.DECLINED].includes(callStateRef.current)) {
          setIncomingCall(call);
          onCallStateChange(CallState.INCOMING_CALL);
        }
      } else {
        setIncomingCall(null);
        if (callStateRef.current === CallState.INCOMING_CALL) {
          onCallStateChange(CallState.IDLE);
        }
      }
    };

    incomingCallRef.on('value', listener);
    return () => incomingCallRef.off('value', listener);
  }, [userId, onCallStateChange]);

  const handleAcceptCall = useCallback(
    (joinCall: (id: string) => void) => {
      if (incomingCall) {
        joinCall(incomingCall.callId);
      }
    },
    [incomingCall],
  );

  const handleDeclineCall = useCallback(
    (declineCall: (id: string) => void, reset: () => void) => {
      if (incomingCall) {
        declineCall(incomingCall.callId);
      }
      setIncomingCall(null);
      reset();
    },
    [incomingCall],
  );

  return {
    incomingCall,
    handleAcceptCall,
    handleDeclineCall,
  };
};
```

- [ ] **Step 6: Run useIncomingCall test**

Run: `npx vitest run test/hooks/useIncomingCall.test.ts`
Expected: PASS

- [ ] **Step 7: Write useCallNotifications hook**

Create `hooks/useCallNotifications.ts`:

```typescript
import { useState, useEffect, useRef, useCallback } from 'react';
import { CallState, CallHistoryEntry, PinnedEntry } from '../types';
import {
  playIncomingSound,
  playConnectedSound,
  playEndedSound,
  playRingingSound,
  stopRingingSound,
} from '../utils/sounds';

export const useCallNotifications = (
  callState: CallState,
  callId: string | null,
  peerId: string | null,
  pinned: PinnedEntry[],
  history: CallHistoryEntry[],
  addHistoryEntry: (entry: CallHistoryEntry) => void,
) => {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callStartTimeRef = useRef<number | null>(null);
  const callDetailsForHistoryRef = useRef<{
    callId: string;
    peerId?: string;
    alias?: string;
  } | null>(null);
  const hasConnectedOnceForChatRef = useRef(false);

  const [callDuration, setCallDuration] = useState(0);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const findAlias = useCallback(
    (pId: string | null) => {
      if (!pId) return undefined;
      const pinnedContact = pinned.find((p) => p.peerId === pId);
      if (pinnedContact?.alias) return pinnedContact.alias;
      const historyContact = [...history]
        .sort((a, b) => b.timestamp - a.timestamp)
        .find((h) => h.peerId === pId);
      return historyContact?.alias;
    },
    [pinned, history],
  );

  useEffect(() => {
    switch (callState) {
      case CallState.INCOMING_CALL:
        playIncomingSound();
        break;
      case CallState.RINGING:
        playRingingSound();
        break;
      case CallState.CONNECTED:
        stopRingingSound();
        playConnectedSound();
        if (!hasConnectedOnceForChatRef.current) {
          hasConnectedOnceForChatRef.current = true;
        }
        callStartTimeRef.current = Date.now();
        if (callId) {
          callDetailsForHistoryRef.current = {
            callId,
            peerId: peerId || undefined,
            alias: peerId ? findAlias(peerId) : undefined,
          };
        }
        setCallDuration(0);
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
          setCallDuration((prev) => prev + 1);
        }, 1000);
        break;
      case CallState.ENDED:
      case CallState.DECLINED:
        stopRingingSound();
        playEndedSound();
        if (timerRef.current) clearInterval(timerRef.current);
        if (callStartTimeRef.current && callDetailsForHistoryRef.current) {
          const duration = Math.floor((Date.now() - callStartTimeRef.current) / 1000);
          addHistoryEntry({
            ...callDetailsForHistoryRef.current,
            timestamp: Date.now(),
            duration,
          });
        }
        setCallDuration(0);
        timerRef.current = null;
        callStartTimeRef.current = null;
        callDetailsForHistoryRef.current = null;
        hasConnectedOnceForChatRef.current = false;
        break;
      case CallState.IDLE:
        stopRingingSound();
        break;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callState, callId, peerId]);

  return {
    callDuration,
    hasConnectedOnceForChatRef,
  };
};
```

- [ ] **Step 8: Create CallContext**

Create `contexts/CallContext.tsx`:

```typescript
import React, { createContext, useContext } from 'react';
import { CallState, CallStats } from '../types';

interface CallContextValue {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  connectionState: RTCPeerConnectionState;
  isMuted: boolean;
  isVideoOff: boolean;
  callState: CallState;
  setCallState: (state: CallState) => void;
  errorMessage: string | null;
  callId: string | null;
  peerId: string | null;
  isE2EEActive: boolean;
  callStats: CallStats | null;
  resolution: string;
  setResolution: (resolution: string) => void;
  isRemoteMuted: boolean;
  isRemoteVideoOff: boolean;
  enableE2EE: boolean;
  setEnableE2EE: (enabled: boolean) => void;
  enterLobby: () => Promise<void>;
  startCall: () => Promise<void>;
  joinCall: (id: string) => Promise<void>;
  ringUser: (peer: import('../types').PinnedEntry) => Promise<void>;
  declineCall: (incomingCallId: string, peerToRingId?: string) => Promise<void>;
  toggleMute: () => void;
  toggleVideo: () => void;
  hangUp: () => void;
  reset: () => void;
  setOnChatMessage: (callback: (data: string) => void) => void;
  sendMessage: (message: string) => void;
}

export const CallContext = createContext<CallContextValue | null>(null);

export const useCallContext = (): CallContextValue => {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCallContext must be used within a CallProvider');
  }
  return context;
};
```

- [ ] **Step 9: Update App.tsx to use extracted hooks and CallContext**

Rewrite `App.tsx` to use the extracted hooks. The file shrinks from 573 to ~250 lines. Key changes:

- Replace inline `useState` for history/pinned with `useCallHistory()`
- Replace inline incoming call listener with `useIncomingCall()`
- Replace inline sound effects/timer with `useCallNotifications()`
- Wrap the call view in `CallContext.Provider`
- Keep the render logic largely the same

- [ ] **Step 10: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 11: Run type check**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: No errors

- [ ] **Step 12: Commit**

```bash
git add contexts/CallContext.tsx hooks/useCallHistory.ts hooks/useIncomingCall.ts hooks/useCallNotifications.ts test/hooks/useCallHistory.test.ts test/hooks/useIncomingCall.test.ts App.tsx
git commit -m "refactor: extract CallContext, useCallHistory, useIncomingCall, useCallNotifications from App"
```

---

## Task 7: Tighten CSP and Database Rules

**Files:**

- Modify: `firebase.json`
- Modify: `database.rules.json`

- [ ] **Step 1: Update CSP in firebase.json**

Replace the CSP header value in `firebase.json` (line 45):

```
"default-src 'self'; script-src 'self' 'unsafe-eval' https://www.gstatic.com https://aistudiocdn.com; connect-src 'self' wss://*.firebaseio.com https://*.googleapis.com https://*.gstatic.com stun:stun.l.google.com:19302 stun:stun1.l.google.com:19302 stun:stun2.l.google.com:19302 stun:stun3.l.google.com:19302 turn:openrelay.metered.ca:80 turn:openrelay.metered.ca:443 data: blob:; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; media-src * blob:; font-src 'self'"
```

Add a comment above the CSP line (as a separate header) or note in the project that `'unsafe-eval'` is required by Firebase SDK v8 compat and should be removed when migrating to v9+.

- [ ] **Step 2: Update database rules**

Replace `database.rules.json`:

```json
{
  "rules": {
    "calls": {
      ".indexOn": ["callerId", "joinerId"],
      "$callId": {
        ".read": "auth != null && (!data.exists() || data.child('callerId').val() === auth.uid || data.child('joinerId').val() === auth.uid)",
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
        ".write": "auth != null && auth.uid === $userId",
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

Key changes:

- `calls/$callId/.read`: Only caller/joiner can read (any auth user can read when call doesn't exist yet, for join flow)
- `calls/.indexOn`: Added indexes for `callerId` and `joinerId`
- `users/$userId/.write`: Restricted from any auth user to only the user themselves

- [ ] **Step 3: Commit**

```bash
git add firebase.json database.rules.json
git commit -m "security: tighten CSP connect-src, restrict database read/write rules"
```

---

## Task 8: Final Verification

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Verify test coverage**

Run: `npm run test:coverage`
Expected: Coverage report shows improvement over baseline

- [ ] **Step 5: Final commit if any fixups needed**

```bash
git add -A
git commit -m "fix: final cleanup after comprehensive codebase health improvements"
```
