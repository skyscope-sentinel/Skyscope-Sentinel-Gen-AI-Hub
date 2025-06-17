// renderer/components/BrowserPaneComponent.js
import React, { useState, useRef, useEffect } from 'react';

const BrowserPaneComponent = () => {
  const morphicDefaultUrl = "http://localhost:3002"; // Morphic running here
  const [iframeSrc, setIframeSrc] = useState(morphicDefaultUrl);
  const [urlInputValue, setUrlInputValue] = useState(morphicDefaultUrl);
  const iframeRef = useRef(null);
  const urlInputRef = useRef(null);

  const ensureProtocol = (urlStr) => {
    if (!urlStr.startsWith('http://') && !urlStr.startsWith('https://')) {
      return 'https://' + urlStr; // Default to https if protocol missing
    }
    return urlStr;
  };

  const handleGo = () => {
    if (urlInputValue.trim()) {
      const validatedUrl = ensureProtocol(urlInputValue.trim());
      setUrlInputValue(validatedUrl); // Update input field state
      setIframeSrc(validatedUrl);     // Update iframe src state
    }
  };

  const handleRefresh = () => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      try {
        iframeRef.current.contentWindow.location.reload();
      } catch (e) {
        console.warn("BrowserPane: Error trying to reload contentWindow.location, falling back to src reset. Error:", e);
        // Fallback for cross-origin or other issues
        iframeRef.current.src = iframeRef.current.src;
      }
    } else {
      console.warn("BrowserPane: Iframe or its contentWindow not available for refresh.");
    }
  };

  useEffect(() => {
    // Expose functions to global scope for CopilotKit actions
    window.skyscopeBrowser = {
      loadUrl: (newUrl) => {
        const validatedUrl = newUrl.startsWith('http://') || newUrl.startsWith('https://') ? newUrl : ensureProtocol(newUrl);
        // Update React state, which will then update the input field's value via its prop
        setUrlInputValue(validatedUrl);
        setIframeSrc(validatedUrl);
        console.log(`BrowserPane: iframe src set to ${validatedUrl} via window.skyscopeBrowser.loadUrl`);
      },
      getCurrentUrl: () => {
        if (!iframeRef.current) {
          console.warn("BrowserPane: getCurrentUrl called but iframeRef is not set. Returning input value as fallback.");
          return urlInputValue;
        }
        try {
            // Prefer contentWindow.location.href as it's more accurate after internal navigations.
            // Fallback to iframe.src if contentWindow is inaccessible (CORS) or location is about:blank.
            const contentLocation = iframeRef.current.contentWindow?.location?.href;
            if (contentLocation && contentLocation !== 'about:blank') {
                return contentLocation;
            }
            return iframeRef.current.src || urlInputValue; // Fallback to src, then input value
        } catch (e) {
            console.warn("BrowserPane: Error accessing iframe contentWindow.location.href due to CORS. Falling back to iframe.src. Error:", e);
            return iframeRef.current.src || urlInputValue; // Fallback
        }
      }
    };

    // Set initial value for the controlled input field
    if(urlInputRef.current && urlInputValue !== urlInputRef.current.value) {
         urlInputRef.current.value = urlInputValue; // Sync ref-managed input if needed, though value prop should handle it
    }

    // Iframe load listener to update URL input (best effort due to CORS)
    const iframeElement = iframeRef.current;
    const handleIframeLoad = () => {
        try {
            const currentSrc = iframeElement?.contentWindow?.location?.href;
            if (currentSrc && currentSrc !== 'about:blank' && currentSrc !== urlInputValue) {
                 setUrlInputValue(currentSrc); // Update React state, which updates the input field
            }
        } catch (e) {
            // console.warn("Cannot access iframe src after load due to cross-origin policy.");
        }
    };
    if (iframeElement) {
        iframeElement.addEventListener('load', handleIframeLoad);
    }

    return () => {
        delete window.skyscopeBrowser;
        if (iframeElement) {
            iframeElement.removeEventListener('load', handleIframeLoad);
        }
    };
  // Rerun this effect if urlInputValue changes internally (e.g. typed by user)
  // to ensure the input field ref is synced if necessary, though controlled components are preferred.
  // Primarily, this useEffect is for setting up and tearing down the global skyscopeBrowser object.
  // If loadUrl directly calls setUrlInputValue, that will trigger its own re-renders.
  }, [urlInputValue]);


  return (
    <div className="pane browser-pane" id="morphic-pane">
      <h3>Morphic AI Search Engine</h3>
      <div className="pane-content" id="browser-content-area">
        <div className="browser-controls">
          <input
            ref={urlInputRef} // Still useful for focusing or direct manipulation if ever needed
            type="text"
            id="browser-url-input"
            className="url-input-field"
            value={urlInputValue} // Controlled component
            onChange={(e) => setUrlInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleGo()}
            placeholder="Enter URL or use AI to navigate"
          />
          <button id="browser-go-button" className="control-button" onClick={handleGo}>Go</button>
          <button id="browser-refresh-button" className="control-button" onClick={handleRefresh}>Refresh</button>
        </div>
        <iframe
          ref={iframeRef}
          id="browser-iframe"
          className="iframe-view"
          src={iframeSrc} // Controlled by React state
          sandbox="allow-forms allow-modals allow-pointer-lock allow-popups allow-popups-to-escape-sandbox allow-presentation allow-same-origin allow-scripts"
          onError={(e) => console.error("Iframe loading error:", e.nativeEvent)}
          // onLoad event is now handled in useEffect for iframeElement
        ></iframe>
        <div className="browser-automation-controls">
          <input
            type="text"
            id="browser-automation-prompt"
            className="url-input-field"
            placeholder="AI Automation: e.g., 'Search Morphic for AI trends'"
          />
          <button
            id="browser-automate-button"
            className="control-button"
            onClick={() => {
              const taskInput = document.getElementById('browser-automation-prompt');
              const task = taskInput ? taskInput.value : '';
              const currentFrameUrl = iframeRef.current ? iframeRef.current.src : 'about:blank';
              alert(`AI Task: "${task}" for URL: "${currentFrameUrl}". This could trigger a Morphic search via CopilotKit action.`);
            }}
          >
            Run AI Task
          </button>
        </div>
      </div>
    </div>
  );
};
export default BrowserPaneComponent;
