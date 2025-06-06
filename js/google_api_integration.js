// js/google_api_integration.js

/**
 * Searches using Google Custom Search API.
 * @param {string} apiKey - Your Google API Key.
 * @param {string} cxId - Your Google Custom Search Engine ID (CX ID).
 * @param {string} query - The search query.
 * @param {string} outputElementId - The ID of the HTML element to display results.
 */
async function searchGoogle(apiKey, cxId, query, outputElementId) {
    const outputElement = document.getElementById(outputElementId);
    if (!outputElement) {
        console.error(`Output element with ID "${outputElementId}" not found.`);
        return;
    }
    outputElement.innerHTML = "Searching with Google..."; // Use innerHTML for potential HTML content

    if (!apiKey || !cxId || !query) {
        outputElement.innerHTML = "API Key, CX ID, and Search Query are required.";
        return;
    }

    const apiUrl = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cxId}&q=${encodeURIComponent(query)}`;

    try {
        const response = await fetch(apiUrl);

        if (!response.ok) {
            const errorText = await response.text();
            outputElement.innerHTML = `Error: ${response.status} ${response.statusText}<br><pre>${errorText}</pre>`;
            console.error('Google Custom Search API Error:', response.status, response.statusText, errorText);
            return;
        }

        const data = await response.json();
        console.log("Full Google Custom Search response:", data);

        if (data.error) {
            outputElement.innerHTML = `API Error: ${data.error.message}`;
            return;
        }

        if (data.items && data.items.length > 0) {
            let resultsHtml = "<h4>Search Results:</h4><ul>";
            data.items.forEach(item => {
                resultsHtml += `
                    <li style="margin-bottom: 1rem;">
                        <strong><a href="${item.link}" target="_blank">${item.htmlTitle || item.title}</a></strong><br>
                        <small style="color: #00cc00;">${item.link}</small><br>
                        <p style="font-size: 0.9rem; margin-top: 0.25rem;">${item.htmlSnippet || item.snippet}</p>
                    </li>`;
            });
            resultsHtml += "</ul>";
            outputElement.innerHTML = resultsHtml;
        } else {
            outputElement.innerHTML = "No results found.";
        }

    } catch (error) {
        console.error("Network or other error during Google Custom Search:", error);
        outputElement.innerHTML = "Network error or issue with the request. Check console for details.";
    }
}
