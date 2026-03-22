// supabase/functions/claude-proxy/index.ts
// Primary:  Google Gemini (free tier) — set GEMINI_API_KEY secret
// Fallback: Anthropic Claude        — set ANTHROPIC_API_KEY_1729 secret

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function ok(text: string) {
  return new Response(
    JSON.stringify({ content: [{ type: 'text', text }] }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
function empty() {
  return new Response(
    JSON.stringify({ content: [] }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body      = await req.json();
    const messages  = body.messages ?? [];
    const systemMsg = body.system ?? '';
    const maxTokens = body.max_tokens ?? 1000;

    const userText = messages
      .map((m: { role: string; content: unknown }) => {
        if (typeof m.content === 'string') return m.content;
        if (Array.isArray(m.content)) {
          return (m.content as Array<{ type: string; text?: string }>)
            .filter(p => p.type === 'text')
            .map(p => p.text ?? '')
            .join('\n');
        }
        return '';
      })
      .join('\n');

    const fullPrompt = systemMsg ? `${systemMsg}\n\n${userText}` : userText;

    // ✅ Fixed: matches the actual secret name in Supabase
    const geminiKey    = Deno.env.get('GEMINI_API_KEY');
    const groqKey      = Deno.env.get('GROQ_API_KEY');
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY_1729');

    console.log(`[claude-proxy] promptLen=${fullPrompt.length} maxTokens=${maxTokens} hasGemini=${!!geminiKey} hasGroq=${!!groqKey} hasAnthropic=${!!anthropicKey}`);

    // ── 1. Try Gemini (free tier) ───────────────────────────────
    if (geminiKey) {
      // All confirmed available via ListModels on v1beta
      const geminiModels = [
        { model: 'gemini-2.0-flash',    api: 'v1beta' },
        { model: 'gemini-2.5-flash',    api: 'v1beta' },
        { model: 'gemini-flash-latest', api: 'v1beta' },
      ];
      for (const { model, api } of geminiModels) {
        try {
          console.log(`[claude-proxy] Calling Gemini: ${model} (${api})`);
          const geminiRes = await fetch(
            `https://generativelanguage.googleapis.com/${api}/models/${model}:generateContent?key=${geminiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
                generationConfig: { maxOutputTokens: maxTokens, temperature: 0.4 },
                // ✅ Fixed: disable safety filters so medical content is not blocked
                safetySettings: [
                  { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_NONE' },
                  { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_NONE' },
                  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
                  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
                ],
              }),
            }
          );

          const geminiData = await geminiRes.json();
          console.log(`[claude-proxy] Gemini ${model} HTTP=${geminiRes.status}`);

          if (!geminiRes.ok) {
            console.log(`[claude-proxy] Gemini error:`, JSON.stringify(geminiData).slice(0, 400));
            continue;
          }

          const candidate    = geminiData?.candidates?.[0];
          const parts        = candidate?.content?.parts ?? [];
          const text         = parts.map((p: { text?: string }) => p.text ?? '').join('').trim();
          const finishReason = candidate?.finishReason ?? 'unknown';

          console.log(`[claude-proxy] Gemini ${model} textLen=${text.length} finishReason=${finishReason}`);

          if (text) return ok(text);

          console.log(`[claude-proxy] Gemini ${model} empty. Response:`, JSON.stringify(geminiData).slice(0, 500));
        } catch (e) {
          console.log(`[claude-proxy] Gemini ${model} exception:`, String(e));
        }
      }
      console.log('[claude-proxy] All Gemini models exhausted or rate-limited.');
    } else {
      console.log('[claude-proxy] GEMINI_API_KEY not configured.');
    }

    // ── 2. Fallback: Groq (high performance free tier) ──────────
    if (groqKey) {
      try {
        const groqModel = 'llama-3.3-70b-versatile';
        console.log(`[claude-proxy] Calling Groq: ${groqModel}`);
        
        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${groqKey}`,
          },
          body: JSON.stringify({
            model: groqModel,
            messages: [
              { role: 'system', content: systemMsg || 'You are a helpful medical assistant.' },
              { role: 'user', content: userText }
            ],
            max_tokens: maxTokens,
            temperature: 0.4,
          }),
        });

        const groqData = await groqRes.json();
        console.log(`[claude-proxy] Groq HTTP=${groqRes.status}`);

        if (groqRes.ok) {
          const text = groqData.choices?.[0]?.message?.content?.trim();
          if (text) {
            console.log(`[claude-proxy] Groq success: textLen=${text.length}`);
            return ok(text);
          }
        }
        console.log(`[claude-proxy] Groq error:`, JSON.stringify(groqData).slice(0, 400));
      } catch (e) {
        console.log(`[claude-proxy] Groq exception:`, String(e));
      }
    } else {
      console.log('[claude-proxy] GROQ_API_KEY not configured.');
    }

    // ── 3. Fallback: Anthropic Claude ──────────────────────────
    if (anthropicKey) {
      try {
        console.log('[claude-proxy] Calling Anthropic (ANTHROPIC_API_KEY_1729)...');
        const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': anthropicKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify(body),
        });
        const data = await anthropicRes.json();
        console.log(`[claude-proxy] Anthropic HTTP=${anthropicRes.status}`);
        if (anthropicRes.ok) {
          const text = (data.content ?? []).map((b: { text?: string }) => b.text ?? '').join('');
          if (text) return ok(text);
        }
        console.log('[claude-proxy] Anthropic error:', JSON.stringify(data).slice(0, 300));
      } catch (e) {
        console.log('[claude-proxy] Anthropic exception:', String(e));
      }
    } else {
      console.log('[claude-proxy] ANTHROPIC_API_KEY_1729 not configured.');
    }

    console.log('[claude-proxy] All providers failed. Returning empty.');
    return empty();

  } catch (err) {
    console.log('[claude-proxy] Unhandled error:', String(err));
    return empty();
  }
});
