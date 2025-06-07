// renderer/components/BrowserPaneComponent.js
import React, { useState, useRef, useEffect } from 'react';

const BrowserPaneComponent = () => {
  const defaultUrl = "https://duckduckgo.com"; // A site that often allows iframe embedding
  const [iframeSrc, setIframeSrc] = useState(defaultUrl);
  const [urlInputValue, setUrlInputValue] = useState(defaultUrl);
  const iframeRef = useRef(null);
  const urlInputRef = useRef(null); // For direct manipulation if needed by external calls

  const ensureProtocol = (urlStr) => {
    if (!urlStr.startsWith('http://') && !urlStr.startsWith('https://')) {
      return 'https://' + urlStr;
    }
    return urlStr;
  };

  const handleGo = () => {
    if (urlInputValue.trim()) {
      setIframeSrc(ensureProtocol(urlInputValue.trim()));
    }
  };

  const handleRefresh = () => {
    if (iframeRef.current) {
      iframeRef.current.src = iframeRef.current.src; // Simple way to trigger reload
    }
  };

  // Expose a function to load URL for CopilotKit action
  useEffect(() => {
    window.skyscopeBrowser = {
      loadUrl: (newUrl) => {
        const validatedUrl = ensureProtocol(newUrl);
        setUrlInputValue(validatedUrl);
        setIframeSrc(validatedUrl);
        console.log(`BrowserPane: iframe src set to ${validatedUrl}`);
      },
      getCurrentUrl: () => {
        try { // iframe.contentWindow.location.href can throw cross-origin errors
            return iframeRef.current?.contentWindow?.location?.href || iframeRef.current?.src || urlInputValue;
        } catch (e) {
            return iframeRef.current?.src || urlInputValue;
        }
      }
    };
    // Set initial URL for the input field
    if(urlInputRef.current) urlInputRef.current.value = defaultUrl;

    return () => { delete window.skyscopeBrowser; };
  }, [urlInputValue]); // Added urlInputValue to dependencies

  return (
    <div className="pane browser-pane" id="browser-pane">
      <h3>Browser</h3>
      <div className="pane-content" id="browser-content-area">
        <div className="browser-controls">
          <input
            ref={urlInputRef}
            type="text"
            id="browser-url-input"
            className="url-input-field"
            value={urlInputValue}
            onChange={(e) => setUrlInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleGo()}
            placeholder="https://example.com"
          />
          <button id="browser-go-button" className="control-button" onClick={handleGo}>Go</button>
          <button id="browser-refresh-button" className="control-button" onClick={handleRefresh}>Refresh</button>
        </div>
        <iframe
          ref={iframeRef}
          id="browser-iframe"
          className="iframe-view"
          src={iframeSrc}
          sandbox="allow-forms allow-modals allow-pointer-lock allow-popups allow-presentation allow-same-origin allow-scripts" // Common sandbox attributes
          onError={(e) => console.error("Iframe loading error:", e)}
        ></iframe>
        <div className="browser-automation-controls">
          <input
            type="text"
            id="browser-automation-prompt"
            className="url-input-field"
            placeholder="AI Automation: e.g., 'Summarize this page'"
          />
          <button
            id="browser-automate-button"
            className="control-button"
            onClick={() => {
              const task = document.getElementById('browser-automation-prompt').value;
              const currentFrameUrl = iframeRef.current ? iframeRef.current.src : 'about:blank';
              alert(`AI Task: "${task}" for URL: "${currentFrameUrl}". Backend processing for true automation is pending.`);
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
