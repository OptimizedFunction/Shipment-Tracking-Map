import React, { useState } from 'react';
import { Info, BadgeCent, Globe, Truck, BookOpen, Anchor, Earth, Cloud } from 'lucide-react';
import { useDataPoints } from '../contexts/DataPointContext';

const InfoTooltip = () => {
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const { isGatewayLayerVisible } = useDataPoints();

  const toggleTooltip = () => {
    setIsTooltipVisible(!isTooltipVisible);
  };

  return (
    <div className="info-tooltip-container" style={{ position: 'relative' }}>
      <Info
        size={24}
        color="#f7a600"
        style={{ cursor: 'pointer' }}
        onClick={toggleTooltip}
      />
      {isTooltipVisible && (
        <div className="tooltip" style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          backgroundColor: '#333',
          color: 'white',
          padding: '10px',
          borderRadius: '4px',
          boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
          width: 'auto',
          maxWidth: '90vw',
          maxHeight: '80vh',
          overflow: 'auto',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '10px',
          zIndex: 1000,
          border: '2px solid #222222',
        }}>
          <div style={{ minWidth: '250px', flex: '1 1 auto' }}>
            <h4 style={{ margin: '0 0 10px 0' }}>Symbol Legend</h4>
            <h5 style={{ margin: '10px 0 5px 0' }}>Planet Types:</h5>
            <ul style={{ padding: 0, margin: 0, listStyle: 'none' }}>
              <li><Earth size={16} style={{marginRight: '5px', color: '#f7a600'}} /> Rocky Planet</li>
              <li><Cloud size={16} style={{marginRight: '5px', color: '#f7a600'}} /> Gas Giant</li>
            </ul>
            <h5 style={{ margin: '10px 0 5px 0' }}>Resources:</h5>
            <ul style={{ padding: 0, margin: 0, listStyle: 'none' }}>
              <li>🪨 - Mineral resource</li>
              <li>💨 - Gaseous resource</li>
              <li>💧 - Liquid resource</li>
            </ul>
            <h5 style={{ margin: '10px 0 5px 0' }}>Facilities:</h5>
            <ul style={{ padding: 0, margin: 0, listStyle: 'none' }}>
              <li><BadgeCent size={16} style={{marginRight: '5px', color: '#f7a600'}} /> - Local Market</li>
              <li><Globe size={16} style={{marginRight: '5px', color: '#f7a600'}} /> - Chamber of Commerce</li>
              <li><Truck size={16} style={{marginRight: '5px', color: '#f7a600'}} /> - Warehouse</li>
              <li><BookOpen size={16} style={{marginRight: '5px', color: '#f7a600'}} /> - Administration Center</li>
              <li><Anchor size={16} style={{marginRight: '5px', color: '#f7a600'}} /> - Shipyard</li>
            </ul>
            <h5 style={{ margin: '10px 0 5px 0' }}>Planet Rating:</h5>
            <ul style={{ padding: 0, margin: 0, listStyle: 'none' }}>
              <li>Start at <strong>3★</strong>. Deduct stars by environment penalties.</li>
              <li>Penalties:</li>
              <ul style={{ paddingLeft: '16px', margin: '4px 0', listStyle: 'circle' }}>
                <li><code>MCG</code>,<code>SEA</code>: 0</li>
                <li><code>BL</code>, <code>INS</code>, <code>HSE</code>, <code>AEF</code>: −1</li>
                <li><code>MGC</code>, <code>TSH</code>: −2</li>
              </ul>
            </ul>

            <p style={{ margin: '8px 0 0 0' }}>
              Examples:
              <br/>• <code>HSE</code>: 3 − 1 = <strong>2★</strong>
              <br/>• <code>HSE+INS</code>: 3 − (1+1) = <strong>1★</strong>
              <br/>• <code>MGC</code>: 3 − 2 = <strong>1★</strong>
              <br/>• <code>TSH+HSE</code>: 3 − (2+1) = <strong>0★</strong>
              <br/>• <code>SEA</code> or <code>MCG</code> only: <strong>3★</strong>
            </p>
          </div>
          {isGatewayLayerVisible && (
            <div style={{ minWidth: '250px', flex: '1 1 auto' }}>
              <h5 style={{ margin: '10px 0 5px 0' }}>Gateway Links:</h5>
              <ul style={{ padding: 0, margin: 0, listStyle: 'none' }}>
                <li>
                  <svg width="20" height="4" style={{ marginRight: '5px', verticalAlign: 'middle' }}>
                    <line x1="0" y1="2" x2="20" y2="2" stroke="#f91616ff" strokeWidth="3" strokeDasharray="4,2" />
                  </svg>
                  Upto WCB can pass
                </li>
                <li>
                  <svg width="20" height="4" style={{ marginRight: '5px', verticalAlign: 'middle' }}>
                    <line x1="0" y1="2" x2="20" y2="2" stroke="#ea8c08ff" strokeWidth="3" strokeDasharray="4,2" />
                  </svg>
                  Upto LCB can pass
                </li>
                <li>
                  <svg width="20" height="4" style={{ marginRight: '5px', verticalAlign: 'middle' }}>
                    <line x1="0" y1="2" x2="20" y2="2" stroke="#00eeffff" strokeWidth="3" strokeDasharray="4,2" />
                  </svg>
                  Upto VCB can pass
                </li>
                <li>
                  <svg width="20" height="4" style={{ marginRight: '5px', verticalAlign: 'middle' }}>
                    <line x1="0" y1="2" x2="20" y2="2" stroke="#d35cffff" strokeWidth="3" strokeDasharray="4,2" />
                  </svg>
                  Upto HCB can pass
                </li>
                <li>
                  <svg width="20" height="4" style={{ marginRight: '5px', verticalAlign: 'middle' }}>
                    <line x1="0" y1="2" x2="20" y2="2" stroke="#808080ff" strokeWidth="3" strokeDasharray="4,2" />
                  </svg>
                  Non-operational
                </li>
              </ul>
            </div>
          )}
          <div style={{ minWidth: '250px', flex: '1 1 auto' }}>
            <h5 style={{ margin: '10px 0 5px 0' }}>Ship Sizes:</h5>
            <ul style={{ padding: 0, margin: 0, listStyle: 'none' }}>
              <li>
                <svg width="12" height="12" style={{ marginRight: '5px', verticalAlign: 'middle' }}>
                  <circle cx="6" cy="6" r="5" fill="#f91616ff" stroke="#ffffff" strokeWidth="1" />
                </svg>
                Wt 3000 / Vol 1000
              </li>
              <li>
                <svg width="12" height="12" style={{ marginRight: '5px', verticalAlign: 'middle' }}>
                  <circle cx="6" cy="6" r="5" fill="#00eeffff" stroke="#ffffff" strokeWidth="1" />
                </svg>
                Wt 1000 / Vol 3000
              </li>
              <li>
                <svg width="12" height="12" style={{ marginRight: '5px', verticalAlign: 'middle' }}>
                  <circle cx="6" cy="6" r="5" fill="#367cffff" stroke="#ffffff" strokeWidth="1" />
                </svg>
                100 / 100
              </li>
              <li>
                <svg width="12" height="12" style={{ marginRight: '5px', verticalAlign: 'middle' }}>
                  <circle cx="6" cy="6" r="5" fill="#019514ff" stroke="#ffffff" strokeWidth="1" />
                </svg>
                500 / 500
              </li>
              <li>
                <svg width="12" height="12" style={{ marginRight: '5px', verticalAlign: 'middle' }}>
                  <circle cx="6" cy="6" r="5" fill="#fffb00ff" stroke="#ffffff" strokeWidth="1" />
                </svg>
                1000 / 1000
              </li>
              <li>
                <svg width="12" height="12" style={{ marginRight: '5px', verticalAlign: 'middle' }}>
                  <circle cx="6" cy="6" r="5" fill="#ea8c08ff" stroke="#ffffff" strokeWidth="1" />
                </svg>
                2000 / 2000
              </li>
              <li>
                <svg width="12" height="12" style={{ marginRight: '5px', verticalAlign: 'middle' }}>
                  <circle cx="6" cy="6" r="5" fill="#d35cffff" stroke="#ffffff" strokeWidth="1" />
                </svg>
                5000 / 5000
              </li>
              <li>
                <svg width="12" height="12" style={{ marginRight: '5px', verticalAlign: 'middle' }}>
                  <circle cx="6" cy="6" r="5" fill="#9ca3af" stroke="#ffffff" strokeWidth="1" />
                </svg>
                Unknown Capacity
              </li>
            </ul>
            <h5 style={{ margin: '10px 0 5px 0' }}>Ship Markers:</h5>
            <ul style={{ padding: 0, margin: 0, listStyle: 'none' }}>
              <li>
                <svg width="16" height="12" style={{ marginRight: '5px', verticalAlign: 'middle' }}>
                  <path d="M 2 3 L 10 6 L 2 9" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M 2 3 L 10 6 L 2 9" fill="none" stroke="#f91616ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Moving Ship
              </li>
              <li>
                <svg width="12" height="12" style={{ marginRight: '5px', verticalAlign: 'middle' }}>
                  <circle cx="6" cy="6" r="5" fill="#f91616ff" stroke="#ffffff" strokeWidth="1" />
                </svg>
                Idle Ship
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default InfoTooltip;