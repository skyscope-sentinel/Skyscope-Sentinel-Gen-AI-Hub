// renderer/components/PaneLayoutComponent.js
import React from 'react';
import TerminalPaneComponent from './TerminalPaneComponent';
import BrowserPaneComponent from './BrowserPaneComponent';
import AgentMonitoringPaneComponent from './AgentMonitoringPaneComponent';

// Pass down state updater props from HomePage to the relevant child panes
const PaneLayoutComponent = ({
  agentManagerInstance,
  onTerminalOutputUpdate,
  onBrowserUrlChange,
  onPinnedAgentChange,
  onRosterChange
}) => (
  <main className="main-workspace" id="main-workspace-grid">
    <TerminalPaneComponent
      onTerminalOutputUpdate={onTerminalOutputUpdate}
    />
    <BrowserPaneComponent
      onBrowserUrlChange={onBrowserUrlChange}
    />
    <AgentMonitoringPaneComponent
      agentManagerInstance={agentManagerInstance}
      onPinnedAgentChange={onPinnedAgentChange}
      onRosterChange={onRosterChange}
    />
  </main>
);
export default PaneLayoutComponent;
