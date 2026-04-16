import React, { useRef, useEffect } from 'react';
import VideoPlayer from './VideoPlayer';
import { usePinchToZoom } from '../hooks/usePinchToZoom';
import ResolutionSelector from './ResolutionSelector';
import { MuteIcon, UnmuteIcon, VideoOnIcon, VideoOffIcon } from './icons';

interface LobbyProps {
  localStream: MediaStream | null;
  isMuted: boolean;
  isVideoOff: boolean;
  resolution: string;
  onResolutionChange: (resolution: string) => void;
  enableE2EE: boolean;
  onEnableE2EEChange: (enabled: boolean) => void;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}

const Lobby: React.FC<LobbyProps> = ({
  localStream,
  isMuted,
  isVideoOff,
  resolution,
  onResolutionChange,
  enableE2EE,
  onEnableE2EEChange,
  onToggleMute,
  onToggleVideo,
  onConfirm,
  onCancel,
}) => {
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const { zoom, setZoom, resetZoom, isPinching, onTouchStart, onTouchMove, onTouchEnd } =
    usePinchToZoom();
  const lobbyContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = lobbyContainerRef.current;
    if (!container) return;

    // Find all focusable elements within the lobby
    const focusableElements = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );

    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    // Set initial focus on the primary action button ("Join Now")
    const joinButton = Array.from(focusableElements).find((el) =>
      el.textContent?.includes('Join Now'),
    );
    if (joinButton) {
      joinButton.focus();
    } else {
      firstElement.focus();
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;

      if (event.shiftKey) {
        // Handle Shift + Tab
        if (document.activeElement === firstElement) {
          lastElement.focus();
          event.preventDefault();
        }
      } else {
        // Handle Tab
        if (document.activeElement === lastElement) {
          firstElement.focus();
          event.preventDefault();
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);

    // Cleanup function to remove the event listener when the component unmounts
    return () => {
      container.removeEventListener('keydown', handleKeyDown);
    };
  }, [isTouchDevice]); // Rerun if the presence of the slider changes

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setZoom(parseFloat(e.target.value));
  };

  const handleConfirm = () => {
    resetZoom();
    onConfirm();
  };

  const handleCancel = () => {
    resetZoom();
    onCancel();
  };

  return (
    <div
      ref={lobbyContainerRef}
      className="flex flex-col items-center justify-center w-full max-w-4xl p-4 md:p-8 animate-fade-in"
    >
      <style>{`
            .desktop-instruction { display: block; }
            .touch-instruction { display: none; }
            @media (pointer: coarse) {
                .desktop-instruction { display: none; }
                .touch-instruction { display: block; }
            }
            /* Custom styles for vertical range input */
            .zoom-slider {
              -webkit-appearance: none;
              appearance: none;
              width: 120px;
              height: 4px;
              background: rgba(55, 65, 81, 0.7); /* gray-600 */
              border-radius: 2px;
              outline: none;
              transform: rotate(-90deg);
              transform-origin: 60px 60px;
            }
            .zoom-slider::-webkit-slider-thumb {
              -webkit-appearance: none;
              appearance: none;
              width: 20px;
              height: 20px;
              background: white;
              border: 2px solid #6366f1; /* indigo-500 */
              border-radius: 50%;
              cursor: ns-resize;
            }
            .zoom-slider::-moz-range-thumb {
              width: 18px;
              height: 18px;
              background: white;
              border: 2px solid #6366f1; /* indigo-500 */
              border-radius: 50%;
              cursor: ns-resize;
            }
        `}</style>
      <h1 className="text-3xl md:text-4xl font-bold text-white mb-2 text-center">Ready to join?</h1>
      <p className="text-gray-400 mb-2 text-center">
        Check your camera and microphone before starting.
      </p>
      <p className="desktop-instruction text-gray-400 text-sm mb-4 text-center">
        Use the slider to adjust your video zoom.
      </p>
      <p className="touch-instruction text-gray-400 text-sm mb-4 text-center">
        Use two fingers to pinch and zoom the video.
      </p>

      <div className="w-full flex justify-center items-center mb-6">
        <div className="relative">
          <div
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            className="w-full max-w-xl aspect-video rounded-xl overflow-hidden bg-gray-800 shadow-lg ring-2 ring-offset-4 ring-offset-gray-950 ring-indigo-500 relative cursor-grab touch-none"
          >
            <VideoPlayer
              stream={localStream}
              muted={true}
              style={{
                transform: `scale(${zoom})`,
                transition: isPinching ? 'none' : 'transform 0.1s linear',
              }}
            />
            {zoom > 1.05 && (
              <div
                className="absolute top-2 right-2 bg-black/60 text-white text-xs font-mono px-2 py-1 rounded-full pointer-events-none"
                aria-live="polite"
              >
                {zoom.toFixed(1)}x
              </div>
            )}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3">
              <button
                onClick={onToggleMute}
                className={`p-3 rounded-full transition-colors ${isMuted ? 'bg-amber-500 hover:bg-amber-600' : 'bg-gray-800/60 hover:bg-gray-700/80 backdrop-blur-sm'}`}
                aria-label={isMuted ? 'Unmute' : 'Mute'}
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? (
                  <UnmuteIcon className="w-6 h-6 text-white" />
                ) : (
                  <MuteIcon className="w-6 h-6 text-white" />
                )}
              </button>
              <button
                onClick={onToggleVideo}
                className={`p-3 rounded-full transition-colors ${isVideoOff ? 'bg-amber-500 hover:bg-amber-600' : 'bg-gray-800/60 hover:bg-gray-700/80 backdrop-blur-sm'}`}
                aria-label={isVideoOff ? 'Turn video on' : 'Turn video off'}
                title={isVideoOff ? 'Turn video on' : 'Turn video off'}
              >
                {isVideoOff ? (
                  <VideoOffIcon className="w-6 h-6 text-white" />
                ) : (
                  <VideoOnIcon className="w-6 h-6 text-white" />
                )}
              </button>
            </div>
          </div>
          {!isTouchDevice && (
            <div className="absolute top-1/2 -translate-y-1/2 left-full ml-8 h-48 flex items-center justify-center">
              <input
                type="range"
                min="1"
                max="4"
                step="0.1"
                value={zoom}
                onChange={handleSliderChange}
                className="zoom-slider"
                aria-label="Video zoom"
              />
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 sm:gap-8 items-center justify-center mb-6">
        <ResolutionSelector resolution={resolution} onResolutionChange={onResolutionChange} />
        <div className="flex items-center justify-center">
          <label htmlFor="e2ee-toggle" className="flex items-center cursor-pointer select-none">
            <div className="relative">
              <input
                type="checkbox"
                id="e2ee-toggle"
                className="sr-only peer"
                checked={enableE2EE}
                onChange={(e) => onEnableE2EEChange(e.target.checked)}
              />
              <div className="w-14 h-8 bg-gray-600 rounded-full peer-checked:bg-indigo-600 transition-colors"></div>
              <div className="absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform peer-checked:translate-x-6"></div>
            </div>
            <div className="ml-3 text-white font-medium">E2EE</div>
          </label>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4 w-full max-w-md">
        <button
          onClick={handleCancel}
          className="w-full px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-semibold transition-colors order-2 sm:order-1"
        >
          Back
        </button>
        <button
          onClick={handleConfirm}
          className="w-full px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition-transform transform hover:scale-105 order-1 sm:order-2 shadow-lg"
        >
          Join Now
        </button>
      </div>
      <style>{`
            @keyframes fade-in {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            .animate-fade-in {
                animation: fade-in 0.3s ease-out forwards;
            }
        `}</style>
    </div>
  );
};

export default Lobby;
