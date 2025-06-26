import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import { CopilotBackend } from '@copilotkit/backend'; // For structured responses
import playwright from 'playwright';
import fetch from 'node-fetch';

// Ensure node-fetch is imported if not already at the top
// import fetch from 'node-fetch'; // Already there from previous steps

/**
 * Fetches a resource with a specified timeout.
 * @param {string|Request} resource The resource to fetch.
 * @param {object} options Fetch options (e.g., method, headers, body).
 * @param {number} [timeout=15000] Timeout in milliseconds. Defaults to 15 seconds.
 * @returns {Promise<Response>} The fetch Response object.
 * @throws {Error} If the request times out or another fetch error occurs.
 */
async function fetchWithTimeout(resource, options = {}, timeout = 15000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(resource, {
      ...options,
      signal: controller.signal
    });
    return response;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeout / 1000} seconds`);
    }
    throw error; // Re-throw other errors
  } finally {
    clearTimeout(id);
  }
}

const app = express();
const port = process.env.PORT || 3001; // Backend runs on a different port

app.use(cors()); // Allow requests from frontend (Next.js dev server)
app.use(express.json());

// Instantiate CopilotBackend for generating responses
// This might be used if CopilotKit expects a certain response structure
// or if we want to use its features like action execution later.
// For a simple Ollama proxy, it might not be strictly necessary for the most basic chat.
const copilotBackend = new CopilotBackend(); // Potentially for more advanced CopilotKit features later

/**
 * @route POST /api/copilotkit/ollama
 * @description Proxies chat completion requests from the CopilotKit frontend to an Ollama instance.
 * It forwards the message history and model specified by the client.
 * Expects a non-streamed response from Ollama and sends back the assistant's message content as plain text.
 */
app.post('/api/copilotkit/ollama', async (req, res) => {
  console.log('[OllamaChatProxy] Received request:', JSON.stringify(req.body, null, 2));
  const { messages, model } = req.body; // `messages` is an array of {role: string, content: string}
  if (!messages) {
    return res.status(400).json({ error: 'Missing messages in request body' });
  }
  const ollamaModel = model || 'llama3';
  const OLLAMA_CHAT_TIMEOUT = 30000; // 30 seconds for chat responses

  try {
    const ollamaResponse = await fetchWithTimeout('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: ollamaModel,
        messages: messages,
        stream: false, // Keeping this false for now
      }),
    }, OLLAMA_CHAT_TIMEOUT);

    const responseText = await ollamaResponse.text(); // Get text first for better error display
    if (!ollamaResponse.ok) {
      console.error(`[OllamaChatProxy] Ollama API Error (${ollamaResponse.status}):`, responseText);
      // Try to parse JSON error from Ollama if possible
      try {
        const errorJson = JSON.parse(responseText);
        if (errorJson && errorJson.error) {
          throw new Error(`Ollama API Error: ${errorJson.error}`);
        }
      } catch (parseError) { /* Ignore if not JSON */ }
      throw new Error(`Ollama API Error (${ollamaResponse.status}): ${responseText}`);
    }

    const ollamaData = JSON.parse(responseText);
    console.log('[OllamaChatProxy] Ollama response:', JSON.stringify(ollamaData, null, 2));

    if (ollamaData.message && typeof ollamaData.message.content === 'string') {
      res.setHeader('Content-Type', 'text/plain');
      res.send(ollamaData.message.content);
    } else {
      console.error('[OllamaChatProxy] Unexpected Ollama response format:', ollamaData);
      throw new Error('Unexpected Ollama response format from chat.');
    }

  } catch (error) {
    console.error('[OllamaChatProxy] Error proxying to Ollama:', error.message);
    res.status(500).json({ error: error.message, details: error.stack });
  }
});

app.listen(port, () => {
  console.log(`SKYSCOPE CopilotKit backend listening on port ${port}`);
  console.log('Ensure Ollama is running and accessible at http://localhost:11434');
});

// --- Backend Tool Functions ---

/**
 * Performs a Google Custom Search.
 * @param {string} apiKey Google API Key.
 * @param {string} cxId Google Custom Search Engine ID.
 * @param {string} query The search query.
 * @returns {Promise<Array>} A promise that resolves to an array of search result items.
 * @throws {Error} If the API request fails or returns an error.
 */
async function performGoogleSearch_backend(apiKey, cxId, query) {
  console.log(`[BackendTool] Performing Google Search for: ${query}`);
  if (!apiKey || !cxId || !query) throw new Error("API Key, CX ID, and query are required for Google Search.");

  // Using fetchWithTimeout is not strictly necessary here as Google API is usually very fast,
  // but can be added for consistency if desired.
  const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cxId}&q=${encodeURIComponent(query)}`;
  const response = await fetch(url); // Or fetchWithTimeout(url, {}, GOOGLE_API_TIMEOUT)

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google API Error (${response.status}): ${errorText}`);
  }
  const data = await response.json();
  if (data.error) throw new Error(`Google API Error: ${data.error.message}`);
  return data.items || [];
}

/**
 * Fetches and returns the textual content of a webpage using Playwright.
 * @param {string} url The URL of the page to fetch content from.
 * @returns {Promise<string>} A promise that resolves to the trimmed text content of the page.
 * @throws {Error} If Playwright fails to launch, navigate, or extract content.
 */
async function getPageContent_backend(url) {
  console.log(`[BackendTool] Getting content for: ${url}`);
  if (!url) throw new Error("URL is required for getPageContent.");

  // Playwright operations can be long; timeout is handled by Playwright's own settings.
  const browser = await playwright.chromium.launch();
  const page = await browser.newPage();
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 }); // Navigation timeout for Playwright
    const content = await page.evaluate(() => document.body.innerText || document.body.textContent);
    await browser.close();
    return content.trim();
  } catch (e) {
    await browser.close();
    throw new Error(`Playwright (getPageContent) Error for ${url}: ${e.message}`);
  }
}

/**
 * Summarizes a given text using a specified Ollama model.
 * @param {string} ollamaModel The Ollama model to use for summarization (e.g., 'llama3').
 * @param {string} textToSummarize The text to be summarized.
 * @returns {Promise<string>} A promise that resolves to the summarized text.
 * @throws {Error} If the Ollama API request fails or returns an unexpected format.
 */
async function summarizeText_backend(ollamaModel, textToSummarize) {
  console.log(`[BackendTool] Summarizing text (${textToSummarize.length} chars) using ${ollamaModel}`);
  if (!textToSummarize) throw new Error("Text to summarize is required.");

  const OLLAMA_SUMMARY_TIMEOUT = 25000; // 25 seconds for summarization
  const MAX_SUMMARY_INPUT_LENGTH = 10000; // Character limit for text to summarize

  const messages = [
    { role: "system", content: "You are a helpful assistant that summarizes text concisely." },
    { role: "user", content: `Please summarize the following text concisely (max 3-4 sentences):\n\n"${textToSummarize.substring(0, MAX_SUMMARY_INPUT_LENGTH)}" ` }
  ];

  const ollamaResponse = await fetchWithTimeout('http://localhost:11434/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: ollamaModel, messages: messages, stream: false }),
  }, OLLAMA_SUMMARY_TIMEOUT);

  const responseText = await ollamaResponse.text();
  if (!ollamaResponse.ok) {
    console.error(`[SummarizeTool] Ollama API Error (${ollamaResponse.status}):`, responseText);
    try {
        const errorJson = JSON.parse(responseText);
        if (errorJson && errorJson.error) {
          throw new Error(`Ollama Summarization API Error: ${errorJson.error}`);
        }
      } catch (parseError) { /* Ignore if not JSON */ }
    throw new Error(`Ollama Summarization API Error (${ollamaResponse.status}): ${responseText}`);
  }
  const ollamaData = JSON.parse(responseText);
  if (ollamaData.message && typeof ollamaData.message.content === 'string') {
    return ollamaData.message.content;
  }
  console.error("[SummarizeTool] Unexpected Ollama response format:", ollamaData);
  throw new Error("Unexpected Ollama response format during summarization.");
}


// --- API Endpoints ---

/**
 * @route POST /api/browser/navigateTo
 * @description Navigates a headless Playwright browser to a given URL.
 * Sets specific timeouts and a common user agent.
 * Returns the page title upon successful navigation.
 */
app.post('/api/browser/navigateTo', async (req, res) => {
//   const browser = await playwright[browserType].launch();
//   const context = await browser.newContext();
//   const page = await context.newPage();
//   return { browser, page };
// } // This helper is effectively integrated into handlers now.

app.post('/api/browser/navigateTo', async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }
  console.log(`[BrowserBackend] Navigating headless browser to: ${url}`);

  let browser = null; // Define browser outside try to access in finally
  try {
    browser = await playwright.chromium.launch(); // Using chromium directly
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' // Common user agent
    });
    const page = await context.newPage();
    page.setDefaultNavigationTimeout(20000); // 20 seconds navigation timeout
    page.setDefaultTimeout(15000); // 15 seconds for other operations

    await page.goto(url, { waitUntil: 'networkidle' });
    const pageTitle = await page.title();

    // Screenshot functionality (optional, can be large)
    // const screenshotBuffer = await page.screenshot({ type: 'png' });
    // const screenshotBase64 = screenshotBuffer.toString('base64');

    res.json({
      status: 'success',
      pageTitle,
      navigatedUrl: url,
      // screenshot: screenshotBase64 // If sending screenshot
    });
  } catch (error) {
    console.error(`[BrowserBackend] Error navigating to ${url}:`, error.message);
    let errorMessage = `Failed to navigate: ${error.message}`;
    if (error.message && error.message.includes('Timeout')) {
        errorMessage = `Navigation Timeout: The page at ${url} took too long to load.`;
    }
    res.status(500).json({ error: errorMessage, details: error.stack });
  } finally {
    if (browser) {
      await browser.close();
      console.log(`[BrowserBackend] Browser closed for navigateTo ${url}`);
    }
  }
});

app.post('/api/browser/getPageContent', async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }
  console.log(`[BrowserBackend] Getting content for headless browser from: ${url}`);

  let browser = null; // Define browser outside try to access in finally
  try {
    browser = await playwright.chromium.launch();
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    });
    const page = await context.newPage();
    page.setDefaultNavigationTimeout(20000); // 20 seconds navigation timeout
    page.setDefaultTimeout(15000); // 15 seconds for other operations

    await page.goto(url, { waitUntil: 'networkidle' });

    const bodyContent = await page.evaluate(() => {
      // Try to get more meaningful content, less boilerplate
      const mainContentSelectors = ['article', 'main', '[role="main"]', 'body'];
      let mainText = '';
      for (const selector of mainContentSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          mainText = element.innerText || element.textContent;
          if (mainText && mainText.trim().length > 200) break; // Prefer longer content
        }
      }
      return mainText.trim();
    });

    if (!bodyContent) {
        console.warn(`[BrowserBackend] No significant content extracted from ${url}. Falling back to full body text.`);
        // Fallback if specific selectors yield nothing
        // const fullBodyContent = await page.evaluate(() => document.body.innerText || document.body.textContent);
        // res.json({ status: 'success', url, content: fullBodyContent?.trim() || "No text content found." });
        // For now, let's just indicate if main selectors failed.
        res.json({ status: 'success', url, content: "Main content selectors found no significant text. Page might be structured differently or primarily non-textual." });
        return;
    }

    res.json({ status: 'success', url, content: bodyContent });
  } catch (error) {
    console.error(`[BrowserBackend] Error getting content from ${url}:`, error.message);
    let errorMessage = `Failed to get page content: ${error.message}`;
    if (error.message && error.message.includes('Timeout')) {
        errorMessage = `Content Retrieval Timeout: The page at ${url} took too long to process or load.`;
    }
    res.status(500).json({ error: errorMessage, details: error.stack });
  } finally {
    if (browser) {
      await browser.close();
      console.log(`[BrowserBackend] Browser closed for getPageContent ${url}`);
    }
  }
});

app.post('/api/copilotkit/describeImageUrl', async (req, res) => {
  const { imageUrl, prompt, ollamaModel } = req.body;
  console.log(`[VisionBackend] Received describeImageUrl request for: ${imageUrl}, Prompt: ${prompt}, Model: ${ollamaModel}`);

  if (!imageUrl || !prompt || !ollamaModel) {
    return res.status(400).json({ error: 'imageUrl, prompt, and ollamaModel are required.' });
  }

  try {
    // Step 1: Fetch the image from the URL
    console.log(`[VisionBackend] Fetching image from ${imageUrl}`);
    // Using fetchWithTimeout for the image fetch itself, with a shorter timeout
    const IMAGE_FETCH_TIMEOUT = 10000; // 10 seconds for image download
    const imageResponse = await fetchWithTimeout(imageUrl, {}, IMAGE_FETCH_TIMEOUT);
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image from URL: ${imageResponse.status} ${imageResponse.statusText}`);
    }
    const imageBuffer = await imageResponse.arrayBuffer();
    const imageBase64 = Buffer.from(imageBuffer).toString('base64');
    console.log(`[VisionBackend] Image fetched and converted to base64 (${imageBase64.length} chars).`);

    // Step 2: Call Ollama's /api/chat with the image and prompt
    const ollamaPayload = {
      model: ollamaModel, // Ensure this is a multimodal model (e.g., 'llava')
      messages: [
        {
          role: "user",
          content: prompt,
          images: [imageBase64]
        }
      ],
      stream: false
    };
    const OLLAMA_VISION_TIMEOUT = 45000; // 45 seconds for vision model responses

    console.log(`[VisionBackend] Sending payload to Ollama model ${ollamaModel}...`);
    const ollamaApiResponse = await fetchWithTimeout('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ollamaPayload),
    }, OLLAMA_VISION_TIMEOUT);

    const responseText = await ollamaApiResponse.text();
    if (!ollamaApiResponse.ok) {
      console.error(`[VisionBackend] Ollama API Error (${ollamaApiResponse.status}):`, responseText);
      try {
        const errorJson = JSON.parse(responseText);
        if (errorJson && errorJson.error) {
          throw new Error(`Ollama Vision API Error: ${errorJson.error}`);
        }
      } catch (parseError) { /* Ignore if not JSON */ }
      throw new Error(`Ollama Vision API Error (${ollamaApiResponse.status}): ${responseText}`);
    }

    const ollamaData = JSON.parse(responseText);
    console.log('[VisionBackend] Ollama response:', JSON.stringify(ollamaData, null, 2));

    if (ollamaData.message && typeof ollamaData.message.content === 'string') {
      res.json({ description: ollamaData.message.content });
    } else {
      throw new Error('Unexpected Ollama response format for vision model.');
    }

  } catch (error) {
    console.error('[VisionBackend] Error in describeImageUrl:', error.message);
    res.status(500).json({ error: error.message, details: error.stack });
  }
});

