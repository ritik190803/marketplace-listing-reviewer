import { useState } from 'react';
import { listingsApi, errorInfo } from '../api';
import { CATEGORIES } from '../constants';

const EMPTY_FORM = { title: '', description: '', category: '', price: '', seller: '', attributes: '', tags: '' };

// "brand: SoundMax" per line -> { brand: "SoundMax" }
function parseAttributes(text) {
  const attributes = {};
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const colon = line.indexOf(':');
    if (colon <= 0) return { error: `"${line}" must use the format key: value` };
    attributes[line.slice(0, colon).trim()] = line.slice(colon + 1).trim();
  }
  return { attributes };
}

function Field({ id, label, error, hint, children }) {
  return (
    <div className={error ? 'field has-error' : 'field'}>
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && !error && <div className="muted small">{hint}</div>}
      {error && (
        <div className="field-error" id={`${id}-error`}>
          {error}
        </div>
      )}
    </div>
  );
}

export default function CreateListingForm({ onCreated, onCancel }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  const inputProps = (field) => ({
    id: field,
    value: form[field],
    onChange: update(field),
    'aria-invalid': Boolean(errors[field]),
    'aria-describedby': errors[field] ? `${field}-error` : undefined,
  });

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    setErrors({});
    setFormError(null);

    const { attributes, error } = parseAttributes(form.attributes);
    if (error) {
      setErrors({ attributes: error });
      return;
    }
    const tags = form.tags.split(',').map((t) => t.trim()).filter(Boolean);

    setSubmitting(true);
    try {
      const listing = await listingsApi.create({
        title: form.title,
        description: form.description,
        category: form.category,
        price: form.price,
        seller: form.seller,
        attributes,
        tags,
      });
      onCreated(listing);
    } catch (err) {
      const info = errorInfo(err);
      if (info.details && typeof info.details === 'object') setErrors(info.details);
      setFormError(info.code === 'VALIDATION_FAILED' ? 'Please fix the highlighted fields.' : info.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="card">
      <h2>New listing</h2>
      <p className="muted small">Listings are checked by deterministic validation before they enter the review queue.</p>

      {formError && (
        <div className="alert error" role="alert">
          {formError}
          {errors.body && <div>{errors.body}</div>}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <Field id="title" label="Title" error={errors.title} hint="5–100 characters">
          <input {...inputProps('title')} maxLength={120} />
        </Field>
        <Field id="description" label="Description" error={errors.description} hint="At least 20 characters">
          <textarea {...inputProps('description')} rows={4} />
        </Field>
        <div className="grid-2">
          <Field id="category" label="Category" error={errors.category}>
            <select {...inputProps('category')}>
              <option value="">Select a category</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field id="price" label="Price (₹)" error={errors.price} hint="e.g. 499 or 499.99">
            <input {...inputProps('price')} inputMode="decimal" />
          </Field>
        </div>
        <Field id="seller" label="Seller" error={errors.seller}>
          <input {...inputProps('seller')} />
        </Field>
        <Field id="attributes" label="Attributes (optional)" error={errors.attributes} hint="One per line, e.g. brand: SoundMax">
          <textarea {...inputProps('attributes')} rows={3} />
        </Field>
        <Field id="tags" label="Tags (optional)" error={errors.tags} hint="Comma separated, e.g. earbuds, wireless">
          <input {...inputProps('tags')} />
        </Field>

        <div className="actions">
          <button type="submit" className="primary" disabled={submitting}>
            {submitting ? 'Saving…' : 'Create listing'}
          </button>
          <button type="button" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}