import { NextRequest, NextResponse } from 'next/server';
import { compareSchemas } from '@/lib/schema-comparison';
import { fetchRebitSchemasFromGitHub } from '@/lib/rebit-schema-parser';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl?.searchParams || new URL(request.url).searchParams;
    const includeApiFields = searchParams.get('includeApi') === 'true';
    
    // Try to fetch from GitHub first
    let rebitSchemas: Record<string, string> | undefined;
    
    try {
      rebitSchemas = await fetchRebitSchemasFromGitHub();
      console.log(`✅ Fetched ${Object.keys(rebitSchemas).length} REBIT schemas from GitHub`);
    } catch (error) {
      console.warn('⚠️  Could not fetch from GitHub, will use local files if available:', error);
      // If GitHub fails, the comparison will work with local files if provided
    }
    
    // Run comparison (will include API fields if APIs are accessible)
    const comparison = await compareSchemas(rebitSchemas);
    
    return NextResponse.json({
      success: true,
      data: comparison,
      metadata: {
        fetchedFromGitHub: !!rebitSchemas && Object.keys(rebitSchemas).length > 0,
        includesApiFields: includeApiFields,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error('Error comparing schemas:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to compare schemas',
        details: error.stack
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { rebitSchemas } = body;
    
    if (!rebitSchemas || typeof rebitSchemas !== 'object') {
      return NextResponse.json(
        { success: false, error: 'rebitSchemas must be an object with XSD file contents' },
        { status: 400 }
      );
    }
    
    // Run comparison with provided schemas
    const comparison = await compareSchemas(rebitSchemas);
    
    return NextResponse.json({
      success: true,
      data: comparison,
      metadata: {
        fetchedFromGitHub: false,
        source: 'manual_upload',
        timestamp: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error('Error comparing schemas:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to compare schemas',
        details: error.stack
      },
      { status: 500 }
    );
  }
}

