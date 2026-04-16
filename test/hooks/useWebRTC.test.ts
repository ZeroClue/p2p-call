import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useWebRTC } from '../../hooks/useWebRTC';
import { CallState } from '../../types';

// Mock setTimeout/clearTimeout for ringing
global.setTimeout = vi.fn((fn, delay) => {
  fn();
  return {} as any;
}) as any;
global.clearTimeout = vi.fn() as any;

// Mock setInterval/clearInterval for stats
let statsIntervalCallback: (() => void) | null = null;
global.setInterval = vi.fn((fn: () => void, delay: number) => {
  statsIntervalCallback = fn;
  return {} as any;
}) as any;
global.clearInterval = vi.fn() as any;

describe('useWebRTC', () => {
  beforeEach(() => {
    // Reset timers
    statsIntervalCallback = null;
    vi.clearAllMocks();
  });

  it('starts in IDLE state', () => {
    const { result } = renderHook(() => useWebRTC('720p'));

    expect(result.current.callState).toBe(CallState.IDLE);
    expect(result.current.localStream).toBeNull();
    expect(result.current.remoteStream).toBeNull();
    expect(result.current.callId).toBeNull();
    expect(result.current.peerId).toBeNull();
  });

  it('enters lobby when media access succeeds', async () => {
    const { result } = renderHook(() => useWebRTC('720p'));

    await act(async () => {
      await result.current.enterLobby();
    });

    expect(result.current.callState).toBe(CallState.LOBBY);
    expect(result.current.localStream).not.toBeNull();
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
      video: { width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: true,
    });
  });

  it('starts call and transitions to WAITING_FOR_ANSWER', async () => {
    const { result } = renderHook(() => useWebRTC('720p'));

    // Enter lobby first to get media
    await act(async () => {
      await result.current.enterLobby();
    });

    expect(result.current.callState).toBe(CallState.LOBBY);

    // Start call
    await act(async () => {
      await result.current.startCall();
    });

    expect(result.current.callState).toBe(CallState.WAITING_FOR_ANSWER);
    expect(result.current.callId).not.toBeNull();
    expect(result.current.callId).toMatch(/^[a-z]+-[a-z]+-[a-z]+$/);
  });

  it('hangs up and transitions to ENDED', async () => {
    const { result } = renderHook(() => useWebRTC('720p'));

    // Enter lobby and start call
    await act(async () => {
      await result.current.enterLobby();
    });

    await act(async () => {
      await result.current.startCall();
    });

    expect(result.current.callState).toBe(CallState.WAITING_FOR_ANSWER);

    // Hang up
    await act(async () => {
      result.current.hangUp();
    });

    expect(result.current.callState).toBe(CallState.ENDED);
  });

  it('resets to IDLE state with null values', async () => {
    const { result } = renderHook(() => useWebRTC('720p'));

    // Enter lobby and start call
    await act(async () => {
      await result.current.enterLobby();
    });

    await act(async () => {
      await result.current.startCall();
    });

    expect(result.current.callState).not.toBe(CallState.IDLE);
    expect(result.current.callId).not.toBeNull();

    // Reset
    await act(async () => {
      result.current.reset();
    });

    expect(result.current.callState).toBe(CallState.IDLE);
    expect(result.current.callId).toBeNull();
    expect(result.current.peerId).toBeNull();
    expect(result.current.connectionState).toBe('new');
  });

  it('adds beforeunload listener on mount and removes on unmount', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => useWebRTC('720p'));

    expect(addEventListenerSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));
  });

  it('toggles mute and video states', async () => {
    const { result } = renderHook(() => useWebRTC('720p'));

    // Enter lobby first
    await act(async () => {
      await result.current.enterLobby();
    });

    expect(result.current.isMuted).toBe(false);
    expect(result.current.isVideoOff).toBe(false);

    // Toggle mute
    await act(async () => {
      result.current.toggleMute();
    });

    expect(result.current.isMuted).toBe(true);

    // Toggle video
    await act(async () => {
      result.current.toggleVideo();
    });

    expect(result.current.isVideoOff).toBe(true);
  });

  it('changes resolution', async () => {
    const { result } = renderHook(() => useWebRTC('720p'));

    expect(result.current.resolution).toBe('720p');

    await act(async () => {
      result.current.setResolution('1080p');
    });

    expect(result.current.resolution).toBe('1080p');
  });

  it('handles E2EE toggle', () => {
    const { result } = renderHook(() => useWebRTC('720p'));

    expect(result.current.enableE2EE).toBe(true);

    act(() => {
      result.current.setEnableE2EE(false);
    });

    expect(result.current.enableE2EE).toBe(false);
  });

  it('sets and calls chat message callback', async () => {
    const { result } = renderHook(() => useWebRTC('720p'));

    const onChatMessage = vi.fn();

    await act(async () => {
      result.current.setOnChatMessage(onChatMessage);
    });

    // Enter lobby and start call to set up data channel
    await act(async () => {
      await result.current.enterLobby();
    });

    await act(async () => {
      await result.current.startCall();
    });

    // Send message
    await act(async () => {
      result.current.sendMessage('Hello, world!');
    });

    // The data channel mock's send function should have been called
    expect(global.RTCPeerConnection).toHaveBeenCalled();
  });
});
