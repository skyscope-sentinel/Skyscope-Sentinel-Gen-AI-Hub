// js/ollama_integration.js

/**
 * Queries the Ollama API with a given model and prompt.
 *
 * @param {string} modelName The name of the Ollama model to use (e.g., "llama3").
 * @param {string} promptText The prompt to send to the model.
 * @param {string} outputElementId The ID of the HTML element to display the response in.
 *
 * Note:
 * - Ollama must be running and accessible at http://localhost:11434.
 * - The specified model (modelName) must be available in the Ollama instance.
 * - If running index.html directly from the filesystem (file:// protocol),
 *   you might encounter CORS issues. It's recommended to serve index.html
 *   via a local web server.
 */
async function queryOllamaModel(modelName, promptText, outputElementId) {
    const outputElement = document.getElementById(outputElementId);

    if (!outputElement) {
        console.error(`Output element with ID "${outputElementId}" not found.`);
        return;
    }

    outputElement.innerText = "Loading...";

    try {
        const response = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: modelName,
                prompt: promptText,
                stream: false // For this basic integration, non-streaming is simpler
            }),
        });

        if (!response.ok) {
            const errorBody = await response.text(); // Try to get more details from the response body
            outputElement.innerText = `Error: ${response.status} ${response.statusText}\n${errorBody}`;
            console.error('Ollama API Error:', response.status, response.statusText, errorBody);
            return;
        }

        const data = await response.json();

        if (data && data.response) {
            outputElement.innerText = data.response;
        } else if (data && data.error) {
            outputElement.innerText = `Ollama Error: ${data.error}`;
        }
        else {
            outputElement.innerText = "Received an unexpected response structure from Ollama.";
        }
        console.log("Full Ollama response:", data);

    } catch (error) {
        console.error("Network or other error connecting to Ollama:", error);
        outputElement.innerText = "Network error connecting to Ollama. Ensure Ollama is running and accessible. Check console for details (CORS issues if running from file://).";
    }
}
