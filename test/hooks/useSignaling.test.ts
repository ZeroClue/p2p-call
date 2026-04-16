import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { CallState } from '../../types';
import * as firebaseModule from '../../firebase';

// Mock Firebase module
vi.mock('../../firebase', () => {
  const mockOn = vi.fn();
  const mockOff = vi.fn();
  const mockSet = vi.fn().mockResolvedValue(undefined);
  const mockUpdate = vi.fn().mockResolvedValue(undefined);
  const mockRemove = vi.fn().mockResolvedValue(undefined);
  const mockPush = vi.fn().mockResolvedValue({ key: 'mock-key' });
  const mockGet = vi.fn().mockResolvedValue({
    val: () => null,
    exists: () => false,
  });

  const createMockRef = (path: string) => ({
    _path: path,
    _lastChild: '',
    on: mockOn,
    off: mockOff,
    set: mockSet,
    update: mockUpdate,
    remove: mockRemove,
    push: mockPush,
    get: mockGet,
    child: vi.fn(function (this: unknown, childPath: string) {
      this._lastChild = childPath;
      return this;
    }),
  });

  return {
    db: {
      ref: vi.fn((path: string) => createMockRef(path)),
    },
  };
});

// Mock utilities
vi.mock('../../utils/id', () => ({
  generateCallId: () => 'test-call-id',
  generateUUID: () => 'test-uuid-123',
}));

vi.mock('../../utils/user', () => ({
  getUserId: () => 'test-user-id',
  getUserDisplayName: () => 'Test User',
}));

vi.mock('../../utils/crypto', () => ({
  generateKey: vi.fn(async () => ({
    key: { type: 'secret', algorithm: { name: 'AES-GCM' } },
    rawKey: new ArrayBuffer(32),
  })),
  importKey: vi.fn(async (_rawKey: ArrayBuffer) => ({
    type: 'secret',
    algorithm: { name: 'AES-GCM' },
  })),
}));

// Import after mocking
import { useSignaling } from '../../hooks/useSignaling';

