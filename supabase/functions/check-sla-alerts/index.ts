import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = today.toISOString().split('T')[0]

    // Get open solicitations with deadlines
    const { data: solicitations } = await supabase
      .from('solicitations')
      .select('id, ticket_id, deadline, operation_id, documents(responsible_area_id)')
      .in('status', ['aberto', 'em_atendimento', 'parcialmente_concluido'])
      .not('deadline', 'is', null)

    if (!solicitations || solicitations.length === 0) {
      return new Response(JSON.stringify({ message: 'No solicitations to check' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let notificationsCreated = 0

    for (const sol of solicitations) {
      const deadline = new Date(sol.deadline + 'T00:00:00')
      const diffDays = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

      let type: string | null = null
      let targetRole: 'atendente' | 'juridico' = 'atendente'

      if (diffDays === 7) type = 'sla_7dias'
      else if (diffDays === 3) type = 'sla_3dias'
      else if (diffDays === 1) type = 'sla_1dia'
      else if (diffDays === 0) type = 'sla_hoje'
      else if (diffDays < 0) {
        type = 'sla_vencido'
        targetRole = 'juridico'
      }

      if (!type) continue

      // Check for duplicate notification today
      const { data: existing } = await supabase
        .from('notifications')
        .select('id')
        .eq('solicitation_id', sol.id)
        .eq('type', type)
        .gte('created_at', todayStr + 'T00:00:00')
        .lte('created_at', todayStr + 'T23:59:59')
        .limit(1)

      if (existing && existing.length > 0) continue

      const messages: Record<string, string> = {
        sla_7dias: `⚠️ Prazo de ${sol.ticket_id} vence em 7 dias`,
        sla_3dias: `⚠️ Prazo de ${sol.ticket_id} vence em 3 dias`,
        sla_1dia: `🔴 Prazo de ${sol.ticket_id} vence AMANHÃ`,
        sla_hoje: `🔴 Prazo de ${sol.ticket_id} vence HOJE`,
        sla_vencido: `🔴 Prazo de ${sol.ticket_id} está VENCIDO`,
      }

      if (targetRole === 'juridico') {
        // Notify all juridico users
        const { data: juridicos } = await supabase
          .from('profiles')
          .select('id')
          .eq('role', 'juridico')
          .eq('is_active', true)

        for (const j of juridicos || []) {
          await supabase.from('notifications').insert({
            user_id: j.id,
            type,
            message: messages[type],
            solicitation_id: sol.id,
          })
          notificationsCreated++
        }
      } else {
        // Notify relevant atendentes
        const areaIds = [...new Set((sol.documents || []).map((d: any) => d.responsible_area_id))]
        for (const areaId of areaIds) {
          const { data: assignments } = await supabase
            .from('user_group_assignments')
            .select('user_id')
            .eq('area_id', areaId)
            .eq('operation_id', sol.operation_id)

          const uniqueUsers = [...new Set((assignments || []).map(a => a.user_id))]
          for (const userId of uniqueUsers) {
            await supabase.from('notifications').insert({
              user_id: userId,
              type,
              message: messages[type],
              solicitation_id: sol.id,
            })
            notificationsCreated++
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ message: `SLA check complete. ${notificationsCreated} notifications created.` }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
