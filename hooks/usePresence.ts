import { useEffect, useRef } from 'react';
import { db, ServerValue } from '../firebase';

interface OnDisconnect {
  set(data: object): Promise<void>;
  cancel(): Promise<void>;
}

interface FirebaseSnapshot {
  val(): unknown;
}

export const usePresence = (userId: string | null) => {
  const onDisconnectRef = useRef<OnDisconnect | null>(null);

  useEffect(() => {
    if (!userId) return;

    const userStatusRef = db.ref(`/status/${userId}`);
    const connectedRef = db.ref('.info/connected');

    const listener = connectedRef.on('value', (snapshot: FirebaseSnapshot) => {
      if (snapshot.val() === false) {
        return;
      }

      const onDisconnect = userStatusRef.onDisconnect();
      onDisconnectRef.current = onDisconnect;

      onDisconnect
        .set({
          isOnline: false,
          lastChanged: ServerValue.TIMESTAMP,
        })
        .then(() => {
          userStatusRef.set({
            isOnline: true,
            lastChanged: ServerValue.TIMESTAMP,
          });
        })
        .catch((error: Error) => {
          console.error('Error setting presence:', error);
        });
    });

    return () => {
      connectedRef.off('value', listener);
      if (onDisconnectRef.current) {
        onDisconnectRef.current.cancel().catch(() => {});
        onDisconnectRef.current = null;
      }
      userStatusRef
        .set({
          isOnline: false,
          lastChanged: ServerValue.TIMESTAMP,
        })
        .catch(() => {});
    };
  }, [userId]);
};
