function normalize(text) {
  return String(text).toLowerCase().replace(/\s+/g, ' ').trim();
}

function fieldText(listing, field) {
  switch (field) {
    case 'title': return listing.title;
    case 'description': return listing.description;
    case 'category': return listing.category;
    case 'price': return String(listing.price);
    case 'attributes': {
      const attrs = listing.attributes || {};
      return `${Object.entries(attrs).map(([k, v]) => `${k}: ${v}`).join('; ')} ${JSON.stringify(attrs)}`;
    }
    case 'tags': return (listing.tags || []).join(', ');
    default: return '';
  }
}

/**
 * Deterministic checks on validated AI findings:
 *  - cited section must be one of the retrieved sections
 *  - a non-empty excerpt must actually appear in the cited field
 *  - duplicates are removed
 */
function groundFindings(findings, listing, allowedSectionIds) {
  const allowed = new Set(allowedSectionIds);
  const kept = [];
  const dropped = [];
  const seen = new Set();

  for (const finding of findings) {
    const excerpt = finding.original_excerpt.trim();

    if (!allowed.has(finding.policy_section)) {
      dropped.push({ reason: 'UNKNOWN_POLICY_SECTION', field: finding.field, policySection: finding.policy_section });
      continue;
    }
    if (excerpt && !normalize(fieldText(listing, finding.field)).includes(normalize(excerpt))) {
      dropped.push({ reason: 'EXCERPT_NOT_IN_LISTING', field: finding.field, excerpt: excerpt.slice(0, 100) });
      continue;
    }
    const key = [finding.field, finding.issue_type, finding.policy_section, normalize(excerpt)].join('|');
    if (seen.has(key)) {
      dropped.push({ reason: 'DUPLICATE', field: finding.field });
      continue;
    }
    seen.add(key);
    kept.push({ ...finding, original_excerpt: excerpt, suggested_text: finding.suggested_text.trim() });
  }
  return { findings: kept, dropped };
}

module.exports = { groundFindings };