import React, { useState } from 'react';
import { getHistory } from '../utils/history';
import { getPinned } from '../utils/pins';
import { CallHistoryEntry, PinnedEntry } from '../types';
import { getUserDisplayName, saveUserDisplayName } from '../utils/user';
import { DownloadIcon, UploadIcon, CheckIcon } from './icons';

interface ToolsProps {
  userId: string | null;
  onRestore: (data: { history: CallHistoryEntry[], pinned: PinnedEntry[] }) => void;
  canInstall: boolean;
  onInstallClick: () => void;
}

const QuestionMarkCircleIcon: React.FC<{className?: string}> = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
    </svg>
);


const Tools: React.FC<ToolsProps> = ({ userId, onRestore, canInstall, onInstallClick }) => {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [feedbackText, setFeedbackText] = useState('');
    const [feedbackSent, setFeedbackSent] = useState(false);
    const [idCopied, setIdCopied] = useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [displayName, setDisplayName] = useState(() => getUserDisplayName() || '');
    const [displayNameSaved, setDisplayNameSaved] = useState(false);

    const handleBackup = () => {
        try {
            const history = getHistory();
            const pinned = getPinned();
            const backupData = JSON.stringify({ history, pinned }, null, 2);
            const blob = new Blob([backupData], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `p2p-call-backup-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error("Backup failed:", err);
            setError("Failed to create backup file.");
        }
    };
    
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setError(null);
        if (event.target.files && event.target.files.length > 0) {
            const file = event.target.files[0];
            if (file.type === 'application/json') {
                setSelectedFile(file);
            } else {
                setError("Invalid file type. Please select a .json file.");
                setSelectedFile(null);
            }
        }
    };

    const handleRestore = () => {
        if (!selectedFile) {
            setError("Please select a file to restore.");
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target?.result;
                if (typeof text !== 'string') {
                    throw new Error("File could not be read.");
                }
                const data = JSON.parse(text);

                // Validate the structure of the backup file
                if (Array.isArray(data.history) && Array.isArray(data.pinned)) {
                    onRestore(data);
                } else {
                    throw new Error("Invalid backup file format.");
                }
            } catch (err) {
                console.error("Restore failed:", err);
                setError(err instanceof Error ? err.message : "An unknown error occurred during restore.");
                setSelectedFile(null);
                if(fileInputRef.current) fileInputRef.current.value = "";
            }
        };
        reader.onerror = () => {
             setError("Failed to read the selected file.");
        }
        reader.readAsText(selectedFile);
    };

    const handleSendFeedback = () => {
        if (!feedbackText.trim()) return;
        
        console.log("--- User Feedback ---");
        console.log(feedbackText.trim());
        console.log("---------------------");

        setFeedbackText('');
        setFeedbackSent(true);
        setTimeout(() => setFeedbackSent(false), 3000);
    };

    const handleCopyUserId = () => {
        if (!userId || idCopied) return;
        navigator.clipboard.writeText(userId).then(() => {
            setIdCopied(true);
            setTimeout(() => setIdCopied(false), 2000);
        });
    };
    
    const handleDisplayNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setDisplayName(e.target.value);
    };

    const handleSaveDisplayName = () => {
        saveUserDisplayName(displayName);
        setDisplayNameSaved(true);
        setTimeout(() => setDisplayNameSaved(false), 2000);
    };

    return (
        <div className="w-full max-w-lg space-y-8">
            <div className="p-6 bg-gray-800/50 rounded-lg border border-gray-700">
                <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-semibold text-gray-200">My User ID</h3>
                    <div className="group relative flex items-center">
                        <QuestionMarkCircleIcon className="w-5 h-5 text-gray-500 cursor-help" />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-gray-900/90 backdrop-blur-sm border border-gray-700 text-gray-200 rounded-lg text-xs text-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                            Share this permanent ID to let others call you directly. Use a temporary Call ID for single-use invitations.
                            <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 border-l border-b border-gray-700 rotate-45 transform -translate-y-1/2"></div>
                        </div>
                    </div>
                </div>
                <p className="text-sm text-gray-400 mb-4">
                    Share this ID with others so they can call you directly.
                </p>
                <div className="flex gap-2">
                    <input
                        type="text"
                        readOnly
                        value={userId || 'Loading...'}
                        className="flex-grow px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm font-mono text-gray-300"
                        aria-label="Your User ID"
                    />
                     <button
                        onClick={handleCopyUserId}
                        className={`w-28 px-4 py-2 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors text-sm text-white ${
                        idCopied
                            ? 'bg-green-600 cursor-default'
                            : 'bg-indigo-600 hover:bg-indigo-700'
                        }`}
                        aria-live="polite"
                    >
                        {idCopied ? (
                        <>
                            <CheckIcon className="w-5 h-5" />
                            <span>Copied!</span>
                        </>
                        ) : (
                        'Copy ID'
                        )}
                    </button>
                </div>
            </div>
            
            <div className="p-6 bg-gray-800/50 rounded-lg border border-gray-700">
                <h3 className="text-lg font-semibold text-gray-200 mb-2">My Display Name</h3>
                <p className="text-sm text-gray-400 mb-4">
                    Set a name that others will see when you call them for the first time.
                </p>
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={displayName}
                        onChange={handleDisplayNameChange}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveDisplayName()}
                        placeholder="Enter your name"
                        className="flex-grow px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        aria-label="Your Display Name"
                    />
                     <button
                        onClick={handleSaveDisplayName}
                        className={`w-28 px-4 py-2 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors text-sm text-white ${
                        displayNameSaved
                            ? 'bg-green-600 cursor-default'
                            : 'bg-indigo-600 hover:bg-indigo-700'
                        }`}
                        aria-live="polite"
                    >
                        {displayNameSaved ? (
                        <>
                            <CheckIcon className="w-5 h-5" />
                            <span>Saved</span>
                        </>
                        ) : (
                        'Save'
                        )}
                    </button>
                </div>
            </div>

            {canInstall && (
                <div className="p-6 bg-gray-800/50 rounded-lg border border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-200 mb-2">Install to Device</h3>
                    <p className="text-sm text-gray-400 mb-4">
                        Add a shortcut to this app on your home screen for quick and easy access.
                    </p>
                    <button
                        onClick={onInstallClick}
                        className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg font-semibold flex items-center justify-center gap-2 transition-transform transform hover:scale-105 text-white"
                    >
                        <DownloadIcon className="w-5 h-5" />
                        Add to Home Screen
                    </button>
                </div>
            )}

            <div className="p-6 bg-gray-800/50 rounded-lg border border-gray-700">
                <h3 className="text-lg font-semibold text-gray-200 mb-2">Backup Data</h3>
                <p className="text-sm text-gray-400 mb-4">
                    Download your call history and pinned contacts as a JSON file.
                </p>
                <button
                    onClick={handleBackup}
                    className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg font-semibold flex items-center justify-center gap-2 text-white"
                >
                    <DownloadIcon className="w-5 h-5" />
                    Download Backup
                </button>
            </div>

            <div className="p-6 bg-gray-800/50 rounded-lg border border-gray-700">
                <h3 className="text-lg font-semibold text-gray-200 mb-2">Restore Data</h3>
                <p className="text-sm text-gray-400 mb-4">
                    Select a backup file to restore your data. This will overwrite current data.
                </p>
                <div className="flex flex-col gap-3">
                     <input
                        ref={fileInputRef}
                        type="file"
                        accept=".json"
                        onChange={handleFileChange}
                        className="block w-full text-sm text-gray-400
                        file:mr-4 file:py-2 file:px-4
                        file:rounded-md file:border-0
                        file:text-sm file:font-semibold
                        file:bg-gray-700 file:text-gray-200
                        hover:file:bg-gray-600"
                        aria-label="Select backup file"
                    />
                    <button
                        onClick={handleRestore}
                        disabled={!selectedFile}
                        className="w-full px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed"
                    >
                        <UploadIcon className="w-5 h-5" />
                        Restore From File
                    </button>
                </div>
                 {error && (
                    <p className="text-red-400 text-sm mt-3" role="alert">
                        {error}
                    </p>
                )}
            </div>

        </div>
    );
};

export default Tools;