export enum CallState {
  IDLE = 'IDLE',
  LOBBY = 'LOBBY',
  CREATING_OFFER = 'CREATING_OFFER',
  RINGING = 'RINGING', // New state for the caller when trying to reach a peer
  WAITING_FOR_ANSWER = 'WAITING_FOR_ANSWER',
  JOINING = 'JOINING',
  CREATING_ANSWER = 'CREATING_ANSWER',
  INCOMING_CALL = 'INCOMING_CALL', // New state for the callee when being rung
  RECONNECTING = 'RECONNECTING',
  CONNECTED = 'CONNECTED',
  ENDED = 'ENDED',
  DECLINED = 'DECLINED', // New state when a call is declined
  MEDIA_ERROR = 'MEDIA_ERROR',
}

export interface CallHistoryEntry {
  callId: string;
  timestamp: number;
  duration: number; // in seconds
  alias?: string;
  peerId?: string; // The user ID of the other participant
}

export interface PinnedEntry {
  callId: string;
  alias?: string;
  peerId?: string; // The user ID of the pinned contact
}

export interface CallStats {
  packetsLost: number | null;
  jitter: number | null; // in milliseconds
  roundTripTime: number | null; // in milliseconds
  uploadBitrate: number | null; // in kbps
  downloadBitrate: number | null; // in kbps
}

export interface IncomingCall {
  from: string; // User ID of the caller
  callId: string;
  callerAlias?: string; // Alias the caller has for you
}

export interface PeerStatus {
  isOnline: boolean;
  lastChanged: number;
}

export interface ChatMessage {
  text: string;
  sender: 'me' | 'peer';
  timestamp: number;
}
