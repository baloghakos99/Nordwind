import { NORDWIND } from './nordwind.js';
import { parseAmount } from './parseAmount.js';
import { parseDate } from './parseDate.js';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

function getConfig() {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  const model = process.env.OPENROUTER_MODEL?.trim() || 'google/gemini-2.5-flash';
  return { apiKey, model, enabled: Boolean(apiKey) };
}

export function isLlmConfigured() {
  return getConfig().enabled;
}

const SYSTEM = `You extract invoice fields from plain text. Reply with ONE JSON object only (no markdown).
Our company (Nordwind Solutions Kft., tax 26481937-2-43 / HU26481937) decides direction:
- incoming = we are the buyer
- outgoing = we are the issuer
partner = the other party.
Dates must be YYYY-MM-DD. currency one of HUF,EUR,USD,GBP,PLN.
gross_amount is the payable GROSS total (not net, not VAT), as a number.
Keys: invoice_number, issuer_name, issuer_tax_id, buyer_name, buyer_tax_id,
issue_date, fulfillment_date, due_date, currency, gross_amount, direction,
partner_name, partner_tax_id. Use null if unknown.`;

function buildUserPrompt(text, partial, ruleErrors) {
  const clipped = text.length > 12000 ? `${text.slice(0, 12000)}\n…[truncated]` : text;
  return [
    'Invoice text:',
    clipped,
    '',
    'Rule-based partial result (may be wrong/incomplete):',
    JSON.stringify(partial ?? {}, null, 0),
    '',
    'Rule validation errors:',
    (ruleErrors || []).join('; ') || '(none)',
    '',
    'Return corrected JSON for all keys.',
  ].join('\n');
}

function stripFence(s) {
  const t = String(s || '').trim();
  const m = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (m ? m[1] : t).trim();
}

function normalizeLlmFields(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const gross = raw.gross_amount;
  let grossAmount = typeof gross === 'number' ? gross : parseAmount(String(gross ?? ''));
  const direction = raw.direction === 'bejövő' ? 'incoming'
    : raw.direction === 'kimenő' ? 'outgoing'
      : raw.direction;

  return {
    invoice_number: raw.invoice_number ? String(raw.invoice_number).trim() : null,
    issuer_name: raw.issuer_name ? String(raw.issuer_name).trim() : null,
    issuer_tax_id: raw.issuer_tax_id ? String(raw.issuer_tax_id).trim() : null,
    buyer_name: raw.buyer_name ? String(raw.buyer_name).trim() : null,
    buyer_tax_id: raw.buyer_tax_id ? String(raw.buyer_tax_id).trim() : null,
    issue_date: parseDate(raw.issue_date) || (typeof raw.issue_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.issue_date) ? raw.issue_date : null),
    fulfillment_date: parseDate(raw.fulfillment_date) || (typeof raw.fulfillment_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.fulfillment_date) ? raw.fulfillment_date : null),
    due_date: parseDate(raw.due_date) || (typeof raw.due_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.due_date) ? raw.due_date : null),
    currency: raw.currency ? String(raw.currency).trim().toUpperCase() : null,
    gross_amount: grossAmount,
    direction: direction === 'incoming' || direction === 'outgoing' ? direction : null,
    partner_name: raw.partner_name ? String(raw.partner_name).trim() : null,
    partner_tax_id: raw.partner_tax_id ? String(raw.partner_tax_id).trim() : null,
  };
}

/**
 * OpenRouter chat completion → normalized invoice fields.
 * Throws if not configured or API/parse fails.
 */
export async function extractInvoiceWithLlm(text, { partial = null, ruleErrors = [] } = {}) {
  const { apiKey, model, enabled } = getConfig();
  if (!enabled) {
    const err = new Error('OPENROUTER_API_KEY not set');
    err.code = 'LLM_DISABLED';
    throw err;
  }

  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://localhost/nordwind',
      'X-Title': 'Nordwind invoice extractor',
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: buildUserPrompt(text, partial, ruleErrors) },
      ],
      // Hint for models that support it; ignored otherwise
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`OpenRouter HTTP ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenRouter empty response');

  let parsed;
  try {
    parsed = JSON.parse(stripFence(content));
  } catch {
    throw new Error('OpenRouter response was not valid JSON');
  }

  const fields = normalizeLlmFields(parsed);
  if (!fields) throw new Error('OpenRouter returned empty fields');

  // Ensure partner if direction known
  if (!fields.partner_name && fields.direction === 'incoming') {
    fields.partner_name = fields.issuer_name;
    fields.partner_tax_id = fields.partner_tax_id || fields.issuer_tax_id;
  }
  if (!fields.partner_name && fields.direction === 'outgoing') {
    fields.partner_name = fields.buyer_name;
    fields.partner_tax_id = fields.partner_tax_id || fields.buyer_tax_id;
  }

  return { fields, model, nordwindHint: NORDWIND.euVat };
}
