export const CATEGORIES = ['Electronics', 'Home', 'Apparel', 'Services', 'Automotive'];

export const FIELD_ORDER = ['title', 'description', 'category', 'price', 'attributes', 'tags'];

export const FIELD_LABELS = {
  title: 'Title',
  description: 'Description',
  category: 'Category',
  price: 'Price',
  attributes: 'Attributes',
  tags: 'Tags',
};

export const ISSUE_LABELS = {
  UNCLEAR: 'Unclear',
  MISLEADING: 'Misleading',
  PROHIBITED: 'Prohibited',
  INCOMPLETE: 'Incomplete',
  UNVERIFIABLE_CLAIM: 'Unverifiable claim',
  ASSUMPTION: 'Assumption',
};

export const PLACEHOLDER_PATTERN = /\[[^\]\n]{1,60}\]/;

export function formatPrice(price) {
  return `₹${Number(price).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export function formatDate(value) {
  return value ? new Date(value).toLocaleString() : '';
}