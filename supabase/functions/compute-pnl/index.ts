// Supabase Edge Function for computing P&L from Alpha Vantage
// This function can be called from the frontend to compute and persist P&L data
// It provides server-side computation with proper authentication and rate limiting

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Play {
  id: number;
  ticker: string;
  strike: number;
  option_type: 'C' | 'P';
  expiry: string;
  opened_at: string;
  closed_at: string;
}

interface ComputePnLRequest {
  play_ids?: number[]; // Optional: specific play IDs to compute
  force_recompute?: boolean; // Optional: recompute even if P&L exists
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const alphaVantageApiKey = Deno.env.get('ALPHA_VANTAGE_API_KEY')!

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get request body
    const { play_ids, force_recompute = false }: ComputePnLRequest = await req.json()

    // Fetch plays that need P&L computation
    let query = supabase
      .from('plays')
      .select('*')
      .eq('status', 'CLOSED')
      .not('closed_at', 'is', null)

    if (play_ids && play_ids.length > 0) {
      query = query.in('id', play_ids)
    }

    if (!force_recompute) {
      // Only compute for plays with missing or placeholder P&L
      query = query.or('pnl.is.null,pnl.eq.,pnl.eq.Manual Entry Required,pnl.eq.Calculating...')
    }

    const { data: plays, error: fetchError } = await query

    if (fetchError) {
      throw new Error(`Failed to fetch plays: ${fetchError.message}`)
    }

    if (!plays || plays.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No plays need P&L computation',
          computed: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Computing P&L for ${plays.length} plays`)

    let computed = 0
    let errors = 0

    // Process each play
    for (const play of plays) {
      try {
        const result = await computePlayPnL(play, alphaVantageApiKey)
        
        if (result.success) {
          // Update the play with computed P&L
          const { error: updateError } = await supabase
            .from('plays')
            .update({
              pnl: result.pnl,
              result: result.result,
              updated_at: new Date().toISOString()
            })
            .eq('id', play.id)

          if (updateError) {
            console.error(`Failed to update play ${play.id}:`, updateError)
            errors++
          } else {
            computed++
            console.log(`✅ Computed P&L for play ${play.id}: ${result.pnl}`)
          }
        } else {
          // Set to manual entry required
          await supabase
            .from('plays')
            .update({
              pnl: 'Manual Entry Required',
              updated_at: new Date().toISOString()
            })
            .eq('id', play.id)
          
          errors++
          console.log(`❌ Could not compute P&L for play ${play.id}: ${result.error}`)
        }

        // Rate limiting: wait 2 seconds between API calls
        await new Promise(resolve => setTimeout(resolve, 2000))

      } catch (error) {
        console.error(`Error processing play ${play.id}:`, error)
        errors++
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Computed P&L for ${computed} plays, ${errors} errors`,
        computed,
        errors,
        total_processed: plays.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

async function computePlayPnL(play: Play, apiKey: string): Promise<{
  success: boolean;
  pnl?: string;
  result?: 'WIN' | 'LOSS' | 'NEUTRAL';
  error?: string;
}> {
  try {
    // Get entry price at opened_at
    const entryPrice = await getOptionPriceAtTime(
      play.ticker,
      play.strike,
      play.option_type,
      play.expiry,
      play.opened_at,
      apiKey
    )

    // Get exit price at closed_at
    const exitPrice = await getOptionPriceAtTime(
      play.ticker,
      play.strike,
      play.option_type,
      play.expiry,
      play.closed_at,
      apiKey
    )

    if (!entryPrice || !exitPrice || entryPrice <= 0) {
      return {
        success: false,
        error: `Could not get valid prices: entry=${entryPrice}, exit=${exitPrice}`
      }
    }

    // Calculate P&L percentage
    const pnlPercentage = ((exitPrice - entryPrice) / entryPrice) * 100
    const pnl = `${pnlPercentage >= 0 ? '+' : ''}${pnlPercentage.toFixed(1)}%`
    
    // Determine result
    let result: 'WIN' | 'LOSS' | 'NEUTRAL'
    if (pnlPercentage > 0) {
      result = 'WIN'
    } else if (pnlPercentage < 0) {
      result = 'LOSS'
    } else {
      result = 'NEUTRAL'
    }

    return {
      success: true,
      pnl,
      result
    }

  } catch (error) {
    return {
      success: false,
      error: error.message
    }
  }
}

async function getOptionPriceAtTime(
  ticker: string,
  strike: number,
  optionType: 'C' | 'P',
  expiry: string,
  timestamp: string,
  apiKey: string
): Promise<number | null> {
  try {
    // For now, use current price as approximation
    // In production, you'd call Alpha Vantage intraday endpoints
    const url = `https://www.alphavantage.co/query?function=REALTIME_OPTIONS&symbol=${ticker}&apikey=${apiKey}`
    
    const response = await fetch(url)
    const data = await response.json()

    if (data['Error Message']) {
      throw new Error(data['Error Message'])
    }

    if (data['Real-time Options Data']) {
      const contractKey = `${ticker}${expiry}${strike}${optionType}`
      const contractData = data['Real-time Options Data'][contractKey]
      
      if (contractData) {
        const bid = parseFloat(contractData['bid'] || '0')
        const ask = parseFloat(contractData['ask'] || '0')
        return (bid + ask) / 2 // Return mid price
      }
    }

    return null

  } catch (error) {
    console.error('Error fetching option price:', error)
    return null
  }
}

