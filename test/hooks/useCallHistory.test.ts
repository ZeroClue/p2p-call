import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCallHistory } from '../../hooks/useCallHistory';
import { CallHistoryEntry, PinnedEntry } from '../../types';
import * as historyUtils from '../../utils/history';
import * as pinsUtils from '../../utils/pins';

describe('useCallHistory', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(historyUtils, 'getHistory').mockReturnValue([]);
    vi.spyOn(historyUtils, 'saveHistory').mockImplementation(() => {});
    vi.spyOn(pinsUtils, 'getPinned').mockReturnValue([]);
    vi.spyOn(pinsUtils, 'savePinned').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with empty history and pinned', () => {
    const { result } = renderHook(() => useCallHistory());
    expect(result.current.history).toEqual([]);
    expect(result.current.pinned).toEqual([]);
  });

  it('initializes with existing history', () => {
    const existingHistory: CallHistoryEntry[] = [
      {
        callId: 'test-call',
        peerId: 'peer-123',
        alias: 'Test',
        timestamp: Date.now(),
        duration: 60,
      },
    ];
    vi.spyOn(historyUtils, 'getHistory').mockReturnValue(existingHistory);
    const { result } = renderHook(() => useCallHistory());
    expect(result.current.history).toEqual(existingHistory);
  });

  it('updateHistoryAlias updates entry alias', () => {
    const { result } = renderHook(() => useCallHistory());
    const entry: CallHistoryEntry = { callId: 'test', peerId: 'peer', timestamp: 123, duration: 0 };
    act(() => {
      result.current.addHistoryEntry(entry);
    });
    act(() => {
      result.current.updateHistoryAlias(123, 'New Alias');
    });
    expect(result.current.history[0].alias).toBe('New Alias');
  });

  it('deleteHistory removes entry', () => {
    const { result } = renderHook(() => useCallHistory());
    const entry: CallHistoryEntry = { callId: 'test', peerId: 'peer', timestamp: 123, duration: 0 };
    act(() => {
      result.current.addHistoryEntry(entry);
    });
    expect(result.current.history.length).toBe(1);
    act(() => {
      result.current.deleteHistory(123);
    });
    expect(result.current.history.length).toBe(0);
  });

  it('togglePin adds entry when not pinned', () => {
    const { result } = renderHook(() => useCallHistory());
    const entry: CallHistoryEntry = {
      callId: 'test-call',
      peerId: 'peer-123',
      alias: 'Test',
      timestamp: 123,
      duration: 0,
    };
    act(() => {
      result.current.togglePin(entry);
    });
    expect(result.current.pinned.length).toBe(1);
    expect(result.current.pinned[0].callId).toBe('test-call');
  });

  it('togglePin removes entry when already pinned', () => {
    const { result } = renderHook(() => useCallHistory());
    const entry: CallHistoryEntry = {
      callId: 'test-call',
      peerId: 'peer-123',
      alias: 'Test',
      timestamp: 123,
      duration: 0,
    };
    act(() => {
      result.current.togglePin(entry);
    });
    expect(result.current.pinned.length).toBe(1);
    act(() => {
      result.current.togglePin(entry);
    });
    expect(result.current.pinned.length).toBe(0);
  });

  it('updatePinAlias updates pinned entry', () => {
    const { result } = renderHook(() => useCallHistory());
    const entry: CallHistoryEntry = {
      callId: 'test-call',
      peerId: 'peer-123',
      alias: 'Test',
      timestamp: 123,
      duration: 0,
    };
    act(() => {
      result.current.togglePin(entry);
    });
    act(() => {
      result.current.updatePinAlias('test-call', 'Updated Alias');
    });
    expect(result.current.pinned[0].alias).toBe('Updated Alias');
  });

  it('unpin removes pinned entry', () => {
    const { result } = renderHook(() => useCallHistory());
    const entry: CallHistoryEntry = {
      callId: 'test-call',
      peerId: 'peer-123',
      alias: 'Test',
      timestamp: 123,
      duration: 0,
    };
    act(() => {
      result.current.togglePin(entry);
    });
    expect(result.current.pinned.length).toBe(1);
    act(() => {
      result.current.unpin('test-call');
    });
    expect(result.current.pinned.length).toBe(0);
  });

  it('restoreData sets history and pinned', () => {
    const { result } = renderHook(() => useCallHistory());
    const newHistory: CallHistoryEntry[] = [
      { callId: 'h1', peerId: 'p1', timestamp: 111, duration: 10 },
    ];
    const newPinned: PinnedEntry[] = [{ callId: 'pin1', alias: 'Pin', peerId: 'p2' }];
    act(() => {
      result.current.restoreData({ history: newHistory, pinned: newPinned });
    });
    expect(result.current.history).toEqual(newHistory);
    expect(result.current.pinned).toEqual(newPinned);
  });

  it('persists history to localStorage', () => {
    const saveSpy = vi.spyOn(historyUtils, 'saveHistory');
    const { result } = renderHook(() => useCallHistory());
    const entry: CallHistoryEntry = { callId: 'test', peerId: 'peer', timestamp: 123, duration: 0 };
    act(() => {
      result.current.addHistoryEntry(entry);
    });
    expect(saveSpy).toHaveBeenCalled();
  });

  it('persists pinned to localStorage', () => {
    const saveSpy = vi.spyOn(pinsUtils, 'savePinned');
    const { result } = renderHook(() => useCallHistory());
    const entry: CallHistoryEntry = {
      callId: 'test-call',
      peerId: 'peer-123',
      alias: 'Test',
      timestamp: 123,
      duration: 0,
    };
    act(() => {
      result.current.togglePin(entry);
    });
    expect(saveSpy).toHaveBeenCalled();
  });
});
