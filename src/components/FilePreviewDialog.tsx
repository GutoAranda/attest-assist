import { useMemo, useState, ReactNode } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Eye, Download } from 'lucide-react';
import { openStorageFile } from '@/lib/storage';

const getPublicUrl = (fileUrl: string) =>
  fileUrl.includes('/storage/v1/object/public/')
    ? fileUrl
    : fileUrl.replace('/object/sign/', '/object/public/').split('?')[0];

const getExt = (name: string) => {
  const m = name.toLowerCase().match(/\.([a-z0-9]+)(?:\?|$)/);
  return m ? m[1] : '';
};

const isImage = (ext: string) => ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext);
const isPdf = (ext: string) => ext === 'pdf';

const triggerDownload = (fileUrl: string, fileName: string) => {
  const url = getPublicUrl(fileUrl);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName || '';
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

interface FilePreviewDialogProps {
  fileUrl: string;
  fileName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FilePreviewDialog({ fileUrl, fileName, open, onOpenChange }: FilePreviewDialogProps) {
  const publicUrl = useMemo(() => getPublicUrl(fileUrl), [fileUrl]);
  const ext = getExt(fileName || fileUrl);
  const pdf = isPdf(ext);
  const img = isImage(ext);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[95vw] h-[92vh] p-0 flex flex-col gap-0">
        <DialogHeader className="px-4 py-3 border-b flex-row items-center justify-between space-y-0">
          <DialogTitle className="truncate pr-8 text-base">{fileName}</DialogTitle>
          <div className="flex items-center gap-2 mr-6">
            <Button size="sm" variant="outline" onClick={() => triggerDownload(fileUrl, fileName)}>
              <Download className="h-4 w-4 mr-1" /> Baixar
            </Button>
          </div>
        </DialogHeader>
        <div className="flex-1 overflow-auto bg-muted/30 flex items-center justify-center">
          {pdf && (
            <iframe src={publicUrl} title={fileName} className="w-full h-full border-0 bg-background" />
          )}
          {img && (
            <img src={publicUrl} alt={fileName} className="max-w-full max-h-full object-contain" />
          )}
          {!pdf && !img && (
            <div className="text-center p-8 text-muted-foreground">
              <p className="mb-4">Pré-visualização indisponível para este tipo de arquivo.</p>
              <Button onClick={() => triggerDownload(fileUrl, fileName)}>
                <Download className="h-4 w-4 mr-1" /> Baixar arquivo
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface AttachmentActionsProps {
  fileUrl: string;
  fileName: string;
  size?: 'sm' | 'default';
  className?: string;
  compact?: boolean;
}

/** Pair of buttons: Visualizar + Baixar. For non-previewable files, "Visualizar" falls back to opening in new tab. */
export function AttachmentActions({ fileUrl, fileName, size = 'sm', className, compact }: AttachmentActionsProps) {
  const [open, setOpen] = useState(false);
  const ext = getExt(fileName || fileUrl);
  const previewable = isPdf(ext) || isImage(ext);

  const handleView = () => {
    if (previewable) setOpen(true);
    else openStorageFile(fileUrl);
  };

  const iconSize = compact ? 'h-3 w-3' : 'h-4 w-4';
  const textSize = compact ? 'text-xs' : '';

  return (
    <>
      <div className={`inline-flex items-center gap-1 ${className ?? ''}`}>
        <Button variant="ghost" size={size} onClick={handleView} className={textSize}>
          <Eye className={`${iconSize} mr-1`} /> Visualizar
        </Button>
        <Button variant="ghost" size={size} onClick={() => triggerDownload(fileUrl, fileName)} className={textSize}>
          <Download className={`${iconSize} mr-1`} /> Baixar
        </Button>
      </div>
      {previewable && (
        <FilePreviewDialog fileUrl={fileUrl} fileName={fileName} open={open} onOpenChange={setOpen} />
      )}
    </>
  );
}
