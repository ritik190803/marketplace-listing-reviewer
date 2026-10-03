# Agent Usage

This document describes how AI coding assistants were used to build this project, what was delegated to them, the mistakes they made or that I caught, the suggestions I rejected, and how every output was verified. A short section at the end describes the AI used **inside** the application.

I reviewed, ran and tested every piece of generated code myself and take responsibility for the submitted work.

---

## 1. Tools

| Tool | How it was used |
|---|---|
| **Claude (Anthropic, claude.ai chat)** | Main assistant for the rebuild: requirement extraction, strict code review of the first prototype, architecture and data model, phase-by-phase code drafts (backend, AI workflow, review workflow, frontend), tests, debugging from pasted errors and logs, deployment guidance, documentation drafts. |
| **A general-purpose AI chat assistant** | Used for the first prototype (OpenAI-based, later replaced). Its output was audited and largely rewritten (see section 4). |
| **GitHub push protection** | Not an agent, but it caught a secret the agents and I missed (see section 4). |

No agent had direct access to my machine, repository or cloud accounts. All commands were run by me, and all code was pasted, read and tested by me.

## 2. Delegated work vs. my work

| Delegated to the AI assistant | Done or decided by me |
|---|---|
| Extracting a requirement checklist from the assignment screenshots | Choosing the problem, confirming the requirement interpretation |
| Auditing the first prototype file by file | Deciding to rebuild instead of patching |
| Drafting code for each phase: schema, validator, repositories, Gemini client, prompt, schema validation, grounding, review service, routes, React components | Creating the files, running them, fixing integration errors, checking each phase's output before moving on |
| Drafting unit tests and the end-to-end smoke test | Running tests, investigating failures, confirming fixes |
| Explaining errors from pasted logs and screenshots | Running the diagnostic commands (SQL checks, curl, browser console) |
| Deployment steps (Neon, Render, Vercel, CORS) | Creating the accounts and services, entering configuration, rotating credentials |
| Drafting README and this document | Reviewing them for accuracy against the actual code |

## 3. Representative prompts

1. **Strict audit**: "Act as a strict senior software engineer and assignment evaluator. Do not assume a feature is implemented because I claim it is. Trace every action React → Axios → Express → database → response → state update and mark it PASS / PARTIAL / MISSING / INCORRECT."
2. **Phase-by-phase build**: "Start building as per the requirements, beginning with the backend. Guide me step by step and tell me which free AI model to use."
3. **Verification of my edits**: "Is this code correct after the update?" (pasting the full file), followed by pasting test output after every change.
4. **Debugging with evidence**: pasting raw outputs such as `npm test` failures, `INTERNAL_ERROR` responses, `information_schema` query results, GitHub push-protection messages and browser console CORS errors.
5. **Scope control**: "Keep the frontend simple and complete it first, then we will go to deployment."

## 4. Important agent mistakes and how they were caught

| # | Mistake | How it was caught | Fix |
|---|---|---|---|
| 1 | The first prototype targeted `gemini-1.5-flash`, which is retired. | Audit against current Google documentation. | Switched to `gemini-3.5-flash-lite` with the `@google/genai` SDK; the model name is a configuration value. Verified that the old model name now fails cleanly with `AI_MODEL_NOT_FOUND`. |
| 2 | The first prototype's Approve / Edit / Reject buttons had no handlers, and no approve/reject routes existed. | End-to-end trace during the audit. | Rebuilt the human review workflow (per-finding decisions, final approval, history) with tests and a smoke test. |
| 3 | Price validation used `parseFloat`, which accepts `"12abc"` as 12; the raw string then crashed the database insert. | Audit, then confirmed with unit tests. | Strict decimal pattern, numeric limits, tests for `"12abc"`, `"1e3"`, `"0x10"`, negatives, booleans and arrays. |
| 4 | Other prototype issues: `dotenv` loaded after modules that read the environment, hard-coded `localhost` API URL, pasted `[cite: N]` chat artifacts in code comments, and documentation claiming a "simulated" AI. | Audit. | Configuration module loads first; `VITE_API_URL` environment variable; artifacts removed; documentation rewritten to match the code. |
| 5 | The schema script used `CREATE TABLE IF NOT EXISTS`, which silently kept my old `listings` table, so AI analysis failed with a 500 error. | Listed the table's columns with `information_schema` and found the old `ai_feedback` column. | Dropped the old tables, re-ran the schema and seed. Lesson: verify the actual database state, not just that a script printed "success". |
| 6 | The revision builder left a dangling `" -"` in titles and doubled full stops (`".."`) when a suggestion removed text. | Running the workflow on **real** Gemini output rather than invented test data. | Improved the clean-up function and added a regression test, which failed until the fix was applied. |
| 7 | A pre-push secret check suggested by the assistant searched only for Gemini and Neon key formats and missed an old OpenAI key left in the first commit's `.env.example`. | **GitHub push protection** rejected the push. | Revoked the OpenAI key, discarded the local Git history before anything was published, and added a broader key-pattern scan (`git grep` for OpenAI, Google and Neon formats) to every commit. |
| 8 | Integration slips on my side: the create-listing route was accidentally deleted while pasting a new route, and one AI module file was never created. | Automated tests failed immediately (404 instead of 400; `Cannot find module`). | Restored the route and the file; tests passed again. |
| 9 | Deployment: the backend's `CORS_ORIGIN` still allowed only localhost, so the live site showed "Cannot reach the server". | Browser console showed the CORS error. | Added the Vercel origin to `CORS_ORIGIN` and verified it with a `curl` request carrying an `Origin` header. |

