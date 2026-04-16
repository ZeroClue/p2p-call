
// ICE Server Configuration
// STUN servers help discover public IP addresses
// TURN servers relay traffic when direct connection fails (useful for restrictive NATs)
export const ICE_SERVERS = {
  iceServers: [
    // Google's public STUN servers
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    // Open Relay Project TURN servers (free, community-run)
    // Note: For production, consider using paid TURN services for better reliability
    // Examples: Twilio, Xirsys, or self-hosted coturn
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
};

// Legacy export for backward compatibility
export const STUN_SERVERS = ICE_SERVERS;
