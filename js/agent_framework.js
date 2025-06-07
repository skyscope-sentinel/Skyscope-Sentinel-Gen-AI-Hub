// js/agent_framework.js

class Agent {
    constructor(id, persona, initialMemory = []) {
        this.id = id;
        this.persona = persona;
        this.memory = [...initialMemory]; // Array of strings (prompt/response pairs, goals)
        this.currentGoal = "";
        this.state = "idle"; // "idle", "active", "completed_goal", "error"
        this.microTaskProgress = 0;
        this.currentMicroTaskName = "Awaiting goal...";
    }

    setGoal(goal) {
        this.currentGoal = goal;
        this.memory.push(`New Goal: ${goal}`);
        this.state = "idle"; // Ready to be picked up
        this.microTaskProgress = 0;
        this.currentMicroTaskName = "Goal received, pending activation.";
        console.log(`Agent [${this.id}] goal set: ${goal}`);
    }

    getContextPrompt() {
        let context = `Persona: ${this.persona}\n\n`;
        context += "Memory (Recent Interactions):\n";
        // Append last few (e.g., 10) memory entries to context.
        const recentMemory = this.memory.slice(-10); // Get last 10 items
        recentMemory.forEach(mem => {
            context += `- ${mem}\n`;
        });
        context += `\nCurrent Goal: ${this.currentGoal}\n\n`;
        context += "Based on your persona, memory, and current goal, provide your response or next action. If you believe the goal is complete, start your response with the exact phrase 'Goal Complete: '. Otherwise, continue to work towards the goal.";
        return context;
    }

    addInteractionToMemory(prompt, response) {
        // We might not want to store the full context prompt every time, just user/agent style interaction.
        // For now, storing the full prompt is okay for debugging.
        // this.memory.push(`Prompt (Context Sent): ${prompt}`);
        this.memory.push(`Response: ${response}`);
    }

    setState(newState) {
        this.state = newState;
        console.log(`Agent [${this.id}] state changed to: ${newState}`);
    }
}

const AgentManager = (function() {
    let agents = {}; // Store agents by ID
    let agentQueue = []; // Array of agent IDs
    let isCycleRunning = false;
    let ollamaModelForCycle = "llama3"; // Default model
    let cycleOutputElementId = ""; // This might be deprecated for the new monitoring pane
    let cycleIntervalId = null; // For managing the loop with delays
    let ollamaIsCurrentlyBusy = false; // New flag for Ollama status

    function _displayAgentActivity(agent, message) {
        // This function's primary output might shift to the new monitoring pane.
        // For now, it will still log to console and potentially the old output element if set.
        const activityLogTarget = document.getElementById('agent-activity-log-monitor'); // New specific log area in monitor pane
        if (activityLogTarget) {
             const timestamp = new Date().toLocaleTimeString();
             activityLogTarget.innerHTML += `${timestamp} - Agent [${agent.id}]: ${message}\n`;
             activityLogTarget.scrollTop = activityLogTarget.scrollHeight;
        } else if (cycleOutputElementId) { // Fallback to old system if new one not ready
            const outputElement = document.getElementById(cycleOutputElementId);
            if (outputElement) {
                const timestamp = new Date().toLocaleTimeString();
                outputElement.innerHTML += `${timestamp} - Agent [${agent.id}]: ${message}\n`;
                outputElement.scrollTop = outputElement.scrollHeight;
            }
        }
        console.log(`Agent [${agent.id}]: ${message}`);
    }

    async function runAgentTurn(agentId) {
        if (!agents[agentId]) {
            console.error(`Agent ${agentId} not found in runAgentTurn.`);
            return null;
        }
        const agent = agents[agentId];

        if(agent.state === "completed_goal") {
            _displayAgentActivity(agent, `Already completed goal: ${agent.currentGoal}`);
            agent.microTaskProgress = 100;
            agent.currentMicroTaskName = "Goal previously completed.";
            return agent;
        }

        agent.setState("active");
        agent.microTaskProgress = 10; // Initial progress for starting a turn
        agent.currentMicroTaskName = "Generating context prompt...";
        _displayAgentActivity(agent, `Thinking... Goal: ${agent.currentGoal}`);

        const prompt = agent.getContextPrompt();
        agent.currentMicroTaskName = `Querying LLM (${ollamaModelForCycle})...`;
        agent.microTaskProgress = 30;

        try {
            ollamaIsCurrentlyBusy = true;
            const ollamaResponse = await fetch('http://localhost:11434/api/generate', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ model: ollamaModelForCycle, prompt: prompt, stream: false })
            });
            ollamaIsCurrentlyBusy = false;
            agent.microTaskProgress = 70; // Response received

            if (!ollamaResponse.ok) {
                const errorText = await ollamaResponse.text();
                throw new Error(`Ollama API Error: ${ollamaResponse.status} - ${errorText}`);
            }

            const responseData = await ollamaResponse.json();
            const actualResponse = responseData.response.trim();
            agent.currentMicroTaskName = "Processing LLM response...";

            agent.addInteractionToMemory(`Goal: ${agent.currentGoal}`, actualResponse);
            _displayAgentActivity(agent, `Response: ${actualResponse}`);

            if (actualResponse.startsWith("Goal Complete:")) {
                agent.setState("completed_goal");
                agent.microTaskProgress = 100;
                agent.currentMicroTaskName = "Goal requirements met.";
                _displayAgentActivity(agent, `Goal marked as complete.`);
            } else {
                agent.setState("idle"); // Ready for another turn if needed
                agent.microTaskProgress = 100; // Turn complete, but goal not.
                agent.currentMicroTaskName = "Awaiting next cycle for continuation.";
            }
        } catch (error) {
            ollamaIsCurrentlyBusy = false;
            console.error(`Error in runAgentTurn for ${agentId}:`, error);
            _displayAgentActivity(agent, `Error: ${error.message}`);
            agent.setState("error");
            agent.microTaskProgress = 0; // Or some error indication
            agent.currentMicroTaskName = `Error occurred: ${error.message.substring(0,30)}...`;
        }
        return agent;
    }

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
