import React from 'react';
import { IncomingCall } from '../types';
import { AcceptCallIcon, DeclineCallIcon } from './icons';

interface IncomingCallProps {
  callInfo: IncomingCall;
  callerDisplayName: string;
  onAccept: () => void;
  onDecline: () => void;
}


const IncomingCall: React.FC<IncomingCallProps> = ({ callInfo, callerDisplayName, onAccept, onDecline }) => {
  return (
    <div className="absolute inset-0 bg-gray-950/80 backdrop-blur-2xl flex flex-col items-center justify-center gap-8 z-50 animate-fade-in" role="alertdialog" aria-labelledby="incoming-call-title">
        <div className="text-center">
            <h2 id="incoming-call-title" className="text-3xl font-bold text-indigo-400">Incoming Call</h2>
            <p className="text-xl text-gray-300 mt-2">{callerDisplayName}</p>
        </div>

        <div className="flex items-center gap-8">
            <div className="flex flex-col items-center gap-2">
                <button
                    onClick={onDecline}
                    className="w-20 h-20 bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center transition-transform transform hover:scale-110"
                    aria-label="Decline call"
                >
                    <DeclineCallIcon className="w-10 h-10 text-white" />
                </button>
                <span className="font-semibold text-white">Decline</span>
            </div>
            <div className="flex flex-col items-center gap-2">
                <button
                    onClick={onAccept}
                    className="w-20 h-20 bg-green-600 hover:bg-green-700 rounded-full flex items-center justify-center transition-transform transform hover:scale-110"
                    aria-label="Accept call"
                >
                    <AcceptCallIcon className="w-10 h-10 text-white" />
                </button>
                <span className="font-semibold text-white">Accept</span>
            </div>
        </div>
        <style>{`
            @keyframes fade-in {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            .animate-fade-in {
                animation: fade-in 0.3s ease-out forwards;
            }
        `}</style>
    </div>
  );
};

export default IncomingCall;