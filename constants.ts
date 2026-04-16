
// ICE Server Configuration
// STUN servers help discover public IP addresses
// TURN servers relay traffic when direct connection fails (useful for restrictive NATs)

// Build TURN server configuration from environment variables
function buildTurnServers(): Array<{ urls: string; username?: string; credential?: string }> {
  const turnUrl = import.meta.env.VITE_TURN_URL;
  const turnUsername = import.meta.env.VITE_TURN_USERNAME;
  const turnCredential = import.meta.env.VITE_TURN_CREDENTIAL;

  // If TURN credentials are provided via environment variables, use them
  if (turnUrl && turnUsername && turnCredential) {
    return [{ urls: turnUrl, username: turnUsername, credential: turnCredential }];
  }

  // Fallback to Open Relay Project TURN servers for development convenience
  // Note: For production, consider using paid TURN services for better reliability
  // Examples: Twilio, Xirsys, or self-hosted coturn
  return [
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
  ];
}

export const ICE_SERVERS = {
  iceServers: [
    // Google's public STUN servers
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    // TURN servers (from environment variables or fallback)
    ...buildTurnServers(),
  ],
};

// Legacy export for backward compatibility
export const STUN_SERVERS = ICE_SERVERS;
