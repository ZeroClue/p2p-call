import '@testing-library/jest-dom';
import { afterEach, vi } from 'vitest';
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

(globalThis as any).firebase = {
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

Object.defineProperty(global.navigator, 'mediaDevices', {
  value: {
    getUserMedia: vi.fn().mockResolvedValue(mockStream),
  },
  writable: true,
});

// Mock Web Crypto API
const mockCryptoKey = { type: 'secret', algorithm: { name: 'AES-GCM' } };
if (!global.crypto) {
  global.crypto = {} as any;
}

Object.defineProperty(global, 'crypto', {
  value: {
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
  },
  writable: true,
});
