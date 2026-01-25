import React from 'react';
import { useDataPoints } from '../contexts/DataPointContext';

const GatewayToggle = () => {
  const { isGatewayLayerVisible, toggleGatewayLayer, gatewayLoading } = useDataPoints();

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
    </div>
  );
};

export default GatewayToggle;
