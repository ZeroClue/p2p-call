import { useState, useRef, useCallback } from 'react';

interface DataChannelMessage {
  type: 'chat' | 'control';
  payload: string | { type: 'mute' | 'video'; value: boolean };
}

export const useDataChannel = () => {
  const [isRemoteMuted, setIsRemoteMuted] = useState(false);
  const [isRemoteVideoOff, setIsRemoteVideoOff] = useState(false);

  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const onChatMessageCallbackRef = useRef<((data: string) => void) | null>(null);

  const handleDataChannelMessage = useCallback((event: MessageEvent) => {
    try {
      const message = JSON.parse(event.data) as DataChannelMessage;

      if (message.type === 'chat' && typeof message.payload === 'string') {
        onChatMessageCallbackRef.current?.(message.payload);
      } else if (message.type === 'control') {
        const { type, value } = message.payload as { type: 'mute' | 'video'; value: boolean };

        if (type === 'mute') {
          setIsRemoteMuted(!!value);
        } else if (type === 'video') {
          setIsRemoteVideoOff(!!value);
        }
      }
    } catch (e) {
      // Fallback: if it's a raw string, pass it to the chat callback
      if (typeof event.data === 'string') {
        onChatMessageCallbackRef.current?.(event.data);
      }
      console.warn('Could not parse data channel message:', event.data, e);
    }
  }, []);

  const setDataChannel = useCallback(
    (channel: RTCDataChannel) => {
      dataChannelRef.current = channel;
      channel.onmessage = handleDataChannelMessage;
    },
    [handleDataChannelMessage],
  );

  const sendRaw = useCallback((message: object) => {
    if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
      dataChannelRef.current.send(JSON.stringify(message));
    }
  }, []);

  const sendMessage = useCallback(
    (chatMessage: string) => {
      sendRaw({ type: 'chat', payload: chatMessage });
    },
    [sendRaw],
  );

  const sendControl = useCallback(
    (type: 'mute' | 'video', value: boolean) => {
      sendRaw({ type: 'control', payload: { type, value } });
    },
    [sendRaw],
  );

  const setOnChatMessage = useCallback((callback: (data: string) => void) => {
    onChatMessageCallbackRef.current = callback;
  }, []);

  const cleanupDataChannel = useCallback(() => {
    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }
    onChatMessageCallbackRef.current = null;
    setIsRemoteMuted(false);
    setIsRemoteVideoOff(false);
  }, []);

  return {
    isRemoteMuted,
    isRemoteVideoOff,
    setDataChannel,
    sendMessage,
    sendControl,
    setOnChatMessage,
    cleanupDataChannel,
  };
};
