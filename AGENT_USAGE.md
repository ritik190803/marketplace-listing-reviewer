# AI Agent Usage

## Tools
* **Model:** OpenAI `gpt-4o-mini` (Note: Simulated in production due to 429 quota limits, but fully integrated in the codebase).
* **Integration:** Node.js OpenAI SDK.

## Delegated Work
The LLM is responsible for reading listing text (Title, Description, Category) and evaluating it against a strict set of mock marketplace policies. It handles identifying promotional language, unverifiable claims, and prohibited items. It is strictly limited to generating suggestions; it cannot automatically approve or reject a listing.

## Representative Prompts
The system uses a highly structured prompt to enforce JSON output:
\`\`\`text
You are an expert Marketplace Listing Quality Reviewer. Review the following product listing against the provided marketplace policy.
[Policy Injected Here]
Identify any unclear, misleading, prohibited, or incomplete content. Identify any assumptions or unverifiable claims. 
You MUST output a JSON object with a "findings" array containing: field, severity, policy_citation, explanation, suggested_wording, and unverifiable_claim.
\`\`\`

## Important Agent Mistakes & Rejected Suggestions
* **Mistake:** The AI occasionally flags subjective but harmless marketing terms (e.g., "beautiful design") as unverifiable claims.
* **Mitigation:** The human-in-the-loop interface allows the reviewer to reject these specific findings while preserving valid policy violations.

## Output Verification
The AI output is verified programmatically by requesting `response_format: { type: "json_object" }`. The backend logs the start and success/failure states of the AI process using structured `[AI-LOG]` markers before committing the result to the PostgreSQL database.