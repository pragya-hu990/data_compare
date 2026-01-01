/**
 * FINFACTOR API EXTRACTOR
 * 
 * Calls actual FinFactor APIs and extracts request/response parameters
 * to compare with REBIT schemas
 */

import { makeAuthenticatedRequest } from './finfactor';

export interface ApiField {
  name: string;
  type: string;
  isRequired: boolean;
  isArray: boolean;
  description?: string;
  path: string; // JSON path like "data.accounts[].accountId"
  source: 'request' | 'response';
  endpoint: string;
  fiType: string;
}

export interface ApiEndpoint {
  endpoint: string;
  method: string;
  fiType: string;
  requestFields: ApiField[];
  responseFields: ApiField[];
  sampleRequest?: any;
  sampleResponse?: any;
}

/**
 * Extract fields from a JSON object recursively
 */
function extractFieldsFromObject(
  obj: any,
  prefix: string = '',
  source: 'request' | 'response',
  endpoint: string,
  fiType: string,
  isArray: boolean = false,
  depth: number = 0,
  maxDepth: number = 20 // Prevent infinite recursion
): ApiField[] {
  const fields: ApiField[] = [];
  const seenPaths = new Set<string>(); // Track paths to avoid duplicates
  
  if (obj === null || obj === undefined || depth > maxDepth) {
    return fields;
  }
  
  if (Array.isArray(obj)) {
    if (obj.length > 0) {
      // Extract fields from ALL array elements (not just first) to catch variations
      const uniqueElements = new Set<string>();
      for (const element of obj) {
        const elementStr = JSON.stringify(element);
        if (!uniqueElements.has(elementStr)) {
          uniqueElements.add(elementStr);
          const elementFields = extractFieldsFromObject(
            element,
            `${prefix}[]`,
            source,
            endpoint,
            fiType,
            true,
            depth + 1,
            maxDepth
          );
          // Only add fields we haven't seen before
          elementFields.forEach(field => {
            const pathKey = `${field.path}:${field.name}`;
            if (!seenPaths.has(pathKey)) {
              seenPaths.add(pathKey);
              fields.push(field);
            }
          });
        }
      }
    } else {
      // Empty array - still record it as a field
      const currentPath = prefix || '[]';
      const pathKey = `${currentPath}:[]`;
      if (!seenPaths.has(pathKey)) {
        seenPaths.add(pathKey);
        fields.push({
          name: prefix ? prefix.split('.').pop() || '[]' : '[]',
          type: 'ARRAY',
          isRequired: false,
          isArray: true,
          path: currentPath,
          source,
          endpoint,
          fiType
        });
      }
    }
    return fields;
  }
  
  if (typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj)) {
      const currentPath = prefix ? `${prefix}.${key}` : key;
      const pathKey = `${currentPath}:${key}`;
      
      // Skip if we've already seen this exact path
      if (seenPaths.has(pathKey)) {
        continue;
      }
      seenPaths.add(pathKey);
      
      const fieldType = inferType(value);
      
      // Always add the field itself
      fields.push({
        name: key,
        type: fieldType,
        isRequired: value !== null && value !== undefined,
        isArray: Array.isArray(value),
        path: currentPath,
        source,
        endpoint,
        fiType
      });
      
      // Recursively extract nested objects - go DEEP
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        const nestedFields = extractFieldsFromObject(
          value,
          currentPath,
          source,
          endpoint,
          fiType,
          false,
          depth + 1,
          maxDepth
        );
        // Add nested fields, avoiding duplicates
        nestedFields.forEach(field => {
          const nestedPathKey = `${field.path}:${field.name}`;
          if (!seenPaths.has(nestedPathKey)) {
            seenPaths.add(nestedPathKey);
            fields.push(field);
          }
        });
      } else if (Array.isArray(value)) {
        // For arrays, extract from all elements to catch all variations
        if (value.length > 0) {
          const uniqueArrayElements = new Set<string>();
          for (const element of value) {
            const elementStr = JSON.stringify(element);
            if (!uniqueArrayElements.has(elementStr)) {
              uniqueArrayElements.add(elementStr);
              const arrayFields = extractFieldsFromObject(
                element,
                `${currentPath}[]`,
                source,
                endpoint,
                fiType,
                true,
                depth + 1,
                maxDepth
              );
              arrayFields.forEach(field => {
                const arrayPathKey = `${field.path}:${field.name}`;
                if (!seenPaths.has(arrayPathKey)) {
                  seenPaths.add(arrayPathKey);
                  fields.push(field);
                }
              });
            }
          }
        } else {
          // Empty array - still record it
          const arrayPathKey = `${currentPath}[]:[]`;
          if (!seenPaths.has(arrayPathKey)) {
            seenPaths.add(arrayPathKey);
            fields.push({
              name: `${key}[]`,
              type: 'ARRAY',
              isRequired: false,
              isArray: true,
              path: `${currentPath}[]`,
              source,
              endpoint,
              fiType
            });
          }
        }
      }
    }
  }
  
  return fields;
}

