import { supabase } from '@/integrations/supabase/client';

interface StorageReference {
  bucket: string;
  path: string;
}

const parseStorageReference = (fileUrl: string): StorageReference | null => {
  if (!fileUrl) return null;

  if (!fileUrl.startsWith('http')) {
    const [bucket, ...pathParts] = fileUrl.replace(/^\/+/, '').split('/');
    if (!bucket || pathParts.length === 0) return null;

    return {
      bucket,
      path: decodeURIComponent(pathParts.join('/')),
    };
  }

  try {
    const url = new URL(fileUrl);
    const segments = url.pathname.split('/').filter(Boolean);
    const objectIndex = segments.indexOf('object');
    if (objectIndex === -1) return null;

    let bucketIndex = objectIndex + 1;
    if (segments[bucketIndex] === 'public' || segments[bucketIndex] === 'sign') {
      bucketIndex += 1;
    }

    const bucket = segments[bucketIndex];
    const pathSegments = segments.slice(bucketIndex + 1);
    if (!bucket || pathSegments.length === 0) return null;

    return {
      bucket,
      path: decodeURIComponent(pathSegments.join('/')),
    };
  } catch {
    return null;
  }
};

const openResolvedUrl = (popup: Window | null, url: string) => {
  if (popup) {
    popup.location.href = url;
    return;
  }

  window.open(url, '_blank', 'noopener,noreferrer');
};

export const buildStoragePublicUrl = (bucket: string, path: string) => {
  const normalizedPath = path.replace(/^\/+/, '');
  return supabase.storage.from(bucket).getPublicUrl(normalizedPath).data.publicUrl;
};

export const openStorageFile = async (fileUrl: string) => {
  const popup = window.open('', '_blank', 'noopener,noreferrer');
  const reference = parseStorageReference(fileUrl);

  try {
    if (reference) {
      const { data } = await supabase.storage.from(reference.bucket).createSignedUrl(reference.path, 3600);
      if (data?.signedUrl) {
        openResolvedUrl(popup, data.signedUrl);
        return;
      }

      const publicUrl = buildStoragePublicUrl(reference.bucket, reference.path);
      if (publicUrl) {
        openResolvedUrl(popup, publicUrl);
        return;
      }
    }

    if (fileUrl) {
      openResolvedUrl(popup, fileUrl);
      return;
    }
  } catch {
    if (fileUrl) {
      openResolvedUrl(popup, fileUrl);
      return;
    }
  }

  popup?.close();
  throw new Error('Não foi possível abrir o arquivo.');
};