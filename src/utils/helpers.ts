const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(str: string | string[] | undefined): boolean {
  if (!str || typeof str !== 'string') return false;
  return UUID_REGEX.test(str);
}

export function generateSlug(title: string): string {
  const base = title
    .trim()
    .toLowerCase()
    .replace(/[^\w\u0980-\u09FF\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '');
  
  const randomHash = Math.random().toString(36).substring(2, 8);
  const cleanBase = base || 'item';
  return `${cleanBase}-${randomHash}`;
}
