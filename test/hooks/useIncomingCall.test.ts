import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useIncomingCall } from '../../hooks/useIncomingCall';
import { CallState, IncomingCall } from '../../types';
import { db } from '../../firebase';

// Mock Firebase
vi.mock('../../firebase', () => ({
  db: {
    ref: vi.fn(() => ({
      on: vi.fn(),
      off: vi.fn(),
    })),
  },
}));

describe('useIncomingCall', () => {
  let mockOn: ReturnType<typeof vi.fn>;
  let mockOff: ReturnType<typeof vi.fn>;
  let mockRef: ReturnType<typeof vi.fn>;
  let listenerCallback: ((snapshot: { val: () => IncomingCall | null }) => void) | null = null;

  beforeEach(() => {
    listenerCallback = null;
    mockOn = vi.fn((event: string, callback: (snapshot: { val: () => IncomingCall | null }) => void) => {
      listenerCallback = callback;
    });
    mockOff = vi.fn();
    mockRef = vi.fn(() => ({ on: mockOn, off: mockOff }));
    (db.ref as ReturnType<typeof vi.fn>).mockImplementation(mockRef);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with null incomingCall', () => {
    const setCallState = vi.fn();
    const { result } = renderHook(() =>
      useIncomingCall('user-123', CallState.IDLE, setCallState)
    );
    expect(result.current.incomingCall).toBeNull();
  });

  it('sets incoming call when Firebase listener receives call', async () => {
    const setCallState = vi.fn();
    renderHook(() =>
      useIncomingCall('user-123', CallState.IDLE, setCallState)
    );

    const incomingCall: IncomingCall = {
      from: 'caller-456',
      callId: 'test-call-123',
      callerAlias: 'Alice',
    };

    await act(async () => {
      listenerCallback!({ val: () => incomingCall });
    });

    await waitFor(() => {
      expect(setCallState).toHaveBeenCalledWith(CallState.INCOMING_CALL);
    });
  });

  it('does not set incoming call when not in IDLE state', async () => {
    const setCallState = vi.fn();
    renderHook(() =>
      useIncomingCall('user-123', CallState.CONNECTED, setCallState)
    );

    const incomingCall: IncomingCall = {
      from: 'caller-456',
      callId: 'test-call-123',
      callerAlias: 'Alice',
    };

    await act(async () => {
      listenerCallback!({ val: () => incomingCall });
    });

    expect(setCallState).not.toHaveBeenCalledWith(CallState.INCOMING_CALL);
  });

  it('clears incoming call when Firebase listener receives null', async () => {
    const setCallState = vi.fn();
    const { result } = renderHook(() =>
      useIncomingCall('user-123', CallState.INCOMING_CALL, setCallState)
    );

    await act(async () => {
      listenerCallback!({ val: () => null });
    });

    await waitFor(() => {
      expect(result.current.incomingCall).toBeNull();
      expect(setCallState).toHaveBeenCalledWith(CallState.IDLE);
    });
  });

  it('handleAcceptCall calls joinCallFn with incoming call ID', () => {
    const setCallState = vi.fn();
    const { result } = renderHook(() =>
      useIncomingCall('user-123', CallState.IDLE, setCallState)
    );

    // Simulate receiving an incoming call
    act(() => {
      listenerCallback!({ val: () => ({ from: 'caller-456', callId: 'test-call-123', callerAlias: 'Alice' }) });
    });

    const joinCallFn = vi.fn();
    act(() => {
      result.current.handleAcceptCall(joinCallFn);
    });

    expect(joinCallFn).toHaveBeenCalledWith('test-call-123');
  });

  it('handleDeclineCall calls declineCallFn and clears incoming call', () => {
    const setCallState = vi.fn();
    const { result } = renderHook(() =>
      useIncomingCall('user-123', CallState.IDLE, setCallState)
    );

    // Simulate receiving an incoming call
    act(() => {
      listenerCallback!({ val: () => ({ from: 'caller-456', callId: 'test-call-123', callerAlias: 'Alice' }) });
    });

    const declineCallFn = vi.fn().mockResolvedValue(undefined);
    const resetFn = vi.fn();

    act(() => {
      result.current.handleDeclineCall(declineCallFn, resetFn);
    });

    expect(declineCallFn).toHaveBeenCalledWith('test-call-123');
    expect(resetFn).toHaveBeenCalled();
  });

  it('cleans up Firebase listener on unmount', () => {
    const setCallState = vi.fn();
    const { unmount } = renderHook(() =>
      useIncomingCall('user-123', CallState.IDLE, setCallState)
    );

    unmount();

    expect(mockOff).toHaveBeenCalledWith('value', expect.any(Function));
  });
});
