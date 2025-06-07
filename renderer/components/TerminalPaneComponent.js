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

  const appendToOutput = (text, type = 'output') => {
    let lineTypeClass = 'terminal-output-line';
    if (type === 'command') lineTypeClass = 'terminal-command-line';
    else if (type === 'error') lineTypeClass = 'terminal-error-line';
    else if (type === 'info') lineTypeClass = 'terminal-info-line'; // Example for a new type

    const prefix = type === 'command' ? '> ' : '';
    const lines = String(text).split('\n'); // Split multiline output
    const newOutputEntries = lines.map(line => ({ text: prefix + line, typeClass: lineTypeClass }));
    setOutputLines(prev => [...prev, ...newOutputEntries]);
  };

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
  };

  const handleInputSubmit = async () => {
    if (inputValue.trim() === '') return;
    const command = inputValue.trim();
    appendToOutput(command, 'command'); // Echo command
    setInputValue('');

    if (command.toLowerCase() === 'clear') {
      setOutputLines([{ text: "Terminal cleared.", typeClass: 'terminal-info-line' }]);
      return;
    }
    if (command.toLowerCase() === 'help') {
        appendToOutput("Mock Commands: help, clear. Use AI chat for other commands (e.g., 'execute terminal command ls -la').", 'output');
        return;
    }

    if (window.electronIPC) {
      try {
        appendToOutput(`Executing via IPC: ${command}`, 'info');
        const result = await window.electronIPC.invoke('execute-command', command);
        if (result.stdout) appendToOutput(result.stdout.trim(), 'output');
        if (result.stderr) appendToOutput(result.stderr.trim(), 'error');
        if (result.error && !result.stderr) appendToOutput(`Error: ${result.error} (Code: ${result.code})`, 'error');
      } catch (e) {
        appendToOutput(`IPC Error: ${e.message}`, 'error');
      }
    } else {
      appendToOutput("Error: electronIPC not available. Command not sent to main process.", 'error');
    }
  };

  useEffect(() => {
    window.skyscopeTerminal = { appendToOutput };
    // Welcome message or initial focus
    const inputField = document.getElementById('terminal-input');
    if (inputField) inputField.focus();

    return () => { delete window.skyscopeTerminal; };
  }, []);


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
            // autoFocus // autoFocus might not work reliably after initial render, using focus() in useEffect
          />
        </div>
      </div>
    </div>
  );
};

export default TerminalPaneComponent;
