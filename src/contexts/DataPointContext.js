import React, { createContext, useState, useContext, useCallback, useMemo, useEffect } from 'react';

// Create the context
export const DataPointContext = createContext();

export const DataPointProvider = ({ children }) => {
  // State for system meteorite density data
  const [meteorDensityData, setMeteorDensityData] = useState({});
  const [luminosityData, setLuminosityData] = useState({});
  const [systemNames, setSystemNames] = useState({});
  const [systemIdByNaturalId, setSystemIdByNaturalId] = useState({});
  const [systemPositions3D, setSystemPositions3D] = useState({}); // 3D positions for distance calculation
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Visibility toggle for the overlay
  const [isOverlayVisible, setIsOverlayVisible] = useState(false);

  // Toggle for ship name labels
  const [showShipLabels, setShowShipLabels] = useState(false);

  // Scale setting (absolute vs relative)
  const [useRelativeScale, setUseRelativeScale] = useState(false);

  // Gateway layer state
  const [isGatewayLayerVisible, setIsGatewayLayerVisible] = useState(true);
  const [gatewayData, setGatewayData] = useState([]);
  const [gatewayLoading, setGatewayLoading] = useState(false);
  const [gatewayError, setGatewayError] = useState(null);

  // Simulation mode state
  const [isSimulationMode, setIsSimulationMode] = useState(false);

  // Gateway bubbles visibility state
  const [showGatewayBubbles, setShowGatewayBubbles] = useState(true);

  // Gateway Trip Calculator state
  const [tripCalculatorOpen, setTripCalculatorOpen] = useState(false);
  const [tripStartSystem, setTripStartSystem] = useState(null);
  const [tripEndSystem, setTripEndSystem] = useState(null);
  const [tripSelectingStart, setTripSelectingStart] = useState(false);
  const [tripSelectingEnd, setTripSelectingEnd] = useState(false);
  const [tripShipVolume, setTripShipVolume] = useState(500);
  const [tripRoute, setTripRoute] = useState(null); // Calculated route for visualization

  // Fetch system stars data
  // In src/contexts/DataPointContext.js

  // Fetch system stars data
  useEffect(() => {
    const fetchOverlayData = async () => {
      try {
        setIsLoading(true);
        const staticResponse = await fetch('systemstars.json'); // Enriched file with Luminosity/Density and fresh names

        if (!staticResponse.ok) {
          throw new Error('Failed to fetch all necessary system data');
        }

        const staticData = await staticResponse.json();

        const freshSystemNamesMap = new Map(
          staticData.map(system => [system.SystemId, system.Name])
        );

        const densityMap = {};
        const luminosityMap = {};
        const finalSystemNameMap = {};
        const naturalIdToSystemId = {};
        const positions3D = {};

        staticData.forEach(system => {
          densityMap[system.SystemId] = system.MeteoroidDensity;
          luminosityMap[system.SystemId] = system.Luminosity;

          const freshName = freshSystemNamesMap.get(system.SystemId);

          finalSystemNameMap[system.SystemId] = freshName || system.Name;
          
          // Map NaturalId to SystemId for gateway lookups
          if (system.NaturalId) {
            naturalIdToSystemId[system.NaturalId] = system.SystemId;
            // Also map lowercase version
            naturalIdToSystemId[system.NaturalId.toLowerCase()] = system.SystemId;
          }
          
          // Store 3D position for distance calculations
          if (system.PositionX !== undefined && system.PositionY !== undefined && system.PositionZ !== undefined) {
            positions3D[system.SystemId] = {
              x: system.PositionX,
              y: system.PositionY,
              z: system.PositionZ
            };
          }
        });

        setMeteorDensityData(densityMap);
        setLuminosityData(luminosityMap);
        setSystemNames(finalSystemNameMap);
        setSystemIdByNaturalId(naturalIdToSystemId);
        setSystemPositions3D(positions3D);
        setError(null);

      } catch (err) {
        console.error('Error fetching and combining overlay data:', err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOverlayData();
  }, []);

  // Fetch gateway data when toggled on or on initial load if visible by default
  const fetchGatewayData = useCallback(async () => {
    if (gatewayData.length > 0) {
      // Already have data, just toggle visibility
      return;
    }
    
    try {
      setGatewayLoading(true);
      setGatewayError(null);
      
      const response = await fetch('https://api.fnar.net/gateway?include_upkeeps=false&include_phases=true&include_contractors=false');
      
      if (!response.ok) {
        throw new Error(`Gateway API request failed with status ${response.status}`);
      }
      
      const data = await response.json();
      
      setGatewayData(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching gateway data:', err);
      setGatewayError(err.message);
    } finally {
      setGatewayLoading(false);
    }
  }, [gatewayData.length]);

  // Fetch gateway data on mount since layer is visible by default
  useEffect(() => {
    if (isGatewayLayerVisible && gatewayData.length === 0) {
      fetchGatewayData();
    }
  }, [isGatewayLayerVisible, gatewayData.length, fetchGatewayData]);

  // Get meteorite density for a specific system
  const getSystemMeteorDensity = useCallback((systemId) => {
    return meteorDensityData[systemId] || 0;
  }, [meteorDensityData]);

  const getSystemLuminosity = useCallback((systemId) => {
    return luminosityData[systemId] || 0;
  }, [luminosityData]);

  // Toggle overlay visibility
  const toggleOverlayVisibility = useCallback(() => {
    setIsOverlayVisible(prev => !prev);
  }, []);

  // Toggle scale type
  const toggleScaleType = useCallback(() => {
    setUseRelativeScale(prev => !prev);
  }, []);

  const toggleShipLabels = useCallback(() => {
    setShowShipLabels(prev => !prev);
  }, []);

  // Toggle gateway layer visibility
  const toggleGatewayLayer = useCallback(() => {
    setIsGatewayLayerVisible(prev => {
      const newValue = !prev;
      if (newValue) {
        fetchGatewayData();
      }
      return newValue;
    });
  }, [fetchGatewayData]);

  // Toggle simulation mode
  const toggleSimulationMode = useCallback(() => {
    setIsSimulationMode(prev => !prev);
  }, []);

  // Toggle gateway bubbles visibility
  const toggleGatewayBubbles = useCallback(() => {
    setShowGatewayBubbles(prev => !prev);
  }, []);

  // Simulated gateway data - creates pairs of gateways with established links
  const simulatedGatewayData = useMemo(() => {
    // Helper to create a gateway pair (bidirectional link)
    const createGatewayPair = (name1, loc1, name2, loc2, volumeUpgrades, maxVolume) => {
      const id1 = `sim-${loc1}-${loc2}`;
      const id2 = `sim-${loc2}-${loc1}`;
      return [
        {
          GatewayId: id1,
          Name: `${name1} to ${name2} (Simulated)`,
          NaturalId: `SIM-${loc1}`,
          LocationNaturalId: loc1,
          OperationalState: 'OPERATIONAL',
          JumpsPerDay: 250,
          MaxShipVolume: maxVolume,
          VolumeUpgrades: volumeUpgrades,
          CapacityUpgrades: 0,
          OutgoingLink: id2,
          IncomingLinks: [id2],
          LinkStatus: 'ESTABLISHED',
          FuelPerJump: 30,
          AvailableFuelUnits: 25000,
          MaxFuelUnits: 25000,
          UsageAmount: 0,
          UsageCurrency: 'CIS',
          CurrentPhaseJumps: 0,
          isSimulated: true
        },
        {
          GatewayId: id2,
          Name: `${name2} to ${name1} (Simulated)`,
          NaturalId: `SIM-${loc2}`,
          LocationNaturalId: loc2,
          OperationalState: 'OPERATIONAL',
          JumpsPerDay: 250,
          MaxShipVolume: maxVolume,
          VolumeUpgrades: volumeUpgrades,
          CapacityUpgrades: 0,
          OutgoingLink: id1,
          IncomingLinks: [id1],
          LinkStatus: 'ESTABLISHED',
          FuelPerJump: 30,
          AvailableFuelUnits: 25000,
          MaxFuelUnits: 25000,
          UsageAmount: 0,
          UsageCurrency: 'CIS',
          CurrentPhaseJumps: 0,
          isSimulated: true
        }
      ];
    };

    // 3 volume upgrades, 6000 m3 max volume links
    const highVolumeLinks = [
      ['Katoa', 'UV-351a', 'Etherwind', 'KW-688c'],
      ['Etherwind', 'KW-688c', 'Kiruna', 'XH-594b'],
      ['Ashland', 'PD-754d', 'Promitor', 'VH-331a'],
      ['Etherwind', 'KW-688c', 'Griffonstone', 'LS-300c'],
      ['Griffonstone', 'LS-300c', 'Hephaestus', 'ZV-307c'],
      ['Hephaestus', 'ZV-307c', 'IA-158d', 'IA-158d'],
      ['IA-158b', 'IA-158b', 'Promitor', 'VH-331a'],
      ['Promitor', 'VH-331a', 'Berthier', 'OF-375b'],
      ['Berthier', 'OF-375b', 'LB-428d', 'LB-428d'],
      ['LB-428d', 'LB-428d', 'Montem', 'OT-580b'],
      ['Montem', 'OT-580b', 'Circe', 'QQ-001b'],
      ['Montem', 'OT-580b', 'Kiruna', 'XH-594b'],
      ['Berthier', 'OF-375b', 'GY-694d', 'GY-694d'],
      ['Promitor', 'VH-331a', 'Nova Honshu', 'BS-788c'],
      ['Montem', 'OT-580b', 'Sand', 'WB-675c'],
      ['Sand', 'WB-675c', 'Verdant', 'YI-715b'],
      ['Katoa', 'UV-351a', 'Cadia', 'HM-301b'],
      ['Cadia', 'HM-301b', 'Ementior', 'AM-783c']
    ];

    // 1 volume upgrade, 3000 m3 max volume links
    const lowVolumeLinks = [
      ['Etherwind', 'KW-688c', 'Ashland', 'PD-754d'],
      ['Nova Honshu', 'BS-788c', 'Boucher', 'FK-794b'],
      ['Verdant', 'YI-715b', 'UY-408a', 'UY-408a'],
      ['UY-408a', 'UY-408a', 'Saladin', 'PG-899b'],
      ['Saladin', 'PG-899b', 'Sheol', 'TD-203b'],
    ];

    const allGateways = [];
    
    highVolumeLinks.forEach(([name1, loc1, name2, loc2]) => {
      allGateways.push(...createGatewayPair(name1, loc1, name2, loc2, 3, 6000));
    });
    
    lowVolumeLinks.forEach(([name1, loc1, name2, loc2]) => {
      allGateways.push(...createGatewayPair(name1, loc1, name2, loc2, 1, 3000));
    });

    return allGateways;
  }, []);

  // Effective gateway data based on simulation mode
  const effectiveGatewayData = useMemo(() => {
    return isSimulationMode ? simulatedGatewayData : gatewayData;
  }, [isSimulationMode, simulatedGatewayData, gatewayData]);

  // Trip Calculator functions
  const toggleTripCalculator = useCallback(() => {
    setTripCalculatorOpen(prev => !prev);
  }, []);

  const startSelectingTripStart = useCallback(() => {
    setTripSelectingStart(true);
    setTripSelectingEnd(false);
  }, []);

  const startSelectingTripEnd = useCallback(() => {
    setTripSelectingStart(false);
    setTripSelectingEnd(true);
  }, []);

  const selectTripSystem = useCallback((systemId, systemName) => {
    if (tripSelectingStart) {
      setTripStartSystem({ id: systemId, name: systemName });
      setTripSelectingStart(false);
    } else if (tripSelectingEnd) {
      setTripEndSystem({ id: systemId, name: systemName });
      setTripSelectingEnd(false);
    }
  }, [tripSelectingStart, tripSelectingEnd]);

  const clearTripSelection = useCallback(() => {
    setTripStartSystem(null);
    setTripEndSystem(null);
    setTripSelectingStart(false);
    setTripSelectingEnd(false);
  }, []);

  // Get maximum density and luminosity value for relative scaling
  const maxValues = useMemo(() => ({
    density: Math.max(0, ...Object.values(meteorDensityData)),
    luminosity: Math.max(0, ...Object.values(luminosityData))
  }), [meteorDensityData, luminosityData]);

  // Calculate normalized density based on scale type
  const getNormalizedValue = useCallback((value, type) => {
    if (!useRelativeScale) return value;
    const maxValue = maxValues[type];
    return maxValue === 0 ? 0 : value / maxValue;
  }, [useRelativeScale, maxValues]);

  const contextValue = {
    meteorDensityData,
    luminosityData,
    systemNames,
    systemIdByNaturalId,
    systemPositions3D,
    isOverlayVisible,
    useRelativeScale,
    showShipLabels,
    isLoading,
    error,
    getSystemMeteorDensity,
    getSystemLuminosity,
    toggleOverlayVisibility,
    toggleScaleType,
    toggleShipLabels,
    getNormalizedValue,
    maxValues,
    // Gateway related
    isGatewayLayerVisible,
    gatewayData: effectiveGatewayData,
    gatewayLoading,
    gatewayError,
    toggleGatewayLayer,
    // Simulation mode
    isSimulationMode,
    toggleSimulationMode,
    // Gateway bubbles
    showGatewayBubbles,
    toggleGatewayBubbles,
    // Trip Calculator related
    tripCalculatorOpen,
    setTripCalculatorOpen,
    tripStartSystem,
    tripEndSystem,
    tripSelectingStart,
    tripSelectingEnd,
    tripShipVolume,
    setTripShipVolume,
    tripRoute,
    setTripRoute,
    toggleTripCalculator,
    startSelectingTripStart,
    startSelectingTripEnd,
    selectTripSystem,
    clearTripSelection
  };

  return (
    <DataPointContext.Provider value={contextValue}>
      {children}
    </DataPointContext.Provider>
  );
};

// Custom hook for using the data point context
export const useDataPoints = () => {
  const context = useContext(DataPointContext);
  if (!context) {
    throw new Error('useDataPoints must be used within a DataPointProvider');
  }
  return context;
};