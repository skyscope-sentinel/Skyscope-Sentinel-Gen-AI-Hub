// js/agent_framework.js

/**
 * Represents an autonomous agent with a persona, memory, and goals.
 */
class Agent {
    /**
     * Creates an instance of an Agent.
     * @param {string} id - A unique identifier for the agent.
     * @param {string} persona - A description of the agent's personality, role, and capabilities.
     * @param {string[]} [initialMemory=[]] - An optional array of initial memory entries.
     */
    constructor(id, persona, initialMemory = []) {
        this.id = id; // Unique agent identifier
        this.persona = persona; // Agent's role/personality description
        this.memory = [...initialMemory]; // Log of interactions and goals
        this.currentGoal = ""; // The current objective the agent is working towards
        this.state = "idle"; // Current state: "idle", "active", "completed_goal", "error"
        this.microTaskProgress = 0; // Percentage (0-100) completion of the current micro-task
        this.currentMicroTaskName = "Awaiting goal..."; // Description of the current small step
        this.actionLog = []; // Log of specific actions taken by the agent
    }

    /**
     * Logs an action taken by the agent.
     * Keeps a concise history of the last few actions.
     * @param {string} actionDescription - A description of the action performed.
     * @param {('info'|'success'|'error'|'warn')} [status='info'] - The status/type of the log entry.
     */
    logAction(actionDescription, status = 'info') {
      const timestamp = new Date().toLocaleTimeString();
      this.actionLog.push({ timestamp, description: actionDescription, status });
      if (this.actionLog.length > 10) { // Limit log size to the last 10 entries
        this.actionLog.shift();
      }
    }

    /**
     * Sets a new goal for the agent.
     * Resets progress and logs the new goal.
     * @param {string} goal - The new goal description.
     */
    setGoal(goal) {
        this.currentGoal = goal;
        this.memory.push(`New Goal: ${goal}`); // Add to long-term memory
        this.state = "idle"; // Reset state, ready for new goal processing
        this.microTaskProgress = 0;
        this.currentMicroTaskName = "Goal received, pending activation.";
        this.logAction(`New goal set: "${goal}"`, 'info'); // Log to short-term action log
        console.log(`Agent [${this.id}] goal set: ${goal}`);
    }

    /**
     * Generates the context prompt to be sent to the LLM.
     * Includes persona, recent memory, current goal, and instructions.
     * @returns {string} The fully constructed prompt for the LLM.
     */
    getContextPrompt() {
        let context = `Persona: ${this.persona}\n\n`;
        context += "Memory (Recent Interactions/Observations):\n";
        // Get the last 10 memory entries to provide recent context.
        const recentMemory = this.memory.slice(-10);
        recentMemory.forEach(mem => {
            context += `- ${mem}\n`;
        });
        context += `\nCurrent Goal: ${this.currentGoal}\n\n`;
        context += "Based on your persona, memory, and current goal, provide your response or next action. If you believe the goal is complete, start your response with the exact phrase 'Goal Complete: '. Otherwise, continue to work towards the goal.";
        return context;
    }

    /**
     * Adds a user prompt and an agent response pair to the agent's memory.
     * @param {string} prompt - The prompt or context that led to the response (often the goal or a summary).
     * @param {string} response - The agent's (LLM's) response.
     */
    addInteractionToMemory(prompt, response) {
        // Storing the high-level prompt (e.g., current goal) and the LLM's response.
        // Avoids storing the very long getContextPrompt() repeatedly.
        this.memory.push(`Context/Prompt: ${prompt}`);
        this.memory.push(`Response: ${response}`);
    }

    /**
     * Updates the agent's current state.
     * @param {('idle'|'active'|'completed_goal'|'error')} newState - The new state for the agent.
     */
    setState(newState) {
        this.state = newState;
        console.log(`Agent [${this.id}] state changed to: ${newState}`);
    }
}

