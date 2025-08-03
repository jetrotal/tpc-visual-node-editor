import React from 'react';
import './Preloader.css';

interface PreloaderProps {
  loaded: number;
  total: number;
}

const Preloader: React.FC<PreloaderProps> = ({ loaded, total }) => {
  return (
    <div className="preloader-overlay">
      <div className="preloader-container">
        <div className="preloader-logo">
          <svg width="100" height="100" viewBox="0 0 100 100">
            <defs>
              <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style={{ stopColor: 'rgb(15, 118, 242)', stopOpacity: 1 }} />
                <stop offset="100%" style={{ stopColor: 'rgb(4, 211, 242)', stopOpacity: 1 }} />
              </linearGradient>
            </defs>
            <circle cx="50" cy="50" r="45" stroke="url(#grad1)" strokeWidth="10" fill="none" />
            <text x="50" y="55" textAnchor="middle" alignmentBaseline="middle" fontSize="30" fill="white">VNE</text>
          </svg>
        </div>
        <h1 className="preloader-title">Visual Node Editor</h1>
        <p className="preloader-text">Loading commands...</p>
        <div className="progress-bar">
          <div className="progress" style={{ width: `${(loaded / total) * 100}%` }}></div>
        </div>
        <p className="preloader-counter">{loaded} / {total}</p>
      </div>
    </div>
  );
};

export default Preloader;
