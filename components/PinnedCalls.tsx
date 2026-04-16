import React, { useState } from 'react';
import { PinnedEntry, PeerStatus } from '../types';
import { formatTimeAgo } from '../utils/format';
import { CallIcon, EditIcon, CheckIcon, CancelIcon, PinnedIcon } from './icons';

interface PinnedCallsProps {
  pins: PinnedEntry[];
  peerStatus: { [key: string]: PeerStatus };
  onCall: (pin: PinnedEntry) => void;
  onUpdateAlias: (callId: string, alias: string) => void;
  onUnpin: (callId: string) => void;
}

const PinEmptyIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    className={className}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z"
    />
  </svg>
);

const PinnedCalls: React.FC<PinnedCallsProps> = ({
  pins,
  peerStatus,
  onCall,
  onUpdateAlias,
  onUnpin,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [aliasInput, setAliasInput] = useState('');

  if (pins.length === 0) {
    return (
      <div className="w-full text-center py-10 px-4">
        <PinEmptyIcon className="w-12 h-12 mx-auto text-gray-600" />
        <h3 className="text-lg font-semibold text-gray-300 mt-4">No Pinned Calls</h3>
        <p className="text-sm text-gray-500 mt-2">
          You can pin calls from your "Recent" list to add them here.
        </p>
      </div>
    );
  }

  const handleEditClick = (pin: PinnedEntry) => {
    setEditingId(pin.callId);
    setAliasInput(pin.alias || '');
  };

  const handleSaveClick = (callId: string) => {
    onUpdateAlias(callId, aliasInput.trim());
    setEditingId(null);
    setAliasInput('');
  };

  const handleCancelClick = () => {
    setEditingId(null);
    setAliasInput('');
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>, callId: string) => {
    if (event.key === 'Enter') {
      handleSaveClick(callId);
    } else if (event.key === 'Escape') {
      handleCancelClick();
    }
  };

  return (
    <div className="w-full space-y-3 max-h-96 overflow-y-auto pr-2 custom-scrollbar" role="list">
      {pins.map((pin, index) => {
        const status = pin.peerId ? peerStatus[pin.peerId] : undefined;
        const isOnline = status?.isOnline === true;
        const canCallDirectly = !!pin.peerId;
        const isButtonDisabled = canCallDirectly && !isOnline;

        return (
          <div
            key={pin.callId}
            className="bg-slate-800 p-3 rounded-lg flex items-center justify-between gap-3 min-h-[70px] transition-colors duration-200 animate-fade-in-down"
            style={{ animationDelay: `${index * 50}ms`, opacity: 0 }}
            role="listitem"
          >
            {editingId === pin.callId ? (
              <div className="w-full flex items-center gap-2">
                <input
                  type="text"
                  value={aliasInput}
                  onChange={(e) => setAliasInput(e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, pin.callId)}
                  placeholder="Enter alias..."
                  className="flex-grow px-3 py-1.5 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  autoFocus
                  aria-label="Edit alias for pinned call"
                />
                <button
                  onClick={() => handleSaveClick(pin.callId)}
                  className="p-2 bg-green-600 hover:bg-green-700 rounded-md transition-colors flex-shrink-0"
                  aria-label="Save alias"
                  title="Save"
                >
                  <CheckIcon className="w-4 h-4 text-white" />
                </button>
                <button
                  onClick={handleCancelClick}
                  className="p-2 bg-gray-600 hover:bg-gray-500 rounded-md transition-colors flex-shrink-0"
                  aria-label="Cancel editing alias"
                  title="Cancel"
                >
                  <CancelIcon className="w-4 h-4 text-white" />
                </button>
              </div>
            ) : (
              <>
                <div className="truncate flex-grow">
                  <p
                    className="font-semibold text-base text-gray-100 truncate"
                    title={pin.alias || pin.callId}
                  >
                    {pin.alias || pin.callId}
                  </p>
                  {canCallDirectly &&
                    (status ? (
                      <div
                        className="group relative text-xs flex items-center gap-1.5"
                        tabIndex={0}
                        aria-label={
                          isOnline
                            ? 'User is online'
                            : `User is offline. Last seen ${formatTimeAgo(status.lastChanged)}`
                        }
                      >
                        <span
                          className={`flex h-2 w-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-gray-500'}`}
                        ></span>
                        <span
                          className={`font-medium ${isOnline ? 'text-green-400' : 'text-gray-400'}`}
                        >
                          {isOnline ? 'Online' : 'Offline'}
                        </span>
                      </div>
                    ) : (
                      <div className="text-xs flex items-center gap-1.5" title="Status unknown">
                        <span className="flex h-2 w-2 rounded-full bg-gray-500"></span>
                        <span className="font-medium text-gray-500">Unknown</span>
                      </div>
                    ))}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => onUnpin(pin.callId)}
                    className="p-2 text-yellow-400 hover:text-yellow-300 rounded-full transition-colors"
                    aria-label={`Unpin call with ID ${pin.callId}`}
                    title="Unpin"
                  >
                    <PinnedIcon className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleEditClick(pin)}
                    className="p-2 text-gray-400 hover:text-white rounded-full transition-colors"
                    aria-label={`Edit alias for pinned call with ID ${pin.callId}`}
                    title="Edit alias"
                  >
                    <EditIcon className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => onCall(pin)}
                    disabled={isButtonDisabled}
                    className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 rounded-lg text-sm font-semibold text-white whitespace-nowrap flex items-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label={`Call ${pin.alias || pin.callId}`}
                    title={
                      isButtonDisabled
                        ? 'User is offline'
                        : pin.peerId
                          ? `Call ${pin.alias || 'user'}`
                          : `Rejoin call room`
                    }
                  >
                    <CallIcon className="w-4 h-4" />
                    {pin.peerId ? 'Call' : 'Rejoin'}
                  </button>
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default PinnedCalls;
