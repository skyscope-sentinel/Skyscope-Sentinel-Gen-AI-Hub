// js/github_integration.js

/**
 * Helper function to make requests to the GitHub API.
 * @param {string} endpoint - The API endpoint (e.g., 'user/repos').
 * @param {string} token - The GitHub Personal Access Token (PAT).
 * @param {object} options - Optional fetch options (method, body, etc.).
 * @returns {Promise<object>} - The JSON response from the API.
 */
async function fetchGitHubAPI(endpoint, token, options = {}) {
    const url = `https://api.github.com/${endpoint}`;
    const headers = {
        'Accept': 'application/vnd.github.v3+json',
        ...options.headers, // Allow overriding or adding headers
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const fetchOptions = {
        ...options,
        headers: headers,
    };

    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(`GitHub API Error: ${response.status} ${errorData.message || response.statusText}`);
    }

    return await response.json();
}

/**
 * Fetches the authenticated user's repositories.
 * @param {string} token - GitHub PAT.
 * @param {string} outputElementId - ID of the HTML element to display results.
 */
async function fetchUserRepositories(token, outputElementId) {
    const outputElement = document.getElementById(outputElementId);
    if (!outputElement) {
        console.error(`Output element with ID "${outputElementId}" not found.`);
        return;
    }
    outputElement.innerText = "Loading repositories...";

    try {
        const repos = await fetchGitHubAPI('user/repos', token);
        if (repos && repos.length > 0) {
            const repoNames = repos.map(repo => repo.name).join('\n');
            outputElement.innerText = `Repositories:\n${repoNames}`;
        } else if (repos) {
            outputElement.innerText = "No repositories found for this user.";
        } else {
            outputElement.innerText = "Could not fetch repositories or unexpected response.";
        }
        console.log("User Repositories:", repos);
    } catch (error) {
        console.error("Error fetching user repositories:", error);
        outputElement.innerText = `Error: ${error.message}`;
    }
}

/**
 * Fetches the content of a file from a GitHub repository.
 * @param {string} token - GitHub PAT (can be null for public repos, but rate limits are stricter).
 * @param {string} owner - The owner of the repository.
 * @param {string} repo - The name of the repository.
 * @param {string} path - The path to the file in the repository.
 * @param {string} outputElementId - ID of the HTML element to display results.
 */
async function fetchRepoFileContent(token, owner, repo, path, outputElementId) {
    const outputElement = document.getElementById(outputElementId);
    if (!outputElement) {
        console.error(`Output element with ID "${outputElementId}" not found.`);
        return;
    }
    outputElement.innerText = `Loading file content from ${owner}/${repo}/${path}...`;

    try {
        const data = await fetchGitHubAPI(`repos/${owner}/${repo}/contents/${path}`, token);
        if (data && data.content && data.encoding === 'base64') {
            // Basic error handling for atob, though robust decoders are better for binary or complex UTF-8
            let decodedContent;
            try {
                decodedContent = atob(data.content);
            } catch (e) {
                console.error("Error decoding base64 content:", e);
                outputElement.innerText = "Error decoding file content. It might not be plain text.";
                return;
            }
            outputElement.innerText = `File Content of ${data.name}:\n\n${decodedContent}`;
        } else if (data && data.message) { // E.g. "Not Found"
             outputElement.innerText = `Error: ${data.message}`;
        }
        else {
            outputElement.innerText = "Could not retrieve file content or content is not base64 encoded as expected.";
        }
        console.log(`File Content Data for ${path}:`, data);
    } catch (error) {
        console.error("Error fetching repo file content:", error);
        outputElement.innerText = `Error: ${error.message}`;
    }
}
