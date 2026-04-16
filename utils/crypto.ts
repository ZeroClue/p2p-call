// The IV length for AES-GCM, 12 bytes is recommended.
const IV_LENGTH = 12;

/**
 * Generates a new AES-GCM CryptoKey and exports it as raw bytes.
 * This allows the key to be securely shared between peers.
 * @returns A promise that resolves to an object containing the CryptoKey and its raw ArrayBuffer representation.
 */
export const generateKey = async (): Promise<{ key: CryptoKey; rawKey: ArrayBuffer }> => {
  const key = await window.crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256,
    },
    true, // The key is extractable
    ['encrypt', 'decrypt'],
  );
  const rawKey = await window.crypto.subtle.exportKey('raw', key);
  return { key, rawKey };
};

/**
 * Imports a raw key buffer into a CryptoKey object for use in encryption/decryption.
 * @param rawKey The ArrayBuffer containing the raw key data.
 * @returns A promise that resolves to the imported CryptoKey.
 */
export const importKey = (rawKey: ArrayBuffer): Promise<CryptoKey> => {
  return window.crypto.subtle.importKey(
    'raw',
    rawKey,
    {
      name: 'AES-GCM',
    },
    true,
    ['encrypt', 'decrypt'],
  );
};

// A counter to generate a unique Initialization Vector (IV) for each frame.
// Using a counter is a standard and secure practice with AES-GCM.
let encryptionCounter = 0;

function getIv(): ArrayBuffer {
  const iv = new ArrayBuffer(IV_LENGTH);
  const ivView = new DataView(iv);
  // A 64-bit counter is sufficient, but we write a 32-bit value for simplicity.
  ivView.setUint32(8, encryptionCounter++);
  return iv;
}

/**
 * Creates a TransformStream for encrypting RTCEncodedFrames.
 * @param key The CryptoKey to use for encryption.
 */
const createEncryptionTransform = (key: CryptoKey): TransformStream => {
  return new TransformStream({
    async transform(encodedFrame, controller) {
      const iv = getIv();
      try {
        const encryptedData = await window.crypto.subtle.encrypt(
          { name: 'AES-GCM', iv },
          key,
          encodedFrame.data,
        );

        // Prepend the IV to the encrypted data for the receiver to use.
        const newData = new Uint8Array(iv.byteLength + encryptedData.byteLength);
        newData.set(new Uint8Array(iv), 0);
        newData.set(new Uint8Array(encryptedData), iv.byteLength);

        encodedFrame.data = newData.buffer;
        controller.enqueue(encodedFrame);
      } catch (e) {
        console.error('Encryption failed:', e);
      }
    },
  });
};

/**
 * Creates a TransformStream for decrypting RTCEncodedFrames.
 * @param key The CryptoKey to use for decryption.
 */
const createDecryptionTransform = (key: CryptoKey): TransformStream => {
  return new TransformStream({
    async transform(encodedFrame, controller) {
      try {
        const encryptedData = new Uint8Array(encodedFrame.data);
        const iv = encryptedData.slice(0, IV_LENGTH);
        const data = encryptedData.slice(IV_LENGTH);

        const decryptedData = await window.crypto.subtle.decrypt(
          { name: 'AES-GCM', iv },
          key,
          data,
        );

        encodedFrame.data = decryptedData;
        controller.enqueue(encodedFrame);
      } catch (e) {
        // Log decryption errors but don't re-throw, effectively dropping the frame.
        console.error('Decryption failed:', e);
      }
    },
  });
};

/**
 * Sets up E2EE on an RTCPeerConnection by attaching transform streams.
 * Can be called multiple times; it will only set up transforms once per sender/receiver.
 * @param pc The RTCPeerConnection instance.
 * @param key The shared CryptoKey.
 * @returns A boolean indicating if the setup was successful.
 */
export const setupE2EE = (pc: RTCPeerConnection, key: CryptoKey): boolean => {
  // Check for browser support for Insertable Streams.
  if (!('createEncodedStreams' in RTCRtpSender.prototype)) {
    console.warn('Insertable streams are not supported in this browser. E2EE will not be enabled.');
    return false;
  }

  let isSetup = false;
  // Set up encryption for all outgoing media streams.
  pc.getSenders().forEach((sender) => {
    const s = sender as RTCRtpSender & {
      _e2eeTransform?: boolean;
      createEncodedStreams?: () => { readable: ReadableStream; writable: WritableStream };
    };
    if (sender.track && !s._e2eeTransform) {
      const transform = createEncryptionTransform(key);
      const streams = s.createEncodedStreams!();
      streams.readable.pipeThrough(transform).pipeTo(streams.writable);
      s._e2eeTransform = true;
      isSetup = true;
    }
  });

  // Set up decryption for all incoming media streams.
  pc.getReceivers().forEach((receiver) => {
    const r = receiver as RTCRtpReceiver & {
      _e2eeTransform?: boolean;
      createEncodedStreams?: () => { readable: ReadableStream; writable: WritableStream };
    };
    if (receiver.track && !r._e2eeTransform) {
      const transform = createDecryptionTransform(key);
      const streams = r.createEncodedStreams!();
      streams.readable.pipeThrough(transform).pipeTo(streams.writable);
      r._e2eeTransform = true;
      isSetup = true;
    }
  });

  if (isSetup) {
    console.log('End-to-end encryption transforms have been set up.');
  }

  return isSetup;
};
