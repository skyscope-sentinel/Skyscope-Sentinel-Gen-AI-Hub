// renderer/components/AgentMonitoringPaneComponent.js
import React, { useState, useEffect, useRef } from 'react';

const getIconForState = (state, isPinned) => { /* ... (same as before) ... */
  if (isPinned) return '📌';
  switch (state) {
    case 'active': case 'active_processing_llm': case 'active_processing_tool_result': return '▶️';
    case 'idle': return '⏸️';
    case 'awaiting_tool_call': return '🛠️';
    case 'completed_goal': return '✅';
    case 'error': return '❗';
    default: return '▫️';
  }
};

const AgentMonitoringPaneComponent = ({ agentManagerInstance, onPinnedAgentChange, onRosterChange }) => { // Accept new props
  const [_, setForceUpdate] = useState(0);
  const [pinnedAgentId, setPinnedAgentId] = useState(null);
  const activityLogRef = useRef(null);

  useEffect(() => {
    if (!agentManagerInstance) return;
    const intervalId = setInterval(() => {
      setForceUpdate(val => val + 1);
      // Call onRosterChange with current agent summary
      if (onRosterChange) {
        const currentAgents = agentManagerInstance.getAllAgents ? agentManagerInstance.getAllAgents() : [];
        const summary = currentAgents.map(agent => ({
          id: agent.id,
          state: agent.state,
          goal: agent.currentGoal?.substring(0, 70) + (agent.currentGoal?.length > 70 ? '...' : ''), // Truncated goal
          currentMicroTaskName: agent.currentMicroTaskName,
          microTaskProgress: agent.microTaskProgress
        }));
        onRosterChange(summary);
      }
    }, 2000);
    return () => clearInterval(intervalId);
  }, [agentManagerInstance, onRosterChange]); // Add onRosterChange to dependencies

  useEffect(() => {
    if (activityLogRef.current) {
      activityLogRef.current.scrollTop = activityLogRef.current.scrollHeight;
    }
  });

  // Effect to call onPinnedAgentChange when pinnedAgentId changes
  useEffect(() => {
    if (onPinnedAgentChange) {
      onPinnedAgentChange(pinnedAgentId);
    }
  }, [pinnedAgentId, onPinnedAgentChange]);


  if (!agentManagerInstance) {
    return ( /* ... fallback UI ... */
        <div className="pane agent-monitoring-pane" id="agent-monitoring-pane">
          <h3><span className="pane-title-icon">📡</span> Agent Activity & Monitoring</h3>
          <div className="pane-content" id="agent-monitoring-content-area-flex">
            <p>AgentManager not available.</p>
          </div>
        </div>
      );
  }

  const agents = agentManagerInstance.getAllAgents ? agentManagerInstance.getAllAgents() : [];
  let focusAgent;
  if (pinnedAgentId) {
    focusAgent = agents.find(agent => agent.id === pinnedAgentId);
  }
  if (!focusAgent) {
    focusAgent = agents.find(agent => agent.state && (agent.state.startsWith('active_') || agent.state === 'active')) ||
                 (agentManagerInstance.getAgentQueue && agentManagerInstance.getAgentQueue().length > 0 ?
                    agentManagerInstance.getAgentById(agentManagerInstance.getAgentQueue()[0]) : null) ||
                 agents[0];
  }

  const handleAgentItemClick = (agentId) => {
    const newPinnedId = pinnedAgentId === agentId ? null : agentId;
    setPinnedAgentId(newPinnedId);
    // onPinnedAgentChange is now called via useEffect on pinnedAgentId change
  };

  const clearPinnedAgent = () => {
    setPinnedAgentId(null);
    // onPinnedAgentChange is now called via useEffect on pinnedAgentId change
  };

  return (
    <div className="pane agent-monitoring-pane" id="agent-monitoring-pane">
      <h3><span className="pane-title-icon">📡</span> Agent Activity & Monitoring</h3>
      <div className="pane-content" id="agent-monitoring-content-area-flex">
        <div className="monitoring-section system-processes-section">
           <h4>System Processes</h4>
          <div className="system-process-display" id="system-process-display">
            <p>PROC: [Ollama: {agentManagerInstance.isOllamaBusy && agentManagerInstance.isOllamaBusy() ? 'Busy' : 'Idle'}] [CopilotKit: Active]</p>
            <p>SYS: [CPU: --%] [Mem: --%] [Net: --KB/s] (Live stats pending)</p>
          </div>
        </div>
        <div className="monitoring-section agent-list-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4>Agent Roster ({agents.length})</h4>
            {pinnedAgentId && focusAgent && <button onClick={clearPinnedAgent} className="control-button clear-pin-button">Clear Pin (Focus: {focusAgent.id})</button>}
          </div>
          <div id="agent-status-list" className="agent-status-list">
            {agents.length > 0 ? agents.map(agent => {
              const isPinned = agent.id === pinnedAgentId;
              const isFocusNotPinned = focusAgent && agent.id === focusAgent.id && !isPinned;
              const stateIcon = getIconForState(agent.state, isPinned);
              const personaSummary = agent.persona?.substring(0, 30) + (agent.persona?.length > 30 ? '...' : '');
              const goalSummary = agent.currentGoal?.substring(0, 40) + (agent.currentGoal?.length > 40 ? '...' : '');
              let classNames = `agent-status-item status-${agent.state?.toLowerCase() || 'unknown'}`;
              if (isPinned) classNames += ' pinned-agent-highlight';
              else if (isFocusNotPinned) classNames += ' active-agent-highlight';
              if (agent.state === 'awaiting_tool_call') classNames += ' awaiting-tool-highlight';
              return ( /* ... existing agent item JSX ... */
                <div key={agent.id} className={classNames} onClick={() => handleAgentItemClick(agent.id)}
                  title={`Click to ${isPinned ? 'unpin' : 'pin'} agent. Persona: ${agent.persona}`}>
                  <span className="agent-state-icon" title={`State: ${agent.state} ${isPinned ? '(Pinned)' : ''}`}>{stateIcon}</span>
                  <strong>ID:</strong> {agent.id} (<span title={agent.persona}>{personaSummary}</span>)<br />
                  <span className="agent-goal" title={agent.currentGoal}><strong>Goal:</strong> {goalSummary || 'N/A'}</span><br/>
                  <span className="agent-task"><strong>Task:</strong> {agent.currentMicroTaskName || 'N/A'} ({agent.microTaskProgress || 0}%)</span>
                  {agent.state === 'awaiting_tool_call' && agent.requestedTool && agent.requestedTool.name && (
                    <div className="tool-request-details">
                      <strong>Tool Req:</strong> {agent.requestedTool.name}({agent.requestedTool.params?.substring(0,30)}...) ID: {agent.requestedTool.id}
                    </div>
                  )}
                </div>
              );
            }) : <p>No agents registered.</p>}
          </div>
        </div>
        {focusAgent && ( /* ... Focus Agent Details JSX ... as before ... */
          <div className="monitoring-section focus-agent-section">
            <h4>Focus Agent: {focusAgent.id} {pinnedAgentId === focusAgent.id ? ' (Pinned)' : ''}</h4>
            <div id="active-agent-progress-area" className="active-agent-progress-area">
              <p id="active-agent-name" title={focusAgent.persona}><strong>Persona:</strong> {focusAgent.persona?.substring(0,50)}...</p>
              <p><strong>Current Task:</strong> {focusAgent.currentMicroTaskName || 'Idle'}</p>
              <div className="progress-bar-container">
                <div id="progress-bar-fill" className="progress-bar-fill" style={{ width: `${focusAgent.microTaskProgress || 0}%` }}></div>
              </div>
              <span id="progress-bar-percentage" className="progress-bar-percentage">{focusAgent.microTaskProgress || 0}%</span>
              <div id="futuristic-squares-container" className="futuristic-squares-container">
                {[...Array(9)].map((_, i) => (
                  <span key={i} className={`fsquare ${(focusAgent.microTaskProgress || 0) >= ((i + 1) * 11) ? 'active' : ''}`}></span>
                ))}
              </div>
              <h5>Recent Action Log ({focusAgent.id}):</h5>
              <div id="active-agent-action-log" className="action-log-display">
                {focusAgent.actionLog && focusAgent.actionLog.length > 0 ?
                  focusAgent.actionLog.slice().reverse().map((log, index) => (
                    <p key={index} className={`log-status-${log.status}`}><em>{log.timestamp}:</em> {log.description}</p>
                  )) : <p>No actions logged for this agent.</p>}
              </div>
            </div>
          </div>
        )}
        <div className="monitoring-section global-log-section">
           <h4>Global Activity Log</h4>
          <pre id="agent-activity-log-monitor" ref={activityLogRef} className="agent-activity-log-monitor-class">
            SKYSCOPE AI Agent Log Initialized...{'\n'}
          </pre>
        </div>
      </div>
    </div>
  );
};
export default AgentMonitoringPaneComponent;
