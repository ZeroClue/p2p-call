import React, { forwardRef } from 'react';
import { MuteIcon, UnmuteIcon, VideoOnIcon, VideoOffIcon, HangUpIcon, ChatIcon } from './icons';

interface ControlsProps {
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onHangUp: () => void;
  isMuted: boolean;
  isVideoOff: boolean;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onToggleChat: () => void;
  unreadMessageCount: number;
}

const Controls = forwardRef<HTMLDivElement, ControlsProps>(({ onToggleMute, onToggleVideo, onHangUp, isMuted, isVideoOff, onPointerDown, onToggleChat, unreadMessageCount }, ref) => {
  return (
    <div 
      ref={ref}
      onPointerDown={onPointerDown}
      className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-black/40 backdrop-blur-md p-3 rounded-full shadow-lg cursor-move touch-none border border-white/20"
    >
      <button 
        onClick={onToggleMute} 
        className={`p-3 rounded-full transition-colors ${isMuted ? 'bg-amber-500 hover:bg-amber-600' : 'bg-gray-500/50 hover:bg-gray-500/70'}`}
        aria-label={isMuted ? 'Unmute' : 'Mute'}
        title={isMuted ? 'Unmute' : 'Mute'}
      >
        {isMuted ? <UnmuteIcon className="w-6 h-6 text-white"/> : <MuteIcon className="w-6 h-6 text-white" />}
      </button>
      <button 
        onClick={onToggleVideo} 
        className={`p-3 rounded-full transition-colors ${isVideoOff ? 'bg-amber-500 hover:bg-amber-600' : 'bg-gray-500/50 hover:bg-gray-500/70'}`}
        aria-label={isVideoOff ? 'Turn video on' : 'Turn video off'}
        title={isVideoOff ? 'Turn video on' : 'Turn video off'}
      >
        {isVideoOff ? <VideoOffIcon className="w-6 h-6 text-white"/> : <VideoOnIcon className="w-6 h-6 text-white" />}
      </button>
      <button 
        onClick={onToggleChat} 
        className="p-3 bg-gray-500/50 hover:bg-gray-500/70 rounded-full transition-colors relative"
        aria-label="Toggle chat"
        title="Toggle chat"
      >
        <ChatIcon className="w-6 h-6 text-white" />
        {unreadMessageCount > 0 && (
            <span className="absolute top-0 right-0 block h-3 w-3 rounded-full bg-red-500 ring-2 ring-gray-900" />
        )}
      </button>
      <button 
        onClick={onHangUp} 
        className="p-3 bg-red-600 hover:bg-red-700 rounded-full transition-colors"
        aria-label="Hang up"
        title="Hang up"
      >
        <HangUpIcon className="w-6 h-6 text-white" />
      </button>
    </div>
  );
});

export default Controls;