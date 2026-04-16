import React, { useState } from 'react';
import { CallState, PinnedEntry } from '../types';
import { CheckIcon } from './icons';

interface ConnectionManagerProps {
  callState: CallState;
  connectionState: RTCPeerConnectionState;
  callId: string | null;
  peerId: string | null;
  pinnedContacts: PinnedEntry[];
  onCancel: () => void;
}

const ConnectionManager: React.FC<ConnectionManagerProps> = ({
  callState,
  connectionState,
  callId,
  peerId,
  pinnedContacts,
  onCancel,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopyToClipboard = (text: string | null) => {
    if (!text || copied) return;
    navigator.clipboard.writeText(text).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      (err) => {
        console.error('Could not copy Call ID: ', err);
      },
    );
  };

  const getPeerAlias = () => {
    if (!peerId) return 'peer';
    const contact = pinnedContacts.find((p) => p.peerId === peerId);
    return contact?.alias || peerId.substring(0, 8);
  };

  const renderTitle = () => {
    switch (callState) {
      case CallState.CREATING_OFFER:
        return 'Preparing Your Call...';
      case CallState.WAITING_FOR_ANSWER:
        return 'Your Call is Ready';
      case CallState.RINGING:
        return `Ringing ${getPeerAlias()}...`;
      case CallState.JOINING:
      case CallState.CREATING_ANSWER:
        return 'Joining Call...';
      default:
        return 'Connecting...';
    }
  };

  const renderStatusIndicator = (status: RTCPeerConnectionState) => {
    let color = 'bg-gray-500'; // Default for 'new' or 'closed'
    let text = status.charAt(0).toUpperCase() + status.slice(1);

    switch (status) {
      case 'connecting':
        color = 'bg-yellow-500 animate-pulse';
        text = 'Connecting';
        break;
      case 'connected':
        color = 'bg-green-500';
        text = 'Connected';
        break;
      case 'disconnected':
        color = 'bg-orange-500';
        text = 'Disconnected';
        break;
      case 'failed':
        color = 'bg-red-500';
        text = 'Failed';
        break;
    }

    return (
      <div className="flex items-center justify-center gap-2 mb-4" aria-live="polite">
        <span className={`w-3 h-3 rounded-full ${color}`}></span>
        <span className="text-sm font-medium text-gray-300">Status: {text}</span>
      </div>
    );
  };

  const renderRingingContent = () => (
    <div
      className="flex flex-col items-center justify-center gap-4 text-center"
      role="status"
      aria-live="polite"
    >
      <svg
        className="animate-pulse h-8 w-8 text-indigo-400"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1.5"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z"
        />
      </svg>
      <p className="text-gray-400">Waiting for them to answer...</p>
    </div>
  );

  return (
    <div className="w-full max-w-md bg-gray-800 rounded-lg p-6 shadow-xl space-y-6 flex flex-col justify-between">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-indigo-400">{renderTitle()}</h2>
        {renderStatusIndicator(connectionState)}
      </div>

      {callState === CallState.WAITING_FOR_ANSWER && callId && (
        <div className="space-y-4 text-center">
          <p className="text-gray-300">Share this Call ID with your peer:</p>
          <div className="p-4 bg-gray-900 rounded-lg inline-block">
            <p className="font-mono text-2xl tracking-widest text-teal-300">{callId}</p>
          </div>
          <button
            onClick={() => handleCopyToClipboard(callId)}
            className={`w-full max-w-xs mx-auto px-4 py-2 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors text-sm ${
              copied
                ? 'bg-green-600 text-white cursor-default'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            }`}
            aria-live="polite"
          >
            {copied ? (
              <>
                <CheckIcon className="w-5 h-5" />
                <span>Copied!</span>
              </>
            ) : (
              'Copy Call ID'
            )}
          </button>
          <p className="text-sm text-gray-400 pt-4">Waiting for peer to join...</p>
        </div>
      )}

      {callState === CallState.RINGING && renderRingingContent()}

      {(callState === CallState.JOINING || callState === CallState.CREATING_ANSWER) && (
        <div
          className="flex flex-col items-center justify-center gap-4 text-center"
          role="status"
          aria-live="polite"
        >
          <svg
            className="animate-spin h-8 w-8 text-indigo-400"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          <p className="text-gray-400">Connecting to peer...</p>
        </div>
      )}

      <button
        onClick={onCancel}
        className="mt-auto w-full px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-semibold text-white"
      >
        Cancel
      </button>
    </div>
  );
};

export default ConnectionManager;
