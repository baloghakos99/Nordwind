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
} as const;

export function normalizeTaxId(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return String(raw).replace(/[\s.]/g, '').toUpperCase();
}

export function isNordwindTaxId(raw: string | null | undefined): boolean {
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

export function isNordwindName(name: string | null | undefined): boolean {
  if (!name) return false;
  const n = name.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
  return NORDWIND.nameHints.some((h) => n.includes(h));
}