/**
 * @module AgentManager
 * Manages a collection of agents, orchestrates their execution cycles,
 * and handles interaction with the Ollama LLM for agent responses.
 * Uses an IIFE to create a singleton-like module.
 */
const AgentManager = (function() {
    let agents = {}; // Stores agent instances, keyed by agent.id
    let agentQueue = []; // Array of agent IDs, determining the order of execution
    let isCycleRunning = false; // Flag to prevent concurrent cycle executions
    let ollamaModelForCycle = "llama3"; // Default Ollama model for agent turns
    let cycleOutputElementId = ""; // DEPRECATED: ID of an old global output element, now uses #agent-activity-log-monitor
    let cycleIntervalId = null; // Not currently used for a setTimeout-based loop, but available
    let ollamaIsCurrentlyBusy = false; // Tracks if an Ollama request is in flight

    /**
     * Displays or logs agent activity.
     * Primarily targets the '#agent-activity-log-monitor' <pre> tag in the UI.
     * Also logs to the browser console.
     * @param {Agent|null} agent - The agent performing the action, or null for system messages.
     * @param {string} message - The message to log.
     */
    function _displayAgentActivity(agent, message) {
        const logEntry = agent ? `[${new Date().toLocaleTimeString()}] Agent[${agent.id}]: ${message}\n` : `[${new Date().toLocaleTimeString()}] System: ${message}\n`;
        console.log(logEntry.trim()); // Keep console log

        const monitorLogElement = document.getElementById('agent-activity-log-monitor');
        if (monitorLogElement) {
          monitorLogElement.textContent += logEntry; // Use textContent for <pre> to preserve formatting
          monitorLogElement.scrollTop = monitorLogElement.scrollHeight; // Auto-scroll
        } else if (cycleOutputElementId) { // Fallback for older configurations
           const outputElement = document.getElementById(cycleOutputElementId);
           if (outputElement) {
               outputElement.textContent += logEntry;
               outputElement.scrollTop = outputElement.scrollHeight;
           }
        }
      }

    /**
     * Executes a single turn for a specified agent.
     * Fetches a response from the Ollama LLM based on the agent's context.
     * Updates the agent's state, memory, and micro-task progress.
     * @param {string} agentId - The ID of the agent to run a turn for.
     * @returns {Promise<Agent|null>} The agent instance after the turn, or null if not found.
     */
    async function runAgentTurn(agentId) {
        if (!agents[agentId]) {
            console.error(`Agent ${agentId} not found in runAgentTurn.`);
            return null;
        }
        const agent = agents[agentId];

        // Log start of the turn and set initial progress
        agent.logAction(`Turn started for goal: ${agent.currentGoal}`, 'info');
        agent.microTaskProgress = 10;

        // If goal already completed, skip turn but update task name
        if(agent.state === "completed_goal") {
            _displayAgentActivity(agent, `Already completed goal: ${agent.currentGoal}`);
            agent.microTaskProgress = 100;
            agent.currentMicroTaskName = "Goal previously completed.";
            agent.logAction('Skipped turn: Goal previously completed.', 'info');
            return agent;
        }

        // Set agent to active and update micro-task details
        agent.setState("active");
        agent.currentMicroTaskName = "Generating context prompt...";
        _displayAgentActivity(agent, `Thinking... Goal: ${agent.currentGoal}`);

        // Prepare prompt for LLM
        const prompt = agent.getContextPrompt();
        agent.currentMicroTaskName = `Querying LLM (${ollamaModelForCycle})...`;
        agent.logAction(`Preparing prompt and querying LLM (${ollamaModelForCycle})`, 'info');
        agent.microTaskProgress = 30;

        try {
            // Make the call to Ollama
            ollamaIsCurrentlyBusy = true;
            const ollamaResponse = await fetch('http://localhost:11434/api/generate', { // Using /api/generate for simpler non-chat model interactions
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ model: ollamaModelForCycle, prompt: prompt, stream: false })
            });
            ollamaIsCurrentlyBusy = false;
            agent.microTaskProgress = 70; // Mark progress after response received

            if (!ollamaResponse.ok) {
                const errorText = await ollamaResponse.text(); // Get error text from Ollama
                throw new Error(`Ollama API Error: ${ollamaResponse.status} - ${errorText}`);
            }

            const responseData = await ollamaResponse.json();
            const actualResponse = responseData.response.trim(); // `response` field for /api/generate

            // Process LLM response
            agent.currentMicroTaskName = "Processing LLM response";
            agent.logAction(`Received LLM response (${actualResponse.length} chars)`, 'info');
            agent.addInteractionToMemory(`Goal: ${agent.currentGoal}`, actualResponse); // Add to long-term memory
            _displayAgentActivity(agent, `Response: ${actualResponse}`);

            // Check for goal completion
            if (actualResponse.startsWith("Goal Complete:")) {
                agent.setState("completed_goal");
                agent.microTaskProgress = 100;
                agent.currentMicroTaskName = "Goal Completed";
                agent.logAction(`Goal '${agent.currentGoal}' marked complete.`, 'success');
                _displayAgentActivity(agent, `Goal marked as complete.`);
            } else {
                agent.setState("idle"); // Set back to idle, ready for next turn if needed
                agent.microTaskProgress = 100; // Mark micro-task as complete for this turn
                agent.currentMicroTaskName = "Awaiting next cycle for continuation.";
                agent.logAction('Turn finished, goal not yet complete.', 'info');
            }
        } catch (error) {
            // Handle errors during Ollama call or processing
            ollamaIsCurrentlyBusy = false;
            console.error(`Error in runAgentTurn for ${agentId}:`, error);
            _displayAgentActivity(agent, `Error: ${error.message}`);
            agent.setState("error");
            agent.microTaskProgress = 0;
            agent.currentMicroTaskName = `Error encountered`;
            agent.logAction(`Error: ${error.message}`, 'error');
        }
        return agent;
    }

    // This internal function was part of a previous setTimeout-based loop.
    // The current startAgentCycle uses a direct while loop with await.
    // Retaining for potential future refactor to event-driven or setTimeout loop.
    async function _agentCycleLoop() {
        if (agentQueue.length === 0) {
            isCycleRunning = false;
            const outputElement = document.getElementById(cycleOutputElementId);
            if (outputElement) outputElement.innerHTML += "Agent cycle finished (queue empty).\n";
            console.log("Agent cycle finished (queue empty).");
            if(cycleIntervalId) clearInterval(cycleIntervalId);
            cycleIntervalId = null;
            return;
        }

        const agentId = agentQueue.shift(); // Get agent from front of queue
        const agent = await runAgentTurn(agentId);

        if (agent && agent.state !== "completed_goal" && agent.state !== "error") {
            agentQueue.push(agentId); // Add back to end of queue if goal not complete and no error
        } else if (!agent) {
            // Agent was not found or some other critical error, do not requeue
             _displayAgentActivity({id: agentId}, `Agent ${agentId} not processed correctly, removed from queue.`);
        }


        // If queue is not empty, schedule next iteration
        if (agentQueue.length > 0) {
            // cycleIntervalId = setTimeout(_agentCycleLoop, 1000); // Continue loop with delay
        } else {
            isCycleRunning = false;
            const outputElement = document.getElementById(cycleOutputElementId);
            if (outputElement) outputElement.innerHTML += "Agent cycle finished (all agents processed or queue empty).\n";
            console.log("Agent cycle finished (all agents processed or queue empty).");
            if(cycleIntervalId) clearInterval(cycleIntervalId);
            cycleIntervalId = null;
        }
    }


    async function startAgentCycle(modelName, outputElemId) {
        if (isCycleRunning) {
            console.warn("Agent cycle is already running.");
            const outputElement = document.getElementById(outputElemId || cycleOutputElementId);
            if (outputElement) outputElement.innerHTML += "Cycle already running.\n";
            return;
        }
        if (agentQueue.length === 0) {
            console.info("Agent queue is empty. Nothing to do.");
             const outputElement = document.getElementById(outputElemId || cycleOutputElementId);
            if (outputElement) outputElement.innerHTML += "Agent queue is empty. Add agents with goals first.\n";
            return;
        }

        isCycleRunning = true;
        ollamaModelForCycle = modelName || ollamaModelForCycle; // Use provided or default
        cycleOutputElementId = outputElemId || cycleOutputElementId; // Use provided or default

        const outputElement = document.getElementById(cycleOutputElementId);
        if (outputElement) {
             outputElement.innerHTML = ""; // Clear previous activity for this cycle
             outputElement.innerHTML += `Agent cycle started with model: ${ollamaModelForCycle}...\n`;
        }
        console.log(`Agent cycle started with model: ${ollamaModelForCycle}...`);

        // Using a simple loop with await for sequential processing for now
        // A more robust implementation might use a setTimeout based loop for UI responsiveness
        while(agentQueue.length > 0 && isCycleRunning) { // isCycleRunning can be a stop flag
            const agentId = agentQueue.shift();
            const agent = await runAgentTurn(agentId);
            if (agent && agent.state !== "completed_goal" && agent.state !== "error") {
                agentQueue.push(agentId); // Re-queue if not done
            }
            await new Promise(resolve => setTimeout(resolve, 1000)); // Delay for observability
            if(agentQueue.length === 0) break; // Exit if queue becomes empty during processing
        }

        isCycleRunning = false;
        if (outputElement) outputElement.innerHTML += "Agent cycle processing finished.\n";
        console.log("Agent cycle processing finished.");
    }

    function stopAgentCycle() { // Allow manual stopping
        isCycleRunning = false;
        if (cycleIntervalId) {
            clearTimeout(cycleIntervalId); // Ensure this is used if setTimeout based loop is reinstated
            cycleIntervalId = null;
        }
        // Update primary output mechanism if changed
        const primaryLogOutput = document.getElementById('agent-activity-log-monitor') || document.getElementById(cycleOutputElementId);
        if (primaryLogOutput) primaryLogOutput.innerHTML += "Agent cycle stopped by user.\n";
        else console.log("Agent cycle stopped by user. (No UI output element found)");

        // Reset progress for any active agents if needed
        Object.values(agents).forEach(agent => {
            if (agent.state === "active") {
                agent.setState("idle");
                agent.currentMicroTaskName = "Cycle stopped by user.";
            }
        });
    }


    return {
        registerAgent: (agentInstance) => {
            agents[agentInstance.id] = agentInstance;
            console.log(`Agent [${agentInstance.id}] registered with persona: ${agentInstance.persona}`);
        },
        setAgentGoal: (agentId, goal) => {
            const agent = agents[agentId];
            if (agent) {
                agent.setGoal(goal); // This also sets microTaskProgress = 0 and state to idle
                if (!agentQueue.includes(agentId) && (agent.state === "idle" || agent.state === "completed_goal" || agent.state === "error")) {
                    agentQueue.push(agentId);
                    console.log(`Agent [${agentId}] added to queue.`);
                } else if (agentQueue.includes(agentId)) {
                     console.log(`Agent [${agentId}] is already in the queue.`);
                } else { // Agent is active but goal is being updated
                    console.log(`Agent [${agentId}] is currently active, goal updated. It will continue its current turn and then address the new goal if re-queued.`);
                }
            } else {
                console.error(`Agent [${agentId}] not found. Cannot set goal.`);
            }
        },
        startAgentCycle,
        stopAgentCycle,
        getAgentById: (id) => agents[id],
        getAllAgents: () => Object.values(agents), // Return array of agent objects
        getAgentQueue: () => [...agentQueue],
        isOllamaBusy: () => ollamaIsCurrentlyBusy // Expose Ollama busy status
    };
})();
