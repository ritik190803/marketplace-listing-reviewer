const TEXT_FIELDS = ['title', 'description'];
const PLACEHOLDER_PATTERN = /\[[^\]\n]{1,60}\]/;

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Matches the excerpt case-insensitively and tolerates whitespace differences
function excerptPattern(excerpt) {
  return new RegExp(excerpt.trim().split(/\s+/).map(escapeRegex).join('\\s+'), 'i');
}

// Cleans up spacing/punctuation left behind when excerpts are replaced or removed
function tidy(text, { singleLine }) {
  const collapsed = singleLine ? text.replace(/\s+/g, ' ') : text.replace(/[ \t]{2,}/g, ' ');
  return collapsed
    .replace(/ +([.,;:!?])/g, '$1')                 // "word ." -> "word."
    .replace(/([.,;:!?])(?:\s*[.,;:])+/g, '$1')     // ". ." / ".." left by removals -> "."
    .replace(/^[\s\-–—|,;:]+|[\s\-–—|,;:]+$/g, '')  // dangling " -" or "," at the start/end
    .trim();
}

/**
 * Builds the revised listing from the original + human decisions. Never mutates the original.
 * - APPROVED/EDITED title/description findings are applied in finding-id order.
 * - With an excerpt: the excerpt is replaced by final_text (empty/null final_text = remove it).
 * - Without an excerpt (INCOMPLETE): description gets the text appended; title is replaced.
 * - Findings on category/price/attributes/tags are advisory: shown to the reviewer, not auto-applied.
 */
function applyRevisions(listing, findings) {
  const text = { title: listing.title, description: listing.description };
  const applied = [];
  const skipped = [];
  const advisory = [];

  const accepted = findings
    .filter((f) => f.decision === 'APPROVED' || f.decision === 'EDITED')
    .sort((a, b) => a.id - b.id);

  for (const finding of accepted) {
    if (!TEXT_FIELDS.includes(finding.field)) {
      advisory.push(finding.id);
      continue;
    }
    const replacement = (finding.final_text ?? '').trim();
    const current = text[finding.field];

    if (finding.original_excerpt) {
      const pattern = excerptPattern(finding.original_excerpt);
      if (!pattern.test(current)) {
        skipped.push({ findingId: finding.id, reason: 'EXCERPT_NOT_FOUND' });
        continue;
      }
      text[finding.field] = current.replace(pattern, () => replacement);
    } else if (replacement) {
      text[finding.field] = finding.field === 'title' ? replacement : `${current.trimEnd()}\n${replacement}`;
    } else {
      skipped.push({ findingId: finding.id, reason: 'NOTHING_TO_APPLY' });
      continue;
    }
    applied.push(finding.id);
  }

  const revised = {
    title: tidy(text.title, { singleLine: true }),
    description: tidy(text.description, { singleLine: false }),
    category: listing.category,
    price: listing.price,
    attributes: listing.attributes,
    tags: listing.tags,
  };

  return {
    revised,
    applied,
    skipped,
    advisory,
    hasPlaceholders: PLACEHOLDER_PATTERN.test(revised.title) || PLACEHOLDER_PATTERN.test(revised.description),
  };
}

module.exports = { applyRevisions, PLACEHOLDER_PATTERN };