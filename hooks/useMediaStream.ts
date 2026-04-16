import { useState, useRef, useCallback, useEffect } from 'react';

const RESOLUTION_CONSTRAINTS: Record<string, MediaTrackConstraints> = {
  '1080p': { width: { ideal: 1920 }, height: { ideal: 1080 } },
  '720p': { width: { ideal: 1280 }, height: { ideal: 720 } },
  '480p': { width: { ideal: 854 }, height: { ideal: 480 } },
};

export const useMediaStream = (initialResolution: string) => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resolution, setResolution] = useState<string>(initialResolution);

  // Refs for use inside callbacks without stale closures
  const localStreamRef = useRef<MediaStream | null>(null);
  const isMutedRef = useRef(false);
  const isVideoOffRef = useRef(false);

  // Keep refs synced with state
  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    isVideoOffRef.current = isVideoOff;
  }, [isVideoOff]);

  const initMedia = useCallback(async (res: string): Promise<MediaStream | null> => {
    try {
      // Stop existing tracks first
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

      const errorName = error instanceof Error ? error.name : (error as any)?.name;

      if (errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError') {
        message = 'Permission denied. Please allow this site to access your camera and microphone in your browser settings.';
      } else if (errorName === 'NotFoundError' || errorName === 'DevicesNotFoundError') {
        message = 'No camera or microphone found. Please ensure your devices are connected and enabled.';
      } else if (errorName === 'OverconstrainedError') {
        message = `The selected resolution (${res}) is not supported by your device. Try a lower quality.`;
      }

      setErrorMessage(message);
      return null;
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const newMutedState = !isMutedRef.current;
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !newMutedState;
      });
      setIsMuted(newMutedState);
    }
  }, []);

  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const newVideoState = !isVideoOffRef.current;
      localStreamRef.current.getVideoTracks().forEach(track => {
        track.enabled = !newVideoState;
      });
      setIsVideoOff(newVideoState);
    }
  }, []);

  const cleanupMedia = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    setLocalStream(null);
  }, []);

  return {
    localStream,
    isMuted,
    isVideoOff,
    errorMessage,
    resolution,
    setResolution,
    initMedia,
    toggleMute,
    toggleVideo,
    cleanupMedia,
  };
};
