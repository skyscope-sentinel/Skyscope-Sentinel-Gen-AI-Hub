// js/agent_monitoring_ui.js

let systemProcessDisplay;
let agentStatusList;
let activeAgentName;
let progressBarFill;
let progressBarPercentage;
let futuristicSquaresContainer;
let agentActivityLogMonitor; // For detailed logs from AgentManager

let agentManagerInstance = null; // Will be set by initAgentMonitoring
let monitoringIntervalId = null;

function initAgentMonitoring(manager) {
    agentManagerInstance = manager;

    // Main Monitoring Pane Elements
    systemProcessDisplay = document.getElementById('system-process-display');
    agentStatusList = document.getElementById('agent-status-list');
    activeAgentName = document.getElementById('active-agent-name');
    progressBarFill = document.getElementById('progress-bar-fill');
    progressBarPercentage = document.getElementById('progress-bar-percentage');
    futuristicSquaresContainer = document.getElementById('futuristic-squares-container');

    // Specific log area within the monitoring pane for AgentManager._displayAgentActivity
    // This element will be added to index.html later in this subtask.
    // For now, we ensure the JS is ready for it.
    agentActivityLogMonitor = document.getElementById('agent-activity-log-monitor');


    if (!systemProcessDisplay || !agentStatusList || !activeAgentName || !progressBarFill || !progressBarPercentage || !futuristicSquaresContainer) {
        console.error("One or more agent monitoring UI elements not found. Check IDs.");
        return;
    }

    // Initial UI update
    updateAgentMonitoringUI();

    // Set interval for continuous updates
    if (monitoringIntervalId) clearInterval(monitoringIntervalId); // Clear existing interval if any
    monitoringIntervalId = setInterval(updateAgentMonitoringUI, 2000); // Update every 2 seconds

    console.log("Agent Monitoring UI Initialized.");
}

function updateAgentMonitoringUI() {
    if (!agentManagerInstance) {
        // console.warn("AgentManager instance not available for UI update.");
        return;
    }

    // Update System Process Display (Partially Mocked)
    if (systemProcessDisplay) {
        const ollamaStatus = agentManagerInstance.isOllamaBusy ? (agentManagerInstance.isOllamaBusy() ? 'Busy' : 'Idle') : 'N/A';
        // In a real app, these would come from actual system stats or other module states
        const githubStatus = "Idle";
        const browserCtrlStatus = "Idle";
        const cpuUsage = Math.floor(Math.random() * (30 - 5 + 1)) + 5; // Random between 5-30%
        const memUsage = Math.floor(Math.random() * (45 - 20 + 1)) + 20; // Random between 20-45%
        const netSpeed = Math.floor(Math.random() * 100); // Random 0-99 KB/s

        const procP = systemProcessDisplay.querySelector('p:nth-child(1)');
        if(procP) procP.textContent = `PROC: [Ollama: ${ollamaStatus}] [GitHub: ${githubStatus}] [BrowserCtrl: ${browserCtrlStatus}]`;

        const sysP = systemProcessDisplay.querySelector('p:nth-child(2)');
        if(sysP) sysP.textContent = `SYS: [CPU: ${cpuUsage}%] [Mem: ${memUsage}%] [Net: ${netSpeed}KB/s]`;
    }

    // Update Agent Status List
    if (agentStatusList) {
        agentStatusList.innerHTML = ''; // Clear current list
        const agents = agentManagerInstance.getAllAgents ? agentManagerInstance.getAllAgents() : [];

        if (agents.length === 0) {
            agentStatusList.innerHTML = '<p style="padding: 3px; color: #888;">No agents registered or active.</p>';
        } else {
            agents.forEach(agent => {
                const agentDiv = document.createElement('div');
                agentDiv.className = 'agent-status-item'; // For potential specific styling
                // Truncate long persona/goal for display
                const shortPersona = agent.persona.length > 30 ? agent.persona.substring(0, 27) + "..." : agent.persona;
                const shortGoal = agent.currentGoal && agent.currentGoal.length > 40 ? agent.currentGoal.substring(0, 37) + "..." : (agent.currentGoal || 'N/A');

                agentDiv.innerHTML = `<strong>ID:</strong> ${agent.id} | <strong>State:</strong> ${agent.state} <br>
                                      <small><strong>Persona:</strong> ${shortPersona}</small><br>
                                      <small><strong>Goal:</strong> ${shortGoal}</small><br>
                                      <small><strong>Task:</strong> ${agent.currentMicroTaskName || "N/A"} (${agent.microTaskProgress || 0}%)</small>`;
                agentStatusList.appendChild(agentDiv);
            });
        }
    }

    // Update Active Agent Progress (first agent with state "active")
    let activeAgent = null;
    if (agentManagerInstance.getAllAgents) {
        const allAgents = agentManagerInstance.getAllAgents();
        activeAgent = allAgents.find(agent => agent.state === 'active');
        // If no "active" agent, try to find the first one in the queue to show its upcoming goal
        if (!activeAgent && agentManagerInstance.getAgentQueue && agentManagerInstance.getAgentQueue().length > 0) {
            const nextAgentId = agentManagerInstance.getAgentQueue()[0];
            activeAgent = agentManagerInstance.getAgentById ? agentManagerInstance.getAgentById(nextAgentId) : null;
        }
    }


    if (activeAgent && activeAgentName && progressBarFill && progressBarPercentage && futuristicSquaresContainer) {
        activeAgentName.innerHTML = `<strong>Agent:</strong> ${activeAgent.id} <small>(${activeAgent.persona.substring(0,20)}...)</small><br>
                                     <strong>Task:</strong> ${activeAgent.currentMicroTaskName || "No specific micro-task"}`;
        const progress = activeAgent.microTaskProgress || 0;
        progressBarFill.style.width = `${progress}%`;
        progressBarPercentage.textContent = `${progress}%`;

        const squares = futuristicSquaresContainer.getElementsByClassName('fsquare');
        const activeSquaresCount = Math.floor(progress / (100 / (squares.length > 0 ? squares.length : 9))); // Distribute progress over squares
        for (let i = 0; i < squares.length; i++) {
            if (i < activeSquaresCount) {
                squares[i].classList.add('active');
            } else {
                squares[i].classList.remove('active');
            }
        }
    } else if (activeAgentName) { // Handles case where no agent is active or in queue
        activeAgentName.innerHTML = "<strong>Agent:</strong> N/A <br><strong>Task:</strong> System Idle";
        if(progressBarFill) progressBarFill.style.width = '0%';
        if(progressBarPercentage) progressBarPercentage.textContent = '0%';
        if(futuristicSquaresContainer) {
            const squares = futuristicSquaresContainer.getElementsByClassName('fsquare');
            for (let i = 0; i < squares.length; i++) {
                squares[i].classList.remove('active');
            }
        }
    }
}

// Note: initAgentMonitoring needs to be called from the main script
// once AgentManager is instantiated.
// e.g., in index.html's main script:
// const agentManager = AgentManager;
// initAgentMonitoring(agentManager);
