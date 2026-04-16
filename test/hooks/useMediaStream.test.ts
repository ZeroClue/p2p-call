import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMediaStream } from '../../hooks/useMediaStream';

describe('useMediaStream', () => {
  const mockGetUserMedia = vi.fn();
  const mockStream = {
    getTracks: vi.fn(() => [
      { enabled: true, stop: vi.fn() },
      { enabled: true, stop: vi.fn() },
    ]),
    getAudioTracks: vi.fn(() => [{ enabled: true, stop: vi.fn() }]),
    getVideoTracks: vi.fn(() => [{ enabled: true, stop: vi.fn() }]),
  };

  beforeEach(() => {
    // Reset mocks
    mockGetUserMedia.mockReset();
    mockStream.getTracks.mockClear();
    mockStream.getAudioTracks.mockClear();
    mockStream.getVideoTracks.mockClear();

    // Setup getUserMedia mock
    Object.defineProperty(global.navigator, 'mediaDevices', {
      value: {
        getUserMedia: mockGetUserMedia,
      },
      writable: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initMedia', () => {
    it('should successfully initialize media stream', async () => {
      mockGetUserMedia.mockResolvedValue(mockStream);

      const { result } = renderHook(() => useMediaStream('720p'));

      let stream;
      await act(async () => {
        stream = await result.current.initMedia('720p');
      });

      expect(mockGetUserMedia).toHaveBeenCalledWith({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      expect(stream).toBe(mockStream);
      expect(result.current.localStream).toBe(mockStream);
      expect(result.current.errorMessage).toBeNull();
    });

    it('should handle NotAllowedError (permission denied)', async () => {
      const notAllowedError = { name: 'NotAllowedError' };
      mockGetUserMedia.mockRejectedValue(notAllowedError);

      const { result } = renderHook(() => useMediaStream('720p'));

      let stream;
      await act(async () => {
        stream = await result.current.initMedia('720p');
      });

      expect(stream).toBeNull();
      expect(result.current.errorMessage).toBe(
        'Permission denied. Please allow this site to access your camera and microphone in your browser settings.',
      );
    });

    it('should handle NotFoundError (device not found)', async () => {
      const notFoundError = { name: 'NotFoundError' };
      mockGetUserMedia.mockRejectedValue(notFoundError);

      const { result } = renderHook(() => useMediaStream('720p'));

      let stream;
      await act(async () => {
        stream = await result.current.initMedia('720p');
      });

      expect(stream).toBeNull();
      expect(result.current.errorMessage).toBe(
        'No camera or microphone found. Please ensure your devices are connected and enabled.',
      );
    });

    it('should handle OverconstrainedError (resolution not supported)', async () => {
      const overconstrainedError = { name: 'OverconstrainedError' };
      mockGetUserMedia.mockRejectedValue(overconstrainedError);

      const { result } = renderHook(() => useMediaStream('1080p'));

      let stream;
      await act(async () => {
        stream = await result.current.initMedia('1080p');
      });

      expect(stream).toBeNull();
      expect(result.current.errorMessage).toBe(
        'The selected resolution (1080p) is not supported by your device. Try a lower quality.',
      );
    });

    it('should handle generic error', async () => {
      const genericError = new Error('Unknown error');
      mockGetUserMedia.mockRejectedValue(genericError);

      const { result } = renderHook(() => useMediaStream('720p'));

      let stream;
      await act(async () => {
        stream = await result.current.initMedia('720p');
      });

      expect(stream).toBeNull();
      expect(result.current.errorMessage).toBe(
        'Could not access camera and microphone. Please check your system settings and browser permissions.',
      );
    });

    it('should stop existing tracks before creating new stream', async () => {
      const mockOldTrack1 = { enabled: true, stop: vi.fn() };
      const mockOldTrack2 = { enabled: true, stop: vi.fn() };

      mockGetUserMedia.mockResolvedValue(mockStream);

      const { result } = renderHook(() => useMediaStream('720p'));

      // First call
      await act(async () => {
        await result.current.initMedia('720p');
      });

      // Wait for state to sync and get the actual stream
      const firstStream = result.current.localStream;

      // Replace the mock to return a new stream
      const mockNewStream = {
        getTracks: vi.fn(() => []),
        getAudioTracks: vi.fn(() => []),
        getVideoTracks: vi.fn(() => []),
      };
      mockGetUserMedia.mockResolvedValue(mockNewStream);

      // Mock the getTracks to return the old tracks
      if (firstStream) {
        firstStream.getTracks = vi.fn(() => [
          mockOldTrack1,
          mockOldTrack2,
        ]) as unknown as () => MediaStreamTrack[];
      }

      // Second call
      await act(async () => {
        await result.current.initMedia('1080p');
      });

      // Verify old tracks were stopped
      expect(mockOldTrack1.stop).toHaveBeenCalled();
      expect(mockOldTrack2.stop).toHaveBeenCalled();
    });

    it('should apply current mute and video state to new stream', async () => {
      const mockAudioTrack = { enabled: true, stop: vi.fn() };
      const mockVideoTrack = { enabled: true, stop: vi.fn() };
      const mockStreamWithTracks = {
        getTracks: vi.fn(() => [mockAudioTrack, mockVideoTrack]),
        getAudioTracks: vi.fn(() => [mockAudioTrack]),
        getVideoTracks: vi.fn(() => [mockVideoTrack]),
      };

      mockGetUserMedia.mockResolvedValue(mockStreamWithTracks);

      const { result } = renderHook(() => useMediaStream('720p'));

      // Start with muted state
      await act(async () => {
        await result.current.initMedia('720p');
      });

      act(() => {
        result.current.toggleMute();
      });

      // Re-initialize media
      await act(async () => {
        await result.current.initMedia('720p');
      });

      // Audio track should be disabled (muted)
      expect(mockAudioTrack.enabled).toBe(false);
      expect(mockVideoTrack.enabled).toBe(true);
    });
  });

  describe('toggleMute', () => {
    it('should toggle isMuted from false to true', async () => {
      mockGetUserMedia.mockResolvedValue(mockStream);

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

    it('should toggle isMuted from true to false', async () => {
      mockGetUserMedia.mockResolvedValue(mockStream);

      const { result } = renderHook(() => useMediaStream('720p'));

      await act(async () => {
        await result.current.initMedia('720p');
      });

      // First toggle to mute
      act(() => {
        result.current.toggleMute();
      });

      expect(result.current.isMuted).toBe(true);

      // Second toggle to unmute
      act(() => {
        result.current.toggleMute();
      });

      expect(result.current.isMuted).toBe(false);
    });

    it('should disable audio tracks when muted', async () => {
      const mockAudioTrack = { enabled: true, stop: vi.fn() };
      const mockStreamWithAudio = {
        getTracks: vi.fn(() => [mockAudioTrack]),
        getAudioTracks: vi.fn(() => [mockAudioTrack]),
        getVideoTracks: vi.fn(() => []),
      };

      mockGetUserMedia.mockResolvedValue(mockStreamWithAudio);

      const { result } = renderHook(() => useMediaStream('720p'));

      await act(async () => {
        await result.current.initMedia('720p');
      });

      act(() => {
        result.current.toggleMute();
      });

      expect(mockAudioTrack.enabled).toBe(false);
    });

    it('should enable audio tracks when unmuted', async () => {
      const mockAudioTrack = { enabled: false, stop: vi.fn() };
      const mockStreamWithAudio = {
        getTracks: vi.fn(() => [mockAudioTrack]),
        getAudioTracks: vi.fn(() => [mockAudioTrack]),
        getVideoTracks: vi.fn(() => []),
      };

      mockGetUserMedia.mockResolvedValue(mockStreamWithAudio);

      const { result } = renderHook(() => useMediaStream('720p'));

      await act(async () => {
        await result.current.initMedia('720p');
      });

      // Start with enabled track (unmuted state)
      expect(mockAudioTrack.enabled).toBe(true);
      expect(result.current.isMuted).toBe(false);

      // Mute - track.enabled becomes false
      act(() => {
        result.current.toggleMute();
      });

      expect(result.current.isMuted).toBe(true);
      expect(mockAudioTrack.enabled).toBe(false);

      // Unmute - track.enabled becomes true
      act(() => {
        result.current.toggleMute();
      });

      expect(result.current.isMuted).toBe(false);
      expect(mockAudioTrack.enabled).toBe(true);
    });
  });

  describe('toggleVideo', () => {
    it('should toggle isVideoOff from false to true', async () => {
      mockGetUserMedia.mockResolvedValue(mockStream);

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

    it('should toggle isVideoOff from true to false', async () => {
      mockGetUserMedia.mockResolvedValue(mockStream);

      const { result } = renderHook(() => useMediaStream('720p'));

      await act(async () => {
        await result.current.initMedia('720p');
      });

      // First toggle to turn off video
      act(() => {
        result.current.toggleVideo();
      });

      expect(result.current.isVideoOff).toBe(true);

      // Second toggle to turn on video
      act(() => {
        result.current.toggleVideo();
      });

      expect(result.current.isVideoOff).toBe(false);
    });

    it('should disable video tracks when video is off', async () => {
      const mockVideoTrack = { enabled: true, stop: vi.fn() };
      const mockStreamWithVideo = {
        getTracks: vi.fn(() => [mockVideoTrack]),
        getAudioTracks: vi.fn(() => []),
        getVideoTracks: vi.fn(() => [mockVideoTrack]),
      };

      mockGetUserMedia.mockResolvedValue(mockStreamWithVideo);

      const { result } = renderHook(() => useMediaStream('720p'));

      await act(async () => {
        await result.current.initMedia('720p');
      });

      act(() => {
        result.current.toggleVideo();
      });

      expect(mockVideoTrack.enabled).toBe(false);
    });
  });

  describe('cleanupMedia', () => {
    it('should stop all tracks and set localStream to null', async () => {
      const mockTrack1 = { enabled: true, stop: vi.fn() };
      const mockTrack2 = { enabled: true, stop: vi.fn() };
      const mockStreamWithTracks = {
        getTracks: vi.fn(() => [mockTrack1, mockTrack2]),
        getAudioTracks: vi.fn(() => [mockTrack1]),
        getVideoTracks: vi.fn(() => [mockTrack2]),
      };

      mockGetUserMedia.mockResolvedValue(mockStreamWithTracks);

      const { result } = renderHook(() => useMediaStream('720p'));

      await act(async () => {
        await result.current.initMedia('720p');
      });

      expect(result.current.localStream).toBe(mockStreamWithTracks);

      act(() => {
        result.current.cleanupMedia();
      });

      expect(mockTrack1.stop).toHaveBeenCalled();
      expect(mockTrack2.stop).toHaveBeenCalled();
      expect(result.current.localStream).toBeNull();
    });

    it('should handle cleanup when localStream is null', () => {
      const { result } = renderHook(() => useMediaStream('720p'));

      expect(result.current.localStream).toBeNull();

      act(() => {
        result.current.cleanupMedia();
      });

      expect(result.current.localStream).toBeNull();
    });
  });

  describe('resolution', () => {
    it('should use initial resolution', () => {
      const { result } = renderHook(() => useMediaStream('1080p'));

      expect(result.current.resolution).toBe('1080p');
    });

    it('should allow setting resolution', () => {
      const { result } = renderHook(() => useMediaStream('720p'));

      act(() => {
        result.current.setResolution('480p');
      });

      expect(result.current.resolution).toBe('480p');
    });

    it('should use correct constraints for 1080p', async () => {
      mockGetUserMedia.mockResolvedValue(mockStream);

      const { result } = renderHook(() => useMediaStream('1080p'));

      await act(async () => {
        await result.current.initMedia('1080p');
      });

      expect(mockGetUserMedia).toHaveBeenCalledWith({
        video: { width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: true,
      });
    });

    it('should use correct constraints for 720p', async () => {
      mockGetUserMedia.mockResolvedValue(mockStream);

      const { result } = renderHook(() => useMediaStream('720p'));

      await act(async () => {
        await result.current.initMedia('720p');
      });

      expect(mockGetUserMedia).toHaveBeenCalledWith({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
    });

    it('should use correct constraints for 480p', async () => {
      mockGetUserMedia.mockResolvedValue(mockStream);

      const { result } = renderHook(() => useMediaStream('480p'));

      await act(async () => {
        await result.current.initMedia('480p');
      });

      expect(mockGetUserMedia).toHaveBeenCalledWith({
        video: { width: { ideal: 854 }, height: { ideal: 480 } },
        audio: true,
      });
    });

    it('should default to 720p for unknown resolution', async () => {
      mockGetUserMedia.mockResolvedValue(mockStream);

      const { result } = renderHook(() => useMediaStream('720p'));

      await act(async () => {
        await result.current.initMedia('unknown' as unknown as string);
      });

      expect(mockGetUserMedia).toHaveBeenCalledWith({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
    });
  });
});
