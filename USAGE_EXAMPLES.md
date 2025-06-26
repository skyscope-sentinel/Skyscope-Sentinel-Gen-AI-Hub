# SKYSCOPE AI - Usage Examples & Prompts

This document provides example prompts and use cases for interacting with the SKYSCOPE AI assistant via the CopilotKit chat interface.

**Prerequisites for some actions:**
*   Ensure Ollama is running with necessary models (e.g., `llama3`, `llava`).
*   Ensure the `copilotkit_backend` service is running (`cd copilotkit_backend && npm start`).
*   Ensure Morphic is running on `http://localhost:3002` if using Morphic-related actions.
*   For actions requiring API keys (GitHub, Google Search, Hugging Face), the AI will likely ask for them. You may need to provide them in the chat or paste them into the old API test input fields on the UI if the AI is guided to look there. This is a temporary measure.

## General Interaction

*   "What tools can you use?" (AI lists available actions via `listAvailableTools`)
*   "What time is it?"
*   "Show an alert saying Hello SKYSCOPE AI"
*   "What are the active UI panes?"
*   "Get the last 5 lines from the terminal."
*   "Who is the pinned agent?" (If an agent is pinned in the Agent Monitoring pane)

## Terminal Commands

*   "Execute terminal command `ls -la`"
*   "Run `echo 'Hello from SKYSCOPE AI'` in the terminal"
*   "What's my current directory?" (AI uses `execute terminal command pwd`)

## Browser / Web Content

*   "Navigate the browser pane to `https://example.com`"
*   "What page is currently open in the browser?" (AI uses context from `useCopilotReadable`)
*   "Get the page content from the current browser page."
*   "Get page content for `https://another-url.com`"

## Morphic AI Search Pane Interaction

*Prerequisite: Morphic should be running on `http://localhost:3002`.*

*   "Open Morphic search for 'AI in healthcare'."
*   "Search Morphic for 'future of renewable energy' using advanced depth." (Note: `searchDepth` and `searchEngine` are speculative parameters for Morphic)
*   "Take this text and search it on Morphic: The quick brown fox jumps over the lazy dog."
*   "Load Morphic home page in the browser pane." (AI can use `navigateToUrl` with `http://localhost:3002`)

## Image Description (Vision)

*Prerequisite: A multimodal Ollama model (e.g., `llava`, `qwen2:7b-chat-v1.5-q4_K_M`) must be running and specified.*

*   "Describe the image from URL `https://path/to/your/image.jpg` with the prompt 'What are the main objects in this scene?' using model `llava`"
*   "Analyze this picture: `[image_url]` and tell me if it's day or night, using model `bakllava`"

## File Analysis (Local Files - Use with Caution)

*Prerequisite: Provide safe, accessible file paths when prompted by the AI.*

1.  **AI**: "I can analyze a local file for you. What is the absolute path to the file?"
2.  **User**: "/path/to/my/test_script.sh"
3.  **AI**: (Uses `readLocalFileContentForAI` action) "I have read the file. What kind of analysis do you want? For example, 'check for common bash errors' or 'suggest improvements for readability'."
4.  **User**: "Check for common bash errors and suggest fixes."
5.  **AI**: (Uses `analyzeFileContentAndSuggestChanges` action. The `SuggestionApprovalComponent` modal appears.)
6.  **User**: (Reviews suggestions in the modal and clicks "Approve All" or "Reject All").
7.  **AI**: "Okay, you [approved/rejected] the suggestions. (No changes were applied to the file by this action)."

## GitHub Interaction

*Prerequisite: You will need a GitHub Personal Access Token (PAT).*

*   "Fetch my GitHub repositories. My PAT is [your_pat_here]."
*   "Get the content of `README.md` from the repository `[owner]/[repo_name]`. My PAT is [your_pat_here]."

## Hugging Face Interaction

*Prerequisite: An HF API Token is optional for public models but may be needed for some actions or higher rate limits.*

*   "List Hugging Face models related to 'text generation'." (Optionally add: "My HF token is [your_token]")
*   "Get information about the Hugging Face model `bert-base-uncased`."

## Google Search

*Prerequisite: You will need a Google API Key and a Custom Search Engine ID (CX ID).*

*   "Search Google for 'SKYSCOPE AI'. My API key is [key] and CX ID is [cx_id]."

## Agent Configuration & Management (via Agent Framework Test UI)

*This uses the test buttons in the UI and the Agent Monitoring Pane.*

1.  Click "1. Create Sample Agents" in the "Agent Framework Test" area.
    *   Observe agents appear in the "Agent Roster" in the Monitoring Pane.
2.  In "Agent Framework Test", for "Agent ID": `agent1`, for "Goal": `Write a 3-sentence poem about space.`, then click "2. Set Goal & Add to Queue".
3.  Repeat for `agent2` with goal `Explain gravity in one sentence.`
4.  In "Agent Framework Test", click "3. Run Agent Cycle".
    *   Observe agents becoming active in the Monitoring Pane, their tasks, progress, and logs.
5.  **Simulating Agent Tool Use**:
    *   If an agent's LLM response (visible in Global Activity Log or agent's Action Log) is `TOOL_CALL: googleSearch(query=stars) ID:gsearch123`, and the agent enters "awaiting_tool_call" state (visible in Monitoring Pane).
    *   You would then tell the main CopilotKit AI: "Perform a Google Search for 'stars'. My API key is [...] and CX ID is [...]."
    *   The `googleSearch` CopilotKit action runs. Its handler will see `agent1` (or whichever agent made the request) is `awaiting_tool_call` for `googleSearch` with ID `gsearch123`. It will then automatically call `agentManager.provideToolResponse("agent1", "gsearch123", "Google search results...", "success")`.
    *   `agent1` will then re-activate to process the search results.

This section demonstrates the current capabilities. More complex agent interactions would involve enhancing the `AgentManager` or moving to a more formal agent framework like LangGraph on the backend.
