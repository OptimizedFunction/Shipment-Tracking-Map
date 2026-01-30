import React, { useState } from 'react';
import { useDataPoints } from '../contexts/DataPointContext';

const GatewaySelector = () => {
  const {
    isSimulationMode,
    disabledSimulatedGateways,
    toggleSimulatedGateway,
    enableAllSimulatedGateways,
    disableAllSimulatedGateways
  } = useDataPoints();

  const [isOpen, setIsOpen] = useState(false);

  // Only show when simulation mode is active
  if (!isSimulationMode) {
    return null;
  }

  // Define gateway pairs with their keys and display names
  const highVolumeGateways = [
    { key: 'high-0', name: 'Katoa ↔ Etherwind' },
    { key: 'high-1', name: 'Etherwind ↔ Kiruna' },
    { key: 'high-2', name: 'Ashland ↔ Promitor' },
    { key: 'high-3', name: 'Etherwind ↔ Griffonstone' },
    { key: 'high-4', name: 'Griffonstone ↔ Hephaestus' },
    { key: 'high-5', name: 'Hephaestus ↔ IA-158d' },
    { key: 'high-6', name: 'IA-158b ↔ Promitor' },
    { key: 'high-7', name: 'Promitor ↔ Berthier' },
    { key: 'high-8', name: 'Berthier ↔ LB-428d' },
    { key: 'high-9', name: 'LB-428d ↔ Montem' },
    { key: 'high-10', name: 'Montem ↔ Circe' },
    { key: 'high-11', name: 'Montem ↔ Kiruna' },
    { key: 'high-12', name: 'Berthier ↔ GY-694d' },
    { key: 'high-13', name: 'Promitor ↔ Nova Honshu' },
    { key: 'high-14', name: 'Montem ↔ Sand' },
    { key: 'high-15', name: 'Sand ↔ Verdant' },
    { key: 'high-16', name: 'Katoa ↔ Cadia' },
    { key: 'high-17', name: 'Cadia ↔ Ementior' }
  ];

  const lowVolumeGateways = [
    { key: 'low-0', name: 'Etherwind ↔ Ashland' },
    { key: 'low-1', name: 'Nova Honshu ↔ Boucher' },
    { key: 'low-2', name: 'Verdant ↔ UY-408a' },
    { key: 'low-3', name: 'UY-408a ↔ Saladin' },
    { key: 'low-4', name: 'Saladin ↔ Sheol' }
  ];

  const handleGatewayToggle = (key) => {
    toggleSimulatedGateway(key);
  };

  const handleEnableAll = () => {
    enableAllSimulatedGateways();
  };

  const handleDisableAll = () => {
    disableAllSimulatedGateways();
  };

  return (
    <div className="gateway-selector">
      <button
        className="toggle-token gateway-selector-toggle"
        onClick={() => setIsOpen(!isOpen)}
        data-tooltip="Select which simulated gateways to enable"
      >
        Gateway Select
      </button>
      {isOpen && (
        <div className="gateway-selector-dropdown">
          <div className="gateway-selector-header">
            <h4>Simulated Gateways</h4>
            <div className="gateway-selector-controls">
              <button
                className="gateway-control-button"
                onClick={handleEnableAll}
              >
                Enable All
              </button>
              <button
                className="gateway-control-button"
                onClick={handleDisableAll}
              >
                Disable All
              </button>
            </div>
          </div>

          <div className="gateway-selector-section">
            <h5>High Volume (6000m³)</h5>
            <div className="gateway-list">
              {highVolumeGateways.map(({ key, name }) => (
                <label key={key} className="gateway-checkbox">
                  <input
                    type="checkbox"
                    checked={!disabledSimulatedGateways.has(key)}
                    onChange={() => handleGatewayToggle(key)}
                  />
                  <span className="gateway-name">{name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="gateway-selector-section">
            <h5>Low Volume (3000m³)</h5>
            <div className="gateway-list">
              {lowVolumeGateways.map(({ key, name }) => (
                <label key={key} className="gateway-checkbox">
                  <input
                    type="checkbox"
                    checked={!disabledSimulatedGateways.has(key)}
                    onChange={() => handleGatewayToggle(key)}
                  />
                  <span className="gateway-name">{name}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GatewaySelector;