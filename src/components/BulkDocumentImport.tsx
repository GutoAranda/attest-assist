import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { FileText } from 'lucide-react';

interface Area {
  id: string;
  name: string;
}

interface DocumentRow {
  name: string;
  area_id: string;
}

interface BulkDocumentImportProps {
  areas: Area[];
  onImport: (docs: DocumentRow[]) => void;
}

const BulkDocumentImport = ({ areas, onImport }: BulkDocumentImportProps) => {
  const [bulkText, setBulkText] = useState('');

  const handleImport = () => {
    if (!bulkText.trim()) {
      toast.error('Cole a lista de documentos antes de importar');
      return;
    }

    const lines = bulkText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    let currentAreaId: string | null = null;
    const newDocs: DocumentRow[] = [];
    let errors = 0;

    for (const line of lines) {
      // Check if line matches an area name (case-insensitive)
      const matchedArea = areas.find(
        a => a.name.toLowerCase() === line.toLowerCase()
      );

      if (matchedArea) {
        currentAreaId = matchedArea.id;
        continue;
      }

      // It's a document name
      if (!currentAreaId) {
        toast.error(`Defina uma área antes dos documentos (ex: ${areas.map(a => a.name).join(' ou ')}). Linha: "${line}"`);
        errors++;
        break;
      }

      newDocs.push({ name: line, area_id: currentAreaId });
    }

    if (errors > 0) return;

    if (newDocs.length === 0) {
      toast.error('Nenhum documento encontrado na lista. Verifique o formato.');
      return;
    }

    onImport(newDocs);
    setBulkText('');
    toast.success(`${newDocs.length} documento(s) importado(s) com sucesso!`);
  };

  return (
    <div className="bg-secondary rounded-lg p-4 mb-6 border border-border">
      <div className="flex items-center gap-2 mb-1">
        <FileText className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold text-primary">Importar em lote</span>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Cole uma lista de documentos agrupados por área
      </p>
      <div className="flex gap-3">
        <Textarea
          value={bulkText}
          onChange={(e) => setBulkText(e.target.value)}
          rows={8}
          className="flex-1 bg-white"
          placeholder={`Cole a lista aqui. Use o nome da área como separador:\n\nSSMA\nRelatório de segurança\nASO dos funcionários\nFicha de EPI\n\nP&C\nContrato de trabalho\nHolerites nov-dez/2025\nTermo de rescisão`}
        />
        <Button
          onClick={handleImport}
          className="self-start bg-primary hover:bg-primary/90 text-primary-foreground"
          disabled={!bulkText.trim()}
        >
          Importar lista
        </Button>
      </div>
    </div>
  );
};

export default BulkDocumentImport;