/**
 * Infer data type from value
 */
function inferType(value: any): string {
  if (value === null || value === undefined) return 'NULL';
  if (Array.isArray(value)) return 'ARRAY';
  if (typeof value === 'string') {
    // Try to detect more specific types
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) return 'DATE';
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return 'DATETIME';
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) return 'UUID';
    return 'STRING';
  }
  if (typeof value === 'number') {
    return Number.isInteger(value) ? 'INTEGER' : 'DECIMAL';
  }
  if (typeof value === 'boolean') return 'BOOLEAN';
  if (typeof value === 'object') return 'OBJECT';
  return 'UNKNOWN';
}

/**
 * Call FinFactor API and extract fields
 */
export async function extractApiFields(
  endpoint: string,
  requestBody: any,
  fiType: string
): Promise<ApiEndpoint> {
  try {
    // Call the actual API
    const response = await makeAuthenticatedRequest<any>(endpoint, requestBody);
    
    // Extract request fields
    const requestFields = extractFieldsFromObject(
      requestBody,
      '',
      'request',
      endpoint,
      fiType,
      false
    );
    
    // Extract response fields
    const responseFields = extractFieldsFromObject(
      response,
      '',
      'response',
      endpoint,
      fiType,
      false
    );
    
    return {
      endpoint,
      method: 'POST',
      fiType,
      requestFields,
      responseFields,
      sampleRequest: requestBody,
      sampleResponse: response
    };
  } catch (error: any) {
    console.error(`❌ Error calling ${endpoint}:`, error.message);
    // Return empty fields if API call fails
    return {
      endpoint,
      method: 'POST',
      fiType,
      requestFields: extractFieldsFromObject(requestBody, '', 'request', endpoint, fiType, false),
      responseFields: [],
      sampleRequest: requestBody,
      sampleResponse: null
    };
  }
}

/**
 * Get all FinFactor API endpoints to test
 * Based on all APIs defined in app/actions.ts
 */
