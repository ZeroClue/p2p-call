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
      // Create a mock navigator without mediaDevices
      const mockNavigator = {} as Navigator;
      const originalWindow = global.window;
      Object.defineProperty(global.window, 'navigator', {
        value: mockNavigator,
        writable: true,
        configurable: true,
      });

      const result = checkWebRTCSupport();
      expect(result.supported).toBe(false);
      expect(result.missingFeatures).toContain('getUserMedia');

      // Restore
      Object.defineProperty(global.window, 'navigator', {
        value: originalWindow.navigator,
        writable: true,
        configurable: true,
      });
    });

    it('should detect missing RTCPeerConnection', () => {
      const original = (globalThis as any).RTCPeerConnection;
      Object.defineProperty(globalThis, 'RTCPeerConnection', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const result = checkWebRTCSupport();
      expect(result.supported).toBe(false);
      expect(result.missingFeatures).toContain('RTCPeerConnection');

      // Restore
      Object.defineProperty(globalThis, 'RTCPeerConnection', {
        value: original,
        writable: true,
        configurable: true,
      });
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
