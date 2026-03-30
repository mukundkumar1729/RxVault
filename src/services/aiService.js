import { db } from '../supabase.js';

/**
 * Unified AI call — routes through the Supabase Edge Function claude-proxy
 */
export const callClaude = async (opts) => {
    const { data, error } = await db.functions.invoke('claude-proxy', {
        body: {
            model: opts.model || 'claude-3-5-sonnet-20241022',
            max_tokens: opts.max_tokens || 1500,
            system: opts.system,
            messages: opts.messages,
        }
    });

    if (error) {
        let detail = error.message || 'Edge Function error';
        try {
            const ctx = await error.context?.json();
            if (ctx?.error) detail = ctx.error;
            else if (ctx?.message) detail = ctx.message;
        } catch (_) {}
        throw new Error(detail);
    }
    return data;
};

/**
 * Lab Report Interpretation
 */
export const interpretLabReport = async (reportText, reportType, patientName = '') => {
    const prompt = `You are a clinical lab report interpreter for an Indian medical clinic app called Rx Vault.
Report Type: ${reportType}
${patientName ? `Patient: ${patientName}` : ''}
Lab Values:
${reportText}

Provide a structured analysis in this format:
## Summary
## Abnormal Values
## Normal Values
## Clinical Interpretation
## Recommended Actions
## Important Notes
Use ✅ for normal, ⚠️ for mildly abnormal, 🔴 for significantly abnormal. Be concise.`;

    const data = await callClaude({
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }]
    });
    return (data.content || []).map(b => b.text || '').join('');
};

/**
 * Diet Plan Generation
 */
export const generateDietPlanService = async (params) => {
    const prompt = `You are a clinical nutritionist for an Indian medical clinic (Rx Vault). Create a 7-day diet plan.
Patient: ${params.patient} | Age: ${params.age} | Gender: ${params.gender} | Weight: ${params.weight}kg | Height: ${params.height}cm
Conditions: ${params.conditions} | Activity: ${params.activity} | Type: ${params.pref}
Allergies: ${params.allergies} | Goal: ${params.goal}

Format:
## Calorie Target
## Key Dietary Guidelines
## 7-Day Meal Plan
## Foods to Include
## Foods to Avoid
## Hydration & Supplements
Use common Indian foods.`;

    const data = await callClaude({
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }]
    });
    return (data.content || []).map(b => b.text || '').join('');
};

/**
 * Patient Portal Chat
 */
export const getPortalResponse = async (messages, context) => {
    const systemPrompt = `You are a compassionate health assistant at an Indian medical clinic called Rx Vault.
Patient context: ${context}
Guidelines: Warm, simple language, 3-5 sentences max, refer to actual medicines if applicable, no diagnosis.`;

    const data = await callClaude({
        max_tokens: 600,
        system: systemPrompt,
        messages: messages
    });
    return (data.content || []).map(b => b.text || '').join('').trim();
};

/**
 * Medical Image Analysis
 */
export const analyseMedicalImageService = async (base64, mimeType, typeLabel, notes = '', patient = '') => {
    const prompt = `You are an expert radiologist. Analyse this medical image.
Type: ${typeLabel}
${patient ? `Patient: ${patient}` : ''}
${notes ? `Notes: ${notes}` : ''}

Format:
## Overall Impression
## Key Findings
## Assessment
## Differential Diagnosis
## Recommended Actions
## Image Quality`;

    const data = await callClaude({
        max_tokens: 1200,
        messages: [{
            role: 'user', content: [
                { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } },
                { type: 'text', text: prompt }
            ]
        }]
    });
    return (data.content || []).map(b => b.text || '').join('').trim();
};

/**
 * Minimal Markdown to HTML
 */
export const markdownToHtml = (text) => {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/^## (.+)$/gm, '<h3 style="font-family:\'DM Serif Display\',serif;font-size:15px;color:var(--teal);margin:16px 0 8px;padding-bottom:4px;border-bottom:1px solid var(--border)">$1</h3>')
        .replace(/^### (.+)$/gm, '<h4 style="font-size:14px;font-weight:700;color:var(--text-primary);margin:12px 0 6px">$1</h4>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/^- (.+)$/gm, '<li style="margin:3px 0;padding-left:4px">$1</li>')
        .replace(/(<li.*<\/li>\n?)+/g, '<ul style="padding-left:20px;margin:6px 0">$&</ul>')
        .replace(/🔴/g, '<span style="color:var(--red)">🔴</span>')
        .replace(/⚠️/g, '<span style="color:var(--ayurveda)">⚠️</span>')
        .replace(/✅/g, '<span style="color:var(--green)">✅</span>')
        .replace(/🚨/g, '<span style="color:var(--red);font-weight:700">🚨</span>')
        .replace(/\n\n/g, '</p><p style="margin:6px 0">')
        .replace(/\n/g, '<br>');
};
