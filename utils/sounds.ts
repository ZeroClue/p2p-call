let audioCtx: AudioContext | null = null;
let ringingInterval: ReturnType<typeof setInterval> | null = null;

const initAudioContext = () => {
  if (!audioCtx) {
    try {
      audioCtx = new (
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      )();
    } catch (_e) {
      console.error('Web Audio API is not supported in this browser');
    }
  }
  return audioCtx;
};

// A helper function to play a tone with a simple fade out
const playTone = (freq: number, duration: number, startTime: number = 0) => {
  const ctx = initAudioContext();
  if (!ctx) return;

  // Resume context if it's suspended (autoplay policy)
  if (ctx.state === 'suspended') {
    ctx.resume();
  }

  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(freq, ctx.currentTime);

  const startVol = 0.15;
  gainNode.gain.setValueAtTime(startVol, ctx.currentTime + startTime);
  // Fade out over the last 80% of the tone's duration for a softer sound
  gainNode.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + startTime + duration);

  oscillator.start(ctx.currentTime + startTime);
  oscillator.stop(ctx.currentTime + startTime + duration);
};

export const playIncomingSound = () => {
  playTone(600, 0.15, 0);
  playTone(800, 0.2, 0.2);
};

export const playConnectedSound = () => {
  playTone(523.25, 0.1, 0); // C5
  playTone(659.25, 0.1, 0.1); // E5
  playTone(783.99, 0.15, 0.2); // G5
};

export const playEndedSound = () => {
  playTone(783.99, 0.1, 0);
  playTone(523.25, 0.2, 0.1);
};

export const playRingingSound = () => {
  stopRingingSound(); // Ensure no multiple intervals are running
  const playSequence = () => {
    playTone(600, 0.15, 0);
    playTone(800, 0.2, 0.2);
  };
  playSequence(); // Play immediately
  ringingInterval = setInterval(playSequence, 2000); // Repeat every 2 seconds
};

export const stopRingingSound = () => {
  if (ringingInterval) {
    clearInterval(ringingInterval);
    ringingInterval = null;
  }
};
