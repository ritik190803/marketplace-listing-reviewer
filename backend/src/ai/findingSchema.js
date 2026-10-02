const { z } = require('zod');

const FIELDS = ['title', 'description', 'category', 'price', 'attributes', 'tags'];
const ISSUE_TYPES = ['UNCLEAR', 'MISLEADING', 'PROHIBITED', 'INCOMPLETE', 'UNVERIFIABLE_CLAIM', 'ASSUMPTION'];
const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH'];

// Tolerate harmless formatting differences ("High", "unverifiable claim", "pol-1")
const toUpperCode = (v) => (typeof v === 'string' ? v.trim().toUpperCase().replace(/[\s-]+/g, '_') : v);
const toUpper = (v) => (typeof v === 'string' ? v.trim().toUpperCase() : v);
const toLower = (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v);

const FindingSchema = z.object({
  field: z.preprocess(toLower, z.enum(FIELDS)),
  issue_type: z.preprocess(toUpperCode, z.enum(ISSUE_TYPES)),
  severity: z.preprocess(toUpper, z.enum(SEVERITIES)),
  policy_section: z.preprocess(toUpper, z.string().min(1).max(20)),
  original_excerpt: z.string().max(2000).default(''),
  explanation: z.string().trim().min(5).max(1000),
  suggested_text: z.string().max(5000).default(''),
});

const AnalysisSchema = z.object({
  summary: z.string().trim().max(1000).default(''),
  findings: z.array(FindingSchema).max(20),
});

// Sent to Gemini as responseJsonSchema. The enum on policy_section restricts citations to retrieved sections.
function buildResponseJsonSchema(sectionIds) {
  return {
    type: 'object',
    properties: {
      summary: { type: 'string' },
      findings: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            field: { type: 'string', enum: FIELDS },
            issue_type: { type: 'string', enum: ISSUE_TYPES },
            severity: { type: 'string', enum: SEVERITIES },
            policy_section: { type: 'string', enum: sectionIds },
            original_excerpt: { type: 'string' },
            explanation: { type: 'string' },
            suggested_text: { type: 'string' },
          },
          required: ['field', 'issue_type', 'severity', 'policy_section', 'original_excerpt', 'explanation', 'suggested_text'],
        },
      },
    },
    required: ['summary', 'findings'],
  };
}

module.exports = { AnalysisSchema, buildResponseJsonSchema, FIELDS, ISSUE_TYPES, SEVERITIES };