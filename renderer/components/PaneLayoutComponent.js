// renderer/components/PaneLayoutComponent.js
import React from 'react';
import TerminalPaneComponent from './TerminalPaneComponent';
import BrowserPaneComponent from './BrowserPaneComponent';
import AgentMonitoringPaneComponent from './AgentMonitoringPaneComponent'; // Import

// Pass agentManagerInstance as a prop
const PaneLayoutComponent = ({ agentManagerInstance }) => (
  <main className="main-workspace" id="main-workspace-grid">
    <TerminalPaneComponent />
    <BrowserPaneComponent />
    <AgentMonitoringPaneComponent agentManagerInstance={agentManagerInstance} /> {/* Use & pass prop */}
  </main>
);
export default PaneLayoutComponent;
