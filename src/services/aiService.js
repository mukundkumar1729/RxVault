import { db } from '../supabase.js';
import { store } from '../core/store.js';

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

/**
 * Fuzzy search across all prescriptions for AI Case matching
 */
export const searchMedicalRecordsFuzzy = (query) => {
    const qLow = query.toLowerCase();
    const terms = qLow.split(/\s+/).filter(t => t.length > 2);
    const prescriptions = store.prescriptions || [];
    
    const matched = prescriptions.filter(rx => {
        const haystack = [rx.patientName, rx.diagnosis, rx.notes, rx.doctorName,
            (rx.medicines || []).map(m => m.name).join(' ')].join(' ').toLowerCase();
        return terms.some(t => haystack.includes(t)) || haystack.includes(qLow);
    });

    // Sort by match score
    matched.sort((a, b) => {
        const getHaystack = (rx) => [rx.patientName, rx.diagnosis, rx.notes].join(' ').toLowerCase();
        const scoreA = terms.filter(t => getHaystack(a).includes(t)).length;
        const scoreB = terms.filter(t => getHaystack(b).includes(t)).length;
        return scoreB - scoreA;
    });

    return matched;
};

/**
 * Summarizes the common clinical pattern among top matched cases
 */
export const requestClinicalInsight = async (query, matched) => {
    try {
        const topCases = matched.slice(0, 5).map(rx => {
            const meds = (rx.medicines || []).map(m => m.name).slice(0, 3).join(', ');
            return `• ${rx.patientName || '?'}, ${rx.date || ''}: ${rx.diagnosis || 'No diagnosis'}. Medicines: ${meds}`;
        }).join('\n');

        const prompt = `You are a clinical assistant. The doctor searched for "${query}" and found these cases:\n\n${topCases}\n\nIn 2-3 sentences: what is the common clinical pattern? Any notable differences? Keep it concise and clinically relevant. No disclaimers.`;

        const data = await callClaude({
            max_tokens: 250,
            messages: [{ role: 'user', content: prompt }]
        });
        return (data.content || []).map(b => b.text || '').join('').trim();
    } catch (e) {
        console.error('Insight API Error:', e);
        return null;
    }
};
