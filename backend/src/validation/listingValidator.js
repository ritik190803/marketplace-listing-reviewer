const SUPPORTED_CATEGORIES = ['Electronics', 'Home', 'Apparel', 'Services', 'Automotive'];

const LIMITS = {
  titleMin: 5,
  titleMax: 100,
  descriptionMin: 20,
  descriptionMax: 5000,
  sellerMin: 2,
  sellerMax: 100,
  priceMax: 1000000,
  maxTags: 10,
  tagMax: 30,
  maxAttributes: 20,
  attributeKeyMax: 50,
  attributeValueMax: 200,
};

// Plain decimal: digits, optional dot + up to 2 decimals. Rejects "1e3", "0x10", "12abc".
const PRICE_PATTERN = /^\d{1,7}(\.\d{1,2})?$/;

const LABELS = { title: 'Title', description: 'Description', seller: 'Seller' };

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validateText(value, field, min, max, errors, { collapseWhitespace = true } = {}) {
  const label = LABELS[field];
  if (value === undefined || value === null) {
    errors[field] = `${label} is required.`;
    return undefined;
  }
  if (typeof value !== 'string') {
    errors[field] = `${label} must be text.`;
    return undefined;
  }
  const cleaned = collapseWhitespace ? value.trim().replace(/\s+/g, ' ') : value.trim();
  if (cleaned.length === 0) {
    errors[field] = `${label} is required.`;
    return undefined;
  }
  if (cleaned.length < min || cleaned.length > max) {
    errors[field] = `${label} must be between ${min} and ${max} characters.`;
    return undefined;
  }
  return cleaned;
}

function validatePrice(value, errors) {
  if (value === undefined || value === null || value === '') {
    errors.price = 'Price is required.';
    return undefined;
  }
  if (typeof value !== 'number' && typeof value !== 'string') {
    errors.price = 'Price must be a number.';
    return undefined;
  }
  const text = typeof value === 'number' ? String(value) : value.trim();
  const amount = Number(text);
  if (text === '' || !Number.isFinite(amount)) {
    errors.price = 'Price must be a number.';
    return undefined;
  }
  if (amount <= 0) {
    errors.price = 'Price must be greater than 0.';
    return undefined;
  }
  if (amount > LIMITS.priceMax) {
    errors.price = `Price cannot exceed ${LIMITS.priceMax}.`;
    return undefined;
  }
  if (!PRICE_PATTERN.test(text)) {
    errors.price = 'Price must be a plain number with at most 2 decimals (e.g. 499 or 499.99).';
    return undefined;
  }
  return amount;
}

function validateCategory(value, errors) {
  if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
    errors.category = 'Category is required.';
    return undefined;
  }
  if (typeof value !== 'string') {
    errors.category = 'Category must be text.';
    return undefined;
  }
  const match = SUPPORTED_CATEGORIES.find((c) => c.toLowerCase() === value.trim().toLowerCase());
  if (!match) {
    errors.category = `Category must be one of: ${SUPPORTED_CATEGORIES.join(', ')}.`;
    return undefined;
  }
  return match; // canonical casing
}

function validateAttributes(value, errors) {
  if (value === undefined || value === null) return {};
  if (!isPlainObject(value)) {
    errors.attributes = 'Attributes must be an object of key/value pairs.';
    return undefined;
  }
  const entries = Object.entries(value);
  if (entries.length > LIMITS.maxAttributes) {
    errors.attributes = `At most ${LIMITS.maxAttributes} attributes are allowed.`;
    return undefined;
  }
  const result = {};
  for (const [rawKey, rawValue] of entries) {
    const key = rawKey.trim();
    if (!key || key.length > LIMITS.attributeKeyMax) {
      errors.attributes = `Attribute names must be 1-${LIMITS.attributeKeyMax} characters.`;
      return undefined;
    }
    if (typeof rawValue === 'string') {
      const v = rawValue.trim();
      if (v.length > LIMITS.attributeValueMax) {
        errors.attributes = `Attribute "${key}" cannot exceed ${LIMITS.attributeValueMax} characters.`;
        return undefined;
      }
      result[key] = v;
    } else if (typeof rawValue === 'boolean' || (typeof rawValue === 'number' && Number.isFinite(rawValue))) {
      result[key] = rawValue;
    } else {
      errors.attributes = `Attribute "${key}" must be text, a number, or true/false.`;
      return undefined;
    }
  }
  return result;
}

function validateTags(value, errors) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    errors.tags = 'Tags must be a list.';
    return undefined;
  }
  if (value.length > LIMITS.maxTags) {
    errors.tags = `At most ${LIMITS.maxTags} tags are allowed.`;
    return undefined;
  }
  const seen = new Set();
  for (const tag of value) {
    if (typeof tag !== 'string') {
      errors.tags = 'Each tag must be text.';
      return undefined;
    }
    const cleaned = tag.trim().toLowerCase();
    if (!cleaned || cleaned.length > LIMITS.tagMax) {
      errors.tags = `Each tag must be 1-${LIMITS.tagMax} characters.`;
      return undefined;
    }
    seen.add(cleaned);
  }
  return [...seen];
}

/**
 * Deterministic listing validation. Runs BEFORE anything is stored or sent to AI.
 * @returns {{ valid: boolean, errors: Record<string,string>, value: object|null }}
 */
function validateListing(input) {
  if (!isPlainObject(input)) {
    return { valid: false, errors: { body: 'Request body must be a JSON object.' }, value: null };
  }
  const errors = {};
  const value = {
    title: validateText(input.title, 'title', LIMITS.titleMin, LIMITS.titleMax, errors),
    description: validateText(input.description, 'description', LIMITS.descriptionMin, LIMITS.descriptionMax, errors, {
      collapseWhitespace: false, // keep paragraph breaks
    }),
    category: validateCategory(input.category, errors),
    price: validatePrice(input.price, errors),
    seller: validateText(input.seller, 'seller', LIMITS.sellerMin, LIMITS.sellerMax, errors),
    attributes: validateAttributes(input.attributes, errors),
    tags: validateTags(input.tags, errors),
  };
  const valid = Object.keys(errors).length === 0;
  return { valid, errors, value: valid ? value : null };
}

module.exports = { validateListing, SUPPORTED_CATEGORIES, LIMITS };