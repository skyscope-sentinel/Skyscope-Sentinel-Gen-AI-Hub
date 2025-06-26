// renderer/components/NewAgentFormComponent.js
import React, { useState, useEffect } from 'react';

const NewAgentFormComponent = ({ args, status, respond }) => {
  const [agentId, setAgentId] = useState(args?.suggestedId || '');
  const [persona, setPersona] = useState(args?.suggestedPersona || '');
  const [initialGoal, setInitialGoal] = useState(args?.suggestedGoal || ''); // Handle suggestedGoal if provided
  const [error, setError] = useState('');

  // If AI provides suggestions via args, pre-fill the form when the component mounts or args change.
  useEffect(() => {
    if (args?.suggestedId) setAgentId(args.suggestedId);
    if (args?.suggestedPersona) setPersona(args.suggestedPersona);
    if (args?.suggestedGoal) setInitialGoal(args.suggestedGoal);
  }, [args]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!agentId.trim() || !persona.trim()) {
      setError("Agent ID and Persona are required.");
      return;
    }
    setError('');
    // Send confirmed data back to CopilotKit action handler
    respond({ confirmed: true, agentId: agentId.trim(), persona: persona.trim(), initialGoal: initialGoal.trim() });
  };

  const handleCancel = () => {
    // Send cancellation confirmation back
    respond({ confirmed: false });
  };

  // This component should only be fully interactive and visible when CopilotKit signals it's time for user input.
  if (status !== 'awaitingUserInput') {
    // Optionally, render a minimal loading state or null if CopilotKit handles loading indicators.
    // Returning null is often fine as CopilotKit might have its own "waiting for action" UI.
    // However, if a specific loading message for this form is desired:
    // return <div className="new-agent-form-overlay"><div className="new-agent-form-content"><p>Preparing agent configuration form...</p></div></div>;
    return null;
  }

  return (
    <div className="new-agent-form-overlay">
      <div className="new-agent-form-content">
        <h4>Configure New SKYSCOPE Agent</h4>
        {error && <p className="form-error-message">{error}</p>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="agentIdInputNew">Agent ID:</label> {/* Changed ID to avoid conflict if old test areas persist */}
            <input
              type="text"
              id="agentIdInputNew"
              className="url-input-field" // Reuse existing style
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              placeholder="e.g., research_assistant_01"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="personaInputNew">Persona:</label>
            <textarea
              id="personaInputNew"
              className="url-input-field" // Reuse existing style
              value={persona}
              onChange={(e) => setPersona(e.target.value)}
              rows="4"
              placeholder="Describe the agent's role, capabilities, and personality. E.g., A helpful AI assistant specialized in web research and data extraction."
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="initialGoalInputNew">Initial Goal (Optional):</label>
            <input
              type="text"
              id="initialGoalInputNew"
              className="url-input-field" // Reuse existing style
              value={initialGoal}
              onChange={(e) => setInitialGoal(e.target.value)}
              placeholder="e.g., Research the latest trends in AI for 2024"
            />
          </div>
          <div className="form-actions">
            <button type="button" className="control-button reject-button" onClick={handleCancel}>Cancel</button>
            <button type="submit" className="control-button approve-button">Create Agent</button>
          </div>
        </form>
      </div>
    </div>
  );
};
export default NewAgentFormComponent;
