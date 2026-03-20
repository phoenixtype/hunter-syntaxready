import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { corsHeaders, handleCorsPrelight, jsonWithCors, errorWithCors } from '../_shared/cors.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method === 'GET') return jsonWithCors({ status: 'healthy' });

  try {
    const { fullName, email, companyName, companyWebsite, jobTitle, companySize, useCase } = await req.json();

    // Basic validation
    if (!fullName?.trim() || !email?.trim() || !companyName?.trim() || !jobTitle?.trim()) {
      return new Response(JSON.stringify({ error: 'Full name, email, company, and job title are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(email)) {
      return new Response(JSON.stringify({ error: 'Invalid email address' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Check for duplicate application
    const { data: existing } = await supabase
      .from('recruiter_applications')
      .select('id, status')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle();

    if (existing) {
      const msg = existing.status === 'approved'
        ? 'This email already has an approved recruiter account.'
        : 'An application for this email is already under review.';
      return new Response(JSON.stringify({ error: msg }), {
        status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Insert application
    const { data: application, error: insertError } = await supabase
      .from('recruiter_applications')
      .insert({
        full_name: fullName.trim(),
        email: email.toLowerCase().trim(),
        company_name: companyName.trim(),
        company_website: companyWebsite?.trim() || null,
        job_title: jobTitle.trim(),
        company_size: companySize || null,
        use_case: useCase?.trim() || null,
      })
      .select('id')
      .single();

    if (insertError) throw insertError;

    // Send confirmation email via shared Resend module
    const { sendEmail, recruiterApplicationReceivedEmail } = await import('../_shared/resend.ts');
    const html = recruiterApplicationReceivedEmail({ fullName: fullName.trim(), companyName: companyName.trim() });

    const emailResult = await sendEmail({
      to: email.toLowerCase().trim(),
      subject: "We've received your Hunter recruiter application",
      html,
    });

    if (!emailResult.ok) {
      console.warn('[RECRUITER-APPLY] Confirmation email failed (non-fatal):', emailResult.error);
    }

    // Also notify admin (configurable via ADMIN_NOTIFICATION_EMAIL secret)
    const adminEmail = Deno.env.get('ADMIN_NOTIFICATION_EMAIL') || 'samuelakuma130@gmail.com';
    await sendEmail({
      to: adminEmail,
      subject: `New recruiter application — ${companyName} (${fullName})`,
      html: `<p>New recruiter application received.</p>
             <ul>
               <li><strong>Name:</strong> ${fullName}</li>
               <li><strong>Email:</strong> ${email}</li>
               <li><strong>Company:</strong> ${companyName}</li>
               <li><strong>Title:</strong> ${jobTitle}</li>
               <li><strong>Size:</strong> ${companySize || 'Not specified'}</li>
               <li><strong>Use case:</strong> ${useCase || 'Not provided'}</li>
             </ul>
             <p><a href="https://usehunter.app/admin/recruiter-applications">Review in admin dashboard →</a></p>`,
    });

    return new Response(JSON.stringify({ success: true, id: application.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[RECRUITER-APPLY] Error:', error);
    return new Response(JSON.stringify({ error: 'Something went wrong. Please try again.' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
