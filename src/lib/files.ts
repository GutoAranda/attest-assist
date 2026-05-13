// File utilities: size validation, name sanitization, extension extraction.
export const MAX_FILE_BYTES = 250 * 1024 * 1024; // 250MB
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2MB

export const sanitizeFileName = (name: string): string => {
  return name
    .replace(/[\/\\:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
};

export const getFileExtFromUrl = (url: string): string => {
  if (!url) return '';
  const clean = url.split('?')[0];
  const match = clean.match(/\.([A-Za-z0-9]+)$/);
  return match ? `.${match[1]}` : '';
};

export const getFileExtFromName = (name: string): string => {
  const m = name.match(/\.([A-Za-z0-9]+)$/);
  return m ? `.${m[1]}` : '';
};

/**
 * Adds (2), (3)... suffix when name is duplicated. Mutates `seen` set.
 */
export const dedupeName = (name: string, seen: Set<string>): string => {
  if (!seen.has(name)) {
    seen.add(name);
    return name;
  }
  const lastDot = name.lastIndexOf('.');
  const base = lastDot > 0 ? name.slice(0, lastDot) : name;
  const ext = lastDot > 0 ? name.slice(lastDot) : '';
  let i = 2;
  while (seen.has(`${base} (${i})${ext}`)) i++;
  const out = `${base} (${i})${ext}`;
  seen.add(out);
  return out;
};

/**
 * Validates a list of files against max size; returns { ok, rejected }.
 * Caller should toast.error for each rejected name.
 */
export const validateFileSize = (file: File, maxBytes = MAX_FILE_BYTES): boolean => {
  return file.size <= maxBytes;
};
