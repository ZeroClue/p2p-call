import React from 'react';
import { ErrorIcon } from './icons';

interface MediaErrorScreenProps {
  errorMessage: string | null;
  onRetry: () => void;
}

const MediaErrorScreen: React.FC<MediaErrorScreenProps> = ({ errorMessage, onRetry }) => {
  return (
    <div
      className="absolute inset-0 bg-gray-950/90 backdrop-blur-md flex items-center justify-center z-20"
      role="alertdialog"
      aria-labelledby="error-title"
    >
      <div className="w-full max-w-lg bg-gray-800 rounded-lg p-8 shadow-xl text-center animate-fade-in-down">
        <ErrorIcon className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h2 id="error-title" className="text-2xl font-bold text-white mb-3">
          Media Access Error
        </h2>
        <p className="text-gray-300 mb-6">{errorMessage || 'An unexpected error occurred.'}</p>
        <button
          onClick={onRetry}
          className="w-full px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition-transform transform hover:scale-105"
        >
          Try Again
        </button>
      </div>
    </div>
  );
};

export default MediaErrorScreen;
