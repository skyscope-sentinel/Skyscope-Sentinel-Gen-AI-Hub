// renderer/pages/_app.js
import '../styles/globals.css';
import { CopilotKit } from '@copilotkit/react-core';
import "@copilotkit/react-ui/styles.css"; // Import default UI styles

// URL for the backend service we just created.
// Ensure this backend is running when the app starts.
const copilotKitBackendUrl = "http://localhost:3001/api/copilotkit/ollama";

function MyApp({ Component, pageProps }) {
  return (
    <CopilotKit url={copilotKitBackendUrl}>
      <Component {...pageProps} />
    </CopilotKit>
  );
}

export default MyApp;
