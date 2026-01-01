/**
 * REBIT SCHEMA PARSER
 * 
 * Parses XSD schema files from REBIT/Sahamati Account Aggregator standards
 * Supports both GitHub API access and local file parsing
 */

export interface RebitField {
  name: string;
  type: string;
  minOccurs?: number;
  maxOccurs?: number | 'unbounded';
  description?: string;
  parentElement?: string;
  fiType: string; // DEPOSIT, MUTUAL_FUND, EQUITY, etc.
  isRequired: boolean;
  path: string; // Full XPath-like path
}

export interface RebitSchema {
  fiType: string;
  version?: string;
  fields: RebitField[];
  source: 'github' | 'local';
  filePath?: string;
}

/**
 * Parse XSD file content and extract all elements
 */
export function parseXSDContent(xsdContent: string, fiType: string): RebitField[] {
  const fields: RebitField[] = [];
  
  if (!xsdContent || xsdContent.trim().length === 0) {
    console.warn(`⚠️  Empty XSD content for ${fiType}`);
    return fields;
  }
  
  // Remove comments and normalize whitespace
  const cleanContent = xsdContent
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  const seenFields = new Set<string>();
  
  // Pattern 1: Extract top-level element definitions
  // <xs:element name="fieldName" type="..." minOccurs="..." maxOccurs="..."/>
  // Also handles multi-line elements
  const elementRegex = /<xs:element\s+name=["']([^"']+)["'](?:\s+type=["']([^"']+)["'])?(?:\s+minOccurs=["']([^"']+)["'])?(?:\s+maxOccurs=["']([^"']+)["'])?(?:\s+[^>]*)?>/g;
  
  let match;
  while ((match = elementRegex.exec(cleanContent)) !== null) {
    const fieldName = match[1];
    const type = match[2] || 'string';
    const minOccurs = match[3] ? parseInt(match[3]) : 1;
    const maxOccurs = match[4] === 'unbounded' ? 'unbounded' : (match[4] ? parseInt(match[4]) : 1);
    
    const fieldKey = `${fiType}:${fieldName}`;
    if (seenFields.has(fieldKey)) continue;
    seenFields.add(fieldKey);
    
    fields.push({
      name: fieldName,
      type: normalizeXSDType(type),
      minOccurs,
      maxOccurs,
      isRequired: minOccurs > 0,
      fiType,
      path: `/${fiType.toLowerCase()}/${fieldName}`
    });
  }
  
  // Pattern 2: Extract complex types and their child elements (nested structures)
  const complexTypeRegex = /<xs:complexType\s+name=["']([^"']+)["']>([\s\S]*?)<\/xs:complexType>/g;
  while ((match = complexTypeRegex.exec(cleanContent)) !== null) {
    const complexTypeName = match[1];
    const complexTypeContent = match[2];
    
    // Extract child elements within complex type
    const childElementRegex = /<xs:element\s+name=["']([^"']+)["'](?:\s+type=["']([^"']+)["'])?(?:\s+minOccurs=["']([^"']+)["'])?(?:\s+maxOccurs=["']([^"']+)["'])?(?:\s+[^>]*)?>/g;
    let childMatch;
    
    while ((childMatch = childElementRegex.exec(complexTypeContent)) !== null) {
      const fieldName = childMatch[1];
      const type = childMatch[2] || 'string';
      const minOccurs = childMatch[3] ? parseInt(childMatch[3]) : 1;
      const maxOccurs = childMatch[4] === 'unbounded' ? 'unbounded' : (childMatch[4] ? parseInt(childMatch[4]) : 1);
      
      const fieldKey = `${fiType}:${complexTypeName}:${fieldName}`;
      if (seenFields.has(fieldKey)) continue;
      seenFields.add(fieldKey);
      
      fields.push({
        name: fieldName,
        type: normalizeXSDType(type),
        minOccurs,
        maxOccurs,
        isRequired: minOccurs > 0,
        fiType,
        parentElement: complexTypeName,
        path: `/${fiType.toLowerCase()}/${complexTypeName}/${fieldName}`
      });
    }
  }
  
  // Pattern 3: Extract elements from sequences (common in XSD)
  const sequenceRegex = /<xs:sequence>([\s\S]*?)<\/xs:sequence>/g;
  while ((match = sequenceRegex.exec(cleanContent)) !== null) {
    const sequenceContent = match[1];
    const seqElementRegex = /<xs:element\s+name=["']([^"']+)["'](?:\s+type=["']([^"']+)["'])?(?:\s+minOccurs=["']([^"']+)["'])?(?:\s+maxOccurs=["']([^"']+)["'])?(?:\s+[^>]*)?>/g;
    let seqMatch;
    
    while ((seqMatch = seqElementRegex.exec(sequenceContent)) !== null) {
      const fieldName = seqMatch[1];
      const type = seqMatch[2] || 'string';
      const minOccurs = seqMatch[3] ? parseInt(seqMatch[3]) : 1;
      const maxOccurs = seqMatch[4] === 'unbounded' ? 'unbounded' : (seqMatch[4] ? parseInt(seqMatch[4]) : 1);
      
      const fieldKey = `${fiType}:sequence:${fieldName}`;
      if (seenFields.has(fieldKey)) continue;
      seenFields.add(fieldKey);
      
      fields.push({
        name: fieldName,
        type: normalizeXSDType(type),
        minOccurs,
        maxOccurs,
        isRequired: minOccurs > 0,
        fiType,
        path: `/${fiType.toLowerCase()}/sequence/${fieldName}`
      });
    }
  }
  
  // Pattern 4: Extract attributes from elements
  const attributeRegex = /<xs:attribute\s+name=["']([^"']+)["'](?:\s+type=["']([^"']+)["'])?(?:\s+use=["']([^"']+)["'])?(?:\s+[^>]*)?>/g;
  while ((match = attributeRegex.exec(cleanContent)) !== null) {
    const attrName = match[1];
    const type = match[2] || 'string';
    const use = match[3] || 'optional';
    
    const fieldKey = `${fiType}:attribute:${attrName}`;
    if (seenFields.has(fieldKey)) continue;
    seenFields.add(fieldKey);
    
    fields.push({
      name: attrName,
      type: normalizeXSDType(type),
      minOccurs: use === 'required' ? 1 : 0,
      maxOccurs: 1,
      isRequired: use === 'required',
      fiType,
      path: `/${fiType.toLowerCase()}/@${attrName}`
    });
  }
  
  // Pattern 5: Extract from choice groups
  const choiceRegex = /<xs:choice(?:\s+[^>]*)?>([\s\S]*?)<\/xs:choice>/g;
  while ((match = choiceRegex.exec(cleanContent)) !== null) {
    const choiceContent = match[1];
    const choiceElementRegex = /<xs:element\s+name=["']([^"']+)["'](?:\s+type=["']([^"']+)["'])?(?:\s+minOccurs=["']([^"']+)["'])?(?:\s+maxOccurs=["']([^"']+)["'])?(?:\s+[^>]*)?>/g;
    let choiceMatch;
    
    while ((choiceMatch = choiceElementRegex.exec(choiceContent)) !== null) {
      const fieldName = choiceMatch[1];
      const type = choiceMatch[2] || 'string';
      const minOccurs = choiceMatch[3] ? parseInt(choiceMatch[3]) : 0;
      const maxOccurs = choiceMatch[4] === 'unbounded' ? 'unbounded' : (choiceMatch[4] ? parseInt(choiceMatch[4]) : 1);
      
      const fieldKey = `${fiType}:choice:${fieldName}`;
      if (seenFields.has(fieldKey)) continue;
      seenFields.add(fieldKey);
      
      fields.push({
        name: fieldName,
        type: normalizeXSDType(type),
        minOccurs,
        maxOccurs,
        isRequired: minOccurs > 0,
        fiType,
        path: `/${fiType.toLowerCase()}/choice/${fieldName}`
      });
    }
  }
  
  // Pattern 6: Extract from all elements (comprehensive catch-all)
  // This catches any element we might have missed
  const allElementRegex = /<xs:element\s+name=["']([^"']+)["']([^>]*?)>/g;
  while ((match = allElementRegex.exec(cleanContent)) !== null) {
    const fieldName = match[1];
    const attributes = match[2] || '';
    
    // Extract type from attributes
    const typeMatch = attributes.match(/type=["']([^"']+)["']/);
    const type = typeMatch ? typeMatch[1] : 'string';
    
    // Extract minOccurs/maxOccurs
    const minOccursMatch = attributes.match(/minOccurs=["']([^"']+)["']/);
    const maxOccursMatch = attributes.match(/maxOccurs=["']([^"']+)["']/);
    const minOccurs = minOccursMatch ? parseInt(minOccursMatch[1]) : 1;
    const maxOccurs = maxOccursMatch && maxOccursMatch[1] === 'unbounded' ? 'unbounded' : 
                      (maxOccursMatch ? parseInt(maxOccursMatch[1]) : 1);
    
    const fieldKey = `${fiType}:all:${fieldName}`;
    if (seenFields.has(fieldKey)) continue;
    seenFields.add(fieldKey);
    
    fields.push({
      name: fieldName,
      type: normalizeXSDType(type),
      minOccurs,
      maxOccurs,
      isRequired: minOccurs > 0,
      fiType,
      path: `/${fiType.toLowerCase()}/${fieldName}`
    });
  }
  
  // Pattern 4: Extract elements from choice groups
  const choiceGroupRegex = /<xs:choice(?:\s+[^>]*)?>([\s\S]*?)<\/xs:choice>/g;
  while ((match = choiceGroupRegex.exec(cleanContent)) !== null) {
    const choiceContent = match[1];
    const choiceElementRegex = /<xs:element\s+name=["']([^"']+)["'](?:\s+type=["']([^"']+)["'])?(?:\s+minOccurs=["']([^"']+)["'])?(?:\s+maxOccurs=["']([^"']+)["'])?(?:\s+[^>]*)?>/g;
    let choiceMatch;
    
    while ((choiceMatch = choiceElementRegex.exec(choiceContent)) !== null) {
      const fieldName = choiceMatch[1];
      const type = choiceMatch[2] || 'string';
      const minOccurs = choiceMatch[3] ? parseInt(choiceMatch[3]) : 0; // Choice elements are typically optional
      const maxOccurs = choiceMatch[4] === 'unbounded' ? 'unbounded' : (choiceMatch[4] ? parseInt(choiceMatch[4]) : 1);
      
      const fieldKey = `${fiType}:choice:${fieldName}`;
      if (seenFields.has(fieldKey)) continue;
      seenFields.add(fieldKey);
      
      fields.push({
        name: fieldName,
        type: normalizeXSDType(type),
        minOccurs,
        maxOccurs,
        isRequired: minOccurs > 0,
        fiType,
        path: `/${fiType.toLowerCase()}/choice/${fieldName}`
      });
    }
  }
  
  // Remove duplicates based on name (keep the first occurrence)
  const uniqueFields: RebitField[] = [];
  const nameSet = new Set<string>();
  
  for (const field of fields) {
    const nameKey = `${fiType}:${field.name}`;
    if (!nameSet.has(nameKey)) {
      nameSet.add(nameKey);
      uniqueFields.push(field);
    }
  }
  
  console.log(`✅ Parsed ${fiType}: ${uniqueFields.length} unique fields (${fields.length} total found)`);
  return uniqueFields;
}

