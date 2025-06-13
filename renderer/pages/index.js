// renderer/pages/index.js
import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import HeaderComponent from '../components/HeaderComponent';
import FooterComponent from '../components/FooterComponent';
import CodeAnimatorComponent from '../components/CodeAnimatorComponent';
import PaneLayoutComponent from '../components/PaneLayoutComponent';
import { CopilotPopup } from '@copilotkit/react-ui';
import { useCopilotAction } from '@copilotkit/react-core';

export default function HomePage() {
  const [agentManager] = useState(() => AgentManager());

  // Define CopilotKit frontend actions
  useCopilotAction({
    name: "getTime",
    description: "Get the current date and time.",
    parameters: [],
    handler: async () => {
      const currentTime = new Date().toLocaleString();
      console.log("Action: getTime called, returning:", currentTime);
      return currentTime;
    },
  });

  useCopilotAction({
    name: "showSimpleAlert",
    description: "Display a simple alert message to the user in the application.",
    parameters: [
      { name: "message", type: "string", description: "The message to display in the alert.", required: true },
    ],
    handler: async ({ message }) => {
      console.log("Action: showSimpleAlert called with message:", message);
      alert(`Message from SKYSCOPE AI: ${message}`);
      return "Alert has been displayed to the user.";
    },
  });

  useCopilotAction({
    name: "getActivePanes",
    description: "Get a list of currently active/visible UI panes in the SKYSCOPE AI application. For now, this is a mock.",
    parameters: [],
    handler: async () => {
      const mockActivePanes = ["Terminal", "Morphic AI Search Engine", "Agent Monitoring"];
      console.log("Action: getActivePanes called, returning mock data:", mockActivePanes);
      return JSON.stringify(mockActivePanes);
    },
  });

  useCopilotAction({
    name: "executeTerminalCommand",
    description: "Executes a shell command on the local machine where SKYSCOPE AI is running and returns its output. Use with caution as this can modify the system.",
    parameters: [
      { name: "command", type: "string", description: "The shell command to execute (e.g., 'ls -la', 'echo hello').", required: true },
    ],
    handler: async ({ command }) => {
      console.log("CopilotAction: executeTerminalCommand called with command:", command);
      if (window.skyscopeTerminal?.appendToOutput) window.skyscopeTerminal.appendToOutput(command, 'command');
      else console.warn("window.skyscopeTerminal.appendToOutput not found.");

      if (window.electronIPC?.invoke) {
        try {
          const result = await window.electronIPC.invoke('execute-command', command);
          let outputString = "";
          if (result.stdout) {
            outputString += `STDOUT:\n${result.stdout}\n`;
            if (window.skyscopeTerminal?.appendToOutput) window.skyscopeTerminal.appendToOutput(result.stdout, 'output');
          }
          if (result.stderr) {
            outputString += `STDERR:\n${result.stderr}\n`;
            if (window.skyscopeTerminal?.appendToOutput) window.skyscopeTerminal.appendToOutput(result.stderr, 'error');
          }
          if (result.error && !result.stderr) {
             outputString += `EXEC_ERROR: ${result.error}\n (Code: ${result.code})`;
             if (window.skyscopeTerminal?.appendToOutput) window.skyscopeTerminal.appendToOutput(`Error: ${result.error} (Code: ${result.code})`, 'error');
          }
          return outputString.trim() || "Command executed with no output.";
        } catch (e) {
          console.error("Error invoking 'execute-command' via IPC:", e);
          if (window.skyscopeTerminal?.appendToOutput) window.skyscopeTerminal.appendToOutput(`IPC Error: ${e.message}`, 'error');
          return `Error executing command: ${e.message}`;
        }
      } else {
        const errMsg = "Electron IPC bridge not available.";
        console.error(errMsg);
        if (window.skyscopeTerminal?.appendToOutput) window.skyscopeTerminal.appendToOutput(errMsg, 'error');
        return errMsg;
      }
    },
  });

  useCopilotAction({
    name: "navigateToUrl",
    description: "Navigates the application's integrated browser/Morphic pane to a specified URL.",
    parameters: [{ name: "url", type: "string", description: "The URL to navigate to (e.g., 'https://example.com').", required: true }],
    handler: async ({ url }) => {
      console.log("Action: navigateToUrl called with URL:", url);
      if (window.skyscopeBrowser?.loadUrl) {
        window.skyscopeBrowser.loadUrl(url);
        return `Navigation to ${url} initiated in the browser/Morphic pane.`;
      } else {
        console.warn("window.skyscopeBrowser.loadUrl not found.");
        return "Browser pane not available to navigate.";
      }
    }
  });

  useCopilotAction({
    name: "getCurrentBrowserPageContent",
    description: "Fetches the main text content of a given URL using a headless browser. If no URL is provided, it attempts to use the URL from the visible browser/Morphic pane.",
    parameters: [{ name: "url", type: "string", description: "Optional URL. If not provided, uses the current URL from the app's browser pane.", required: false }],
    handler: async ({ url: targetUrl }) => {
      let urlToFetch = targetUrl;
      if (!urlToFetch && window.skyscopeBrowser?.getCurrentUrl) urlToFetch = window.skyscopeBrowser.getCurrentUrl();

      if (!urlToFetch || urlToFetch === 'about:blank' || urlToFetch === 'http://localhost:3002/') {
        if (urlToFetch === 'http://localhost:3002/') {
          return "Currently on Morphic homepage. Please perform a search within Morphic or specify a URL with content to fetch.";
        }
        return "Browser URL is not available, is blank, or is on the default Morphic homepage. Please navigate to a content page or specify a URL.";
      }

      console.log("Action: getCurrentBrowserPageContent called for URL:", urlToFetch);
      try {
        const response = await fetch('http://localhost:3001/api/browser/getPageContent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: urlToFetch })
        });
        if (!response.ok) throw new Error(`Backend getPageContent error: ${response.statusText}`);
        const result = await response.json();
        return `Content fetched for ${result.url}. Snippet: ${result.content ? result.content.substring(0, 500) + '...' : 'No content found.'}`;
      } catch (e) {
        return `Error fetching page content: ${e.message}`;
      }
    }
  });

  useCopilotAction({
    name: "fetchUserRepositories",
    description: "Fetches the list of repositories for a GitHub user, given a Personal Access Token (PAT).",
    parameters: [ { name: "githubToken", type: "string", description: "The GitHub Personal Access Token.", required: true }, ],
    handler: async ({ githubToken }) => {
      console.log("Action: fetchUserRepositories called");
      if (!githubToken) return "GitHub token is required.";
      try {
        const response = await fetch('https://api.github.com/user/repos', {
          headers: { 'Authorization': `Bearer ${githubToken}`, 'Accept': 'application/vnd.github.v3+json' }
        });
        if (!response.ok) throw new Error(`GitHub API Error: ${response.status} ${await response.text()}`);
        const data = await response.json();
        const repoNames = data.map(repo => repo.name);
        return `User Repositories: ${repoNames.join(', ') || 'No repositories found.'}`;
      } catch (e) { return `Error fetching GitHub repositories: ${e.message}`; }
    }
  });

  useCopilotAction({
    name: "fetchRepoFileContent",
    description: "Fetches the content of a specific file from a GitHub repository.",
    parameters: [
      { name: "githubToken", type: "string", description: "GitHub PAT (required for private repos or higher rate limits).", required: true },
      { name: "owner", type: "string", description: "The owner of the repository.", required: true },
      { name: "repo", type: "string", description: "The name of the repository.", required: true },
      { name: "path", type: "string", description: "The path to the file within the repository.", required: true },
    ],
    handler: async ({ githubToken, owner, repo, path }) => {
      console.log(`Action: fetchRepoFileContent for ${owner}/${repo}/${path}`);
      if (!owner || !repo || !path || !githubToken) return "Token, owner, repo, and path are required.";
      try {
        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
          headers: { 'Authorization': `Bearer ${githubToken}`, 'Accept': 'application/vnd.github.v3+json' }
        });
        if (!response.ok) throw new Error(`GitHub API Error: ${response.status} ${await response.text()}`);
        const data = await response.json();
        if (data.content && data.encoding === 'base64') {
          const decodedContent = atob(data.content);
          return `Content of ${path}:\n${decodedContent}`;
        }
        return "File content not found or not base64 encoded.";
      } catch (e) { return `Error fetching file content: ${e.message}`; }
    }
  });

  useCopilotAction({
    name: "listHuggingFaceModels",
    description: "Lists models from Hugging Face Hub. Can be filtered by a search query.",
    parameters: [
      { name: "hfToken", type: "string", description: "Hugging Face API Token (optional).", required: false },
      { name: "searchQuery", type: "string", description: "Term to search for models (optional).", required: false },
      { name: "limit", type: "number", description: "Number of models to return (default 10).", required: false },
    ],
    handler: async ({ hfToken, searchQuery, limit = 10 }) => {
      console.log("Action: listHuggingFaceModels with query:", searchQuery);
      let url = `https://huggingface.co/api/models?limit=${limit}`;
      if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`;
      const headers = { 'Accept': 'application/json' };
      if (hfToken) headers['Authorization'] = `Bearer ${hfToken}`;
      try {
        const response = await fetch(url, { headers });
        if (!response.ok) throw new Error(`HF API Error: ${response.status} ${await response.text()}`);
        const data = await response.json();
        const modelIds = data.map(model => `ID: ${model.modelId}, Pipeline: ${model.pipeline_tag || 'N/A'}, Likes: ${model.likes || 0}`);
        return `Hugging Face Models:\n${modelIds.join('\n') || 'No models found.'}\`;
      } catch (e) { return `Error listing HF models: ${e.message}`; }
    }
  });

  useCopilotAction({
    name: "getHuggingFaceModelInfo",
    description: "Gets detailed information about a specific Hugging Face model.",
    parameters: [
      { name: "hfToken", type: "string", description: "Hugging Face API Token (optional).", required: false },
      { name: "modelId", type: "string", description: "The ID of the model (e.g., 'bert-base-uncased').", required: true },
    ],
    handler: async ({ hfToken, modelId }) => {
      console.log("Action: getHuggingFaceModelInfo for model:", modelId);
      if (!modelId) return "Model ID is required.";
      const headers = { 'Accept': 'application/json' };
      if (hfToken) headers['Authorization'] = `Bearer ${hfToken}`;
      try {
        const response = await fetch(`https://huggingface.co/api/models/${encodeURIComponent(modelId)}`, { headers });
        if (!response.ok) throw new Error(`HF API Error: ${response.status} ${await response.text()}`);
        const data = await response.json();
        return `Model Info (${modelId}):\n${JSON.stringify(data, null, 2)}`;
      } catch (e) { return `Error getting HF model info: ${e.message}`; }
    }
  });

  useCopilotAction({
    name: "googleSearch",
    description: "Performs a web search using Google Custom Search API.",
    parameters: [
      { name: "googleApiKey", type: "string", description: "Google API Key for Custom Search.", required: true },
      { name: "googleCxId", type: "string", description: "Google Custom Search Engine ID (CX ID).", required: true },
      { name: "query", type: "string", description: "The search query.", required: true },
    ],
    handler: async ({ googleApiKey, googleCxId, query }) => {
      console.log("Action: googleSearch for query:", query);
      if (!googleApiKey || !googleCxId || !query) return "API Key, CX ID, and query are required for Google Search.";
      try {
        const url = `https://www.googleapis.com/customsearch/v1?key=${googleApiKey}&cx=${googleCxId}&q=${encodeURIComponent(query)}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Google API Error: ${response.status} ${await response.text()}`);
        const data = await response.json();
        if (data.items && data.items.length > 0) {
          const results = data.items.map(item => `Title: ${item.title}\nLink: ${item.link}\nSnippet: ${item.snippet}`).join('\n---\n');
          return `Google Search Results for "${query}":\n${results}`;
        } else if (data.error) { return `Google API Error: ${data.error.message}`; }
        return "No results found.";
      } catch (e) { return `Error performing Google search: ${e.message}`; }
    }
  });

  useCopilotAction({
    name: "researchAndSummarizeTopic",
    description: "Researches a topic using Google, fetches content from a top result, and summarizes it using an Ollama model. Requires Google API Key and CX ID.",
    parameters: [
      { name: "topic", type: "string", description: "The topic to research and summarize.", required: true },
      { name: "googleApiKey", type: "string", description: "Your Google API Key for Custom Search.", required: true },
      { name: "googleCxId", type: "string", description: "Your Google Custom Search Engine ID (CX ID).", required: true },
    ],
    handler: async ({ topic, googleApiKey, googleCxId }) => {
      console.log(`Action: researchAndSummarizeTopic for '${topic}'`);
      if (!topic || !googleApiKey || !googleCxId) return "Topic, Google API Key, and CX ID are required.";
      const ollamaModelForSummarization = document.getElementById('ollama-model-input')?.value || 'llama3';
      try {
        const response = await fetch('http://localhost:3001/api/copilotkit/researchAndSummarize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topic, ollamaModel: ollamaModelForSummarization, googleApiKey, googleCxId })
        });
        const result = await response.json();
        if (!response.ok) return `Error in research/summarization workflow: ${result.error || response.statusText}. Log: ${JSON.stringify(result.log)}`;
        if (window.skyscopeTerminal?.appendToOutput) result.log.forEach(logEntry => window.skyscopeTerminal.appendToOutput(logEntry, 'info'));
        return `Research & Summary for "${topic}":\nSource: ${result.firstResultTitle} (${result.firstResultLink})\nSummary:\n${result.summary}`;
      } catch (e) { return `Frontend Error calling research/summarization workflow: ${e.message}`; }
    }
  });

  useCopilotAction({
    name: "searchWithMorphic",
    description: "Opens the Morphic AI Search Engine within SKYSCOPE AI, optionally with a specific search query. Morphic must be running separately on http://localhost:3002.",
    parameters: [ { name: "query", type: "string", description: "The search query for Morphic (optional).", required: false }, ],
    handler: async ({ query }) => {
      let morphicUrl = "http://localhost:3002";
      if (query && query.trim() !== "") morphicUrl += `/search?q=${encodeURIComponent(query.trim())}`;
      if (window.skyscopeBrowser?.loadUrl) {
        window.skyscopeBrowser.loadUrl(morphicUrl);
        return `Morphic Search interface loaded in the browser pane. Searching for: "${query || 'homepage'}". Please interact with Morphic directly in its pane.`;
      } else { return "Browser pane is not available to load Morphic."; }
    }
  });

  useCopilotAction({
      name: "describeImageFromUrl",
      description: "Fetches an image from a public URL, sends it with a text prompt to a multimodal Ollama model, and returns the model's textual response (e.g., description, analysis).",
      parameters: [
        { name: "imageUrl", type: "string", description: "The publicly accessible URL of the image to describe.", required: true },
        { name: "prompt", type: "string", description: "Your question or instruction about the image (e.g., 'What objects are in this image?', 'Describe this scene in detail.').", required: true },
        { name: "ollamaModel", type: "string", description: "The multimodal Ollama model to use (e.g., 'llava', 'bakllava', 'qwen:7b-chat-q5_K_M'). Defaults to 'llava' if not specified by user.", required: false }
      ],
      handler: async ({ imageUrl, prompt, ollamaModel }) => {
        console.log(`Action: describeImageFromUrl for URL '${imageUrl}' with prompt '${prompt}' using model '${ollamaModel || 'llava'}'`);
        const modelToUse = ollamaModel || document.getElementById('ollama-model-input')?.value || 'llava';
        if (!imageUrl || !prompt) return "Image URL and a prompt are required to describe an image.";
        if (!imageUrl.toLowerCase().startsWith('http://') && !imageUrl.toLowerCase().startsWith('https://')) return "Invalid Image URL provided. It must start with http:// or https://";
        try {
          const response = await fetch('http://localhost:3001/api/copilotkit/describeImageUrl', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageUrl, prompt, ollamaModel: modelToUse })
          });
          const result = await response.json();
          if (!response.ok) return `Error describing image: ${result.error || response.statusText}`;
          return `Description for image at ${imageUrl}:\n${result.description}`;
        } catch (e) { return `Frontend error calling describeImageFromUrl: ${e.message}`; }
      }
    });

  useCopilotAction({
    name: "readLocalFileContentForAI",
    description: "Reads the content of a local file specified by a path. For security, path access is restricted. Returns file content or an error.",
    parameters: [
      { name: "filePath", type: "string", description: "The absolute path to the local file.", required: true }
    ],
    handler: async ({ filePath }) => {
      console.log(`Action: readLocalFileContentForAI for path: ${filePath}`);
      if (!window.electronIPC) return "Electron IPC bridge not available.";
      try {
        // Basic check (example - real validation should be in main process)
        if (filePath.includes('..') || !filePath.startsWith('/')) { // Very basic check for Unix-like paths
           // For Windows, a similar check might be !path.isAbsolute(filePath) or specific drive letter checks
           // This check is illustrative and not exhaustive for security.
           console.warn("readLocalFileContentForAI: Attempting to access potentially relative or non-absolute path:", filePath);
           // Depending on strictness, could return error here. For now, let main process handle it.
           // return "Error: Invalid or potentially unsafe file path. Absolute paths are preferred.";
        }
        const result = await window.electronIPC.invoke('read-local-file', filePath);
        if (result.error) return `Error reading file: ${result.error}`;
        // Consider truncating very large files before returning to AI context
        const content = result.content;
        if (content.length > 20000) { // Example limit
            console.warn(`File content for ${filePath} is very large (${content.length} chars), returning truncated version to AI.`);
            return `File content (truncated):\n${content.substring(0, 20000)}...`;
        }
        return content;
      } catch (e) {
        return `IPC Error reading file: ${e.message}`;
      }
    }
  });

  useCopilotAction({
    name: "analyzeFileContentAndSuggestChanges",
    description: "Analyzes the provided text content (e.g., from a file) based on a task prompt, suggests changes using an Ollama model, and asks for user approval of suggestions. Does NOT apply changes.",
    parameters: [
      { name: "textContent", type: "string", description: "The text content to analyze.", required: true },
      { name: "analysisTaskPrompt", type: "string", description: "The specific task or question for analyzing the content (e.g., 'Identify potential bugs and suggest fixes', 'Rewrite this for clarity').", required: true },
      { name: "ollamaModel", type: "string", description: "Ollama model to use for analysis (e.g., 'llama3').", required: false }
    ],
    handler: async ({ textContent, analysisTaskPrompt, ollamaModel }) => {
      const modelToUse = ollamaModel || document.getElementById('ollama-model-input')?.value || 'llama3';
      console.log(`Action: analyzeFileContentAndSuggestChanges using ${modelToUse}`);

      try {
        const response = await fetch('http://localhost:3001/api/copilotkit/analyzeTextContent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ textContent, analysisTaskPrompt, ollamaModel: modelToUse })
        });
        const analysisResult = await response.json();

        if (!response.ok) {
          return `Error during content analysis: ${analysisResult.error || response.statusText}. Raw: ${analysisResult.raw_response || ''}`;
        }

        let formattedSuggestions = "No specific suggestions format returned or suggestions not found.";
        if (analysisResult.suggestions && Array.isArray(analysisResult.suggestions)) {
          if (analysisResult.suggestions.length === 0) {
            formattedSuggestions = "AI analysis complete: No specific change suggestions were provided.";
          } else {
            formattedSuggestions = analysisResult.suggestions.map((s, i) =>
              `Suggestion ${i+1}:\nFinding: ${s.finding || 'N/A'}\nOriginal: "${s.original_snippet || 'N/A'}"\nSuggested Change: "${s.suggested_change || 'N/A'}"\nReason: ${s.reason || 'N/A'}`
            ).join('\n---\n');
          }
        } else if (analysisResult.raw_response) { // If backend sent raw due to parse error
            formattedSuggestions = `AI analysis (raw response):\n${analysisResult.raw_response}`;
        } else if (typeof analysisResult === 'object') {
          formattedSuggestions = `AI analysis (JSON response):\n${JSON.stringify(analysisResult, null, 2)}`;
        }

        // SIMULATE USER APPROVAL STEP
        const userApproved = confirm(`AI Analysis Complete. Suggestions:\n\n${formattedSuggestions}\n\nDo you approve these suggestions? (This is a mock approval - no changes will be applied yet)`);

        if (userApproved) {
          return `User APPROVED the following suggestions (no changes applied yet):\n${formattedSuggestions}`;
        } else {
          return `User REJECTED the suggestions.\n${formattedSuggestions}`;
        }

      } catch (e) {
        return `Frontend error during analysis workflow: ${e.message}`;
      }
    }
  });

  useCopilotAction({
    name: "listAvailableTools",
    description: "Get a list of available tools or actions that I (the AI) can use.",
    parameters: [],
    handler: async () => {
      const availableTools = [
        { name: "getTime", description: "Get the current date and time." },
        { name: "showSimpleAlert", description: "Display a simple alert message to the user." },
        { name: "getActivePanes", description: "Get a list of currently active/visible UI panes (mocked)." },
        { name: "executeTerminalCommand", description: "Executes a shell command on the local machine." },
        { name: "navigateToUrl", description: "Navigates the app's browser pane and a headless browser to a URL." },
        { name: "getCurrentBrowserPageContent", description: "Fetches text content of a webpage via headless browser." },
        { name: "fetchUserRepositories", description: "Fetches GitHub repositories for a user (requires PAT)." },
        { name: "fetchRepoFileContent", description: "Fetches file content from a GitHub repo (requires PAT)." },
        { name: "listHuggingFaceModels", description: "Lists models from Hugging Face Hub (optional token, search query)." },
        { name: "getHuggingFaceModelInfo", description: "Gets info for a specific HF model (optional token)." },
        { name: "googleSearch", description: "Performs a Google web search (requires API key and CX ID)." },
        { name: "researchAndSummarizeTopic", description: "Researches a topic using Google, fetches content, and summarizes it." },
        { name: "searchWithMorphic", description: "Opens Morphic AI Search with an optional query in the browser pane." },
        { name: "describeImageFromUrl", description: "Describes an image from a URL using a multimodal Ollama model." },
        { name: "readLocalFileContentForAI", description: "Reads content of a local file for AI analysis." },
        { name: "analyzeFileContentAndSuggestChanges", description: "Analyzes text content, suggests changes, and asks for user approval (mocked)." },
        { name: "listAvailableTools", description: "Lists these available tools." }
      ].sort((a,b) => a.name.localeCompare(b.name));
      console.log("Action: listAvailableTools called");
      return JSON.stringify(availableTools, null, 2);
    }
  });

  useEffect(() => {
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
                agentManager.registerAgent(agent1);
                agentManager.registerAgent(agent2);
                if(agentCreationOutput) agentCreationOutput.textContent = "Agent 'agent1' & 'agent2' registered.";
            } catch (e) {
                if(agentCreationOutput) agentCreationOutput.textContent = "Error creating agents: " + e.message;
            }
        });
    }
    if (setAgentGoalButton && agentManager) {
        setAgentGoalButton.addEventListener('click', () => {
            const agentId = agentIdGoalInput.value.trim();
            const goal = agentGoalInput.value.trim();
            if (agentId && goal) {
                if (agentManager.getAgentById(agentId)) {
                    agentManager.setAgentGoal(agentId, goal);
                    if(agentGoalOutput) agentGoalOutput.textContent = `Goal for '${agentId}' set. Added to queue.`;
                } else {
                    if(agentGoalOutput) agentGoalOutput.textContent = `Agent '${agentId}' not found.`;
                }
            } else {
                if(agentGoalOutput) agentGoalOutput.textContent = "Agent ID and Goal are required.";
            }
        });
    }
    if (runAgentCycleButton && agentManager) {
        runAgentCycleButton.addEventListener('click', () => {
            const modelName = ollamaModelInput?.value.trim() || 'llama3';
            const agentActivityOutput = document.getElementById('agent-activity-log-monitor');
            if (agentActivityOutput) agentActivityOutput.textContent = `Attempting to start agent cycle with model: ${modelName}...\n`;
            agentManager.startAgentCycle(modelName, 'agent-activity-log-monitor');
        });
    }
    if (stopAgentCycleButton && agentManager) {
        stopAgentCycleButton.addEventListener('click', () => {
             agentManager.stopAgentCycle();
             const agentActivityOutput = document.getElementById('agent-activity-log-monitor');
             if (agentActivityOutput) agentActivityOutput.textContent += "Stop cycle requested by user.\n";
        });
    }
  }, [agentManager]);


  return (
    <div className="skyscope-app">
      <Head>
        <title>SKYSCOPE AI</title>
        {/* ... other head elements ... */}
      </Head>
      <CodeAnimatorComponent />
      <HeaderComponent />
      <PaneLayoutComponent agentManagerInstance={agentManager} />
      <FooterComponent />

      <CopilotPopup
        instructions="You are SKYSCOPE AI. You can use various tools like executing terminal commands, browsing, GitHub, HuggingFace, Google Search, research & summarization, opening Morphic AI Search, describing images from URLs, or reading local files (provide safe, absolute paths) and analyzing their content (e.g., 'read file /path/to/my/text.txt then analyze its content to improve clarity'). Ask 'what tools can you use?' to see all. API keys/tokens might be needed for some tools."
        defaultOpen={true}
        labels={{
          title: "SKYSCOPE AI Assistant",
          initial: "Hello! I'm SKYSCOPE AI. How can I assist?",
        }}
      />
      {/* Old test areas for direct API key input can be kept for now as a manual way for user to provide keys if AI asks */}
    </div>
  );
}
