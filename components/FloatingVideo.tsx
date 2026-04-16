import React, { useRef, useState, useCallback, useEffect } from 'react';
import VideoPlayer from './VideoPlayer';
import { usePinchToZoom } from '../hooks/usePinchToZoom';
import { CallState, CallStats } from '../types';
import { formatTime } from '../utils/format';

interface FloatingVideoProps {
  stream: MediaStream | null;
  callState: CallState;
  connectionState: RTCPeerConnectionState;
  isE2EEActive: boolean;
  callStats: CallStats | null;
  callDuration: number;
  isRemoteMuted: boolean;
  isRemoteVideoOff: boolean;
}

// FIX: Destructure title prop to render a <title> element for tooltips, which is better for accessibility.
// FIX: Added `& { title?: string }` to the component's props type to allow passing a `title` prop for accessibility.
const MutedIcon: React.FC<React.SVGProps<SVGSVGElement> & { title?: string }> = ({ title, ...props }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
       {title && <title>{title}</title>}
       <path d="M13.5 4.06c0-1.336-1.076-2.412-2.411-2.412A2.412 2.412 0 0 0 8.677 4.06v8.682a2.412 2.412 0 0 0 4.823 0V4.06Z" />
       <path d="M6 10.5a.75.75 0 0 1 .75.75v.75a4.5 4.5 0 0 0 9 0v-.75a.75.75 0 0 1 1.5 0v.75a6 6 0 1 1-12 0v-.75a.75.75 0 0 1 .75-.75Z" />
       <path fillRule="evenodd" d="M2.023 2.023a.75.75 0 0 1 1.06 0L21.977 20.92a.75.75 0 1 1-1.06 1.06L2.023 3.083a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
   </svg>
);
   
// FIX: Destructure title prop to render a <title> element for tooltips, which is better for accessibility.
// FIX: Added `& { title?: string }` to the component's props type to allow passing a `title` prop for accessibility.
const VideoIsOffIcon: React.FC<React.SVGProps<SVGSVGElement> & { title?: string }> = ({ title, ...props }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
       {title && <title>{title}</title>}
       <path d="M3.53 3.53a.75.75 0 0 0-1.06 1.06l18 18a.75.75 0 0 0 1.06-1.06l-18-18ZM20.25 11.625l1.58-1.58a1.5 1.5 0 0 0-1.06-2.56L18 8.935V7.5a3 3 0 0 0-3-3h-2.25l-1.822-1.823a.75.75 0 0 0-1.06 0l-.146.147-1.125 1.125a.75.75 0 0 0 0 1.06l.12.12L12 8.25V7.5h3v3.75l-4.28 4.28-.625.625a.75.75 0 0 0 0 1.06l.625.625 4.28 4.28V16.5h.75a3 3 0 0 0 3-3V11.625ZM4.5 19.5h8.25a3 3 0 0 0 3-3V13.125l-3.375-3.375L9 13.125v3.375h-3v-3.375l-.375-.375-1.5-1.5V16.5a3 3 0 0 0 3 3Z" />
   </svg>
);

const ResizeIcon: React.FC<{className?: string}> = ({className}) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <line x1="18" y1="18" x2="18" y2="18" strokeWidth={3} strokeLinecap="round" />
      <line x1="14" y1="18" x2="14" y2="18" strokeWidth={3} strokeLinecap="round" />
      <line x1="18" y1="14" x2="18" y2="14" strokeWidth={3} strokeLinecap="round" />
    </svg>
);

const LockIcon: React.FC<{className?: string}> = ({className}) => (
 <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
  <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 0 0-5.25 5.25v3a3 3 0 0 0-3 3v6.75a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3v-6.75a3 3 0 0 0-3-3v-3c0-2.9-2.35-5.25-5.25-5.25Zm3.75 8.25v-3a3.75 3.75 0 1 0-7.5 0v3h7.5Z" clipRule="evenodd" />
</svg>
);

