import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useWebRTC } from './hooks/useWebRTC';
import { useAuth } from './hooks/useAuth';
import { useCallHistory } from './hooks/useCallHistory';
import { useIncomingCall } from './hooks/useIncomingCall';
import { useCallNotifications } from './hooks/useCallNotifications';
import { CallState, CallHistoryEntry, PinnedEntry, CallStats, IncomingCall, PeerStatus, ChatMessage } from './types';
import VideoPlayer from './components/VideoPlayer';
import Controls from './components/Controls';
import ConnectionManager from './components/ConnectionManager';
import CallHistory from './components/CallHistory';
import PinnedCalls from './components/PinnedCalls';
import Tools from './components/Tools';
import About from './components/About';
import IncomingCallScreen from './components/IncomingCall';
import Lobby from './components/Lobby';
import MediaErrorScreen from './components/MediaErrorScreen';
import ChatPanel from './components/ChatPanel';
import FloatingVideo from './components/FloatingVideo';
import LocalVideoPreview from './components/LocalVideoPreview';
import { getUserId } from './utils/user';
import { useDraggable } from './hooks/useDraggable';
import { usePresence } from './hooks/usePresence';
import { usePeerStatus } from './hooks/usePeerStatus';

const App: React.FC = () => {
    const { isAuthenticated, isAuthenticating, authError } = useAuth();
    const [userId] = useState(getUserId());
    const [activeTab, setActiveTab] = useState<'new' | 'recent' | 'pinned' | 'tools' | 'about'>('new');
    const [joinInput, setJoinInput] = useState('');
    const [joinInputError, setJoinInputError] = useState<string | null>(null);
    const [installPrompt, setInstallPrompt] = useState<any>(null);
    const [peerToRing, setPeerToRing] = useState<PinnedEntry | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isChatVisible, setIsChatVisible] = useState(false);
    const [unreadMessageCount, setUnreadMessageCount] = useState(0);

    const {
        localStream, remoteStream, connectionState, isMuted, isVideoOff, callState, setCallState,
        errorMessage, callId, peerId, isE2EEActive, callStats, resolution, setResolution,
        isRemoteMuted, isRemoteVideoOff,
        enableE2EE, setEnableE2EE,
        enterLobby, startCall, joinCall, ringUser, declineCall, toggleMute, toggleVideo, hangUp, reset,
        setOnChatMessage, sendMessage,
    } = useWebRTC('720p');

    const callHistory = useCallHistory();
    const { history, pinned } = callHistory;

    const incomingCallHook = useIncomingCall(userId, callState, setCallState);
    const { incomingCall, handleAcceptCall: handleAcceptCallIncoming, handleDeclineCall: handleDeclineCallIncoming } = incomingCallHook;

    const notifications = useCallNotifications(callState, callId, peerId, pinned, history, callHistory.addHistoryEntry);
    const { callDuration } = notifications;

    usePresence(userId);
    const peerIdsToWatch = useMemo(() => pinned.map(p => p.peerId).filter((id): id is string => !!id), [pinned]);
    const peerStatus = usePeerStatus(peerIdsToWatch);

    const controlsRef = useRef<HTMLDivElement>(null);
    const { onPointerDown: onControlsPointerDown } = useDraggable(controlsRef);

    const validateCallId = useCallback((id: string): boolean => {
        const trimmedId = id.trim();
        if (!trimmedId) {
            setJoinInputError(null);
            return true;
        }
        const pattern = /^[a-z]+-[a-z]+-[a-z]+$/;
        if (!pattern.test(trimmedId)) {
            setJoinInputError('Invalid format. Expected: word-word-word');
            return false;
        }
        setJoinInputError(null);
        return true;
    }, []);

    useEffect(() => {
        const handler = (e: Event) => {
            e.preventDefault();
            setInstallPrompt(e);
        };
        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    useEffect(() => {
        if (callState === CallState.CONNECTED) {
            setOnChatMessage(
                (data: string) => {
                    setMessages(prev => [...prev, { text: data, sender: 'peer', timestamp: Date.now() }]);
                    if (!isChatVisible) {
                        setUnreadMessageCount(prev => prev + 1);
                    }
                }
            );
        }
    }, [callState, isChatVisible, setOnChatMessage]);

    useEffect(() => {
        if (callState === CallState.ENDED || callState === CallState.IDLE || callState === CallState.DECLINED) {
            setMessages([]);
            setIsChatVisible(false);
            setUnreadMessageCount(0);
        }
    }, [callState]);

    const handleSendMessage = useCallback((text: string) => {
        sendMessage(text);
        setMessages(prev => [...prev, { text, sender: 'me', timestamp: Date.now() }]);
    }, [sendMessage]);

    const handleToggleChat = useCallback(() => {
        setIsChatVisible(isCurrentlyVisible => {
            if (!isCurrentlyVisible) {
                setUnreadMessageCount(0);
            }
            return !isCurrentlyVisible;
        });
    }, []);

    const handleJoin = useCallback((id: string) => {
        if (!id.trim()) return;
        joinCall(id.trim());
    }, [joinCall]);

    const handleRejoin = useCallback((id: string) => {
        setJoinInput(id);
        setJoinInputError(null);
        enterLobby();
    }, [enterLobby]);

    const handleCreateCall = useCallback(() => {
        startCall();
    }, [startCall]);

    const handleCallPinned = useCallback((pin: PinnedEntry) => {
        if (pin.peerId) {
            setPeerToRing(pin);
            enterLobby();
        } else {
            setJoinInput(pin.callId);
            setJoinInputError(null);
            enterLobby();
        }
    }, [enterLobby]);

    const handleAcceptCall = useCallback(() => {
        handleAcceptCallIncoming(joinCall);
    }, [handleAcceptCallIncoming, joinCall]);

    const handleDeclineCall = useCallback(() => {
        handleDeclineCallIncoming(declineCall, reset);
    }, [handleDeclineCallIncoming, declineCall, reset]);

    const handleHangUp = useCallback(() => {
        hangUp();
    }, [hangUp]);

    const handleCancelConnecting = useCallback(() => {
        if (callState === CallState.RINGING && callId && peerId) {
            declineCall(callId, peerId);
        } else {
            if(callId) declineCall(callId);
        }
        reset();
    }, [callState, callId, peerId, declineCall, reset]);

    const handleLobbyConfirm = useCallback(() => {
        if (peerToRing) {
            ringUser(peerToRing);
            setPeerToRing(null);
        } else if (incomingCall) {
            handleAcceptCall();
        } else if (joinInput) {
            handleJoin(joinInput);
        } else {
            handleCreateCall();
        }
    }, [peerToRing, ringUser, incomingCall, joinInput, handleAcceptCall, handleJoin, handleCreateCall]);

    const handleLobbyCancel = useCallback(() => {
        setPeerToRing(null);
        reset();
    }, [reset]);

    const handleInstallClick = useCallback(() => {
        if (installPrompt) {
            installPrompt.prompt();
        }
    }, [installPrompt]);

    const callerDisplayName = useMemo(() => {
        if (!incomingCall) return 'Someone';
        const pinnedContact = pinned.find(p => p.peerId === incomingCall.from);
        if (pinnedContact?.alias) return pinnedContact.alias;
        const historyContact = history.find(h => h.peerId === incomingCall.from);
        if (historyContact?.alias) return historyContact.alias;
        return incomingCall.callerAlias || incomingCall.from.substring(0, 8);
    }, [incomingCall, pinned, history]);

    const isConnecting = [CallState.CREATING_OFFER, CallState.WAITING_FOR_ANSWER, CallState.RINGING, CallState.JOINING, CallState.CREATING_ANSWER].includes(callState);
    const showMainPage = [CallState.IDLE, CallState.ENDED, CallState.DECLINED].includes(callState);

    const tabs: { id: 'new' | 'recent' | 'pinned' | 'tools' | 'about', label: string }[] = [
        { id: 'new', label: 'New Call' },
        { id: 'recent', label: 'Recent' },
        { id: 'pinned', label: 'Pinned' },
        { id: 'tools', label: 'Tools' },
        { id: 'about', label: 'About' },
    ];

    const handleStartNewCallFlow = useCallback(() => {
        setJoinInput('');
        setJoinInputError(null);
        enterLobby();
    }, [enterLobby]);

    const handleAttemptJoin = useCallback(() => {
        const trimmedId = joinInput.trim();
        if (!trimmedId) {
            setJoinInputError('Call ID cannot be empty.');
            return;
        }
        if (validateCallId(trimmedId)) {
            enterLobby();
        }
    }, [joinInput, enterLobby, validateCallId]);

    const handleJoinInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setJoinInput(value);
        validateCallId(value);
    }, [validateCallId]);

    const renderTabContent = () => {
        switch(activeTab) {
            case 'new':
                return (
                    <div className="w-full max-w-lg mx-auto flex flex-col items-center gap-4 p-4">
                        <button
                            onClick={handleStartNewCallFlow}
                            className="w-full px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition-transform transform hover:scale-105 shadow-lg"
                        >
                            Start a New Call
                        </button>

                        <div className="w-full flex items-center">
                            <div className="flex-grow border-t border-gray-700"></div>
                            <span className="flex-shrink mx-4 text-gray-500 text-sm font-semibold">OR</span>
                            <div className="flex-grow border-t border-gray-700"></div>
                        </div>

                        <div className="w-full flex flex-col sm:flex-row gap-3">
                            <div className="flex-grow w-full">
                                <input
                                    type="text"
                                    value={joinInput}
                                    onChange={handleJoinInputChange}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAttemptJoin()}
                                    placeholder="Enter Call ID to join"
                                    className={`flex-grow w-full px-4 py-3 bg-gray-800/50 border-2 rounded-lg focus:outline-none focus:ring-2 focus:border-purple-500 transition-all ${
                                        joinInputError ? 'border-red-500 focus:ring-red-500' : 'border-gray-700 focus:ring-purple-500'
                                    }`}
                                    aria-invalid={!!joinInputError}
                                    aria-describedby="call-id-error"
                                />
                                {joinInputError && (
                                    <p id="call-id-error" className="text-red-400 text-sm mt-1.5" role="alert">
                                        {joinInputError}
                                    </p>
                                )}
                            </div>
                            <button
                                onClick={handleAttemptJoin}
                                disabled={!joinInput.trim() || !!joinInputError}
                                className="w-full sm:w-auto px-6 py-3 bg-teal-500 hover:bg-teal-600 text-white rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
                            >
                                Join Call
                            </button>
                        </div>
                    </div>
                );
            case 'recent':
                return <CallHistory history={history} onRejoin={handleRejoin} onUpdateAlias={callHistory.updateHistoryAlias} onTogglePin={callHistory.togglePin} pinnedIds={new Set(pinned.map(p => p.callId))} onDelete={callHistory.deleteHistory} />;
            case 'pinned':
                return <PinnedCalls pins={pinned} peerStatus={peerStatus} onCall={handleCallPinned} onUpdateAlias={callHistory.updatePinAlias} onUnpin={callHistory.unpin} />;
            case 'tools':
                return <Tools userId={userId} onRestore={callHistory.restoreData} canInstall={!!installPrompt} onInstallClick={handleInstallClick} />;
            case 'about':
                return <About />;
        }
    };

    // Show loading screen while authenticating
    if (isAuthenticating) {
        return (
            <div className="min-h-screen text-slate-200 flex items-center justify-center">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mb-4"></div>
                    <p className="text-lg text-gray-400">Initializing secure connection...</p>
                </div>
            </div>
        );
    }

    // Show error screen if authentication failed
    if (authError) {
        const isConfigError = authError.includes('Anonymous authentication is not enabled');

        return (
            <div className="min-h-screen text-slate-200 flex items-center justify-center p-4">
                <div className="max-w-lg w-full bg-red-900/20 border border-red-500/50 rounded-lg p-8">
                    <div className="text-center mb-6">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-red-500/20 rounded-full mb-4">
                            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-bold text-red-400 mb-2">Authentication Required</h2>
                    </div>

                    <p className="text-gray-300 mb-6 text-left">{authError}</p>

                    {isConfigError && (
                        <div className="bg-gray-900/50 rounded-lg p-4 mb-6 text-left">
                            <p className="text-sm text-gray-400 mb-3 font-semibold">How to fix:</p>
                            <ol className="text-sm text-gray-300 space-y-2 list-decimal list-inside">
                                <li>Go to <a href="https://console.firebase.google.com" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 underline">Firebase Console</a></li>
                                <li>Select your project</li>
                                <li>Navigate to <strong>Authentication</strong> → <strong>Sign-in method</strong></li>
                                <li>Enable <strong>Anonymous</strong> authentication</li>
                                <li>Return here and click Retry</li>
                            </ol>
                        </div>
                    )}

                    <div className="flex gap-3 justify-center">
                        {isConfigError && (
                            <a
                                href="https://console.firebase.google.com"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition font-medium"
                            >
                                Open Firebase Console
                            </a>
                        )}
                        <button
                            onClick={() => window.location.reload()}
                            className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition font-medium"
                        >
                            Retry
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen text-slate-200">
            {showMainPage && (
                <div className="relative container mx-auto px-4 py-8 md:py-16 flex flex-col items-center gap-10">
                    <div className="text-center">
                        <h1 className="text-5xl md:text-6xl font-extrabold text-white">Simple, Secure Video Calls</h1>
                        <p className="text-gray-400 mt-2">Connect directly with anyone, anywhere. No accounts, no tracking, just a private peer-to-peer connection.</p>
                    </div>

                    <div className="w-full max-w-2xl mt-8 relative glass-container-glow">
                        <div className="relative glass-card-background backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden">
                            <div className="border-b border-gray-200/10 px-4 md:px-8">
                                <nav className="-mb-px flex space-x-6 justify-center" aria-label="Tabs">
                                    {tabs.map(tab => (
                                        <button
                                            key={tab.id}
                                            onClick={() => setActiveTab(tab.id)}
                                            className={`${
                                                activeTab === tab.id
                                                ? 'border-indigo-400 text-slate-100'
                                                : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'
                                            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors focus:outline-none`}
                                            aria-current={activeTab === tab.id ? 'page' : undefined}
                                        >
                                            {tab.label}
                                        </button>
                                    ))}
                                </nav>
                            </div>
                            <div className="min-h-[20rem] p-4 md:p-8 flex justify-center">
                                {renderTabContent()}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {callState === CallState.MEDIA_ERROR && <MediaErrorScreen errorMessage={errorMessage} onRetry={reset} />}
            {callState === CallState.INCOMING_CALL && incomingCall && <IncomingCallScreen callInfo={incomingCall} callerDisplayName={callerDisplayName} onAccept={() => enterLobby()} onDecline={handleDeclineCall} />}
            {callState === CallState.LOBBY && (
                <div className="w-full h-screen flex items-center justify-center p-4">
                    <Lobby localStream={localStream} isMuted={isMuted} isVideoOff={isVideoOff} onToggleMute={toggleMute} onToggleVideo={toggleVideo} onConfirm={handleLobbyConfirm} onCancel={handleLobbyCancel} resolution={resolution} onResolutionChange={setResolution} enableE2EE={enableE2EE} onEnableE2EEChange={setEnableE2EE} />
                </div>
            )}

            {isConnecting && (
                <div className="absolute inset-0 bg-gray-950/90 backdrop-blur-md flex items-center justify-center z-20">
                    <ConnectionManager callState={callState} connectionState={connectionState} callId={callId} peerId={peerId} pinnedContacts={pinned} onCancel={handleCancelConnecting} />
                </div>
            )}
            {(callState === CallState.CONNECTED || callState === CallState.RECONNECTING) && (
                <div className="absolute inset-0 bg-black/70 backdrop-blur-sm overflow-hidden">
                    <FloatingVideo
                        stream={remoteStream}
                        callState={callState}
                        connectionState={connectionState}
                        isE2EEActive={isE2EEActive}
                        callStats={callStats}
                        callDuration={callDuration}
                        isRemoteMuted={isRemoteMuted}
                        isRemoteVideoOff={isRemoteVideoOff}
                    />
                    <LocalVideoPreview
                        stream={localStream}
                        isMuted={isMuted}
                        isVideoOff={isVideoOff}
                    />
                    <Controls ref={controlsRef} onPointerDown={onControlsPointerDown} onToggleMute={toggleMute} onToggleVideo={toggleVideo} onHangUp={handleHangUp} isMuted={isMuted} isVideoOff={isVideoOff} onToggleChat={handleToggleChat} unreadMessageCount={unreadMessageCount} />
                    <ChatPanel
                        isVisible={isChatVisible}
                        messages={messages}
                        onSendMessage={handleSendMessage}
                        onClose={() => setIsChatVisible(false)}
                    />
                </div>
            )}
        </div>
    );
};

export default App;
