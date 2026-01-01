/**
 * SCHEMA COMPARISON ENGINE
 * 
 * Compares FinFactor schema fields with REBIT schema fields
 * Identifies common, unique, and similar fields
 */

import { getAllRebitFields, RebitField } from './rebit-schema-parser';
import { extractAllFinFactorApiFields, ApiField } from './finfactor-api-extractor';
import * as fs from 'fs';
import * as path from 'path';

// Import types and functions inline since scripts folder is excluded from tsconfig
export interface SchemaField {
  tableName: string;
  fieldName: string;
  dataType: string;
  isNullable: boolean;
  hasDefault: boolean;
  isPrimaryKey: boolean;
  isUnique: boolean;
  layer: 'A' | 'B' | 'C';
  tableCategory: string;
  description?: string;
  source?: 'database' | 'api'; // Track if field comes from DB schema or API response
}

export function extractAllSchemaFields(): SchemaField[] {
  try {
    const schemaPath = path.join(process.cwd(), 'COMPLETE_SCHEMA.sql');
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Schema file not found at: ${schemaPath}`);
    }
    const sqlContent = fs.readFileSync(schemaPath, 'utf-8');
    return extractFieldsFromSchema(sqlContent);
  } catch (error: any) {
    throw new Error(`Failed to extract schema fields: ${error.message}`);
  }
}

function extractFieldsFromSchema(sqlContent: string): SchemaField[] {
  const fields: SchemaField[] = [];
  const lines = sqlContent.split('\n');
  
  const LAYER_A_TABLES = [
    'tsp_providers', 'aa_gateways', 'fips', 'brokers', 'mutual_fund_schemes',
    'app_users', 'user_subscriptions', 'subscription_usage_logs',
    'app_integration_apps', 'tsp_auth_tokens', 'tsp_auth_token_rotation_history',
    'tsp_api_calls', 'api_rate_limits',
    'aa_consent_requests', 'aa_redirect_events', 'aa_consents', 'aa_consent_events',
    'aa_data_fetch_runs', 'aa_fetch_payloads'
  ];
  
  const LAYER_B_TABLES = [
    'fi_accounts', 'fi_account_holders_pii',
    'fi_transactions', 'fi_mf_transactions', 'fi_equity_transactions', 'fi_etf_transactions'
  ];
  
  const LAYER_C_TABLES = [
    'fi_deposit_summaries', 'fi_term_deposit_summaries', 'fi_recurring_deposit_summaries',
    'fi_mutual_fund_summaries', 'fi_mutual_fund_holdings', 'fi_mutual_fund_txn_details', 'fi_mf_holding_prev_details',
    'fi_equity_summaries', 'fi_equity_holdings', 'fi_equity_txn_details',
    'fi_etf_holdings',
    'fi_nps_summaries', 'fi_nps_holdings',
    'fi_mf_insights', 'fi_equity_insights', 'fi_etf_insights', 'fi_deposit_insights',
    'user_financial_snapshots'
  ];
  
  function determineLayer(tableName: string): 'A' | 'B' | 'C' {
    if (LAYER_A_TABLES.includes(tableName)) return 'A';
    if (LAYER_B_TABLES.includes(tableName)) return 'B';
    if (LAYER_C_TABLES.includes(tableName)) return 'C';
    return 'A';
  }
  
  function getTableCategory(tableName: string, layer: 'A' | 'B' | 'C'): string {
    if (layer === 'A') {
      if (['tsp_providers', 'aa_gateways', 'fips', 'brokers', 'mutual_fund_schemes'].includes(tableName)) {
        return 'Infrastructure';
      }
      if (['app_users', 'user_subscriptions', 'subscription_usage_logs'].includes(tableName)) {
        return 'User Management';
      }
      if (['app_integration_apps', 'tsp_auth_tokens', 'tsp_auth_token_rotation_history'].includes(tableName)) {
        return 'Authentication';
      }
      if (['tsp_api_calls', 'api_rate_limits'].includes(tableName)) {
        return 'API Tracking';
      }
      if (['aa_consent_requests', 'aa_redirect_events', 'aa_consents', 'aa_consent_events'].includes(tableName)) {
        return 'Consent Management';
      }
      if (['aa_data_fetch_runs', 'aa_fetch_payloads'].includes(tableName)) {
        return 'Data Fetch';
      }
    }
    
    if (layer === 'B') {
      if (tableName === 'fi_accounts') return 'Accounts';
      if (tableName === 'fi_account_holders_pii') return 'Account Holders';
      if (tableName.startsWith('fi_transactions')) return 'Transactions';
      if (tableName.startsWith('fi_mf_transactions')) return 'MF Transactions';
      if (tableName.startsWith('fi_equity_transactions')) return 'Equity Transactions';
      if (tableName.startsWith('fi_etf_transactions')) return 'ETF Transactions';
    }
    
    if (layer === 'C') {
      if (tableName.includes('deposit')) return 'Deposit Summaries';
      if (tableName.includes('mutual_fund') || tableName.includes('mf_')) return 'Mutual Fund';
      if (tableName.includes('equity')) return 'Equity';
      if (tableName.includes('etf')) return 'ETF';
      if (tableName.includes('nps')) return 'NPS';
      if (tableName.includes('insights')) return 'Insights';
      if (tableName.includes('snapshot')) return 'Snapshots';
    }
    
    return 'Other';
  }
  
  function parseDataType(fieldDef: string): string {
    // More comprehensive type matching
    const typePatterns = [
      /VARCHAR\s*\([^)]+\)/i,
      /TEXT\[\]/i,
      /TEXT\b/i,
      /INTEGER\b/i,
      /BIGINT\b/i,
      /SMALLINT\b/i,
      /NUMERIC\s*\([^)]+\)/i,
      /NUMERIC\b/i,
      /DECIMAL\s*\([^)]+\)/i,
      /DECIMAL\b/i,
      /BOOLEAN\b/i,
      /UUID\b/i,
      /TIMESTAMPTZ\b/i,
      /TIMESTAMP\b/i,
      /DATE\b/i,
      /TIME\b/i,
      /JSONB\b/i,
      /JSON\b/i,
      /INET\b/i,
      /CIDR\b/i,
      /MACADDR\b/i,
      /BYTEA\b/i,
      /ARRAY\b/i,
      /SERIAL\b/i,
      /BIGSERIAL\b/i
    ];
    
    for (const pattern of typePatterns) {
      const match = fieldDef.match(pattern);
      if (match) {
        return match[0].toUpperCase().trim();
      }
    }
    
    // Fallback: extract first word as type
    const firstWord = fieldDef.trim().split(/\s+/)[0];
    if (firstWord) {
      return firstWord.toUpperCase();
    }
    
    return 'UNKNOWN';
  }
  
  let currentTable: string | null = null;
  let currentLayer: 'A' | 'B' | 'C' = 'A';
  let inTableDefinition = false;
  let currentFieldBuffer = ''; // For multi-line field definitions
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Detect table creation
    const tableMatch = trimmed.match(/CREATE TABLE IF NOT EXISTS\s+(\w+)/i);
    if (tableMatch) {
      currentTable = tableMatch[1];
      currentLayer = determineLayer(currentTable);
      inTableDefinition = true;
      currentFieldBuffer = '';
      continue;
    }
    
    // Detect end of table definition
    if (inTableDefinition && trimmed.startsWith(');')) {
      // Process any remaining field buffer
      if (currentFieldBuffer.trim()) {
        const fieldMatch = currentFieldBuffer.match(/^\s*(\w+)\s+([\s\S]+?)(?:\s*,\s*$|\s*$)/);
        if (fieldMatch) {
          const fieldName = fieldMatch[1];
          const fieldDef = fieldMatch[2].trim().replace(/,\s*$/, '');
          
          if (fieldName !== 'CONSTRAINT' && fieldName !== 'PRIMARY' && fieldName !== 'FOREIGN') {
            const dataType = parseDataType(fieldDef);
            const isNullable = !fieldDef.includes('NOT NULL');
            const hasDefault = fieldDef.includes('DEFAULT');
            const isPrimaryKey = fieldDef.includes('PRIMARY KEY');
            const isUnique = fieldDef.includes('UNIQUE') || fieldDef.includes('UNIQUE');
            
            fields.push({
              tableName: currentTable!,
              fieldName,
              dataType,
              isNullable,
              hasDefault,
              isPrimaryKey,
              isUnique,
              layer: currentLayer,
              tableCategory: getTableCategory(currentTable!, currentLayer),
              description: undefined
            });
          }
        }
      }
      inTableDefinition = false;
      currentTable = null;
      currentFieldBuffer = '';
      continue;
    }
    
    // Skip comments and constraints
    if (inTableDefinition && currentTable) {
      if (trimmed.startsWith('--') || trimmed.startsWith('CONSTRAINT') || trimmed.startsWith('PRIMARY KEY') || trimmed.startsWith('FOREIGN KEY')) {
        continue;
      }
      
      // Handle field definitions (single line or multi-line)
      // Check if this line contains a field definition
      const fieldMatch = trimmed.match(/^\s*(\w+)\s+(.+?)(?:\s*,\s*$|\s*$)/);
      
      if (fieldMatch) {
        // Single-line field definition
        const fieldName = fieldMatch[1];
        let fieldDef = fieldMatch[2].trim();
        
        // Remove trailing comma if present
        fieldDef = fieldDef.replace(/,\s*$/, '');
        
        // Skip constraints
        if (fieldName === 'CONSTRAINT' || fieldName === 'PRIMARY' || fieldName === 'FOREIGN') {
          continue;
        }
        
        const dataType = parseDataType(fieldDef);
        const isNullable = !fieldDef.includes('NOT NULL');
        const hasDefault = fieldDef.includes('DEFAULT');
        const isPrimaryKey = fieldDef.includes('PRIMARY KEY');
        const isUnique = fieldDef.includes('UNIQUE');
        
        fields.push({
          tableName: currentTable,
          fieldName,
          dataType,
          isNullable,
          hasDefault,
          isPrimaryKey,
          isUnique,
          layer: currentLayer,
          tableCategory: getTableCategory(currentTable, currentLayer),
          description: undefined
        });
      } else if (trimmed && !trimmed.match(/^(CREATE|ALTER|DROP|INDEX|COMMENT)/i)) {
        // Multi-line field definition - accumulate
        currentFieldBuffer += ' ' + trimmed;
        
        // If line ends with comma, process the accumulated buffer
        if (trimmed.endsWith(',')) {
          const fieldMatch = currentFieldBuffer.match(/^\s*(\w+)\s+([\s\S]+?)(?:\s*,\s*$|\s*$)/);
          if (fieldMatch) {
            const fieldName = fieldMatch[1];
            let fieldDef = fieldMatch[2].trim().replace(/,\s*$/, '');
            
            if (fieldName !== 'CONSTRAINT' && fieldName !== 'PRIMARY' && fieldName !== 'FOREIGN') {
              const dataType = parseDataType(fieldDef);
              const isNullable = !fieldDef.includes('NOT NULL');
              const hasDefault = fieldDef.includes('DEFAULT');
              const isPrimaryKey = fieldDef.includes('PRIMARY KEY');
              const isUnique = fieldDef.includes('UNIQUE');
              
              fields.push({
                tableName: currentTable,
                fieldName,
                dataType,
                isNullable,
                hasDefault,
                isPrimaryKey,
                isUnique,
                layer: currentLayer,
                tableCategory: getTableCategory(currentTable, currentLayer),
                description: undefined
              });
            }
            currentFieldBuffer = '';
          }
        }
      }
    }
  }
  
  return fields;
}

export interface FieldComparison {
  fieldName: string;
  normalizedName: string;
  finfactorField?: SchemaField;
  rebitField?: RebitField;
  status: 'common' | 'finfactor-only' | 'rebit-only' | 'similar';
  similarityScore?: number;
  dataTypeMatch: boolean;
  notes?: string;
}

export interface ComparisonResult {
  totalFinfactorFields: number;
  totalRebitFields: number;
  commonFields: number;
  finfactorOnlyFields: number;
  rebitOnlyFields: number;
  similarFields: number;
  comparisons: FieldComparison[];
  byLayer: {
    A: { total: number; common: number; unique: number };
    B: { total: number; common: number; unique: number };
    C: { total: number; common: number; unique: number };
  };
  byFIType: Record<string, {
    total: number;
    common: number;
    finfactorOnly: number;
    rebitOnly: number;
  }>;
}

/**
 * Normalize field names for comparison
 * Less aggressive normalization to preserve more matching opportunities
 */
function normalizeFieldName(name: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/[_\s-]/g, '') // Remove underscores, spaces, hyphens
    .replace(/^fi/, '') // Remove 'fi' prefix
    .trim();
  // Note: Removed .replace(/id$/g, '') to preserve 'id' suffix for better matching
}

/**
 * Calculate similarity between two field names
 */
function calculateSimilarity(name1: string, name2: string): number {
  const norm1 = normalizeFieldName(name1);
  const norm2 = normalizeFieldName(name2);
  
  if (norm1 === norm2) return 1.0;
  
  // Check if one contains the other
  if (norm1.includes(norm2) || norm2.includes(norm1)) {
    return 0.8;
  }
  
  // Levenshtein distance-based similarity
  const maxLen = Math.max(norm1.length, norm2.length);
  if (maxLen === 0) return 1.0;
  
  const distance = levenshteinDistance(norm1, norm2);
  return 1 - (distance / maxLen);
}

/**
 * Levenshtein distance calculation
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

/**
 * Map data types for comparison
 */
function areTypesCompatible(type1: string, type2: string): boolean {
  const type1Norm = type1.toUpperCase();
  const type2Norm = type2.toUpperCase();
  
  if (type1Norm === type2Norm) return true;
  
  // Compatible type groups
  const numericTypes = ['INTEGER', 'BIGINT', 'NUMERIC', 'DECIMAL', 'LONG', 'DOUBLE', 'FLOAT'];
  const stringTypes = ['VARCHAR', 'TEXT', 'STRING'];
  const dateTypes = ['DATE', 'DATETIME', 'TIMESTAMPTZ', 'TIMESTAMP'];
  
  if (numericTypes.includes(type1Norm) && numericTypes.includes(type2Norm)) return true;
  if (stringTypes.includes(type1Norm) && stringTypes.includes(type2Norm)) return true;
  if (dateTypes.includes(type1Norm) && dateTypes.includes(type2Norm)) return true;
  
  return false;
}

/**
 * Map FinFactor table to REBIT FI type
 */
function mapTableToFIType(tableName: string): string[] {
  const mapping: Record<string, string[]> = {
    'fi_accounts': ['DEPOSIT', 'MUTUAL_FUND', 'EQUITY', 'ETF', 'NPS'],
    'fi_transactions': ['DEPOSIT'],
    'fi_mf_transactions': ['MUTUAL_FUND'],
    'fi_equity_transactions': ['EQUITY'],
    'fi_etf_transactions': ['ETF'],
    'fi_deposit_summaries': ['DEPOSIT'],
    'fi_term_deposit_summaries': ['TERM_DEPOSIT'],
    'fi_recurring_deposit_summaries': ['RECURRING_DEPOSIT'],
    'fi_mutual_fund_summaries': ['MUTUAL_FUND'],
    'fi_mutual_fund_holdings': ['MUTUAL_FUND'],
    'fi_equity_summaries': ['EQUITY'],
    'fi_equity_holdings': ['EQUITY'],
    'fi_etf_holdings': ['ETF'],
    'fi_nps_summaries': ['NPS'],
    'fi_nps_holdings': ['NPS'],
  };
  
  return mapping[tableName] || ['UNKNOWN'];
}

/**
 * Compare FinFactor and REBIT schemas
 */
export async function compareSchemas(
  rebitSchemas?: Record<string, string>
): Promise<ComparisonResult> {
  console.log('🔍 Starting comprehensive schema comparison...');
  
  // Extract all fields from multiple sources
  console.log('📊 Extracting FinFactor fields from COMPLETE_SCHEMA.sql...');
  const finfactorDbFields = extractAllSchemaFields();
  console.log(`✅ Extracted ${finfactorDbFields.length} FinFactor DB fields`);
  
  // Extract fields from actual FinFactor API calls
  console.log('📡 Extracting FinFactor fields from actual API calls...');
  let finfactorApiFields: ApiField[] = [];
  try {
    finfactorApiFields = await extractAllFinFactorApiFields();
    console.log(`✅ Extracted ${finfactorApiFields.length} FinFactor API fields`);
  } catch (error: any) {
    console.warn(`⚠️  Could not extract API fields (API may be unavailable): ${error.message}`);
    console.warn('   Continuing with database fields only...');
  }
  
  // Combine DB and API fields
  const finfactorFields: SchemaField[] = finfactorDbFields.map(f => ({
    ...f,
    source: 'database' as const
  }));
  
  // Add API fields as SchemaField objects
  finfactorApiFields.forEach(apiField => {
    finfactorFields.push({
      tableName: `api:${apiField.endpoint}`,
      fieldName: apiField.name,
      dataType: apiField.type,
      isNullable: !apiField.isRequired,
      hasDefault: false,
      isPrimaryKey: false,
      isUnique: false,
      layer: apiField.source === 'request' ? 'A' : (apiField.fiType === 'SYSTEM' ? 'A' : 'B'),
      tableCategory: `${apiField.source} - ${apiField.endpoint}`,
      description: apiField.description || `${apiField.source} field from ${apiField.endpoint}`,
      source: 'api' as const
    });
  });
  
  console.log(`✅ Total FinFactor fields: ${finfactorFields.length} (${finfactorDbFields.length} DB + ${finfactorApiFields.length} API)`);
  
  // Group by table for validation
  const fieldsByTable = new Map<string, number>();
  finfactorFields.forEach(field => {
    const count = fieldsByTable.get(field.tableName) || 0;
    fieldsByTable.set(field.tableName, count + 1);
  });
  console.log(`📋 Found fields in ${fieldsByTable.size} tables/endpoints`);
  
  console.log('📊 Fetching and parsing REBIT schemas...');
  const rebitFields = await getAllRebitFields(rebitSchemas);
  console.log(`✅ Extracted ${rebitFields.length} REBIT fields`);
  
  // Group by FI type for validation
  const fieldsByFIType = new Map<string, number>();
  rebitFields.forEach(field => {
    const count = fieldsByFIType.get(field.fiType) || 0;
    fieldsByFIType.set(field.fiType, count + 1);
  });
  console.log(`📋 Found fields in ${fieldsByFIType.size} REBIT FI types`);
  
  // Create maps for quick lookup
  const finfactorMap = new Map<string, SchemaField[]>();
  const rebitMap = new Map<string, RebitField[]>();
  
  finfactorFields.forEach(field => {
    const key = normalizeFieldName(field.fieldName);
    if (!finfactorMap.has(key)) {
      finfactorMap.set(key, []);
    }
    finfactorMap.get(key)!.push(field);
  });
  
  rebitFields.forEach(field => {
    const key = normalizeFieldName(field.name);
    if (!rebitMap.has(key)) {
      rebitMap.set(key, []);
    }
    rebitMap.get(key)!.push(field);
  });
  
  // Perform comparison
  const comparisons: FieldComparison[] = [];
  const processedRebitFields = new Set<string>();
  
  // Process FinFactor fields - improved matching to find more common fields
  finfactorFields.forEach(ffField => {
    const normalizedName = normalizeFieldName(ffField.fieldName);
    let rebitMatches = rebitMap.get(normalizedName) || [];
    let bestMatch: RebitField | null = null;
    let bestSimilarity = 0;
    
    // First try exact normalized match
    if (rebitMatches.length > 0) {
      bestMatch = rebitMatches[0];
      bestSimilarity = calculateSimilarity(ffField.fieldName, bestMatch.name);
    } else {
      // If no exact match, search all REBIT fields for similar ones
      // This ensures we don't miss matches due to normalization differences
      for (const rebitField of rebitFields) {
        const similarity = calculateSimilarity(ffField.fieldName, rebitField.name);
        if (similarity > bestSimilarity && similarity >= 0.7) { // Lower threshold to catch more matches
          bestSimilarity = similarity;
          bestMatch = rebitField;
        }
      }
    }
    
    if (bestMatch && bestSimilarity >= 0.7) {
      // Found a match - mark as common if similarity is high enough
      const isCommon = bestSimilarity >= 0.8; // Lower threshold from 0.9 to 0.8
      
      comparisons.push({
        fieldName: ffField.fieldName,
        normalizedName,
        finfactorField: ffField,
        rebitField: bestMatch,
        status: isCommon ? 'common' : 'similar',
        similarityScore: bestSimilarity,
        dataTypeMatch: areTypesCompatible(ffField.dataType, bestMatch.type),
        notes: bestSimilarity < 1.0 ? `Similar to REBIT field: ${bestMatch.name}` : undefined
      });
      
      processedRebitFields.add(bestMatch.name);
    } else {
      // FinFactor only
      comparisons.push({
        fieldName: ffField.fieldName,
        normalizedName,
        finfactorField: ffField,
        status: 'finfactor-only',
        dataTypeMatch: false
      });
    }
  });
  
  // Process remaining REBIT fields (REBIT-only)
  rebitFields.forEach(rebitField => {
    if (!processedRebitFields.has(rebitField.name)) {
      const normalizedName = normalizeFieldName(rebitField.name);
      const ffMatches = finfactorMap.get(normalizedName) || [];
      
      if (ffMatches.length === 0) {
        comparisons.push({
          fieldName: rebitField.name,
          normalizedName,
          rebitField,
          status: 'rebit-only',
          dataTypeMatch: false
        });
      }
    }
  });
  
  // Calculate statistics
  const stats = {
    totalFinfactorFields: finfactorFields.length,
    totalRebitFields: rebitFields.length,
    commonFields: comparisons.filter(c => c.status === 'common').length,
    finfactorOnlyFields: comparisons.filter(c => c.status === 'finfactor-only').length,
    rebitOnlyFields: comparisons.filter(c => c.status === 'rebit-only').length,
    similarFields: comparisons.filter(c => c.status === 'similar').length,
    comparisons,
    byLayer: {
      A: { total: 0, common: 0, unique: 0 },
      B: { total: 0, common: 0, unique: 0 },
      C: { total: 0, common: 0, unique: 0 }
    },
    byFIType: {} as Record<string, any>
  };
  
  // Calculate by layer
  comparisons.forEach(comp => {
    if (comp.finfactorField) {
      const layer = comp.finfactorField.layer;
      stats.byLayer[layer].total++;
      if (comp.status === 'common') {
        stats.byLayer[layer].common++;
      } else if (comp.status === 'finfactor-only') {
        stats.byLayer[layer].unique++;
      }
      // Note: similar fields are counted as common for layer stats
      if (comp.status === 'similar') {
        stats.byLayer[layer].common++;
      }
    }
  });
  
  // Verify total calculation: Layer A + B + C + REBIT-only should equal total comparisons
  const calculatedTotal = 
    stats.byLayer.A.total + 
    stats.byLayer.B.total + 
    stats.byLayer.C.total + 
    stats.rebitOnlyFields;
  
  if (calculatedTotal !== comparisons.length) {
    console.warn(`⚠️ Total mismatch: ${calculatedTotal} (A+B+C+REBIT) vs ${comparisons.length} (total comparisons)`);
  }
  
  // Final validation summary
  console.log('\n📊 Comparison Summary:');
  console.log(`   FinFactor Fields: ${stats.totalFinfactorFields}`);
  console.log(`   REBIT Fields: ${stats.totalRebitFields}`);
  console.log(`   Common: ${stats.commonFields}`);
  console.log(`   FinFactor Only: ${stats.finfactorOnlyFields}`);
  console.log(`   REBIT Only: ${stats.rebitOnlyFields}`);
  console.log(`   Similar: ${stats.similarFields}`);
  console.log(`   Total Comparisons: ${comparisons.length}`);
  console.log(`   Layer A: ${stats.byLayer.A.total} (${stats.byLayer.A.common} common, ${stats.byLayer.A.unique} unique)`);
  console.log(`   Layer B: ${stats.byLayer.B.total} (${stats.byLayer.B.common} common, ${stats.byLayer.B.unique} unique)`);
  console.log(`   Layer C: ${stats.byLayer.C.total} (${stats.byLayer.C.common} common, ${stats.byLayer.C.unique} unique)`);
  console.log('✅ Schema comparison completed successfully\n');
  
  // Calculate by FI type
  comparisons.forEach(comp => {
    if (comp.rebitField) {
      const fiType = comp.rebitField.fiType;
      if (!stats.byFIType[fiType]) {
        stats.byFIType[fiType] = { total: 0, common: 0, finfactorOnly: 0, rebitOnly: 0 };
      }
      stats.byFIType[fiType].total++;
      if (comp.status === 'common' || comp.status === 'similar') {
        stats.byFIType[fiType].common++;
      } else if (comp.status === 'rebit-only') {
        stats.byFIType[fiType].rebitOnly++;
      }
    }
    if (comp.finfactorField && !comp.rebitField) {
      const fiTypes = mapTableToFIType(comp.finfactorField.tableName);
      fiTypes.forEach(fiType => {
        if (!stats.byFIType[fiType]) {
          stats.byFIType[fiType] = { total: 0, common: 0, finfactorOnly: 0, rebitOnly: 0 };
        }
        stats.byFIType[fiType].finfactorOnly++;
      });
    }
  });
  
  return stats;
}

