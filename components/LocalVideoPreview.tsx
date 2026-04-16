import React, { useRef } from 'react';
import VideoPlayer from './VideoPlayer';
import { usePinchToZoom } from '../hooks/usePinchToZoom';
import { useDraggable } from '../hooks/useDraggable';
import { UnmuteIcon, VideoOffIcon } from './icons';

interface LocalVideoPreviewProps {
  stream: MediaStream | null;
  isMuted: boolean;
  isVideoOff: boolean;
}

const LocalVideoPreview: React.FC<LocalVideoPreviewProps> = ({ stream, isMuted, isVideoOff }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { onPointerDown } = useDraggable(containerRef);
  const { zoom, onTouchStart, onTouchMove, onTouchEnd, isPinching } = usePinchToZoom();

  return (
    <div
      ref={containerRef}
      onPointerDown={onPointerDown}
      className="absolute bottom-6 right-6 w-32 h-auto md:w-48 aspect-video rounded-lg overflow-hidden shadow-lg border-2 border-white/20 touch-none cursor-move select-none z-20"
    >
      <div 
        className="w-full h-full relative"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <VideoPlayer 
            stream={stream} 
            muted={true}
            style={{
                transform: `scale(${zoom})`,
                transition: isPinching ? 'none' : 'transform 0.1s linear',
            }}
        />
        {(isMuted || isVideoOff) && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center gap-2 pointer-events-none">
            {isMuted && <UnmuteIcon className="w-6 h-6 text-white" />}
            {isVideoOff && <VideoOffIcon className="w-6 h-6 text-white" />}
          </div>
        )}
        {zoom > 1.05 && (
            <div className="absolute top-1 right-1 bg-black/60 text-white text-xs font-mono px-1.5 py-0.5 rounded-full pointer-events-none" aria-live="polite">
                {zoom.toFixed(1)}x
            </div>
        )}
      </div>
    </div>
  );
};

export default LocalVideoPreview;
