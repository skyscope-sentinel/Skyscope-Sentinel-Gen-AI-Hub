// renderer/pages/index.js
import React from 'react';
import Head from 'next/head';
import HeaderComponent from '../components/HeaderComponent';
import FooterComponent from '../components/FooterComponent';
import CodeAnimatorComponent from '../components/CodeAnimatorComponent';
import PaneLayoutComponent from '../components/PaneLayoutComponent';
import { CopilotPopup } from '@copilotkit/react-ui';
import { useCopilotAction } from '@copilotkit/react-core'; // Should already be there

export default function HomePage() {
  // Define CopilotKit frontend actions
  useCopilotAction({
    name: "getTime",
    description: "Get the current date and time.",
    parameters: [], // No parameters for this action
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
      {
        name: "message",
        type: "string",
        description: "The message to display in the alert.",
        required: true
      },
    ],
    handler: async ({ message }) => {
      console.log("Action: showSimpleAlert called with message:", message);
      alert(`Message from SKYSCOPE AI: ${message}`); // Standard browser alert
      return "Alert has been displayed to the user.";
    },
  });

  useCopilotAction({
    name: "getActivePanes",
    description: "Get a list of currently active/visible UI panes in the SKYSCOPE AI application. For now, this is a mock.",
    parameters: [],
    handler: async () => {
      // In a real app, this would check the actual state of UI panes.
      const mockActivePanes = ["Terminal", "Browser", "Agent Monitoring"];
      console.log("Action: getActivePanes called, returning mock data:", mockActivePanes);
      return JSON.stringify(mockActivePanes);
    },
  });

  useCopilotAction({
    name: "executeTerminalCommand",
    description: "Executes a shell command on the local machine where SKYSCOPE AI is running and returns its output. Use with caution as this can modify the system. List files with 'ls', show directory with 'pwd', etc.",
    parameters: [
      {
        name: "command",
        type: "string",
        description: "The shell command to execute (e.g., 'ls -la', 'echo hello').",
        required: true
      },
    ],
    handler: async ({ command }) => {
      console.log("CopilotAction: executeTerminalCommand called with command:", command);

      if (window.skyscopeTerminal && typeof window.skyscopeTerminal.appendToOutput === 'function') {
        window.skyscopeTerminal.appendToOutput(command, 'command');
      } else {
        console.warn("window.skyscopeTerminal.appendToOutput not found. Terminal UI might not update with command echo.");
      }

      if (window.electronIPC && typeof window.electronIPC.invoke === 'function') {
        try {
          const result = await window.electronIPC.invoke('execute-command', command);
          let outputString = "";
          if (result.stdout) {
            outputString += `STDOUT:\n${result.stdout}\n`;
            if (window.skyscopeTerminal && typeof window.skyscopeTerminal.appendToOutput === 'function') {
              window.skyscopeTerminal.appendToOutput(result.stdout, 'output');
            }
          }
          if (result.stderr) {
            outputString += `STDERR:\n${result.stderr}\n`;
            if (window.skyscopeTerminal && typeof window.skyscopeTerminal.appendToOutput === 'function') {
              window.skyscopeTerminal.appendToOutput(result.stderr, 'error');
            }
          }
          if (result.error) {
             outputString += `EXEC_ERROR: ${result.error}\n (Code: ${result.code})`;
             if (window.skyscopeTerminal && typeof window.skyscopeTerminal.appendToOutput === 'function' && !result.stderr) {
               window.skyscopeTerminal.appendToOutput(`Error: ${result.error} (Code: ${result.code})`, 'error');
            }
          }
          if (outputString.trim() === "") outputString = "Command executed with no output.";

          return outputString.trim();
        } catch (e) {
          console.error("Error invoking 'execute-command' via IPC:", e);
          if (window.skyscopeTerminal && typeof window.skyscopeTerminal.appendToOutput === 'function') {
            window.skyscopeTerminal.appendToOutput(`IPC Error: ${e.message}`, 'error');
          }
          return `Error executing command: ${e.message}`;
        }
      } else {
        const errMsg = "Electron IPC bridge ('window.electronIPC.invoke') is not available. Cannot execute terminal command.";
        console.error(errMsg);
        if (window.skyscopeTerminal && typeof window.skyscopeTerminal.appendToOutput === 'function') {
          window.skyscopeTerminal.appendToOutput(errMsg, 'error');
        }
        return errMsg;
      }
    },
  });

  useCopilotAction({
    name: "navigateToUrl",
    description: "Navigates the application's integrated browser pane to a specified URL. The AI also performs this navigation in a headless browser for its own context.",
    parameters: [{ name: "url", type: "string", description: "The URL to navigate to (e.g., 'https://example.com').", required: true }],
    handler: async ({ url }) => {
      console.log("Action: navigateToUrl called with URL:", url);
      if (window.skyscopeBrowser && typeof window.skyscopeBrowser.loadUrl === 'function') {
        window.skyscopeBrowser.loadUrl(url); // Update visible iframe
      } else {
        console.warn("window.skyscopeBrowser.loadUrl not found. UI Iframe might not update.");
      }
      try {
        const response = await fetch('http://localhost:3001/api/browser/navigateTo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url })
        });
        if (!response.ok) throw new Error(`Backend navigation error: ${response.statusText}`);
        const result = await response.json();
        return `Navigation to ${url} initiated. Page title from headless browser: '${result.pageTitle}'. iframe updated.`;
      } catch (e) {
        return `Error during navigation: ${e.message}`;
      }
    }
  });

  useCopilotAction({
    name: "getCurrentBrowserPageContent",
    description: "Fetches the main text content of a given URL using a headless browser. If no URL is provided, it attempts to use the URL from the visible browser pane.",
    parameters: [{ name: "url", type: "string", description: "Optional URL. If not provided, uses the current URL from the app's browser pane.", required: false }],
    handler: async ({ url: targetUrl }) => {
      let urlToFetch = targetUrl;
      if (!urlToFetch) {
        if (window.skyscopeBrowser && typeof window.skyscopeBrowser.getCurrentUrl === 'function') {
          urlToFetch = window.skyscopeBrowser.getCurrentUrl();
        }
      }
      if (!urlToFetch || urlToFetch === 'about:blank') {
        return "Browser URL is not available or no URL specified.";
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
        // For brevity, return a snippet or summary. Full content can be very long.
        return `Content fetched for ${result.url}. Snippet: ${result.content ? result.content.substring(0, 500) + '...' : 'No content found.'}`;
      } catch (e) {
        return `Error fetching page content: ${e.message}`;
      }
    }
  });

  // --- GitHub Actions ---
  useCopilotAction({
    name: "fetchUserRepositories",
    description: "Fetches the list of repositories for a GitHub user, given a Personal Access Token (PAT).",
    parameters: [
      { name: "githubToken", type: "string", description: "The GitHub Personal Access Token.", required: true },
    ],
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
      } catch (e) {
        return `Error fetching GitHub repositories: ${e.message}`;
      }
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
          const decodedContent = atob(data.content); // Basic base64 decoding
          return `Content of ${path}:\n${decodedContent}`;
        }
        return "File content not found or not base64 encoded.";
      } catch (e) {
        return `Error fetching file content: ${e.message}`;
      }
    }
  });

  // --- Hugging Face Actions ---
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
      } catch (e) {
        return `Error listing HF models: ${e.message}`;
      }
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
      } catch (e) {
        return `Error getting HF model info: ${e.message}`;
      }
    }
  });

  // --- Google Search Action ---
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
        } else if (data.error) {
            return `Google API Error: ${data.error.message}`;
        }
        return "No results found.";
      } catch (e) {
        return `Error performing Google search: ${e.message}`;
      }
    }
  });

  // --- Update listAvailableTools Action ---
  useCopilotAction({
    name: "listAvailableTools", // This replaces the previous one or ensure only one is active
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
        { name: "listAvailableTools", description: "Lists these available tools." }
      ];
      console.log("Action: listAvailableTools called");
      return JSON.stringify(availableTools.sort((a,b) => a.name.localeCompare(b.name)), null, 2);
    }
  });

  return (
    <div className="skyscope-app">
      <Head>
        <title>SKYSCOPE AI</title>
        {/* ... other head elements ... */}
      </Head>
      <CodeAnimatorComponent />
      <HeaderComponent />
      <PaneLayoutComponent />
      <FooterComponent />

      <CopilotPopup
        instructions="You are SKYSCOPE AI. You can use various tools like executing terminal commands (e.g., 'execute terminal command pwd'), browsing (e.g., 'navigate to wikipedia.org'), fetching GitHub repos/files, searching HuggingFace, or performing Google searches. Ask 'what tools can you use?' to see all. For some tools, I might need API keys/tokens from you."
        defaultOpen={true}
        labels={{
          title: "SKYSCOPE AI Assistant",
          initial: "Hello! I'm SKYSCOPE AI. How can I assist?",
        }}
      />
      {/* Old test areas for direct API key input can be kept for now as a manual way for user to provide keys if AI asks */}
      {/* The existing HTML for ollama-test-area, github-test-area, hf-test-area, google-api-test-area should remain for this purpose if they exist */}
    </div>
  );
}
