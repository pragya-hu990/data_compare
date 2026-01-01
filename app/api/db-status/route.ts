import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

export async function GET() {
  // Check if Supabase is configured
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({
      summary: {
        populated: 0,
        empty: 0,
        missing: 0,
        total: 0,
        message: 'Supabase not configured. Environment variables missing.',
      },
      tables: [],
      sampleData: {},
    });
  }

  const tables = [
    // Layer A
    { name: 'app_users', layer: 'A' },
    { name: 'tsp_api_calls', layer: 'A' },
    { name: 'tsp_providers', layer: 'A' },
    { name: 'aa_gateways', layer: 'A' },
    { name: 'aa_consents', layer: 'A' },
    
    // Layer B
    { name: 'fips', layer: 'B' },
    { name: 'brokers', layer: 'B' },
    { name: 'fi_accounts', layer: 'B' },
    { name: 'fi_transactions', layer: 'B' },
    
    // Layer C
    { name: 'fi_deposit_summaries', layer: 'C' },
    { name: 'fi_deposit_insights', layer: 'C' },
    { name: 'fi_mf_holdings', layer: 'C' },
    { name: 'fi_equity_holdings', layer: 'C' },
    { name: 'fi_etf_holdings', layer: 'C' },
    { name: 'fi_nps_holdings', layer: 'C' },
    { name: 'user_financial_snapshots', layer: 'C' },
  ];

  const results: any[] = [];
  let populated = 0;
  let empty = 0;
  let missing = 0;

  for (const table of tables) {
    try {
      const { count, error } = await supabaseAdmin
        .from(table.name)
        .select('*', { count: 'exact', head: true });

      if (error) {
        // Check if table doesn't exist
        if (error.message.includes('schema cache') || error.message.includes('does not exist')) {
          results.push({ table: table.name, layer: table.layer, status: 'MISSING', rows: null });
          missing++;
        } else {
          results.push({ table: table.name, layer: table.layer, status: 'ERROR', error: error.message });
        }
      } else {
        const rows = count ?? 0;
        results.push({ table: table.name, layer: table.layer, status: rows > 0 ? 'OK' : 'EMPTY', rows });
        if (rows > 0) populated++;
        else empty++;
      }
    } catch (e: any) {
      results.push({ table: table.name, layer: table.layer, status: 'ERROR', error: e.message });
    }
  }

  // Get sample data (only from tables that exist)
  const { data: users } = await supabaseAdmin.from('app_users').select('unique_identifier, subscription_status, created_at').limit(5);
  const { data: accounts } = await supabaseAdmin.from('fi_accounts').select('fi_data_id, fi_type, masked_acc_number, fip_name, user_id').limit(5);
  const { data: fips } = await supabaseAdmin.from('fips').select('fip_id, fip_name').limit(5);
  const { data: snapshots } = await supabaseAdmin.from('user_financial_snapshots').select('total_net_worth, total_accounts, snapshot_at').limit(3);
  const { data: apiCalls } = await supabaseAdmin.from('tsp_api_calls').select('endpoint, http_status, called_at').order('called_at', { ascending: false }).limit(5);

  // Get missing tables list
  const missingTables = results.filter(t => t.status === 'MISSING').map(t => t.table);

  return NextResponse.json({
    summary: {
      populated,
      empty,
      missing,
      total: tables.length,
      missingTables: missingTables.length > 0 ? missingTables : undefined,
      action: missingTables.length > 0 
        ? 'Run scripts/add-missing-tables.sql in Supabase SQL Editor' 
        : undefined,
    },
    tables: results,
    sampleData: {
      app_users: users,
      fi_accounts: accounts,
      fips: fips,
      user_financial_snapshots: snapshots,
      tsp_api_calls: apiCalls,
    },
  });
}

