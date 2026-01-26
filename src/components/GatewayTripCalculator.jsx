import React, { useMemo, useContext, useState, useEffect } from 'react';
import { useDataPoints } from '../contexts/DataPointContext';
import { GraphContext } from '../contexts/GraphContext';
import './GatewayTripCalculator.css';

const GatewayTripCalculator = ({ embedded = false }) => {
  const { 
    gatewayData, 
    systemIdByNaturalId, 
    systemNames,
    systemPositions3D,
    tripStartSystem,
    tripEndSystem,
    tripSelectingStart,
    tripSelectingEnd,
    tripShipVolume,
    setTripShipVolume,
    setTripRoute,
    startSelectingTripStart,
    startSelectingTripEnd,
    clearTripSelection
  } = useDataPoints();
  const { graph } = useContext(GraphContext);
  const [isCalculating, setIsCalculating] = useState(false);

  // Helper to extract system NaturalId from LocationNaturalId (e.g., "ZV-307c" -> "ZV-307")
  const extractSystemNaturalId = (locationNaturalId) => {
    if (!locationNaturalId) return null;
    // If it ends with a lowercase letter (planet suffix), remove it
    const match = locationNaturalId.match(/^([A-Z]{2}-\d{3})/i);
    return match ? match[1].toUpperCase() : locationNaturalId.toUpperCase();
  };

  // Build gateway network graph
  const gatewayNetwork = useMemo(() => {
    if (!gatewayData || gatewayData.length === 0) return null;

    const network = {
      gateways: new Map(), // gatewayId -> gateway data with resolved systemId
      systemGateways: new Map(), // systemId -> [gateways at this system]
      links: new Map(), // gatewayId -> linked gateway id
    };

    // First pass: build gateway lookup and group by system
    gatewayData.forEach(gw => {
      // Extract system from location (handles planet suffixes like "ZV-307c")
      const systemNatId = extractSystemNaturalId(gw.LocationNaturalId);
      if (!systemNatId) return;
      
      const systemId = systemIdByNaturalId[systemNatId] || systemIdByNaturalId[systemNatId.toLowerCase()];
      if (!systemId) return;

      // Store gateway with resolved systemId
      const gwWithSystem = { ...gw, systemId, systemNatId };
      network.gateways.set(gw.GatewayId, gwWithSystem);
      
      // Group gateways by system
      if (!network.systemGateways.has(systemId)) {
        network.systemGateways.set(systemId, []);
      }
      network.systemGateways.get(systemId).push(gwWithSystem);

      // Track outgoing links
      if (gw.OutgoingLink) {
        network.links.set(gw.GatewayId, gw.OutgoingLink);
      }
    });

    return network;
  }, [gatewayData, systemIdByNaturalId]);

  // Calculate 3D distance between two systems in parsecs
  // Parsecs = Euclidean distance / 12
  const getSystem3DDistance = (sys1Id, sys2Id) => {
    const pos1 = systemPositions3D[sys1Id];
    const pos2 = systemPositions3D[sys2Id];
    if (!pos1 || !pos2) return Infinity;
    
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    const dz = pos1.z - pos2.z;
    const euclideanDistance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    return euclideanDistance / 12;
  };

  // Find best gateway route using Dijkstra's algorithm
  const calculatedRoute = useMemo(() => {
    const startId = tripStartSystem?.id;
    const endId = tripEndSystem?.id;

    if (!startId || !endId || !gatewayNetwork || !graph) {
      return null;
    }

    setIsCalculating(true);

    // Priority queue implementation
    const pq = [];
    const distances = new Map();
    const visited = new Set();

    // Initialize: start from the start system
    pq.push({
      systemId: startId,
      totalDistance: 0,
      path: [],
      totalFees: {}, // Map of currency -> amount
      totalTime: 0, // in minutes
    });
    distances.set(startId, 0);

    while (pq.length > 0) {
      // Sort and get minimum distance node
      pq.sort((a, b) => a.totalDistance - b.totalDistance);
      const current = pq.shift();

      if (visited.has(current.systemId)) continue;
      visited.add(current.systemId);

      // Check if we reached the destination
      if (current.systemId === endId) {
        setIsCalculating(false);
        return current;
      }

      // Explore gateway connections from this system
      const gatewaysHere = gatewayNetwork.systemGateways.get(current.systemId) || [];
      
      for (const gateway of gatewaysHere) {
        // Check if ship fits
        if (gateway.MaxShipVolume < tripShipVolume) continue;
        
        // Check if gateway is operational
        if (gateway.OperationalState !== 'OPERATIONAL') continue;
        
        // Check if gateway has established link
        if (gateway.LinkStatus !== 'ESTABLISHED') continue;
        
        // Check if gateway has outgoing link
        const linkedGatewayId = gatewayNetwork.links.get(gateway.GatewayId);
        if (!linkedGatewayId) continue;
        
        const linkedGateway = gatewayNetwork.gateways.get(linkedGatewayId);
        if (!linkedGateway) continue;
        
        // Check if linked gateway is operational
        if (linkedGateway.OperationalState !== 'OPERATIONAL') continue;
        
        // Check if ship fits in linked gateway
        if (linkedGateway.MaxShipVolume < tripShipVolume) continue;

        // Get destination system from the pre-resolved systemId on the linked gateway
        const destSystemId = linkedGateway.systemId;
        if (!destSystemId || visited.has(destSystemId)) continue;

        // Calculate actual 3D distance between source and destination systems
        const gatewayJumpDistance = getSystem3DDistance(current.systemId, destSystemId);
        if (gatewayJumpDistance === Infinity) continue;
        
        const newDistance = current.totalDistance + gatewayJumpDistance;
        
        // Calculate fees (source gateway charges) - track by currency
        const fee = gateway.UsageAmount || 0;
        const feeCurrency = gateway.UsageCurrency || 'AIC';
        const newFees = { ...current.totalFees };
        if (fee > 0) {
          newFees[feeCurrency] = (newFees[feeCurrency] || 0) + fee;
        }
        
        // Calculate time: 20 minutes flat per gateway jump + travel time (3pc/hr)
        const travelTimeMinutes = (gatewayJumpDistance / 3) * 60;
        const jumpTime = 20 + travelTimeMinutes; // 20 min per jump + travel
        const newTime = current.totalTime + jumpTime;

        if (!distances.has(destSystemId) || newDistance < distances.get(destSystemId)) {
          distances.set(destSystemId, newDistance);
          
          const newPath = [...current.path, {
            type: 'gateway',
            fromSystem: current.systemId,
            toSystem: destSystemId,
            fromSystemName: systemNames[current.systemId] || current.systemId?.substring(0, 8),
            toSystemName: systemNames[destSystemId] || destSystemId?.substring(0, 8),
            gateway: gateway,
            linkedGateway: linkedGateway,
            fee: fee,
            feeCurrency: feeCurrency,
            distance: gatewayJumpDistance,
            time: jumpTime,
          }];

          pq.push({
            systemId: destSystemId,
            totalDistance: newDistance,
            path: newPath,
            totalFees: newFees,
            totalTime: newTime,
          });
        }
      }
    }

    setIsCalculating(false);
    return null; // No route found
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripStartSystem, tripEndSystem, gatewayNetwork, graph, tripShipVolume, systemNames, systemPositions3D]);

  // Sync calculated route to context for map visualization
  useEffect(() => {
    if (calculatedRoute && calculatedRoute.path) {
      setTripRoute({
        startSystem: tripStartSystem?.id,
        endSystem: tripEndSystem?.id,
        path: calculatedRoute.path,
        totalDistance: calculatedRoute.totalDistance,
        totalFees: calculatedRoute.totalFees,
        totalTime: calculatedRoute.totalTime
      });
    } else {
      setTripRoute(null);
    }
  }, [calculatedRoute, tripStartSystem, tripEndSystem, setTripRoute]);

  const formatTime = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  // Format fees object into display strings
  const formatFees = (fees) => {
    if (!fees || typeof fees !== 'object') return ['Free'];
    const entries = Object.entries(fees).filter(([, amount]) => amount > 0);
    if (entries.length === 0) return ['Free'];
    return entries.map(([currency, amount]) => `${amount.toLocaleString()} ${currency}`);
  };

  const getStartSystemName = () => {
    if (!tripStartSystem) return 'Click to select...';
    return tripStartSystem.name || systemNames[tripStartSystem.id] || tripStartSystem.id?.substring(0, 8);
  };

  const getEndSystemName = () => {
    if (!tripEndSystem) return 'Click to select...';
    return tripEndSystem.name || systemNames[tripEndSystem.id] || tripEndSystem.id?.substring(0, 8);
  };

  return (
    <div className={`gateway-trip-calculator ${embedded ? 'gtc-embedded' : ''}`}>
      {!embedded && (
        <div className="gtc-header">
          <span className="gtc-icon">🚀</span>
          <span className="gtc-title">Gateway Trip Calculator</span>
        </div>
      )}

      <div className="gtc-content">
        <div className="gtc-field">
          <label>Ship Volume (m³)</label>
          <input
            type="number"
            value={tripShipVolume}
            onChange={(e) => setTripShipVolume(Math.max(1, parseInt(e.target.value) || 1))}
            min="1"
            max="50000"
          />
        </div>

        <div className="gtc-field">
          <label>Start System</label>
          <div className="gtc-system-select">
            <span className="gtc-system-name">{getStartSystemName()}</span>
            <button 
              className={`gtc-select-btn ${tripSelectingStart ? 'active' : ''}`}
              onClick={startSelectingTripStart}
            >
              {tripSelectingStart ? '✓ Selecting' : '📍 Select'}
            </button>
          </div>
        </div>

        <div className="gtc-field">
          <label>End System</label>
          <div className="gtc-system-select">
            <span className="gtc-system-name">{getEndSystemName()}</span>
            <button 
              className={`gtc-select-btn ${tripSelectingEnd ? 'active' : ''}`}
              onClick={startSelectingTripEnd}
            >
              {tripSelectingEnd ? '✓ Selecting' : '📍 Select'}
            </button>
          </div>
        </div>

        <div className="gtc-actions">
          <button className="gtc-clear-btn" onClick={clearTripSelection}>
            Clear
          </button>
        </div>

        {(tripSelectingStart || tripSelectingEnd) && (
          <div className="gtc-hint">
            💡 Click on a system on the map to select it
          </div>
        )}

        {isCalculating && (
          <div className="gtc-loading">Calculating route...</div>
        )}

        {calculatedRoute && (
          <div className="gtc-results">
            <div className="gtc-summary">
              <div className="gtc-summary-item">
                <span className="gtc-summary-label">Total Distance</span>
                <span className="gtc-summary-value">{calculatedRoute.totalDistance.toFixed(1)} pc</span>
              </div>
              <div className="gtc-summary-item">
                <span className="gtc-summary-label">Total Fees</span>
                <span className="gtc-summary-value gtc-fees">
                  {formatFees(calculatedRoute.totalFees).map((feeStr, i) => (
                    <span key={i}>{feeStr}{i < formatFees(calculatedRoute.totalFees).length - 1 ? <br/> : ''}</span>
                  ))}
                </span>
              </div>
              <div className="gtc-summary-item">
                <span className="gtc-summary-label">Total Time</span>
                <span className="gtc-summary-value gtc-time">
                  {formatTime(calculatedRoute.totalTime)}
                </span>
              </div>
              <div className="gtc-summary-item">
                <span className="gtc-summary-label">Gateway Jumps</span>
                <span className="gtc-summary-value">
                  {calculatedRoute.path.length}
                </span>
              </div>
            </div>

            <div className="gtc-route">
              <div className="gtc-route-header">Route Details ({calculatedRoute.path.length} Jump{calculatedRoute.path.length !== 1 ? 's' : ''})</div>
              <div className="gtc-route-list">
                {calculatedRoute.path.map((step, index) => (
                  <div key={index} className="gtc-route-step gtc-step-gateway">
                    <div className="gtc-step-number">{index + 1}</div>
                    <div className="gtc-step-details">
                      <div className="gtc-step-info">
                        {step.fromSystemName} → {step.toSystemName}
                      </div>
                      <div className="gtc-step-gateway">
                        via {step.gateway.Name || step.gateway.NaturalId}
                      </div>
                      <div className="gtc-step-meta">
                        <span className="gtc-step-fee">💰 {step.fee.toLocaleString()} {step.feeCurrency}</span>
                        <span className="gtc-step-distance">📏 {step.distance.toFixed(1)} pc</span>
                        <span className="gtc-step-time">⏱ {formatTime(step.time)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {!calculatedRoute && tripStartSystem && tripEndSystem && !isCalculating && (
          <div className="gtc-no-route">
            <span className="gtc-no-route-icon">⚠️</span>
            <span className="gtc-no-route-text">No Route</span>
            <small>No gateway path exists between these systems for your ship size ({tripShipVolume} m³).</small>
          </div>
        )}
      </div>
    </div>
  );
};

export default GatewayTripCalculator;
