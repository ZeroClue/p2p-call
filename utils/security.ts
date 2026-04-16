/**
 * Enforces HTTPS in production environments
 * WebRTC requires HTTPS for getUserMedia API in production
 */
export const enforceHTTPS = () => {
  // Allow localhost for development
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return;
  }

  // Redirect to HTTPS if not already on it
  if (window.location.protocol !== 'https:') {
    console.warn('Redirecting to HTTPS for secure WebRTC connection');
    window.location.href =
      'https:' + window.location.href.substring(window.location.protocol.length);
  }
};

/**
 * Checks if the browser supports required WebRTC features
 */
export const checkWebRTCSupport = (): { supported: boolean; missingFeatures: string[] } => {
  const missingFeatures: string[] = [];

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    missingFeatures.push('getUserMedia');
  }

  if (!window.RTCPeerConnection) {
    missingFeatures.push('RTCPeerConnection');
  }

  if (!window.RTCSessionDescription) {
    missingFeatures.push('RTCSessionDescription');
  }

  if (!window.RTCIceCandidate) {
    missingFeatures.push('RTCIceCandidate');
  }

  return {
    supported: missingFeatures.length === 0,
    missingFeatures,
  };
};

/**
 * Checks if Insertable Streams (E2EE) is supported
 */
export const checkE2EESupport = (): boolean => {
  return 'createEncodedStreams' in RTCRtpSender.prototype;
};
