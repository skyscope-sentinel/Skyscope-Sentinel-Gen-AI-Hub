// renderer/components/AgentMonitoringPaneComponent.js
import React, { useState, useEffect, useRef } from 'react';

const AgentMonitoringPaneComponent = ({ agentManagerInstance }) => {
  const [_, setForceUpdate] = useState(0); // To trigger re-renders on interval

  useEffect(() => {
    if (!agentManagerInstance) return;
    const intervalId = setInterval(() => {
      setForceUpdate(val => val + 1); // Force re-render to get latest agent states
    }, 2000); // Update every 2 seconds
    return () => clearInterval(intervalId);
  }, [agentManagerInstance]);

  if (!agentManagerInstance) {
    return (
      <div className="pane agent-monitoring-pane" id="agent-monitoring-pane">
        <h3>Agent Activity & Monitoring</h3>
        <div className="pane-content" id="agent-monitoring-content-area">
          <p>AgentManager not available.</p>
        </div>
      </div>
    );
  }

  const agents = agentManagerInstance.getAllAgents ? agentManagerInstance.getAllAgents() : [];
  // Determine active agent: first one in 'active' state, or first in queue, or first registered.
  let activeAgentForDisplay = agents.find(agent => agent.state === 'active');
  if (!activeAgentForDisplay && agentManagerInstance.getAgentQueue && agentManagerInstance.getAgentQueue().length > 0) {
    const nextAgentId = agentManagerInstance.getAgentQueue()[0];
    activeAgentForDisplay = agentManagerInstance.getAgentById ? agentManagerInstance.getAgentById(nextAgentId) : null;
  }
  if (!activeAgentForDisplay && agents.length > 0) {
    activeAgentForDisplay = agents[0]; // Fallback to the first agent if no active/queued
  }


  return (
    <div className="pane agent-monitoring-pane" id="agent-monitoring-pane">
      <h3>Agent Activity & Monitoring</h3>
      <div className="pane-content" id="agent-monitoring-content-area">
        <div className="system-process-display" id="system-process-display">
          <p>PROC: [Ollama: {agentManagerInstance.isOllamaBusy && agentManagerInstance.isOllamaBusy() ? 'Busy' : 'Idle'}] [CopilotKit: Active]</p>
          <p>SYS: [CPU: --%] [Mem: --%] [Net: --KB/s] (Live stats pending)</p>
        </div>
        <hr />

        <h4>Agent Statuses:</h4>
        <div id="agent-status-list" className="agent-status-list">
          {agents.length > 0 ? agents.map(agent => (
            <div key={agent.id} className={`agent-status-item ${agent.id === activeAgentForDisplay?.id ? 'active-agent-highlight' : ''}`}>
              <strong>ID:</strong> {agent.id} ({agent.persona?.substring(0, 30)}...)<br />
              <strong>State:</strong> <span className={`status-${agent.state?.toLowerCase()}`}>{agent.state}</span> | <strong>Goal:</strong> {agent.currentGoal?.substring(0,40) || 'N/A'}{agent.currentGoal?.length > 40 ? '...' : ''}<br/>
              <strong>Task:</strong> {agent.currentMicroTaskName || 'N/A'} ({agent.microTaskProgress || 0}%)
            </div>
          )) : <p>No agents registered.</p>}
        </div>
        <hr />

        <h4>Focus Agent Details ({activeAgentForDisplay ? activeAgentForDisplay.id : 'N/A'}):</h4>
        {activeAgentForDisplay && (
          <div id="active-agent-progress-area" className="active-agent-progress-area">
            <p id="active-agent-name"><strong>Focus:</strong> {activeAgentForDisplay.id} - {activeAgentForDisplay.currentMicroTaskName || 'Idle'}</p>
            <div className="progress-bar-container">
              <div id="progress-bar-fill" className="progress-bar-fill" style={{ width: `${activeAgentForDisplay.microTaskProgress || 0}%` }}></div>
            </div>
            <span id="progress-bar-percentage" className="progress-bar-percentage">{activeAgentForDisplay.microTaskProgress || 0}%</span>
            <div id="futuristic-squares-container" className="futuristic-squares-container">
              {[...Array(9)].map((_, i) => (
                <span key={i} className={`fsquare ${(activeAgentForDisplay.microTaskProgress || 0) >= ((i + 1) * 11) ? 'active' : ''}`}></span>
              ))}
            </div>
            <h5>Recent Action Log (Focus Agent):</h5>
            <div id="active-agent-action-log" className="action-log-display">
              {activeAgentForDisplay.actionLog && activeAgentForDisplay.actionLog.length > 0 ?
                activeAgentForDisplay.actionLog.slice().reverse().map((log, index) => ( // Display recent 5, newest first
                  <p key={index} className={`log-status-${log.status}`}><em>{log.timestamp}:</em> {log.description}</p>
                )).slice(0,5) : <p>No actions logged yet for this agent.</p>}
            </div>
          </div>
        )}
        <hr />
        <h4>Overall Agent Activity Log:</h4>
        <pre id="agent-activity-log-monitor" className="agent-activity-log-monitor-class">
          SKYSCOPE AI Agent Log Initialized...\n
        </pre>
      </div>
    </div>
  );
};
export default AgentMonitoringPaneComponent;
