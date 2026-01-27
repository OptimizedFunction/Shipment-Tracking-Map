import React, { useContext, useMemo, useRef, useState, useCallback, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Line, Html, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { GraphContext } from '../contexts/GraphContext';
import { SelectionContext } from '../contexts/SelectionContext';
import { SearchContext } from '../contexts/SearchContext';
import { useCogcOverlay } from '../contexts/CogcOverlayContext';
import { useDataPoints } from '../contexts/DataPointContext';
import { AuthContext } from '../contexts/AuthContext';
import { cogcPrograms } from '../constants/cogcPrograms';
import { SIL_TRACKER_API_KEY } from '../constants/silTracking';
import GatewayTripCalculator from './GatewayTripCalculator';
import './UniverseMap3D.css';

// Faction colors
const FACTION_COLORS = {
  'CI': '#ff4444',   // Castillo-Ito - Red
  'AI': '#ff8c00',   // Antares Initiative - Orange
  'IC': '#44ff44',   // Insitor Cooperative - Green
  'NC': '#ffff00',   // Neo Charter - Yellow
  'default': '#888888' // Non-faction - Grey
};

// Helper function to get ship location system ID
const getShipLocationSystemId = (ship, systemIdByNaturalId) => {
  if (!ship) return null;

  // Direct system ID fields
  const directCandidates = [
    ship.CurrentSystemId,
    ship.SystemId,
    ship.CurrentLocationSystemId,
    ship.LocationSystemId,
    ship.LastKnownSystemId,
    ship.LastSystemId,
    ship.LastLocationSystemId,
    ship.HomeSystemId
  ];

  for (const candidate of directCandidates) {
    if (candidate && systemIdByNaturalId[candidate]) {
      return systemIdByNaturalId[candidate];
    }
  }

  // Natural ID fields
  const naturalIdCandidates = [
    ship.SystemNaturalId,
    ship.LocationSystemNaturalId,
    ship.LocationNaturalId
  ];

  for (const candidate of naturalIdCandidates) {
    if (candidate && systemIdByNaturalId[candidate]) {
      return systemIdByNaturalId[candidate];
    }
    // Try uppercase
    if (candidate && systemIdByNaturalId[candidate.toUpperCase()]) {
      return systemIdByNaturalId[candidate.toUpperCase()];
    }
  }

  // Nested location objects
  const nestedCandidates = [
    ship.CurrentLocation,
    ship.Location,
    ship.DockedAt,
    ship.LastLocation,
    ship.HomeLocation,
    ship.BasedAt,
    ship.Station
  ];

  for (const nested of nestedCandidates) {
    if (nested && typeof nested === 'object') {
      const systemId = nested.SystemId || nested.SystemNaturalId;
      if (systemId && systemIdByNaturalId[systemId]) {
        return systemIdByNaturalId[systemId];
      }
    }
  }

  return null;
};

// Ease out cubic
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const lerp = (a, b, t) => a + (b - a) * t;

// System node component
const SystemNode = ({ 
  systemId, pos2D, pos3D, starType, name, isHighlighted, isSearchResult,
  hasCogcOverlay, meteorDensity, showMeteorDensity, searchIntensity,
  onHover, onClick, progress, factionCode, isCX
}) => {
  const meshRef = useRef();
  const [hovered, setHovered] = useState(false);
  
  // Use faction color instead of star type color
  const displayColor = useMemo(() => {
    if (hasCogcOverlay) return '#56c7f7';
    if (isSearchResult && searchIntensity > 0) {
      const i = Math.min(searchIntensity, 1);
      return `hsl(${120 - i * 60}, 100%, ${50 + i * 20}%)`;
    }
    if (showMeteorDensity && meteorDensity > 0) {
      const d = Math.min(meteorDensity / 10, 1);
      return `hsl(${120 - d * 120}, 80%, 50%)`;
    }
    // Use faction color
    return FACTION_COLORS[factionCode] || FACTION_COLORS.default;
  }, [hasCogcOverlay, isSearchResult, searchIntensity, showMeteorDensity, meteorDensity, factionCode]);
  
  // CX systems are larger (doubled sizes)
  const baseSize = isCX ? 4.0 : 1.6;
  const size = isHighlighted ? baseSize * 1.8 : (isSearchResult ? baseSize * 1.4 : baseSize);
  
  // Calculate interpolated position
  const t = easeOutCubic(progress);
  const position = useMemo(() => [
    lerp(pos2D[0], pos3D[0], t),
    lerp(pos2D[1], pos3D[1], t),
    lerp(pos2D[2], pos3D[2], t)
  ], [pos2D, pos3D, t]);
  
  useFrame((state) => {
    if (meshRef.current && isHighlighted) {
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.15;
      meshRef.current.scale.setScalar(size * pulse);
    }
  });

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        scale={size}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); onHover?.(systemId, name, true); document.body.style.cursor = 'pointer'; }}
        onPointerOut={(e) => { e.stopPropagation(); setHovered(false); onHover?.(systemId, name, false); document.body.style.cursor = 'auto'; }}
        onClick={(e) => { e.stopPropagation(); onClick?.(systemId); }}
      >
        <sphereGeometry args={[1, 16, 16]} />
        <meshStandardMaterial color={displayColor} emissive={displayColor} emissiveIntensity={hovered ? 1 : (isHighlighted ? 0.8 : 0.4)} />
      </mesh>
      <sprite scale={[size * 4, size * 4, 1]}>
        <spriteMaterial color={displayColor} transparent opacity={hovered ? 0.5 : 0.15} depthWrite={false} />
      </sprite>
      {hasCogcOverlay && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[size * 1.5, size * 2, 32]} />
          <meshBasicMaterial color="#56c7f7" transparent opacity={0.6} side={THREE.DoubleSide} />
        </mesh>
      )}
      {hovered && (
        <Html position={[0, size + 3, 0]} center style={{ pointerEvents: 'none' }}>
          <div className="system-label-3d">
            <div className="system-name">{name}</div>
            {showMeteorDensity && meteorDensity > 0 && <div className="system-meteor">Meteor: {meteorDensity.toFixed(2)}</div>}
          </div>
        </Html>
      )}
    </group>
  );
};

