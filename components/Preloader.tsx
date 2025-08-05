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
        </div>
        <h1 className="preloader-title">TPC Node Editor</h1>
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
