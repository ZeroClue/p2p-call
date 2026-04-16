import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkWebRTCSupport, checkE2EESupport } from '../../utils/security';

describe('Security Utilities', () => {
  describe('checkWebRTCSupport', () => {
    it('should return supported: true when all features are available', () => {
      const result = checkWebRTCSupport();
      expect(result.supported).toBe(true);
      expect(result.missingFeatures).toHaveLength(0);
    });

    it('should detect missing getUserMedia', () => {
      const originalGetUserMedia = navigator.mediaDevices?.getUserMedia;
      // @ts-ignore
      delete navigator.mediaDevices;

      const result = checkWebRTCSupport();
      expect(result.supported).toBe(false);
      expect(result.missingFeatures).toContain('getUserMedia');

      // Restore
      if (originalGetUserMedia) {
        navigator.mediaDevices = { getUserMedia: originalGetUserMedia } as any;
      }
    });

    it('should detect missing RTCPeerConnection', () => {
      const original = global.RTCPeerConnection;
      // @ts-ignore
      delete global.RTCPeerConnection;

      const result = checkWebRTCSupport();
      expect(result.supported).toBe(false);
      expect(result.missingFeatures).toContain('RTCPeerConnection');

      // Restore
      global.RTCPeerConnection = original;
    });
  });

  describe('checkE2EESupport', () => {
    it('should return true when insertable streams are supported', () => {
      // Mock RTCRtpSender with createEncodedStreams
      global.RTCRtpSender = {
        prototype: {
          createEncodedStreams: vi.fn(),
        },
      } as any;

      const result = checkE2EESupport();
      expect(result).toBe(true);
    });

    it('should return false when insertable streams are not supported', () => {
      global.RTCRtpSender = {
        prototype: {},
      } as any;

      const result = checkE2EESupport();
      expect(result).toBe(false);
    });
  });
});
