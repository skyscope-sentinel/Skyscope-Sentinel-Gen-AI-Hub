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
      setIframeSrc(ensureProtocol(urlInputValue.trim()));
    }
  };

  const handleRefresh = () => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      try {
        iframeRef.current.contentWindow.location.reload();
      } catch (e) {
        // Fallback for cross-origin or other issues
        iframeRef.current.src = iframeRef.current.src;
        console.warn("Could not directly reload iframe, attempting src reset. Error:", e);
      }
    }
  };

  useEffect(() => {
    window.skyscopeBrowser = { // Keep this name generic if pane can show other sites
      loadUrl: (newUrl) => {
        const validatedUrl = newUrl.startsWith('http') ? newUrl : ensureProtocol(newUrl);
        setUrlInputValue(validatedUrl);
        setIframeSrc(validatedUrl);
        console.log(`BrowserPane (Morphic): iframe src set to ${validatedUrl}`);
      },
      getCurrentUrl: () => {
        try {
            return iframeRef.current?.contentWindow?.location?.href || iframeRef.current?.src || urlInputValue;
        } catch (e) {
            return iframeRef.current?.src || urlInputValue; // Fallback
        }
      }
    };
    if(urlInputRef.current) urlInputRef.current.value = morphicDefaultUrl;

    // Iframe load listener to update URL input (best effort due to CORS)
    const iframe = iframeRef.current;
    const handleIframeLoad = () => {
        try {
            const currentSrc = iframe?.contentWindow?.location?.href;
            if (currentSrc && currentSrc !== 'about:blank' && currentSrc !== urlInputValue) {
                 setUrlInputValue(currentSrc);
            }
        } catch (e) {
            // console.warn("Cannot access iframe src after load due to cross-origin policy.");
        }
    };
    if (iframe) {
        iframe.addEventListener('load', handleIframeLoad);
    }

    return () => {
        delete window.skyscopeBrowser;
        if (iframe) {
            iframe.removeEventListener('load', handleIframeLoad);
        }
    };
  }, [urlInputValue]); // Ensure this updates if urlInputValue changes programmatically outside of direct input

  return (
    <div className="pane browser-pane" id="morphic-pane"> {/* Changed ID for clarity if needed */}
      <h3>Morphic AI Search Engine</h3> {/* Updated title */}
      <div className="pane-content" id="browser-content-area"> {/* Re-evaluate if ID needs to be more generic or specific */}
        <div className="browser-controls">
          <input
            ref={urlInputRef}
            type="text"
            id="browser-url-input"
            className="url-input-field"
            value={urlInputValue}
            onChange={(e) => setUrlInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleGo()}
            placeholder="Enter URL or use AI to navigate"
          />
          <button id="browser-go-button" className="control-button" onClick={handleGo}>Go</button>
          <button id="browser-refresh-button" className="control-button" onClick={handleRefresh}>Refresh</button>
        </div>
        <iframe
          ref={iframeRef}
          id="browser-iframe" // Keep ID generic if it can load other sites
          className="iframe-view"
          src={iframeSrc}
          // Recommended sandbox attributes for security and functionality:
          sandbox="allow-forms allow-modals allow-pointer-lock allow-popups allow-popups-to-escape-sandbox allow-presentation allow-same-origin allow-scripts"
          // allow="microphone; camera; geolocation; display-capture;" // If Morphic needs these
          onError={(e) => console.error("Iframe loading error:", e.nativeEvent)}
          onLoad={() => console.log(`Iframe loaded: ${iframeRef.current?.src}`)}
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
              const task = document.getElementById('browser-automation-prompt').value;
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
