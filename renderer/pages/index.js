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

  // Helper function to log messages to the terminal UI component
  const logToTerminal = (message, type = 'info') => {
    if (window.skyscopeTerminal?.appendToOutput) {
      window.skyscopeTerminal.appendToOutput(message, type);
    } else {
      // Fallback if the terminal component isn't fully ready or exposed
      console.warn(`skyscopeTerminal.appendToOutput not found. Log: [${type}] ${message}`);
    }
  };

  // --- Basic UI Interaction & Info Actions ---
  useCopilotAction({
    name: "getTime",
    description: "Get the current date and time.",
    parameters: [],
    handler: async () => {
      logToTerminal("Action 'getTime' started.", 'info');
      const currentTime = new Date().toLocaleString();
      logToTerminal(`Action 'getTime' completed. Result: ${currentTime}`, 'info');
      return currentTime; // Return to AI
    },
  });

  useCopilotAction({
    name: "showSimpleAlert",
    description: "Display a simple alert message to the user in the application.",
    parameters: [
      { name: "message", type: "string", description: "The message to display in the alert.", required: true },
    ],
    handler: async ({ message }) => {
      logToTerminal(`Action 'showSimpleAlert' started. Message: "${message}"`, 'info');
      alert(`Message from SKYSCOPE AI: ${message}`);
      logToTerminal("Action 'showSimpleAlert' completed. Alert displayed.", 'info');
      return "Alert has been displayed to the user."; // Confirmation to AI
    },
  });

  useCopilotAction({
    name: "getActivePanes",
    description: "Get a list of currently active/visible UI panes in the SKYSCOPE AI application. This is currently a mock response.",
    parameters: [],
    handler: async () => {
      logToTerminal("Action 'getActivePanes' started.", 'info');
      const mockActivePanes = ["Terminal", "Morphic AI Search Engine", "Agent Monitoring"];
      logToTerminal(`Action 'getActivePanes' completed. Result: ${JSON.stringify(mockActivePanes)}`, 'info');
      return JSON.stringify(mockActivePanes); // Return to AI
    },
  });

  // --- Electron IPC & System Interaction Actions ---
  useCopilotAction({
    name: "executeTerminalCommand",
    description: "Executes a shell command on the local machine where SKYSCOPE AI is running and returns its output. Use with caution as this can modify the system. Requires user to be aware of security implications.",
    parameters: [
      { name: "command", type: "string", description: "The shell command to execute (e.g., 'ls -la', 'echo hello', 'pwd').", required: true },
    ],
    handler: async ({ command }) => {
      logToTerminal(`Action 'executeTerminalCommand' started. Command: "${command}"`, 'command');

      // Check if Electron IPC bridge is available
      if (!window.electronIPC?.invoke) {
        const errMsg = "Electron IPC bridge ('window.electronIPC.invoke') is not available. Cannot execute terminal command.";
        logToTerminal(errMsg, 'error');
        console.error(errMsg);
        return errMsg; // Return error to AI
      }

      try {
        // Invoke IPC call to main process for command execution
        const result = await window.electronIPC.invoke('execute-command', command);

        let outputString = ""; // Prepare combined output for AI

        // Process stdout
        if (result.stdout) {
          outputString += `STDOUT:\n${result.stdout}\n`;
          logToTerminal(result.stdout, 'output'); // Log to UI terminal
        }
        // Process stderr
        if (result.stderr) {
          outputString += `STDERR:\n${result.stderr}\n`;
          logToTerminal(result.stderr, 'error'); // Log to UI terminal as error type
        }
        // Process execution error
        if (result.error) {
           outputString += `EXEC_ERROR: ${result.error}\n (Code: ${result.code})\n`;
           // Avoid double logging to UI terminal if stderr already contained the error message
           if (!result.stderr || !result.stderr.includes(result.error)) {
             logToTerminal(`Command Error: ${result.error} (Code: ${result.code})`, 'error');
           }
        }

        if (!outputString.trim()) outputString = "Command executed with no output.";

        logToTerminal(`Action 'executeTerminalCommand' completed for command: "${command}"`, 'info');
        return outputString.trim(); // Return combined output/error to AI
      } catch (e) {
        const errMsg = `Frontend IPC Error for 'executeTerminalCommand': ${e.message}`;
        logToTerminal(errMsg, 'error');
        console.error(errMsg, e);
        return errMsg; // Return error to AI
      }
    },
  });

  useCopilotAction({
    name: "readLocalFileContentForAI",
    description: "Reads the content of a local file specified by an absolute path. For security, path access is restricted by the main process. Returns file content or an error message.",
    parameters: [
      { name: "filePath", type: "string", description: "The absolute path to the local file (e.g., '/home/user/file.txt' or 'C:\\Users\\user\\document.txt').", required: true }
    ],
    handler: async ({ filePath }) => {
      logToTerminal(`Action 'readLocalFileContentForAI' started for path: "${filePath}"`, 'info');

      // Check if Electron IPC bridge is available
      if (!window.electronIPC?.invoke) {
        const errMsg = "Electron IPC bridge ('window.electronIPC.invoke') is not available. Cannot read local file.";
        logToTerminal(errMsg, 'error');
        console.error(errMsg);
        return errMsg; // Return error to AI
      }

      // Basic client-side check for path format (main process does more robust checks)
      if (filePath.includes('..') || (!filePath.startsWith('/') && !/^[a-zA-Z]:[\\/]/.test(filePath))) {
         const warnMsg = "Warning: Path appears relative or uses '..'. Ensure it's an absolute, safe path. Main process will validate.";
         logToTerminal(warnMsg, 'warn');
         // It's better to let the main process perform the definitive validation.
      }

      try {
        // Invoke IPC call to main process for file reading
        const result = await window.electronIPC.invoke('read-local-file', filePath);

        if (result.error) {
          logToTerminal(`Action 'readLocalFileContentForAI' failed: ${result.error}`, 'error');
          return `Error reading file: ${result.error}`; // Return error to AI
        }

        const content = result.content;
        logToTerminal(`Action 'readLocalFileContentForAI' successful for "${filePath}". Length: ${content.length}`, 'info');

        // Truncate very large files before returning to AI to avoid overwhelming context
        const MAX_FILE_CONTENT_LENGTH = 20000;
        if (content.length > MAX_FILE_CONTENT_LENGTH) {
            logToTerminal(`File content for "${filePath}" is very large (${content.length} chars), returning truncated version to AI.`, 'warn');
            return `File content (truncated due to size):\n${content.substring(0, MAX_FILE_CONTENT_LENGTH)}...`; // Return truncated content to AI
        }
        return content; // Return full content to AI
      } catch (e) {
        const errMsg = `Frontend IPC Error for 'readLocalFileContentForAI': ${e.message}`;
        logToTerminal(errMsg, 'error');
        console.error(errMsg, e);
        return errMsg; // Return error to AI
      }
    }
  });

  // --- Browser Pane Interaction Actions ---
  useCopilotAction({
    name: "navigateToUrl",
    description: "Navigates the application's integrated browser/Morphic pane to a specified URL. The AI should confirm with the user before navigating to arbitrary external sites.",
    parameters: [{ name: "url", type: "string", description: "The URL to navigate to (e.g., 'https://example.com').", required: true }],
    handler: async ({ url }) => {
      logToTerminal(`Action 'navigateToUrl' started. URL: ${url}`, 'info');

      // Check if browser control function is available
      if (!window.skyscopeBrowser?.loadUrl) {
        const errMsg = "Browser pane function 'loadUrl' is not available.";
        logToTerminal(errMsg, 'error');
        return errMsg; // Return error to AI
      }

      // Call the function exposed by BrowserPaneComponent
      window.skyscopeBrowser.loadUrl(url);
      logToTerminal(`Action 'navigateToUrl' completed. Navigation to "${url}" initiated in UI.`, 'info');
      return `Navigation to "${url}" initiated in the browser/Morphic pane.`; // Confirmation to AI
    }
  });

  // --- Backend API Call Actions ---
  useCopilotAction({
    name: "getCurrentBrowserPageContent",
    description: "Fetches the main text content of a given URL using a backend headless browser. If no URL is provided, it attempts to use the URL from the visible browser/Morphic pane.",
    parameters: [{ name: "url", type: "string", description: "Optional URL. If not provided, uses the current URL from the app's browser pane.", required: false }],
    handler: async ({ url: targetUrl }) => {
      let urlToFetch = targetUrl;
      // Step 1: Determine the URL to fetch
      if (!urlToFetch) {
        if (!window.skyscopeBrowser?.getCurrentUrl) {
          const errMsg = "Browser pane function 'getCurrentUrl' is not available to get current URL.";
          logToTerminal(errMsg, 'error');
          return errMsg; // Return error to AI
        }
        urlToFetch = window.skyscopeBrowser.getCurrentUrl();
      }

      // Step 2: Validate the URL
      if (!urlToFetch || urlToFetch === 'about:blank' || urlToFetch === 'http://localhost:3002/') {
        const msg = urlToFetch === 'http://localhost:3002/'
          ? "Currently on Morphic homepage. Please perform a search within Morphic or specify a URL with content to fetch."
          : "Browser URL is not available, is blank, or is on the default Morphic homepage. Please navigate to a content page or specify a URL.";
        logToTerminal(`Action 'getCurrentBrowserPageContent' aborted: ${msg}`, 'info');
        return msg; // Return info/error to AI
      }

      logToTerminal(`Action 'getCurrentBrowserPageContent' started for URL: ${urlToFetch}`, 'info');
      try {
        // Step 3: Call backend API
        const response = await fetch('http://localhost:3001/api/browser/getPageContent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: urlToFetch })
        });

        // Step 4: Process response
        const result = await response.json();
        if (!response.ok) {
          const errorMsg = result.error || `Backend error: ${response.status} ${response.statusText}`;
          const errorDetails = result.details || '';
          if (errorDetails) console.error("Backend error details for getPageContent:", errorDetails);
          logToTerminal(`Action 'getCurrentBrowserPageContent' failed: ${errorMsg}`, 'error');
          return `Error fetching page content: ${errorMsg}`; // Return error to AI
        }

        const successMsg = `Content fetched for ${result.url}. Snippet: ${result.content ? result.content.substring(0, 100) + '...' : 'No content found.'}`;
        logToTerminal(`Action 'getCurrentBrowserPageContent' successful for ${result.url}.`, 'info');
        // Provide more detailed content to AI, but snippet in quick summary
        return `${successMsg}\nFull content (first 500 chars):\n${result.content ? result.content.substring(0, 500) + '...' : 'No content found.'}`;
      } catch (e) {
        // Step 5: Handle frontend/network errors
        const errMsg = `Frontend error for 'getCurrentBrowserPageContent': ${e.message}`;
        logToTerminal(errMsg, 'error');
        console.error(errMsg, e);
        return errMsg; // Return error to AI
      }
    }
  });

  useCopilotAction({
    name: "fetchUserRepositories",
    description: "Fetches the list of repositories for a GitHub user. Requires a GitHub Personal Access Token (PAT) to be provided by the user when prompted by the AI.",
    parameters: [ { name: "githubToken", type: "string", description: "The GitHub Personal Access Token.", required: true }, ],
    handler: async ({ githubToken }) => {
      logToTerminal("Action 'fetchUserRepositories' started.", 'info');
      if (!githubToken) {
        const msg = "GitHub token is required.";
        logToTerminal(msg, 'error');
        return msg;
      }
      try {
        // Call GitHub API
        const response = await fetch('https://api.github.com/user/repos', {
          headers: { 'Authorization': `Bearer ${githubToken}`, 'Accept': 'application/vnd.github.v3+json' }
        });
        // Process response
        if (!response.ok) {
          const errorText = await response.text();
          const errorMsg = `GitHub API Error: ${response.status} ${errorText}`;
          logToTerminal(`Action 'fetchUserRepositories' failed: ${errorMsg}`, 'error');
          throw new Error(errorMsg); // Let catch block handle it
        }
        const data = await response.json();
        const repoNames = data.map(repo => repo.name);
        const resultMsg = `User Repositories: ${repoNames.join(', ') || 'No repositories found.'}`;
        logToTerminal(`Action 'fetchUserRepositories' successful. Found: ${repoNames.length} repos.`, 'info');
        return resultMsg; // Return to AI
      } catch (e) {
        // Handle errors
        const errMsg = `Error fetching GitHub repositories: ${e.message}`;
        logToTerminal(errMsg, 'error');
        console.error(errMsg, e);
        return errMsg; // Return error to AI
      }
    }
  });

  useCopilotAction({
    name: "fetchRepoFileContent",
    description: "Fetches the content of a specific file from a GitHub repository. Requires GitHub PAT, owner, repo name, and file path.",
    parameters: [
      { name: "githubToken", type: "string", description: "GitHub PAT (required for private repos or higher rate limits).", required: true },
      { name: "owner", type: "string", description: "The owner of the repository.", required: true },
      { name: "repo", type: "string", description: "The name of the repository.", required: true },
      { name: "path", type: "string", description: "The path to the file within the repository.", required: true },
    ],
    handler: async ({ githubToken, owner, repo, path }) => {
      logToTerminal(`Action 'fetchRepoFileContent' started for ${owner}/${repo}/${path}`, 'info');
      if (!owner || !repo || !path || !githubToken) {
        const errMsg = "Token, owner, repo, and path are required.";
        logToTerminal(`Action 'fetchRepoFileContent' failed: ${errMsg}`, 'error');
        return errMsg;
      }
      try {
        // Call GitHub API
        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
          headers: { 'Authorization': `Bearer ${githubToken}`, 'Accept': 'application/vnd.github.v3+json' }
        });
        // Process response
        if (!response.ok) {
          const errorText = await response.text();
          const errorMsg = `GitHub API Error: ${response.status} ${errorText}`;
          logToTerminal(`Action 'fetchRepoFileContent' failed: ${errorMsg}`, 'error');
          throw new Error(errorMsg);
        }
        const data = await response.json();
        if (data.content && data.encoding === 'base64') {
          const decodedContent = atob(data.content);
          logToTerminal(`Action 'fetchRepoFileContent' successful for ${path}.`, 'info');
          return `Content of ${path}:\n${decodedContent}`; // Return to AI
        }
        logToTerminal(`Action 'fetchRepoFileContent': File content not found or not base64 for ${path}.`, 'warn');
        return "File content not found or not base64 encoded."; // Return to AI
      } catch (e) {
        // Handle errors
        const errMsg = `Error fetching file content: ${e.message}`;
        logToTerminal(errMsg, 'error');
        console.error(errMsg, e);
        return errMsg; // Return error to AI
      }
    }
  });

  useCopilotAction({
    name: "listHuggingFaceModels",
    description: "Lists models from Hugging Face Hub. Can be filtered by an optional search query. An API token is optional for public models.",
    parameters: [
      { name: "hfToken", type: "string", description: "Hugging Face API Token (optional).", required: false },
      { name: "searchQuery", type: "string", description: "Term to search for models (optional).", required: false },
      { name: "limit", type: "number", description: "Number of models to return (default 10).", required: false },
    ],
    handler: async ({ hfToken, searchQuery, limit = 10 }) => {
      logToTerminal(`Action 'listHuggingFaceModels' started. Query: ${searchQuery || 'N/A'}, Limit: ${limit}`, 'info');
      // Prepare URL and Headers
      let url = `https://huggingface.co/api/models?limit=${limit}`;
      if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`;
      const headers = { 'Accept': 'application/json' };
      if (hfToken) headers['Authorization'] = `Bearer ${hfToken}`;

      try {
        // Call HF API
        const response = await fetch(url, { headers });
        // Process response
        if (!response.ok) {
          const errorText = await response.text();
          const errorMsg = `HF API Error: ${response.status} ${errorText}`;
          logToTerminal(`Action 'listHuggingFaceModels' failed: ${errorMsg}`, 'error');
          throw new Error(errorMsg);
        }
        const data = await response.json();
        const modelIds = data.map(model => `ID: ${model.modelId}, Pipeline: ${model.pipeline_tag || 'N/A'}, Likes: ${model.likes || 0}`);
        const resultMsg = `Hugging Face Models:\n${modelIds.join('\n') || 'No models found.'}`;
        logToTerminal(`Action 'listHuggingFaceModels' successful. Found ${modelIds.length} models.`, 'info');
        return resultMsg; // Return to AI
      } catch (e) {
        // Handle errors
        const errMsg = `Error listing HF models: ${e.message}`;
        logToTerminal(errMsg, 'error');
        console.error(errMsg, e);
        return errMsg; // Return error to AI
      }
    }
  });

  useCopilotAction({
    name: "getHuggingFaceModelInfo",
    description: "Gets detailed information about a specific Hugging Face model by its ID. API token is optional.",
    parameters: [
      { name: "hfToken", type: "string", description: "Hugging Face API Token (optional).", required: false },
      { name: "modelId", type: "string", description: "The ID of the model (e.g., 'bert-base-uncased').", required: true },
    ],
    handler: async ({ hfToken, modelId }) => {
      logToTerminal(`Action 'getHuggingFaceModelInfo' started for model: ${modelId}`, 'info');
      if (!modelId) {
        const errMsg = "Model ID is required.";
        logToTerminal(`Action 'getHuggingFaceModelInfo' failed: ${errMsg}`, 'error');
        return errMsg;
      }
      // Prepare Headers
      const headers = { 'Accept': 'application/json' };
      if (hfToken) headers['Authorization'] = `Bearer ${hfToken}`;

      try {
        // Call HF API
        const response = await fetch(`https://huggingface.co/api/models/${encodeURIComponent(modelId)}`, { headers });
        // Process response
        if (!response.ok) {
          const errorText = await response.text();
          const errorMsg = `HF API Error: ${response.status} ${errorText}`;
          logToTerminal(`Action 'getHuggingFaceModelInfo' failed for ${modelId}: ${errorMsg}`, 'error');
          throw new Error(errorMsg);
        }
        const data = await response.json();
        logToTerminal(`Action 'getHuggingFaceModelInfo' successful for ${modelId}.`, 'info');
        return `Model Info (${modelId}):\n${JSON.stringify(data, null, 2)}`; // Return to AI
      } catch (e) {
        // Handle errors
        const errMsg = `Error getting HF model info for ${modelId}: ${e.message}`;
        logToTerminal(errMsg, 'error');
        console.error(errMsg, e);
        return errMsg; // Return error to AI
      }
    }
  });

  useCopilotAction({
    name: "googleSearch",
    description: "Performs a web search using Google Custom Search API. Requires Google API Key and CX ID.",
    parameters: [
      { name: "googleApiKey", type: "string", description: "Google API Key for Custom Search.", required: true },
      { name: "googleCxId", type: "string", description: "Google Custom Search Engine ID (CX ID).", required: true },
      { name: "query", type: "string", description: "The search query.", required: true },
    ],
    handler: async ({ googleApiKey, googleCxId, query }) => {
      logToTerminal(`Action 'googleSearch' started. Query: ${query}`, 'info');
      if (!googleApiKey || !googleCxId || !query) {
        const errMsg = "API Key, CX ID, and query are required for Google Search.";
        logToTerminal(`Action 'googleSearch' failed: ${errMsg}`, 'error');
        return errMsg;
      }
      try {
        // Prepare URL
        const url = `https://www.googleapis.com/customsearch/v1?key=${googleApiKey}&cx=${googleCxId}&q=${encodeURIComponent(query)}`;
        // Call Google API
        const response = await fetch(url);
        const data = await response.json();
        // Process response
        if (!response.ok) {
          const errorMsg = data.error?.message || `Google API Error: ${response.status} ${response.statusText}`;
          logToTerminal(`Action 'googleSearch' failed: ${errorMsg}`, 'error');
          throw new Error(errorMsg);
        }

        if (data.items && data.items.length > 0) {
          const results = data.items.map(item => `Title: ${item.title}\nLink: ${item.link}\nSnippet: ${item.snippet}`).join('\n---\n');
          logToTerminal(`Action 'googleSearch' successful for query: "${query}". Found ${data.items.length} results.`, 'info');
          return `Google Search Results for "${query}":\n${results}`; // Return to AI
        }
        logToTerminal(`Action 'googleSearch': No results found for query: "${query}".`, 'info');
        return "No results found."; // Return to AI
      } catch (e) {
        // Handle errors
        const errMsg = `Error performing Google search: ${e.message}`;
        logToTerminal(errMsg, 'error');
        console.error(errMsg, e);
        return errMsg; // Return error to AI
      }
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
      logToTerminal(`Action 'researchAndSummarizeTopic' started for: "${topic}"`, 'info');
      if (!topic || !googleApiKey || !googleCxId) {
        const errMsg = "Topic, Google API Key, and CX ID are required.";
        logToTerminal(`Action 'researchAndSummarizeTopic' failed: ${errMsg}`, 'error');
        return errMsg;
      }
      // Determine Ollama model for summarization
      const ollamaModelForSummarization = document.getElementById('ollama-model-input')?.value || 'llama3';

      try {
        // Call backend API
        const response = await fetch('http://localhost:3001/api/copilotkit/researchAndSummarize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topic, ollamaModel: ollamaModelForSummarization, googleApiKey, googleCxId })
        });
        // Process response
        const result = await response.json();
        if (!response.ok) {
          const errorMsg = result.error || `Backend error: ${response.statusText}`;
          const errorDetails = result.log ? ` Log: ${JSON.stringify(result.log)}` : (result.details || '');
          if (result.details) console.error("Backend error details for researchAndSummarizeTopic:", result.details);
          if (result.log) result.log.forEach(logEntry => logToTerminal(logEntry, 'info'));
          logToTerminal(`Action 'researchAndSummarizeTopic' failed: ${errorMsg}`, 'error');
          return `Error in research/summarization workflow: ${errorMsg}.${errorDetails}`; // Return error to AI
        }
        // Log backend steps to terminal UI
        if (result.log) result.log.forEach(logEntry => logToTerminal(logEntry, 'info'));
        logToTerminal(`Action 'researchAndSummarizeTopic' successful for: "${topic}".`, 'info');
        return `Research & Summary for "${topic}":\nSource: ${result.firstResultTitle} (${result.firstResultLink})\nSummary:\n${result.summary}`; // Return to AI
      } catch (e) {
        // Handle frontend/network errors
        const errMsg = `Frontend error for 'researchAndSummarizeTopic': ${e.message}`;
        logToTerminal(errMsg, 'error');
        console.error(errMsg, e);
        return errMsg; // Return error to AI
      }
    }
  });

  useCopilotAction({
    name: "searchWithMorphic",
    description: "Opens the Morphic AI Search Engine (assumed running on http://localhost:3002) within SKYSCOPE AI, optionally with a specific search query.",
    parameters: [ { name: "query", type: "string", description: "The search query for Morphic (optional).", required: false }, ],
    handler: async ({ query }) => {
      logToTerminal(`Action 'searchWithMorphic' started. Query: "${query || 'homepage'}"`, 'info');
      let morphicUrl = "http://localhost:3002";
      if (query && query.trim() !== "") morphicUrl += `/search?q=${encodeURIComponent(query.trim())}`;

      // Check if browser control function is available
      if (!window.skyscopeBrowser?.loadUrl) {
        const errMsg = "Browser pane function 'loadUrl' is not available.";
        logToTerminal(errMsg, 'error');
        return errMsg; // Return error to AI
      }
      // Call the function exposed by BrowserPaneComponent
      window.skyscopeBrowser.loadUrl(morphicUrl);
      logToTerminal(`Action 'searchWithMorphic' completed. Loaded URL: ${morphicUrl}`, 'info');
      return `Morphic Search interface loaded in the browser pane. Searching for: "${query || 'homepage'}". Please interact with Morphic directly in its pane.`; // Confirmation to AI
    }
  });

  useCopilotAction({
      name: "describeImageFromUrl",
      description: "Fetches an image from a public URL, sends it with a text prompt to a multimodal Ollama model (e.g., 'llava'), and returns the model's textual response. User might need to specify the Ollama model if not 'llava'.",
      parameters: [
        { name: "imageUrl", type: "string", description: "The publicly accessible URL of the image to describe.", required: true },
        { name: "prompt", type: "string", description: "Your question or instruction about the image (e.g., 'What objects are in this image?', 'Describe this scene in detail.').", required: true },
        { name: "ollamaModel", type: "string", description: "The multimodal Ollama model to use (e.g., 'llava', 'bakllava', 'qwen:7b-chat-q5_K_M'). Defaults to 'llava' or current model input if not specified.", required: false }
      ],
      handler: async ({ imageUrl, prompt, ollamaModel }) => {
        // Determine Ollama model to use
        const modelToUse = ollamaModel || document.getElementById('ollama-model-input')?.value || 'llava';
        logToTerminal(`Action 'describeImageFromUrl' started. URL: "${imageUrl}", Model: ${modelToUse}`, 'info');

        if (!imageUrl || !prompt) {
          const errMsg = "Image URL and a prompt are required to describe an image.";
          logToTerminal(`Action 'describeImageFromUrl' failed: ${errMsg}`, 'error');
          return errMsg;
        }
        // Basic URL validation
        if (!imageUrl.toLowerCase().startsWith('http://') && !imageUrl.toLowerCase().startsWith('https://')) {
            const errMsg = "Invalid Image URL provided. It must start with http:// or https://";
            logToTerminal(`Action 'describeImageFromUrl' failed: ${errMsg}`, 'error');
            return errMsg;
        }

        try {
          // Call backend API
          const response = await fetch('http://localhost:3001/api/copilotkit/describeImageUrl', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageUrl, prompt, ollamaModel: modelToUse })
          });
          // Process response
          const result = await response.json();
          if (!response.ok) {
            const errorMsg = result.error || `Backend error: ${response.statusText}`;
            const errorDetails = result.details || '';
            if (errorDetails) console.error("Backend error details for describeImageFromUrl:", errorDetails);
            logToTerminal(`Action 'describeImageFromUrl' failed: ${errorMsg}`, 'error');
            return `Error describing image: ${errorMsg}`; // Return error to AI
          }
          logToTerminal(`Action 'describeImageFromUrl' successful for "${imageUrl}".`, 'info');
          return `Description for image at ${imageUrl}:\n${result.description}`; // Return to AI
        } catch (e) {
          // Handle frontend/network errors
          const errMsg = `Frontend error for 'describeImageFromUrl': ${e.message}`;
          logToTerminal(errMsg, 'error');
          console.error(errMsg, e);
          return errMsg; // Return error to AI
        }
      }
    });

  useCopilotAction({
    name: "analyzeFileContentAndSuggestChanges",
    description: "Analyzes the provided text content (e.g., from a file) based on a task prompt, suggests changes using an Ollama model, and asks for user approval of suggestions (mocked). Does NOT apply changes.",
    parameters: [
      { name: "textContent", type: "string", description: "The text content to analyze.", required: true },
      { name: "analysisTaskPrompt", type: "string", description: "The specific task or question for analyzing the content (e.g., 'Identify potential bugs and suggest fixes', 'Rewrite this for clarity').", required: true },
      { name: "ollamaModel", type: "string", description: "Ollama model to use for analysis (e.g., 'llama3').", required: false }
    ],
    handler: async ({ textContent, analysisTaskPrompt, ollamaModel }) => {
      // Determine Ollama model
      const modelToUse = ollamaModel || document.getElementById('ollama-model-input')?.value || 'llama3';
      logToTerminal(`Action 'analyzeFileContentAndSuggestChanges' started. Model: ${modelToUse}. Task: "${analysisTaskPrompt}"`, 'info');

      try {
        // Call backend API for analysis
        const response = await fetch('http://localhost:3001/api/copilotkit/analyzeTextContent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ textContent, analysisTaskPrompt, ollamaModel: modelToUse })
        });
        const analysisResult = await response.json();

        // Process backend response
        if (!response.ok) {
          const errorMsg = analysisResult.error || `Backend error: ${response.statusText}`;
          const errorDetails = analysisResult.details || analysisResult.raw_response || '';
          if (errorDetails && errorDetails !== errorMsg) console.error("Backend error details for analyzeFileContentAndSuggestChanges:", errorDetails);
          logToTerminal(`Action 'analyzeFileContentAndSuggestChanges' failed: ${errorMsg}`, 'error');
          return `Error during content analysis: ${errorMsg}`; // Return error to AI
        }

        // Format suggestions for user and AI
        let formattedSuggestions = "No specific suggestions format returned or suggestions not found.";
        if (analysisResult.suggestions && Array.isArray(analysisResult.suggestions)) {
          if (analysisResult.suggestions.length === 0) {
            formattedSuggestions = "AI analysis complete: No specific change suggestions were provided.";
          } else {
            formattedSuggestions = analysisResult.suggestions.map((s, i) =>
              `Suggestion ${i+1}:\nFinding: ${s.finding || 'N/A'}\nOriginal: "${s.original_snippet || 'N/A'}"\nSuggested Change: "${s.suggested_change || 'N/A'}"\nReason: ${s.reason || 'N/A'}`
            ).join('\n---\n');
          }
        } else if (analysisResult.raw_response) {
            formattedSuggestions = `AI analysis (raw response from LLM):\n${analysisResult.raw_response}`;
        } else if (typeof analysisResult === 'object') {
          formattedSuggestions = `AI analysis (unstructured JSON response):\n${JSON.stringify(analysisResult, null, 2)}`;
        }
        logToTerminal(`Action 'analyzeFileContentAndSuggestChanges': Analysis received. Presenting to user for mock approval.`, 'info');

        // SIMULATE USER APPROVAL STEP
        const userApproved = confirm(`AI Analysis Complete. Suggestions:\n\n${formattedSuggestions}\n\nDo you approve these suggestions? (This is a mock approval - no changes will be applied yet)`);

        const approvalStatus = userApproved ? "APPROVED" : "REJECTED";
        logToTerminal(`User ${approvalStatus} suggestions.`, 'info');
        return `User ${approvalStatus} the following suggestions (no changes applied yet):\n${formattedSuggestions}`; // Return to AI

      } catch (e) {
        // Handle frontend/network errors
        const errMsg = `Frontend error for 'analyzeFileContentAndSuggestChanges': ${e.message}`;
        logToTerminal(errMsg, 'error');
        console.error(errMsg, e);
        return errMsg; // Return error to AI
      }
    }
  });

  // --- Must be the LAST useCopilotAction due to its own definition potentially being included ---
  useCopilotAction({
    name: "listAvailableTools",
    description: "Get a list of available tools or actions that I (the AI) can use.",
    parameters: [],
    handler: async () => {
      // Note: This list is manually maintained.
      // In a more advanced system, this could be dynamically generated
      // by inspecting the CopilotKit instance or a central registry.
      const availableTools = [
        { name: "getTime", description: "Get the current date and time." },
        { name: "showSimpleAlert", description: "Display a simple alert message to the user." },
        { name: "getActivePanes", description: "Get a list of currently active/visible UI panes (mocked)." },
        { name: "executeTerminalCommand", description: "Executes a shell command on the local machine." },
        { name: "navigateToUrl", description: "Navigates the app's browser pane to a URL." },
        { name: "getCurrentBrowserPageContent", description: "Fetches text content of a webpage via headless browser." },
        { name: "fetchUserRepositories", description: "Fetches GitHub repositories for a user (requires PAT)." },
        { name: "fetchRepoFileContent", description: "Fetches file content from a GitHub repo (requires PAT)." },
        { name: "listHuggingFaceModels", description: "Lists models from Hugging Face Hub (optional token, search query)." },
        { name: "getHuggingFaceModelInfo", description: "Gets info for a specific HF model (optional token)." },
        { name: "googleSearch", description: "Performs a Google web search (requires API key and CX ID)." },
        { name: "researchAndSummarizeTopic", description: "Researches a topic using Google, fetches content, and summarizes it." },
        { name: "searchWithMorphic", description: "Opens Morphic AI Search with an optional query in the browser pane." },
        { name: "describeImageFromUrl", description: "Describes an image from a URL using a multimodal Ollama model." },
        { name: "readLocalFileContentForAI", description: "Reads content of a local file for AI analysis (requires absolute path)." },
        { name: "analyzeFileContentAndSuggestChanges", description: "Analyzes text content, suggests changes, and asks for user approval (mocked)." },
        { name: "listAvailableTools", description: "Lists these available tools." } // Self-reference
      ].sort((a,b) => a.name.localeCompare(b.name)); // Keep sorted for consistent output
      logToTerminal("Action 'listAvailableTools' called.", 'info');
      return JSON.stringify(availableTools, null, 2); // Return to AI
    }
  });

  // Effect hook for setting up event listeners for the Agent Framework Test Area
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
                // Assuming Agent class is globally available or imported
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
            // The AgentManager._displayAgentActivity now directly logs to #agent-activity-log-monitor
            // So, direct manipulation of its textContent here for "Attempting to start..." might be redundant
            // if _displayAgentActivity is called immediately by startAgentCycle.
            // However, providing an initial message from the UI click is fine.
            const agentCycleLog = document.getElementById('agent-activity-log-monitor');
            if(agentCycleLog) agentCycleLog.textContent = `UI: Attempting to start agent cycle with model: ${modelName}...\n`;
            agentManager.startAgentCycle(modelName, 'agent-activity-log-monitor');
        });
    }
    if (stopAgentCycleButton && agentManager) {
        stopAgentCycleButton.addEventListener('click', () => {
             agentManager.stopAgentCycle();
             // AgentManager.stopAgentCycle itself should log to #agent-activity-log-monitor
        });
    }
  }, [agentManager]); // Dependency on agentManager ensures this runs after manager is initialized


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
