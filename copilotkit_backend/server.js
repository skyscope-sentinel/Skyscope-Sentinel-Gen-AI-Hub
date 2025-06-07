import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import { CopilotBackend } from '@copilotkit/backend'; // For structured responses
import playwright from 'playwright';

const app = express();
const port = process.env.PORT || 3001; // Backend runs on a different port

app.use(cors()); // Allow requests from frontend (Next.js dev server)
app.use(express.json());

// Instantiate CopilotBackend for generating responses
// This might be used if CopilotKit expects a certain response structure
// or if we want to use its features like action execution later.
// For a simple Ollama proxy, it might not be strictly necessary for the most basic chat.
const copilotBackend = new CopilotBackend();

app.post('/api/copilotkit/ollama', async (req, res) => {
  console.log('Backend received request from CopilotKit frontend:', JSON.stringify(req.body, null, 2));

  const { messages, model } = req.body; // CopilotKit typically sends 'messages' and 'model'

  if (!messages) {
    return res.status(400).json({ error: 'Missing messages in request body' });
  }

  // Use the model specified by CopilotKit request, or a default
  const ollamaModel = model || 'llama3';

  try {
    const ollamaResponse = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: ollamaModel,
        messages: messages, // Forwarding the messages array directly
        stream: false, // For simplicity in this step, not streaming
      }),
    });

    if (!ollamaResponse.ok) {
      const errorBody = await ollamaResponse.text();
      console.error('Ollama API Error:', ollamaResponse.status, errorBody);
      return res.status(ollamaResponse.status).json({ error: `Ollama API Error: ${errorBody}` });
    }

    const ollamaData = await ollamaResponse.json();
    console.log('Ollama response:', JSON.stringify(ollamaData, null, 2));

    // Send the content of the assistant's message back
    // CopilotKit expects a stream or a specific format.
    // For non-streaming, we send a simple text response that CopilotKit's <CopilotChat> can handle.
    // A more robust solution would use copilotBackend.chat / copilotBackend.completion
    // or stream the response.
    if (ollamaData.message && ollamaData.message.content) {
      // For a simple text response (non-streaming)
      // CopilotKit's default chat UI can handle this.
      res.setHeader('Content-Type', 'text/plain');
      res.send(ollamaData.message.content);
    } else {
      console.error('Unexpected Ollama response format:', ollamaData);
      res.status(500).json({ error: 'Unexpected Ollama response format' });
    }

  } catch (error) {
    console.error('Error proxying to Ollama:', error);
    res.status(500).json({ error: 'Failed to connect to Ollama: ' + error.message });
  }
});

app.listen(port, () => {
  console.log(`SKYSCOPE CopilotKit backend listening on port ${port}`);
  console.log('Ensure Ollama is running and accessible at http://localhost:11434');
});

// Helper function to launch browser and page
async function launchBrowserAndPage(browserType = 'chromium') {
  const browser = await playwright[browserType].launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  return { browser, page };
}

app.post('/api/browser/navigateTo', async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }
  console.log(`Backend: Navigating headless browser to: ${url}`);
  try {
    const { browser, page } = await launchBrowserAndPage();
    await page.goto(url, { waitUntil: 'networkidle' });
    const pageTitle = await page.title();
    // For simplicity, not returning screenshot data in this step
    await browser.close();
    res.json({ status: 'success', pageTitle, navigatedUrl: url });
  } catch (error) {
    console.error(`Backend: Error navigating to ${url}:`, error);
    res.status(500).json({ error: `Failed to navigate: ${error.message}` });
  }
});

app.post('/api/browser/getPageContent', async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }
  console.log(`Backend: Getting content for headless browser from: ${url}`);
  try {
    const { browser, page } = await launchBrowserAndPage();
    await page.goto(url, { waitUntil: 'networkidle' });
    // More robust content extraction might involve selecting specific elements
    const bodyContent = await page.evaluate(() => document.body.innerText || document.body.textContent);
    await browser.close();
    res.json({ status: 'success', url, content: bodyContent.trim() });
  } catch (error) {
    console.error(`Backend: Error getting content from ${url}:`, error);
    res.status(500).json({ error: `Failed to get page content: ${error.message}` });
  }
});
