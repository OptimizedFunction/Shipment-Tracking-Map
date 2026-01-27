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

  // Build FTL lane adjacency map from graph edges
  const ftlAdjacency = useMemo(() => {
    if (!graph?.edges) return new Map();
    
    const adjacency = new Map();
    graph.edges.forEach(edge => {
      // Add both directions since FTL lanes are bidirectional
      if (!adjacency.has(edge.start)) {
        adjacency.set(edge.start, []);
      }
      adjacency.get(edge.start).push({ to: edge.end, distance: edge.distance });
      
      if (!adjacency.has(edge.end)) {
        adjacency.set(edge.end, []);
      }
      adjacency.get(edge.end).push({ to: edge.start, distance: edge.distance });
    });
    
    return adjacency;
  }, [graph]);

  // Find best route using Dijkstra's algorithm (combining gateways and FTL lanes)
  const calculatedRoute = useMemo(() => {
    const startId = tripStartSystem?.id;
    const endId = tripEndSystem?.id;

    if (!startId || !endId || !graph) {
      return null;
    }

    setIsCalculating(true);

    // Priority queue implementation
    const pq = [];
    const bestCosts = new Map(); // Track best routing cost to each system
    const visited = new Set();

    // Initialize: start from the start system
    pq.push({
      systemId: startId,
      routingCost: 0,      // Cost for pathfinding (includes penalties)
      totalDistance: 0,    // Actual distance (no penalties) for display
      path: [],
      totalFees: {}, // Map of currency -> amount
      totalTime: 0, // in minutes (total time)
      gatewayTime: 0, // Gateway-only time for tiebreaking
      gatewayJumps: 0,
      ftlJumps: 0,
    });
    bestCosts.set(startId, 0);

    while (pq.length > 0) {
      // Sort by: 1) routing cost, 2) fewer FTL jumps, 3) less gateway time
      pq.sort((a, b) => {
        if (a.routingCost !== b.routingCost) return a.routingCost - b.routingCost;
        if (a.ftlJumps !== b.ftlJumps) return a.ftlJumps - b.ftlJumps;
        return a.gatewayTime - b.gatewayTime;
      });
      const current = pq.shift();

      if (visited.has(current.systemId)) continue;
      visited.add(current.systemId);

      // Check if we reached the destination
      if (current.systemId === endId) {
        setIsCalculating(false);
        return current;
      }

      // === Explore GATEWAY connections from this system ===
      if (gatewayNetwork) {
        const gatewaysHere = gatewayNetwork.systemGateways.get(current.systemId) || [];
        
        for (const gateway of gatewaysHere) {
          // Check if ship fits in departing gateway
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

          // Get destination system from the pre-resolved systemId on the linked gateway
          const destSystemId = linkedGateway.systemId;
          if (!destSystemId) continue;
          
          if (visited.has(destSystemId)) continue;

          // Calculate actual 3D distance between source and destination systems
          const gatewayJumpDistance = getSystem3DDistance(current.systemId, destSystemId);
          if (gatewayJumpDistance === Infinity) continue;
          
          // Hop penalty: add fixed cost per jump to prefer fewer hops
          // Gateway hops get a smaller penalty since they're preferred
          const HOP_PENALTY_GATEWAY = 2; // parsecs equivalent per gateway hop
          const newRoutingCost = current.routingCost + gatewayJumpDistance + HOP_PENALTY_GATEWAY;
          const newTotalDistance = current.totalDistance + gatewayJumpDistance; // Actual distance without penalty
          
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
          const newGatewayTime = current.gatewayTime + jumpTime;

          if (!bestCosts.has(destSystemId) || newRoutingCost < bestCosts.get(destSystemId)) {
            bestCosts.set(destSystemId, newRoutingCost);
            
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
              routingCost: newRoutingCost,
              totalDistance: newTotalDistance,
              path: newPath,
              totalFees: newFees,
              totalTime: newTime,
              gatewayTime: newGatewayTime,
              gatewayJumps: current.gatewayJumps + 1,
              ftlJumps: current.ftlJumps,
            });
          }
        }
      }

      // === Explore FTL LANE connections from this system ===
      const ftlNeighbors = ftlAdjacency.get(current.systemId) || [];
      
      // Hop penalty for FTL - higher than gateway to prefer gateway routes
      const HOP_PENALTY_FTL = 5; // parsecs equivalent per FTL hop
      
      for (const neighbor of ftlNeighbors) {
        const destSystemId = neighbor.to;
        if (visited.has(destSystemId)) continue;

        // Use true 3D distance for FTL segments
        const ftlDistance = getSystem3DDistance(current.systemId, destSystemId);
        if (ftlDistance === Infinity) continue;
        
        // Add hop penalty to prefer fewer jumps and gateway routes
        const newRoutingCost = current.routingCost + ftlDistance + HOP_PENALTY_FTL;
        const newTotalDistance = current.totalDistance + ftlDistance; // Actual distance without penalty
        
        // FTL lanes are free
        const newFees = { ...current.totalFees };
        
        // Calculate time for FTL: travel time at 3pc/hr
        const travelTimeMinutes = (ftlDistance / 3) * 60;
        const newTime = current.totalTime + travelTimeMinutes;

        if (!bestCosts.has(destSystemId) || newRoutingCost < bestCosts.get(destSystemId)) {
          bestCosts.set(destSystemId, newRoutingCost);
          
          const newPath = [...current.path, {
            type: 'ftl',
            fromSystem: current.systemId,
            toSystem: destSystemId,
            fromSystemName: systemNames[current.systemId] || current.systemId?.substring(0, 8),
            toSystemName: systemNames[destSystemId] || destSystemId?.substring(0, 8),
            fee: 0,
            feeCurrency: null,
            distance: ftlDistance,
            time: travelTimeMinutes,
          }];

          pq.push({
            systemId: destSystemId,
            routingCost: newRoutingCost,
            totalDistance: newTotalDistance,
            path: newPath,
            totalFees: newFees,
            totalTime: newTime,
            gatewayTime: current.gatewayTime, // FTL doesn't add to gateway time
            gatewayJumps: current.gatewayJumps,
            ftlJumps: current.ftlJumps + 1,
          });
        }
      }
    }

    setIsCalculating(false);
    return null; // No route found
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripStartSystem, tripEndSystem, gatewayNetwork, graph, tripShipVolume, systemNames, systemPositions3D, ftlAdjacency]);

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
            value={tripShipVolume === 0 ? '' : tripShipVolume}
            onChange={(e) => {
              const val = e.target.value;
              if (val === '') {
                setTripShipVolume(0);
              } else {
                setTripShipVolume(Math.max(0, parseInt(val) || 0));
              }
            }}
            onBlur={(e) => {
              // Ensure minimum value of 1 when leaving the field
              if (!tripShipVolume || tripShipVolume < 1) {
                setTripShipVolume(1);
              }
            }}
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
                <span className="gtc-summary-label">Gateway Travel Time</span>
                <span className="gtc-summary-value gtc-time">
                  {formatTime(calculatedRoute.path.filter(s => s.type === 'gateway').reduce((sum, s) => sum + (s.time || 0), 0))}
                </span>
              </div>
              <div className="gtc-summary-item">
                <span className="gtc-summary-label">Gateway Jumps</span>
                <span className="gtc-summary-value">
                  {calculatedRoute.gatewayJumps || calculatedRoute.path.filter(s => s.type === 'gateway').length}
                </span>
              </div>
              <div className="gtc-summary-item">
                <span className="gtc-summary-label">FTL Jumps</span>
                <span className="gtc-summary-value">
                  {calculatedRoute.ftlJumps || calculatedRoute.path.filter(s => s.type === 'ftl').length}
                </span>
              </div>
            </div>

            <div className="gtc-route">
              <div className="gtc-route-header">Route Details ({calculatedRoute.path.length} Jump{calculatedRoute.path.length !== 1 ? 's' : ''})</div>
              <div className="gtc-route-list">
                {calculatedRoute.path.map((step, index) => (
                  <div key={index} className={`gtc-route-step ${step.type === 'gateway' ? 'gtc-step-gateway' : 'gtc-step-ftl'}`}>
                    <div className="gtc-step-number">{index + 1}</div>
                    <div className="gtc-step-details">
                      <div className="gtc-step-info">
                        {step.fromSystemName} → {step.toSystemName}
                      </div>
                      {step.type === 'gateway' ? (
                        <>
                          <div className="gtc-step-via">
                            🌀 via {step.gateway?.Name || step.gateway?.NaturalId || 'Gateway'}
                          </div>
                          <div className="gtc-step-meta">
                            <span className="gtc-step-fee">💰 {(step.fee || 0).toLocaleString()} {step.feeCurrency || 'AIC'}</span>
                            <span className="gtc-step-distance">📏 {step.distance.toFixed(1)} pc</span>
                            <span className="gtc-step-time">⏱ {formatTime(step.time)}</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="gtc-step-via">
                            🚀 FTL Lane
                          </div>
                          <div className="gtc-step-meta">
                            <span className="gtc-step-fee">✨ Free</span>
                            <span className="gtc-step-distance">📏 {step.distance.toFixed(1)} pc</span>
                            <span className="gtc-step-time">⏱ {formatTime(step.time)}</span>
                          </div>
                        </>
                      )}
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
            <small>No path exists between these systems for your ship size ({tripShipVolume} m³).</small>
          </div>
        )}
      </div>
    </div>
  );
};

export default GatewayTripCalculator;
