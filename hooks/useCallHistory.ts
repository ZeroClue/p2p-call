import { useState, useEffect, useCallback } from 'react';
import { CallHistoryEntry, PinnedEntry } from '../types';
import { getHistory, saveHistory } from '../utils/history';
import { getPinned, savePinned } from '../utils/pins';

export const useCallHistory = () => {
  const [history, setHistory] = useState<CallHistoryEntry[]>(() => getHistory());
  const [pinned, setPinned] = useState<PinnedEntry[]>(() => getPinned());

  useEffect(() => {
    saveHistory(history);
  }, [history]);
  useEffect(() => {
    savePinned(pinned);
  }, [pinned]);

  const addHistoryEntry = useCallback((entry: CallHistoryEntry) => {
    setHistory((prev) => [entry, ...prev]);
  }, []);

  const updateHistoryAlias = useCallback((timestamp: number, alias: string) => {
    setHistory((prev) => prev.map((h) => (h.timestamp === timestamp ? { ...h, alias } : h)));
  }, []);

  const deleteHistory = useCallback((timestamp: number) => {
    setHistory((prev) => prev.filter((h) => h.timestamp !== timestamp));
  }, []);

  const togglePin = useCallback((entry: CallHistoryEntry) => {
    setPinned((prev) => {
      if (prev.some((p) => p.callId === entry.callId)) {
        return prev.filter((p) => p.callId !== entry.callId);
      }
      const { callId, alias, peerId } = entry;
      return [{ callId, alias, peerId }, ...prev];
    });
  }, []);

  const updatePinAlias = useCallback((callId: string, alias: string) => {
    setPinned((prev) => prev.map((p) => (p.callId === callId ? { ...p, alias } : p)));
  }, []);

  const unpin = useCallback((callId: string) => {
    setPinned((prev) => prev.filter((p) => p.callId !== callId));
  }, []);

  const restoreData = useCallback(
    (data: { history: CallHistoryEntry[]; pinned: PinnedEntry[] }) => {
      setHistory(data.history);
      setPinned(data.pinned);
    },
    [],
  );

  return {
    history,
    pinned,
    addHistoryEntry,
    updateHistoryAlias,
    deleteHistory,
    togglePin,
    updatePinAlias,
    unpin,
    restoreData,
  };
};
