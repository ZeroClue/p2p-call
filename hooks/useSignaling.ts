import { useRef, useCallback } from 'react';
import { CallState, PinnedEntry } from '../types';
import { db } from '../firebase';
import { generateCallId } from '../utils/id';
import { getUserId, getUserDisplayName } from '../utils/user';
import { generateKey, importKey } from '../utils/crypto';

const MAX_RECONNECTION_ATTEMPTS = 3;
const RING_TIMEOUT_MS = 30000;

/**
 * Firebase DatabaseReference interface for type safety.
 * Firebase is loaded via CDN as a global, so we define the interface locally.
 */
interface DatabaseReference {
  on(event: string, callback: (snapshot: { val(): unknown }) => void): void;
  off(event?: string, callback?: (snapshot: { val(): unknown }) => void): void;
  set(data: unknown): Promise<void>;
  update(data: Record<string, unknown>): Promise<void>;
  remove(): Promise<void>;
  push(data: unknown): Promise<{ key: string }>;
  child(path: string): DatabaseReference;
  get(): Promise<{ val(): unknown; exists(): boolean }>;
}

/**
 * Tracked listener entry for cleanup.
 */
interface TrackedListener {
  ref: DatabaseReference;
  event: string;
  callback: (snapshot: { val(): unknown }) => void;
}

/**
 * Callbacks interface for useSignaling to communicate state changes to parent.
 */
export interface SignalingCallbacks {
  onCallStateChange: (state: CallState) => void;
  onSetCallId: (id: string | null) => void;
  onSetPeerId: (id: string | null) => void;
  onSetE2EEActive: (active: boolean) => void;
}

/**
 * Firebase Signaling Hook
 *
 * Manages WebRTC signaling via Firebase Realtime Database.
 * Key features:
 * - Tracked listener cleanup to prevent resource leaks
 * - Offer/answer exchange for call establishment
 * - ICE candidate exchange
 * - End-to-end encryption key exchange
 * - Call declining with cleanup
 * - Direct peer ringing via Firebase presence
 *
 * @param callbacks - Functions to update parent state
 * @param callStateRef - Synced ref to current call state
 * @param peerIdRef - Synced ref to current peer ID
 * @param enableE2EERef - Synced ref to E2EE preference
 */