export function getFinFactorApiEndpoints(): Array<{
  endpoint: string;
  requestBody: any;
  fiType: string;
  name: string;
}> {
  const uniqueIdentifier = process.env.TEST_UNIQUE_IDENTIFIER || '8956545791';
  const dateFrom = '2024-01-01';
  const dateTo = '2025-12-31';
  const dateRangeFrom = '2020-01-01';
  
  return [
    // ========== SYSTEM & AUTH APIs ==========
    {
      name: 'User Details',
      endpoint: '/pfm/api/v2/user-details',
      requestBody: { uniqueIdentifier },
      fiType: 'SYSTEM'
    },
    {
      name: 'User Account Delink',
      endpoint: '/pfm/api/v2/user-account-delink',
      requestBody: { uniqueIdentifier, accountId: '60e38f9b-50da-46b2-bb43-3ddb5b9e63c1' },
      fiType: 'SYSTEM'
    },
    {
      name: 'Submit Consent Request Plus',
      endpoint: '/pfm/api/v2/submit-consent-request-plus',
      requestBody: { 
        uniqueIdentifier, 
        aaCustId: '8956545791@finvu',
        templateName: 'BANK_STATEMENT_PERIODIC',
        userSessionId: 'sessionid123',
        redirectUrl: 'http://localhost:3002/callback'
      },
      fiType: 'SYSTEM'
    },
    {
      name: 'Submit Consent Request V1',
      endpoint: '/pfm/api/v1/submit-consent-request',
      requestBody: { uniqueIdentifier, templateName: 'BANK_STATEMENT_PERIODIC' },
      fiType: 'SYSTEM'
    },
    {
      name: 'Get All FIPs',
      endpoint: '/pfm/api/v2/fips',
      requestBody: {},
      fiType: 'SYSTEM'
    },
    {
      name: 'Get Brokers',
      endpoint: '/pfm/api/v2/brokers',
      requestBody: {},
      fiType: 'SYSTEM'
    },
    {
      name: 'FI Request User',
      endpoint: '/pfm/api/v2/firequest-user',
      requestBody: { uniqueIdentifier },
      fiType: 'SYSTEM'
    },
    {
      name: 'FI Request Account',
      endpoint: '/pfm/api/v2/firequest-account',
      requestBody: { uniqueIdentifier, accountId: 'SAVINGS-001' },
      fiType: 'SYSTEM'
    },
    {
      name: 'Account Consents Latest',
      endpoint: '/pfm/api/v2/account-consents-latest',
      requestBody: { uniqueIdentifier, accountId: 'SAVINGS-001' },
      fiType: 'SYSTEM'
    },
    {
      name: 'User Subscriptions',
      endpoint: '/pfm/api/v2/user-subscriptions',
      requestBody: {
        uniqueIdentifier,
        mobileNumber: '9876543210',
        subscriptionStatus: 'ACTIVE',
        subscriptionStart: '2024-01-01',
        subscriptionEnd: '2025-12-31'
      },
      fiType: 'SYSTEM'
    },
    {
      name: 'Get Mutual Funds',
      endpoint: '/pfm/api/v2/mutualfunds',
      requestBody: {},
      fiType: 'SYSTEM'
    },
    
    // ========== DEPOSIT APIs ==========
    {
      name: 'Deposit Linked Accounts',
      endpoint: '/pfm/api/v2/deposit/user-linked-accounts',
      requestBody: { uniqueIdentifier },
      fiType: 'DEPOSIT'
    },
    {
      name: 'Deposit User Details',
      endpoint: '/pfm/api/v2/deposit/user-details',
      requestBody: { uniqueIdentifier },
      fiType: 'DEPOSIT'
    },
    {
      name: 'Deposit Account Statement',
      endpoint: '/pfm/api/v2/deposit/user-account-statement',
      requestBody: { uniqueIdentifier, accountId: 'SAVINGS-001', dateRangeFrom },
      fiType: 'DEPOSIT'
    },
    {
      name: 'Deposit Account Statement Download',
      endpoint: '/pfm/api/v2/deposit/user-account-statement-download',
      requestBody: {},
      fiType: 'DEPOSIT'
    },
    {
      name: 'Deposit Insights',
      endpoint: '/pfm/api/v2/deposit/insights',
      requestBody: { uniqueIdentifier, accountIds: ['SAVINGS-001'], from: dateFrom, to: dateTo, frequency: 'MONTHLY' },
      fiType: 'DEPOSIT'
    },
    
    // ========== TERM DEPOSIT APIs ==========
    {
      name: 'Term Deposit Linked Accounts',
      endpoint: '/pfm/api/v2/term-deposit/user-linked-accounts',
      requestBody: { uniqueIdentifier },
      fiType: 'TERM_DEPOSIT'
    },
    {
      name: 'Term Deposit User Details',
      endpoint: '/pfm/api/v2/term-deposit/user-details',
      requestBody: { uniqueIdentifier },
      fiType: 'TERM_DEPOSIT'
    },
    {
      name: 'Term Deposit Account Statement',
      endpoint: '/pfm/api/v2/term-deposit/user-account-statement',
      requestBody: { uniqueIdentifier, accountId: 'TD-001', dateRangeFrom },
      fiType: 'TERM_DEPOSIT'
    },
    
    // ========== RECURRING DEPOSIT APIs ==========
    {
      name: 'Recurring Deposit Linked Accounts',
      endpoint: '/pfm/api/v2/recurring-deposit/user-linked-accounts',
      requestBody: { uniqueIdentifier },
      fiType: 'RECURRING_DEPOSIT'
    },
    {
      name: 'Recurring Deposit User Details',
      endpoint: '/pfm/api/v2/recurring-deposit/user-details',
      requestBody: { uniqueIdentifier },
      fiType: 'RECURRING_DEPOSIT'
    },
    {
      name: 'Recurring Deposit Account Statement',
      endpoint: '/pfm/api/v2/recurring-deposit/user-account-statement',
      requestBody: { uniqueIdentifier, accountId: 'RD-001', dateRangeFrom },
      fiType: 'RECURRING_DEPOSIT'
    },
    
    // ========== MUTUAL FUND APIs ==========
    {
      name: 'MF Linked Accounts',
      endpoint: '/pfm/api/v2/mutual-fund/user-linked-accounts',
      requestBody: { uniqueIdentifier, filterZeroValueAccounts: 'false', filterZeroValueHoldings: 'false' },
      fiType: 'MUTUAL_FUND'
    },
    {
      name: 'MF Holdings Folio',
      endpoint: '/pfm/api/v2/mutual-fund/user-linked-accounts/holding-folio',
      requestBody: { uniqueIdentifier, filterZeroValueAccounts: 'true', filterZeroValueHoldings: 'true' },
      fiType: 'MUTUAL_FUND'
    },
    {
      name: 'MF User Details',
      endpoint: '/pfm/api/v2/mutual-fund/user-details',
      requestBody: { uniqueIdentifier },
      fiType: 'MUTUAL_FUND'
    },
    {
      name: 'MF Account Statement',
      endpoint: '/pfm/api/v2/mutual-fund/user-account-statement',
      requestBody: { uniqueIdentifier, accountId: 'MF-001', dateRangeFrom },
      fiType: 'MUTUAL_FUND'
    },
    {
      name: 'MF Insights',
      endpoint: '/pfm/api/v2/mutual-fund/insights',
      requestBody: { uniqueIdentifier },
      fiType: 'MUTUAL_FUND'
    },
    {
      name: 'MF Analysis',
      endpoint: '/pfm/api/v2/mutual-fund/analysis',
      requestBody: { uniqueIdentifier, filterZeroValueAccounts: 'false', filterZeroValueHoldings: 'false' },
      fiType: 'MUTUAL_FUND'
    },
    {
      name: 'MF MFC Consent Request',
      endpoint: '/pfm/api/v2/mutual-fund/mfc/consent-request',
      requestBody: { uniqueIdentifier, pan: 'IJFGF4579B' },
      fiType: 'MUTUAL_FUND'
    },
    {
      name: 'MF MFC Consent Approve',
      endpoint: '/pfm/api/v2/mutual-fund/mfc/consent-approve',
      requestBody: { uniqueIdentifier, clientReferenceId: 'REF123', enteredOtp: '123456' },
      fiType: 'MUTUAL_FUND'
    },
    {
      name: 'MF Transactions',
      endpoint: '/pfm/api/v2/mutual-fund/user-linked-accounts/transactions',
      requestBody: { uniqueIdentifier, from: dateFrom, to: dateTo },
      fiType: 'MUTUAL_FUND'
    },
    
    // ========== ETF APIs ==========
    {
      name: 'ETF Linked Accounts',
      endpoint: '/pfm/api/v2/etf/user-linked-accounts',
      requestBody: { uniqueIdentifier, filterZeroValueAccounts: 'false', filterZeroValueHoldings: 'false' },
      fiType: 'ETF'
    },
    {
      name: 'ETF Holdings',
      endpoint: '/pfm/api/v2/etf/user-linked-accounts/holdings',
      requestBody: { uniqueIdentifier },
      fiType: 'ETF'
    },
    {
      name: 'ETF Insights',
      endpoint: '/pfm/api/v2/etf/insights',
      requestBody: { uniqueIdentifier },
      fiType: 'ETF'
    },
    {
      name: 'ETF Account Statement',
      endpoint: '/pfm/api/v2/etf/user-account-statement',
      requestBody: { uniqueIdentifier, accountId: 'ETF-001', dateRangeFrom },
      fiType: 'ETF'
    },
    
    // ========== EQUITY APIs ==========
    {
      name: 'Equity Holdings',
      endpoint: '/pfm/api/v2/equity/user-linked-accounts/holdings',
      requestBody: { uniqueIdentifier },
      fiType: 'EQUITY'
    },
    {
      name: 'Equity Transactions',
      endpoint: '/pfm/api/v2/equity/user-linked-accounts/transactions',
      requestBody: { uniqueIdentifier, from: dateFrom, to: dateTo },
      fiType: 'EQUITY'
    },
    {
      name: 'Equities Linked Accounts',
      endpoint: '/pfm/api/v2/equities/user-linked-accounts',
      requestBody: { uniqueIdentifier, filterZeroValueAccounts: 'false', filterZeroValueHoldings: 'false' },
      fiType: 'EQUITY'
    },
    {
      name: 'Equities Holding Broker',
      endpoint: '/pfm/api/v2/equities/user-linked-accounts/holding-broker',
      requestBody: { uniqueIdentifier, filterZeroValueAccounts: 'false', filterZeroValueHoldings: 'false' },
      fiType: 'EQUITY'
    },
    {
      name: 'Equities Demat Holding',
      endpoint: '/pfm/api/v2/equities/user-linked-accounts/demat-holding',
      requestBody: { uniqueIdentifier, filterZeroValueAccounts: 'false', filterZeroValueHoldings: 'false' },
      fiType: 'EQUITY'
    },
    {
      name: 'Equities Broker Holding',
      endpoint: '/pfm/api/v2/equities/user-linked-accounts/broker-holding',
      requestBody: { uniqueIdentifier, filterZeroValueAccounts: 'false', filterZeroValueHoldings: 'false' },
      fiType: 'EQUITY'
    },
    {
      name: 'Equities User Details',
      endpoint: '/pfm/api/v2/equities/user-details',
      requestBody: { uniqueIdentifier },
      fiType: 'EQUITY'
    },
    {
      name: 'Equities Account Statement',
      endpoint: '/pfm/api/v2/equities/user-account-statement',
      requestBody: { uniqueIdentifier, accountId: 'EQ-001', dateRangeFrom },
      fiType: 'EQUITY'
    },
    {
      name: 'Equities and ETFs Demat Holding',
      endpoint: '/pfm/api/v2/equities-and-etfs/user-linked-accounts/demat-holding',
      requestBody: { uniqueIdentifier, filterZeroValueAccounts: 'false', filterZeroValueHoldings: 'false' },
      fiType: 'EQUITY'
    },
    {
      name: 'Equities and ETFs Account Statement',
      endpoint: '/pfm/api/v2/equities-and-etfs/user-account-statement',
      requestBody: { uniqueIdentifier, accountId: 'EQ-001', dateRangeFrom },
      fiType: 'EQUITY'
    },
    
    // ========== NPS APIs ==========
    {
      name: 'NPS Linked Accounts',
      endpoint: '/pfm/api/v2/nps/user-linked-accounts',
      requestBody: { uniqueIdentifier },
      fiType: 'NPS'
    },
    {
      name: 'NPS Holdings',
      endpoint: '/pfm/api/v2/nps/user-linked-accounts/holdings',
      requestBody: { uniqueIdentifier },
      fiType: 'NPS'
    }
  ];
}

