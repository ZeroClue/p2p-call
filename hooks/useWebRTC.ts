import { useState, useRef, useCallback, useEffect } from 'react';
import { STUN_SERVERS } from '../constants';
import { CallState, CallStats, PinnedEntry } from '../types';
import { setupE2EE } from '../utils/crypto';
import { generateCallId } from '../utils/id';
import { useMediaStream } from './useMediaStream';
import { useSignaling } from './useSignaling';
import { useDataChannel } from './useDataChannel';

const MAX_RECONNECTION_ATTEMPTS = 3;

/**
 * Main WebRTC Hook - Thin Composer
 *
 * Orchestrates WebRTC functionality by composing sub-hooks:
 * - useMediaStream: Local media access and controls
 * - useSignaling: Firebase signaling for call establishment
 * - useDataChannel: Chat and control messages
 *
 * Owned responsibilities:
 * - Peer connection lifecycle
 * - Remote stream management
 * - Connection state tracking
 * - Call state management
 * - Statistics collection
 * - E2EE setup
 *
 * @param initialResolution - Starting video resolution
 */
export const useWebRTC = (initialResolution: string) => {
  // ===== STATE OWNED BY COMPOSER =====
  const [callState, setCallState] = useState<CallState>(CallState.IDLE);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>('new');
  const [callId, setCallId] = useState<string | null>(null);
  const [peerId, setPeerId] = useState<string | null>(null);
  const [isE2EEActive, setIsE2EEActive] = useState(false);
  const [callStats, setCallStats] = useState<CallStats | null>(null);
  const [enableE2EE, setEnableE2EE] = useState(true);

  // ===== REFS OWNED BY COMPOSER =====
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const statsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastStatsRef = useRef<{ timestamp: number; totalBytesSent: number; totalBytesReceived: number } | null>(null);
  const hasConnectedOnceRef = useRef(false);
  const reconnectionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync remote stream ref with state
  useEffect(() => {
    remoteStreamRef.current = remoteStream;
  }, [remoteStream]);

  // ===== WIRE SUB-HOOKS =====
  const media = useMediaStream(initialResolution);
  const dataChannel = useDataChannel();

  // Sync refs for signaling callbacks (stale closure prevention)
  const callStateRef = useRef<CallState>(callState);
  const peerIdRef = useRef<string | null>(peerId);
  const enableE2EERef = useRef(enableE2EE);
  const isMutedRef = useRef(media.isMuted);
  const isVideoOffRef = useRef(media.isVideoOff);

  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  useEffect(() => {
    peerIdRef.current = peerId;
  }, [peerId]);

  useEffect(() => {
    enableE2EERef.current = enableE2EE;
  }, [enableE2EE]);

  useEffect(() => {
    isMutedRef.current = media.isMuted;
  }, [media.isMuted]);

  useEffect(() => {
    isVideoOffRef.current = media.isVideoOff;
  }, [media.isVideoOff]);

  const signaling = useSignaling(
    {
      onCallStateChange: setCallState,
      onSetCallId: setCallId,
      onSetPeerId: setPeerId,
      onSetE2EEActive: setIsE2EEActive,
    },
    callStateRef,
    peerIdRef,
    enableE2EERef
  );

  // ===== PEER CONNECTION CREATION =====
  const createPeerConnection = useCallback(
    (stream: MediaStream): RTCPeerConnection => {
      const pc = new RTCPeerConnection(STUN_SERVERS);

      // Add local tracks to peer connection
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      // Handle incoming remote stream
      pc.ontrack = (event) => {
        remoteStreamRef.current = event.streams[0];
        setRemoteStream(event.streams[0]);
      };

      // Handle incoming data channel (from joiner)
      pc.ondatachannel = (event) => {
        dataChannel.setDataChannel(event.channel);
        event.channel.onopen = () => {
          console.log('Data channel opened.');
          dataChannel.sendControl('mute', media.isMuted);
          dataChannel.sendControl('video', media.isVideoOff);
        };
      };

      // Handle connection state changes
      pc.onconnectionstatechange = () => {
        setConnectionState(pc.connectionState);

        if (pc.connectionState === 'connected') {
          // Connection established
          hasConnectedOnceRef.current = true;

          // Clear reconnection timer
          if (reconnectionTimerRef.current) {
            clearTimeout(reconnectionTimerRef.current);
            reconnectionTimerRef.current = null;
          }

          // RESOURCE LEAK FIX: Always clear stats interval before creating new one
          if (statsIntervalRef.current) {
            clearInterval(statsIntervalRef.current);
            statsIntervalRef.current = null;
          }

          // Start stats collection
          statsIntervalRef.current = setInterval(async () => {
            if (peerConnectionRef.current) {
              const stats = await peerConnectionRef.current.getStats();
              const newStats: CallStats = {
                packetsLost: null,
                jitter: null,
                roundTripTime: null,
                uploadBitrate: null,
                downloadBitrate: null,
              };
              let totalBytesSent = 0;
              let totalBytesReceived = 0;
              const now = Date.now();

              stats.forEach((report) => {
                if (report.type === 'remote-inbound-rtp' && report.kind === 'video') {
                  newStats.packetsLost = report.packetsLost;
                  newStats.jitter = report.jitter ? Math.round(report.jitter * 1000) : null;
                }
                if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                  newStats.roundTripTime = report.currentRoundTripTime
                    ? Math.round(report.currentRoundTripTime * 1000)
                    : null;
                }
                if (report.type === 'outbound-rtp') {
                  totalBytesSent += (report as any).bytesSent || 0;
                }
                if (report.type === 'inbound-rtp') {
                  totalBytesReceived += (report as any).bytesReceived || 0;
                }
              });

              if (lastStatsRef.current) {
                const timeDiffSeconds = (now - lastStatsRef.current.timestamp) / 1000;
                if (timeDiffSeconds > 0) {
                  const sentDiff = totalBytesSent - lastStatsRef.current.totalBytesSent;
                  const receivedDiff = totalBytesReceived - lastStatsRef.current.totalBytesReceived;
                  newStats.uploadBitrate = Math.round((sentDiff * 8) / (timeDiffSeconds * 1000));
                  newStats.downloadBitrate = Math.round((receivedDiff * 8) / (timeDiffSeconds * 1000));
                }
              }
              lastStatsRef.current = { timestamp: now, totalBytesSent, totalBytesReceived };
              setCallStats(newStats);
            }
          }, 1000);

          setCallState(CallState.CONNECTED);

          // Setup E2EE if key is available
          if (signaling.encryptionKeyRef.current) {
            if (setupE2EE(pc, signaling.encryptionKeyRef.current)) {
              setIsE2EEActive(true);
            }
          }
        } else if (pc.connectionState === 'failed') {
          console.error('Peer connection failed. Hanging up.');
          hangUpRef.current();
        } else if (pc.connectionState === 'disconnected') {
          // Attempt reconnection
          setIsE2EEActive(false);
          setCallStats(null);
          if (statsIntervalRef.current) {
            clearInterval(statsIntervalRef.current);
            statsIntervalRef.current = null;
          }
          lastStatsRef.current = null;

          if (
            signaling.isCallerRef.current &&
            signaling.reconnectionAttemptsRef.current < MAX_RECONNECTION_ATTEMPTS &&
            !reconnectionTimerRef.current
          ) {
            reconnectionTimerRef.current = setTimeout(() => {
              signaling.reconnectionAttemptsRef.current++;
              console.log(
                `Connection lost. Attempting to reconnect... (Attempt ${signaling.reconnectionAttemptsRef.current})`
              );
              setCallState(CallState.RECONNECTING);
              reconnectionTimerRef.current = null;

              // Restart ICE
              const restartIce = async () => {
                const currentPc = peerConnectionRef.current;
                if (!currentPc || !signaling.callDocRef.current) return;

                try {
                  const offerDescription = await currentPc.createOffer({ iceRestart: true });
                  await currentPc.setLocalDescription(offerDescription);

                  const offer = {
                    sdp: offerDescription.sdp,
                    type: offerDescription.type,
                  };

                  await signaling.callDocRef.current.update({ offer });
                } catch (error) {
                  console.error('Failed to restart ICE connection:', error);
                  hangUpRef.current();
                }
              };

              restartIce();
            }, 2000 * signaling.reconnectionAttemptsRef.current);
          } else if (
            signaling.reconnectionAttemptsRef.current >= MAX_RECONNECTION_ATTEMPTS &&
            callStateRef.current !== CallState.ENDED
          ) {
            console.log('Reconnection failed after maximum attempts.');
            hangUpRef.current();
          }
        } else if (pc.connectionState === 'closed') {
          setIsE2EEActive(false);
          setCallStats(null);
          if (statsIntervalRef.current) {
            clearInterval(statsIntervalRef.current);
            statsIntervalRef.current = null;
          }
          lastStatsRef.current = null;
        }
      };

      peerConnectionRef.current = pc;
      return pc;
    },
    [dataChannel, media.isMuted, media.isVideoOff]
  );

  // ===== CLEANUP =====
  const cleanUp = useCallback(
    (keepCallDoc = false) => {
      // Close peer connection
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }

      // Cleanup media
      media.cleanupMedia();

      // Stop remote stream tracks
      if (remoteStreamRef.current) {
        remoteStreamRef.current.getTracks().forEach((track) => track.stop());
        setRemoteStream(null);
      }

      // Cleanup signaling
      signaling.cleanupSignaling(keepCallDoc);

      // Cleanup data channel
      dataChannel.cleanupDataChannel();

      // Clear timers
      if (reconnectionTimerRef.current) {
        clearTimeout(reconnectionTimerRef.current);
        reconnectionTimerRef.current = null;
      }
      if (statsIntervalRef.current) {
        clearInterval(statsIntervalRef.current);
        statsIntervalRef.current = null;
      }

      // Reset refs
      lastStatsRef.current = null;
      hasConnectedOnceRef.current = false;
    },
    [media, signaling, dataChannel]
  );

  // ===== CALL OPERATIONS =====
  const enterLobby = useCallback(async () => {
    const stream = await media.initMedia(media.resolution);
    if (stream) {
      setCallState(CallState.LOBBY);
    }
  }, [media]);

  const startCall = useCallback(async () => {
    const stream = media.localStream;
    if (!stream) {
      console.error('Cannot start call without a local stream');
      setCallState(CallState.MEDIA_ERROR);
      return;
    }

    const pc = createPeerConnection(stream);

    // Create data channel (caller side)
    const dc = pc.createDataChannel('chat');
    dc.onclose = () => console.log('Data channel closed.');
    dataChannel.setDataChannel(dc);

    // Open data channel after setup
    dc.onopen = () => {
      console.log('Data channel opened.');
      dataChannel.sendControl('mute', media.isMuted);
      dataChannel.sendControl('video', media.isVideoOff);
    };

    const newCallId = generateCallId();
    await signaling.initiateCall(newCallId, pc, stream, enableE2EE, false);
  }, [media, createPeerConnection, dataChannel, signaling, enableE2EE]);

  const joinCall = useCallback(
    async (id: string) => {
      const stream = media.localStream;
      if (!stream) {
        console.error('Cannot join call without a local stream');
        setCallState(CallState.MEDIA_ERROR);
        return;
      }

      const pc = createPeerConnection(stream);
      await signaling.joinCall(id, pc, stream, enableE2EE);
    },
    [media, createPeerConnection, signaling, enableE2EE]
  );

  const ringUser = useCallback(
    async (peer: PinnedEntry) => {
      const stream = media.localStream;
      if (!stream) {
        console.error('Cannot ring user without a local stream');
        setCallState(CallState.MEDIA_ERROR);
        return;
      }

      const pc = createPeerConnection(stream);

      // Create data channel for ringing
      const dc = pc.createDataChannel('chat');
      dc.onclose = () => console.log('Data channel closed.');
      dataChannel.setDataChannel(dc);

      // Open data channel after setup
      dc.onopen = () => {
        console.log('Data channel opened.');
        dataChannel.sendControl('mute', media.isMuted);
        dataChannel.sendControl('video', media.isVideoOff);
      };

      await signaling.ringUser(peer, pc, stream, enableE2EE);
    },
    [media, createPeerConnection, dataChannel, signaling, enableE2EE]
  );

  const hangUp = useCallback(() => {
    cleanUp();
    setCallState(CallState.ENDED);
  }, [cleanUp]);

  const hangUpRef = useRef(hangUp);
  useEffect(() => { hangUpRef.current = hangUp; }, [hangUp]);

  const reset = useCallback(() => {
    cleanUp();
    setCallId(null);
    setPeerId(null);
    setConnectionState('new');
    setCallState(CallState.IDLE);
  }, [cleanUp]);

  // ===== BEFORE UNLOAD HANDLER =====
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (callStateRef.current !== CallState.IDLE && callStateRef.current !== CallState.ENDED) {
        if (signaling.callDocRef.current) {
          signaling.callDocRef.current.remove();
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [signaling]);

  // ===== CLEANUP ON UNMOUNT =====
  useEffect(() => {
    return () => {
      if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
      if (reconnectionTimerRef.current) clearTimeout(reconnectionTimerRef.current);
    };
  }, []);

  // ===== RETURN INTERFACE =====
  return {
    localStream: media.localStream,
    remoteStream,
    connectionState,
    isMuted: media.isMuted,
    isVideoOff: media.isVideoOff,
    callState,
    setCallState,
    errorMessage: media.errorMessage,
    callId,
    peerId,
    isE2EEActive,
    callStats,
    resolution: media.resolution,
    setResolution: media.setResolution,
    isRemoteMuted: dataChannel.isRemoteMuted,
    isRemoteVideoOff: dataChannel.isRemoteVideoOff,
    enableE2EE,
    setEnableE2EE,
    enterLobby,
    startCall,
    joinCall,
    ringUser,
    declineCall: signaling.declineCall,
    toggleMute: media.toggleMute,
    toggleVideo: media.toggleVideo,
    hangUp,
    reset,
    setOnChatMessage: dataChannel.setOnChatMessage,
    sendMessage: dataChannel.sendMessage,
  };
};
