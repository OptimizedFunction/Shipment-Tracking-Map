import React, { useContext, useState, useCallback, useRef, useEffect } from 'react';
import UniverseMap from './components/UniverseMap';
import UniverseMap3D from './components/UniverseMap3D';
import Sidebar from './components/Sidebar';
import PathfindingToggle from './components/PathfindingToggle';
import MeteorDensityToggle from './components/MeteorDensityToggle';
import GatewayToggle from './components/GatewayToggle';
import SearchField from './components/SearchField';
import MaterialSearchField from './components/MaterialSearchField';
import FilterCategories from './components/FilterCategories';
import InfoTooltip from './components/InfoTooltip';
import { GraphProvider } from './contexts/GraphContext';
import { SelectionProvider } from './contexts/SelectionContext';
import { SearchProvider, SearchContext } from './contexts/SearchContext';
import { CogcOverlayProvider } from './contexts/CogcOverlayContext';
import { DataPointProvider } from './contexts/DataPointContext';
import { AuthProvider, AuthContext } from './contexts/AuthContext';
import LoginForm from './components/LoginForm';
import './App.css';
import './components/FilterCategories.css';
import logo from './logo.png';

const App = () => {
  const [showFilters, setShowFilters] = useState(window.innerWidth > 768);
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  return (
    <AuthProvider>
      <GraphProvider>
        <SelectionProvider>
          <SearchProvider>
            <CogcOverlayProvider>
              <DataPointProvider>
                <AppContent
                  showFilters={showFilters}
                  setShowFilters={setShowFilters}
                  isLoginOpen={isLoginOpen}
                  onOpenLogin={() => setIsLoginOpen(true)}
                  onCloseLogin={() => setIsLoginOpen(false)}
                />
              </DataPointProvider>
            </CogcOverlayProvider>
          </SearchProvider>
        </SelectionProvider>
      </GraphProvider>
    </AuthProvider>
  );
};

const AppContent = ({ showFilters, setShowFilters, isLoginOpen, onOpenLogin, onCloseLogin }) => {
  const { clearSearch, isCompanySearch, toggleCompanySearch } = useContext(SearchContext);
  const { isAuthenticated, userName, logout, authLoading } = useContext(AuthContext);
  
  // Transition progress: 0 = fully 2D, 1 = fully 3D
  const [transitionProgress, setTransitionProgress] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const animationRef = useRef(null);
  
  // Smooth animation function
  const animateTo = useCallback((targetProgress) => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    
    setIsAnimating(true);
    const startProgress = transitionProgress;
    const startTime = performance.now();
    const duration = 800; // 800ms for smooth transition
    
    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const t = Math.min(elapsed / duration, 1);
      
      // Ease out cubic for smooth deceleration
      const eased = 1 - Math.pow(1 - t, 3);
      const newProgress = startProgress + (targetProgress - startProgress) * eased;
      
      setTransitionProgress(newProgress);
      
      if (t < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setTransitionProgress(targetProgress);
        setIsAnimating(false);
        animationRef.current = null;
      }
    };
    
    animationRef.current = requestAnimationFrame(animate);
  }, [transitionProgress]);
  
  // Toggle between 2D and 3D
  const handleViewToggle = useCallback(() => {
    const target = transitionProgress < 0.5 ? 1 : 0;
    animateTo(target);
  }, [transitionProgress, animateTo]);
  
  // Handle slider change for manual control
  const handleSliderChange = useCallback((e) => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      setIsAnimating(false);
    }
    setTransitionProgress(parseFloat(e.target.value));
  }, []);
  
  // Cleanup animation on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <div className="header-left">
          <img src={logo} alt="Logo" className="App-logo" />
          <h1>Taiyi's Prosperous Universe Map</h1>
        </div>
        <div className="header-center">
          <button
            className="filter-toggle"
            onClick={() => setShowFilters(!showFilters)}
          >
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </button>
          {showFilters && <FilterCategories />}
        </div>
        <div className="header-right">
          <MaterialSearchField />
          <SearchField />
        </div>
        <div className="header-buttons">
          <button className="clear-button" onClick={clearSearch}>Clear</button>
          <button
            onClick={toggleCompanySearch}
            className={`toggle-token company-search-toggle ${isCompanySearch ? 'active' : ''}`}
            data-tooltip={"Enter company code to search base data using FIO"}
          >
            Company
          </button>
        </div>
        <div className="header-auth">
          {isAuthenticated ? (
            <>
              <span className="auth-username" title={userName || 'Authenticated user'}>
                {userName || 'Signed in'}
              </span>
              <button
                className="auth-button logout-button"
                onClick={logout}
                disabled={authLoading}
              >
                Logout
              </button>
            </>
          ) : (
            <button
              className="auth-button login-button"
              onClick={onOpenLogin}
            >
              Login
            </button>
          )}
        </div>
        <div className="header-info">
          <InfoTooltip />
          <div className="toggle-stack-container">
            <div className="pathfinding-toggle-container">
              <PathfindingToggle />
            </div>
            <div className="pathfinding-toggle-container">
              <MeteorDensityToggle />
            </div>
            <div className="pathfinding-toggle-container">
              <GatewayToggle />
            </div>
          </div>
        </div>
      </header>
      <div className="main-content">
        <div className="map-view-container">
          {/* 2D Map - fades out as transition increases */}
          <div 
            className="map-layer map-2d"
            style={{ 
              opacity: 1 - transitionProgress,
              pointerEvents: transitionProgress > 0.5 ? 'none' : 'auto',
              visibility: transitionProgress >= 1 ? 'hidden' : 'visible'
            }}
          >
            <UniverseMap />
          </div>
          
          {/* 3D Map - fades in as transition increases */}
          <div 
            className="map-layer map-3d"
            style={{ 
              opacity: transitionProgress,
              pointerEvents: transitionProgress < 0.5 ? 'none' : 'auto',
              visibility: transitionProgress <= 0 ? 'hidden' : 'visible'
            }}
          >
            <UniverseMap3D transitionProgress={transitionProgress} />
          </div>
        </div>
        <Sidebar />
        
        {/* View Toggle Control */}
        <div className="view-toggle-container">
          <div className="view-toggle-control">
            <span className={`view-label ${transitionProgress < 0.5 ? 'active' : ''}`}>2D</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={transitionProgress}
              onChange={handleSliderChange}
              className="view-slider"
            />
            <span className={`view-label ${transitionProgress >= 0.5 ? 'active' : ''}`}>3D</span>
          </div>
          <button 
            className="view-toggle-button"
            onClick={handleViewToggle}
            disabled={isAnimating}
          >
            {transitionProgress < 0.5 ? 'Switch to 3D' : 'Switch to 2D'}
          </button>
        </div>
      </div>
      {isLoginOpen && !isAuthenticated && (
        <LoginForm onClose={onCloseLogin} />
      )}
    </div>
  );
};

export default App;