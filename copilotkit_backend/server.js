import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import { CopilotBackend } from '@copilotkit/backend'; // For structured responses
import playwright from 'playwright';

// Ensure node-fetch is imported if not already at the top
// import fetch from 'node-fetch'; // Already there from previous steps

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

// --- Backend Tool Functions ---

async function performGoogleSearch_backend(apiKey, cxId, query) {
  console.log(`[BackendTool] Performing Google Search for: ${query}`);
  if (!apiKey || !cxId || !query) throw new Error("API Key, CX ID, and query are required for Google Search.");
  const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cxId}&q=${encodeURIComponent(query)}`;
  const response = await fetch(url);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google API Error (${response.status}): ${errorText}`);
  }
  const data = await response.json();
  if (data.error) throw new Error(`Google API Error: ${data.error.message}`);
  return data.items || []; // Return array of search items
}

async function getPageContent_backend(url) {
  console.log(`[BackendTool] Getting content for: ${url}`);
  if (!url) throw new Error("URL is required for getPageContent.");
  const browser = await playwright.chromium.launch(); // Explicitly using chromium
  const page = await browser.newPage();
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 }); // Added timeout
    const content = await page.evaluate(() => document.body.innerText || document.body.textContent);
    await browser.close();
    return content.trim();
  } catch (e) {
    await browser.close(); // Ensure browser closes on error
    throw new Error(`Playwright (getPageContent) Error for ${url}: ${e.message}`);
  }
}

async function summarizeText_backend(ollamaModel, textToSummarize) {
  console.log(`[BackendTool] Summarizing text using ${ollamaModel}`);
  if (!textToSummarize) throw new Error("Text to summarize is required.");

  const messages = [
    { role: "system", content: "You are a helpful assistant that summarizes text." },
    { role: "user", content: `Please summarize the following text concisely:\n\n"${textToSummarize.substring(0, 15000)}"` } // Limit input length
  ];

  const ollamaResponse = await fetch('http://localhost:11434/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: ollamaModel, messages: messages, stream: false }),
  });
  if (!ollamaResponse.ok) {
    const errorBody = await ollamaResponse.text();
    throw new Error(`Ollama API Error for summarization (${ollamaResponse.status}): ${errorBody}`);
  }
  const ollamaData = await ollamaResponse.json();
  if (ollamaData.message && ollamaData.message.content) {
    return ollamaData.message.content;
  }
  throw new Error("Unexpected Ollama response format during summarization.");
}


// Helper function to launch browser and page (retained if other browser endpoints use it)
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
    // This endpoint can use the new getPageContent_backend if desired, or keep its simpler form
    // For this refactor, we assume it might have slightly different needs or was pre-existing.
    // If it's identical, it could call getPageContent_backend.
    const { browser, page } = await launchBrowserAndPage(); // Uses the local helper
    await page.goto(url, { waitUntil: 'networkidle' });
    const pageTitle = await page.title();
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
  // This endpoint can use the new getPageContent_backend
  try {
    const content = await getPageContent_backend(url); // Using the refactored backend tool
    res.json({ status: 'success', url, content: content });
  } catch (error) {
    console.error(`Backend: Error getting content from ${url} (via endpoint):`, error);
    res.status(500).json({ error: `Failed to get page content: ${error.message}` });
  }
});

