// renderer/components/PaneLayoutComponent.js
import React from 'react';
import TerminalPaneComponent from './TerminalPaneComponent';
import BrowserPaneComponent from './BrowserPaneComponent'; // Import

const AgentMonitoringPanePlaceholder = () => <div className="pane agent-monitoring-pane" id="agent-monitoring-pane"><h3>Agent Monitoring</h3><div className="pane-content" id="agent-monitoring-content-area"><p>Agent Monitoring UI will load here...</p></div></div>;

const PaneLayoutComponent = () => (
  <main className="main-workspace" id="main-workspace-grid">
    <TerminalPaneComponent />
    <BrowserPaneComponent /> {/* Use actual component */}
    <AgentMonitoringPanePlaceholder />
  </main>
);
export default PaneLayoutComponent;
