// Action buttons for ticket detail header: PDF (juridico only), Calendar (.ics).
import { Button } from '@/components/ui/button';
import { Calendar, FileDown } from 'lucide-react';
import { downloadIcs } from '@/lib/ics';
import { toast } from 'sonner';

interface Props {
  ticketId: string;
  ticketUuid: string;
  employeeName?: string | null;
  operationName?: string | null;
  deadline?: string | null;
  observations?: string | null;
  status: string;
  documents: any[];
  comments: any[];
  auditLogs: any[];
  /** If true, hide the PDF export button (for atendente). */
  hidePdf?: boolean;
}

export const TicketActions = ({
  ticketId, ticketUuid, employeeName, operationName, deadline, observations,
  status, documents, comments, auditLogs, hidePdf,
}: Props) => {
  const handleIcs = () => {
    if (!deadline) return;
    downloadIcs({
      uid: ticketUuid,
      title: `Prazo: ${ticketId} — ${employeeName || ''}`,
      description: `Operação: ${operationName || ''}\nFuncionário: ${employeeName || ''}\nObservações: ${observations || '—'}`,
      date: deadline,
    });
  };

  const handlePdf = async () => {
    const toastId = toast.loading('Gerando PDF...');
    try {
      // LAZY LOAD: jsPDF and autoTable only when user clicks PDF button
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');

      const doc = new jsPDF();
      let y = 14;
      doc.setFontSize(16);
      doc.text(`Solicitação ${ticketId}`, 14, y); y += 8;
      doc.setFontSize(10);
      doc.text(`Operação: ${operationName || '—'}`, 14, y); y += 5;
      doc.text(`Funcionário: ${employeeName || '—'}`, 14, y); y += 5;
      doc.text(`Status: ${status}`, 14, y); y += 5;
      if (deadline) { doc.text(`Prazo: ${new Date(deadline + 'T00:00:00').toLocaleDateString('pt-BR')}`, 14, y); y += 5; }
      if (observations) { doc.text(`Observações: ${observations.slice(0, 200)}`, 14, y); y += 8; }

      autoTable(doc, {
        startY: y + 2,
        head: [['Documento', 'Área', 'Status']],
        body: documents.map((d: any) => [d.document_name, (d.areas as any)?.name || '', d.status]),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [30, 58, 95] },
      });

      let afterY = (doc as any).lastAutoTable.finalY + 8;
      if (comments.length) {
        doc.setFontSize(12); doc.text('Comentários', 14, afterY); afterY += 4;
        autoTable(doc, {
          startY: afterY,
          head: [['Data', 'Autor', 'Mensagem']],
          body: comments.map((c: any) => [
            new Date(c.created_at).toLocaleString('pt-BR'),
            (c.profiles as any)?.name || '',
            c.message,
          ]),
          styles: { fontSize: 8, cellWidth: 'wrap' },
          columnStyles: { 2: { cellWidth: 100 } },
          headStyles: { fillColor: [30, 58, 95] },
        });
        afterY = (doc as any).lastAutoTable.finalY + 8;
      }

      if (auditLogs.length) {
        doc.setFontSize(12); doc.text('Histórico', 14, afterY); afterY += 4;
        autoTable(doc, {
          startY: afterY,
          head: [['Data', 'Ação', 'Detalhes', 'Por']],
          body: auditLogs.map((l: any) => [
            new Date(l.created_at).toLocaleString('pt-BR'),
            l.action,
            (l.details || '').slice(0, 80),
            (l.profiles as any)?.name || '',
          ]),
          styles: { fontSize: 8 },
          headStyles: { fillColor: [30, 58, 95] },
        });
      }

      doc.save(`${ticketId}.pdf`);
      toast.dismiss(toastId);
      toast.success('PDF gerado com sucesso!');
    } catch (err) {
      toast.dismiss(toastId);
      toast.error('Erro ao gerar PDF: ' + (err as any).message);
    }
  };

  return (
    <>
      {deadline && (
        <Button variant="outline" size="sm" onClick={handleIcs} className="no-print">
          <Calendar className="h-4 w-4 mr-1" /> Calendário
        </Button>
      )}
      {!hidePdf && (
        <Button variant="outline" size="sm" onClick={handlePdf} className="no-print">
          <FileDown className="h-4 w-4 mr-1" /> PDF
        </Button>
      )}
    </>
  );
};