// Connection line
const ConnectionLine = ({ start, end, color = '#4a90d9', width = 1, opacity = 0.3 }) => {
  const points = useMemo(() => [new THREE.Vector3(...start), new THREE.Vector3(...end)], [start, end]);
  return <Line points={points} color={color} lineWidth={width} transparent opacity={opacity} />;
};

// Trip route
const TripRoute = ({ route, getPos, progress }) => {
  const pts = useMemo(() => {
    const path = route?.path;
    if (!path || path.length < 2) return null;
    const arr = [];
    for (const id of path) {
      const p = getPos(id);
      if (p) arr.push(new THREE.Vector3(...p));
    }
    return arr.length >= 2 ? arr : null;
  }, [route, getPos]);
  
  if (!pts) return null;
  return <Line points={pts} color="#ffcc00" lineWidth={4} transparent opacity={0.5 + progress * 0.4} />;
};

// Pathfinding route component (orange)
const PathfindingRoute = ({ route, getPos, progress }) => {
  const pts = useMemo(() => {
    if (!route || route.length < 2) return null;
    const arr = [];
    for (const id of route) {
      const p = getPos(id);
      if (p) arr.push(new THREE.Vector3(...p));
    }
    return arr.length >= 2 ? arr : null;
  }, [route, getPos]);
  
  if (!pts) return null;
  return <Line points={pts} color="#ff6600" lineWidth={4} transparent opacity={0.5 + progress * 0.4} />;
};

// Ship marker in 3D
const ShipMarker3D = ({ ship, position, progress }) => {
  const meshRef = useRef();
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.5;
    }
  });

  return (
    <group position={position}>
      <mesh ref={meshRef}>
        <boxGeometry args={[2, 2, 2]} />
        <meshStandardMaterial color="#00ff88" emissive="#00ff88" emissiveIntensity={0.3} />
      </mesh>
      <Html position={[0, 3, 0]} center style={{ pointerEvents: 'none', opacity: progress }}>
        <div className="ship-label-3d">
          {ship.Name || ship.ShipName || 'Ship'}
        </div>
      </Html>
    </group>
  );
};

// Flight path in 3D
const FlightPath3D = ({ flight, startPos, endPos, progress }) => {
  const points = useMemo(() => {
    if (!startPos || !endPos) return null;
    return [new THREE.Vector3(...startPos), new THREE.Vector3(...endPos)];
  }, [startPos, endPos]);
  
  if (!points) return null;
  
  return (
    <Line 
      points={points} 
      color="#ffff00" 
      lineWidth={2} 
      transparent 
      opacity={0.6 + progress * 0.3} 
    />
  );
};

// Trip marker
const TripMarker = ({ position, type, name, progress }) => {
  const meshRef = useRef();
  const color = type === 'start' ? '#00ff00' : '#ff4444';
  const label = type === 'start' ? 'Start' : 'End';
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = state.clock.elapsedTime * 2;
    }
  });

  return (
    <group position={position}>
      <mesh ref={meshRef} scale={2}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.8} />
      </mesh>
      <Html position={[0, 5, 0]} center style={{ pointerEvents: 'none', opacity: progress }}>
        <div className={`trip-marker-label-3d ${type}`}>{label}: {name}</div>
      </Html>
    </group>
  );
};

