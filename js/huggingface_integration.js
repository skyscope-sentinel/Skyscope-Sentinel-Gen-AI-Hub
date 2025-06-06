// js/huggingface_integration.js

/**
 * Helper function to make requests to the Hugging Face API.
 * @param {string} endpoint - The API endpoint (e.g., 'models').
 * @param {string|null} apiToken - The Hugging Face API Token (optional).
 * @param {object} options - Optional fetch options (method, body, etc.).
 * @returns {Promise<object>} - The JSON response from the API.
 */
async function fetchHuggingFaceAPI(endpoint, apiToken = null, options = {}) {
    const baseUrl = 'https://huggingface.co/api/';
    // Ensure endpoint doesn't start with a slash if baseUrl ends with one, or vice-versa
    const fullUrl = `${baseUrl.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`;

    const headers = {
        'Accept': 'application/json', // Common for APIs, though HF might not strictly require for all endpoints
        ...options.headers,
    };

    if (apiToken) {
        headers['Authorization'] = `Bearer ${apiToken}`;
    }

    const fetchOptions = {
        ...options,
        headers: headers,
    };

    const response = await fetch(fullUrl, fetchOptions);

    if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        let errorJson;
        try {
            errorJson = JSON.parse(errorText);
        } catch (e) {
            // not a json error
        }
        const errorMessage = errorJson && errorJson.error ? errorJson.error : errorText;
        throw new Error(`Hugging Face API Error: ${response.status} - ${errorMessage}`);
    }

    // Handle cases where response might be empty (e.g., 204 No Content)
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.indexOf("application/json") !== -1) {
        return await response.json();
    } else {
        return await response.text(); // Or handle as appropriate for non-JSON responses
    }
}

/**
 * Lists models from Hugging Face Hub.
 * @param {string|null} apiToken - HF API Token.
 * @param {string} outputElementId - ID of the HTML element to display results.
 * @param {string|null} searchQuery - Optional search query for models.
 * @param {number} limit - Number of models to list.
 */
async function listModelsHuggingFace(apiToken, outputElementId, searchQuery = null, limit = 10) {
    const outputElement = document.getElementById(outputElementId);
    if (!outputElement) {
        console.error(`Output element with ID "${outputElementId}" not found.`);
        return;
    }
    outputElement.innerText = "Loading Hugging Face models...";

    let endpoint = `models?limit=${limit}`;
    if (searchQuery) {
        endpoint += `&search=${encodeURIComponent(searchQuery)}`;
    }

    try {
        const models = await fetchHuggingFaceAPI(endpoint, apiToken);
        if (models && Array.isArray(models) && models.length > 0) {
            const modelIds = models.map(model => `- ${model.modelId} (${model.pipeline_tag || 'N/A'}, ${model.likes || 0} likes)`).join('\n');
            outputElement.innerText = `Hugging Face Models:\n${modelIds}`;
        } else if (models && Array.isArray(models)) {
            outputElement.innerText = "No models found matching your criteria.";
        } else {
             outputElement.innerText = "Could not fetch models or unexpected response format.";
        }
        console.log("Hugging Face Models List:", models);
    } catch (error) {
        console.error("Error listing Hugging Face models:", error);
        outputElement.innerText = `Error: ${error.message}`;
    }
}

/**
 * Gets detailed information for a specific Hugging Face model.
 * @param {string} modelId - The ID of the model (e.g., "bert-base-uncased").
 * @param {string|null} apiToken - HF API Token.
 * @param {string} outputElementId - ID of the HTML element to display results.
 */
async function getModelInfoHuggingFace(modelId, apiToken, outputElementId) {
    const outputElement = document.getElementById(outputElementId);
    if (!outputElement) {
        console.error(`Output element with ID "${outputElementId}" not found.`);
        return;
    }
    if (!modelId || modelId.trim() === "") {
        outputElement.innerText = "Model ID is required.";
        return;
    }
    outputElement.innerText = `Loading info for model "${modelId}"...`;

    const endpoint = `models/${encodeURIComponent(modelId)}`;

    try {
        const modelInfo = await fetchHuggingFaceAPI(endpoint, apiToken);
        if (modelInfo) {
            // For now, just stringify. Could be formatted nicely later.
            outputElement.innerText = `Model Info for ${modelId}:\n${JSON.stringify(modelInfo, null, 2)}`;
        } else {
            outputElement.innerText = "Could not retrieve model information or model not found.";
        }
        console.log(`Hugging Face Model Info for ${modelId}:`, modelInfo);
    } catch (error) {
        console.error(`Error getting model info for ${modelId}:`, error);
        outputElement.innerText = `Error: ${error.message}`;
    }
}
