// renderer/components/BrowserPaneComponent.js
import React, { useState, useRef, useEffect, useCallback } from 'react';

const BrowserPaneComponent = ({ onBrowserUrlChange }) => {
  const morphicHomeUrl = "http://localhost:3002";
  const [iframeSrc, setIframeSrc] = useState(morphicHomeUrl);
  const [urlInputValue, setUrlInputValue] = useState(morphicHomeUrl);
  const iframeRef = useRef(null);
  const urlInputRef = useRef(null); // To allow focusing the input field

  const ensureProtocol = useCallback((urlStr) => {
    // Do not add protocol to about:blank
    if (urlStr && urlStr.toLowerCase() === 'about:blank') {
        return urlStr;
    }
    if (urlStr && !urlStr.startsWith('http://') && !urlStr.startsWith('https://')) {
      return 'https://' + urlStr;
    }
    return urlStr;
  }, []);

  const handleGo = useCallback(() => {
    if (urlInputValue.trim()) {
      const newUrl = ensureProtocol(urlInputValue.trim());
      setUrlInputValue(newUrl); // Update state for input field
      setIframeSrc(newUrl);     // Update iframe src
      if (onBrowserUrlChange) onBrowserUrlChange(newUrl);
    }
  }, [urlInputValue, ensureProtocol, onBrowserUrlChange]);

  const handleRefresh = useCallback(() => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      try {
        iframeRef.current.contentWindow.location.reload();
        // The 'load' event on the iframe will call onBrowserUrlChange
      } catch (e) {
        console.warn("BrowserPane: Error trying to reload contentWindow.location, attempting src reset. Error:", e);
        iframeRef.current.src = iframeRef.current.src; // Fallback src reset
        if (onBrowserUrlChange) onBrowserUrlChange(iframeRef.current.src); // Manually trigger if reload fails this way
      }
    } else {
      console.warn("BrowserPane: Iframe or its contentWindow not available for refresh.");
    }
  }, [onBrowserUrlChange]);

  const loadMorphicHome = useCallback(() => {
    setUrlInputValue(morphicHomeUrl);
    setIframeSrc(morphicHomeUrl);
    if (onBrowserUrlChange) onBrowserUrlChange(morphicHomeUrl);
  }, [morphicHomeUrl, onBrowserUrlChange]);

  useEffect(() => {
    window.skyscopeBrowser = {
      loadUrl: (newUrl) => {
        const validatedUrl = (newUrl && (newUrl.startsWith('http://') || newUrl.startsWith('https://') || newUrl.startsWith('about:')))
                             ? newUrl
                             : ensureProtocol(newUrl);
        setUrlInputValue(validatedUrl);
        setIframeSrc(validatedUrl);
        if (onBrowserUrlChange) onBrowserUrlChange(validatedUrl);
        console.log(`BrowserPane (Morphic): iframe src set to ${validatedUrl}`);
      },
      getCurrentUrl: () => {
        if (!iframeRef.current) {
          return urlInputValue;
        }
        try {
            const contentLocation = iframeRef.current.contentWindow?.location?.href;
            if (contentLocation && contentLocation !== 'about:blank') {
                return contentLocation;
            }
            return iframeRef.current.src || urlInputValue;
        } catch (e) {
            return iframeRef.current.src || urlInputValue;
        }
      }
    };

    // Set initial URL for the input field when component mounts or iframeSrc changes from outside
    if(urlInputRef.current && iframeSrc !== urlInputRef.current.value) {
        // This direct manipulation is okay for initialization or external changes via window object
        // but day-to-day typing is handled by controlled component pattern.
        // urlInputRef.current.value = iframeSrc; // No longer needed due to value={urlInputValue}
    }
    // Call onBrowserUrlChange on initial mount with the default URL
    if (onBrowserUrlChange) {
        onBrowserUrlChange(iframeSrc);
    }

    const currentIframe = iframeRef.current;
    const handleIframeLoad = () => {
        try {
            const newLocation = currentIframe?.contentWindow?.location?.href;
            if (newLocation && newLocation !== 'about:blank') {
                // Only update if the new location is different from what's already in the input
                // to avoid potential loops or unnecessary state updates.
                if (newLocation !== urlInputValue) {
                    setUrlInputValue(newLocation);
                }
                if (onBrowserUrlChange) onBrowserUrlChange(newLocation);
            }
            // If it's about:blank, we don't want to push that to the URL bar unless it was explicitly set
        } catch (e) {
            // Cross-origin issues might prevent accessing contentWindow.location.href
            // In such cases, we rely on the last known iframeSrc or urlInputValue.
            // The onBrowserUrlChange would have been called when iframeSrc was set.
            console.warn("BrowserPane: Could not access iframe's new location after load (likely cross-origin). URL bar may not reflect internal navigation.");
        }
    };
    if (currentIframe) {
        currentIframe.addEventListener('load', handleIframeLoad);
    }

    return () => {
        delete window.skyscopeBrowser;
        if (currentIframe) {
            currentIframe.removeEventListener('load', handleIframeLoad);
        }
    };
  // ensureProtocol is memoized with useCallback, onBrowserUrlChange should be too
  }, [iframeSrc, onBrowserUrlChange, ensureProtocol, urlInputValue]);

  // Sync urlInputValue to iframeSrc if they diverge and user stops typing
  // This is a bit complex; usually, "Go" button is the explicit trigger.
  // For now, handleGo and direct AI navigation handle this.

  return (
    <div className="pane browser-pane" id="morphic-pane">
      <h3><span className="pane-title-icon">🌐</span> Morphic AI Search / Browser</h3>
      <div className="pane-content" id="browser-content-area">
        <div className="browser-controls">
          <button id="morphic-home-button" className="control-button morphic-home-btn" title="Load Morphic Home" onClick={loadMorphicHome}>Home</button>
          <input
            ref={urlInputRef}
            type="text"
            id="browser-url-input"
            className="url-input-field"
            value={urlInputValue}
            onChange={(e) => setUrlInputValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleGo(); }}
            placeholder="Enter URL or use AI to navigate"
          />
          <button id="browser-go-button" className="control-button" onClick={handleGo}>Go</button>
          <button id="browser-refresh-button" className="control-button" onClick={handleRefresh}>Refresh</button>
        </div>
        <iframe
          ref={iframeRef}
          id="browser-iframe"
          className="iframe-view"
          src={iframeSrc}
          title="Morphic/Browser View" // Added title for accessibility
          sandbox="allow-forms allow-modals allow-pointer-lock allow-popups allow-popups-to-escape-sandbox allow-presentation allow-same-origin allow-scripts"
          onError={(e) => console.error("Iframe loading error:", e.nativeEvent)}
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
              const currentFrameUrl = iframeRef.current ? (iframeRef.current.contentWindow?.location?.href || iframeRef.current.src) : 'about:blank';
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
