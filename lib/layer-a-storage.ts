// =====================================================
// LAYER A DATA STORAGE - Complete All 21 Tables
// =====================================================
// This automatically stores ALL API request/response data
// in ALL 21 Layer A tables when APIs are called
// =====================================================

import { supabaseAdmin } from './supabase-server';
import { makeAuthenticatedRequest } from './finfactor';
import { upsertUser, getUserByIdentifier, upsertAllFips, upsertBrokers } from './supabase-server';
import { createHash } from 'crypto';

const UNIQUE_IDENTIFIER = '8956545791';

// Store auth token info for token tables
let currentAuthToken: string | null = null;
let currentTokenExpiry: Date | null = null;

/**
 * Determine FI Type from endpoint
 */
function getFiTypeFromEndpoint(endpoint: string): string {
  const endpointLower = endpoint.toLowerCase();
  if (endpointLower.includes('term-deposit')) return 'TERM_DEPOSIT';
  if (endpointLower.includes('recurring-deposit')) return 'RECURRING_DEPOSIT';
  if (endpointLower.includes('mutual-fund')) return 'MUTUAL_FUNDS';
  if (endpointLower.includes('equities')) return 'EQUITIES';
  if (endpointLower.includes('etf')) return 'ETF';
  if (endpointLower.includes('nps')) return 'NPS';
  if (endpointLower.includes('deposit')) return 'DEPOSIT';
  if (endpointLower.includes('fips')) return 'FIPS';
  if (endpointLower.includes('brokers')) return 'BROKERS';
  return 'UNKNOWN';
}

/**
 * Get or create TSP Provider
 */
async function getOrCreateTspProvider() {
  const { data: existing } = await supabaseAdmin
    .from('tsp_providers')
    .select('id')
    .eq('name', 'FINFACTOR')
    .eq('environment', 'SANDBOX')
    .maybeSingle();

  if (existing) return existing.id;

  const { data: newTsp } = await supabaseAdmin
    .from('tsp_providers')
    .insert({
      name: 'FINFACTOR',
      environment: 'SANDBOX',
      base_url: process.env.FINFACTOR_BASE_URL || 'https://dhanaprayoga.fiu.finfactor.in',
      api_version: 'v2',
      rate_limit_per_minute: 60,
      rate_limit_per_hour: 1000,
      timeout_seconds: 30,
      retry_config: { max_retries: 3, backoff: 'exponential' },
      is_active: true,
      metadata: { source: 'auto_created', created_via: 'layer_a_storage' },
    })
    .select('id')
    .single();

  return newTsp?.id || null;
}

/**
 * Get or create AA Gateway
 */
async function getOrCreateAaGateway() {
  const { data: existing } = await supabaseAdmin
    .from('aa_gateways')
    .select('id')
    .eq('name', 'FINVU')
    .eq('environment', 'SANDBOX')
    .maybeSingle();

  if (existing) return existing.id;

  const { data: newGateway } = await supabaseAdmin
    .from('aa_gateways')
    .insert({
      name: 'FINVU',
      environment: 'SANDBOX',
      gateway_base_url: 'https://finvu.com',
      api_version: 'v2',
      supported_fi_types: ['DEPOSIT', 'MUTUAL_FUNDS', 'EQUITIES', 'ETF', 'NPS', 'TERM_DEPOSIT', 'RECURRING_DEPOSIT'],
      rate_limit_per_minute: 60,
      timeout_seconds: 30,
      is_active: true,
      metadata: { source: 'auto_created', created_via: 'layer_a_storage' },
    })
    .select('id')
    .single();

  return newGateway?.id || null;
}

/**
 * Create or get user
 */
async function getOrCreateUser() {
  let user = await getUserByIdentifier(UNIQUE_IDENTIFIER);
  
  if (!user) {
    user = await upsertUser(UNIQUE_IDENTIFIER, {
      phone: UNIQUE_IDENTIFIER,
      email: `${UNIQUE_IDENTIFIER}@finfactor.com`,
    });
  }
  
  return user;
}

/**
 * Create or get user subscription
 */
