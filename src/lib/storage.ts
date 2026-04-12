import { supabase } from '@/integrations/supabase/client';

export const buildStoragePublicUrl = (bucket: string, path: string) => {
  const normalizedPath = path.replace(/^\/+/, '');
  return supabase.storage.from(bucket).getPublicUrl(normalizedPath).data.publicUrl;
};

export const openStorageFile = (fileUrl: string) => {
  if (!fileUrl) return;

  // If already a public URL, use directly
  const url = fileUrl.includes('/storage/v1/object/public/')
    ? fileUrl
    : fileUrl.replace('/object/sign/', '/object/public/').split('?')[0];

  window.open(url, '_blank', 'noopener,noreferrer');
};