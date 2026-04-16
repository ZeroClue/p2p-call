import { createContext, useContext } from 'react';
import { CallState, CallStats, PinnedEntry } from '../types';

interface CallContextValue {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  connectionState: RTCPeerConnectionState;
  isMuted: boolean;
  isVideoOff: boolean;
  callState: CallState;
  setCallState: (state: CallState) => void;
  errorMessage: string | null;
  callId: string | null;
  peerId: string | null;
  isE2EEActive: boolean;
  callStats: CallStats | null;
  resolution: string;
  setResolution: (resolution: string) => void;
  isRemoteMuted: boolean;
  isRemoteVideoOff: boolean;
  enableE2EE: boolean;
  setEnableE2EE: (enabled: boolean) => void;
  enterLobby: () => Promise<void>;
  startCall: () => Promise<void>;
  joinCall: (id: string) => Promise<void>;
  ringUser: (peer: PinnedEntry) => Promise<void>;
  declineCall: (incomingCallId: string, peerToRingId?: string) => Promise<void>;
  toggleMute: () => void;
  toggleVideo: () => void;
  hangUp: () => void;
  reset: () => void;
  setOnChatMessage: (callback: (data: string) => void) => void;
  sendMessage: (message: string) => void;
}

export const CallContext = createContext<CallContextValue | null>(null);

export const useCallContext = (): CallContextValue => {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCallContext must be used within a CallProvider');
  }
  return context;
};