/**
 * Normalize XSD types to common data types
 */
function normalizeXSDType(xsdType: string): string {
  const typeMap: Record<string, string> = {
    'xs:string': 'STRING',
    'xs:decimal': 'DECIMAL',
    'xs:integer': 'INTEGER',
    'xs:long': 'LONG',
    'xs:double': 'DOUBLE',
    'xs:float': 'FLOAT',
    'xs:boolean': 'BOOLEAN',
    'xs:date': 'DATE',
    'xs:dateTime': 'DATETIME',
    'xs:time': 'TIME',
    'xs:base64Binary': 'BINARY',
    'xs:anyType': 'ANY',
  };
  
  // Remove namespace prefix if present
  const cleanType = xsdType.replace(/^xs:/, '').toUpperCase();
  return typeMap[`xs:${cleanType.toLowerCase()}`] || cleanType || 'STRING';
}

/**
 * Fetch XSD files from GitHub repository
 */
/**
 * Dynamically discover all available FI types from GitHub
 */
async function discoverFITypesFromGitHub(): Promise<string[]> {
  try {
    const response = await fetch('https://api.github.com/repos/Sahamati/account-aggregator-standards/contents/schemas', {
      headers: {
        'User-Agent': 'FinFactor-Schema-Comparison/1.0',
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    if (!response.ok) {
      console.warn(`⚠️  Could not discover FI types from GitHub API (${response.status}), using fallback list`);
      return getFallbackFITypes();
    }
    
    const contents = await response.json();
    const fiTypes: string[] = [];
    
    for (const item of contents) {
      if (item.type === 'dir' && item.name !== 'readme.md' && !item.name.startsWith('.')) {
        fiTypes.push(item.name);
      }
    }
    
    console.log(`✅ Discovered ${fiTypes.length} FI types from GitHub: ${fiTypes.slice(0, 5).join(', ')}${fiTypes.length > 5 ? '...' : ''}`);
    return fiTypes;
  } catch (error: any) {
    console.warn('⚠️  Error discovering FI types, using fallback list:', error.message || error);
    return getFallbackFITypes();
  }
}

/**
 * Fallback list of FI types if GitHub API fails
 * Based on actual GitHub repository structure
 */
function getFallbackFITypes(): string[] {
  return [
    'alternative_investment_funds',
    'bonds',
    'certificates_of_deposit',
    'collective_investment_schemes',
    'commercial_paper',
    'credit_card',
    'debentures',
    'deposit',
    'employee_provident_fund',
    'equity_shares',
    'exchange_traded_funds',
    'government_securities',
    'indian_depository_receipts',
    'infrastructure_investment_trusts',
    'insurance_policies',
    'mutual_funds',
    'national_pension_system',
    'public_provident_fund',
    'real_estate_investment_trusts',
    'recurring_deposit',
    'systematic_investment_plan',
    'term_deposit',
    'unit_linked_insurance_plan'
  ];
}

export async function fetchRebitSchemasFromGitHub(): Promise<Record<string, string>> {
  const baseUrl = 'https://raw.githubusercontent.com/Sahamati/account-aggregator-standards/main/schemas';
  
  // Dynamically discover all available FI types
  const fiTypes = await discoverFITypesFromGitHub();
  
  const schemas: Record<string, string> = {};
  const fetchPromises: Promise<void>[] = [];
  
  for (const fiType of fiTypes) {
    const fetchPromise = (async () => {
      try {
        // Try standard naming: {fiType}/{fiType}.xsd
        let url = `${baseUrl}/${fiType}/${fiType}.xsd`;
        let response = await fetch(url, {
          headers: {
            'User-Agent': 'FinFactor-Schema-Comparison/1.0'
          }
        });
        
        // If that fails, try listing the directory to find the actual XSD file
        if (!response.ok) {
          try {
            const dirResponse = await fetch(`https://api.github.com/repos/Sahamati/account-aggregator-standards/contents/schemas/${fiType}`, {
              headers: {
                'User-Agent': 'FinFactor-Schema-Comparison/1.0',
                'Accept': 'application/vnd.github.v3+json'
              }
            });
            if (dirResponse.ok) {
              const dirContents = await dirResponse.json();
              if (Array.isArray(dirContents)) {
                // Find any XSD file in the directory
                const xsdFile = dirContents.find((item: any) => 
                  item.name.endsWith('.xsd') && item.type === 'file'
                );
                if (xsdFile && xsdFile.download_url) {
                  url = xsdFile.download_url;
                  response = await fetch(url, {
                    headers: {
                      'User-Agent': 'FinFactor-Schema-Comparison/1.0'
                    }
                  });
                } else {
                  // Try alternative naming patterns
                  const altNames = [
                    `${fiType.replace(/_/g, '-')}.xsd`,
                    `${fiType.replace(/-/g, '_')}.xsd`,
                    'schema.xsd',
                    'fi.xsd'
                  ];
                  for (const altName of altNames) {
                    const altFile = dirContents.find((item: any) => 
                      item.name === altName && item.type === 'file'
                    );
                    if (altFile && altFile.download_url) {
                      url = altFile.download_url;
                      response = await fetch(url, {
                        headers: {
                          'User-Agent': 'FinFactor-Schema-Comparison/1.0'
                        }
                      });
                      if (response.ok) break;
                    }
                  }
                }
              }
            }
          } catch (e: any) {
            // Ignore directory listing errors
            console.log(`⚠️  Could not list directory for ${fiType}: ${e.message || e}`);
          }
        }
        
        if (response.ok) {
          const content = await response.text();
          if (content && content.trim().length > 0 && content.includes('<?xml') || content.includes('<xs:schema')) {
            schemas[fiType] = content;
            console.log(`✅ Fetched ${fiType} schema (${content.length} bytes)`);
          } else {
            console.log(`⚠️  ${fiType} schema is empty or invalid`);
          }
        } else {
          console.log(`⚠️  ${fiType} schema not found (${response.status} ${response.statusText})`);
        }
      } catch (error: any) {
        console.error(`❌ Error fetching ${fiType}:`, error.message || error);
      }
    })();
    
    fetchPromises.push(fetchPromise);
  }
  
  // Wait for all fetches to complete
  await Promise.all(fetchPromises);
  
  console.log(`✅ Successfully fetched ${Object.keys(schemas).length} out of ${fiTypes.length} schemas`);
  return schemas;
}

/**
 * Parse all REBIT schemas and extract fields
 */
export async function parseAllRebitSchemas(
  schemas?: Record<string, string>
): Promise<RebitSchema[]> {
  let schemaContents: Record<string, string>;
  
  if (schemas) {
    schemaContents = schemas;
  } else {
    // Try to fetch from GitHub
    schemaContents = await fetchRebitSchemasFromGitHub();
  }
  
  const parsedSchemas: RebitSchema[] = [];
  
  for (const [fiType, xsdContent] of Object.entries(schemaContents)) {
    try {
      const fields = parseXSDContent(xsdContent, fiType.toUpperCase());
      
      parsedSchemas.push({
        fiType: fiType.toUpperCase(),
        fields,
        source: schemas ? 'local' : 'github'
      });
      
      console.log(`✅ Parsed ${fiType}: ${fields.length} fields`);
    } catch (error) {
      console.error(`❌ Error parsing ${fiType}:`, error);
    }
  }
  
  return parsedSchemas;
}

/**
 * Get all fields from REBIT schemas, flattened
 */
export async function getAllRebitFields(
  schemas?: Record<string, string>
): Promise<RebitField[]> {
  const parsedSchemas = await parseAllRebitSchemas(schemas);
  return parsedSchemas.flatMap(schema => schema.fields);
}