export const useSignaling = (
  callbacks: SignalingCallbacks,
  callStateRef: React.MutableRefObject<CallState>,
  peerIdRef: React.MutableRefObject<string | null>,
  enableE2EERef: React.MutableRefObject<boolean>
) => {
  const { onCallStateChange, onSetCallId, onSetPeerId, onSetE2EEActive } = callbacks;

  // Firebase refs
  const callDocRef = useRef<DatabaseReference | null>(null);
  const answerCandidatesRef = useRef<DatabaseReference | null>(null);
  const offerCandidatesRef = useRef<DatabaseReference | null>(null);

  // Encryption and connection state
  const encryptionKeyRef = useRef<CryptoKey | null>(null);
  const reconnectionAttemptsRef = useRef(0);
  const isCallerRef = useRef(false);
  const ringingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Operation guard to prevent concurrent async call operations
  const isOperationInProgressRef = useRef(false);

  // Tracked listeners for reliable cleanup
  const activeListenersRef = useRef<TrackedListener[]>([]);

  /**
   * Add a tracked listener that will be cleaned up on cleanupSignaling.
   */
  const addTrackedListener = useCallback(
    (ref: DatabaseReference, event: string, callback: (snapshot: { val(): unknown }) => void) => {
      ref.on(event, callback);
      activeListenersRef.current.push({ ref, event, callback });
    },
    []
  );

  /**
   * Initiate a call as the caller.
   * Creates SDP offer, sets up ICE candidate handling, and writes to Firebase.
   *
   * @param id - Call ID to use
   * @param pc - RTCPeerConnection instance
   * @param stream - Local media stream
   * @param enableE2EE - Whether to enable end-to-end encryption
   * @param isRinging - Whether this is a ring operation (direct peer call)
   */
  const initiateCall = useCallback(
    async (
      id: string,
      pc: RTCPeerConnection,
      stream: MediaStream,
      enableE2EE: boolean,
      isRinging: boolean = false
    ) => {
      // Guard against concurrent operations
      if (isOperationInProgressRef.current) {
        console.warn('Call operation already in progress, ignoring initiateCall');
        return;
      }

      if (!stream) {
        console.error('Cannot initiate call without a local stream');
        onCallStateChange(CallState.MEDIA_ERROR);
        return;
      }

      isOperationInProgressRef.current = true;
      onCallStateChange(isRinging ? CallState.RINGING : CallState.CREATING_OFFER);
      isCallerRef.current = true;
      reconnectionAttemptsRef.current = 0;

      try {
        onSetCallId(id);

        callDocRef.current = db.ref(`calls/${id}`) as DatabaseReference;
        offerCandidatesRef.current = callDocRef.current.child('offerCandidates');
        answerCandidatesRef.current = callDocRef.current.child('answerCandidates');

        // Set up ICE candidate handler
        pc.onicecandidate = (event) => {
          if (event.candidate && offerCandidatesRef.current) {
            offerCandidatesRef.current.push(event.candidate.toJSON());
          }
        };

        // Create offer
        const offerDescription = await pc.createOffer();
        await pc.setLocalDescription(offerDescription);

        const offer = {
          sdp: offerDescription.sdp,
          type: offerDescription.type,
        };

        const callerId = getUserId();
        const callDataToSet: Record<string, unknown> = {
          offer,
          callerId,
          callId: id,
        };

        // Generate and include encryption key if E2EE is enabled
        if (enableE2EE) {
          const { key, rawKey } = await generateKey();
          encryptionKeyRef.current = key;
          const exportableKey = Array.from(new Uint8Array(rawKey));
          callDataToSet.encryptionKey = exportableKey;
        } else {
          encryptionKeyRef.current = null;
        }

        await callDocRef.current.set(callDataToSet);

        // Listen for answer or decline
        addTrackedListener(
          callDocRef.current,
          'value',
          async (snapshot: { val(): unknown }) => {
            const data = snapshot.val() as Record<string, unknown> | null;

            if (!data) {
              if (
                callStateRef.current !== CallState.IDLE &&
                callStateRef.current !== CallState.ENDED
              ) {
                // Call was removed, hang up
                onCallStateChange(CallState.ENDED);
              }
              return;
            }

            if (data?.declined) {
              onCallStateChange(CallState.DECLINED);
              cleanupSignaling(true);
              return;
            }

            if (data?.joinerId && !peerIdRef.current) {
              onSetPeerId(data.joinerId as string);
            }

            if (
              data?.answer &&
              (!pc.currentRemoteDescription ||
                pc.currentRemoteDescription.sdp !== (data.answer as { sdp: string }).sdp)
            ) {
              try {
                const answerDescription = new RTCSessionDescription(data.answer as RTCSessionDescriptionInit);
                await pc.setRemoteDescription(answerDescription);
              } catch (error) {
                console.error('Error setting remote description:', error);
              }
            }
          }
        );

        // Listen for remote ICE candidates
        addTrackedListener(
          answerCandidatesRef.current,
          'child_added',
          (snapshot: { val(): unknown }) => {
            try {
              const candidate = new RTCIceCandidate(snapshot.val() as RTCIceCandidateInit);
              pc.addIceCandidate(candidate);
            } catch (error) {
              console.error('Error adding ICE candidate:', error);
            }
          }
        );

        if (!isRinging) {
          onCallStateChange(CallState.WAITING_FOR_ANSWER);
        }
      } catch (error) {
        console.error('Error initiating call:', error);
        cleanupSignaling();
        onCallStateChange(CallState.IDLE);
      }
    },
    [
      onCallStateChange,
      onSetCallId,
      onSetPeerId,
      callStateRef,
      peerIdRef,
      addTrackedListener,
    ]
  );

  /**
   * Join an existing call as the callee.
   * Reads offer from Firebase, creates answer, and exchanges ICE candidates.
   *
   * @param id - Call ID to join
   * @param pc - RTCPeerConnection instance
   * @param stream - Local media stream
   * @param enableE2EE - Whether E2EE was enabled by caller
   */
  const joinCall = useCallback(
    async (
      id: string,
      pc: RTCPeerConnection,
      stream: MediaStream,
      enableE2EE: boolean
    ) => {
      // Guard against concurrent operations
      if (isOperationInProgressRef.current) {
        console.warn('Call operation already in progress, ignoring joinCall');
        return;
      }

      isOperationInProgressRef.current = true;
      isCallerRef.current = false;
      reconnectionAttemptsRef.current = 0;

      try {
        const callRef = db.ref(`calls/${id}`) as DatabaseReference;
        const callSnapshot = await callRef.get();
        const callData = callSnapshot.val() as Record<string, unknown> | null;

        if (callData?.offer) {
          if (!stream) {
            console.error('Cannot join call without a local stream');
            onCallStateChange(CallState.MEDIA_ERROR);
            isOperationInProgressRef.current = false;
            return;
          }

          onCallStateChange(CallState.JOINING);

          const initialOfferSdp = (callData.offer as { sdp: string }).sdp;

          if (callData.callerId) {
            onSetPeerId(callData.callerId as string);
          }

          // Import encryption key if present
          if (callData.encryptionKey) {
            const rawKey = new Uint8Array(callData.encryptionKey as number[]).buffer;
            encryptionKeyRef.current = await importKey(rawKey);
          } else {
            console.warn('Call does not support E2EE: encryption key missing');
          }

          onSetCallId(id);

          callDocRef.current = callRef;
          offerCandidatesRef.current = callDocRef.current.child('offerCandidates');
          answerCandidatesRef.current = callDocRef.current.child('answerCandidates');

          // Set up ICE candidate handler
          pc.onicecandidate = (event) => {
            if (event.candidate && answerCandidatesRef.current) {
              answerCandidatesRef.current.push(event.candidate.toJSON());
            }
          };

          await pc.setRemoteDescription(new RTCSessionDescription(callData.offer as RTCSessionDescriptionInit));

          const answerDescription = await pc.createAnswer();
          await pc.setLocalDescription(answerDescription);

          const answer = {
            type: answerDescription.type,
            sdp: answerDescription.sdp,
          };

          const joinerId = getUserId();
          await callDocRef.current.update({ answer, joinerId });

          // Remove incoming call notification for joiner
          const calleeIncomingCallRef = db.ref(`users/${joinerId}/incomingCall`) as DatabaseReference;
          await calleeIncomingCallRef.remove();

          // Listen for offer ICE candidates
          addTrackedListener(
            offerCandidatesRef.current,
            'child_added',
            (snapshot: { val(): unknown }) => {
              try {
                const candidate = new RTCIceCandidate(snapshot.val() as RTCIceCandidateInit);
                pc.addIceCandidate(candidate);
              } catch (error) {
                console.error('Error adding ICE candidate:', error);
              }
            }
          );

          // Listen for reconnection offers
          addTrackedListener(
            callDocRef.current,
            'value',
            async (snapshot: { val(): unknown }) => {
              const data = snapshot.val() as Record<string, unknown> | null;

              if (!data) {
                if (
                  callStateRef.current !== CallState.IDLE &&
                  callStateRef.current !== CallState.ENDED
                ) {
                  onCallStateChange(CallState.ENDED);
                }
                return;
              }

              if (data?.offer && (data.offer as { sdp: string }).sdp !== initialOfferSdp) {
                console.log('Received a new offer for reconnection');
                onCallStateChange(CallState.RECONNECTING);
                try {
                  await pc.setRemoteDescription(new RTCSessionDescription(data.offer as RTCSessionDescriptionInit));

                  const newAnswerDescription = await pc.createAnswer();
                  await pc.setLocalDescription(newAnswerDescription);

                  const newAnswer = {
                    type: newAnswerDescription.type,
                    sdp: newAnswerDescription.sdp,
                  };

                  await callDocRef.current?.update({ answer: newAnswer });
                } catch (error) {
                  console.error('Error handling reconnection offer:', error);
                }
              }
            }
          );

          onCallStateChange(CallState.CREATING_ANSWER);
        } else {
          // No offer exists, become the caller instead
          console.log(`Call ID "${id}" is available. Initializing a new call.`);
          isOperationInProgressRef.current = false;
          await initiateCall(id, pc, stream, enableE2EE, false);
        }
      } catch (error) {
        console.error('Error joining call:', error);
        cleanupSignaling();
        onCallStateChange(CallState.IDLE);
      }
    },
    [
      onCallStateChange,
      onSetCallId,
      onSetPeerId,
      callStateRef,
      initiateCall,
      addTrackedListener,
    ]
  );

  /**
   * Decline an incoming call.
   * Updates Firebase with declined flag and cleans up resources.
   *
   * @param incomingCallId - Call ID to decline
   * @param peerToRingId - Optional peer ID (for ringing calls)
   */
  const declineCall = useCallback(
    async (incomingCallId: string, peerToRingId?: string) => {
      const myUserId = getUserId();
      const callRef = db.ref(`calls/${incomingCallId}`) as DatabaseReference;

      try {
        if (peerToRingId) {
          // Remove the incoming call from the peer we were ringing
          const calleeIncomingCallRef = db.ref(`users/${peerToRingId}/incomingCall`) as DatabaseReference;
          await calleeIncomingCallRef.remove();
        } else {
          // Remove our own incoming call notification
          const myIncomingCallRef = db.ref(`users/${myUserId}/incomingCall`) as DatabaseReference;
          await myIncomingCallRef.remove();
        }

        await callRef.update({ declined: true });
      } catch (error) {
        console.error('Error declining call:', error);
      }

      // Clear ringing timeout before cleanup (LEAK FIX)
      if (ringingTimeoutRef.current) {
        clearTimeout(ringingTimeoutRef.current);
        ringingTimeoutRef.current = null;
      }

      cleanupSignaling(true); // Keep call doc temporarily

      // Remove call doc after delay
      setTimeout(() => {
        callRef.remove();
      }, 2000);

      onCallStateChange(CallState.IDLE);
    },
    [onCallStateChange]
  );

  /**
   * Ring a pinned peer directly.
   * Writes incoming call to peer's Firebase path and initiates call.
   *
   * @param peer - Pinned contact to ring
   * @param pc - RTCPeerConnection instance
   * @param stream - Local media stream
   * @param enableE2EE - Whether to enable E2EE
   */
  const ringUser = useCallback(
    async (
      peer: PinnedEntry,
      pc: RTCPeerConnection,
      stream: MediaStream,
      enableE2EE: boolean
    ) => {
      if (!peer.peerId) {
        console.error('Cannot ring user without a peer ID');
        return;
      }

      const newCallId = generateCallId();
      onSetPeerId(peer.peerId);
      onSetCallId(newCallId);

      const myUserId = getUserId();
      const myDisplayName = getUserDisplayName();
      const incomingCallRef = db.ref(`users/${peer.peerId}/incomingCall`) as DatabaseReference;

      const callPayload: { from: string; callId: string; callerAlias?: string } = {
        from: myUserId,
        callId: newCallId,
      };

      if (myDisplayName) {
        callPayload.callerAlias = myDisplayName;
      }

      await incomingCallRef.set(callPayload);

      await initiateCall(newCallId, pc, stream, enableE2EE, true);

      // Start ringing timeout
      ringingTimeoutRef.current = setTimeout(() => {
        declineCall(newCallId, peer.peerId);
      }, RING_TIMEOUT_MS);
    },
    [onSetPeerId, onSetCallId, initiateCall, declineCall]
  );

  /**
   * Clean up all signaling resources.
   * Removes all tracked listeners and resets refs.
   *
   * @param keepCallDoc - Whether to keep the call doc (for decline scenarios)
   */
  const cleanupSignaling = useCallback((keepCallDoc = false) => {
    // Remove all tracked listeners (RESOURCE LEAK FIX)
    activeListenersRef.current.forEach(({ ref, event, callback }) => {
      ref.off(event, callback);
    });
    activeListenersRef.current = [];

    // Clear ringing timeout
    if (ringingTimeoutRef.current) {
      clearTimeout(ringingTimeoutRef.current);
      ringingTimeoutRef.current = null;
    }

    // Remove call doc if not keeping
    if (callDocRef.current && !keepCallDoc) {
      callDocRef.current.remove();
    }

    // Null all refs
    callDocRef.current = null;
    answerCandidatesRef.current = null;
    offerCandidatesRef.current = null;
    encryptionKeyRef.current = null;

    // Reset operation flag
    isOperationInProgressRef.current = false;

    // Reset E2EE state
    onSetE2EEActive(false);
  }, [onSetE2EEActive]);

  /**
   * Set the operation in progress flag.
   * Used to guard against concurrent async operations.
   */
  const setOperationInProgress = useCallback((value: boolean) => {
    isOperationInProgressRef.current = value;
  }, []);

  return {
    // Firebase refs (exposed for parent hook access)
    callDocRef,
    answerCandidatesRef,
    offerCandidatesRef,
    encryptionKeyRef,
    reconnectionAttemptsRef,
    isCallerRef,

    // Signaling operations
    initiateCall,
    joinCall,
    declineCall,
    ringUser,
    cleanupSignaling,
    setOperationInProgress,
  };
};
