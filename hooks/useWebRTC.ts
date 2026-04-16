import { useState, useRef, useCallback, useEffect } from 'react';
import { STUN_SERVERS } from '../constants';
import { CallState, CallStats, PinnedEntry } from '../types';
import { db } from '../firebase';
import { generateCallId } from '../utils/id';
import { getUserId, getUserDisplayName } from '../utils/user';
import { generateKey, importKey, setupE2EE } from '../utils/crypto';

const MAX_RECONNECTION_ATTEMPTS = 3;
const RING_TIMEOUT_MS = 30000;

const RESOLUTION_CONSTRAINTS = {
  '1080p': { width: { ideal: 1920 }, height: { ideal: 1080 } },
  '720p': { width: { ideal: 1280 }, height: { ideal: 720 } },
  '480p': { width: { ideal: 854 }, height: { ideal: 480 } },
};

export const useWebRTC = (initialResolution: string) => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>('new');
  const [callState, setCallState] = useState<CallState>(CallState.IDLE);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isRemoteMuted, setIsRemoteMuted] = useState(false);
  const [isRemoteVideoOff, setIsRemoteVideoOff] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [callId, setCallId] = useState<string | null>(null);
  const [peerId, setPeerId] = useState<string | null>(null);
  const [isE2EEActive, setIsE2EEActive] = useState(false);
  const [callStats, setCallStats] = useState<CallStats | null>(null);
  const [resolution, setResolution] = useState<string>(initialResolution);
  const [enableE2EE, setEnableE2EE] = useState(true);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const encryptionKeyRef = useRef<CryptoKey | null>(null);
  const callDocRef = useRef<any>(null);
  const answerCandidatesRef = useRef<any>(null);
  const offerCandidatesRef = useRef<any>(null);

  const reconnectionAttemptsRef = useRef(0);
  const isCallerRef = useRef(false);
  const reconnectionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ringingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastStatsRef = useRef<{ timestamp: number, totalBytesSent: number, totalBytesReceived: number } | null>(null);
  const hasConnectedOnceRef = useRef(false);

  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const onChatMessageCallbackRef = useRef<((data: string) => void) | null>(null);

  // Ref-based flag to prevent concurrent async call operations
  const isOperationInProgressRef = useRef(false);

  // Keep state refs current for use inside callbacks without stale closures
  const callStateRef = useRef<CallState>(callState);
  const peerIdRef = useRef<string | null>(peerId);
  const enableE2EERef = useRef(enableE2EE);
  const isMutedRef = useRef(isMuted);
  const isVideoOffRef = useRef(isVideoOff);

  useEffect(() => { callStateRef.current = callState; }, [callState]);
  useEffect(() => { peerIdRef.current = peerId; }, [peerId]);
  useEffect(() => { enableE2EERef.current = enableE2EE; }, [enableE2EE]);
  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);
  useEffect(() => { isVideoOffRef.current = isVideoOff; }, [isVideoOff]);
  useEffect(() => { localStreamRef.current = localStream; }, [localStream]);
  useEffect(() => { remoteStreamRef.current = remoteStream; }, [remoteStream]);

  const setOnChatMessage = useCallback((callback: (data: string) => void) => {
    onChatMessageCallbackRef.current = callback;
  }, []);

  const sendDataChannelMessage = useCallback((message: object) => {
    if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
      dataChannelRef.current.send(JSON.stringify(message));
    }
  }, []);

  const sendMessage = useCallback((chatMessage: string) => {
    sendDataChannelMessage({ type: 'chat', payload: chatMessage });
  }, [sendDataChannelMessage]);

  const handleDataChannelMessage = useCallback((event: MessageEvent) => {
    try {
      const message = JSON.parse(event.data);
      if (message.type === 'chat' && typeof message.payload === 'string') {
        onChatMessageCallbackRef.current?.(message.payload);
      } else if (message.type === 'control') {
        const { type, value } = message.payload;
        if (type === 'mute') {
          setIsRemoteMuted(!!value);
        } else if (type === 'video') {
          setIsRemoteVideoOff(!!value);
        }
      }
    } catch (e) {
      if (typeof event.data === 'string') {
        onChatMessageCallbackRef.current?.(event.data);
      }
      console.warn('Could not parse data channel message:', event.data, e);
    }
  }, []);

  const cleanUp = useCallback((keepCallDoc = false) => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    setLocalStream(null);

    const rs = remoteStreamRef.current;
    if (rs) {
      rs.getTracks().forEach(track => track.stop());
      setRemoteStream(null);
    }

    if (callDocRef.current) callDocRef.current.off();
    if (answerCandidatesRef.current) answerCandidatesRef.current.off();
    if (offerCandidatesRef.current) offerCandidatesRef.current.off();

    if (reconnectionTimerRef.current) clearTimeout(reconnectionTimerRef.current);
    if (ringingTimeoutRef.current) clearTimeout(ringingTimeoutRef.current);
    if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);

    reconnectionTimerRef.current = null;
    ringingTimeoutRef.current = null;
    statsIntervalRef.current = null;

    if (callDocRef.current && !keepCallDoc) callDocRef.current.remove();

    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }
    onChatMessageCallbackRef.current = null;

    callDocRef.current = null;
    answerCandidatesRef.current = null;
    offerCandidatesRef.current = null;
    encryptionKeyRef.current = null;
    lastStatsRef.current = null;
    hasConnectedOnceRef.current = false;
    isOperationInProgressRef.current = false;
    setIsE2EEActive(false);
    setIsRemoteMuted(false);
    setIsRemoteVideoOff(false);
    setCallStats(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
      if (reconnectionTimerRef.current) clearTimeout(reconnectionTimerRef.current);
      if (ringingTimeoutRef.current) clearTimeout(ringingTimeoutRef.current);
    };
  }, []);

  const hangUp = useCallback(() => {
    cleanUp();
    setCallState(CallState.ENDED);
  }, [cleanUp]);

  const declineCall = useCallback(async (incomingCallId: string, peerToRingId?: string) => {
    const myUserId = getUserId();
    const callRef = db.ref(`calls/${incomingCallId}`);

    try {
      if (peerToRingId) {
        const calleeIncomingCallRef = db.ref(`users/${peerToRingId}/incomingCall`);
        await calleeIncomingCallRef.remove();
      } else {
        const myIncomingCallRef = db.ref(`users/${myUserId}/incomingCall`);
        await myIncomingCallRef.remove();
      }

      await callRef.update({ declined: true });
    } catch (error) {
      console.error('Error declining call:', error);
    }

    cleanUp(true);
    setTimeout(() => callRef.remove(), 2000);
    setCallState(CallState.IDLE);
  }, [cleanUp]);

  const reset = useCallback(() => {
    cleanUp();
    setCallId(null);
    setPeerId(null);
    setErrorMessage(null);
    setConnectionState('new');
    setCallState(CallState.IDLE);
  }, [cleanUp]);

  const initMedia = useCallback(async (res: string) => {
    try {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }

      setErrorMessage(null);

      const videoConstraints = RESOLUTION_CONSTRAINTS[res as keyof typeof RESOLUTION_CONSTRAINTS] || RESOLUTION_CONSTRAINTS['720p'];
      const stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints, audio: true });

      // Apply current mute/video state to new stream via refs to avoid dependency
      const currentMuted = isMutedRef.current;
      const currentVideoOff = isVideoOffRef.current;
      stream.getAudioTracks().forEach(t => { t.enabled = !currentMuted; });
      stream.getVideoTracks().forEach(t => { t.enabled = !currentVideoOff; });
      setLocalStream(stream);
      return stream;
    } catch (error) {
      console.error('Error accessing media devices.', error);
      let message = 'Could not access camera and microphone. Please check your system settings and browser permissions.';
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          message = 'Permission denied. Please allow this site to access your camera and microphone in your browser settings.';
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
          message = 'No camera or microphone found. Please ensure your devices are connected and enabled.';
        } else if (error.name === 'OverconstrainedError') {
          message = `The selected resolution (${res}) is not supported by your device. Try a lower quality.`;
        }
      }
      setErrorMessage(message);
      setCallState(CallState.MEDIA_ERROR);
      return null;
    }
  }, []);

  const enterLobby = useCallback(async () => {
    const stream = await initMedia(resolution);
    if (stream) {
      setCallState(CallState.LOBBY);
    }
  }, [initMedia, resolution]);

  const restartIce = useCallback(async () => {
    const pc = peerConnectionRef.current;
    if (!pc || !callDocRef.current) return;

    try {
      const offerDescription = await pc.createOffer({ iceRestart: true });
      await pc.setLocalDescription(offerDescription);

      const offer = {
        sdp: offerDescription.sdp,
        type: offerDescription.type,
      };

      await callDocRef.current.update({ offer });
    } catch (error) {
      console.error("Failed to restart ICE connection:", error);
      hangUp();
    }
  }, [hangUp]);

  const createPeerConnection = useCallback((stream: MediaStream) => {
    const pc = new RTCPeerConnection(STUN_SERVERS);

    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream);
    });

    pc.ontrack = (event) => {
      remoteStreamRef.current = event.streams[0];
      setRemoteStream(event.streams[0]);
    };

    pc.ondatachannel = (event) => {
      dataChannelRef.current = event.channel;
      dataChannelRef.current.onmessage = handleDataChannelMessage;
      dataChannelRef.current.onopen = () => {
        console.log('Data channel opened.');
        sendDataChannelMessage({ type: 'control', payload: { type: 'mute', value: isMuted } });
        sendDataChannelMessage({ type: 'control', payload: { type: 'video', value: isVideoOff } });
      };
      dataChannelRef.current.onclose = () => console.log('Data channel closed by peer.');
    };

    pc.onconnectionstatechange = () => {
      if (!pc) return;
      setConnectionState(pc.connectionState);

      if (pc.connectionState === 'connected') {
        hasConnectedOnceRef.current = true;
        if (ringingTimeoutRef.current) clearTimeout(ringingTimeoutRef.current);
        reconnectionAttemptsRef.current = 0;
        if (reconnectionTimerRef.current) {
          clearTimeout(reconnectionTimerRef.current);
          reconnectionTimerRef.current = null;
        }
        if (statsIntervalRef.current) {
          clearInterval(statsIntervalRef.current);
        }
        statsIntervalRef.current = setInterval(async () => {
          if (peerConnectionRef.current) {
            const stats = await peerConnectionRef.current.getStats();
            const newStats: CallStats = { packetsLost: null, jitter: null, roundTripTime: null, uploadBitrate: null, downloadBitrate: null };
            let totalBytesSent = 0;
            let totalBytesReceived = 0;
            const now = Date.now();

            stats.forEach(report => {
              if (report.type === 'remote-inbound-rtp' && report.kind === 'video') {
                newStats.packetsLost = report.packetsLost;
                newStats.jitter = report.jitter ? Math.round(report.jitter * 1000) : null;
              }
              if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                newStats.roundTripTime = report.currentRoundTripTime ? Math.round(report.currentRoundTripTime * 1000) : null;
              }
              if (report.type === 'outbound-rtp') {
                totalBytesSent += report.bytesSent;
              }
              if (report.type === 'inbound-rtp') {
                totalBytesReceived += report.bytesReceived;
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
        if (encryptionKeyRef.current) {
          if (setupE2EE(pc, encryptionKeyRef.current)) {
            setIsE2EEActive(true);
          }
        }
      } else if (pc.connectionState === 'failed') {
        console.error("Peer connection failed. Hanging up.");
        hangUp();
      } else if (pc.connectionState === 'disconnected') {
        setIsE2EEActive(false);
        setCallStats(null);
        if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
        lastStatsRef.current = null;

        if (isCallerRef.current && reconnectionAttemptsRef.current < MAX_RECONNECTION_ATTEMPTS && !reconnectionTimerRef.current) {
          reconnectionTimerRef.current = setTimeout(() => {
            reconnectionAttemptsRef.current++;
            console.log(`Connection lost. Attempting to reconnect... (Attempt ${reconnectionAttemptsRef.current})`);
            setCallState(CallState.RECONNECTING);

            reconnectionTimerRef.current = null;

            restartIce();
          }, 2000 * reconnectionAttemptsRef.current);
        } else if (reconnectionAttemptsRef.current >= MAX_RECONNECTION_ATTEMPTS && callStateRef.current !== CallState.ENDED) {
          console.log("Reconnection failed after maximum attempts.");
          hangUp();
        }
      } else if (pc.connectionState === 'closed') {
        setIsE2EEActive(false);
        setCallStats(null);
        if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
        lastStatsRef.current = null;
      }
    };

    peerConnectionRef.current = pc;
    setConnectionState(pc.connectionState);
    return pc;
  }, [restartIce, hangUp, handleDataChannelMessage, sendDataChannelMessage, isMuted, isVideoOff]);

  const initiateCall = useCallback(async (id: string, isRinging: boolean = false) => {
    if (isOperationInProgressRef.current) return;
    if (!localStreamRef.current) {
      console.error("Cannot initiate call without a local stream.");
      setCallState(CallState.MEDIA_ERROR);
      return;
    }
    isOperationInProgressRef.current = true;
    setCallState(isRinging ? CallState.RINGING : CallState.CREATING_OFFER);
    isCallerRef.current = true;
    reconnectionAttemptsRef.current = 0;

    try {
      const pc = createPeerConnection(localStreamRef.current);
      setCallId(id);

      const dc = pc.createDataChannel('chat');
      dc.onclose = () => console.log('Data channel closed.');
      dc.onmessage = handleDataChannelMessage;
      dataChannelRef.current = dc;

      callDocRef.current = db.ref(`calls/${id}`);
      offerCandidatesRef.current = callDocRef.current.child('offerCandidates');
      answerCandidatesRef.current = callDocRef.current.child('answerCandidates');

      pc.onicecandidate = (event) => {
        if (event.candidate && offerCandidatesRef.current) {
          offerCandidatesRef.current.push(event.candidate.toJSON());
        }
      };

      const offerDescription = await pc.createOffer();
      await pc.setLocalDescription(offerDescription);

      const offer = {
        sdp: offerDescription.sdp,
        type: offerDescription.type,
      };

      const callerId = getUserId();
      const callDataToSet: { [key: string]: any } = { offer, callerId, callId: id };

      if (enableE2EERef.current) {
        const { key, rawKey } = await generateKey();
        encryptionKeyRef.current = key;
        const exportableKey = Array.from(new Uint8Array(rawKey));
        callDataToSet.encryptionKey = exportableKey;
      } else {
        encryptionKeyRef.current = null;
      }

      await callDocRef.current.set(callDataToSet);

      callDocRef.current.on('value', async (snapshot: any) => {
        const data = snapshot.val();
        if (!data) {
          if (callStateRef.current !== CallState.IDLE && callStateRef.current !== CallState.ENDED) {
            hangUp();
          }
          return;
        }

        if (data?.declined) {
          setCallState(CallState.DECLINED);
          cleanUp();
          return;
        }

        if (data?.joinerId && !peerIdRef.current) {
          setPeerId(data.joinerId);
        }

        if (data?.answer && (!pc.currentRemoteDescription || pc.currentRemoteDescription.sdp !== data.answer.sdp)) {
          try {
            const answerDescription = new RTCSessionDescription(data.answer);
            await pc.setRemoteDescription(answerDescription);
          } catch (error) {
            console.error('Error setting remote description:', error);
          }
        }
      });

      answerCandidatesRef.current.on('child_added', (snapshot: any) => {
        try {
          const candidate = new RTCIceCandidate(snapshot.val());
          pc.addIceCandidate(candidate);
        } catch (error) {
          console.error('Error adding ICE candidate:', error);
        }
      });

      if (!isRinging) {
        setCallState(CallState.WAITING_FOR_ANSWER);
      }

      // Open data channel after setup
      dc.onopen = () => {
        console.log('Data channel opened.');
        sendDataChannelMessage({ type: 'control', payload: { type: 'mute', value: isMuted } });
        sendDataChannelMessage({ type: 'control', payload: { type: 'video', value: isVideoOff } });
      };
    } catch (error) {
      console.error('Error initiating call:', error);
      cleanUp();
      setCallState(CallState.IDLE);
    }
  }, [createPeerConnection, hangUp, cleanUp, handleDataChannelMessage, sendDataChannelMessage, isMuted, isVideoOff]);

  const ringUser = useCallback(async (peer: PinnedEntry) => {
    if (!peer.peerId) {
      console.error("Cannot ring user without a peer ID.");
      return;
    }
    const newCallId = generateCallId();
    setPeerId(peer.peerId);
    setCallId(newCallId);

    const myUserId = getUserId();
    const myDisplayName = getUserDisplayName();
    const incomingCallRef = db.ref(`users/${peer.peerId}/incomingCall`);

    const callPayload: { from: string; callId: string; callerAlias?: string } = {
      from: myUserId,
      callId: newCallId,
    };

    if (myDisplayName) {
      callPayload.callerAlias = myDisplayName;
    }

    await incomingCallRef.set(callPayload);

    await initiateCall(newCallId, true);

    ringingTimeoutRef.current = setTimeout(() => {
      declineCall(newCallId, peer.peerId);
    }, RING_TIMEOUT_MS);

  }, [initiateCall, declineCall]);

  const startCall = useCallback(async () => {
    const newCallId = generateCallId();
    await initiateCall(newCallId);
  }, [initiateCall]);

  const joinCall = useCallback(async (id: string) => {
    if (isOperationInProgressRef.current) return;
    isOperationInProgressRef.current = true;
    isCallerRef.current = false;
    reconnectionAttemptsRef.current = 0;

    try {
      const callRef = db.ref(`calls/${id}`);
      const callSnapshot = await callRef.get();
      const callData = callSnapshot.val();

      if (callData?.offer) {
        if (!localStreamRef.current) {
          console.error("Cannot join call without a local stream.");
          setCallState(CallState.MEDIA_ERROR);
          isOperationInProgressRef.current = false;
          return;
        }
        setCallState(CallState.JOINING);

        const initialOfferSdp = callData.offer.sdp;

        if (callData.callerId) {
          setPeerId(callData.callerId);
        }

        if (callData.encryptionKey) {
          const rawKey = new Uint8Array(callData.encryptionKey).buffer;
          encryptionKeyRef.current = await importKey(rawKey);
        } else {
          console.warn("Call does not support E2EE: encryption key missing.");
        }

        const pc = createPeerConnection(localStreamRef.current);
        setCallId(id);

        callDocRef.current = callRef;
        offerCandidatesRef.current = callDocRef.current.child('offerCandidates');
        answerCandidatesRef.current = callDocRef.current.child('answerCandidates');

        pc.onicecandidate = (event) => {
          if (event.candidate && answerCandidatesRef.current) {
            answerCandidatesRef.current.push(event.candidate.toJSON());
          }
        };

        await pc.setRemoteDescription(new RTCSessionDescription(callData.offer));

        const answerDescription = await pc.createAnswer();
        await pc.setLocalDescription(answerDescription);

        const answer = {
          type: answerDescription.type,
          sdp: answerDescription.sdp,
        };

        const joinerId = getUserId();
        await callDocRef.current.update({ answer, joinerId });

        const calleeIncomingCallRef = db.ref(`users/${joinerId}/incomingCall`);
        await calleeIncomingCallRef.remove();

        offerCandidatesRef.current.on('child_added', (snapshot: any) => {
          try {
            const candidate = new RTCIceCandidate(snapshot.val());
            pc.addIceCandidate(candidate);
          } catch (error) {
            console.error('Error adding ICE candidate:', error);
          }
        });

        callDocRef.current.on('value', async (snapshot: any) => {
          const data = snapshot.val();
          if (!data) {
            if (callStateRef.current !== CallState.IDLE && callStateRef.current !== CallState.ENDED) {
              hangUp();
            }
            return;
          }

          if (data?.offer && data.offer.sdp !== initialOfferSdp) {
            console.log("Received a new offer for reconnection.");
            setCallState(CallState.RECONNECTING);
            try {
              await pc.setRemoteDescription(new RTCSessionDescription(data.offer));

              const newAnswerDescription = await pc.createAnswer();
              await pc.setLocalDescription(newAnswerDescription);

              const newAnswer = {
                type: newAnswerDescription.type,
                sdp: newAnswerDescription.sdp,
              };

              await callDocRef.current.update({ answer: newAnswer });
            } catch (error) {
              console.error('Error handling reconnection offer:', error);
            }
          }
        });

        setCallState(CallState.CREATING_ANSWER);
      } else {
        console.log(`Call ID "${id}" is available. Initializing a new call.`);
        await initiateCall(id);
      }
    } catch (error) {
      console.error('Error joining call:', error);
      cleanUp();
      setCallState(CallState.IDLE);
    }
  }, [createPeerConnection, hangUp, initiateCall, cleanUp]);

  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const newMutedState = !isMuted;
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !newMutedState;
      });
      setIsMuted(newMutedState);
      sendDataChannelMessage({ type: 'control', payload: { type: 'mute', value: newMutedState } });
    }
  }, [isMuted, sendDataChannelMessage]);

  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const newVideoState = !isVideoOff;
      localStreamRef.current.getVideoTracks().forEach(track => {
        track.enabled = newVideoState;
      });
      setIsVideoOff(!newVideoState);
      sendDataChannelMessage({ type: 'control', payload: { type: 'video', value: !newVideoState } });
    }
  }, [isVideoOff, sendDataChannelMessage]);

  // Clean up on page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (callStateRef.current !== CallState.IDLE && callStateRef.current !== CallState.ENDED) {
        if (callDocRef.current) {
          callDocRef.current.remove();
        }
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  return {
    localStream, remoteStream, connectionState, isMuted, isVideoOff, callState, setCallState,
    errorMessage, callId, peerId, isE2EEActive, callStats, resolution, setResolution,
    isRemoteMuted, isRemoteVideoOff,
    enableE2EE, setEnableE2EE,
    enterLobby, startCall, joinCall, ringUser, declineCall, toggleMute, toggleVideo, hangUp, reset,
    setOnChatMessage, sendMessage,
  };
};
