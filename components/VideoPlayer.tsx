import React, { useRef, useEffect, forwardRef } from 'react';

interface VideoPlayerProps {
  stream: MediaStream | null;
  muted: boolean;
  style?: React.CSSProperties;
}

const VideoPlayer = forwardRef<HTMLVideoElement, VideoPlayerProps>(
  ({ stream, muted, style }, ref) => {
    const internalRef = useRef<HTMLVideoElement>(null);
    const videoRef = (ref || internalRef) as React.RefObject<HTMLVideoElement>;

    useEffect(() => {
      if (videoRef.current && stream) {
        videoRef.current.srcObject = stream;
      }
    }, [stream, videoRef]);

    return (
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        style={style}
        className="w-full h-full object-cover"
      />
    );
  },
);

export default VideoPlayer;
