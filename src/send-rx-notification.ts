// ════════════════════════════════════════════════════════════
//  supabase/functions/send-rx-notification/index.ts
//  Rx Vault — Prescription Expiry Email Notification
//  Email provider: Resend (https://resend.com)
// ════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const RESEND_API_KEY = 're_2inUWNnf_MQnTvwF6sTFh1G5YnBi78WKW'
const FROM_EMAIL     = 'rxvault@gordian1729.in'
const FROM_NAME      = 'Rx Vault'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req: Request) => {

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    const {
      to,
      patientName,
      subject,
      html,
      text,
      rxId,
      clinicName,
      daysLeft,
      validUntil,
      diagnosis,
      medicines,
      doctorName,
    } = await req.json()

    // Validate required fields
    if (!to || !patientName || !subject) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: to, patientName, subject' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      )
    }

    // Build email body if not provided by client
    const emailHtml = html || buildHtml(patientName, diagnosis, doctorName, validUntil, medicines, daysLeft, clinicName)
    const emailText = text || buildText(patientName, diagnosis, doctorName, validUntil, medicines, daysLeft, clinicName)

    // Send via Resend
    const resendResp = await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        from:    `${clinicName || FROM_NAME} <${FROM_EMAIL}>`,
        to:      [to],
        subject: subject,
        html:    emailHtml,
        text:    emailText,
        tags: [
          { name: 'type',      value: 'prescription-notification' },
          { name: 'days_left', value: String(daysLeft ?? 'unknown') },
          { name: 'rx_id',     value: String(rxId ?? '') },
        ],
      }),
    })

    const resendData = await resendResp.json()

    if (!resendResp.ok) {
      console.error('[send-rx-notification] Resend error:', JSON.stringify(resendData))
      return new Response(
        JSON.stringify({ error: resendData.message || 'Email send failed', details: resendData }),
        { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[send-rx-notification] ✅ Sent ${resendData.id} → ${to} | rx: ${rxId} | daysLeft: ${daysLeft}`)

    return new Response(
      JSON.stringify({ success: true, messageId: resendData.id }),
      { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('[send-rx-notification] Unexpected error:', err)
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )
  }
})

// ─── HTML email builder ───────────────────────────────────
function buildHtml(
  patientName: string,
  diagnosis: string,
  doctorName: string,
  validUntil: string,
  medicines: Array<{ name: string; dosage?: string; frequency?: string }>,
  daysLeft: number,
  clinicName: string,
): string {
  const urgencyColor = daysLeft < 0 ? '#dc2626' : daysLeft <= 1 ? '#d97706' : '#0a7c6e'
  const urgencyBg    = daysLeft < 0 ? '#fef2f2' : daysLeft <= 1 ? '#fffbeb' : '#e6f5f3'
  const expiryLabel  = daysLeft < 0
    ? `expired <strong>${Math.abs(daysLeft)} day${Math.abs(daysLeft) !== 1 ? 's' : ''} ago</strong>`
    : daysLeft === 0 ? '<strong>expires TODAY</strong>'
    : daysLeft === 1 ? 'expires <strong>tomorrow</strong>'
    : `expires in <strong>${daysLeft} days</strong>`

  const medsRows = (medicines || []).map(m =>
    `<tr>
      <td style="padding:6px 12px;border-bottom:1px solid #eee;font-weight:600">${esc(m.name)}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #eee">${esc(m.dosage || '—')}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #eee">${esc(m.frequency || '—')}</td>
    </tr>`
  ).join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Prescription Notification</title>
</head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:32px 16px">
      <table width="580" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);max-width:580px">

        <!-- Header -->
        <tr>
          <td style="background:${urgencyColor};padding:28px 32px">
            <div style="font-size:24px;margin-bottom:4px">💊</div>
            <div style="font-family:Georgia,serif;font-size:22px;font-weight:700;color:#fff">Prescription Notification</div>
            <div style="font-size:13px;color:rgba(255,255,255,0.85);margin-top:4px">${esc(clinicName)} · Rx Vault</div>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:28px 32px">
            <p style="font-size:16px;margin:0 0 20px;color:#1a1a2e">
              Dear <strong>${esc(patientName)}</strong>,
            </p>

            <!-- Alert box -->
            <div style="background:${urgencyBg};border-left:4px solid ${urgencyColor};padding:14px 18px;border-radius:8px;margin-bottom:24px;font-size:14px;color:#1a1a2e;line-height:1.6">
              ⚠️ Your prescription for <strong>${esc(diagnosis || 'your condition')}</strong> ${expiryLabel}.<br>
              Please visit your doctor or contact the clinic to renew your treatment.
            </div>

            <!-- Prescription details -->
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#8fa0b3;margin-bottom:10px">Prescription Details</div>
            <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13.5px;margin-bottom:24px">
              <tr>
                <td style="padding:5px 0;color:#8fa0b3;width:35%">Diagnosis</td>
                <td style="padding:5px 0;color:#1a1a2e">${esc(diagnosis || '—')}</td>
              </tr>
              <tr>
                <td style="padding:5px 0;color:#8fa0b3">Doctor</td>
                <td style="padding:5px 0;color:#1a1a2e">Dr. ${esc(doctorName || '—')}</td>
              </tr>
              <tr>
                <td style="padding:5px 0;color:#8fa0b3">Valid Until</td>
                <td style="padding:5px 0;color:${urgencyColor};font-weight:700">${esc(validUntil || '—')}</td>
              </tr>
            </table>

            ${medsRows ? `
            <!-- Medicines -->
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#8fa0b3;margin-bottom:10px">Prescribed Medicines</div>
            <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;border-collapse:collapse;margin-bottom:24px;background:#f7fafc;border-radius:8px;overflow:hidden">
              <thead>
                <tr style="background:#edf2f7">
                  <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;color:#8fa0b3">Medicine</th>
                  <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;color:#8fa0b3">Dosage</th>
                  <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;color:#8fa0b3">Frequency</th>
                </tr>
              </thead>
              <tbody>${medsRows}</tbody>
            </table>` : ''}

            <p style="font-size:13.5px;color:#4a6076;line-height:1.7;margin:0">
              To avoid any interruption in your treatment, please contact <strong>${esc(clinicName)}</strong> at your earliest convenience to schedule a renewal appointment.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f7fafc;padding:18px 32px;border-top:1px solid #e5e9ef">
            <div style="font-size:12px;color:#8fa0b3;line-height:1.6">
              <strong>${esc(clinicName)}</strong><br>
              This is an automated reminder from <strong>Rx Vault</strong> Medical Record Manager.<br>
              Please do not reply to this email.
            </div>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

// ─── Plain text email builder ─────────────────────────────
function buildText(
  patientName: string,
  diagnosis: string,
  doctorName: string,
  validUntil: string,
  medicines: Array<{ name: string; dosage?: string; frequency?: string }>,
  daysLeft: number,
  clinicName: string,
): string {
  const expiryLine = daysLeft < 0
    ? `EXPIRED ${Math.abs(daysLeft)} day(s) ago`
    : daysLeft === 0 ? 'EXPIRES TODAY'
    : daysLeft === 1 ? 'expires TOMORROW'
    : `expires in ${daysLeft} days`

  const medsList = (medicines || []).map(m =>
    `  • ${m.name}${m.dosage ? ' — ' + m.dosage : ''}${m.frequency ? ', ' + m.frequency : ''}`
  ).join('\n')

  return `Dear ${patientName},

This is an automated reminder from ${clinicName}.

⚠️  Your prescription ${expiryLine}.

PRESCRIPTION DETAILS
--------------------
Diagnosis  : ${diagnosis || '—'}
Doctor     : Dr. ${doctorName || '—'}
Valid Until: ${validUntil || '—'}
${medsList ? '\nPRESCRIBED MEDICINES\n--------------------\n' + medsList : ''}

Please contact ${clinicName} to renew your prescription and continue your treatment without interruption.

---
This is an automated message from Rx Vault Medical Record Manager.
Please do not reply to this email.`
}

// ─── HTML escape helper ───────────────────────────────────
function esc(str: string | undefined | null): string {
  if (!str) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}