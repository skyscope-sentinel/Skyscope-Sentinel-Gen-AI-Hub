// js/agent_framework.js

/**
 * @file agent_framework.js
 * Defines the Agent class and AgentManager module for creating and managing
 * autonomous agents within the SKYSCOPE AI application. These agents can
 * pursue goals, maintain memory, interact with LLMs, and simulate tool usage.
 */

/**
 * Represents an autonomous agent with a persona, memory, goals, and action logging.
 * Agents can be assigned tasks and will attempt to complete them by interacting
 * with an LLM (via AgentManager) and requesting tool calls.
 */
class Agent {
    /**
     * Creates an instance of an Agent.
     * @param {string} id - A unique identifier for the agent (e.g., "agent1", "researcher").
     * @param {string} persona - A description of the agent's personality, role, skills, and limitations.
     * @param {string[]} [initialMemory=[]] - An optional array of strings representing pre-existing knowledge or context.
     */
    constructor(id, persona, initialMemory = []) {
        this.id = id;
        this.persona = persona;
        this.memory = [...initialMemory];
        this.currentGoal = "";
        // Updated states: idle, active_processing_llm, awaiting_tool_call, active_processing_tool_result, completed_goal, error
        this.state = "idle";
        this.microTaskProgress = 0;
        this.currentMicroTaskName = "Awaiting goal...";
        this.actionLog = [];
        /** @type {string|null} Stores the last error message encountered by the agent. */
        this.lastError = null;
        /** @type {{id: string|null, name: string|null, params: string|null, rawRequest: string|null}} Stores details of a requested tool call. */
        this.requestedTool = { id: null, name: null, params: null, rawRequest: null };
    }

    /**
     * Logs an action taken by the agent to its internal `actionLog`.
     * @param {string} actionDescription - A description of the action performed.
     * @param {('info'|'success'|'error'|'warn')} [status='info'] - The status/type of the log entry.
     */
    logAction(actionDescription, status = 'info') {
      const timestamp = new Date().toLocaleTimeString();
      // Include current state and goal in detailed logs for better context
      const goalSubstring = this.currentGoal ? this.currentGoal.substring(0,30) : "N/A";
      const contextDesc = `(State: ${this.state}, Goal: "${goalSubstring}...")`;
      this.actionLog.push({ timestamp, description: `${actionDescription} ${contextDesc}`, status });
      if (this.actionLog.length > 10) {
        this.actionLog.shift();
      }
    }

    /**
     * Updates the agent's current state and optionally its micro-task details.
     * @param {('idle'|'active_processing_llm'|'awaiting_tool_call'|'active_processing_tool_result'|'completed_goal'|'error')} newState - The new state.
     * @param {string} [microTaskName=null] - Optional new name for the current micro-task.
     * @param {number} [progress=null] - Optional new progress value (0-100).
     */
    setState(newState, microTaskName = null, progress = null) {
        this.state = newState;
        if (microTaskName !== null) this.currentMicroTaskName = microTaskName;
        if (progress !== null) this.microTaskProgress = progress;
        console.log(`Agent [${this.id}] state: ${newState}, task: "${this.currentMicroTaskName}", progress: ${this.microTaskProgress}%`);
    }

    /**
     * Clears any pending tool request details from the agent.
     * Called after a tool response is received or if a tool call is cancelled.
     */
    clearRequestedTool() {
        this.requestedTool = { id: null, name: null, params: null, rawRequest: null };
    }

    /**
     * Sets a new goal for the agent.
     * @param {string} goal - The new goal description.
     */
    setGoal(goal) {
        this.currentGoal = goal;
        this.memory.push(`New Goal: ${goal}`);
        this.clearRequestedTool();
        this.lastError = null;
        this.setState("idle", "Goal received, pending activation.", 0);
        this.logAction(`New goal set: "${goal}"`, 'info');
    }

    /**
     * Generates the context prompt for the LLM.
     * Includes persona, memory, goal, and instructions for tool usage and goal completion.
     * If the agent is processing a tool result, specific instructions are added.
     * @returns {string} The fully constructed prompt string.
     */
    getContextPrompt() {
        let context = `Persona: ${this.persona}\n\n`;
        context += "Memory (Recent Interactions/Observations):\n";
        const recentMemory = this.memory.slice(-10);
        recentMemory.forEach(mem => { context += `- ${mem}\n`; });
        context += `\nCurrent Goal: ${this.currentGoal}\n\n`;

        if (this.state === "active_processing_tool_result" && this.memory.length > 0 && this.memory[this.memory.length-1].startsWith("Tool Result for")) {
             context += `The last entry in your memory is the result of a tool you requested. Process this result in the context of your current goal. Based on this, decide your next step or if the goal is complete.\n\n`;
        }

        context += "To use a tool, respond with the exact format: TOOL_CALL: tool_name(param1=value1, param2=value2) ID:unique_tool_call_id_123\nThen, provide a short justification for why you need this tool call on the next line.\n";
        context += "If you believe the goal is complete, start your response with 'Goal Complete: '. Otherwise, continue to work towards the goal or request a tool call.";
        return context;
    }

