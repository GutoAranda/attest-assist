import { supabase } from '@/integrations/supabase/client';

const APP_URL = window.location.origin;

const layout = (title: string, body: string) => `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;">
    <div style="background:#1E3A5F;padding:24px 32px;">
      <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:1px;">LOTS <span style="font-weight:300;font-size:14px;">DocFlow</span></h1>
    </div>
    <div style="padding:32px;">
      <h2 style="color:#1E3A5F;margin:0 0 20px;font-size:18px;">${title}</h2>
      ${body}
    </div>
    <div style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;">
      <p style="margin:0;color:#9ca3af;font-size:12px;">Este é um email automático do sistema LOTS DocFlow.</p>
    </div>
  </div>
</body>
</html>`;

const sendEmail = async (to: string | string[], subject: string, html: string) => {
  try {
    await supabase.functions.invoke('send-email', { body: { to, subject, html } });
  } catch (err) {
    console.error('Failed to send email:', err);
  }
};

const ticketLink = (ticketId: string, solId: string, role: 'juridico' | 'atendente') =>
  `${APP_URL}${role === 'juridico' ? `/solicitacoes/${solId}` : `/minhas-solicitacoes/${solId}`}`;

const linkButton = (url: string, text: string) =>
  `<a href="${url}" style="display:inline-block;background:#1E3A5F;color:#fff;padding:10px 24px;border-radius:6px;text-decoration:none;font-size:14px;margin-top:16px;">${text}</a>`;

const infoRow = (label: string, value: string) =>
  `<p style="margin:4px 0;font-size:14px;color:#374151;"><strong>${label}:</strong> ${value}</p>`;

export const sendNewSolicitationEmail = async (
  areaId: string,
  areaName: string,
  operationId: string,
  solId: string,
  ticketId: string,
  operationName: string,
  employeeName: string,
  employeeRegistration: string,
  processNumber: string,
  deadline: string,
  observations: string,
  areaDocs: { name: string }[]
) => {
  const { data: assignments } = await supabase
    .from('user_group_assignments')
    .select('user_id')
    .eq('area_id', areaId)
    .eq('operation_id', operationId);

  if (!assignments?.length) return;

  const userIds = [...new Set(assignments.map(a => a.user_id))];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('email')
    .in('id', userIds);

  if (!profiles?.length) return;

  const emails = profiles.map(p => p.email);
  const docList = areaDocs.map((d, i) => `${i + 1}. ${d.name}`).join('<br/>');

  const body = `
    ${infoRow('Operação', operationName)}
    ${infoRow('Funcionário', employeeName)}
    ${employeeRegistration ? infoRow('Matrícula', employeeRegistration) : ''}
    ${processNumber ? infoRow('Nº Processo', processNumber) : ''}
    ${deadline ? infoRow('Prazo fatal', new Date(deadline + 'T00:00:00').toLocaleDateString('pt-BR')) : ''}
    ${observations ? `<div style="background:#fefce8;border-left:4px solid #eab308;padding:12px;margin:12px 0;border-radius:4px;font-size:14px;"><strong>Observações:</strong> ${observations}</div>` : ''}
    <div style="margin-top:16px;">
      <p style="font-size:14px;font-weight:600;color:#1E3A5F;">Documentos solicitados para sua área (${areaName}):</p>
      <p style="font-size:14px;color:#374151;">${docList}</p>
    </div>
    ${linkButton(ticketLink(ticketId, solId, 'atendente'), 'Abrir solicitação')}
  `;

  await sendEmail(emails, `Nova solicitação ${ticketId}`, layout(`Nova solicitação ${ticketId}`, body));
};

export const sendConclusionEmail = async (
  requesterEmail: string,
  solId: string,
  ticketId: string,
  documents: { document_name: string; status: string }[]
) => {
  const docList = documents.map(d => {
    const statusLabel = d.status === 'enviado' ? '✅ Enviado' : d.status === 'inexistente' ? '❌ Inexistente' : d.status;
    return `<li style="margin:4px 0;">${d.document_name} — ${statusLabel}</li>`;
  }).join('');

  const body = `
    <p style="font-size:14px;color:#374151;">Todos os documentos foram processados.</p>
    <ul style="padding-left:20px;font-size:14px;color:#374151;">${docList}</ul>
    ${linkButton(ticketLink(ticketId, solId, 'juridico'), 'Ver solicitação')}
  `;

  await sendEmail(requesterEmail, `Solicitação ${ticketId} concluída`, layout(`Solicitação ${ticketId} concluída`, body));
};

