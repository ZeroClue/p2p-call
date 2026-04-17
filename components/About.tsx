import React from 'react';

const About: React.FC = () => {
  return (
    <div className="w-full max-w-lg p-6 bg-gray-800/50 rounded-lg space-y-6 text-center border border-gray-700">
      <div>
        <h2 className="text-2xl font-bold text-white">P2P Video Call</h2>
        <p className="text-sm font-mono text-gray-500 mt-1">Version 0.1.0</p>
      </div>

      <p className="text-gray-300">
        A secure, serverless video calling application that connects users directly through their
        web browsers using WebRTC. No sign-ups, no servers—just simple and private conversations.
      </p>

      <div>
        <h3 className="text-lg font-semibold text-gray-200 mb-3">Powered By</h3>
        <ul className="space-y-2 text-gray-400">
          <li>
            <a
              href="https://reactjs.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-indigo-400 transition-colors"
            >
              React
            </a>
          </li>
          <li>
            <a
              href="https://webrtc.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-indigo-400 transition-colors"
            >
              WebRTC
            </a>
          </li>
          <li>
            <a
              href="https://firebase.google.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-indigo-400 transition-colors"
            >
              Firebase Realtime Database
            </a>
          </li>
          <li>
            <a
              href="https://tailwindcss.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-indigo-400 transition-colors"
            >
              Tailwind CSS
            </a>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default About;