// Camera controller - simple top-down to angled transition
const CameraController = ({ progress, controlsRef, viewCenter, bounds }) => {
  const { camera, size } = useThree();
  const isInteracting = useRef(false);
  const hasCompletedTransition = useRef(false);
  const lastProgress = useRef(progress);
  
  // Calculate camera distance to fit all content when looking down
  const getCameraDistance = useCallback(() => {
    const fov = camera.fov * (Math.PI / 180);
    const aspectRatio = size.width / size.height;
    
    const contentAspect = bounds.width / bounds.depth;
    let targetSize;
    if (aspectRatio > contentAspect) {
      targetSize = bounds.depth * 1.3;
    } else {
      targetSize = (bounds.width * 1.3) / aspectRatio;
    }
    
    return targetSize / (2 * Math.tan(fov / 2));
  }, [camera.fov, size.width, size.height, bounds]);
  
  useFrame(() => {
    const t = easeOutCubic(progress);
    
    // Camera positions - both centered on same X/Z, just different Y position and angle
    const distance = getCameraDistance();
    
    // 2D: Camera directly above, looking straight down
    const pos2D = new THREE.Vector3(viewCenter[0], distance, viewCenter[2]);
    // 3D: Camera behind and above, looking at center
    const pos3D = new THREE.Vector3(viewCenter[0], distance * 0.6, viewCenter[2] + distance * 0.8);
    
    const targetPos = new THREE.Vector3();
    targetPos.lerpVectors(pos2D, pos3D, t);
    
    // Look at the center (Y rises with progress as nodes lift up)
    const lookY = lerp(0, viewCenter[1], t);
    const lookTarget = new THREE.Vector3(viewCenter[0], lookY, viewCenter[2]);
    
    // If user is interacting or transition complete, let them control freely
    if (isInteracting.current || hasCompletedTransition.current) return;
    
    // Update orbit controls target only during transition
    if (controlsRef.current) {
      controlsRef.current.target.copy(lookTarget);
    }
    
    // Check if transition complete
    const dist = camera.position.distanceTo(targetPos);
    if (dist < 1 && (progress >= 0.99 || progress <= 0.01)) {
      hasCompletedTransition.current = true;
    }
    
    // Snap at start, lerp during transition
    if (progress < 0.01) {
      camera.position.copy(targetPos);
    } else {
      camera.position.lerp(targetPos, 0.15);
    }
    
    camera.lookAt(lookTarget);
    
    // Keep up vector as Y (standard) - no flip needed with this camera setup
    camera.up.set(0, 1, 0);
  });
  
  useEffect(() => {
    if (!controlsRef.current) return;
    const c = controlsRef.current;
    const onStart = () => { isInteracting.current = true; };
    const onEnd = () => { isInteracting.current = false; };
    c.addEventListener('start', onStart);
    c.addEventListener('end', onEnd);
    return () => { c.removeEventListener('start', onStart); c.removeEventListener('end', onEnd); };
  }, [controlsRef]);
  
  useEffect(() => {
    if (Math.abs(progress - lastProgress.current) > 0.01) {
      hasCompletedTransition.current = false;
      lastProgress.current = progress;
    }
  }, [progress]);
  
  return null;
};

// Scene component
const Scene = ({ systems, pos2D, pos3D, edges, gateways, selectedId, searchResults, cogcSystems, meteorData, showMeteor, tripRoute, tripStart, tripEnd, onSystemClick, onSystemHover, showGates, progress, viewCenter, bounds, pathfindingSelection, pathfindingPath, ships, flights, systemIdByNaturalId }) => {
  const controlsRef = useRef();
  
  const searchMap = useMemo(() => {
    const m = new Map();
    if (searchResults) Object.entries(searchResults).forEach(([id, data]) => m.set(id, data?.intensity || 1));
    return m;
  }, [searchResults]);
  
  const getPos = useCallback((id) => {
    const p2 = pos2D.get(id);
    const p3 = pos3D.get(id);
    if (!p2 || !p3) return p3 || p2;
    const t = easeOutCubic(progress);
    return [lerp(p2[0], p3[0], t), lerp(p2[1], p3[1], t), lerp(p2[2], p3[2], t)];
  }, [pos2D, pos3D, progress]);

  return (
    <>
      <CameraController progress={progress} controlsRef={controlsRef} viewCenter={viewCenter} bounds={bounds} />
      <ambientLight intensity={0.4} />
      <pointLight position={[100, 100, 100]} intensity={0.6} />
      <Stars radius={2000} depth={100} count={5000} factor={4} saturation={0} fade speed={0.3} />
      
      {edges.map((e, i) => {
        const s = getPos(e.start), en = getPos(e.end);
        if (!s || !en) return null;
        return <ConnectionLine key={`e-${i}`} start={s} end={en} opacity={0.1 + progress * 0.2} />;
      })}
      
      {showGates && gateways.map((g, i) => {
        const s = getPos(g.startSystemId), en = getPos(g.endSystemId);
        if (!s || !en) return null;
        return <ConnectionLine key={`g-${i}`} start={s} end={en} color="#00ff88" width={2} opacity={0.3 + progress * 0.3} />;
      })}
      
      {tripRoute && <TripRoute route={tripRoute} getPos={getPos} progress={progress} />}
      {tripStart && pos3D.get(tripStart.id) && <TripMarker position={pos3D.get(tripStart.id)} type="start" name={tripStart.name} progress={progress} />}
      {tripEnd && pos3D.get(tripEnd.id) && <TripMarker position={pos3D.get(tripEnd.id)} type="end" name={tripEnd.name} progress={progress} />}
      
      {pathfindingPath && pathfindingPath.length > 1 && <PathfindingRoute route={pathfindingPath} getPos={getPos} progress={progress} />}
      
      {/* Render ships */}
      {ships && ships.map((ship, i) => {
        const systemId = getShipLocationSystemId(ship, systemIdByNaturalId);
        if (!systemId) return null;
        const shipPos = getPos(systemId);
        if (!shipPos) return null;
        return <ShipMarker3D key={`ship-${ship.ShipId || ship.Id || i}`} ship={ship} position={shipPos} progress={progress} />;
      })}
      
      {/* Render flights */}
      {flights && flights.map((flight, i) => {
        if (!flight || !flight.Origin || !flight.Destination) return null;
        const startPos = getPos(flight.Origin);
        const endPos = getPos(flight.Destination);
        if (!startPos || !endPos) return null;
        return <FlightPath3D key={`flight-${flight.FlightId || i}`} flight={flight} startPos={startPos} endPos={endPos} progress={progress} />;
      })}
      
      {systems.map(sys => (
        <SystemNode
          key={sys.id}
          systemId={sys.id}
          pos2D={pos2D.get(sys.id) || [sys.position[0], sys.position[1], 0]}
          pos3D={sys.position}
          starType={sys.starType}
          name={sys.name}
          isHighlighted={sys.id === selectedId || pathfindingSelection.includes(sys.id)}
          isSearchResult={searchMap.has(sys.id)}
          searchIntensity={searchMap.get(sys.id) || 0}
          hasCogcOverlay={cogcSystems.has(sys.id)}
          meteorDensity={meteorData[sys.id] || 0}
          showMeteorDensity={showMeteor}
          onHover={onSystemHover}
          onClick={onSystemClick}
          progress={progress}
          factionCode={sys.factionCode}
          isCX={sys.isCX}
        />
      ))}
      
      <OrbitControls ref={controlsRef} enablePan enableZoom enableRotate minDistance={30} maxDistance={2000} enableDamping dampingFactor={0.05} />
    </>
  );
};

