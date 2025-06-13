// renderer/components/HeaderComponent.js
import React from 'react';
import HolographicGlobe from './HolographicGlobe';

const HeaderComponent = () => (
  <header className="app-header">
    <div className="logo-area">
      <HolographicGlobe />
      <h1 className="app-title">SKYSCOPE AI</h1>
    </div>
  </header>
);

export default HeaderComponent;