/**
 * @route POST /api/copilotkit/researchAndSummarize
 * @description Orchestrates a multi-step research and summarization task.
 * 1. Performs a Google search for the given topic.
 * 2. Fetches content from the first search result using Playwright.
 * 3. Summarizes the fetched content using a specified Ollama model.
 * Returns the summary, source link, and a log of actions taken.
 */
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
  const OLLAMA_ANALYSIS_TIMEOUT = 35000; // 35 seconds for analysis tasks

  try {
    // Construct messages for Ollama
    const messages = [
      {
        role: "system",
        content: "You are an AI assistant. Your task is to analyze the provided text content based on the user's specific analysis task. " +
                 "Please provide your findings and suggestions in a structured JSON format. " +
                 "The root object should have a key 'suggestions', which is an array of objects. " +
                 "Each suggestion object must contain the following keys: " +
                 "'finding' (a brief description of what you found or the context), " +
                 "'reason' (why a change is suggested or why the finding is relevant), " +
                 "'original_snippet' (the exact, complete block of text from the original content that this suggestion pertains to), " +
                 "and 'suggested_change' (the exact, complete block of text as it should be after your suggested modification. If no change, this can be empty or repeat the original). " +
                 "Ensure 'original_snippet' and 'suggested_change' are well-defined blocks, even if multi-line, using markdown code blocks (```) if appropriate for code."
      },
      {
        role: "user",
        // Ensure textContent is not excessively long to keep prompts manageable for the LLM and avoid token limits.
        // The substring(0, 15000) is a good general limit.
        content: `Analysis Task: "${analysisTaskPrompt}"

Text Content to Analyze:
\`\`\`
${textContent.substring(0, 15000)}
\`\`\`

Please provide your analysis and suggestions strictly in the JSON structure defined in the system prompt.`
      }
    ];

    console.log(`[TextAnalysisBackend] Sending payload to Ollama model ${ollamaModel}...`);
    const ollamaApiResponse = await fetchWithTimeout('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: ollamaModel, messages, stream: false, format: "json" }),
    }, OLLAMA_ANALYSIS_TIMEOUT);

    const responseText = await ollamaApiResponse.text();
    if (!ollamaApiResponse.ok) {
      console.error(`[TextAnalysisBackend] Ollama API Error (${ollamaApiResponse.status}):`, responseText);
      try {
        const errorJson = JSON.parse(responseText);
        if (errorJson && errorJson.error) {
          throw new Error(`Ollama Text Analysis API Error: ${errorJson.error}`);
        }
      } catch (parseError) { /* Ignore */ }
      throw new Error(`Ollama Text Analysis API Error (${ollamaApiResponse.status}): ${responseText}`);
    }

    const ollamaData = JSON.parse(responseText);
    console.log('[TextAnalysisBackend] Ollama response:', JSON.stringify(ollamaData, null, 2));

    if (ollamaData.message && typeof ollamaData.message.content === 'string') {
      try {
        const structuredResponse = JSON.parse(ollamaData.message.content);
        res.json(structuredResponse);
      } catch (parseError) {
        console.error('[TextAnalysisBackend] Failed to parse Ollama response as JSON:', parseError);
        res.json({ raw_response: ollamaData.message.content, parse_error: "Ollama response was not valid JSON." });
      }
    } else {
      throw new Error('Unexpected Ollama response format for text analysis.');
    }

  } catch (error) {
    console.error('[TextAnalysisBackend] Error in analyzeTextContent:', error.message);
    res.status(500).json({ error: error.message, details: error.stack });
  }
});
