const { POLICY_SECTIONS } = require('./policyData');

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function searchableText(listing) {
  const attributeText = Object.entries(listing.attributes || {}).map(([k, v]) => `${k} ${v}`);
  return [listing.title, listing.description, ...attributeText, ...(listing.tags || [])].join(' ');
}

/**
 * Selects the policy and brand-guide sections relevant to one listing.
 * Returns each section with the reason it was retrieved (logged and stored for traceability).
 */
function retrievePolicySections(listing) {
  const text = searchableText(listing);
  const results = [];

  for (const section of POLICY_SECTIONS) {
    if (section.trigger === 'always') {
      results.push({ ...section, reason: 'core section' });
    } else if (section.trigger === 'category' && section.categories.includes(listing.category)) {
      results.push({ ...section, reason: `category: ${listing.category}` });
    } else if (section.trigger === 'keyword') {
      const hit = section.keywords.find((k) => new RegExp(`\\b${escapeRegex(k)}\\b`, 'i').test(text));
      if (hit) results.push({ ...section, reason: `keyword: "${hit}"` });
    }
  }
  return results;
}

module.exports = { retrievePolicySections };