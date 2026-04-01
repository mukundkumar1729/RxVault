import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const RAZORPAY_KEY_ID = Deno.env.get("RAZORPAY_KEY_ID") || "rzp_test_placeholder"
const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET") || "secret_placeholder"

// Pricing from planConfig.js
const PLAN_PRICES = {
  silver: 1729,
  gold: 4479,
  platinum: 8879
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Built-in HMAC SHA256 Signature Verification
 * Uses Web Crypto API (Zero Dependencies)
 */
async function verifyHmac(payload: string, signature: string, secret: string) {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const signatureBytes = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(payload)
  )
  const hashArray = Array.from(new Uint8Array(signatureBytes))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  return hashHex === signature;
}

Deno.serve(async (req) => {
  console.log("🚀 Edge Function: Razorpay trigger received");
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const payload = await req.json()
    console.log("[Razorpay] Payload:", payload)
    
    const { action, clinicId, plan: rawPlan, paymentId, orderId, signature } = payload
    const plan = rawPlan?.toLowerCase()

      // 1. Create Razorpay Order
      if (action === 'create-order') {
        const amount = PLAN_PRICES[plan]
        console.log(`[Razorpay] Creating order for clinic: ${clinicId}, plan: ${plan}, amount: ${amount}`)
        
        if (!amount) {
          console.error(`[Razorpay] Invalid plan: ${plan}. Available: ${Object.keys(PLAN_PRICES)}`)
          throw new Error(`Invalid plan selected: ${plan}`)
        }

        const response = await fetch("https://api.razorpay.com/v1/orders", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Basic " + btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`)
          },
          body: JSON.stringify({
            amount: amount * 100, // Amount in paise
            currency: "INR",
            receipt: `rcpt_${clinicId}_${Date.now()}`
          })
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error("[Razorpay] API Error Response:", errorData);
          const description = (errorData.error && errorData.error.description) || response.statusText;
          throw new Error(`[Razorpay API] ${description}`);
        }

        const order = await response.json()
        console.log("[Razorpay] Order created successfully:", order.id)
        
        return new Response(JSON.stringify({
          ...order,
          razorpay_key_id: RAZORPAY_KEY_ID
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200
        })
      }

    // 2. Verify Payment and Update Plan
    if (action === 'verify-payment') {
      // Signature verification using native Crypto API
      const secret = RAZORPAY_KEY_SECRET
      const payload = `${orderId}|${paymentId}`
      const isValid = await verifyHmac(payload, signature, secret)

      if (!isValid) {
        return new Response(JSON.stringify({ error: "Invalid payment signature" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400
        })
      }

      // Update Supabase Database
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' 
      )

      const { error } = await supabase
        .from('clinics')
        .update({ plan: plan })
        .eq('id', clinicId)

      if (error) throw error

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200
      })
    }

    throw new Error("Invalid action")
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400
    })
  }
})
