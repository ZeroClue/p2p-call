import React, { useState } from 'react';
import { CallHistoryEntry } from '../types';
import { formatDate, formatTime } from '../utils/format';
import { RejoinIcon, EditIcon, CheckIcon, CancelIcon, PinIcon, PinnedIcon, UserIcon, HistoryIcon, DeleteIcon } from './icons';

interface CallHistoryProps {
  history: CallHistoryEntry[];
  onRejoin: (callId: string) => void;
  onUpdateAlias: (timestamp: number, alias: string) => void;
  onTogglePin: (entry: CallHistoryEntry) => void;
  pinnedIds: Set<string>;
  onDelete: (timestamp: number) => void;
}

const CallHistory: React.FC<CallHistoryProps> = ({ history, onRejoin, onUpdateAlias, onTogglePin, pinnedIds, onDelete }) => {
  const [editingTimestamp, setEditingTimestamp] = useState<number | null>(null);
  const [aliasInput, setAliasInput] = useState('');
  const [animatingPin, setAnimatingPin] = useState<string | null>(null);

  if (history.length === 0) {
    return (
        <div className="w-full text-center py-10 px-4">
            <HistoryIcon className="w-12 h-12 mx-auto text-gray-600" />
            <h3 className="text-lg font-semibold text-gray-300 mt-4">No Recent Calls</h3>
            <p className="text-sm text-gray-500 mt-2">Your call history will appear here after you make a call.</p>
        </div>
    );
  }

  const handleEditClick = (entry: CallHistoryEntry) => {
    setEditingTimestamp(entry.timestamp);
    setAliasInput(entry.alias || '');
  };

  const handleSaveClick = (timestamp: number) => {
    onUpdateAlias(timestamp, aliasInput.trim());
    setEditingTimestamp(null);
    setAliasInput('');
  };

  const handleCancelClick = () => {
    setEditingTimestamp(null);
    setAliasInput('');
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>, timestamp: number) => {
    if (event.key === 'Enter') {
      handleSaveClick(timestamp);
    } else if (event.key === 'Escape') {
      handleCancelClick();
    }
  };

  const handlePinClick = (entry: CallHistoryEntry) => {
    if (!pinnedIds.has(entry.callId)) {
        setAnimatingPin(entry.callId);
        setTimeout(() => setAnimatingPin(null), 400);
    }
    onTogglePin(entry);
  };

  return (
    <div className="w-full">
      <div className="space-y-3 max-h-96 overflow-y-auto pr-2 custom-scrollbar" role="list">
        {history.map((call, index) => {
          const isPinned = pinnedIds.has(call.callId);
          return (
            <div 
              key={`${call.callId}-${call.timestamp}`} 
              className="bg-gray-800/50 p-3 rounded-lg flex items-center justify-between gap-3 min-h-[70px] hover:bg-gray-700/80 transition-colors duration-200 border border-gray-700 animate-fade-in-down"
              style={{ animationDelay: `${index * 50}ms`, opacity: 0 }}
              role="listitem"
            >
              {editingTimestamp === call.timestamp ? (
                <div className="w-full flex items-center gap-2">
                  <input
                    type="text"
                    value={aliasInput}
                    onChange={(e) => setAliasInput(e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, call.timestamp)}
                    placeholder="Enter alias (e.g., Bob)"
                    className="flex-grow px-3 py-1.5 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    autoFocus
                    aria-label="Edit alias for call"
                  />
                  <button
                    onClick={() => handleSaveClick(call.timestamp)}
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
                  <div className="truncate flex-grow flex items-center gap-3">
                    {call.peerId && (
                      <div className="flex-shrink-0" title="This contact can be called directly">
                        <UserIcon className="w-6 h-6 text-indigo-400" />
                      </div>
                    )}
                    <div className="truncate flex-grow">
                      <p className="font-semibold text-base text-gray-100 truncate" title={call.alias || call.callId}>
                        {call.alias || call.callId}
                      </p>
                      <p className="text-xs text-gray-400 truncate">
                        {call.alias && <span className="font-mono">{call.callId} &middot; </span>}
                        {formatDate(call.timestamp)} &middot; {formatTime(call.duration)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                        onClick={() => handlePinClick(call)}
                        className={`p-2 rounded-full transition-colors ${isPinned ? 'text-yellow-400 hover:text-yellow-300' : 'text-gray-400 hover:text-white'} hover:bg-gray-700`}
                        aria-label={isPinned ? `Unpin call with ID ${call.callId}` : `Pin call with ID ${call.callId}`}
                        title={isPinned ? 'Unpin' : 'Pin'}
                    >
                        {isPinned ? <PinnedIcon className="w-5 h-5" /> : <PinIcon className={`w-5 h-5 ${animatingPin === call.callId ? 'animate-pop' : ''}`} />}
                    </button>
                    <button
                      onClick={() => handleEditClick(call)}
                      className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-full transition-colors"
                      aria-label={`Edit alias for call with ID ${call.callId}`}
                      title="Edit alias"
                    >
                      <EditIcon className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => onDelete(call.timestamp)}
                      className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded-full transition-colors"
                      aria-label={`Delete call with ID ${call.callId} from history`}
                      title="Delete from history"
                    >
                      <DeleteIcon className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => onRejoin(call.callId)}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-sm font-semibold whitespace-nowrap flex items-center gap-1.5 transition-colors"
                      aria-label={`Rejoin call with ID ${call.callId}`}
                    >
                      <RejoinIcon className="w-4 h-4" />
                      Rejoin
                    </button>
                  </div>
                </>
              )}
            </div>
        )}
        )}
      </div>
    </div>
  );
};

export default CallHistory;