const ConnectionStatusIndicator: React.FC<{ callState: CallState, connectionState: RTCPeerConnectionState, isE2EEActive: boolean }> = ({ callState, connectionState, isE2EEActive }) => {
    let color = 'bg-gray-500';
    let text = 'Unknown';
    let animate = false;

    if (callState === CallState.RECONNECTING) {
        color = 'bg-yellow-500';
        text = 'Reconnecting';
        animate = true;
    } else {
        switch (connectionState) {
            case 'connecting':
                color = 'bg-yellow-500';
                text = 'Connecting';
                animate = true;
                break;
            case 'connected':
                color = 'bg-green-500';
                text = 'Connected';
                break;
            case 'disconnected':
                color = 'bg-orange-500';
                text = 'Connection Lost';
                break;
            case 'failed':
                color = 'bg-red-500';
                text = 'Failed';
                break;
            case 'new':
                color = 'bg-blue-500';
                text = 'Initializing';
                animate = true;
                break;
            case 'closed':
                 color = 'bg-gray-500';
                 text = 'Disconnected';
                 break;
        }
    }
    
    return (
        <div className="flex items-center gap-2 text-sm text-white" title={`Connection Status: ${text}${isE2EEActive ? ' (End-to-End Encrypted)' : ''}`}>
            <span className={`w-3 h-3 rounded-full ${color} ${animate ? 'animate-pulse' : ''}`}></span>
            {isE2EEActive && <LockIcon className="w-4 h-4 text-green-400" />}
            <span className="font-semibold hidden sm:block">{text}</span>
        </div>
    );
};

const SignalBarsIcon: React.FC<{ level: 'good' | 'average' | 'poor' | 'unknown'; className?: string }> = ({ level, className }) => {
  const levelMap = {
    good: { bars: 4, color: 'text-green-400' },
    average: { bars: 3, color: 'text-yellow-400' },
    poor: { bars: 1, color: 'text-red-400' },
    unknown: { bars: 2, color: 'text-gray-500' },
  };
  const { bars, color } = levelMap[level];

  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={`${className} ${color}`}>
      <path d="M21 4.25a.75.75 0 0 1 .75.75v13.5a.75.75 0 0 1-1.5 0V5a.75.75 0 0 1 .75-.75Z" opacity={bars >= 4 ? 1 : 0.3} />
      <path d="M16.5 7.25a.75.75 0 0 1 .75.75v10.5a.75.75 0 0 1-1.5 0V8a.75.75 0 0 1 .75-.75Z" opacity={bars >= 3 ? 1 : 0.3} />
      <path d="M12 10.25a.75.75 0 0 1 .75.75v7.5a.75.75 0 0 1-1.5 0v-7.5a.75.75 0 0 1 .75-.75Z" opacity={bars >= 2 ? 1 : 0.3} />
      <path d="M7.5 13.25a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5a.75.75 0 0 1 .75-.75Z" opacity={bars >= 1 ? 1 : 0.3} />
    </svg>
  );
};

const CallQualityIndicator: React.FC<{ stats: CallStats }> = ({ stats }) => {
  const getQualityLevel = (stats: CallStats): 'good' | 'average' | 'poor' | 'unknown' => {
    if (stats.roundTripTime === null || stats.jitter === null) {
      return 'unknown';
    }

    const rtt = stats.roundTripTime;
    const jitter = stats.jitter;
    let score = 0;

    if (rtt < 150) score += 2;
    else if (rtt < 400) score += 1;

    if (jitter < 30) score += 2;
    else if (jitter < 100) score += 1;
    
    if (stats.downloadBitrate !== null && stats.downloadBitrate < 100) score -= 1;
    if (stats.uploadBitrate !== null && stats.uploadBitrate < 100) score -= 1;

    if (score >= 4) return 'good';
    if (score >= 2) return 'average';
    return 'poor';
  };
  
  const qualityLevel = getQualityLevel(stats);

  const levelDetails = {
    good: { text: 'Excellent' },
    average: { text: 'Good' },
    poor: { text: 'Poor' },
    unknown: { text: 'Unknown' },
  };

  const { text } = levelDetails[qualityLevel];
  
  const statItem = (label: string, value: number | null, unit: string) => (
    <div className="flex justify-between items-center text-xs">
      <span className="font-semibold">{label}:</span>
      <span>{value !== null ? `${value}${unit}` : 'N/A'}</span>
    </div>
  );
  
  return (
    <div className="group relative flex items-center gap-2 text-sm text-white border-l border-gray-600 pl-3" title={`Call Quality: ${text}`}>
      <SignalBarsIcon level={qualityLevel} className="w-5 h-5" />
      
      <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 p-3 bg-gray-900/90 backdrop-blur-sm border border-gray-700 rounded-lg text-xs text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 font-mono shadow-lg">
        <h4 className="font-bold text-center mb-2 border-b border-gray-700 pb-1 text-white">Connection Details</h4>
        <div className="space-y-1">
          {statItem('RTT', stats.roundTripTime, 'ms')}
          {statItem('Jitter', stats.jitter, 'ms')}
          {statItem('Packet Loss', stats.packetsLost, '')}
          <div className="pt-1 mt-1 border-t border-gray-700"></div>
          {statItem('Upload', stats.uploadBitrate, 'kbps')}
          {statItem('Download', stats.downloadBitrate, 'kbps')}
        </div>
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 border-t border-r border-gray-700 rotate-45 transform -translate-y-1/2"></div>
      </div>
    </div>
  );
};