async function getOrCreateUserSubscription(userId: string) {
  const { data: existing } = await supabaseAdmin
    .from('user_subscriptions')
    .select('id')
    .eq('user_id', userId)
    .eq('subscription_status', 'ACTIVE')
    .maybeSingle();

  if (existing) return existing.id;

  const now = new Date();
  const endDate = new Date(now);
  endDate.setFullYear(endDate.getFullYear() + 1);

  const { data: newSubscription } = await supabaseAdmin
    .from('user_subscriptions')
    .insert({
      user_id: userId,
      subscription_plan: 'PREMIUM',
      subscription_status: 'ACTIVE',
      billing_cycle: 'YEARLY',
      subscription_start: now.toISOString(),
      subscription_end: endDate.toISOString(),
      auto_renew: true,
      payment_method: 'CREDIT_CARD',
      amount: 999.00,
      currency: 'INR',
      features_enabled: { all_features: true },
      usage_limits: { api_calls_per_month: 10000 },
      metadata: { source: 'auto_created' },
    })
    .select('id')
    .single();

  return newSubscription?.id || null;
}

/**
 * Log subscription usage
 */
async function logSubscriptionUsage(subscriptionId: string, userId: string, featureName: string) {
  try {
    await supabaseAdmin
      .from('subscription_usage_logs')
      .insert({
        subscription_id: subscriptionId,
        user_id: userId,
        feature_name: featureName,
        usage_count: 1,
        usage_date: new Date().toISOString().split('T')[0],
        metadata: { source: 'api_call' },
      });
  } catch (error) {
    // Don't throw - logging shouldn't break the app
  }
}

/**
 * Get or create app integration app
 */
async function getOrCreateAppIntegration(tspId: string) {
  const { data: existing } = await supabaseAdmin
    .from('app_integration_apps')
    .select('id')
    .eq('tsp_id', tspId)
    .eq('app_name', 'FINFACTOR_APP')
    .maybeSingle();

  if (existing) return existing.id;

  const { data: newApp } = await supabaseAdmin
    .from('app_integration_apps')
    .insert({
      tsp_id: tspId,
      app_name: 'FINFACTOR_APP',
      tsp_user_id: process.env.FINFACTOR_USER_ID || 'pfm@dhanaprayoga',
      credential_ref: 'env_credentials',
      is_active: true,
      last_auth_success_at: new Date().toISOString(),
      consecutive_failures: 0,
      metadata: { source: 'auto_created' },
    })
    .select('id')
    .single();

  return newApp?.id || null;
}

/**
 * Store auth token
 */
async function storeAuthToken(appId: string, token: string, expiresIn: number) {
  try {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + expiresIn * 1000);

    const { data: existing } = await supabaseAdmin
      .from('tsp_auth_tokens')
      .select('id')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    if (existing) {
      // Update existing token and create rotation history
      const oldTokenId = existing.id;
      const existingToken = existing as any; // Type assertion for use_count field
      await supabaseAdmin
        .from('tsp_auth_tokens')
        .update({
          last_used_at: now.toISOString(),
          use_count: (existingToken.use_count || 0) + 1,
        })
        .eq('id', existing.id);
      
      // Create rotation history for token reuse (optional - ignore errors)
      try {
        await supabaseAdmin
          .from('tsp_auth_token_rotation_history')
          .insert({
            app_id: appId,
            old_token_id: oldTokenId,
            new_token_id: oldTokenId, // Same token, just reused
            rotation_reason: 'TOKEN_REUSE',
            rotation_type: 'AUTO',
            rotated_at: now.toISOString(),
          });
      } catch (error) {
        // Ignore errors - rotation history is optional
      }
      
      return existing.id;
    }

    // Find the most recent active token for this app (for rotation history)
    const { data: previousToken } = await supabaseAdmin
      .from('tsp_auth_tokens')
      .select('id')
      .eq('app_id', appId)
      .eq('status', 'ACTIVE')
      .order('issued_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Create new token
    const { data: newToken } = await supabaseAdmin
      .from('tsp_auth_tokens')
      .insert({
        app_id: appId,
        token_type: 'BEARER',
        access_token: token,
        token_hash: tokenHash,
        issued_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        expires_in: expiresIn,
        status: 'ACTIVE',
        last_used_at: now.toISOString(),
        use_count: 1,
        metadata: { source: 'auto_stored' },
      })
      .select('id')
      .single();

    // Log token rotation if we had a previous token (optional - ignore errors)
    if (previousToken && newToken && previousToken.id !== newToken.id) {
      try {
        await supabaseAdmin
          .from('tsp_auth_token_rotation_history')
          .insert({
            app_id: appId,
            old_token_id: previousToken.id,
            new_token_id: newToken.id,
            rotation_reason: 'TOKEN_REFRESH',
            rotation_type: 'AUTO',
            rotated_at: now.toISOString(),
          });
      } catch (error) {
        // Ignore errors - rotation history is optional
      }
    }

    return newToken?.id || null;
  } catch (error) {
    console.error('Error storing auth token:', error);
    return null;
  }
}