/**
 * Extract all fields from all FinFactor APIs
 */
export async function extractAllFinFactorApiFields(): Promise<ApiField[]> {
  const endpoints = getFinFactorApiEndpoints();
  const allFields: ApiField[] = [];
  const successCount = { count: 0 };
  const failedCount = { count: 0 };
  
  console.log(`📡 Calling ${endpoints.length} FinFactor APIs to extract fields...`);
  
  for (const apiConfig of endpoints) {
    try {
      console.log(`  📞 [${successCount.count + failedCount.count + 1}/${endpoints.length}] Calling ${apiConfig.name} (${apiConfig.endpoint})...`);
      const apiData = await extractApiFields(
        apiConfig.endpoint,
        apiConfig.requestBody,
        apiConfig.fiType
      );
      
      const totalFields = apiData.requestFields.length + apiData.responseFields.length;
      if (totalFields > 0) {
        allFields.push(...apiData.requestFields);
        allFields.push(...apiData.responseFields);
        successCount.count++;
        console.log(`  ✅ ${apiConfig.name}: ${apiData.requestFields.length} request + ${apiData.responseFields.length} response fields`);
      } else {
        failedCount.count++;
        console.warn(`  ⚠️  ${apiConfig.name}: No fields extracted (API may have returned empty response or error)`);
      }
    } catch (error: any) {
      failedCount.count++;
      console.error(`  ❌ Failed to extract from ${apiConfig.name}:`, error.message);
      // Still extract request fields even if API call fails
      try {
        const requestFields = extractFieldsFromObject(
          apiConfig.requestBody,
          '',
          'request',
          apiConfig.endpoint,
          apiConfig.fiType,
          false
        );
        if (requestFields.length > 0) {
          allFields.push(...requestFields);
          console.log(`  📝 Extracted ${requestFields.length} request fields from ${apiConfig.name} (despite API failure)`);
        }
      } catch (e) {
        // Ignore extraction errors
      }
    }
  }
  
  console.log(`✅ API Extraction Summary:`);
  console.log(`   📊 Total APIs: ${endpoints.length}`);
  console.log(`   ✅ Successful: ${successCount.count}`);
  console.log(`   ❌ Failed/Empty: ${failedCount.count}`);
  console.log(`   📝 Total FinFactor API fields extracted: ${allFields.length}`);
  return allFields;
}

