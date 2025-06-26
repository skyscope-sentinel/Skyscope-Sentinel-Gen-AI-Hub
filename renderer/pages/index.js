// renderer/pages/index.js
import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import HeaderComponent from '../components/HeaderComponent';
import FooterComponent from '../components/FooterComponent';
import CodeAnimatorComponent from '../components/CodeAnimatorComponent';
import PaneLayoutComponent from '../components/PaneLayoutComponent';
import { CopilotPopup } from '@copilotkit/react-ui';
import { useCopilotAction, useCopilotReadable } from '@copilotkit/react-core';
import SuggestionApprovalComponent from '../components/SuggestionApprovalComponent';
import NewAgentFormComponent from '../components/NewAgentFormComponent';

/**
 * HomePage Component
 * The main page of the SKYSCOPE AI application.
 */
export default function HomePage() {
  const [agentManager] = useState(() => AgentManager());

  const logToTerminal = (message, type = 'info') => {
    if (window.skyscopeTerminal?.appendToOutput) {
      window.skyscopeTerminal.appendToOutput(message, type);
    } else {
      console.warn(`skyscopeTerminal.appendToOutput not found. Log: [${type}] ${message}`);
    }
  };

  // --- CopilotKit Readable States ---
  const [terminalOutputTail, setTerminalOutputTail] = useState([]);
  const [currentBrowserUrl, setCurrentBrowserUrl] = useState("http://localhost:3002");
  const [pinnedAgentIdMonitor, setPinnedAgentIdMonitor] = useState(null);
  const [agentRosterSummary, setAgentRosterSummary] = useState([]);

  const handleTerminalOutputUpdate = useCallback((lines) => setTerminalOutputTail(lines), []);
  const handleBrowserUrlChange = useCallback((url) => setCurrentBrowserUrl(url), []);
  const handlePinnedAgentChange = useCallback((pinnedId) => setPinnedAgentIdMonitor(pinnedId), []);
  const handleRosterChange = useCallback((roster) => setAgentRosterSummary(roster), []);

  useCopilotReadable({ description: "Last 10 lines from SKYSCOPE AI terminal.", value: JSON.stringify(terminalOutputTail.slice(-10), null, 2) });
  useCopilotReadable({ description: "Current URL in SKYSCOPE AI browser pane.", value: currentBrowserUrl });
  useCopilotReadable({ description: "ID of the agent pinned in Agent Monitoring (null if none).", value: pinnedAgentIdMonitor });
  useCopilotReadable({ description: "Summary of registered SKYSCOPE AI agents (ID, state, goal).", value: JSON.stringify(agentRosterSummary, null, 2) });

  // --- CopilotKit Actions ---
  useCopilotAction({ name: "getTime", description: "Get current date/time.", parameters: [], handler: async () => { /* ... */ } });
  useCopilotAction({ name: "showSimpleAlert", description: "Display alert.", parameters: [ { name: "message", type: "string", required: true } ], handler: async ({ message }) => { /* ... */ } });
  useCopilotAction({ name: "getActivePanes", description: "Get active panes & agent summary.", parameters: [], handler: async () => { /* ... uses agentRosterSummary ... */ } });
  useCopilotAction({ name: "executeTerminalCommand", description: "Executes shell command. Caution advised.", parameters: [ { name: "command", type: "string", required: true } ], handler: async ({ command }) => { /* ... */ } });
  useCopilotAction({ name: "readLocalFileContentForAI", description: "Reads local file content (absolute path).", parameters: [ { name: "filePath", type: "string", required: true } ], handler: async ({ filePath }) => { /* ... */ } });
  useCopilotAction({ name: "navigateToUrl", description: "Navigates browser pane to URL.", parameters: [{ name: "url", type: "string", required: true }], handler: async ({ url }) => { /* ... */ } });
  useCopilotAction({ name: "getCurrentBrowserPageContent", description: "Fetches content of current/given URL via backend.", parameters: [{ name: "url", type: "string", required: false }], handler: async ({ url: targetUrl }) => { /* ... */ } });
  useCopilotAction({ name: "getTerminalTail", description: "Gets the last 10 lines from the integrated terminal.", parameters: [], handler: async () => { /* ... */ } });
  useCopilotAction({ name: "getPinnedAgentInfo", description: "Gets info about the currently pinned agent.", parameters: [], handler: async () => { /* ... */ } });
  useCopilotAction({ name: "fetchUserRepositories", description: "Fetches GitHub user repos (needs PAT).", parameters: [ { name: "githubToken", type: "string", required: true } ], handler: async ({ githubToken }) => { /* ... */ } });
  useCopilotAction({ name: "fetchRepoFileContent", description: "Fetches GitHub file content (needs PAT, owner, repo, path).", parameters: [ { name: "githubToken", type: "string", required: true }, { name: "owner", type: "string", required: true }, { name: "repo", type: "string", required: true }, { name: "path", type: "string", required: true }, ], handler: async (params) => { /* ... */ } });
  useCopilotAction({ name: "listHuggingFaceModels", description: "Lists HF models. Params: hfToken (opt), searchQuery (opt), limit (opt, def 10).", parameters: [ { name: "hfToken", type: "string", required: false }, { name: "searchQuery", type: "string", required: false }, { name: "limit", type: "number", required: false }, ], handler: async ({ hfToken, searchQuery, limit = 10 }) => { /* ... */ } });
  useCopilotAction({ name: "getHuggingFaceModelInfo", description: "Gets info for specific HF model. Params: hfToken (opt), modelId (req).", parameters: [ { name: "hfToken", type: "string", required: false }, { name: "modelId", type: "string", required: true }, ], handler: async ({ hfToken, modelId }) => { /* ... */ } });
  useCopilotAction({ name: "googleSearch", description: "Google search. Needs API key, CX ID, query.", parameters: [ { name: "googleApiKey", type: "string", required: true }, { name: "googleCxId", type: "string", required: true }, { name: "query", type: "string", required: true }, ], handler: async ({ googleApiKey, googleCxId, query }) => { /* ... */ } });
  useCopilotAction({ name: "researchAndSummarizeTopic", description: "Researches topic (Google, page content), then summarizes. Needs Google API key & CX ID.", parameters: [ { name: "topic", type: "string", required: true }, { name: "googleApiKey", type: "string", required: true }, { name: "googleCxId", type: "string", required: true }, ], handler: async ({ topic, googleApiKey, googleCxId }) => { /* ... */ } });
  useCopilotAction({ name: "describeImageFromUrl", description: "Describes image from URL via multimodal Ollama model. Params: imageUrl (req), prompt (req), ollamaModel (opt).", parameters: [ { name: "imageUrl", type: "string", required: true }, { name: "prompt", type: "string", required: true }, { name: "ollamaModel", type: "string", required: false } ], handler: async ({ imageUrl, prompt, ollamaModel }) => { /* ... */ } });
  useCopilotAction({ name: "analyzeFileContentAndSuggestChanges", description: "Reads local file (filePath), analyzes content, suggests changes, uses custom UI for approval.", parameters: [ { name: "filePath", type: "string", required: true }, { name: "analysisTaskPrompt", type: "string", required: true }, { name: "ollamaModel", type: "string", required: false } ], render: (props) => { if (props.status === 'awaitingUserInput') return <SuggestionApprovalComponent args={props.args} status={props.status} respond={props.respond} />; return null; }, handler: async (responseFromRespond) => { /* ... */ } });
  useCopilotAction({ name: "configureNewAgent", description: "Guides user via form to configure & register a new agent. Optional suggestedId, persona, goal.", parameters: [ { name: "suggestedId", type: "string", required: false }, { name: "suggestedPersona", type: "string", required: false }, { name: "suggestedGoal", type: "string", required: false } ], render: (props) => { if (props.status === 'awaitingUserInput') return <NewAgentFormComponent args={props.args} status={props.status} respond={props.respond} />; return null; }, handler: async (responseFromRespond) => { /* ... */ } });

  // Updated searchWithMorphic action
  useCopilotAction({
    name: "searchWithMorphic",
    description: "Navigates the Morphic AI Search pane to a specific query. Optionally, you can suggest 'searchDepth' (e.g., 'basic', 'advanced') or 'searchEngine' (e.g., 'google', 'duckduckgo') as these are speculative parameters Morphic might support. Ensure Morphic is running on http://localhost:3002.",
    parameters: [
      { name: "query", type: "string", description: "The search query for Morphic.", required: true },
      { name: "searchDepth", type: "string", description: "Speculative: Desired search depth (e.g., 'basic', 'advanced').", required: false },
      { name: "searchEngine", type: "string", description: "Speculative: Specific search engine for Morphic to use (e.g., 'google').", required: false },
    ],
    handler: async ({ query, searchDepth, searchEngine }) => {
      logToTerminal(`Action 'searchWithMorphic' started. Query: "${query}", Depth: ${searchDepth || 'N/A'}, Engine: ${searchEngine || 'N/A'}`, 'info');
      let actionResultString = "";
      let actionStatus = 'success';

      let morphicUrl = "http://localhost:3002/search?q=" + encodeURIComponent(query.trim());
      let paramsUsed = [];
      if (searchDepth) {
        morphicUrl += `&depth=${encodeURIComponent(searchDepth)}`;
        paramsUsed.push(`depth: ${searchDepth}`);
      }
      if (searchEngine) {
        morphicUrl += `&engine=${encodeURIComponent(searchEngine)}`;
        paramsUsed.push(`engine: ${searchEngine}`);
      }

      if (!window.skyscopeBrowser?.loadUrl) {
        actionResultString = "Browser pane function 'loadUrl' is not available for Morphic.";
        actionStatus = 'error';
        logToTerminal(actionResultString, 'error');
      } else {
        window.skyscopeBrowser.loadUrl(morphicUrl);
        actionResultString = `Morphic pane is now searching for: "${query}"${paramsUsed.length > 0 ? (" with params: " + paramsUsed.join(', ')) : ''}. Please view the pane for results.`;
        logToTerminal(`Action 'searchWithMorphic' completed. Loaded URL: ${morphicUrl}`, 'info');
      }

      const activeToolRequest = agentManager.getActiveToolRequest();
      if (activeToolRequest && activeToolRequest.toolName === "searchWithMorphic") {
        agentManager.provideToolResponse(activeToolRequest.agentId, activeToolRequest.toolCallId, actionResultString, actionStatus);
      }
      return actionResultString;
    }
  });

  // New: searchTextWithMorphicInPane action
  useCopilotAction({
    name: "searchTextWithMorphicInPane",
    description: "Takes a provided text string and performs a search with it using the embedded Morphic AI Search Engine pane. Morphic must be running on http://localhost:3002.",
    parameters: [
      { name: "textToSearch", type: "string", description: "The text string to search with Morphic.", required: true }
    ],
    handler: async ({ textToSearch }) => {
      logToTerminal(`Action 'searchTextWithMorphicInPane' started. Text: "${textToSearch.substring(0, 50)}..."`, 'info');
      let actionResultString = "";
      let actionStatus = 'success';

      if (!textToSearch || textToSearch.trim() === "") {
        actionResultString = "No text provided to search with Morphic.";
        actionStatus = 'warn';
        logToTerminal(actionResultString, 'warn');
      } else {
        const morphicBaseUrl = "http://localhost:3002";
        const searchUrl = `${morphicBaseUrl}/search?q=${encodeURIComponent(textToSearch.trim())}`;

        if (!window.skyscopeBrowser?.loadUrl) {
          actionResultString = "Browser pane (for Morphic) function 'loadUrl' is not available.";
          actionStatus = 'error';
          logToTerminal(actionResultString, 'error');
        } else {
          window.skyscopeBrowser.loadUrl(searchUrl);
          actionResultString = `Morphic pane is now searching for text: "${textToSearch.substring(0, 70)}...". Please view the pane for results.`;
          logToTerminal(`Action 'searchTextWithMorphicInPane' completed. Loaded URL: ${searchUrl}`, 'info');
        }
      }
      const activeToolRequest = agentManager.getActiveToolRequest();
      if (activeToolRequest && activeToolRequest.toolName === "searchTextWithMorphicInPane") {
        agentManager.provideToolResponse(activeToolRequest.agentId, activeToolRequest.toolCallId, actionResultString, actionStatus);
      }
      return actionResultString;
    }
  });

  // --- Must be the LAST useCopilotAction ---
  useCopilotAction({
    name: "listAvailableTools",
    description: "Get a list of available tools or actions that I (the AI assistant) can use to help you.",
    parameters: [],
    handler: async () => {
      const availableTools = [
        { name: "getTime", description: "Get the current date and time." },
        { name: "showSimpleAlert", description: "Display a simple alert message to the user." },
        { name: "getActivePanes", description: "Get a list of currently active/visible UI panes and agent summary." },
        { name: "executeTerminalCommand", description: "Executes a shell command on the local machine." },
        { name: "navigateToUrl", description: "Navigates the app's browser pane to a URL." },
        { name: "getCurrentBrowserPageContent", description: "Fetches text content of a webpage (uses current browser URL if none specified)." },
        { name: "getTerminalTail", description: "Gets the last 10 lines from the integrated terminal." },
        { name: "getPinnedAgentInfo", description: "Gets info about the currently pinned agent."},
        { name: "fetchUserRepositories", description: "Fetches GitHub repositories for a user (requires PAT)." },
        { name: "fetchRepoFileContent", description: "Fetches file content from a GitHub repo (requires PAT)." },
        { name: "listHuggingFaceModels", description: "Lists models from Hugging Face Hub (optional token, search query)." },
        { name: "getHuggingFaceModelInfo", description: "Gets info for a specific HF model (optional token)." },
        { name: "googleSearch", description: "Performs a Google web search (requires API key and CX ID)." },
        { name: "researchAndSummarizeTopic", description: "Researches a topic using Google, fetches content, and summarizes it." },
        { name: "searchWithMorphic", description: "Search Morphic with query & optional speculative params (depth, engine)." },
        { name: "searchTextWithMorphicInPane", description: "Search provided text using the Morphic pane." },
        { name: "describeImageFromUrl", description: "Describes an image from a URL using a multimodal Ollama model." },
        { name: "readLocalFileContentForAI", description: "Reads content of a local file for AI analysis (requires absolute path)." },
        { name: "analyzeFileContentAndSuggestChanges", description: "Reads a local file (via filePath), analyzes its content, suggests changes, and uses a custom UI for user approval." },
        { name: "configureNewAgent", description: "Guides the user through a form to configure and register a new specialized agent." },
        { name: "listAvailableTools", description: "Lists these available tools." }
      ].sort((a,b) => a.name.localeCompare(b.name));
      logToTerminal("Action 'listAvailableTools' called.", 'info');
      const resultJson = JSON.stringify(availableTools, null, 2);
      const activeToolRequest = agentManager.getActiveToolRequest();
      if (activeToolRequest && activeToolRequest.toolName === "listAvailableTools") {
        agentManager.provideToolResponse(activeToolRequest.agentId, activeToolRequest.toolCallId, resultJson, 'success');
      }
      return resultJson;
    }
  });

  useEffect(() => {
    // Event listeners for Agent Framework Test Area buttons
    const createAgentsButton = document.getElementById('create-sample-agents-button');
    const agentCreationOutput = document.getElementById('agent-creation-output');
    const agentIdGoalInput = document.getElementById('agent-id-goal-input');
    const agentGoalInput = document.getElementById('agent-goal-input');
    const setAgentGoalButton = document.getElementById('set-agent-goal-button');
    const agentGoalOutput = document.getElementById('agent-goal-output');
    const runAgentCycleButton = document.getElementById('run-agent-cycle-button');
    const stopAgentCycleButton = document.getElementById('stop-agent-cycle-button');
    const ollamaModelInput = document.getElementById('ollama-model-input');

    if (createAgentsButton && agentManager) {
        createAgentsButton.addEventListener('click', () => {
            try {
                const agent1 = new Agent('agent1', 'a helpful assistant specialized in creative writing and storytelling.');
                const agent2 = new Agent('agent2', 'a factual assistant specialized in explaining scientific concepts and historical events.');
                agentManager.registerAgent(agent1); agentManager.registerAgent(agent2);
                if(agentCreationOutput) agentCreationOutput.textContent = "Agent 'agent1' & 'agent2' registered.";
            } catch (e) { if(agentCreationOutput) agentCreationOutput.textContent = "Error creating agents: " + e.message; }
        });
    }
    if (setAgentGoalButton && agentManager) {
        setAgentGoalButton.addEventListener('click', () => {
            const agentId = agentIdGoalInput.value.trim(); const goal = agentGoalInput.value.trim();
            if (agentId && goal) {
                if (agentManager.getAgentById(agentId)) {
                    agentManager.setAgentGoal(agentId, goal);
                    if(agentGoalOutput) agentGoalOutput.textContent = `Goal for '${agentId}' set. Added to queue.`;
                } else { if(agentGoalOutput) agentGoalOutput.textContent = `Agent '${agentId}' not found.`; }
            } else { if(agentGoalOutput) agentGoalOutput.textContent = "Agent ID and Goal are required."; }
        });
    }
    if (runAgentCycleButton && agentManager) {
        runAgentCycleButton.addEventListener('click', () => {
            const modelName = ollamaModelInput?.value.trim() || 'llama3';
            const agentCycleLog = document.getElementById('agent-activity-log-monitor');
            if(agentCycleLog) agentCycleLog.textContent = `UI: Attempting to start agent cycle with model: ${modelName}...\n`;
            agentManager.startAgentCycle(modelName, 'agent-activity-log-monitor');
        });
    }
    if (stopAgentCycleButton && agentManager) {
        stopAgentCycleButton.addEventListener('click', () => { agentManager.stopAgentCycle(); });
    }
  }, [agentManager]);


  return (
    <div className="skyscope-app">
      <Head> <title>SKYSCOPE AI</title> </Head>
      <CodeAnimatorComponent />
      <HeaderComponent />
      <PaneLayoutComponent
        agentManagerInstance={agentManager}
        onTerminalOutputUpdate={handleTerminalOutputUpdate}
        onBrowserUrlChange={handleBrowserUrlChange}
        onPinnedAgentChange={handlePinnedAgentChange}
        onRosterChange={handleRosterChange}
      />
      <FooterComponent />
      <CopilotPopup
        instructions="You are SKYSCOPE AI... You can search Morphic (e.g., 'search Morphic for AI news with advanced depth' or 'search this text in Morphic: [some text]'). Contextual actions: 'get terminal tail', 'get pinned agent info'. Remember API keys for some tools."
        defaultOpen={true}
        labels={{ title: "SKYSCOPE AI Assistant", initial: "Hello! I'm SKYSCOPE AI, with new Morphic search and enhanced context.", }}
      />
    </div>
  );
}