## 5. Rejected or modified suggestions

- **Full vector-database RAG**: rejected as over-engineering for a 15-section mock policy. I used deterministic retrieval (core sections always, category sections by category, health sections by keyword), logged with the reason for each section, and documented the limitation.
- **Trusting JSON mode alone**: rejected. Asking the model for JSON is only a hint, so every response is also checked with a zod schema and with grounding checks (cited section must have been provided; quoted text must exist in the listing).
- **Letting the AI change listings or decide outcomes**: rejected. The model has no tools or write access; it only proposes findings, and a human decides every change and the final outcome.
- **AI wording accepted blindly**: rejected in the product design. Suggestions containing placeholders such as `[warranty period]` cannot be approved and must be edited by the reviewer.
- **Examples of model output I would not accept as-is** (observed with real Gemini responses): it missed that "48 hour battery" needs test conditions, it rewrote a hype sentence into a new claim the seller never made, and one suggestion ("claimed by the seller to be certified by NASA") was too weak. These are exactly the cases the Edit / Reject decisions exist for, and they are listed as known limitations.

## 6. How the output was verified

- **39 automated tests** (Node test runner and supertest): validation edge cases, API error handling, policy retrieval, AI output parsing with a fake Gemini (malformed JSON, missing fields, hallucinated sections and quotes, retries, auth errors, prompt escaping), the revision builder and review request validation.
- **End-to-end smoke test** (`npm run smoke`): runs the full workflow against a running server with real Gemini: validation, duplicates, state rules, analysis, wrong-listing protection, approve / edit / reject, comparison, final approval, double-approval and reject-after-approve refusal, history and queue filtering. Passed locally and against the deployed backend.
- **Real AI output inspection**: checked that citations match retrieved sections, excerpts are verbatim, severities are sensible, and that a prompt-injection listing produced findings (including the injected text flagged under POL-7) instead of an empty list.
- **Database checks** in pgAdmin and Neon: table columns, analysis runs (including a deliberately failed run), findings and the append-only history.
- **Manual UI checklist**: loading, empty, validation, success and failure states, batch analysis, placeholder editing, approval blockers, locking, history, narrow-screen layout.
- **Frontend**: `npm run lint` and `npm run build` with no errors.
- **Security**: `.env` files confirmed ignored with `git check-ignore`, a key-pattern scan before each commit, GitHub push protection, and an exposed database password rotated.

---

## 7. AI inside the application (summary)

The application itself uses **Google Gemini (`gemini-3.5-flash-lite`)** through the `@google/genai` SDK to review listings. Relevant policy and brand-guide sections are retrieved per listing; the listing is sent as escaped, untrusted data; the response must match a JSON schema whose allowed citations are the retrieved section IDs; the backend validates it with zod, drops ungrounded findings, retries once on malformed output, and logs `ai.analysis.start / success / findings_dropped / error` events. The model only proposes findings; a human reviewer approves, edits or rejects each one. Full details are in the [README](README.md).