const FloatingVideo: React.FC<FloatingVideoProps> = ({ stream, callState, connectionState, isE2EEActive, callStats, callDuration, isRemoteMuted, isRemoteVideoOff }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState({ width: 0, height: 0 });
  
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  
  const interactionStartRef = useRef({
      x: 0, y: 0, // mouse position
      posX: 0, posY: 0, // element position
      width: 0, height: 0 // element size
  });

  const { zoom, onTouchStart, onTouchMove, onTouchEnd, isPinching } = usePinchToZoom();
  
  const updateInitialState = useCallback(() => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const safeMargin = 16;

      const initialWidth = Math.min(vw * 0.7, 1280);
      const initialHeight = initialWidth * (9 / 16);

      const initialX = Math.max(safeMargin, (vw - initialWidth) / 2);
      const initialY = Math.max(safeMargin, (vh - initialHeight) / 2);
      
      setSize({ width: initialWidth, height: initialHeight });
      setPosition({ x: initialX, y: initialY });
  }, []);

  useEffect(() => {
    updateInitialState();
    window.addEventListener('resize', updateInitialState);
    return () => window.removeEventListener('resize', updateInitialState);
  }, [updateInitialState]);

  const handlePointerDownDrag = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || (e.target as HTMLElement).dataset.resizeHandle) return;
    
    e.preventDefault();
    setIsDragging(true);
    interactionStartRef.current = { ...interactionStartRef.current, x: e.clientX, y: e.clientY, posX: position.x, posY: position.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [position]);

  const handlePointerDownResize = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    interactionStartRef.current = { ...interactionStartRef.current, x: e.clientX, y: e.clientY, width: size.width, height: size.height };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [size]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging && !isResizing) return;
    e.preventDefault();
    
    if (isDragging) {
      const dx = e.clientX - interactionStartRef.current.x;
      const dy = e.clientY - interactionStartRef.current.y;
      setPosition({ 
        x: interactionStartRef.current.posX + dx, 
        y: interactionStartRef.current.posY + dy
      });
    }
    if (isResizing) {
      const dx = e.clientX - interactionStartRef.current.x;
      
      const newWidth = Math.max(320, interactionStartRef.current.width + dx);
      const newHeight = newWidth * (9 / 16); // Maintain 16:9 aspect ratio

      setSize({ width: newWidth, height: newHeight });
    }
  }, [isDragging, isResizing]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging || isResizing) {
        e.preventDefault();
        setIsDragging(false);
        setIsResizing(false);
        if ((e.target as HTMLElement).hasPointerCapture(e.pointerId)) {
          (e.target as HTMLElement).releasePointerCapture(e.pointerId);
        }
    }
  }, [isDragging, isResizing]);
  
  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDownDrag}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp} // End drag/resize if pointer leaves window
      className="absolute bg-black rounded-lg shadow-2xl border-2 border-indigo-500/50 touch-none overflow-hidden select-none"
      style={{
        width: `${size.width}px`,
        height: `${size.height}px`,
        transform: `translate(${position.x}px, ${position.y}px)`,
        cursor: isDragging ? 'grabbing' : 'grab'
      }}
    >
      <div className="w-full h-full relative" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
        <VideoPlayer 
          ref={videoRef} 
          stream={stream} 
          muted={false} 
          style={{ transform: `scale(${zoom})`, transition: isPinching ? 'none' : 'transform 0.1s linear' }}
        />
        {(isRemoteMuted || isRemoteVideoOff) && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center gap-6 pointer-events-none">
                {isRemoteMuted && <MutedIcon className="w-16 h-16 text-white/90" title="Peer is muted" />}
                {isRemoteVideoOff && <VideoIsOffIcon className="w-16 h-16 text-white/90" title="Peer video is off" />}
            </div>
        )}
      </div>
        <div className="absolute top-3 left-3 z-10 flex items-center gap-4 bg-black/50 backdrop-blur-md p-2 rounded-lg border border-white/10 select-auto pointer-events-auto">
            <ConnectionStatusIndicator callState={callState} connectionState={connectionState} isE2EEActive={isE2EEActive} />
            {callStats && <CallQualityIndicator stats={callStats} />}
            <span className="font-mono text-white text-sm">{formatTime(callDuration)}</span>
        </div>
      <div 
        data-resize-handle="true"
        onPointerDown={handlePointerDownResize}
        className="absolute bottom-0 right-0 w-8 h-8 flex items-end justify-end p-1 cursor-se-resize touch-none z-10"
        title="Resize"
      >
        <ResizeIcon className="w-4 h-4 text-white/40" />
      </div>
    </div>
  );
};

export default FloatingVideo;
