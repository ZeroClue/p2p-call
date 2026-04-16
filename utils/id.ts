const adjectives = [
  'quick',
  'happy',
  'bright',
  'calm',
  'brave',
  'eager',
  'fancy',
  'giant',
  'jolly',
  'kind',
  'lively',
  'magic',
  'noble',
  'proud',
  'silly',
  'sunny',
  'tiny',
  'wise',
  'zesty',
  'vivid',
];
const nouns = [
  'river',
  'ocean',
  'cloud',
  'forest',
  'meadow',
  'comet',
  'star',
  'dream',
  'wave',
  'glade',
  'haven',
  'light',
  'peak',
  'spirit',
  'storm',
  'stream',
  'world',
  'vista',
  'zephyr',
  'echo',
];
const verbs = [
  'sings',
  'dances',
  'jumps',
  'flies',
  'runs',
  'glows',
  'shines',
  'soars',
  'glides',
  'floats',
  'beams',
  'drifts',
  'wanders',
  'rises',
  'falls',
  'spins',
  'weaves',
  'blooms',
  'thrives',
  'starts',
];

function secureRandomIndex(max: number): number {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return array[0] % max;
}

export const generateCallId = (): string => {
  const adj = adjectives[secureRandomIndex(adjectives.length)];
  const noun = nouns[secureRandomIndex(nouns.length)];
  const verb = verbs[secureRandomIndex(verbs.length)];
  return `${adj}-${noun}-${verb}`;
};

export const generateUUID = (): string => {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};
