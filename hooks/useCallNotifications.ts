import { useState, useEffect, useRef, useCallback } from 'react';
import { CallState, CallHistoryEntry, PinnedEntry } from '../types';
import { playIncomingSound, playConnectedSound, playEndedSound, playRingingSound, stopRingingSound } from '../utils/sounds';

export const useCallNotifications = (
  callState: CallState,
  callId: string | null,
  peerId: string | null,
  pinned: PinnedEntry[],
  history: CallHistoryEntry[],
  addHistoryEntry: (entry: CallHistoryEntry) => void,
) => {
  const [callDuration, setCallDuration] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callStartTimeRef = useRef<number | null>(null);
  const callDetailsForHistoryRef = useRef<{ callId: string; peerId?: string; alias?: string } | null>(null);
  const hasConnectedOnceForChatRef = useRef(false);

  // Cleanup timer on unmount (RESOURCE LEAK FIX)
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const findAlias = useCallback((pId: string | null) => {
    if (!pId) return undefined;
    const pinnedContact = pinned.find(p => p.peerId === pId);
    if (pinnedContact?.alias) return pinnedContact.alias;
    const historyContact = [...history].sort((a, b) => b.timestamp - a.timestamp).find(h => h.peerId === pId);
    return historyContact?.alias;
  }, [pinned, history]);

  useEffect(() => {
    switch (callState) {
      case CallState.INCOMING_CALL:
        playIncomingSound();
        break;
      case CallState.RINGING:
        playRingingSound();
        break;
      case CallState.CONNECTED:
        stopRingingSound();
        playConnectedSound();
        if (!hasConnectedOnceForChatRef.current) {
          hasConnectedOnceForChatRef.current = true;
        }
        callStartTimeRef.current = Date.now();
        if (callId) {
          callDetailsForHistoryRef.current = { callId, peerId: peerId || undefined, alias: peerId ? findAlias(peerId) : undefined };
        }
        setCallDuration(0);
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => setCallDuration(prev => prev + 1), 1000);
        break;
      case CallState.ENDED:
      case CallState.DECLINED:
        stopRingingSound();
        playEndedSound();
        if (timerRef.current) clearInterval(timerRef.current);
        if (callStartTimeRef.current && callDetailsForHistoryRef.current) {
          const duration = Math.floor((Date.now() - callStartTimeRef.current) / 1000);
          addHistoryEntry({ ...callDetailsForHistoryRef.current, timestamp: Date.now(), duration });
        }
        setCallDuration(0);
        timerRef.current = null;
        callStartTimeRef.current = null;
        callDetailsForHistoryRef.current = null;
        hasConnectedOnceForChatRef.current = false;
        break;
      case CallState.IDLE:
        stopRingingSound();
        break;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callState, callId, peerId]);

  return { callDuration, hasConnectedOnceForChatRef };
};
