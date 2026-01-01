import { createClient } from '@supabase/supabase-js';

// Lazy initialization function
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Return a mock client if env vars are missing (for build-time)
  if (!supabaseUrl || !supabaseServiceKey) {
    console.warn('⚠️ Supabase environment variables not set. Using mock client.');
    // Return a mock client that won't break the build
    return createClient('https://placeholder.supabase.co', 'placeholder-key', {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// Server-side Supabase client with service role key (lazy initialized)
let _supabaseAdmin: ReturnType<typeof getSupabaseClient> | null = null;

export const supabaseAdmin = new Proxy({} as ReturnType<typeof getSupabaseClient>, {
  get(_target, prop) {
    if (!_supabaseAdmin) {
      _supabaseAdmin = getSupabaseClient();
    }
    return (_supabaseAdmin as any)[prop];
  }
});

// =====================================================
// USER OPERATIONS
// =====================================================

/**
 * Create or update a user in the database
 */
export async function upsertUser(uniqueIdentifier: string, data?: {
  phone?: string;
  email?: string;
  subscriptionStatus?: string;
  subscriptionStartDate?: string;
  subscriptionEndDate?: string;
}) {
  const { data: user, error } = await supabaseAdmin
    .from('app_users')
    .upsert({
      unique_identifier: uniqueIdentifier,
      phone: data?.phone || uniqueIdentifier,
      email: data?.email,
      subscription_status: data?.subscriptionStatus,
      subscription_start_date: data?.subscriptionStartDate,
      subscription_end_date: data?.subscriptionEndDate,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'unique_identifier',
    })
    .select()
    .single();

  if (error) {
    console.error('Error upserting user:', error);
    throw error;
  }

  return user;
}

/**
 * Get user by unique identifier
 */
export async function getUserByIdentifier(uniqueIdentifier: string) {
  const { data: user, error } = await supabaseAdmin
    .from('app_users')
    .select('*')
    .eq('unique_identifier', uniqueIdentifier)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = not found
    console.error('Error fetching user:', error);
    throw error;
  }

  return user;
}

// =====================================================
// FIP OPERATIONS
// =====================================================

/**
 * Upsert FIP (Financial Information Provider)
 */
export async function upsertFip(fipData: {
  fipId: string;
  fipName: string;
  code?: string;
  type?: string;
  enable?: string | boolean;
  fiTypes?: string[];
  entityIconUri?: string;
  entityLogoUri?: string;
  entityLogoWithNameUri?: string;
  otpLength?: number;
  supportEmail?: string;
  supportPhone?: string;
  environment?: string;
  metadata?: any;
}) {
  const { data: fip, error } = await supabaseAdmin
    .from('fips')
    .upsert({
      fip_id: fipData.fipId,
      fip_name: fipData.fipName,
      code: fipData.code,
      type: fipData.type || 'BANK', // Default to BANK if not specified
      is_enabled: fipData.enable === 'true' || fipData.enable === true || fipData.enable === undefined,
      fi_types: fipData.fiTypes,
      entity_icon_uri: fipData.entityIconUri,
      entity_logo_uri: fipData.entityLogoUri,
      entity_logo_with_name_uri: fipData.entityLogoWithNameUri,
      otp_length: fipData.otpLength,
      support_email: fipData.supportEmail,
      support_phone: fipData.supportPhone,
      environment: fipData.environment || 'SANDBOX',
      metadata: fipData.metadata || { source: 'api' },
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'fip_id',
    })
    .select()
    .single();

  if (error) {
    console.error('Error upserting FIP:', error);
    throw error;
  }

  return fip;
}

/**
 * Get all FIPs
 */
export async function getAllFips() {
  const { data: fips, error } = await supabaseAdmin
    .from('fips')
    .select('*')
    .order('fip_name');

  if (error) {
    console.error('Error fetching FIPs:', error);
    throw error;
  }

  return fips;
}

// =====================================================
// ACCOUNT OPERATIONS
// =====================================================

/**
 * Upsert a financial account
 */
export async function upsertAccount(userId: string, accountData: {
  fiDataId: string;
  accountRefNumber?: string;
  maskedAccNumber?: string;
  accountType: string;
  fiType: string;
  accountName?: string;
  fipId?: string;
  fipName?: string;
  dataFetched?: boolean;
  lastFetchDateTime?: string;
  latestConsentPurposeText?: string;
  latestConsentExpiryTime?: string;
  consentPurposeVersion?: string;
}) {
  // First, get the user's UUID
  const user = await getUserByIdentifier(userId);
  if (!user) {
    throw new Error(`User not found: ${userId}`);
  }

  const { data: account, error } = await supabaseAdmin
    .from('fi_accounts')
    .upsert({
      user_id: user.id,
      fi_data_id: accountData.fiDataId,
      account_ref_number: accountData.accountRefNumber,
      masked_acc_number: accountData.maskedAccNumber,
      account_type: accountData.accountType,
      fi_type: accountData.fiType,
      account_name: accountData.accountName,
      fip_id_str: accountData.fipId,
      fip_name: accountData.fipName,
      data_fetched: accountData.dataFetched,
      last_fetch_date_time: accountData.lastFetchDateTime,
      latest_consent_purpose_text: accountData.latestConsentPurposeText,
      latest_consent_expiry_time: accountData.latestConsentExpiryTime,
      consent_purpose_version: accountData.consentPurposeVersion,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'fi_data_id',
    })
    .select()
    .single();

  if (error) {
    console.error('Error upserting account:', error);
    throw error;
  }

  return account;
}

/**
 * Get all accounts for a user
 */
export async function getAccountsByUser(uniqueIdentifier: string) {
  const user = await getUserByIdentifier(uniqueIdentifier);
  if (!user) {
    return [];
  }

  const { data: accounts, error } = await supabaseAdmin
    .from('fi_accounts')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching accounts:', error);
    throw error;
  }

  return accounts;
}

// =====================================================
// DEPOSIT SUMMARY OPERATIONS
// =====================================================

/**
 * Upsert deposit summary
 */
export async function upsertDepositSummary(accountId: string, summaryData: {
  currentBalance?: number;
  availableBalance?: number;
  interestRate?: number;
  openingDate?: string;
  maturityDate?: string;
  branch?: string;
  ifscCode?: string;
}) {
  const { data: summary, error } = await supabaseAdmin
    .from('fi_deposit_summaries')
    .upsert({
      account_id: accountId,
      current_balance: summaryData.currentBalance,
      available_balance: summaryData.availableBalance,
      interest_rate: summaryData.interestRate,
      opening_date: summaryData.openingDate,
      maturity_date: summaryData.maturityDate,
      branch: summaryData.branch,
      ifsc_code: summaryData.ifscCode,
      last_fetch_time: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'account_id',
    })
    .select()
    .single();

  if (error) {
    console.error('Error upserting deposit summary:', error);
    throw error;
  }

  return summary;
}

// =====================================================
// TRANSACTION OPERATIONS
// =====================================================

/**
 * Insert transactions (bulk)
 */
export async function insertTransactions(accountId: string, transactions: Array<{
  txnId?: string;
  txnType: string;
  mode?: string;
  amount: number;
  transactionTimestamp: string;
  narration?: string;
  currentBalance?: number;
  category?: string;
}>) {
  const txnData = transactions.map(txn => ({
    account_id: accountId,
    txn_id: txn.txnId,
    txn_type: txn.txnType,
    mode: txn.mode,
    amount: txn.amount,
    transaction_timestamp: txn.transactionTimestamp,
    narration: txn.narration,
    current_balance: txn.currentBalance,
    category: txn.category,
  }));

  const { data, error } = await supabaseAdmin
    .from('fi_transactions')
    .insert(txnData)
    .select();

  if (error) {
    console.error('Error inserting transactions:', error);
    throw error;
  }

  return data;
}

/**
 * Get transactions for an account
 */
export async function getTransactionsByAccount(accountId: string, limit = 100) {
  const { data: transactions, error } = await supabaseAdmin
    .from('fi_transactions')
    .select('*')
    .eq('account_id', accountId)
    .order('transaction_timestamp', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching transactions:', error);
    throw error;
  }

  return transactions;
}

// =====================================================
// API CALL LOGGING
// =====================================================

/**
 * Log an API call for audit purposes
 */
export async function logApiCall(data: {
  userId?: string;
  endpoint: string;
  method: string;
  requestPayload?: any;
  responsePayload?: any;
  httpStatus?: number;
  errorMessage?: string;
  latencyMs?: number;
}) {
  let userUuid = null;
  if (data.userId) {
    const user = await getUserByIdentifier(data.userId);
    userUuid = user?.id;
  }

  const { error } = await supabaseAdmin
    .from('tsp_api_calls')
    .insert({
      user_id: userUuid,
      endpoint: data.endpoint,
      method: data.method,
      request_payload: data.requestPayload,
      response_payload: data.responsePayload,
      http_status: data.httpStatus,
      error_message: data.errorMessage,
      latency_ms: data.latencyMs,
    });

  if (error) {
    console.error('Error logging API call:', error);
    // Don't throw - logging shouldn't break the app
  }
}

// =====================================================
// USER FINANCIAL SNAPSHOT
// =====================================================

/**
 * Update user's financial snapshot (portfolio overview)
 */
export async function updateFinancialSnapshot(uniqueIdentifier: string, snapshot: {
  totalNetWorth?: number;
  depositsValue?: number;
  termDepositsValue?: number;
  recurringDepositsValue?: number;
  mutualFundsValue?: number;
  equitiesValue?: number;
  etfValue?: number;
  npsValue?: number;
  totalAccounts?: number;
}) {
  const user = await getUserByIdentifier(uniqueIdentifier);
  if (!user) {
    throw new Error(`User not found: ${uniqueIdentifier}`);
  }

  const { data, error } = await supabaseAdmin
    .from('user_financial_snapshots')
    .insert({
      user_id: user.id,
      total_net_worth: snapshot.totalNetWorth,
      deposits_value: snapshot.depositsValue,
      term_deposits_value: snapshot.termDepositsValue,
      recurring_deposits_value: snapshot.recurringDepositsValue,
      mutual_funds_value: snapshot.mutualFundsValue,
      equities_value: snapshot.equitiesValue,
      etf_value: snapshot.etfValue,
      nps_value: snapshot.npsValue,
      total_accounts: snapshot.totalAccounts,
      last_fetch_date: new Date().toISOString(),
      snapshot_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('Error updating financial snapshot:', error);
    throw error;
  }

  return data;
}

/**
 * Get latest financial snapshot for user
 */
export async function getLatestSnapshot(uniqueIdentifier: string) {
  const user = await getUserByIdentifier(uniqueIdentifier);
  if (!user) {
    return null;
  }

  const { data: snapshot, error } = await supabaseAdmin
    .from('user_financial_snapshots')
    .select('*')
    .eq('user_id', user.id)
    .order('snapshot_at', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching snapshot:', error);
    throw error;
  }

  return snapshot;
}

// =====================================================
// BROKER OPERATIONS
// =====================================================

/**
 * Upsert brokers from API response (batch insert)
 */
export async function upsertBrokers(brokersData: any[]) {
  if (!brokersData || !Array.isArray(brokersData)) return { saved: 0 };

  // Map to database format - match actual schema columns
  const records = brokersData.map(broker => ({
    broker_id: String(broker.brokerId || broker.id || broker.brokerName || `broker_${Date.now()}_${Math.random()}`),
    broker_name: broker.brokerName || broker.name || 'Unknown',
    broker_code: broker.code || broker.brokerCode || null,
    logo_url: broker.logo || broker.entityLogoUri || broker.entityIconUri || null,
    is_active: true,
    metadata: broker.metadata || { source: 'api' },
  }));

  try {
    // Clear and insert fresh
    await supabaseAdmin.from('brokers').delete().neq('broker_id', '');
    
    // Insert in batches of 100 to avoid timeout
    const batchSize = 100;
    let saved = 0;
    
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const { data, error } = await supabaseAdmin
        .from('brokers')
        .insert(batch)
        .select();
      
      if (!error && data) {
        saved += data.length;
      } else if (error) {
        console.error('Batch insert error:', error.message);
      }
    }
    
    console.log(`💾 Saved ${saved} brokers to database`);
    return { saved };
  } catch (e: any) {
    console.error('Error upserting brokers:', e.message);
    return { saved: 0 };
  }
}

// =====================================================
// MUTUAL FUND HOLDINGS OPERATIONS
// =====================================================

/**
 * Upsert MF holdings from API response (batch insert)
 */
export async function upsertMFHoldings(uniqueIdentifier: string, holdingsData: any) {
  const user = await getOrCreateUser(uniqueIdentifier);
  if (!user) return { saved: 0 };

  const holdings = holdingsData?.holdings || holdingsData?.fipData || [];
  
  // Handle nested structure from API
  const allHoldings: any[] = [];
  
  if (Array.isArray(holdings)) {
    for (const item of holdings) {
      if (item.holdings && Array.isArray(item.holdings)) {
        for (const h of item.holdings) {
          allHoldings.push({ ...h, fipName: item.fipName, fipId: item.fipId });
        }
      } else {
        allHoldings.push(item);
      }
    }
  }

  if (allHoldings.length === 0) return { saved: 0 };

  // Batch insert all at once
  const records = allHoldings.map(holding => ({
    user_id: user.id,
    folio_number: holding.folioNumber || holding.folio || null,
    scheme_name: holding.schemeName || holding.name || 'Unknown',
    scheme_code: holding.schemeCode || holding.isin || null,
    isin: holding.isin || null,
    amc_name: holding.amcName || holding.amc || null,
    fund_type: holding.fundType || holding.category || null,
    units: parseFloat(holding.units) || 0,
    nav: parseFloat(holding.nav) || 0,
    current_value: parseFloat(holding.currentValue || holding.value) || 0,
    invested_value: parseFloat(holding.investedValue || holding.costValue) || 0,
    returns_absolute: parseFloat(holding.returnsAbsolute || holding.absoluteReturn) || 0,
    returns_percent: parseFloat(holding.returnsPercent || holding.percentReturn) || 0,
    fip_name: holding.fipName || null,
    last_fetch_time: new Date().toISOString(),
  }));

  try {
    // Clear old data for this user first, then insert fresh
    await supabaseAdmin.from('fi_mf_holdings').delete().eq('user_id', user.id);
    
    const { data, error } = await supabaseAdmin
      .from('fi_mf_holdings')
      .insert(records)
      .select();

    if (error) {
      console.error('Error inserting MF holdings:', error.message);
      return { saved: 0 };
    }
    
    console.log(`💾 Saved ${data?.length || 0} MF holdings to database`);
    return { saved: data?.length || 0 };
  } catch (e: any) {
    console.error('Error upserting MF holdings:', e.message);
    return { saved: 0 };
  }
}

// =====================================================
// EQUITY HOLDINGS OPERATIONS
// =====================================================

/**
 * Upsert equity holdings from API response (batch insert)
 */
export async function upsertEquityHoldings(uniqueIdentifier: string, holdingsData: any) {
  const user = await getOrCreateUser(uniqueIdentifier);
  if (!user) return { saved: 0 };

  const holdings = holdingsData?.holdings || holdingsData?.fipData || [];
  
  // Handle nested structure
  const allHoldings: any[] = [];
  
  if (Array.isArray(holdings)) {
    for (const item of holdings) {
      if (item.holdings && Array.isArray(item.holdings)) {
        for (const h of item.holdings) {
          allHoldings.push({ ...h, fipName: item.fipName, brokerId: item.brokerId });
        }
      } else if (item.dematAccounts && Array.isArray(item.dematAccounts)) {
        for (const demat of item.dematAccounts) {
          if (demat.holdings && Array.isArray(demat.holdings)) {
            for (const h of demat.holdings) {
              allHoldings.push({ ...h, dematId: demat.dematId, fipName: item.fipName });
            }
          }
        }
      } else {
        allHoldings.push(item);
      }
    }
  }

  if (allHoldings.length === 0) return { saved: 0 };

  // Batch insert
  const records = allHoldings.map(holding => ({
    user_id: user.id,
    symbol: holding.symbol || holding.stockSymbol || null,
    isin: holding.isin || null,
    company_name: holding.companyName || holding.name || 'Unknown',
    quantity: parseInt(holding.quantity || holding.units) || 0,
    average_price: parseFloat(holding.averagePrice || holding.avgPrice) || 0,
    current_price: parseFloat(holding.currentPrice || holding.ltp) || 0,
    current_value: parseFloat(holding.currentValue || holding.value) || 0,
    invested_value: parseFloat(holding.investedValue || holding.costValue) || 0,
    day_change: parseFloat(holding.dayChange) || 0,
    day_change_percent: parseFloat(holding.dayChangePercent) || 0,
    total_returns: parseFloat(holding.totalReturns || holding.pnl) || 0,
    returns_percent: parseFloat(holding.returnsPercent) || 0,
    broker_name: holding.brokerName || holding.brokerId || null,
    demat_id: holding.dematId || null,
    fip_name: holding.fipName || null,
    last_fetch_time: new Date().toISOString(),
  }));

  try {
    await supabaseAdmin.from('fi_equity_holdings').delete().eq('user_id', user.id);
    
    const { data, error } = await supabaseAdmin
      .from('fi_equity_holdings')
      .insert(records)
      .select();

    if (error) {
      console.error('Error inserting equity holdings:', error.message);
      return { saved: 0 };
    }
    
    console.log(`💾 Saved ${data?.length || 0} equity holdings to database`);
    return { saved: data?.length || 0 };
  } catch (e: any) {
    console.error('Error upserting equity holdings:', e.message);
    return { saved: 0 };
  }
}

// =====================================================
// ETF HOLDINGS OPERATIONS
// =====================================================

/**
 * Upsert ETF holdings from API response (batch insert)
 */
export async function upsertETFHoldings(uniqueIdentifier: string, holdingsData: any) {
  const user = await getOrCreateUser(uniqueIdentifier);
  if (!user) return { saved: 0 };

  const holdings = holdingsData?.holdings || holdingsData?.fipData || [];
  
  // Handle nested structure
  const allHoldings: any[] = [];
  
  if (Array.isArray(holdings)) {
    for (const item of holdings) {
      if (item.holdings && Array.isArray(item.holdings)) {
        for (const h of item.holdings) {
          allHoldings.push({ ...h, fipName: item.fipName });
        }
      } else {
        allHoldings.push(item);
      }
    }
  }

  if (allHoldings.length === 0) return { saved: 0 };

  const records = allHoldings.map(holding => ({
    user_id: user.id,
    symbol: holding.symbol || holding.etfSymbol || null,
    isin: holding.isin || null,
    etf_name: holding.etfName || holding.name || 'Unknown',
    quantity: parseInt(holding.quantity || holding.units) || 0,
    average_price: parseFloat(holding.averagePrice || holding.avgPrice) || 0,
    current_price: parseFloat(holding.currentPrice || holding.ltp) || 0,
    current_value: parseFloat(holding.currentValue || holding.value) || 0,
    invested_value: parseFloat(holding.investedValue || holding.costValue) || 0,
    returns_absolute: parseFloat(holding.returnsAbsolute) || 0,
    returns_percent: parseFloat(holding.returnsPercent) || 0,
    fip_name: holding.fipName || null,
    last_fetch_time: new Date().toISOString(),
  }));

  try {
    await supabaseAdmin.from('fi_etf_holdings').delete().eq('user_id', user.id);
    
    const { data, error } = await supabaseAdmin
      .from('fi_etf_holdings')
      .insert(records)
      .select();

    if (error) {
      console.error('Error inserting ETF holdings:', error.message);
      return { saved: 0 };
    }
    
    console.log(`💾 Saved ${data?.length || 0} ETF holdings to database`);
    return { saved: data?.length || 0 };
  } catch (e: any) {
    console.error('Error upserting ETF holdings:', e.message);
    return { saved: 0 };
  }
}

// =====================================================
// NPS HOLDINGS OPERATIONS
// =====================================================

/**
 * Upsert NPS holdings from API response (batch insert)
 */
export async function upsertNPSHoldings(uniqueIdentifier: string, holdingsData: any) {
  const user = await getOrCreateUser(uniqueIdentifier);
  if (!user) return { saved: 0 };

  const holdings = holdingsData?.holdings || holdingsData?.fipData || holdingsData?.accounts || [];
  
  // Handle nested structure
  const allHoldings: any[] = [];
  
  if (Array.isArray(holdings)) {
    for (const item of holdings) {
      if (item.holdings && Array.isArray(item.holdings)) {
        for (const h of item.holdings) {
          allHoldings.push({ ...h, fipName: item.fipName });
        }
      } else if (item.linkedAccounts && Array.isArray(item.linkedAccounts)) {
        for (const acc of item.linkedAccounts) {
          allHoldings.push({ ...acc, fipName: item.fipName });
        }
      } else {
        allHoldings.push(item);
      }
    }
  }

  if (allHoldings.length === 0) return { saved: 0 };

  const records = allHoldings.map(holding => ({
    user_id: user.id,
    pran: holding.pran || holding.pranNumber || null,
    scheme_name: holding.schemeName || holding.name || 'Unknown',
    scheme_type: holding.schemeType || holding.tier || null,
    pfm_name: holding.pfmName || holding.pensionFundManager || null,
    units: parseFloat(holding.units) || 0,
    nav: parseFloat(holding.nav) || 0,
    current_value: parseFloat(holding.currentValue || holding.value) || 0,
    total_contribution: parseFloat(holding.totalContribution) || 0,
    tier1_value: parseFloat(holding.tier1Value) || 0,
    tier2_value: parseFloat(holding.tier2Value) || 0,
    fip_name: holding.fipName || null,
    last_fetch_time: new Date().toISOString(),
  }));

  try {
    await supabaseAdmin.from('fi_nps_holdings').delete().eq('user_id', user.id);
    
    const { data, error } = await supabaseAdmin
      .from('fi_nps_holdings')
      .insert(records)
      .select();

    if (error) {
      console.error('Error inserting NPS holdings:', error.message);
      return { saved: 0 };
    }
    
    console.log(`💾 Saved ${data?.length || 0} NPS holdings to database`);
    return { saved: data?.length || 0 };
  } catch (e: any) {
    console.error('Error upserting NPS holdings:', e.message);
    return { saved: 0 };
  }
}

// =====================================================
// HELPER: Get or Create User
// =====================================================

/**
 * Get user or create if not exists
 */
async function getOrCreateUser(uniqueIdentifier: string) {
  let user = await getUserByIdentifier(uniqueIdentifier);
  
  if (!user) {
    try {
      user = await upsertUser(uniqueIdentifier, {
        phone: uniqueIdentifier,
        subscriptionStatus: 'ACTIVE',
      });
    } catch (e) {
      console.error('Error creating user:', e);
      return null;
    }
  }
  
  return user;
}

// =====================================================
// BULK FIP UPSERT
// =====================================================

/**
 * Upsert all FIPs from API response
 */
export async function upsertAllFips(fipsData: any[]) {
  if (!fipsData || !Array.isArray(fipsData)) return { saved: 0 };

  let saved = 0;
  for (const fip of fipsData) {
    try {
      // Ensure fipId is always present
      const fipId = fip.fipId || fip.id;
      if (!fipId) {
        console.warn('Skipping FIP with no fipId:', fip);
        continue;
      }

      // Extract ALL fields from the API response
      // Map all possible field variations to database columns
      await upsertFip({
        fipId: fipId,
        fipName: fip.fipName || fip.name || fip.fip_name || 'Unknown',
        code: fip.code || fip.fipCode,
        type: fip.type || fip.fipType || (fip.fiTypes && fip.fiTypes.length > 0 ? fip.fiTypes[0] : 'BANK') || 'BANK',
        enable: fip.enable || fip.isEnabled || fip.is_enabled,
        fiTypes: fip.fiTypes || fip.fi_types || fip.financialInstrumentTypes,
        entityIconUri: fip.entityIconUri || fip.entity_icon_uri || fip.iconUri || fip.icon_uri,
        entityLogoUri: fip.entityLogoUri || fip.entity_logo_uri || fip.logoUri || fip.logo_uri,
        entityLogoWithNameUri: fip.entityLogoWithNameUri || fip.entity_logo_with_name_uri || fip.logoWithNameUri || fip.logo_with_name_uri,
        otpLength: fip.otpLength || fip.otp_length || fip.otpLengthValue,
        supportEmail: fip.supportEmail || fip.support_email || fip.email || fip.contactEmail || fip.contact_email,
        supportPhone: fip.supportPhone || fip.support_phone || fip.phone || fip.contactPhone || fip.contact_phone || fip.mobile,
        environment: fip.environment || fip.env || 'SANDBOX',
        metadata: {
          source: 'api',
          rawData: fip, // Store ALL raw data
          extractedAt: new Date().toISOString(),
          // Include any other fields not mapped above
          additionalFields: Object.keys(fip).reduce((acc: any, key: string) => {
            const lowerKey = key.toLowerCase();
            if (!['fipid', 'fipname', 'name', 'code', 'type', 'enable', 'fitypes', 'entityiconuri', 'entitylogouri', 'entitylogowithnameuri', 'otplength', 'supportemail', 'supportphone', 'environment'].includes(lowerKey)) {
              acc[key] = fip[key];
            }
            return acc;
          }, {}),
        },
      });
      saved++;
    } catch (e) {
      console.error('Error upserting FIP:', e);
    }
  }
  
  console.log(`💾 Saved ${saved} FIPs to database`);
  return { saved };
}