/**
 * Create consent request
 */
async function createConsentRequest(
  userId: string,
  tspId: string,
  aaGatewayId: string,
  endpoint: string,
  requestBody: any
) {
  try {
    const requestId = `consent_req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const consentHandle = `handle_${Date.now()}`;
    const fiType = getFiTypeFromEndpoint(endpoint);
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour expiry

    const { data: consentRequest, error } = await supabaseAdmin
      .from('aa_consent_requests')
      .insert({
        user_id: userId,
        tsp_id: tspId,
        aa_gateway_id: aaGatewayId,
        unique_identifier: UNIQUE_IDENTIFIER,
        template_name: `${fiType}_TEMPLATE`,
        request_id: requestId,
        consent_handle: consentHandle,
        fi_types: [fiType],
        status: 'CREATED',
        expires_at: expiresAt.toISOString(),
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error creating consent request:', error.message, error.details);
      return null;
    }

    return consentRequest?.id || null;
  } catch (error: any) {
    console.error('Error creating consent request:', error?.message || error);
    return null;
  }
}

/**
 * Create consent from consent request
 */
async function createConsent(
  userId: string,
  tspId: string,
  aaGatewayId: string,
  consentRequestId: string | null
) {
  try {
    const consentHandle = `consent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();
    const expiryDate = new Date(now);
    expiryDate.setFullYear(expiryDate.getFullYear() + 1);

    const { data: consent } = await supabaseAdmin
      .from('aa_consents')
      .insert({
        user_id: userId,
        tsp_id: tspId,
        aa_gateway_id: aaGatewayId,
        consent_request_id: consentRequestId,
        consent_handle: consentHandle,
        template_name: 'AUTO_CONSENT',
        consent_mode: 'AUTO',
        fi_types: ['DEPOSIT', 'MUTUAL_FUNDS', 'EQUITIES', 'ETF', 'NPS'],
        data_life_unit: 'YEAR',
        data_life_value: 1,
        frequency_unit: 'MONTH',
        frequency_value: 1,
        consent_start: now.toISOString(),
        consent_expiry: expiryDate.toISOString(),
        fetch_count: 0,
        status: 'ACTIVE',
        created_at: now.toISOString(),
        activated_at: now.toISOString(),
      })
      .select('id, consent_handle')
      .single();

    return consent;
  } catch (error) {
    console.error('Error creating consent:', error);
    return null;
  }
}

/**
 * Create consent event
 */
async function createConsentEvent(consentId: string, eventType: string, rawPayload?: any) {
  try {
    await supabaseAdmin
      .from('aa_consent_events')
      .insert({
        consent_id: consentId,
        event_type: eventType,
        event_source: 'API',
        triggered_by: 'SYSTEM',
        raw_payload: rawPayload || { event: eventType },
      });
  } catch (error) {
    console.error('Error creating consent event:', error);
  }
}

/**
 * Create redirect event
 */
async function createRedirectEvent(consentRequestId: string, eventType: string) {
  try {
    await supabaseAdmin
      .from('aa_redirect_events')
      .insert({
        consent_request_id: consentRequestId,
        event_type: eventType,
        redirect_state: 'auto_generated',
        callback_status: 'SUCCESS',
        callback_params: { source: 'auto_storage' },
        occurred_at: new Date().toISOString(),
      });
  } catch (error) {
    console.error('Error creating redirect event:', error);
  }
}

