import React from 'react';
import { useDataPoints } from '../contexts/DataPointContext';
import GatewaySelector from './GatewaySelector';

const GatewayToggle = () => {
  const { 
    isGatewayLayerVisible, 
    toggleGatewayLayer, 
    gatewayLoading,
    isSimulationMode,
    toggleSimulationMode,
    showGatewayBubbles,
    toggleGatewayBubbles
  } = useDataPoints();

  return (
    <div className="gateway-toggle">
      <button
        className={`toggle-token ${isGatewayLayerVisible ? 'active' : ''}`}
        onClick={toggleGatewayLayer}
        disabled={gatewayLoading}
        data-tooltip="Toggle gateway links visualization"
      >
        {gatewayLoading ? 'Loading...' : 'Gateways'}
      </button>
      <button
        className={`toggle-token simulation-toggle ${isSimulationMode ? 'active' : ''}`}
        onClick={toggleSimulationMode}
        data-tooltip="Toggle simulation mode - shows only simulated gateway links"
        style={{ marginLeft: '4px' }}
      >
        {isSimulationMode ? 'Sim ON' : 'Sim OFF'}
      </button>
      <GatewaySelector />
      <button
        className={`toggle-token ${showGatewayBubbles ? 'active' : ''}`}
        onClick={toggleGatewayBubbles}
        data-tooltip="Toggle capacity/fuel bubbles on gateway links"
        style={{ marginLeft: '4px' }}
      >
        Bubbles
      </button>
    </div>
  );
};

export default GatewayToggle;