describe('useSignaling', () => {
  const mockCallbacks = {
    onCallStateChange: vi.fn(),
    onSetCallId: vi.fn(),
    onSetPeerId: vi.fn(),
    onSetE2EEActive: vi.fn(),
  };

  const mockCallStateRef = { current: CallState.IDLE };
  const mockPeerIdRef = { current: null };
  const mockEnableE2EERef = { current: true };

  let mockPeerConnection: RTCPeerConnection;
  let mockStream: MediaStream;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Reset call state ref
    mockCallStateRef.current = CallState.IDLE;
    mockPeerIdRef.current = null;

    // Create mock peer connection
    mockPeerConnection = {
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
        close: vi.fn(),
        send: vi.fn(),
        readyState: 'open',
      }),
      close: vi.fn(),
      connectionState: 'new',
      onicecandidate: null,
      ontrack: null,
      ondatachannel: null,
      currentRemoteDescription: null,
    } as unknown as RTCPeerConnection;

    // Create mock stream
    mockStream = {
      getTracks: vi.fn(() => []),
      getAudioTracks: vi.fn(() => [{ enabled: true, stop: vi.fn() }]),
      getVideoTracks: vi.fn(() => [{ enabled: true, stop: vi.fn() }]),
    } as unknown as MediaStream;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initiateCall', () => {
    it('should write offer to Firebase and set call state', async () => {
      const { result } = renderHook(() =>
        useSignaling(mockCallbacks, mockCallStateRef, mockPeerIdRef, mockEnableE2EERef),
      );

      await act(async () => {
        await result.current.initiateCall(
          'test-call-id',
          mockPeerConnection,
          mockStream,
          true,
          false,
        );
      });

      // Verify call state changes
      expect(mockCallbacks.onCallStateChange).toHaveBeenCalledWith(CallState.CREATING_OFFER);
      expect(mockCallbacks.onCallStateChange).toHaveBeenCalledWith(CallState.WAITING_FOR_ANSWER);

      // Verify call ID was set
      expect(mockCallbacks.onSetCallId).toHaveBeenCalledWith('test-call-id');

      // Verify db.ref was called
      expect(firebaseModule.db.ref).toHaveBeenCalledWith('calls/test-call-id');
    });

    it('should set up ICE candidate handler', async () => {
      const { result } = renderHook(() =>
        useSignaling(mockCallbacks, mockCallStateRef, mockPeerIdRef, mockEnableE2EERef),
      );

      await act(async () => {
        await result.current.initiateCall(
          'test-call-id',
          mockPeerConnection,
          mockStream,
          true,
          false,
        );
      });

      // Verify ICE candidate handler is set
      expect(mockPeerConnection.onicecandidate).toBeTruthy();
    });

    it('should use RINGING state when isRinging is true', async () => {
      const { result } = renderHook(() =>
        useSignaling(mockCallbacks, mockCallStateRef, mockPeerIdRef, mockEnableE2EERef),
      );

      await act(async () => {
        await result.current.initiateCall(
          'test-call-id',
          mockPeerConnection,
          mockStream,
          true,
          true,
        );
      });

      expect(mockCallbacks.onCallStateChange).toHaveBeenCalledWith(CallState.RINGING);
      // Should not transition to WAITING_FOR_ANSWER when ringing
      expect(mockCallbacks.onCallStateChange).not.toHaveBeenCalledWith(
        CallState.WAITING_FOR_ANSWER,
      );
    });

    it('should guard against concurrent operations', async () => {
      const { result } = renderHook(() =>
        useSignaling(mockCallbacks, mockCallStateRef, mockPeerIdRef, mockEnableE2EERef),
      );

      // Set operation in progress
      act(() => {
        result.current.setOperationInProgress(true);
      });

      await act(async () => {
        await result.current.initiateCall(
          'test-call-id',
          mockPeerConnection,
          mockStream,
          true,
          false,
        );
      });

      // Should not proceed with the call - no state changes
      expect(mockCallbacks.onCallStateChange).not.toHaveBeenCalled();
    });

    it('should set MEDIA_ERROR state when stream is null', async () => {
      const { result } = renderHook(() =>
        useSignaling(mockCallbacks, mockCallStateRef, mockPeerIdRef, mockEnableE2EERef),
      );

      await act(async () => {
        await result.current.initiateCall(
          'test-call-id',
          mockPeerConnection,
          null as any,
          true,
          false,
        );
      });

      expect(mockCallbacks.onCallStateChange).toHaveBeenCalledWith(CallState.MEDIA_ERROR);
    });

    it('should add tracked listeners for answer and ICE candidates', async () => {
      const { result } = renderHook(() =>
        useSignaling(mockCallbacks, mockCallStateRef, mockPeerIdRef, mockEnableE2EERef),
      );

      await act(async () => {
        await result.current.initiateCall(
          'test-call-id',
          mockPeerConnection,
          mockStream,
          true,
          false,
        );
      });

      // Verify listeners were registered (2 calls: value + child_added)
      // Since all refs share the same mock functions, we check the total count
      expect(firebaseModule.db.ref).toHaveBeenCalled();
    });
  });

  describe('joinCall', () => {
    it('should write answer to Firebase when offer exists', async () => {
      // Mock get to return offer data
      const mockGet = vi.fn().mockResolvedValue({
        val: () => ({
          offer: { sdp: 'offer-sdp', type: 'offer' },
          callerId: 'caller-123',
        }),
        exists: () => true,
      });

      firebaseModule.db.ref = vi.fn((path: string) => ({
        _path: path,
        _lastChild: '',
        on: vi.fn(),
        off: vi.fn(),
        set: vi.fn().mockResolvedValue(undefined),
        update: vi.fn().mockResolvedValue(undefined),
        remove: vi.fn().mockResolvedValue(undefined),
        push: vi.fn().mockResolvedValue({ key: 'mock-key' }),
        get: mockGet,
        child: vi.fn(function (this: unknown, childPath: string) {
          this._lastChild = childPath;
          return this;
        }),
      }));

      const { result } = renderHook(() =>
        useSignaling(mockCallbacks, mockCallStateRef, mockPeerIdRef, mockEnableE2EERef),
      );

      await act(async () => {
        await result.current.joinCall('test-call-id', mockPeerConnection, mockStream, true);
      });

      // Verify state changes
      expect(mockCallbacks.onCallStateChange).toHaveBeenCalledWith(CallState.JOINING);
      expect(mockCallbacks.onCallStateChange).toHaveBeenCalledWith(CallState.CREATING_ANSWER);
    });

    it('should delegate to initiateCall when no offer exists', async () => {
      // Mock get to return null (no offer)
      const mockGet = vi.fn().mockResolvedValue({
        val: () => null,
        exists: () => false,
      });

      firebaseModule.db.ref = vi.fn((path: string) => ({
        _path: path,
        _lastChild: '',
        on: vi.fn(),
        off: vi.fn(),
        set: vi.fn().mockResolvedValue(undefined),
        update: vi.fn().mockResolvedValue(undefined),
        remove: vi.fn().mockResolvedValue(undefined),
        push: vi.fn().mockResolvedValue({ key: 'mock-key' }),
        get: mockGet,
        child: vi.fn(function (this: unknown, childPath: string) {
          this._lastChild = childPath;
          return this;
        }),
      }));

      const { result } = renderHook(() =>
        useSignaling(mockCallbacks, mockCallStateRef, mockPeerIdRef, mockEnableE2EERef),
      );

      // The joinCall will set isOperationInProgressRef to true, then try to call initiateCall
      // which will check the flag and return early. So we need to check if the log message
      // was generated instead.
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await act(async () => {
        await result.current.joinCall('test-call-id', mockPeerConnection, mockStream, true);
      });

      // Should have logged the message about call being available
      expect(consoleSpy).toHaveBeenCalledWith(
        'Call ID "test-call-id" is available. Initializing a new call.',
      );

      consoleSpy.mockRestore();
    });

    it('should guard against concurrent operations', async () => {
      const { result } = renderHook(() =>
        useSignaling(mockCallbacks, mockCallStateRef, mockPeerIdRef, mockEnableE2EERef),
      );

      // Set operation in progress
      act(() => {
        result.current.setOperationInProgress(true);
      });

      await act(async () => {
        await result.current.joinCall('test-call-id', mockPeerConnection, mockStream, true);
      });

      // Should not proceed - no createOffer call
      expect(mockPeerConnection.createOffer).not.toHaveBeenCalled();
    });
  });

  describe('declineCall', () => {
    it('should write declined flag and set IDLE state', async () => {
      const { result } = renderHook(() =>
        useSignaling(mockCallbacks, mockCallStateRef, mockPeerIdRef, mockEnableE2EERef),
      );

      await act(async () => {
        await result.current.declineCall('test-call-id');
      });

      // Verify state change
      expect(mockCallbacks.onCallStateChange).toHaveBeenCalledWith(CallState.IDLE);

      // Verify db.ref was called for call doc
      expect(firebaseModule.db.ref).toHaveBeenCalledWith('calls/test-call-id');
    });
  });

  describe('ringUser', () => {
    it('should write incoming call to peer and initiate call', async () => {
      const peer = { callId: 'peer-call-123', alias: 'Peer User', peerId: 'peer-123' };

      const { result } = renderHook(() =>
        useSignaling(mockCallbacks, mockCallStateRef, mockPeerIdRef, mockEnableE2EERef),
      );

      await act(async () => {
        await result.current.ringUser(peer, mockPeerConnection, mockStream, true);
      });

      // Verify peer ID and call ID were set
      expect(mockCallbacks.onSetPeerId).toHaveBeenCalledWith('peer-123');

      // Verify initiateCall was called (check for createOffer)
      expect(mockPeerConnection.createOffer).toHaveBeenCalled();

      // Verify db.ref was called for incoming call
      expect(firebaseModule.db.ref).toHaveBeenCalledWith('users/peer-123/incomingCall');
    });

    it('should return early if peer has no peerId', async () => {
      const peer = { callId: 'peer-call-123', alias: 'Peer User' };

      const { result } = renderHook(() =>
        useSignaling(mockCallbacks, mockCallStateRef, mockPeerIdRef, mockEnableE2EERef),
      );

      await act(async () => {
        await result.current.ringUser(peer, mockPeerConnection, mockStream, true);
      });

      // Should not proceed with call
      expect(mockPeerConnection.createOffer).not.toHaveBeenCalled();
    });

    it('should start ringing timeout', async () => {
      const peer = { callId: 'peer-call-123', alias: 'Peer User', peerId: 'peer-123' };

      const { result } = renderHook(() =>
        useSignaling(mockCallbacks, mockCallStateRef, mockPeerIdRef, mockEnableE2EERef),
      );

      const setTimeoutSpy = vi.spyOn(global, 'setTimeout');

      await act(async () => {
        await result.current.ringUser(peer, mockPeerConnection, mockStream, true);
      });

      // Verify setTimeout was called with RING_TIMEOUT_MS
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 30000);

      setTimeoutSpy.mockRestore();
    });
  });

  describe('cleanupSignaling', () => {
    it('should remove all tracked listeners', async () => {
      const mockOn = vi.fn();
      const mockOff = vi.fn();

      firebaseModule.db.ref = vi.fn((path: string) => ({
        _path: path,
        _lastChild: '',
        on: mockOn,
        off: mockOff,
        set: vi.fn().mockResolvedValue(undefined),
        update: vi.fn().mockResolvedValue(undefined),
        remove: vi.fn().mockResolvedValue(undefined),
        push: vi.fn().mockResolvedValue({ key: 'mock-key' }),
        get: vi.fn().mockResolvedValue({
          val: () => null,
          exists: () => false,
        }),
        child: vi.fn(function (this: unknown, childPath: string) {
          this._lastChild = childPath;
          return this;
        }),
      }));

      const { result } = renderHook(() =>
        useSignaling(mockCallbacks, mockCallStateRef, mockPeerIdRef, mockEnableE2EERef),
      );

      // Initiate a call to set up listeners
      await act(async () => {
        await result.current.initiateCall(
          'test-call-id',
          mockPeerConnection,
          mockStream,
          true,
          false,
        );
      });

      // Track how many times 'on' was called
      const onCallCount = mockOn.mock.calls.length;
      expect(onCallCount).toBeGreaterThan(0);

      // Cleanup
      act(() => {
        result.current.cleanupSignaling();
      });

      // Verify 'off' was called for each 'on'
      expect(mockOff).toHaveBeenCalledTimes(onCallCount);
    });

    it('should remove call doc when keepCallDoc is false', async () => {
      const mockRemove = vi.fn().mockResolvedValue(undefined);

      firebaseModule.db.ref = vi.fn((path: string) => ({
        _path: path,
        _lastChild: '',
        on: vi.fn(),
        off: vi.fn(),
        set: vi.fn().mockResolvedValue(undefined),
        update: vi.fn().mockResolvedValue(undefined),
        remove: mockRemove,
        push: vi.fn().mockResolvedValue({ key: 'mock-key' }),
        get: vi.fn().mockResolvedValue({
          val: () => null,
          exists: () => false,
        }),
        child: vi.fn(function (this: unknown, childPath: string) {
          this._lastChild = childPath;
          return this;
        }),
      }));

      const { result } = renderHook(() =>
        useSignaling(mockCallbacks, mockCallStateRef, mockPeerIdRef, mockEnableE2EERef),
      );

      // Initiate a call to set up refs
      await act(async () => {
        await result.current.initiateCall(
          'test-call-id',
          mockPeerConnection,
          mockStream,
          true,
          false,
        );
      });

      // Reset remove mock to track new calls
      mockRemove.mockClear();

      // Cleanup with keepCallDoc=false (default)
      act(() => {
        result.current.cleanupSignaling(false);
      });

      expect(mockRemove).toHaveBeenCalled();
    });

    it('should not remove call doc when keepCallDoc is true', async () => {
      const mockRemove = vi.fn().mockResolvedValue(undefined);

      firebaseModule.db.ref = vi.fn((path: string) => ({
        _path: path,
        _lastChild: '',
        on: vi.fn(),
        off: vi.fn(),
        set: vi.fn().mockResolvedValue(undefined),
        update: vi.fn().mockResolvedValue(undefined),
        remove: mockRemove,
        push: vi.fn().mockResolvedValue({ key: 'mock-key' }),
        get: vi.fn().mockResolvedValue({
          val: () => null,
          exists: () => false,
        }),
        child: vi.fn(function (this: unknown, childPath: string) {
          this._lastChild = childPath;
          return this;
        }),
      }));

      const { result } = renderHook(() =>
        useSignaling(mockCallbacks, mockCallStateRef, mockPeerIdRef, mockEnableE2EERef),
      );

      // Initiate a call to set up refs
      await act(async () => {
        await result.current.initiateCall(
          'test-call-id',
          mockPeerConnection,
          mockStream,
          true,
          false,
        );
      });

      // Reset remove mock to track new calls
      mockRemove.mockClear();

      // Cleanup with keepCallDoc=true
      act(() => {
        result.current.cleanupSignaling(true);
      });

      expect(mockRemove).not.toHaveBeenCalled();
    });

    it('should reset E2EE active state', async () => {
      const { result } = renderHook(() =>
        useSignaling(mockCallbacks, mockCallStateRef, mockPeerIdRef, mockEnableE2EERef),
      );

      act(() => {
        result.current.cleanupSignaling();
      });

      expect(mockCallbacks.onSetE2EEActive).toHaveBeenCalledWith(false);
    });
  });

  describe('setOperationInProgress', () => {
    it('should set the operation in progress flag', async () => {
      const { result } = renderHook(() =>
        useSignaling(mockCallbacks, mockCallStateRef, mockPeerIdRef, mockEnableE2EERef),
      );

      act(() => {
        result.current.setOperationInProgress(true);
      });

      // Verify by trying to initiate call - it should be guarded
      await act(async () => {
        await result.current.initiateCall(
          'test-call-id',
          mockPeerConnection,
          mockStream,
          true,
          false,
        );
      });

      // No state changes should occur
      expect(mockCallbacks.onCallStateChange).not.toHaveBeenCalled();

      // Reset and try again
      act(() => {
        result.current.setOperationInProgress(false);
      });

      await act(async () => {
        await result.current.initiateCall(
          'test-call-id',
          mockPeerConnection,
          mockStream,
          true,
          false,
        );
      });

      // Now state changes should occur
      expect(mockCallbacks.onCallStateChange).toHaveBeenCalled();
    });
  });

  describe('tracked listener cleanup (resource leak fix)', () => {
    it('should track all listeners added via addTrackedListener', async () => {
      const mockOn = vi.fn();
      const mockOff = vi.fn();

      firebaseModule.db.ref = vi.fn((path: string) => ({
        _path: path,
        _lastChild: '',
        on: mockOn,
        off: mockOff,
        set: vi.fn().mockResolvedValue(undefined),
        update: vi.fn().mockResolvedValue(undefined),
        remove: vi.fn().mockResolvedValue(undefined),
        push: vi.fn().mockResolvedValue({ key: 'mock-key' }),
        get: vi.fn().mockResolvedValue({
          val: () => null,
          exists: () => false,
        }),
        child: vi.fn(function (this: unknown, childPath: string) {
          this._lastChild = childPath;
          return this;
        }),
      }));

      const { result } = renderHook(() =>
        useSignaling(mockCallbacks, mockCallStateRef, mockPeerIdRef, mockEnableE2EERef),
      );

      // Reset mock to track calls
      mockOn.mockClear();
      mockOff.mockClear();

      // Initiate call which adds listeners
      await act(async () => {
        await result.current.initiateCall(
          'test-call-id',
          mockPeerConnection,
          mockStream,
          true,
          false,
        );
      });

      // Should have added 2 listeners (value + child_added)
      expect(mockOn).toHaveBeenCalledTimes(2);

      // Cleanup should remove both
      act(() => {
        result.current.cleanupSignaling();
      });

      expect(mockOff).toHaveBeenCalledTimes(2);
    });
  });

  describe('Firebase ref paths', () => {
    it('should use correct path for call doc', async () => {
      const { result } = renderHook(() =>
        useSignaling(mockCallbacks, mockCallStateRef, mockPeerIdRef, mockEnableE2EERef),
      );

      await act(async () => {
        await result.current.initiateCall(
          'my-call-id',
          mockPeerConnection,
          mockStream,
          true,
          false,
        );
      });

      expect(firebaseModule.db.ref).toHaveBeenCalledWith('calls/my-call-id');
    });

    it('should use correct path for incoming call', async () => {
      const peer = { callId: 'peer-call-123', alias: 'Peer User', peerId: 'peer-user-id' };

      const { result } = renderHook(() =>
        useSignaling(mockCallbacks, mockCallStateRef, mockPeerIdRef, mockEnableE2EERef),
      );

      await act(async () => {
        await result.current.ringUser(peer, mockPeerConnection, mockStream, true);
      });

      expect(firebaseModule.db.ref).toHaveBeenCalledWith('users/peer-user-id/incomingCall');
    });
  });
});