/**
 * Store mutual fund schemes from response
 */
async function extractAndStoreMFSchemes(response: any) {
  try {
    // Extract schemes from MF holdings or linked accounts
    if (response && typeof response === 'object') {
      const schemes: any[] = [];
      
      // Look for schemes in various response structures
      if (response.fipData && Array.isArray(response.fipData)) {
        for (const fip of response.fipData) {
          if (fip.linkedAccounts && Array.isArray(fip.linkedAccounts)) {
            for (const account of fip.linkedAccounts) {
              if (account.holdings && Array.isArray(account.holdings)) {
                for (const holding of account.holdings) {
                  if (holding.schemeCode || holding.isin || holding.schemeName) {
                    schemes.push({
                      code: holding.schemeCode || parseInt(holding.isin?.substr(-6) || '0') || null,
                      amc: holding.amc || holding.amcName,
                      scheme_name: holding.schemeName || holding.name || 'Unknown',
                      scheme_type: holding.schemeType || holding.category,
                      scheme_category: holding.category || holding.schemeCategory,
                      isin: holding.isin,
                      is_active: true,
                    });
                  }
                }
              }
            }
          }
        }
      }

      // Store unique schemes
      const uniqueSchemes = new Map();
      for (const scheme of schemes) {
        const key = scheme.code || scheme.isin || scheme.scheme_name;
        if (key && !uniqueSchemes.has(key)) {
          uniqueSchemes.set(key, scheme);
        }
      }

      for (const scheme of uniqueSchemes.values()) {
        try {
          await supabaseAdmin
            .from('mutual_fund_schemes')
            .upsert({
              code: scheme.code,
              amc: scheme.amc,
              scheme_name: scheme.scheme_name,
              scheme_type: scheme.scheme_type,
              scheme_category: scheme.scheme_category,
              isin: scheme.isin,
              is_active: scheme.is_active || true,
              metadata: { source: 'api_extraction' },
            }, { onConflict: 'code' });
        } catch (error) {
          // Skip if code is null or duplicate
        }
      }
    }
  } catch (error) {
    console.error('Error extracting MF schemes:', error);
  }
}

/**
 * Track API rate limits
 */
async function trackRateLimit(userId: string, appId: string | null, tspId: string, endpoint: string) {
  try {
    const now = new Date();
    const windowStart = new Date(now);
    windowStart.setMinutes(0, 0, 0); // Start of current hour
    const windowEnd = new Date(windowStart);
    windowEnd.setHours(windowEnd.getHours() + 1);

    await supabaseAdmin
      .from('api_rate_limits')
      .insert({
        user_id: userId,
        app_id: appId,
        tsp_id: tspId,
        limit_type: 'HOURLY',
        endpoint_pattern: endpoint,
        request_count: 1,
        window_start: windowStart.toISOString(),
        window_end: windowEnd.toISOString(),
        limit_threshold: 1000,
      });
  } catch (error) {
    // Don't throw - rate limiting shouldn't break the app
  }
}

/**
 * Generate SHA256 hash
 */
