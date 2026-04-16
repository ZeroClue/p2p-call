import { useState, useEffect, useRef, useCallback } from 'react';
import { CallState, IncomingCall } from '../types';
import { db } from '../firebase';

export const useIncomingCall = (
  userId: string | null,
  callState: CallState,
  onCallStateChange: (state: CallState) => void,
) => {
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const callStateRef = useRef<CallState>(callState);
  callStateRef.current = callState;

  useEffect(() => {
    if (!userId) return;
    const incomingCallRef = db.ref(`users/${userId}/incomingCall`);

    const listener = (snapshot: { val(): unknown }) => {
      const call = snapshot.val() as IncomingCall | null;
      if (call) {
        if ([CallState.IDLE, CallState.ENDED, CallState.DECLINED].includes(callStateRef.current)) {
          setIncomingCall(call);
          onCallStateChange(CallState.INCOMING_CALL);
        }
      } else {
        setIncomingCall(null);
        if (callStateRef.current === CallState.INCOMING_CALL) {
          onCallStateChange(CallState.IDLE);
        }
      }
    };

    incomingCallRef.on('value', listener);
    return () => incomingCallRef.off('value', listener);
  }, [userId, onCallStateChange]);

  const handleAcceptCall = useCallback(
    (joinCallFn: (id: string) => void) => {
      if (incomingCall) {
        joinCallFn(incomingCall.callId);
      }
    },
    [incomingCall],
  );

  const handleDeclineCall = useCallback(
    (declineCallFn: (id: string) => Promise<void>, resetFn: () => void) => {
      if (incomingCall) {
        declineCallFn(incomingCall.callId);
      }
      setIncomingCall(null);
      resetFn();
    },
    [incomingCall],
  );

  return { incomingCall, handleAcceptCall, handleDeclineCall };
};