    /**
     * Adds an interaction (prompt/context and LLM response) to the agent's long-term memory.
     * @param {string} prompt - The high-level prompt or context (e.g., current goal or tool call).
     * @param {string} response - The LLM's response or tool's result.
     */
    addInteractionToMemory(prompt, response) {
        this.memory.push(`Context/Prompt: ${prompt}`);
        this.memory.push(`Response/Result: ${response}`); // Clarified to include 'Result' for tools
    }
}


/**
 * @module AgentManager
 * Manages agents, their execution cycle, interaction with Ollama, and simulated tool usage.
 */
const AgentManager = (function() {
    let agents = {};
    let agentQueue = [];
    let isCycleRunning = false;
    let ollamaModelForCycle = "llama3";
    let cycleOutputElementId = "";
    let cycleIntervalId = null;
    let ollamaIsCurrentlyBusy = false;

    const toolCallRegex = /^TOOL_CALL:\s*([a-zA-Z0-9_]+)\s*\(([^)]*)\)\s*ID:([a-zA-Z0-9_.-]+)/;

    function _displayAgentActivity(agent, message) {
        const logEntry = agent ? `[${new Date().toLocaleTimeString()}] Agent[${agent.id}]: ${message}\n` : `[${new Date().toLocaleTimeString()}] System: ${message}\n`;
        console.log(logEntry.trim());
        const monitorLogElement = document.getElementById('agent-activity-log-monitor');
        if (monitorLogElement) {
          monitorLogElement.textContent += logEntry;
          monitorLogElement.scrollTop = monitorLogElement.scrollHeight;
        }
      }

    async function runAgentTurn(agentId) {
        const agent = agents[agentId];
        if (!agent) {
            _displayAgentActivity(null, `Error: Agent ${agentId} not found during turn.`);
            return null;
        }

        agent.logAction(`Turn started. Current state: ${agent.state}`, 'info');
        // Reset progress for a new LLM turn, or if processing tool result.
        // If it was awaiting_tool_call, provideToolResponse would have set to active_processing_tool_result and progress 10.
        if (agent.state !== "active_processing_tool_result") {
            agent.microTaskProgress = 10;
        }


        if (agent.state === "completed_goal") {
            _displayAgentActivity(agent, `Skipping turn: Goal "${agent.currentGoal}" already completed.`);
            // Ensure state reflects completion accurately if it somehow wasn't set before
            agent.setState("completed_goal", "Goal previously completed.", 100);
            agent.logAction('Skipped turn: Goal previously completed.', 'info');
            return agent;
        }

        // Set state for LLM processing (either initial or after a tool result)
        agent.setState("active_processing_llm", "Generating context prompt...", agent.microTaskProgress > 10 ? agent.microTaskProgress : 20);
        _displayAgentActivity(agent, `Thinking... Goal: ${agent.currentGoal}`);

        const prompt = agent.getContextPrompt();
        agent.currentMicroTaskName = `Querying LLM (${ollamaModelForCycle})...`;
        agent.logAction(`Querying LLM (${ollamaModelForCycle}) with prompt length ${prompt.length}`, 'info');
        agent.microTaskProgress = 30;

        try {
            ollamaIsCurrentlyBusy = true;
            const ollamaResponse = await fetch('http://localhost:11434/api/generate', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ model: ollamaModelForCycle, prompt: prompt, stream: false })
            });
            ollamaIsCurrentlyBusy = false;
            agent.microTaskProgress = 70;

            if (!ollamaResponse.ok) {
                const errorText = await ollamaResponse.text();
                agent.lastError = `Ollama API Error: ${ollamaResponse.status} - ${errorText}`;
                agent.setState("error", `Ollama Error: ${agent.lastError.substring(0,100)}...`, 0);
                agent.logAction(agent.lastError, 'error');
                return agent;
            }

            const responseData = await ollamaResponse.json();
            const actualResponse = responseData.response ? responseData.response.trim() : "";

            agent.currentMicroTaskName = "Processing LLM response";
            agent.logAction(`LLM Raw Response: "${actualResponse.substring(0,100)}..."`, 'info');
            _displayAgentActivity(agent, `LLM Raw Response: ${actualResponse}`);

            const toolCallMatch = actualResponse.match(toolCallRegex);

            if (toolCallMatch) {
                const toolName = toolCallMatch[1];
                const toolParamsString = toolCallMatch[2];
                const toolCallId = toolCallMatch[3];

                agent.requestedTool = { id: toolCallId, name: toolName, params: toolParamsString, rawRequest: toolCallMatch[0] };
                agent.setState("awaiting_tool_call", `Waiting for tool: ${toolName}(${toolParamsString})`, 80);
                agent.logAction(`Requested tool call: ${toolName}(${toolParamsString}) ID: ${toolCallId}`, 'success');
                _displayAgentActivity(agent, `Needs tool: ${toolName}. Parameters: ${toolParamsString}. Call ID: ${toolCallId}`);
            } else if (actualResponse.startsWith("Goal Complete:")) {
                agent.addInteractionToMemory(`Goal: ${agent.currentGoal}`, actualResponse);
                agent.setState("completed_goal", "Goal Completed", 100);
                agent.logAction(`Goal '${agent.currentGoal}' marked complete.`, 'success');
                _displayAgentActivity(agent, `Goal marked as complete.`);
            } else {
                agent.addInteractionToMemory(`Goal: ${agent.currentGoal}`, actualResponse);
                agent.setState("idle", "LLM response processed, awaiting next cycle.", 100);
                agent.logAction('Turn finished with LLM response, goal not yet complete.', 'info');
            }
        } catch (error) {
            ollamaIsCurrentlyBusy = false;
            agent.lastError = error.message;
            agent.setState("error", `Error: ${agent.lastError.substring(0,100)}...`, 0);
            agent.logAction(agent.lastError, 'error');
            _displayAgentActivity(agent, `Error: ${error.message}`);
        }
        return agent;
    }

    async function startAgentCycle(modelName, outputElemId) {
        if (isCycleRunning) {
            _displayAgentActivity(null, "Agent cycle is already running.");
            return;
        }
        if (agentQueue.length === 0) {
            _displayAgentActivity(null, "Agent queue is empty. Add agents with goals first.");
            return;
        }

        isCycleRunning = true;
        ollamaModelForCycle = modelName || ollamaModelForCycle;
        _displayAgentActivity(null, `Agent cycle started with model: ${ollamaModelForCycle}...`);

        while(agentQueue.length > 0 && isCycleRunning) {
            const agentId = agentQueue.shift();
            const agent = agents[agentId];

            if (!agent) {
                 _displayAgentActivity(null, `Agent ${agentId} not found in queue, skipping.`);
                 continue;
            }

            // Do NOT run an LLM turn if agent is awaiting a tool call.
            // It will be re-added to the queue by provideToolResponse when the tool result is ready.
            if (agent.state === "awaiting_tool_call") {
                agentQueue.push(agentId); // Put it back at the end of the queue to check later.
                _displayAgentActivity(agent, `Is awaiting tool call for [${agent.requestedTool.name}], deferring LLM turn.`);
                await new Promise(resolve => setTimeout(resolve, 1000)); // Avoid busy-looping if all agents are awaiting.
                continue;
            }

            await runAgentTurn(agentId);

            // Re-queue if goal not complete, not in error, and NOT awaiting a tool call.
            if (agent.state !== "completed_goal" && agent.state !== "error" && agent.state !== "awaiting_tool_call") {
                agentQueue.push(agentId);
            }

            await new Promise(resolve => setTimeout(resolve, 1000));

            if(agentQueue.length === 0 && isCycleRunning) {
                _displayAgentActivity(null, "Agent queue now empty during active cycle.");
                break;
            }
        }

        isCycleRunning = false;
        _displayAgentActivity(null, "Agent cycle processing finished (queue empty or cycle stopped).");
        console.log("Agent cycle processing finished.");
    }

    /**
     * Provides a response from an executed tool back to a waiting agent.
     * @param {string} agentId - The ID of the agent that requested the tool.
     * @param {string} toolCallId - The unique ID of the tool call this response is for.
     * @param {string} toolResponseText - The textual result or output from the tool.
     * @param {('success'|'error')} [toolStatus='success'] - The status of the tool execution.
     * @returns {boolean} True if the response was successfully provided and agent re-queued, false otherwise.
     */
    function provideToolResponse(agentId, toolCallId, toolResponseText, toolStatus = 'success') {
        const agent = agents[agentId];
        if (!agent) {
            _displayAgentActivity(null, `Error: Agent ${agentId} not found for provideToolResponse.`);
            console.error(`AgentManager: Agent ${agentId} not found for provideToolResponse.`);
            return false;
        }

        // Check if the agent is actually waiting for this specific tool call
        if (agent.state !== 'awaiting_tool_call' || !agent.requestedTool || agent.requestedTool.id !== toolCallId) {
            const toolNameForLog = agent.requestedTool?.name || 'unknown tool'; // Use current if available, else generic
            _displayAgentActivity(agent, `Warning: Received tool response for ID ${toolCallId} (tool: ${toolNameForLog}), but agent is not currently awaiting this specific call. Current state: ${agent.state}, Expected tool ID: ${agent.requestedTool?.id || 'none'}.`);
            // For robustness, log the unexpected response but don't process it against the agent's current state if it's not a match.
            agent.logAction(`Ignored mismatched/unexpected tool response (Expected ID: ${agent.requestedTool?.id || 'none'}, Got ID: ${toolCallId} for tool ${toolNameForLog})`, 'warn');
            return false;
        }

        const toolName = agent.requestedTool.name; // Now safe to access, as we matched the ID
        _displayAgentActivity(agent, `Received response for tool '${toolName}' (ID: ${toolCallId}). Status: ${toolStatus}.`);
        agent.logAction(`Tool response received for '${toolName}' (ID: ${toolCallId}): Status: ${toolStatus}, Response: ${toolResponseText.substring(0,100)}...`, toolStatus);

        // Add context about the tool call and its result to memory
        agent.addInteractionToMemory(
            `Attempted Tool Call (ID: ${toolCallId}): ${agent.requestedTool.rawRequest}`,
            `Tool '${toolName}' Result (Status: ${toolStatus}): ${toolResponseText}`
        );

        agent.clearRequestedTool(); // Clear the pending request

        if (toolStatus === 'success') {
            // Agent needs to process this tool result with LLM
            agent.setState("active_processing_tool_result", `Processing result from ${toolName}...`, 10);
        } else { // Tool execution failed
            agent.lastError = `Tool '${toolName}' failed or returned error: ${toolResponseText.substring(0,200)}...`; // Log a snippet
            agent.setState("error", `Error after tool '${toolName}' execution.`, 0);
            agent.logAction(agent.lastError, 'error'); // Log the specific tool error
        }

        // Re-queue the agent to process the tool's result or the error state
        if (!agentQueue.includes(agentId)) {
            agentQueue.push(agentId);
            _displayAgentActivity(agent, "Re-queued to process tool response/error.");
            console.log(`AgentManager: Agent ${agentId} re-queued after tool response.`);
        } else {
             _displayAgentActivity(agent, "Already in queue, will process tool response/error in next turn.");
        }
        // If the cycle isn't running, the user might need to restart it.
        if (!isCycleRunning) {
            _displayAgentActivity(null, "Agent cycle is not currently running. Start cycle to process tool response.");
        }
        return true;
    }

    // Public interface
    return {
        registerAgent: (agentInstance) => {
            agents[agentInstance.id] = agentInstance;
            _displayAgentActivity(null, `Agent [${agentInstance.id}] registered with persona: ${agentInstance.persona}`);
        },
        setAgentGoal: (agentId, goal) => {
            const agent = agents[agentId];
            if (agent) {
                agent.setGoal(goal);
                if (!agentQueue.includes(agentId) &&
                    (agent.state === "idle" || agent.state === "completed_goal" || agent.state === "error")) {
                    agentQueue.push(agentId);
                    _displayAgentActivity(agent, `Added to processing queue for new goal.`);
                } else if (agentQueue.includes(agentId)) {
                     _displayAgentActivity(agent, `Already in queue. Goal updated.`);
                } else {
                    _displayAgentActivity(agent, `Currently active. Goal updated; will address after current turn if re-queued.`);
                }
            } else {
                _displayAgentActivity(null, `Error: Agent [${agentId}] not found. Cannot set goal.`);
            }
        },
        startAgentCycle,
        stopAgentCycle: () => {
            if (!isCycleRunning) {
                _displayAgentActivity(null, "Agent cycle is not currently running.");
                return;
            }
            isCycleRunning = false;
            if (cycleIntervalId) { clearTimeout(cycleIntervalId); cycleIntervalId = null; }
            _displayAgentActivity(null, "Agent cycle stop requested by user. Finishing current turn...");
            Object.values(agents).forEach(agent => {
                if (agent.state === "active" || agent.state === "active_processing_llm" || agent.state === "active_processing_tool_result") {
                    agent.setState("idle", "Cycle stopped by user.", agent.microTaskProgress);
                    agent.logAction("Cycle stopped by user during turn.", "warn");
                }
            });
        },
        getAgentById: (id) => agents[id],
        getAllAgents: () => Object.values(agents),
        getAgentQueue: () => [...agentQueue],
        isOllamaBusy: () => ollamaIsCurrentlyBusy,
        getActiveToolRequest, // New
        provideToolResponse   // New
    };
})();