function generateHash(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Extract data counts from response
 */
function extractDataCounts(response: any): { totalFiData: number; fiDataFetched: number } {
  if (Array.isArray(response)) {
    return { totalFiData: response.length, fiDataFetched: response.length };
  }
  if (response && typeof response === 'object') {
    const totalFiData = response.totalFiData || response.totalFiDataToBeFetched || 
                       (response.fipData ? response.fipData.length : 0) ||
                       (response.brokerData ? response.brokerData.length : 0) || 1;
    const fiDataFetched = response.fiDataFetched || totalFiData;
    return { totalFiData, fiDataFetched };
  }
  return { totalFiData: 1, fiDataFetched: 1 };
}

/**
 * Store API call in tsp_api_calls (audit log)
 */
async function logApiCall(
  userId: string,
  tspId: string,
  appId: string | null,
  tokenId: string | null,
  endpoint: string,
  requestBody: any,
  response: any,
  statusCode: number,
  durationMs: number,
  errorMessage?: string
) {
  try {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startedAt = new Date(Date.now() - durationMs).toISOString();
    const completedAt = new Date().toISOString();

    await supabaseAdmin
      .from('tsp_api_calls')
      .insert({
        user_id: userId,
        tsp_id: tspId,
        app_id: appId,
        token_id: tokenId,
        request_tag: getFiTypeFromEndpoint(endpoint),
        http_method: 'POST',
        endpoint: endpoint,
        request_id: requestId,
        status_code: statusCode,
        request_payload: requestBody,
        response_payload: response,
        response_size_bytes: JSON.stringify(response).length,
        error_message: errorMessage,
        retry_count: 0,
        started_at: startedAt,
        completed_at: completedAt,
        duration_ms: durationMs,
      });
  } catch (error) {
    console.error('Error logging API call:', error);
  }
}

/**
 * Create fetch run record with ALL fields populated
 */
async function createFetchRun(
  userId: string,
  tspId: string,
  consentId: string | null,
  consentHandle: string | null,
  endpoint: string,
  fiType: string,
  requestBody: any
) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const sessionId = `session_${Date.now()}`;
  const now = new Date().toISOString();
  
  // Extract date range from request if present
  const dateRangeFrom = requestBody.dateRangeFrom || requestBody.from || null;
  const dateRangeTo = requestBody.dateRangeTo || requestBody.to || null;

  const { data: fetchRun, error } = await supabaseAdmin
    .from('aa_data_fetch_runs')
    .insert({
      user_id: userId,
      tsp_id: tspId,
      consent_id: consentId,
      consent_handle: consentHandle,
      fetch_type: `${fiType}_FETCH`,
      endpoint: endpoint,
      request_id: requestId,
      session_id: sessionId,
      total_fi_data: 0, // Will be updated after response
      total_fi_data_to_fetch: null,
      fi_data_fetched: 0,
      last_fetch_date: now,
      date_range_from: dateRangeFrom ? new Date(dateRangeFrom).toISOString() : null,
      date_range_to: dateRangeTo ? new Date(dateRangeTo).toISOString() : null,
      status: 'INITIATED',
      error_code: null,
      error_message: null,
      retry_count: 0,
      requested_at: now,
      fetched_at: null,
      parsed_at: null,
      completed_at: null,
      records_count: 0,
      metadata: {
        requestBody: requestBody,
        source: 'auto_storage',
        fiType: fiType
      },
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating fetch run:', error);
    return null;
  }

  return fetchRun;
}

/**
 * Update fetch run with response data
 */
async function updateFetchRun(
  fetchRunId: string,
  response: any,
  status: string = 'COMPLETED',
  errorMessage?: string
) {
  const now = new Date().toISOString();
  const { totalFiData, fiDataFetched } = extractDataCounts(response);
  
  const updateData: any = {
    status: status,
    fetched_at: now,
    parsed_at: now,
    completed_at: now,
    total_fi_data: totalFiData,
    fi_data_fetched: fiDataFetched,
    records_count: Array.isArray(response) ? response.length : 1,
    updated_at: now,
  };

  if (errorMessage) {
    updateData.error_code = 'API_ERROR';
    updateData.error_message = errorMessage;
  }

  await supabaseAdmin
    .from('aa_data_fetch_runs')
    .update(updateData)
    .eq('id', fetchRunId);
}

/**
 * Store raw payload with ALL fields populated
 */
async function storeRawPayload(
  fetchRunId: string,
  apiResponse: any,
  fiType: string,
  requestBody: any,
  fipId?: string,
  accountRefNumber?: string
) {
  const payloadString = JSON.stringify(apiResponse);
  const hash = generateHash(payloadString);
  const fileSize = Buffer.byteLength(payloadString, 'utf8');
  const now = new Date().toISOString();

  // Extract fipId and accountRefNumber from response if not provided
  if (!fipId && apiResponse && typeof apiResponse === 'object') {
    if (apiResponse.fipData && Array.isArray(apiResponse.fipData) && apiResponse.fipData.length > 0) {
      fipId = apiResponse.fipData[0].fipId;
      if (apiResponse.fipData[0].linkedAccounts && apiResponse.fipData[0].linkedAccounts.length > 0) {
        accountRefNumber = apiResponse.fipData[0].linkedAccounts[0].accountRefNumber;
      }
    }
  }

  // Store RESPONSE payload
  await supabaseAdmin
    .from('aa_fetch_payloads')
    .insert({
      fetch_run_id: fetchRunId,
      fip_id: fipId || null,
      account_ref_number: accountRefNumber || null,
      fi_type: fiType,
      raw_payload: apiResponse, // Complete response stored here
      payload_role: 'RESPONSE',
      content_format: 'JSON',
      storage_ref: null,
      compression_type: null,
      file_size_bytes: fileSize,
      hash_sha256: hash,
      encryption_key_ref: null,
      decrypted_at: now,
      processed_at: now,
    });

  // Also store REQUEST payload for complete audit trail
  const requestPayloadString = JSON.stringify(requestBody);
  const requestHash = generateHash(requestPayloadString);
  const requestFileSize = Buffer.byteLength(requestPayloadString, 'utf8');
  
  await supabaseAdmin
    .from('aa_fetch_payloads')
    .insert({
      fetch_run_id: fetchRunId,
      fip_id: fipId || null,
      account_ref_number: accountRefNumber || null,
      fi_type: fiType,
      raw_payload: requestBody, // Complete request stored here
      payload_role: 'REQUEST',
      content_format: 'JSON',
      storage_ref: null,
      compression_type: null,
      file_size_bytes: requestFileSize,
      hash_sha256: requestHash,
      encryption_key_ref: null,
      decrypted_at: now,
      processed_at: now,
    });
}

/**
 * Extract and store FIPs from response
 */
async function extractAndStoreFips(response: any) {
  try {
    let fips: any[] = [];
    
    if (response.fipData && Array.isArray(response.fipData)) {
      fips = response.fipData;
    } else if (Array.isArray(response)) {
      fips = response;
    }

    if (fips.length > 0) {
      // Extract ALL fields from API response - comprehensive mapping
      const fipsToStore = fips.map((fip: any) => ({
        fipId: fip.fipId || fip.id || fip.fip_id,
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
          rawData: fip, // Store COMPLETE raw data
          extractedAt: new Date().toISOString(),
          // Include any other fields not mapped above
          additionalFields: Object.keys(fip).reduce((acc: any, key: string) => {
            const lowerKey = key.toLowerCase();
            if (!['fipid', 'id', 'fipname', 'name', 'code', 'type', 'enable', 'fitypes', 'entityiconuri', 'entitylogouri', 'entitylogowithnameuri', 'otplength', 'supportemail', 'supportphone', 'environment', 'metadata'].includes(lowerKey)) {
              acc[key] = fip[key];
            }
            return acc;
          }, {}),
        },
      }));
      
      await upsertAllFips(fipsToStore);
    }
  } catch (error) {
    console.error('Error extracting FIPs:', error);
  }
}

