import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const RAZORPAY_KEY_ID = Deno.env.get("RAZORPAY_KEY_ID") || "rzp_test_placeholder"
const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET") || "secret_placeholder"

// Pricing based on Yearly Subscriptions
const PLAN_PRICES: Record<string, number> = {
  silver: 1729,
  gold: 4479,
  platinum: 8879
}

// Tax Rates (tax1 + tax2) by Country
interface TaxInfo { tax1_name: string; tax1_rate: number; tax2_name: string; tax2_rate: number; }
const TAX_RATES: Record<string, TaxInfo> = {
  india: { tax1_name: 'CGST', tax1_rate: 0.09, tax2_name: 'SGST', tax2_rate: 0.09 },
  default: { tax1_name: 'TAX1', tax1_rate: 0.05, tax2_name: 'TAX2', tax2_rate: 0.05 }
}

// Active Promo Codes (Always Uppercase for Case-Insensitive Matching)
const PROMO_CODES: Record<string, number> = {
  'WELCOME10': 0.10, // 10% off
  'SAVE10': 0.10,    // 10% off
  'SAVE25': 0.25,    // 25% off
  'SAVE50': 0.50,    // 50% off
  'SAVE60': 0.60,    // 60% off
  'RX2026': 500,     // Flat ₹500 off
  'FREEBI': 1.0      // 100% off (test)
}

/**
 * Calculates the final breakdown of the price.
 */
function calculateOrderBreakdown(plan: string, countryInput?: string, promoCodeInput?: string) {
  const basePrice = PLAN_PRICES[plan] || 0;
  let discountAmount = 0;
  
  const promoCode = (promoCodeInput || '').toUpperCase().trim();
  if (promoCode && PROMO_CODES[promoCode]) {
    const value = PROMO_CODES[promoCode];
    discountAmount = value <= 1 ? basePrice * value : value;
  }

  const taxableAmount = Math.max(0, basePrice - discountAmount);
  
  // Default to 'india' if country is missing or empty
  const country = (countryInput || 'india').toLowerCase().trim();
  const taxInfo = TAX_RATES[country] || TAX_RATES.india;
  
  // Round each tax component individually to match UI logic (penny-perfect sync)
  const tax1Amount = Math.round(taxableAmount * taxInfo.tax1_rate * 100) / 100;
  const tax2Amount = Math.round(taxableAmount * taxInfo.tax2_rate * 100) / 100;
  
  const total = Math.round((taxableAmount + tax1Amount + tax2Amount) * 100) / 100;

  return {
    basePrice,
    discountAmount,
    taxableAmount,
    tax1: { name: taxInfo.tax1_name, amount: tax1Amount },
    tax2: { name: taxInfo.tax2_name, amount: tax2Amount },
    total: total
  };
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

Deno.serve(async (req: Request) => {
  console.log("🚀 Edge Function: Razorpay trigger received");
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const payload = await req.json()
    console.log("[Razorpay] Payload:", payload)
    
    const { action, clinicId, plan: rawPlan, paymentId, orderId, signature, promoCode, country, previewOnly } = payload
    const plan = rawPlan?.toLowerCase()

      // 1. Create Razorpay Order
      if (action === 'create-order') {
        const breakdown = calculateOrderBreakdown(plan, country, promoCode);
        console.log(`[Razorpay] Creating order for clinic: ${clinicId}, plan: ${plan}, breakdown:`, breakdown)
        
        if (breakdown.basePrice === 0) {
          throw new Error(`Invalid plan selected: ${plan}`)
        }
        
        // If it's only a preview, return the breakdown now
        if (previewOnly) {
          return new Response(JSON.stringify({
            breakdown
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200
          })
        }

        const response = await fetch("https://api.razorpay.com/v1/orders", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Basic " + btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`)
          },
          body: JSON.stringify({
            amount: Math.round(breakdown.total * 100), // Amount in paise
            currency: "INR",
            receipt: `rcpt_${clinicId}_${Date.now()}`,
            notes: {
                basePrice: breakdown.basePrice,
                discount: breakdown.discountAmount,
                tax1: `${breakdown.tax1.name}:${breakdown.tax1.amount}`,
                tax2: `${breakdown.tax2.name}:${breakdown.tax2.amount}`
            }
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
          breakdown,
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

      // Fetch current clinic details for expiry calculation
      const { data: clinic } = await supabase
        .from('clinics')
        .select('plan, plan_expires_at')
        .eq('id', clinicId)
        .maybeSingle();

      // Calculate New Expiry
      let newExpiryDate = new Date();
      newExpiryDate.setFullYear(newExpiryDate.getFullYear() + 1);

      if (clinic && clinic.plan === plan && clinic.plan_expires_at) {
          const currentExpiry = new Date(clinic.plan_expires_at);
          const baseDate = currentExpiry > new Date() ? currentExpiry : new Date();
          newExpiryDate = new Date(baseDate.getTime());
          newExpiryDate.setFullYear(newExpiryDate.getFullYear() + 1);
      }

      const { error } = await supabase
        .from('clinics')
        .update({ 
          plan: plan,
          plan_expires_at: newExpiryDate.toISOString()
        })
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
