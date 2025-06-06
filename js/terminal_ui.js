// js/terminal_ui.js

let terminalOutput;
let terminalInput;

function appendLineToTerminal(text, type = 'output') {
    if (!terminalOutput) return;

    const p = document.createElement('p');
    p.textContent = text;

    switch (type) {
        case 'command':
            p.className = 'terminal-command-line';
            break;
        case 'error':
            p.className = 'terminal-error-line';
            break;
        case 'output':
        default:
            p.className = 'terminal-output-line';
            break;
    }

    terminalOutput.appendChild(p);
    terminalOutput.scrollTop = terminalOutput.scrollHeight; // Auto-scroll
}

function processTerminalCommand(commandString) {
    appendLineToTerminal(`> ${commandString}`, 'command');

    const parts = commandString.toLowerCase().split(' ');
    const command = parts[0];

    switch (command) {
        case 'help':
            appendLineToTerminal("Mock Commands: help, date, echo [text], clear", 'output');
            break;
        case 'date':
            appendLineToTerminal(new Date().toLocaleString(), 'output');
            break;
        case 'echo':
            const echoText = commandString.substring(commandString.indexOf(' ') + 1);
            appendLineToTerminal(echoText || '', 'output'); // Echo empty string if no args
            break;
        case 'clear':
            if (terminalOutput) {
                terminalOutput.innerHTML = '';
                // Optionally, add a small header after clearing
                appendLineToTerminal("SKYSCOPE AI Terminal Cleared.", 'output');
                 appendLineToTerminal("Type 'help' for a list of mock commands.", 'output');
            }
            break;
        default:
            appendLineToTerminal(`Command not recognized by mock terminal: ${commandString}`, 'error');
            break;
    }
}

function initTerminal() {
    terminalOutput = document.getElementById('terminal-output');
    terminalInput = document.getElementById('terminal-input');

    if (!terminalInput) {
        console.error("Terminal input field not found!");
        return;
    }
    if (!terminalOutput) {
        console.error("Terminal output display area not found!");
        // Attempt to continue if input is found, but some functionality might be broken.
    }


    terminalInput.addEventListener('keydown', function(event) {
        if (event.key === 'Enter') {
            event.preventDefault(); // Prevent default form submission or other 'Enter' behaviors
            const command = terminalInput.value.trim();
            if (command) {
                processTerminalCommand(command);
            }
            terminalInput.value = ''; // Clear the input field
        }
    });

    // Optional: Focus the input field when the terminal pane is clicked,
    // or if it's the primary interaction element.
    const terminalPane = document.getElementById('terminal-content-area');
    if (terminalPane) {
        terminalPane.addEventListener('click', () => {
            terminalInput.focus();
        });
    }

    // Initial focus if autofocus attribute isn't enough or for dynamic scenarios
    // terminalInput.focus(); // autofocus attribute on input should handle this
}

// Call initTerminal once the DOM is ready
document.addEventListener('DOMContentLoaded', initTerminal);
