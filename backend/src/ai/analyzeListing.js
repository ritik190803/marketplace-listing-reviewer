const config = require('../config');
const defaultLogger = require('../logger');
const { AppError } = require('../errors');
const { retrievePolicySections } = require('../policy/retrievePolicy');
const { SYSTEM_INSTRUCTION, buildUserPrompt } = require('./prompt');
const { AnalysisSchema, buildResponseJsonSchema } = require('./findingSchema');
const { groundFindings } = require('./grounding');
const gemini = require('./geminiClient');

const MAX_ATTEMPTS = 2;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function badOutput(code, message, details) {
  return new AppError(502, code, message, details, { retryable: true });
}

function parseModelOutput(result) {
  if (result.blockReason) {
    throw new AppError(502, 'AI_BLOCKED', `The AI service declined to process this listing (${result.blockReason}).`);
  }
  if (!result.text || !result.text.trim()) {
    throw badOutput('AI_EMPTY_OUTPUT', 'The AI returned an empty response.', { finishReason: result.finishReason });
  }

  const cleaned = result.text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let json;
  try {
    json = JSON.parse(cleaned);
  } catch {
    throw badOutput('AI_BAD_OUTPUT', 'The AI returned invalid JSON.', { finishReason: result.finishReason });
  }

  const parsed = AnalysisSchema.safeParse(json);
  if (!parsed.success) {
    throw badOutput('AI_BAD_OUTPUT', 'The AI response did not match the expected structure.', {
      issues: parsed.error.issues.slice(0, 5).map((i) => `${i.path.join('.')}: ${i.message}`),
    });
  }
  return { json, data: parsed.data };
}

/**
 * Runs the AI workflow for one listing. Never writes to the database.
 * `generate` is injectable so tests can simulate Gemini responses.
 */
async function analyzeListing(listing, { generate = gemini.generateJson, log = defaultLogger, retryDelayMs = 1000 } = {}) {
  const model = config.geminiModel;
  const sections = retrievePolicySections(listing);
  const sectionIds = sections.map((s) => s.id);
  const userPrompt = buildUserPrompt(listing, sections);
  const responseJsonSchema = buildResponseJsonSchema(sectionIds);
  const started = Date.now();
  let lastError;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const attemptStart = Date.now();
    log.info(
      {
        event: 'ai.analysis.start',
        listingId: listing.id,
        model,
        attempt,
        retrievedSections: sections.map((s) => ({ id: s.id, reason: s.reason })),
        promptChars: userPrompt.length,
      },
      'AI analysis started'
    );

    try {
      const result = await generate({ systemInstruction: SYSTEM_INSTRUCTION, userPrompt, responseJsonSchema });
      const { json, data } = parseModelOutput(result);
      const { findings, dropped } = groundFindings(data.findings, listing, sectionIds);
      const latencyMs = Date.now() - started;

      log.info(
        {
          event: 'ai.analysis.success',
          listingId: listing.id,
          model,
          attempt,
          latencyMs,
          findingsCount: findings.length,
          droppedCount: dropped.length,
          finishReason: result.finishReason,
          usage: result.usage,
        },
        'AI analysis succeeded'
      );
      if (dropped.length > 0) {
        log.warn({ event: 'ai.analysis.findings_dropped', listingId: listing.id, dropped }, 'Dropped ungrounded AI findings');
      }

      return { model, retrievedSections: sectionIds, summary: data.summary, findings, dropped, rawOutput: json, latencyMs };
    } catch (err) {
      lastError = err instanceof AppError ? err : new AppError(502, 'AI_FAILED', 'AI analysis failed.');
      log.error(
        {
          event: 'ai.analysis.error',
          listingId: listing.id,
          model,
          attempt,
          code: lastError.code,
          retryable: lastError.retryable,
          latencyMs: Date.now() - attemptStart,
          details: lastError.details,
          cause: err.cause?.message || err.message,
        },
        'AI analysis attempt failed'
      );
      if (!lastError.retryable || attempt === MAX_ATTEMPTS) break;
      await sleep(retryDelayMs * attempt);
    }
  }

  lastError.latencyMs = Date.now() - started;
  lastError.retrievedSections = sectionIds;
  throw lastError;
}

module.exports = { analyzeListing };