import { describe, it, expect } from 'vitest';
import { generateCallId, generateUUID } from '../../utils/id';

describe('ID Utilities', () => {
  describe('generateCallId', () => {
    it('should generate a call ID in the correct format', () => {
      const callId = generateCallId();
      const pattern = /^[a-z]+-[a-z]+-[a-z]+$/;
      expect(callId).toMatch(pattern);
    });

    it('should generate unique call IDs', () => {
      const ids = new Set();
      for (let i = 0; i < 100; i++) {
        ids.add(generateCallId());
      }
      expect(ids.size).toBeGreaterThan(90); // Allow some collisions but expect mostly unique
    });

    it('should only contain lowercase letters and hyphens', () => {
      const callId = generateCallId();
      expect(callId).toMatch(/^[a-z-]+$/);
    });

    it('should have exactly 3 parts separated by hyphens', () => {
      const callId = generateCallId();
      const parts = callId.split('-');
      expect(parts).toHaveLength(3);
      parts.forEach((part) => {
        expect(part.length).toBeGreaterThan(0);
      });
    });
  });

  describe('generateUUID', () => {
    it('should generate a valid UUID', () => {
      const userId = generateUUID();
      // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(userId).toMatch(uuidPattern);
    });

    it('should generate unique user IDs', () => {
      const ids = new Set();
      for (let i = 0; i < 100; i++) {
        ids.add(generateUUID());
      }
      expect(ids.size).toBe(100); // UUIDs should always be unique
    });
  });
});
