// Mock policy and brand-content guide written for this project (not a real marketplace's policy).
const POLICY_SECTIONS = [
  {
    id: 'POL-1',
    source: 'Marketplace Policy',
    title: 'Accurate and non-misleading content',
    trigger: 'always',
    text:
      'Listings must describe the item or service accurately. Superlatives or absolute claims presented as fact ' +
      '(for example "best ever", "100%", "zero problems", or "like new" for used goods) are not allowed unless objectively ' +
      'verifiable. Comparisons with named competitor products must be factual and substantiated.',
  },
  {
    id: 'POL-2',
    source: 'Marketplace Policy',
    title: 'Verifiable claims, certifications and endorsements',
    trigger: 'always',
    text:
      'Claims about certifications, awards, endorsements (for example "doctor recommended" or "certified by ..."), test ' +
      'results, or history (for example "never had an accident") must be verifiable. If the listing gives no evidence ' +
      '(certificate number, report, or a specific document available on request), the claim must be removed or reworded ' +
      'as a clearly attributed seller statement.',
  },
  {
    id: 'POL-3',
    source: 'Marketplace Policy',
    title: 'Health and medical claims',
    trigger: 'keyword',
    keywords: ['cure', 'cures', 'treat', 'treats', 'heal', 'heals', 'doctor', 'doctors', 'medical', 'health',
      'therapy', 'therapeutic', 'relief', 'eye strain', 'pain', 'disease'],
    text:
      'Products that are not registered medical devices must not claim to diagnose, cure, treat, or prevent any medical ' +
      'condition, and must not imply medical endorsement.',
  },
  {
    id: 'POL-4',
    source: 'Marketplace Policy',
    title: 'Prohibited items',
    trigger: 'always',
    text:
      'Counterfeit goods, replicas, "first copy", "inspired" or look-alike copies of branded products, and listings that ' +
      'imply a product is genuine when it is not are prohibited and must be rejected. Weapons, controlled substances, and ' +
      'recalled products are also prohibited.',
  },
  {
    id: 'POL-5',
    source: 'Marketplace Policy',
    title: 'Condition disclosure',
    trigger: 'always',
    text:
      'Used and refurbished items must state their condition clearly, including known defects, wear, and whether a ' +
      'warranty is included. Vague terms such as "good" or "working condition" without specifics are incomplete.',
  },
  {
    id: 'POL-6',
    source: 'Marketplace Policy',
    title: 'Pricing claims',
    trigger: 'always',
    text:
      'Listings must not claim "guaranteed lowest price", "best price in the market", or similar unverifiable price ' +
      'comparisons. If the listed price applies only to a specific variant or scope, the listing must say so.',
  },
  {
    id: 'POL-7',
    source: 'Marketplace Policy',
    title: 'Listing integrity',
    trigger: 'always',
    text:
      'Listing content must only describe the offer. Text addressed to reviewers, moderators, or automated systems ' +
      '(for example instructions to ignore rules or to approve the listing), off-platform contact requests, and ' +
      'unrelated content are not allowed and must be removed.',
  },
  {
    id: 'CAT-ELEC',
    source: 'Marketplace Policy',
    title: 'Electronics requirements',
    trigger: 'category',
    categories: ['Electronics'],
    text:
      'Electronics listings must state brand and model (or "unbranded"), condition, key specifications, and warranty ' +
      'status. Battery-life and performance claims must state test conditions or be described as "up to" manufacturer ' +
      'figures. Waterproof claims must cite a rating (for example IPX4).',
  },
  {
    id: 'CAT-HOME',
    source: 'Marketplace Policy',
    title: 'Home and furniture requirements',
    trigger: 'category',
    categories: ['Home'],
    text:
      'Home and furniture listings must state dimensions, primary material, condition, and any defects. Pickup or ' +
      'delivery terms must be stated.',
  },
  {
    id: 'CAT-APP',
    source: 'Marketplace Policy',
    title: 'Apparel and accessories requirements',
    trigger: 'category',
    categories: ['Apparel'],
    text:
      'Apparel and accessories listings must state size or dimensions, material, and condition. Brand names may only be ' +
      'used for genuine branded goods.',
  },
  {
    id: 'CAT-SERV',
    source: 'Marketplace Policy',
    title: 'Services requirements',
    trigger: 'category',
    categories: ['Services'],
    text:
      'Service listings must state what is included, the service area, the pricing basis (for example per visit, per ' +
      'hour, or per home size), and any exclusions.',
  },
  {
    id: 'CAT-AUTO',
    source: 'Marketplace Policy',
    title: 'Automotive requirements',
    trigger: 'category',
    categories: ['Automotive'],
    text:
      'Vehicle listings must state make, model, year, fuel type, kilometres driven, number of previous owners, and ' +
      'accident or damage history as a factual statement the seller can support with documents.',
  },
  {
    id: 'BRD-1',
    source: 'Brand Content Guide',
    title: 'Title format',
    trigger: 'always',
    text:
      'Titles should follow "Brand + Product + Key specification" (for example "SoundMax X2 Wireless Earbuds, 30h ' +
      'Battery"). Avoid hype words ("best", "amazing"), all-caps words, and excessive punctuation. Recommended length: ' +
      '20 to 80 characters.',
  },
  {
    id: 'BRD-2',
    source: 'Brand Content Guide',
    title: 'Description style',
    trigger: 'always',
    text:
      'Descriptions should be factual and specific: start with what the item is, then condition, key specifications, ' +
      'and what is included. Use plain, neutral language and short sentences. Avoid exaggeration and vague phrases.',
  },
  {
    id: 'BRD-3',
    source: 'Brand Content Guide',
    title: 'Tone and formatting',
    trigger: 'always',
    text:
      'Do not use all-caps sentences, repeated exclamation marks, or emoji. Write in a professional, neutral tone ' +
      'addressed to buyers.',
  },
];

module.exports = { POLICY_SECTIONS };