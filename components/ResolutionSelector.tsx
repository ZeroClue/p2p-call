import React from 'react';

interface ResolutionSelectorProps {
  resolution: string;
  onResolutionChange: (resolution: string) => void;
}

const resolutions = {
  '1080p': '1080p (FHD)',
  '720p': '720p (HD)',
  '480p': '480p (SD)',
};

const ResolutionSelector: React.FC<ResolutionSelectorProps> = ({
  resolution,
  onResolutionChange,
}) => {
  return (
    <div className="w-full max-w-xs mx-auto">
      <label
        htmlFor="resolution-select"
        className="block text-sm font-medium text-center text-gray-400 mb-2"
      >
        Video Quality
      </label>
      <select
        id="resolution-select"
        value={resolution}
        onChange={(e) => onResolutionChange(e.target.value)}
        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white"
      >
        {Object.entries(resolutions).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
};

export default ResolutionSelector;
