// renderer/components/SuggestionApprovalComponent.js
import React, { useState, useEffect } from 'react';

const SuggestionApprovalComponent = ({ args, status, respond }) => {
  const { filePath, analysisTaskPrompt, ollamaModel: initialOllamaModel } = args;
  const [isLoading, setIsLoading] = useState(true);
  const [fileContent, setFileContent] = useState(null); // Can be used to display original content if needed
  const [analysisResult, setAnalysisResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const performAnalysis = async () => {
      setIsLoading(true);
      setError(null);
      setAnalysisResult(null);

      let currentFileContent = "";
      // 1. Read Local File Content via IPC
      // This part is now handled by the 'readLocalFileContentForAI' action which should be called *before*
      // 'analyzeFileContentAndSuggestChanges' if the content isn't already available.
      // For this component, we'll assume `args.textContent` is passed if file reading was separate,
      // or we simplify for this subtask by relying on `args.filePath` and reading it here.
      // The prompt for this subtask implies the action *itself* will orchestrate this.
      // However, `renderAndWaitForResponse` usually gets static args.
      // Let's assume the `textContent` is passed in `args` by a prior step or the main handler.
      // For this component, we will fetch the content based on filePath as per the prompt.

      if (window.electronIPC && typeof window.electronIPC.invoke === 'function') {
        try {
          console.log(`SuggestionApproval: Reading file ${filePath}`);
          if (window.skyscopeTerminal?.appendToOutput) window.skyscopeTerminal.appendToOutput(`[Approval UI] Reading file "${filePath}" for analysis...`, 'info');
          const result = await window.electronIPC.invoke('read-local-file', filePath);
          if (result.error) throw new Error(`IPC Error reading file: ${result.error}`);
          currentFileContent = result.content;
          setFileContent(currentFileContent);
          if (window.skyscopeTerminal?.appendToOutput) window.skyscopeTerminal.appendToOutput(`[Approval UI] File "${filePath}" read successfully.`, 'info');
        } catch (e) {
          console.error("Error reading file via IPC for SuggestionApprovalComponent:", e);
          setError(`Failed to read file '${filePath}': ${e.message}`);
          setIsLoading(false);
          if (window.skyscopeTerminal?.appendToOutput) window.skyscopeTerminal.appendToOutput(`[Approval UI] Error reading file '${filePath}': ${e.message}`, 'error');
          return;
        }
      } else {
        setError("Electron IPC bridge not available to read file.");
        setIsLoading(false);
        if (window.skyscopeTerminal?.appendToOutput) window.skyscopeTerminal.appendToOutput("[Approval UI] IPC Error: Cannot read local file.", 'error');
        return;
      }

      // 2. Get Analysis from Backend
      try {
        const modelToUse = initialOllamaModel || document.getElementById('ollama-model-input')?.value || 'llama3';
        console.log(`SuggestionApproval: Analyzing content with task: "${analysisTaskPrompt}" using model ${modelToUse}`);
        if (window.skyscopeTerminal?.appendToOutput) window.skyscopeTerminal.appendToOutput(`[Approval UI] Requesting AI analysis for "${filePath}" using ${modelToUse}...`, 'info');

        const response = await fetch('http://localhost:3001/api/copilotkit/analyzeTextContent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ textContent: currentFileContent, analysisTaskPrompt, ollamaModel: modelToUse })
        });

        const resultData = await response.json();
        if (!response.ok) {
          throw new Error(resultData.error || `Backend analysis error: ${response.status}`);
        }
        setAnalysisResult(resultData);
        if (window.skyscopeTerminal?.appendToOutput) window.skyscopeTerminal.appendToOutput(`[Approval UI] AI analysis received for "${filePath}". Displaying suggestions.`, 'info');
      } catch (e) {
        console.error("Error getting analysis from backend for SuggestionApprovalComponent:", e);
        setError(`Failed to get analysis: ${e.message}`);
        if (window.skyscopeTerminal?.appendToOutput) window.skyscopeTerminal.appendToOutput(`[Approval UI] Error during AI analysis: ${e.message}`, 'error');
      } finally {
        setIsLoading(false);
      }
    };

    // Only perform analysis when the component is active for user input
    if (filePath && analysisTaskPrompt && status === 'awaitingUserInput') {
      performAnalysis();
    } else if (status !== 'awaitingUserInput') {
        // If status is not awaitingUserInput (e.g. 'executing', 'complete'), don't re-fetch.
        // isLoading should ideally be false if we are not in 'awaitingUserInput' and not actively loading.
        setIsLoading(false);
    }
  }, [filePath, analysisTaskPrompt, status, initialOllamaModel]); // Rerun if key args change or status becomes active

  if (status !== 'awaitingUserInput' && !isLoading && !error && !analysisResult) {
    // This can happen if the component is rendered by CopilotKit before it's ready for input,
    // or after it has responded. Returning null or a minimal placeholder.
    return <div className="suggestion-modal-content"><p>Initializing analysis suggestions...</p></div>;
  }

  if (isLoading) {
    return <div className="suggestion-modal-overlay"><div className="suggestion-modal-content"><p>Loading analysis and suggestions for "{filePath}"...</p></div></div>;
  }
  if (error) {
    return (
      <div className="suggestion-modal-overlay">
        <div className="suggestion-modal-content">
          <p style={{color: 'red'}}>Error: {error}</p>
          <button className="control-button" onClick={() => respond({ approved: false, error: error, filePath: filePath })}>Close with Error</button>
        </div>
      </div>
    );
  }
  if (!analysisResult || !analysisResult.suggestions || analysisResult.suggestions.length === 0) {
    let message = "No suggestions provided by AI.";
    if (analysisResult && analysisResult.raw_response) {
        message = `AI provided a raw response that could not be parsed into suggestions: ${analysisResult.raw_response.substring(0,200)}...`;
    } else if (analysisResult && Object.keys(analysisResult).length > 0 && !analysisResult.suggestions) {
        message = `AI analysis returned an unexpected structure: ${JSON.stringify(analysisResult).substring(0,200)}...`;
    }

    return (
      <div className="suggestion-modal-overlay">
        <div className="suggestion-modal-content">
          <p>{message}</p>
          <button className="control-button" onClick={() => respond({ approved: false, notes: message, filePath: filePath })}>Close</button>
        </div>
      </div>
    );
  }

  return (
    <div className="suggestion-modal-overlay">
      <div className="suggestion-modal-content">
        <h4>AI Suggestions for: {filePath}</h4>
        <p><strong>Analysis Task:</strong> {analysisTaskPrompt}</p>
        <hr />
        <div className="suggestions-container">
            {analysisResult.suggestions.map((s, i) => {
              const isDifferent = s.original_snippet !== s.suggested_change;
              let suggestionDetail = "";
              if (s.suggested_change === "" && s.original_snippet) {
                suggestionDetail = "(Suggestion is to remove this snippet)";
              } else if (s.original_snippet === "" && s.suggested_change) {
                suggestionDetail = "(Suggestion is to add this new snippet)";
              }

              return (
                <div key={i} className={`suggestion-item ${isDifferent ? 'suggestion-has-change' : 'suggestion-no-change'}`}>
                  <p><strong>Finding:</strong> {s.finding || 'N/A'}</p>
                  <p><strong>Reason:</strong> {s.reason || 'N/A'}</p>
                  {suggestionDetail && <p><em>{suggestionDetail}</em></p>}

                  <div className="diff-view">
                    <div className="diff-pane">
                      <strong>Original Snippet:</strong>
                      <pre className="diff-original">{s.original_snippet || '(Original snippet not applicable or provided)'}</pre>
                    </div>
                    {isDifferent && s.suggested_change !== "" && ( // Only show suggested pane if there's a change and it's not a deletion
                      <div className="diff-pane">
                        <strong>Suggested Change:</strong>
                        <pre className="diff-suggested">{s.suggested_change}</pre>
                      </div>
                    )}
                </div>
              </div>
              );
            })}
        </div>
        <hr />
        <div className="suggestion-actions">
          <button className="control-button approve-button" onClick={() => respond({ approved: true, suggestions: analysisResult.suggestions, filePath: filePath })}>Approve All Suggestions</button>
          <button className="control-button reject-button" onClick={() => respond({ approved: false, filePath: filePath, notes: "User rejected all suggestions." })}>Reject All & Close</button>
        </div>
      </div>
    </div>
  );
};
export default SuggestionApprovalComponent;