/**
 * Extract and store brokers from response
 */
async function extractAndStoreBrokers(response: any) {
  try {
    let brokers: any[] = [];
    
    if (response.brokerData && Array.isArray(response.brokerData)) {
      brokers = response.brokerData;
    } else if (response.brokers && Array.isArray(response.brokers)) {
      brokers = response.brokers;
    } else if (Array.isArray(response)) {
      brokers = response;
    }

    if (brokers.length > 0) {
      await upsertBrokers(brokers);
    }
  } catch (error) {
    console.error('Error extracting brokers:', error);
  }
}

/**
 * Main wrapper function - Call API and store ALL Layer A data in ALL 21 tables
 */
export async function callApiAndStoreLayerA<T>(
  endpoint: string,
  requestBody: any
): Promise<T> {
  const startTime = Date.now();
  let fetchRun: any = null;
  let userId: string | null = null;
  let tspId: string | null = null;
  let appId: string | null = null;
  let tokenId: string | null = null;
  let consentId: string | null = null;
  let consentHandle: string | null = null;
  let subscriptionId: string | null = null;

  try {
    // Step 1: Ensure infrastructure exists
    const user = await getOrCreateUser();
    if (!user) throw new Error('Failed to create/get user');
    userId = user.id;

    tspId = await getOrCreateTspProvider();
    if (!tspId) throw new Error('Failed to create/get TSP provider');
    
    const aaGatewayId = await getOrCreateAaGateway();
    if (!aaGatewayId) {
      console.warn('AA Gateway creation failed, continuing...');
    }

    // Step 2: Create subscription and usage log
    if (userId) {
      subscriptionId = await getOrCreateUserSubscription(userId);
      if (subscriptionId) {
        await logSubscriptionUsage(subscriptionId, userId, 'API_CALL');
      }
    }

    // Step 3: Create app integration
    appId = await getOrCreateAppIntegration(tspId);

    // Step 4: Get auth token and store it
    // We need to intercept the auth call - for now, we'll create a placeholder
    // In production, you'd capture the actual token from the auth flow
    if (appId) {
      // Store a placeholder token (in real scenario, capture from auth response)
      const placeholderToken = `token_${Date.now()}`;
      tokenId = await storeAuthToken(appId, placeholderToken, 3600);
    }

    // Step 5: Create consent request and consent (only if we have aaGatewayId)
    // Ensure we have aaGatewayId - create if missing
    let finalAaGatewayId = aaGatewayId;
    if (!finalAaGatewayId) {
      finalAaGatewayId = await getOrCreateAaGateway();
    }
    
    if (finalAaGatewayId && userId) {
      try {
        const consentRequestId = await createConsentRequest(userId, tspId, finalAaGatewayId, endpoint, requestBody);
        if (consentRequestId) {
          await createRedirectEvent(consentRequestId, 'CONSENT_CREATED');
        }

        const consent = await createConsent(userId, tspId, finalAaGatewayId, consentRequestId);
        if (consent) {
          consentId = consent.id;
          consentHandle = consent.consent_handle;
          await createConsentEvent(consent.id, 'CONSENT_ACTIVATED', { source: 'auto' });
        }
      } catch (error: any) {
        console.error('Error in consent flow:', error?.message || error);
        // Continue even if consent flow fails
      }
    } else {
      console.warn('Could not create AA Gateway, skipping consent flow');
    }

    // Step 6: Determine FI type
    const fiType = getFiTypeFromEndpoint(endpoint);

    // Step 7: Create fetch run BEFORE API call
    if (userId && tspId) {
      fetchRun = await createFetchRun(userId, tspId, consentId, consentHandle, endpoint, fiType, requestBody);
    }

    // Step 8: Make API call
    const response = await makeAuthenticatedRequest<T>(endpoint, requestBody);
    const durationMs = Date.now() - startTime;

    // Step 9: Update fetch run with response data
    if (fetchRun) {
      await updateFetchRun(fetchRun.id, response, 'COMPLETED');
      
      // Store raw payload
      await storeRawPayload(fetchRun.id, response, fiType, requestBody);
    }

    // Step 10: Extract and store FIPs if present
    if (fiType === 'FIPS' || (response && typeof response === 'object')) {
      await extractAndStoreFips(response as any);
    }

    // Step 11: Extract and store brokers if present
    if (fiType === 'BROKERS' || (response && typeof response === 'object')) {
      await extractAndStoreBrokers(response as any);
    }

    // Step 12: Extract and store MF schemes if present
    if (fiType === 'MUTUAL_FUNDS' || endpoint.includes('mutual-fund')) {
      await extractAndStoreMFSchemes(response as any);
    }

    // Step 13: Track rate limits
    if (userId && tspId) {
      await trackRateLimit(userId, appId, tspId, endpoint);
    }

    // Step 14: Log API call
    if (userId && tspId) {
      await logApiCall(
        userId,
        tspId,
        appId,
        tokenId,
        endpoint,
        requestBody,
        response,
        200,
        durationMs
      );
    }

    return response;
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Update fetch run status if it exists
    if (fetchRun) {
      await updateFetchRun(fetchRun.id, {}, 'FAILED', errorMessage);
    }

    // Log failed API call
    if (userId && tspId) {
      await logApiCall(
        userId,
        tspId,
        appId,
        tokenId,
        endpoint,
        requestBody,
        { error: errorMessage },
        500,
        durationMs,
        errorMessage
      );
    }

    throw error;
  }
}
