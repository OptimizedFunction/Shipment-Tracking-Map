import React from 'react';
import { Box, Rotate3d } from 'lucide-react';
import './UniverseMap3D.css';

const ViewToggle = ({ is3D, onToggle, disabled }) => {
  return (
    <div className="view-toggle-container">
      <button
        className={`view-toggle-btn ${is3D ? 'is-3d' : ''}`}
        onClick={onToggle}
        disabled={disabled}
        title={is3D ? 'Switch to 2D Map' : 'Switch to 3D Map'}
      >
        {is3D ? (
          <>
            <Box size={18} />
            <span>2D View</span>
          </>
        ) : (
          <>
            <Rotate3d size={18} />
            <span>3D View</span>
          </>
        )}
      </button>
    </div>
  );
};

export default ViewToggle;
