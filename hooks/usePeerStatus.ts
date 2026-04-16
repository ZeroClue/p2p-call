import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { PeerStatus } from '../types';

export const usePeerStatus = (peerIds: string[]) => {
  const [peerStatus, setPeerStatus] = useState<{ [key: string]: PeerStatus }>({});

  useEffect(() => {
    const listeners: { [key: string]: (snapshot: any) => void } = {};

    setPeerStatus(prev => {
      const next: { [key: string]: PeerStatus } = {};
      peerIds.forEach(id => {
        if (prev[id]) next[id] = prev[id];
      });
      return next;
    });

    peerIds.forEach(id => {
      const peerStatusRef = db.ref(`/status/${id}`);

      const listener = (snapshot: any) => {
        const status = snapshot.val();
        if (status) {
          setPeerStatus(prev => ({
            ...prev,
            [id]: status,
          }));
        } else {
          setPeerStatus(prev => ({
            ...prev,
            [id]: { isOnline: false, lastChanged: 0 },
          }));
        }
      };

      peerStatusRef.on('value', listener);
      listeners[id] = listener;
    });

    return () => {
      peerIds.forEach(id => {
        const peerStatusRef = db.ref(`/status/${id}`);
        if (listeners[id]) {
          peerStatusRef.off('value', listeners[id]);
        }
      });
    };
  }, [peerIds]);

  return peerStatus;
};