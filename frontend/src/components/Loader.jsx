import React from 'react';
import { Bug } from 'lucide-react';

const Loader = ({ fullScreen = false, text = "Loading..." }) => {
  const containerClass = fullScreen ? "loader-container fullscreen" : "loader-container";
  
  return (
    <div className={containerClass}>
      <div className="loader-content">
        <div className="loader-icon-wrapper">
          <Bug className="loader-icon" size={40} />
          <div className="loader-ring"></div>
        </div>
        {text && <p className="loader-text">{text}</p>}
      </div>
    </div>
  );
};

export default Loader;
