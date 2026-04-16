import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDataChannel } from '../../hooks/useDataChannel';

describe('useDataChannel', () => {
  let mockDataChannel: RTCDataChannel;

  beforeEach(() => {
    mockDataChannel = {
      close: vi.fn(),
      send: vi.fn(),
      readyState: 'open',
      onopen: null,
      onclose: null,
      onmessage: null,
      bufferedAmount: 0,
      bufferedAmountLowThreshold: 0,
      binaryType: 'blob',
      id: 0,
      label: 'mock-channel',
      maxPacketLifeTime: 0,
      maxRetransmits: 0,
      negotiated: false,
      ordered: true,
      protocol: '',
      onbufferedamountlow: null,
      onclosing: null,
      onerror: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as unknown as RTCDataChannel;
  });

  describe('sendMessage', () => {
    it('should send JSON chat message', () => {
      const { result } = renderHook(() => useDataChannel());

      act(() => {
        result.current.setDataChannel(mockDataChannel);
      });

      act(() => {
        result.current.sendMessage('Hello, world!');
      });

      expect(mockDataChannel.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'chat', payload: 'Hello, world!' })
      );
    });

    it('should be no-op when channel is closed', () => {
      const closedChannel = { ...mockDataChannel, readyState: 'closed' as RTCDataChannelState } as RTCDataChannel;
      const { result } = renderHook(() => useDataChannel());

      act(() => {
        result.current.setDataChannel(closedChannel);
      });

      act(() => {
        result.current.sendMessage('Hello, world!');
      });

      expect(closedChannel.send).not.toHaveBeenCalled();
    });

    it('should be no-op when channel is null', () => {
      const { result } = renderHook(() => useDataChannel());

      act(() => {
        result.current.sendMessage('Hello, world!');
      });

      expect(mockDataChannel.send).not.toHaveBeenCalled();
    });
  });

  describe('sendControl', () => {
    it('should send mute control message', () => {
      const { result } = renderHook(() => useDataChannel());

      act(() => {
        result.current.setDataChannel(mockDataChannel);
      });

      act(() => {
        result.current.sendControl('mute', true);
      });

      expect(mockDataChannel.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'control', payload: { type: 'mute', value: true } })
      );
    });

    it('should send video control message', () => {
      const { result } = renderHook(() => useDataChannel());

      act(() => {
        result.current.setDataChannel(mockDataChannel);
      });

      act(() => {
        result.current.sendControl('video', false);
      });

      expect(mockDataChannel.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'control', payload: { type: 'video', value: false } })
      );
    });
  });

  describe('incoming messages', () => {
    it('should trigger callback for chat messages', () => {
      const { result } = renderHook(() => useDataChannel());
      const chatCallback = vi.fn();

      act(() => {
        result.current.setOnChatMessage(chatCallback);
        result.current.setDataChannel(mockDataChannel);
      });

      act(() => {
        const messageEvent = new MessageEvent('message', {
          data: JSON.stringify({ type: 'chat', payload: 'Hello there!' }),
        });
        mockDataChannel.onmessage?.(messageEvent);
      });

      expect(chatCallback).toHaveBeenCalledWith('Hello there!');
    });

    it('should update isRemoteMuted on mute control message', () => {
      const { result } = renderHook(() => useDataChannel());

      act(() => {
        result.current.setDataChannel(mockDataChannel);
      });

      expect(result.current.isRemoteMuted).toBe(false);

      act(() => {
        const messageEvent = new MessageEvent('message', {
          data: JSON.stringify({ type: 'control', payload: { type: 'mute', value: true } }),
        });
        mockDataChannel.onmessage?.(messageEvent);
      });

      expect(result.current.isRemoteMuted).toBe(true);
    });

    it('should update isRemoteVideoOff on video control message', () => {
      const { result } = renderHook(() => useDataChannel());

      act(() => {
        result.current.setDataChannel(mockDataChannel);
      });

      expect(result.current.isRemoteVideoOff).toBe(false);

      act(() => {
        const messageEvent = new MessageEvent('message', {
          data: JSON.stringify({ type: 'control', payload: { type: 'video', value: true } }),
        });
        mockDataChannel.onmessage?.(messageEvent);
      });

      expect(result.current.isRemoteVideoOff).toBe(true);
    });

    it('should handle malformed messages gracefully - raw string fallback', () => {
      const { result } = renderHook(() => useDataChannel());
      const chatCallback = vi.fn();

      act(() => {
        result.current.setOnChatMessage(chatCallback);
        result.current.setDataChannel(mockDataChannel);
      });

      // This should not throw
      expect(() => {
        act(() => {
          const messageEvent = new MessageEvent('message', {
            data: 'not-json',
          });
          mockDataChannel.onmessage?.(messageEvent);
        });
      }).not.toThrow();

      // Raw string should be passed to callback
      expect(chatCallback).toHaveBeenCalledWith('not-json');
    });

    it('should handle malformed messages gracefully - non-string data', () => {
      const { result } = renderHook(() => useDataChannel());
      const chatCallback = vi.fn();

      act(() => {
        result.current.setOnChatMessage(chatCallback);
        result.current.setDataChannel(mockDataChannel);
      });

      // This should not throw
      expect(() => {
        act(() => {
          const messageEvent = new MessageEvent('message', {
            data: { invalid: 'object' },
          });
          mockDataChannel.onmessage?.(messageEvent);
        });
      }).not.toThrow();

      // Non-string data should not trigger callback
      expect(chatCallback).not.toHaveBeenCalled();
    });

    it('should handle control message with false values', () => {
      const { result } = renderHook(() => useDataChannel());

      act(() => {
        result.current.setDataChannel(mockDataChannel);
      });

      // Set to true first
      act(() => {
        const messageEvent = new MessageEvent('message', {
          data: JSON.stringify({ type: 'control', payload: { type: 'mute', value: true } }),
        });
        mockDataChannel.onmessage?.(messageEvent);
      });

      expect(result.current.isRemoteMuted).toBe(true);

      // Set to false
      act(() => {
        const messageEvent = new MessageEvent('message', {
          data: JSON.stringify({ type: 'control', payload: { type: 'mute', value: false } }),
        });
        mockDataChannel.onmessage?.(messageEvent);
      });

      expect(result.current.isRemoteMuted).toBe(false);
    });
  });

  describe('cleanupDataChannel', () => {
    it('should close channel and reset state', () => {
      const { result } = renderHook(() => useDataChannel());

      act(() => {
        result.current.setDataChannel(mockDataChannel);
      });

      // Set some state
      act(() => {
        const messageEvent = new MessageEvent('message', {
          data: JSON.stringify({ type: 'control', payload: { type: 'mute', value: true } }),
        });
        mockDataChannel.onmessage?.(messageEvent);
      });

      expect(result.current.isRemoteMuted).toBe(true);
      expect(result.current.isRemoteVideoOff).toBe(false);

      act(() => {
        result.current.cleanupDataChannel();
      });

      expect(mockDataChannel.close).toHaveBeenCalled();
      expect(result.current.isRemoteMuted).toBe(false);
      expect(result.current.isRemoteVideoOff).toBe(false);
    });

    it('should handle cleanup when channel is null', () => {
      const { result } = renderHook(() => useDataChannel());

      expect(() => {
        act(() => {
          result.current.cleanupDataChannel();
        });
      }).not.toThrow();
    });
  });

  describe('setOnChatMessage', () => {
    it('should update chat message callback', () => {
      const { result } = renderHook(() => useDataChannel());
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      act(() => {
        result.current.setOnChatMessage(callback1);
        result.current.setDataChannel(mockDataChannel);
      });

      act(() => {
        const messageEvent = new MessageEvent('message', {
          data: JSON.stringify({ type: 'chat', payload: 'test' }),
        });
        mockDataChannel.onmessage?.(messageEvent);
      });

      expect(callback1).toHaveBeenCalledWith('test');
      expect(callback2).not.toHaveBeenCalled();

      // Update callback
      act(() => {
        result.current.setOnChatMessage(callback2);
      });

      act(() => {
        const messageEvent = new MessageEvent('message', {
          data: JSON.stringify({ type: 'chat', payload: 'test2' }),
        });
        mockDataChannel.onmessage?.(messageEvent);
      });

      expect(callback2).toHaveBeenCalledWith('test2');
    });
  });

  describe('setDataChannel', () => {
    it('should replace existing channel', () => {
      const { result } = renderHook(() => useDataChannel());
      const mockChannel2 = { ...mockDataChannel, label: 'channel2' };

      act(() => {
        result.current.setDataChannel(mockDataChannel);
      });

      act(() => {
        result.current.sendMessage('first');
      });

      expect(mockDataChannel.send).toHaveBeenCalledTimes(1);

      act(() => {
        result.current.setDataChannel(mockChannel2);
      });

      act(() => {
        result.current.sendMessage('second');
      });

      expect(mockChannel2.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'chat', payload: 'second' })
      );
    });
  });
});