export const sendRevisionEmail = async (
  areaId: string,
  operationId: string,
  solId: string,
  ticketId: string,
  docName: string,
  reason: string,
  operationName: string,
  employeeName: string
) => {
  const { data: assignments } = await supabase
    .from('user_group_assignments')
    .select('user_id')
    .eq('area_id', areaId)
    .eq('operation_id', operationId);

  if (!assignments?.length) return;

  const userIds = [...new Set(assignments.map(a => a.user_id))];
  const { data: profiles } = await supabase.from('profiles').select('email').in('id', userIds);
  if (!profiles?.length) return;

  const body = `
    ${infoRow('Operação', operationName)}
    ${infoRow('Funcionário', employeeName)}
    ${infoRow('Documento devolvido', docName)}
    <div style="background:#fff7ed;border-left:4px solid #f97316;padding:12px;margin:12px 0;border-radius:4px;font-size:14px;">
      <strong>Motivo da devolutiva:</strong> ${reason}
    </div>
    ${linkButton(ticketLink(ticketId, solId, 'atendente'), 'Abrir solicitação')}
  `;

  await sendEmail(profiles.map(p => p.email), `Revisão solicitada no ticket ${ticketId}`, layout(`Revisão solicitada no ticket ${ticketId}`, body));
};

export const sendCommentEmail = async (
  recipientEmail: string,
  solId: string,
  ticketId: string,
  commentText: string,
  authorName: string,
  recipientRole: 'juridico' | 'atendente'
) => {
  const body = `
    <p style="font-size:14px;color:#374151;"><strong>${authorName}</strong> comentou:</p>
    <div style="background:#f3f4f6;padding:12px;border-radius:6px;margin:12px 0;font-size:14px;color:#374151;">${commentText}</div>
    ${linkButton(ticketLink(ticketId, solId, recipientRole), 'Abrir solicitação')}
  `;

  await sendEmail(recipientEmail, `Novo comentário no ticket ${ticketId}`, layout(`Novo comentário no ticket ${ticketId}`, body));
};

export const sendCancelEmail = async (
  emails: string[],
  solId: string,
  ticketId: string,
  cancelReason: string,
  operationName: string,
  employeeName: string
) => {
  const body = `
    ${infoRow('Operação', operationName)}
    ${infoRow('Funcionário', employeeName)}
    <div style="background:#fef2f2;border-left:4px solid #ef4444;padding:12px;margin:12px 0;border-radius:4px;font-size:14px;">
      <strong>Motivo do cancelamento:</strong> ${cancelReason}
    </div>
  `;

  await sendEmail(emails, `Solicitação ${ticketId} cancelada`, layout(`Solicitação ${ticketId} cancelada`, body));
};

export const sendReopenEmail = async (
  areaId: string,
  operationId: string,
  solId: string,
  ticketId: string,
  reason: string,
  operationName: string,
  employeeName: string,
  areaDocs: { document_name: string }[]
) => {
  const { data: assignments } = await supabase
    .from('user_group_assignments')
    .select('user_id')
    .eq('area_id', areaId)
    .eq('operation_id', operationId);

  if (!assignments?.length) return;
  const userIds = [...new Set(assignments.map(a => a.user_id))];
  const { data: profiles } = await supabase.from('profiles').select('email').in('id', userIds);
  if (!profiles?.length) return;

  const docList = areaDocs.map((d, i) => `${i + 1}. ${d.document_name}`).join('<br/>');

  const body = `
    ${infoRow('Operação', operationName)}
    ${infoRow('Funcionário', employeeName)}
    <div style="background:#fefce8;border-left:4px solid #eab308;padding:12px;margin:12px 0;border-radius:4px;font-size:14px;">
      <strong>Motivo da reabertura:</strong> ${reason}
    </div>
    <div style="margin-top:16px;">
      <p style="font-size:14px;font-weight:600;color:#1E3A5F;">Documentos da sua área:</p>
      <p style="font-size:14px;color:#374151;">${docList}</p>
    </div>
    ${linkButton(ticketLink(ticketId, solId, 'atendente'), 'Abrir solicitação')}
  `;

  await sendEmail(profiles.map(p => p.email), `Solicitação ${ticketId} reaberta`, layout(`Solicitação ${ticketId} reaberta`, body));
};

export const getAttendeesEmails = async (areaIds: string[], operationId: string): Promise<string[]> => {
  const { data: assignments } = await supabase
    .from('user_group_assignments')
    .select('user_id')
    .in('area_id', areaIds)
    .eq('operation_id', operationId);

  if (!assignments?.length) return [];
  const userIds = [...new Set(assignments.map(a => a.user_id))];
  const { data: profiles } = await supabase.from('profiles').select('email').in('id', userIds);
  return profiles?.map(p => p.email) || [];
};
