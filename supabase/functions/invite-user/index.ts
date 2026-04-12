const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}


import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { name, email, role, is_admin } = await req.json();
    if (!name || !email || !role) {
      return new Response(JSON.stringify({ error: 'Missing name, email, or role' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Generate a random temporary password
    const tempPassword = crypto.randomUUID().slice(0, 16) + 'A1!';

    const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { name, role, is_admin: is_admin || false },
    });

    if (createError) {
      console.error('Create user error:', createError);
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Wait briefly for the trigger to create the profile
    await new Promise(r => setTimeout(r, 1000));

    // Get the profile id created by the trigger
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('user_id', userData.user.id)
      .single();

    // Send password reset email so the user can set their own password
    await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email,
    });

    return new Response(JSON.stringify({
      success: true,
      user_id: userData.user.id,
      profile_id: profile?.id,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('Invite error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