// Main component
const UniverseMap3D = React.memo(({ transitionProgress = 0 }) => {
  const { graph, systemStars, planetData, stationData, pathfindingPath, ships, flights } = useContext(GraphContext);
  const { highlightSelectedSystem, selectedSystem, pathfindingSelection } = useContext(SelectionContext);
  const { searchResults } = useContext(SearchContext);
  const { overlayProgram } = useCogcOverlay();
  const { tripSelectingStart, tripSelectingEnd, selectTripSystem, systemNames, meteorDensityData, isOverlayVisible, effectiveGatewayData, isGatewayLayerVisible, tripStartSystem, tripEndSystem, tripRoute, systemIdByNaturalId } = useDataPoints();
  const { authToken, userName, isAuthenticated, loginWithApiKey, logout } = useContext(AuthContext);

  const [hoveredSystem, setHoveredSystem] = useState(null);
  const [showNavigationInstructions, setShowNavigationInstructions] = useState(false);
  const [showShipControls, setShowShipControls] = useState(false);
  const [showTripCalculator, setShowTripCalculator] = useState(false);
  
  // Ship tracking state
  const [selectedShipId, setSelectedShipId] = useState('__all__');
  const [partnerFilter, setPartnerFilter] = useState('');
  const [apiUsername, setApiUsername] = useState('');
  const [pendingApiUsername, setPendingApiUsername] = useState('');
  const [isSilTracking, setIsSilTracking] = useState(false);
  const [silToggleLoading, setSilToggleLoading] = useState(false);
  const [silToggleError, setSilToggleError] = useState(null);
  const [groupId, setGroupId] = useState('');
  const [groupLoading, setGroupLoading] = useState(false);
  const [groupError, setGroupError] = useState(null);
  const [groupUsernames, setGroupUsernames] = useState([]);
  const [selectedGroupUsers, setSelectedGroupUsers] = useState(['__all__']);
  const [showSilTooltip, setShowSilTooltip] = useState(false);
  const [isGroupUserFilterCollapsed, setIsGroupUserFilterCollapsed] = useState(true);

  // Handler functions for ship tracking controls
  const handleApiUsernameChange = useCallback((event) => {
    setPendingApiUsername(event.target.value);
  }, []);

  const handleApplyApiUsername = useCallback(() => {
    setApiUsername(pendingApiUsername.trim());
  }, [pendingApiUsername]);

  const handlePartnerFilterChange = useCallback((event) => {
    setPartnerFilter(event.target.value);
  }, []);

  const handleShipChange = useCallback((event) => {
    setSelectedShipId(event.target.value);
  }, []);

  const handleSilTrackingToggle = useCallback(async () => {
    if (!loginWithApiKey) {
      return;
    }

    setSilToggleLoading(true);
    setSilToggleError(null);

    try {
      if (authToken === SIL_TRACKER_API_KEY) {
        logout?.();
      } else {
        if (!SIL_TRACKER_API_KEY) {
          throw new Error('SIL tracker credentials are not configured.');
        }
        await loginWithApiKey({ apiKey: SIL_TRACKER_API_KEY, rememberMe: false });
      }
    } catch (error) {
      setSilToggleError(error instanceof Error ? error.message : 'Failed to toggle SIL shipment tracking');
    } finally {
      setSilToggleLoading(false);
    }
  }, [authToken, loginWithApiKey, logout]);

  const handleGroupFetch = useCallback(async () => {
    setGroupLoading(true);
    setGroupError(null);
    if (!groupId || !isAuthenticated) return;
    try {
      const headerValue = typeof authToken === 'string' ? authToken.trim() : '';
      const headers = headerValue ? { Authorization: headerValue, Accept: 'application/json' } : { Accept: 'application/json' };
      const resp = await fetch(`https://rest.fnar.net/auth/group/${groupId}`, { headers });
      if (resp.status === 204) {
        setGroupError('Group with specified id not found');
        setGroupLoading(false);
        return;
      }
      if (!resp.ok) {
        setGroupError(`Failed to fetch group info: ${resp.status}`);
        setGroupLoading(false);
        return;
      }
      const payload = await resp.json();
      const usernames = [
        ...(payload.GroupAdmins?.map(a => a.GroupAdminUserName) || []),
        ...(payload.GroupUsers?.map(u => u.GroupUserName) || [])
      ];
      const uniqueUsernames = [...new Set(usernames)];
      setGroupUsernames(uniqueUsernames);
    } catch (err) {
      setGroupError('Failed to fetch group info');
    }
    setGroupLoading(false);
  }, [groupId, isAuthenticated, authToken]);

  const handleGroupClear = useCallback(() => {
    setGroupId('');
    setGroupUsernames([]);
    setSelectedGroupUsers(['__all__']);
    setGroupError(null);
  }, []);

  const handleGroupUserSelectionChange = useCallback((username, checked) => {
    if (username === '__all__') {
      if (checked) {
        setSelectedGroupUsers(['__all__']);
      } else {
        setSelectedGroupUsers([]);
      }
    } else {
      setSelectedGroupUsers(prev => {
        let newSelection;
        if (checked) {
          newSelection = prev.filter(user => user !== '__all__');
          if (!newSelection.includes(username)) {
            newSelection.push(username);
          }
        } else {
          newSelection = prev.filter(user => user !== username);
        }
        return newSelection;
      });
    }
  }, []);

  // Ship options for dropdown
  const shipOptions = useMemo(() => {
    const seen = new Set();
    const opts = [];
    (ships || []).forEach((ship) => {
      const id = ship?.ShipId || ship?.Id || ship?.Ship || ship?.Registration || ship?.Name;
      if (!id) return;
      const idStr = String(id);
      if (seen.has(idStr)) return;
      seen.add(idStr);
      const labelBase = ship?.Name || ship?.ShipName || ship?.Registration || ship?.ShipId || ship?.Id || 'Unknown Ship';
      opts.push({ id: idStr, label: labelBase });
    });
    opts.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
    return [{ id: '__all__', label: 'All Ships' }, ...opts];
  }, [ships]);

  // Effects for SIL tracking and API username
  useEffect(() => {
    setIsSilTracking(authToken === SIL_TRACKER_API_KEY);
  }, [authToken]);

  useEffect(() => {
    setPendingApiUsername(apiUsername);
  }, [apiUsername]);

  useEffect(() => {
    if (selectedShipId === '__all__') return;
    const stillExists = (ships || []).some((ship) => {
      const id = ship?.ShipId || ship?.Id || ship?.Ship || ship?.Registration || ship?.Name;
      return id && String(id) === selectedShipId;
    });
    if (!stillExists) {
      setSelectedShipId('__all__');
    }
  }, [ships, selectedShipId]);
  const systemFactions = useMemo(() => {
    const factions = new Map();
    if (planetData) {
      Object.entries(planetData).forEach(([systemId, planets]) => {
        if (Array.isArray(planets)) {
          for (const planet of planets) {
            if (planet.FactionCode) {
              factions.set(systemId, planet.FactionCode);
              break; // Use first planet's faction
            }
          }
        }
      });
    }
    return factions;
  }, [planetData]);

  // Build a set of CX system IDs from stationData
  const cxSystems = useMemo(() => {
    const cxSet = new Set();
    if (stationData && Array.isArray(stationData)) {
      stationData.forEach(station => {
        if (station.ComexId && station.SystemId) {
          cxSet.add(station.SystemId);
        }
      });
    }
    return cxSet;
  }, [stationData]);

  // Convert to 3D systems
  const systems3D = useMemo(() => {
    if (!systemStars || !Array.isArray(systemStars)) return [];
    return systemStars.map(s => ({
      id: s.SystemId, name: s.Name || s.NaturalId, naturalId: s.NaturalId,
      position: [s.PositionX, s.PositionY, s.PositionZ], starType: s.Type,
      factionCode: systemFactions.get(s.SystemId) || null,
      isCX: cxSystems.has(s.SystemId)
    }));
  }, [systemStars, systemFactions, cxSystems]);

  // 3D position map
  const pos3D = useMemo(() => {
    const m = new Map();
    systems3D.forEach(s => m.set(s.id, s.position));
    return m;
  }, [systems3D]);

  // 2D position map - flatten Y to 0 (same X and Z as 3D)
  // This keeps markers in the same X-Z position, they just "lift up" into Y during transition
  const pos2D = useMemo(() => {
    const m = new Map();
    systems3D.forEach(s => {
      // Same X and Z, but Y = 0 (flattened)
      m.set(s.id, [s.position[0], 0, s.position[2]]);
    });
    return m;
  }, [systems3D]);

  // Calculate the center and bounds of the 3D view
  const viewCenter = useMemo(() => {
    if (systems3D.length === 0) return [0, 0, 0];
    let sumX = 0, sumY = 0, sumZ = 0;
    systems3D.forEach(s => {
      sumX += s.position[0];
      sumY += s.position[1];
      sumZ += s.position[2];
    });
    return [sumX / systems3D.length, sumY / systems3D.length, sumZ / systems3D.length];
  }, [systems3D]);

  // Calculate bounds for camera framing
  const bounds = useMemo(() => {
    if (systems3D.length === 0) return { width: 100, depth: 100, height: 100 };
    
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    
    systems3D.forEach(s => {
      if (s.position[0] < minX) minX = s.position[0];
      if (s.position[0] > maxX) maxX = s.position[0];
      if (s.position[1] < minY) minY = s.position[1];
      if (s.position[1] > maxY) maxY = s.position[1];
      if (s.position[2] < minZ) minZ = s.position[2];
      if (s.position[2] > maxZ) maxZ = s.position[2];
    });
    
    return {
      width: maxX - minX,
      height: maxY - minY,
      depth: maxZ - minZ
    };
  }, [systems3D]);

  // Edges
  const edges = useMemo(() => graph?.edges || [], [graph]);

  // Gateway connections
  const gateways = useMemo(() => {
    if (!effectiveGatewayData || !isGatewayLayerVisible || !systemIdByNaturalId) return [];
    const conns = [], seen = new Set();
    effectiveGatewayData.forEach(g => {
      if (g.LinkStatus !== 'ESTABLISHED' || !g.LinkedGatewayId || g.OperationalState !== 'OPERATIONAL') return;
      const linked = effectiveGatewayData.find(x => x.GatewayId === g.LinkedGatewayId);
      if (!linked) return;
      const startId = systemIdByNaturalId[g.SystemNaturalId] || systemIdByNaturalId[g.SystemNaturalId?.toLowerCase()];
      const endId = systemIdByNaturalId[linked.SystemNaturalId] || systemIdByNaturalId[linked.SystemNaturalId?.toLowerCase()];
      if (!startId || !endId) return;
      const key = [startId, endId].sort().join('-');
      if (seen.has(key)) return;
      seen.add(key);
      conns.push({ startSystemId: startId, endSystemId: endId });
    });
    return conns;
  }, [effectiveGatewayData, isGatewayLayerVisible, systemIdByNaturalId]);

  // COGC systems
  const cogcSystems = useMemo(() => {
    const set = new Set();
    if (!overlayProgram || !planetData) return set;
    const progVal = cogcPrograms.find(p => p.display === overlayProgram)?.value;
    if (!progVal) return set;
    Object.entries(planetData).forEach(([id, planets]) => {
      if (planets?.some(pl => {
        if (!pl.COGCPrograms?.length) return false;
        const sorted = [...pl.COGCPrograms].sort((a, b) => b.StartEpochMs - a.StartEpochMs);
        const prog = sorted[1] || sorted[0];
        return prog?.ProgramType === progVal;
      })) set.add(id);
    });
    return set;
  }, [overlayProgram, planetData]);

  const handleClick = useCallback((id) => {
    if (tripSelectingStart || tripSelectingEnd) {
      selectTripSystem(id, systemNames[id] || id.substring(0, 8));
      return;
    }
    highlightSelectedSystem(id);
  }, [highlightSelectedSystem, tripSelectingStart, tripSelectingEnd, selectTripSystem, systemNames]);

  const handleHover = useCallback((id, name, isHover) => {
    setHoveredSystem(isHover ? { id, name } : null);
  }, []);

  // Calculate initial camera height to fit content
  const initialCameraHeight = useMemo(() => {
    const fov = 60 * (Math.PI / 180);
    const aspectRatio = 16 / 9;
    const contentAspect = bounds.width / bounds.depth;
    
    let targetSize;
    if (aspectRatio > contentAspect) {
      targetSize = bounds.depth * 1.3;
    } else {
      targetSize = (bounds.width * 1.3) / aspectRatio;
    }
    
    return targetSize / (2 * Math.tan(fov / 2));
  }, [bounds]);

  if (systems3D.length === 0) {
    return (
      <div className="universe-map-3d">
        <div className="map-loading">
          <div className="loading-spinner"></div>
          <span>Loading 3D Universe...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="universe-map-3d">
      <Canvas 
        camera={{ 
          position: [viewCenter[0], initialCameraHeight, viewCenter[2]], 
          fov: 60, 
          near: 1, 
          far: 5000,
          up: [0, 1, 0]
        }} 
        gl={{ antialias: true }}
      >
        <Scene
          systems={systems3D} pos2D={pos2D} pos3D={pos3D} edges={edges} gateways={gateways}
          selectedId={selectedSystem} searchResults={searchResults} cogcSystems={cogcSystems}
          meteorData={meteorDensityData} showMeteor={isOverlayVisible} tripRoute={tripRoute}
          tripStart={tripStartSystem} tripEnd={tripEndSystem} onSystemClick={handleClick}
          onSystemHover={handleHover} showGates={isGatewayLayerVisible}
          progress={transitionProgress} viewCenter={viewCenter} bounds={bounds}
          pathfindingSelection={pathfindingSelection} pathfindingPath={pathfindingPath}
          ships={ships} flights={flights} systemIdByNaturalId={systemIdByNaturalId}
        />
      </Canvas>
      
      <button 
        className="navigation-controls-toggle"
        onClick={() => setShowNavigationInstructions(!showNavigationInstructions)}
        title="Toggle Navigation Controls"
      >
        ⚙️
      </button>
      
      {showNavigationInstructions && (
        <div className="map-3d-instructions">
          <h4>Navigation</h4>
          <ul>
            <li> Left drag: Rotate</li>
            <li> Right drag: Pan</li>
            <li> Scroll: Zoom</li>
            <li> Click: Select</li>
          </ul>
        </div>
      )}
      
      {/* Ship Tracking and Trip Calculator Controls */}
      <div
        className="ship-filter-control-3d"
        style={{
          position: 'absolute',
          top: '12px',
          right: '16px',
          zIndex: 10,
          background: 'rgba(0, 0, 0, 0.65)',
          color: '#f5f5f5',
          padding: '10px 14px',
          borderRadius: '8px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
          fontSize: '12px',
          lineHeight: 1.4,
          minWidth: '220px'
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Ship Tracking Section */}
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                userSelect: 'none'
              }}
              onClick={() => setShowShipControls(!showShipControls)}
            >
              <span style={{ fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: '11px' }}>
                🚀 Ship Tracking
              </span>
              <span style={{ fontSize: '14px', opacity: 0.7 }}>{showShipControls ? '▼' : '▶'}</span>
            </div>

            {showShipControls && (
              <>
                {!isSilTracking && (
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 500, opacity: 0.85 }}>
                      Username for Flight tracking {!isAuthenticated && '(requires login)'}
                    </span>
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      <input
                        type="text"
                        value={pendingApiUsername}
                        onChange={handleApiUsernameChange}
                        placeholder={isAuthenticated ? "Leave empty to use logged-in user" : "Login required"}
                        disabled={!isAuthenticated}
                        style={{
                          background: isAuthenticated ? '#1f2933' : '#2a2a2a',
                          color: isAuthenticated ? '#f5f5f5' : '#888',
                          border: '1px solid rgba(255,255,255,0.2)',
                          borderRadius: '4px',
                          padding: '5px 6px',
                          fontSize: '12px',
                          outline: 'none',
                          flex: 1,
                          cursor: isAuthenticated ? 'text' : 'not-allowed'
                        }}
                      />
                      <button
                        type="button"
                        onClick={handleApplyApiUsername}
                        disabled={!isAuthenticated || !pendingApiUsername.trim() || pendingApiUsername.trim() === apiUsername}
                        style={{
                          background: (!isAuthenticated || !pendingApiUsername.trim() || pendingApiUsername.trim() === apiUsername) ? '#374151' : '#3b82f6',
                          color: '#f5f5f5',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '5px 10px',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: (!isAuthenticated || !pendingApiUsername.trim() || pendingApiUsername.trim() === apiUsername) ? 'not-allowed' : 'pointer',
                          opacity: (!isAuthenticated || !pendingApiUsername.trim() || pendingApiUsername.trim() === apiUsername) ? 0.5 : 1
                        }}
                      >
                        Apply
                      </button>
                    </div>
                  </label>
                )}

                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 500, opacity: 0.85 }}>Filter shipments by company code</span>
                  <input
                    type="text"
                    value={partnerFilter}
                    onChange={handlePartnerFilterChange}
                    placeholder="Company code"
                    style={{
                      background: '#1f2933',
                      color: '#f5f5f5',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: '4px',
                      padding: '5px 6px',
                      fontSize: '12px',
                      outline: 'none'
                    }}
                  />
                </label>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', position: 'relative', marginTop: '8px' }}>
                  <button
                    type="button"
                    onClick={handleSilTrackingToggle}
                    disabled={silToggleLoading}
                    style={{
                      background: isSilTracking ? '#ef4444' : '#3b82f6',
                      color: '#f5f5f5',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '6px 8px',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: silToggleLoading ? 'not-allowed' : 'pointer',
                      opacity: silToggleLoading ? 0.65 : 1,
                      transition: 'background 0.2s ease',
                      flex: 1
                    }}
                  >
                    {silToggleLoading
                      ? 'Updating…'
                      : (isSilTracking ? 'Disable SIL Shipment Tracking' : 'Track SIL Shipments')}
                  </button>
                  <div
                    style={{
                      position: 'relative',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    onMouseEnter={() => setShowSilTooltip(true)}
                    onMouseLeave={() => setShowSilTooltip(false)}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      style={{ cursor: 'help', opacity: 0.7 }}
                    >
                      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" fill="none" />
                      <text x="8" y="11.5" fontSize="11" fontWeight="bold" textAnchor="middle" fill="currentColor">i</text>
                    </svg>
                    {showSilTooltip && (
                      <div style={{
                        position: 'absolute',
                        bottom: '100%',
                        right: 0,
                        marginBottom: '8px',
                        padding: '8px 10px',
                        background: 'rgba(15, 23, 42, 0.95)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: '6px',
                        fontSize: '11px',
                        lineHeight: '1.5',
                        color: '#f5f5f5',
                        whiteSpace: 'normal',
                        width: '280px',
                        textAlign: 'left',
                        zIndex: 10000,
                        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
                        pointerEvents: 'none'
                      }}>
                        SIL Shipment Tracking mode allows you to track shipments being shipped by OptimizedFunction | SL. You can further filter to look at your shipment by entering your company code above!
                        <div style={{
                          position: 'absolute',
                          top: '100%',
                          right: '8px',
                          width: 0,
                          height: 0,
                          borderLeft: '6px solid transparent',
                          borderRight: '6px solid transparent',
                          borderTop: '6px solid rgba(15, 23, 42, 0.95)'
                        }} />
                      </div>
                    )}
                  </div>
                </div>

                {silToggleError ? (
                  <span style={{ fontSize: '10px', color: '#fca5a5', marginTop: '4px' }}>
                    {silToggleError}
                  </span>
                ) : null}

                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 500, opacity: 0.85 }}>Ship Filter</span>
                  <select
                    value={selectedShipId}
                    onChange={handleShipChange}
                    style={{
                      background: '#1f2933',
                      color: '#f5f5f5',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: '4px',
                      padding: '4px 6px',
                      fontSize: '12px',
                      outline: 'none'
                    }}
                  >
                    {shipOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  type="button"
                  onClick={() => {/* toggleShipLabels functionality */}}
                  style={{
                    marginTop: '4px',
                    background: '#f7a600',
                    color: '#0b0d10',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '6px 8px',
                    fontSize: '11px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s ease'
                  }}
                >
                  Show Ship Labels
                </button>

                {!isSilTracking && (
                  <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 500, opacity: 0.85 }}>Show Group Ships & Flights</span>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <input
                          type="text"
                          placeholder={isAuthenticated ? "Enter Group ID" : "Log in to use group functionality"}
                          value={groupId}
                          onChange={e => setGroupId(e.target.value)}
                          disabled={!isAuthenticated}
                          style={{
                            background: isAuthenticated ? '#1f2933' : '#2a2a2a',
                            color: isAuthenticated ? '#f5f5f5' : '#888',
                            border: '1px solid rgba(255,255,255,0.2)',
                            borderRadius: '4px',
                            padding: '5px 6px',
                            fontSize: '12px',
                            flex: 1
                          }}
                        />
                        <button
                          type="button"
                          onClick={handleGroupFetch}
                          disabled={!isAuthenticated || !groupId.trim() || groupLoading}
                          style={{
                            background: (!isAuthenticated || !groupId.trim() || groupLoading) ? '#374151' : '#3b82f6',
                            color: '#f5f5f5',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '5px 10px',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: (!isAuthenticated || !groupId.trim() || groupLoading) ? 'not-allowed' : 'pointer'
                          }}
                        >
                          {groupLoading ? 'Loading...' : 'Fetch'}
                        </button>
                        <button
                          type="button"
                          onClick={handleGroupClear}
                          style={{
                            background: '#6b7280',
                            color: '#f5f5f5',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '5px 8px',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          Clear
                        </button>
                      </div>
                    </label>

                    {groupError && (
                      <span style={{ fontSize: '11px', color: '#fca5a5', marginTop: '4px' }}>
                        {groupError}
                      </span>
                    )}

                    {groupUsernames.length > 0 && (
                      <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                            userSelect: 'none',
                            marginBottom: '4px'
                          }}
                          onClick={() => setIsGroupUserFilterCollapsed(!isGroupUserFilterCollapsed)}
                        >
                          <span style={{ fontSize: '11px', fontWeight: 500, opacity: 0.85 }}>Filter Group Users</span>
                          <span style={{ fontSize: '14px', opacity: 0.7 }}>{isGroupUserFilterCollapsed ? '▶' : '▼'}</span>
                        </div>

                        {!isGroupUserFilterCollapsed && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
                            <span style={{ fontSize: '11px', fontWeight: 500, opacity: 0.85 }}>Select users to display</span>

                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                              <input
                                type="checkbox"
                                checked={selectedGroupUsers.includes('__all__')}
                                onChange={(e) => handleGroupUserSelectionChange('__all__', e.target.checked)}
                                disabled={!isAuthenticated}
                                style={{ cursor: isAuthenticated ? 'pointer' : 'not-allowed' }}
                              />
                              <span>All Users</span>
                            </label>

                            {groupUsernames.map((username) => (
                              <label key={username} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                                <input
                                  type="checkbox"
                                  checked={selectedGroupUsers.includes(username)}
                                  onChange={(e) => handleGroupUserSelectionChange(username, e.target.checked)}
                                  disabled={!isAuthenticated || selectedGroupUsers.includes('__all__')}
                                  style={{ cursor: (isAuthenticated && !selectedGroupUsers.includes('__all__')) ? 'pointer' : 'not-allowed' }}
                                />
                                <span>{username}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Trip Calculator Section */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: '8px', marginTop: '4px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                userSelect: 'none'
              }}
              onClick={() => setShowTripCalculator(!showTripCalculator)}
            >
              <span style={{ fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: '11px' }}>
                🚀 Gateway Trip Calculator
              </span>
              <span style={{ fontSize: '14px', opacity: 0.7 }}>{showTripCalculator ? '▼' : '▶'}</span>
            </div>

            {showTripCalculator && (
              <div style={{ marginTop: '8px' }}>
                <GatewayTripCalculator embedded={true} />
              </div>
            )}
          </div>
        </div>
      </div>
      
      {hoveredSystem && <div className="hovered-system-info">{hoveredSystem.name}</div>}
    </div>
  );
});

export default UniverseMap3D;
