// renderer/components/TerminalPaneComponent.js
import React, { useState, useEffect, useRef } from 'react';

const TerminalPaneComponent = () => {
  const [outputLines, setOutputLines] = useState([
    { text: "SKYSCOPE AI Terminal [v0.2.0 - Electron Integrated]", typeClass: 'terminal-output-line' },
    { text: "Enter commands below or have the AI execute them.", typeClass: 'terminal-output-line' },
    { text: "", typeClass: 'terminal-output-line' }
  ]);
  const [inputValue, setInputValue] = useState('');
  const outputEndRef = useRef(null);

  const scrollToBottom = () => {
    outputEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [outputLines]);

  // This function updates the component's state, causing a re-render.
  const appendToOutput = (text, type = 'output') => {
    let lineTypeClass = 'terminal-output-line';
    if (type === 'command') lineTypeClass = 'terminal-command-line';
    else if (type === 'error') lineTypeClass = 'terminal-error-line';
    else if (type === 'info') lineTypeClass = 'terminal-info-line';

    const prefix = type === 'command' ? '> ' : '';
    // Handle multi-line text by creating multiple entries
    const lines = String(text).split('\n');
    const newOutputEntries = lines.map(line => ({ text: prefix + line, typeClass: lineTypeClass }));
    setOutputLines(prev => [...prev, ...newOutputEntries]);
  };

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
  };

  const handleInputSubmit = async () => {
    if (inputValue.trim() === '') return;
    const command = inputValue.trim();

    appendToOutput(command, 'command'); // Use the state-updating appendToOutput
    setInputValue('');

    if (command.toLowerCase() === 'clear') {
      setOutputLines([{ text: "Terminal cleared. Type 'help' for commands.", typeClass: 'terminal-info-line' }]);
      return;
    }
    if (command.toLowerCase() === 'help') {
        appendToOutput("Mock Commands: help, clear. Use AI chat for other commands (e.g., 'execute terminal command ls -la').", 'output');
        return;
    }

    if (window.electronIPC && typeof window.electronIPC.invoke === 'function') {
      try {
        // appendToOutput(`Executing: ${command}`, 'info'); // Already echoed as command
        const result = await window.electronIPC.invoke('execute-command', command);
        if (result.stdout) appendToOutput(result.stdout.trim(), 'output');
        if (result.stderr) appendToOutput(result.stderr.trim(), 'error');
        // Avoid double-printing error if stderr already contained it
        if (result.error && (!result.stderr || !result.stderr.includes(result.error))) {
            appendToOutput(`Error: ${result.error} (Code: ${result.code})`, 'error');
        } else if (result.error && result.stderr && result.stderr.includes(result.error)) {
            // If stderr contained the error message, we've already printed it.
            // We might still want to log the code if it's different or provides more info.
            // For now, covered by stderr print.
        }

      } catch (e) {
        appendToOutput(`IPC Error: ${e.message}`, 'error');
      }
    } else {
      const noIPCMessage = "Error: electronIPC not available. Cannot execute command directly from terminal input.";
      appendToOutput(noIPCMessage, 'error');
    }
  };

  // Expose the state-updating appendToOutput function to the window context
  useEffect(() => {
    window.skyscopeTerminal = { appendToOutput: appendToOutput };

    const inputField = document.getElementById('terminal-input');
    if (inputField) inputField.focus();

    return () => { delete window.skyscopeTerminal; };
  }, [appendToOutput]); // Add appendToOutput to dependency array as it's defined in component scope


  return (
    <div className="pane terminal-pane" id="terminal-pane">
      <h3>Terminal</h3>
      <div className="pane-content" id="terminal-content-area">
        <div id="terminal-output" className="terminal-output-display">
          {outputLines.map((line, index) => (
            <p key={index} className={line.typeClass}>{line.text}</p>
          ))}
          <div ref={outputEndRef} />
        </div>
        <div className="terminal-input-line">
          <span className="terminal-prompt">&gt;</span>
          <input
            type="text"
            id="terminal-input"
            className="terminal-input-field"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={(e) => e.key === 'Enter' && handleInputSubmit()}
            // autoFocus attribute might be sufficient, but useEffect focus is more reliable after re-renders.
          />
        </div>
      </div>
    </div>
  );
};

export default TerminalPaneComponent;
