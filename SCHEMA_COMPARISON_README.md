# 🔍 Schema Comparison: FinFactor vs REBIT

## Overview

This feature provides a comprehensive comparison between:
- **FinFactor API** data points (from your current schema)
- **REBIT/Sahamati Account Aggregator Standards** (from GitHub repository)

## 🎯 Purpose

Identify:
- ✅ **Common fields** - Present in both schemas
- 🟠 **FinFactor-only fields** - Unique to FinFactor API
- 🔵 **REBIT-only fields** - Unique to REBIT standards
- 🟡 **Similar fields** - Different names but same purpose

## 📍 Access

Navigate to: **`/schema-comparison`** in your application

Or click the "Schema Comparison" link in the API Reference page navigation.

## 🔧 How It Works

### Automatic Mode (GitHub Access)

The system automatically:
1. Fetches XSD schema files from [Sahamati GitHub repository](https://github.com/Sahamati/account-aggregator-standards)
2. Parses all field definitions from XSD files
3. Extracts all fields from your `COMPLETE_SCHEMA.sql`
4. Compares and matches fields using:
   - Exact name matching
   - Normalized name matching (removes underscores, case-insensitive)
   - Similarity scoring (Levenshtein distance)
   - Data type compatibility checking

### Manual Mode (If GitHub Access Fails)

If automatic GitHub fetching fails, you can manually provide XSD files:

1. **Download XSD files** from the GitHub repository:
   - Go to: https://github.com/Sahamati/account-aggregator-standards/tree/main/schemas
   - Download XSD files for each FI type (deposit, mutual_fund, equity, etc.)

2. **Upload via API**:
   ```bash
   curl -X POST http://localhost:3000/api/schema-comparison \
     -H "Content-Type: application/json" \
     -d '{
       "rebitSchemas": {
         "deposit": "<XSD_CONTENT_HERE>",
         "mutual_fund": "<XSD_CONTENT_HERE>",
         ...
       }
     }'
   ```

3. **Or create a local file**:
   - Create `data/rebit-schemas/` directory
   - Place XSD files there with naming: `{fi_type}.xsd`
   - The system will automatically detect and use them

## 📊 Features

### Filtering
- **By Status**: Common, FinFactor-only, REBIT-only, Similar
- **By Layer**: Layer A, B, or C
- **By FI Type**: Deposit, Mutual Fund, Equity, ETF, NPS, etc.
- **Search**: Field names, table names

### Statistics
- Total fields count
- Common fields count
- Unique fields per source
- Similar fields count
- Breakdown by layer and FI type

### Visual Indicators
- 🟢 **Green badge**: Common fields
- 🟠 **Orange badge**: FinFactor-only
- 🔵 **Blue badge**: REBIT-only
- 🟡 **Yellow badge**: Similar fields

## 🔍 Field Extraction Details

### FinFactor Schema Extraction
- Parses `COMPLETE_SCHEMA.sql` file
- Extracts **EVERY column** from **EVERY table**
- Captures:
  - Field name
  - Data type
  - Nullability
  - Default values
  - Primary key/Unique constraints
  - Layer assignment (A/B/C)
  - Table category

### REBIT Schema Extraction
- Parses XSD schema files
- Extracts all `<xs:element>` definitions
- Captures:
  - Element name
  - Data type
  - minOccurs/maxOccurs (required/optional)
  - Complex type hierarchies
  - Parent elements

## ⚠️ Important Notes

### Ensuring No Data Points Are Missed

The system is designed to be **comprehensive**:

1. **FinFactor Extraction**:
   - Uses regex pattern matching to find ALL `CREATE TABLE` statements
   - Extracts ALL field definitions within each table
   - Handles multi-line field definitions
   - Skips only comments and constraints

2. **REBIT Extraction**:
   - Parses ALL `<xs:element>` tags
   - Handles nested complex types
   - Extracts child elements from complex types
   - Tracks all field paths

3. **Comparison**:
   - Uses multiple matching strategies:
     - Exact match
     - Normalized match (case-insensitive, no underscores)
     - Similarity match (fuzzy matching)
   - Every field is categorized (common/unique/similar)

### Validation

To verify no fields are missed:

1. **Check the statistics**:
   - Total FinFactor fields should match your schema
   - Total REBIT fields should match XSD files

2. **Review the table**:
   - Every field should have a status badge
   - No field should be unaccounted for

3. **Export and verify** (coming soon):
   - Export comparison to CSV/JSON
   - Manually verify field counts

## 🛠️ Troubleshooting

### GitHub Access Issues

If you see "Could not fetch from GitHub":
1. Check internet connection
2. Verify GitHub is accessible
3. Use manual mode (see above)

### Missing Fields

If fields appear to be missing:
1. Check that `COMPLETE_SCHEMA.sql` is in the project root
2. Verify XSD files are properly formatted
3. Check browser console for errors
4. Review API response in Network tab

### Performance

For large schemas:
- Comparison may take a few seconds
- Results are cached in browser
- Use filters to narrow down results

## 📝 File Structure

```
project/
├── app/
│   ├── schema-comparison/
│   │   └── page.tsx          # Main UI
│   └── api/
│       └── schema-comparison/
│           └── route.ts     # API endpoint
├── lib/
│   ├── schema-comparison.ts  # Comparison engine
│   └── rebit-schema-parser.ts # XSD parser
├── scripts/
│   └── extract-schema-fields.ts # Field extractor
├── data/
│   └── rebit-schemas/        # Optional: local XSD files
└── COMPLETE_SCHEMA.sql       # Your schema file
```

## 🚀 Next Steps

1. **Access the page**: Navigate to `/schema-comparison`
2. **Review statistics**: Check the summary cards
3. **Filter and search**: Use filters to find specific fields
4. **Identify gaps**: Look for REBIT-only fields you might need
5. **Plan integration**: Use comparison to plan REBIT compliance

## 📞 Support

If you encounter issues:
1. Check browser console for errors
2. Verify all files are in place
3. Check API endpoint response
4. Review this README

---

**Last Updated**: 2025-01-XX
**Version**: 1.0.0