app.post('/api/copilotkit/describeImageUrl', async (req, res) => {
  const { imageUrl, prompt, ollamaModel } = req.body;
  console.log(`[VisionBackend] Received describeImageUrl request for: ${imageUrl}, Prompt: ${prompt}, Model: ${ollamaModel}`);

  if (!imageUrl || !prompt || !ollamaModel) {
    return res.status(400).json({ error: 'imageUrl, prompt, and ollamaModel are required.' });
  }

  try {
    // 1. Fetch the image from the URL
    console.log(`[VisionBackend] Fetching image from ${imageUrl}`);
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image from URL: ${imageResponse.status} ${imageResponse.statusText}`);
    }
    const imageBuffer = await imageResponse.arrayBuffer(); // Get as ArrayBuffer
    const imageBase64 = Buffer.from(imageBuffer).toString('base64'); // Convert to base64
    console.log(`[VisionBackend] Image fetched and converted to base64 (${imageBase64.length} chars).`);

    // 2. Call Ollama's /api/chat with the image and prompt
    //    (Ensure the specified ollamaModel is a multimodal model like llava, bakllava, qwen-vl)
    const ollamaPayload = {
      model: ollamaModel,
      messages: [
        {
          role: "user",
          content: prompt, // User's text prompt
          images: [imageBase64] // Array of base64 encoded image strings
        }
      ],
      stream: false
    };

    console.log(`[VisionBackend] Sending payload to Ollama model ${ollamaModel}...`);
    const ollamaApiResponse = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ollamaPayload),
    });

    if (!ollamaApiResponse.ok) {
      const errorBody = await ollamaApiResponse.text();
      console.error(`[VisionBackend] Ollama API Error (${ollamaApiResponse.status}):`, errorBody);
      throw new Error(`Ollama API Error: ${ollamaApiResponse.status} - ${errorBody}`);
    }

    const ollamaData = await ollamaApiResponse.json();
    console.log('[VisionBackend] Ollama response:', JSON.stringify(ollamaData, null, 2));

    if (ollamaData.message && ollamaData.message.content) {
      res.json({ description: ollamaData.message.content });
    } else {
      throw new Error('Unexpected Ollama response format for vision model.');
    }

  } catch (error) {
    console.error('[VisionBackend] Error in describeImageUrl:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/copilotkit/researchAndSummarize', async (req, res) => {
  const { topic, ollamaModel, googleApiKey, googleCxId } = req.body;
  console.log(`[AgentWorkflow] Received researchAndSummarize request for topic: "${topic}"`);

  if (!topic || !ollamaModel || !googleApiKey || !googleCxId) {
    return res.status(400).json({ error: 'Topic, ollamaModel, googleApiKey, and googleCxId are required.' });
  }

  const graphState = {
    topic,
    googleApiKey,
    googleCxId,
    searchResults: null,
    fetchedContent: null,
    summary: null,
    error: null,
    log: [`[${new Date().toISOString()}] Starting research for: ${topic}`],
  };

  try {
    graphState.log.push("Researcher: Performing Google Search...");
    const searchItems = await performGoogleSearch_backend(googleApiKey, googleCxId, topic);
    if (!searchItems || searchItems.length === 0) {
      throw new Error("No search results found for the topic.");
    }
    graphState.searchResults = searchItems.map(item => ({ title: item.title, link: item.link, snippet: item.snippet }));
    graphState.log.push(`Researcher: Found ${searchItems.length} results. Attempting to fetch content from the first result.`);

    const firstLink = searchItems[0]?.link;
    if (!firstLink) {
      throw new Error("No link found in search results to fetch content from.");
    }
    graphState.log.push(`Researcher: Fetching content from ${firstLink}...`);
    graphState.fetchedContent = await getPageContent_backend(firstLink);
    if (!graphState.fetchedContent) {
      throw new Error(`Failed to fetch content from ${firstLink}.`);
    }
    graphState.log.push(`Researcher: Content fetched successfully (${graphState.fetchedContent.length} chars). Passing to Summarizer.`);

    graphState.log.push("Summarizer: Summarizing fetched content...");
    graphState.summary = await summarizeText_backend(ollamaModel, graphState.fetchedContent);
    graphState.log.push("Summarizer: Content summarized.");
    graphState.log.push("Workflow Complete.");

    res.json({
      summary: graphState.summary,
      firstResultTitle: searchItems[0]?.title,
      firstResultLink: firstLink,
      log: graphState.log
    });

  } catch (e) {
    console.error('[AgentWorkflow] Error:', e.message);
    graphState.error = e.message;
    graphState.log.push(`[ERROR] ${e.message}`);
    res.status(500).json({ error: e.message, log: graphState.log });
  }
});

app.post('/api/copilotkit/analyzeTextContent', async (req, res) => {
  const { textContent, analysisTaskPrompt, ollamaModel } = req.body;
  console.log(`[TextAnalysisBackend] Received analyzeTextContent request. Task: "${analysisTaskPrompt}", Model: ${ollamaModel}`);

  if (!textContent || !analysisTaskPrompt || !ollamaModel) {
    return res.status(400).json({ error: 'textContent, analysisTaskPrompt, and ollamaModel are required.' });
  }

  try {
    // Construct messages for Ollama
    // The prompt to Ollama should clearly ask for structured JSON output if that's desired.
    const messages = [
      {
        role: "system",
        content: "You are an AI assistant that analyzes text and provides suggestions in a structured JSON format. The JSON should have a key 'suggestions' which is an array of objects, each with 'finding', 'original_snippet', 'suggested_change', and 'reason'."
      },
      {
        role: "user",
        content: `Analyze the following text content based on the task: "${analysisTaskPrompt}".\n\nText Content:\n"""\n${textContent.substring(0, 15000)}\n"""\n\nPlease provide your analysis and suggestions in the specified JSON structure.`
      }
    ];

    console.log(`[TextAnalysisBackend] Sending payload to Ollama model ${ollamaModel}...`);
    const ollamaApiResponse = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: ollamaModel, messages, stream: false, format: "json" }), // Request JSON format
    });

    if (!ollamaApiResponse.ok) {
      const errorBody = await ollamaApiResponse.text();
      console.error(`[TextAnalysisBackend] Ollama API Error (${ollamaApiResponse.status}):`, errorBody);
      throw new Error(`Ollama API Error: ${ollamaApiResponse.status} - ${errorBody}`);
    }

    const ollamaData = await ollamaApiResponse.json();
    console.log('[TextAnalysisBackend] Ollama response:', JSON.stringify(ollamaData, null, 2));

    if (ollamaData.message && ollamaData.message.content) {
      // Attempt to parse the content as JSON, as requested from Ollama
      try {
        const structuredResponse = JSON.parse(ollamaData.message.content);
        res.json(structuredResponse); // Send the parsed JSON (e.g., { suggestions: [...] })
      } catch (parseError) {
        console.error('[TextAnalysisBackend] Failed to parse Ollama response as JSON:', parseError);
        // If parsing fails, send the raw content anyway, client might handle it or it's an LLM error.
        res.json({ raw_response: ollamaData.message.content, parse_error: "Ollama response was not valid JSON." });
      }
    } else {
      throw new Error('Unexpected Ollama response format for text analysis.');
    }

  } catch (error) {
    console.error('[TextAnalysisBackend] Error in analyzeTextContent:', error);
    res.status(500).json({ error: error.message });
  }
});
