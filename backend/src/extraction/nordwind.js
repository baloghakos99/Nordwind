/** Our company – used for direction detection. */
export const NORDWIND = {
  nameHints: [
    'nordwind solutions kft',
    'nordwind solutions',
    'nordwind',
  ],
  taxId: '26481937-2-43',
  taxIdDigits: '26481937',
  euVat: 'HU26481937',
};

export function normalizeTaxId(raw) {
  if (!raw) return null;
  return String(raw).replace(/[\s.]/g, '').toUpperCase();
}

export function isNordwindTaxId(raw) {
  const n = normalizeTaxId(raw);
  if (!n) return false;
  const digits = n.replace(/\D/g, '');
  return (
    n === normalizeTaxId(NORDWIND.taxId)
    || n === NORDWIND.euVat
    || digits === NORDWIND.taxIdDigits
    || digits.endsWith(NORDWIND.taxIdDigits)
  );
}

export function isNordwindName(name) {
  if (!name) return false;
  const n = name.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
  return NORDWIND.nameHints.some((h) => n.includes(h));
}
