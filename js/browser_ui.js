// js/browser_ui.js

let browserUrlInput;
let browserGoButton;
let browserRefreshButton;
let browserIframe;
let browserAutomationPrompt;
let browserAutomateButton;

function loadUrlInIframe(url) {
    if (!browserIframe) return;
    let validatedUrl = url.trim();

    if (!validatedUrl) {
        // Optionally, provide feedback to the user that URL is empty
        // For now, just load about:blank or do nothing
        browserIframe.src = 'about:blank';
        return;
    }

    if (!validatedUrl.startsWith('http://') && !validatedUrl.startsWith('https://')) {
        validatedUrl = 'https://' + validatedUrl;
    }
    browserIframe.src = validatedUrl;
    // Update the input field to show the validated URL
    if(browserUrlInput) browserUrlInput.value = validatedUrl;
}

function initBrowserPane() {
    browserUrlInput = document.getElementById('browser-url-input');
    browserGoButton = document.getElementById('browser-go-button');
    browserRefreshButton = document.getElementById('browser-refresh-button');
    browserIframe = document.getElementById('browser-iframe');
    browserAutomationPrompt = document.getElementById('browser-automation-prompt');
    browserAutomateButton = document.getElementById('browser-automate-button');

    if (!browserUrlInput || !browserGoButton || !browserRefreshButton || !browserIframe || !browserAutomationPrompt || !browserAutomateButton) {
        console.error("One or more browser pane elements not found. Check IDs.");
        return;
    }

    // Initial page for the iframe, can be set here or in HTML
    // browserIframe.src = 'about:blank'; // Or a default start page

    const handleLoadUrl = () => {
        if (browserUrlInput) {
            loadUrlInIframe(browserUrlInput.value);
        }
    };

    browserGoButton.addEventListener('click', handleLoadUrl);

    browserUrlInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault(); // Prevent form submission if it's part of a form
            handleLoadUrl();
        }
    });

    browserRefreshButton.addEventListener('click', () => {
        if (browserIframe && browserIframe.contentWindow) {
            try {
                // Check if the iframe's location is not 'about:blank' before trying to reload,
                // as reloading 'about:blank' might not be meaningful or could cause issues.
                if (browserIframe.contentWindow.location.href !== 'about:blank') {
                    browserIframe.contentWindow.location.reload();
                }
            } catch (e) {
                // This can happen due to cross-origin restrictions if the iframe content
                // is from a different domain and you try to access/manipulate its location directly.
                // For a simple reload, setting src to itself is a common workaround if direct access fails.
                console.warn("Could not directly reload iframe, attempting src reset. Error:", e);
                browserIframe.src = browserIframe.src;
            }
        }
    });

    browserAutomateButton.addEventListener('click', () => {
        const task = browserAutomationPrompt.value.trim();
        if (task) {
            const currentUrl = browserIframe.src;
            // In a real scenario, this would call a backend or another JS module
            alert(`Mock AI Task Triggered:\nTask: "${task}"\nURL: "${currentUrl}"\n\n(Backend processing for this is pending actual implementation)`);
            console.log(`AI Task: "${task}" for URL: "${currentUrl}". Backend processing pending.`);
            browserAutomationPrompt.value = ''; // Clear the prompt
        } else {
            alert("Please enter an automation task.");
        }
    });

    // Update URL input when iframe navigates (e.g. user clicks links inside iframe)
    // This is subject to same-origin policy. If the iframe navigates to a different
    // origin, we won't be able to access its contentWindow.location.href.
    if (browserIframe) {
        browserIframe.addEventListener('load', () => {
            try {
                const currentSrc = browserIframe.contentWindow.location.href;
                // Only update if it's not about:blank and we have access
                if (currentSrc && currentSrc !== 'about:blank' && browserUrlInput) {
                     browserUrlInput.value = currentSrc;
                }
            } catch (e) {
                console.warn("Cannot access iframe src due to cross-origin policy. URL bar will not auto-update for this navigation.", e);
                // Can't update URL bar if cross-origin
            }
        });
    }
}

// Call initBrowserPane once the DOM is ready
document.addEventListener('DOMContentLoaded', initBrowserPane);
