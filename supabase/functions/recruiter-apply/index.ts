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
      .select('id, status, user_id')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle();

    if (existing) {
      if (existing.status === 'pending') {
        return new Response(JSON.stringify({ error: 'An application for this email is already under review.' }), {
          status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // For approved/rejected applications, check if the user account still exists
      // If the DB was cleared or the account was deleted, allow re-application
      if (existing.status === 'approved' && existing.user_id) {
        const { data: userExists } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', existing.user_id)
          .maybeSingle();

        if (userExists) {
          return new Response(JSON.stringify({ error: 'This email already has an approved recruiter account.' }), {
            status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      // Stale approved (no active user) or rejected — delete old record to allow re-application
      await supabase
        .from('recruiter_applications')
        .delete()
        .eq('id', existing.id);
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
