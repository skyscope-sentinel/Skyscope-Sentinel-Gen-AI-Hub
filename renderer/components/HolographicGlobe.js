// renderer/components/HolographicGlobe.js
import React from 'react';

const HolographicGlobe = () => (
  <svg viewBox="0 0 100 100" className="w-16 h-16 text-cyan-400" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg" style={{width: '4rem', height: '4rem'}}>
    <defs>
      <filter id="glow">
        <feGaussianBlur stdDeviation="1.5" result="coloredBlur" />
        <feMerge>
          <feMergeNode in="coloredBlur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <linearGradient id="skyGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#00d2ff" />
        <stop offset="100%" stopColor="#3a7bd5" />
      </linearGradient>
    </defs>
    <g style={{ filter: 'url(#glow)' }}>
      <ellipse cx="50" cy="50" rx="40" ry="40" stroke="url(#skyGradient)" strokeWidth="1" strokeOpacity="0.8" />
      <ellipse cx="50" cy="50" rx="40" ry="15" stroke="url(#skyGradient)" strokeWidth="0.7" strokeOpacity="0.7" />
      <path d="M10 50 Q 50 35, 90 50" strokeWidth="0.5" strokeOpacity="0.5" />
      <path d="M10 50 Q 50 65, 90 50" strokeWidth="0.5" strokeOpacity="0.5" />
      <path d="M20 50 Q 50 42, 80 50" strokeWidth="0.5" strokeOpacity="0.5" />
      <path d="M20 50 Q 50 58, 80 50" strokeWidth="0.5" strokeOpacity="0.5" />
      <path d="M50 10 C 70 30, 70 70, 50 90" strokeWidth="0.5" strokeOpacity="0.5">
        <animateTransform attributeName="transform" type="rotate" from="0 50 50" to="360 50 50" dur="20s" repeatCount="indefinite" />
      </path>
      <path d="M50 10 C 30 30, 30 70, 50 90" strokeWidth="0.5" strokeOpacity="0.5">
         <animateTransform attributeName="transform" type="rotate" from="0 50 50" to="360 50 50" dur="20s" repeatCount="indefinite" />
      </path>
       <path d="M50 10 C 50 30, 50 70, 50 90" strokeWidth="0.5" strokeOpacity="0.5">
         <animateTransform attributeName="transform" type="rotate" from="30 50 50" to="390 50 50" dur="15s" repeatCount="indefinite" />
      </path>
    </g>
  </svg>
);

export default HolographicGlobe;
