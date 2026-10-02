const { GoogleGenAI } = require('@google/genai');
const config = require('../config');
const { AppError } = require('../errors');

let client = null;

function getClient() {
  if (!config.geminiApiKey) {
    throw new AppError(503, 'AI_NOT_CONFIGURED', 'AI analysis is not configured on the server.');
  }
  if (!client) client = new GoogleGenAI({ apiKey: config.geminiApiKey });
  return client;
}

function mapGeminiError(err) {
  if (err instanceof AppError) return err;
  const status = typeof err.status === 'number' ? err.status : null;
  const mapped = (httpStatus, code, message, retryable = false) => {
    const e = new AppError(httpStatus, code, message, undefined, { retryable });
    e.cause = err;
    return e;
  };

  if (status === 401 || status === 403) return mapped(502, 'AI_AUTH_FAILED', 'The AI service rejected the API key.');
  if (status === 404) return mapped(502, 'AI_MODEL_NOT_FOUND', `AI model "${config.geminiModel}" was not found.`);
  if (status === 429) return mapped(429, 'AI_RATE_LIMITED', 'AI rate limit reached. Please wait a minute and try again.');
  if (status === 400) return mapped(502, 'AI_REQUEST_REJECTED', 'The AI service rejected the request.');
  if (status && status >= 500) return mapped(503, 'AI_UNAVAILABLE', 'The AI service is temporarily unavailable.', true);
  return mapped(503, 'AI_UNAVAILABLE', 'Could not reach the AI service.', true); // network errors
}

function withTimeout(promise, ms, controller) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new AppError(504, 'AI_TIMEOUT', `The AI service did not respond within ${Math.round(ms / 1000)} seconds.`));
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/** Calls Gemini in JSON mode. Returns raw text plus metadata; parsing/validation happens in analyzeListing. */
async function generateJson({ systemInstruction, userPrompt, responseJsonSchema }) {
  const ai = getClient();
  const controller = new AbortController();

  let response;
  try {
    response = await withTimeout(
      ai.models.generateContent({
        model: config.geminiModel,
        contents: userPrompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseJsonSchema,
          temperature: 0.2,
          maxOutputTokens: 8192,
          abortSignal: controller.signal,
        },
      }),
      config.aiTimeoutMs,
      controller
    );
  } catch (err) {
    throw mapGeminiError(err);
  }

  return {
    text: response.text ?? '',
    finishReason: response.candidates?.[0]?.finishReason ?? null,
    blockReason: response.promptFeedback?.blockReason ?? null,
    usage: response.usageMetadata ?? null,
  };
}

module.exports = { generateJson };