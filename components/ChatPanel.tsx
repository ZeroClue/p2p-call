import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../types';
import { SendIcon } from './icons';

interface ChatPanelProps {
  isVisible: boolean;
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  onClose: () => void;
}

const CloseIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={2}
    stroke="currentColor"
    className={className}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const ChatPanel: React.FC<ChatPanelProps> = ({ isVisible, messages, onSendMessage, onClose }) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);

  const handleSend = () => {
    if (input.trim()) {
      onSendMessage(input.trim());
      setInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      className={`absolute top-0 right-0 h-full w-full max-w-sm sm:w-80 bg-gray-900/80 backdrop-blur-md border-l border-white/10 flex flex-col transition-transform duration-300 ease-in-out z-30 ${isVisible ? 'translate-x-0' : 'translate-x-full'}`}
      role="log"
      aria-hidden={!isVisible}
    >
      <header className="flex items-center justify-between p-4 border-b border-white/10 flex-shrink-0">
        <h2 className="text-lg font-semibold text-white">Chat</h2>
        <button
          onClick={onClose}
          className="p-1 rounded-full text-gray-400 hover:bg-gray-700 hover:text-white"
          aria-label="Close chat"
        >
          <CloseIcon className="w-6 h-6" />
        </button>
      </header>

      <div className="flex-grow p-4 overflow-y-auto custom-scrollbar">
        <div className="space-y-4">
          {messages.map((msg, index) => (
            <div
              key={`${msg.timestamp}-${index}`}
              className={`flex flex-col text-sm ${msg.sender === 'me' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-xs px-3 py-2 rounded-lg ${msg.sender === 'me' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-gray-700 text-gray-200 rounded-bl-none'}`}
              >
                <p>{msg.text}</p>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <footer className="p-4 border-t border-white/10 flex-shrink-0 bg-gray-900/80">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="flex-grow w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-white"
            disabled={!isVisible}
            aria-label="Chat message input"
          />
          <button
            onClick={handleSend}
            className="p-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Send message"
            disabled={!input.trim()}
          >
            <SendIcon className="w-5 h-5" />
          </button>
        </div>
      </footer>
    </div>
  );
};

export default ChatPanel;
