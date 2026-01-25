import React, { createContext, useState, useContext, useCallback, useMemo, useEffect } from 'react';

// Create the context
export const DataPointContext = createContext();

export const DataPointProvider = ({ children }) => {
  // State for system meteorite density data
  const [meteorDensityData, setMeteorDensityData] = useState({});
  const [luminosityData, setLuminosityData] = useState({});
  const [systemNames, setSystemNames] = useState({});
  const [systemIdByNaturalId, setSystemIdByNaturalId] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Visibility toggle for the overlay
  const [isOverlayVisible, setIsOverlayVisible] = useState(false);

  // Toggle for ship name labels
  const [showShipLabels, setShowShipLabels] = useState(true);

  // Scale setting (absolute vs relative)
  const [useRelativeScale, setUseRelativeScale] = useState(false);

  // Gateway layer state
  const [isGatewayLayerVisible, setIsGatewayLayerVisible] = useState(true);
  const [gatewayData, setGatewayData] = useState([]);
  const [gatewayLoading, setGatewayLoading] = useState(false);
  const [gatewayError, setGatewayError] = useState(null);

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
        });

        setMeteorDensityData(densityMap);
        setLuminosityData(luminosityMap);
        setSystemNames(finalSystemNameMap);
        setSystemIdByNaturalId(naturalIdToSystemId);
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
    gatewayData,
    gatewayLoading,
    gatewayError,
    toggleGatewayLayer
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