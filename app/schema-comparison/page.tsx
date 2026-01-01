'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import type { ComparisonResult, FieldComparison } from '@/lib/schema-comparison';

// Force dynamic rendering - prevent static generation
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default function SchemaComparisonPage() {
  const [comparisonData, setComparisonData] = useState<ComparisonResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeLayerTab, setActiveLayerTab] = useState<'all' | 'A' | 'B' | 'C'>('all');
  const [activeStatusTab, setActiveStatusTab] = useState<'all' | 'common' | 'finfactor-only' | 'rebit-only'>('all');
  const [filters, setFilters] = useState({
    search: '',
    fiType: 'all' as string
  });

  useEffect(() => {
    loadComparison();
  }, []);

  const loadComparison = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/schema-comparison');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (!result) {
        throw new Error('Empty response from server');
      }
      
      if (result.success && result.data) {
        // Validate data structure
        if (!result.data.comparisons || !Array.isArray(result.data.comparisons)) {
          throw new Error('Invalid data structure: comparisons array missing');
        }
        
        setComparisonData(result.data);
        
        // Debug: Log some statistics
        console.log('✅ Schema comparison loaded:', {
          total: result.data.comparisons.length,
          common: result.data.commonFields,
          finfactorOnly: result.data.finfactorOnlyFields,
          rebitOnly: result.data.rebitOnlyFields,
          byLayer: result.data.byLayer,
          calculatedTotal: (result.data.byLayer?.A?.total || 0) + 
                           (result.data.byLayer?.B?.total || 0) + 
                           (result.data.byLayer?.C?.total || 0) + 
                           (result.data.rebitOnlyFields || 0),
          commonInLayerA: result.data.comparisons.filter((c: FieldComparison) => 
            c.status === 'common' && c.finfactorField?.layer === 'A'
          ).length,
          commonInLayerB: result.data.comparisons.filter((c: FieldComparison) => 
            c.status === 'common' && c.finfactorField?.layer === 'B'
          ).length,
          commonInLayerC: result.data.comparisons.filter((c: FieldComparison) => 
            c.status === 'common' && c.finfactorField?.layer === 'C'
          ).length,
        });
      } else {
        const errorMsg = result.error || 'Failed to load comparison data';
        setError(errorMsg);
        console.error('❌ API returned error:', result);
      }
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to fetch comparison data';
      setError(errorMsg);
      console.error('❌ Error loading comparison:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      'common': { label: 'Common', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
      'finfactor-only': { label: 'FinFactor Only', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
      'rebit-only': { label: 'REBIT Only', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
      'similar': { label: 'Similar', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' }
    };
    
    const badge = badges[status as keyof typeof badges] || badges['common'];
    return (
      <span className={`px-2 py-1 rounded text-xs font-semibold border ${badge.color}`}>
        {badge.label}
      </span>
    );
  };

  const getLayerBadge = (layer: string) => {
    const colors = {
      'A': 'bg-purple-500/20 text-purple-400',
      'B': 'bg-cyan-500/20 text-cyan-400',
      'C': 'bg-pink-500/20 text-pink-400'
    };
    return (
      <span className={`px-2 py-1 rounded text-xs font-semibold ${colors[layer as keyof typeof colors] || 'bg-gray-500/20 text-gray-400'}`}>
        Layer {layer}
      </span>
    );
  };

  const getFITypesForTable = (tableName: string): string[] => {
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
    return mapping[tableName] || [];
  };

  // Group comparisons by field name - Less aggressive grouping to preserve more fields
  // Only group fields that are EXACTLY the same (same normalized name AND same layer AND same REBIT match)
  // Treats FinFactor DB + API as ONE unified source vs REBIT
  const groupComparisonsByFieldName = (comparisons: FieldComparison[]): FieldComparison[] => {
    const grouped = new Map<string, FieldComparison>();
    
    comparisons.forEach(comp => {
      // CRITICAL: Get the layer from the FinFactor field - this MUST be preserved
      const compLayer = comp.finfactorField?.layer || 'none';
      
      // Create grouping key that preserves:
      // - Field name (exact, not normalized - to preserve different field names)
      // - Layer (CRITICAL: to keep layer-specific instances separate - same field name in different layers = different entries)
      // - Status
      // - REBIT field name (to preserve different REBIT matches for same FinFactor field)
      // This ensures we only group truly identical fields (same name, same layer, same status, same REBIT match)
      const fieldNameKey = comp.fieldName.toLowerCase().trim();
      const layerKey = compLayer; // Use the layer from the comparison
      const rebitNameKey = comp.rebitField?.name ? comp.rebitField.name.toLowerCase().trim() : 'none';
      const key = `${fieldNameKey}_${comp.status}_${layerKey}_${rebitNameKey}`;
      const existing = grouped.get(key);
      
      if (!existing) {
        // First occurrence - create grouped entry
        grouped.set(key, {
          ...comp,
          finfactorField: comp.finfactorField ? {
            ...comp.finfactorField,
            // Don't store table names - we're treating FinFactor as one unified source
            tableName: 'FinFactor (DB + API)',
            tableCategory: 'FinFactor Unified'
          } : undefined
        });
      } else {
        // Merge with existing - FinFactor DB + API are treated as ONE source
        if (comp.finfactorField && existing.finfactorField) {
          // Keep the most common data type if they differ
          if (comp.finfactorField.dataType !== existing.finfactorField.dataType) {
            // Prefer more specific types
            const types = [comp.finfactorField.dataType, existing.finfactorField.dataType];
            existing.finfactorField.dataType = types.includes('STRING') ? 'STRING' :
                                          types.includes('UUID') ? 'UUID' :
                                          types.includes('INTEGER') ? 'INTEGER' :
                                          types[0];
          }
          
          // CRITICAL: Layers should NEVER differ if we're grouping correctly (key includes layer)
          // If they do differ, it's a critical bug - reject the merge
          if (comp.finfactorField.layer !== existing.finfactorField.layer) {
            console.error(`❌ CRITICAL Layer mismatch in grouping: ${comp.fieldName} - existing: ${existing.finfactorField.layer}, new: ${comp.finfactorField.layer}`);
            // DO NOT merge - create a separate entry with a unique key
            const uniqueKey = `${key}_${comp.finfactorField.layer}`;
            if (!grouped.has(uniqueKey)) {
              grouped.set(uniqueKey, {
                ...comp,
                finfactorField: comp.finfactorField ? {
                  ...comp.finfactorField,
                  tableName: 'FinFactor (DB + API)',
                  tableCategory: 'FinFactor Unified'
                } : undefined
              });
            }
            return; // Skip merging this field
          }
        } else if (comp.finfactorField && !existing.finfactorField) {
          existing.finfactorField = {
            ...comp.finfactorField,
            tableName: 'FinFactor (DB + API)',
            tableCategory: 'FinFactor Unified'
          };
        }
        
        // Keep the best match (highest similarity score)
        if (comp.similarityScore && existing.similarityScore) {
          if (comp.similarityScore > existing.similarityScore) {
            existing.rebitField = comp.rebitField;
            existing.similarityScore = comp.similarityScore;
            existing.dataTypeMatch = comp.dataTypeMatch;
          }
        } else if (comp.rebitField && !existing.rebitField) {
          existing.rebitField = comp.rebitField;
          existing.similarityScore = comp.similarityScore;
          existing.dataTypeMatch = comp.dataTypeMatch;
        }
      }
    });
    
    return Array.from(grouped.values());
  };

  // Filter first, then group
  // CRITICAL: Filter by layer FIRST to ensure strict layer separation
  const filteredBeforeGrouping = (comparisonData?.comparisons || []).filter(comp => {
      // Layer filter from tab - MUST be checked FIRST to ensure strict separation
      if (activeLayerTab !== 'all') {
        // REBIT-only fields don't belong to any FinFactor layer
        // When a specific layer is selected, hide REBIT-only fields (they have no layer)
        if (!comp.finfactorField) {
          // REBIT-only fields should only be shown when "All Layers" is selected
          // This prevents the same REBIT-only fields from appearing in all layers
          return false; // Hide REBIT-only fields when a specific layer is selected
        }
        // STRICT: If it has a FinFactor field, it MUST match the selected layer exactly
        // This ensures Layer A, B, C show completely different fields
        if (comp.finfactorField?.layer !== activeLayerTab) {
          return false; // Reject if layer doesn't match
        }
      }
      
      // Status filter from tab
      if (activeStatusTab !== 'all' && comp.status !== activeStatusTab) return false;
      
      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase().trim();
        if (!searchLower) return true; // Empty search after trim matches all
        
        const matchesSearch = 
          (comp.fieldName && comp.fieldName.toLowerCase().includes(searchLower)) ||
          (comp.finfactorField?.fieldName && comp.finfactorField.fieldName.toLowerCase().includes(searchLower)) ||
          (comp.rebitField?.name && comp.rebitField.name.toLowerCase().includes(searchLower)) ||
          (comp.finfactorField?.tableName && comp.finfactorField.tableName.toLowerCase().includes(searchLower));
        if (!matchesSearch) return false;
      }
      
      // FI Type filter
      if (filters.fiType !== 'all') {
        if (comp.rebitField?.fiType !== filters.fiType) {
          // Check if FinFactor field maps to this FI type
          const fiTypes = comp.finfactorField ? getFITypesForTable(comp.finfactorField.tableName) : [];
          if (!fiTypes.includes(filters.fiType)) return false;
        }
      }
      
      return true;
    });
  
  // Group the filtered results
  // CRITICAL: Validate that all fields match the selected layer before grouping
  const validatedBeforeGrouping = filteredBeforeGrouping.filter(comp => {
    if (activeLayerTab !== 'all') {
      // REBIT-only fields should never appear when a specific layer is selected
      if (!comp.finfactorField) {
        return false; // Hide REBIT-only fields for specific layers
      }
      // STRICT: Ensure layer matches exactly - reject any mismatches
      if (comp.finfactorField.layer !== activeLayerTab) {
        console.error(`❌ Layer mismatch: Field ${comp.fieldName} has layer ${comp.finfactorField.layer} but filter is ${activeLayerTab}`);
        return false;
      }
    }
    return true;
  });
  
  const filteredComparisons = groupComparisonsByFieldName(validatedBeforeGrouping);

  // Get counts for each tab - based on ACTUAL displayed fields (after grouping)
  const getLayerCounts = (layer: 'all' | 'A' | 'B' | 'C') => {
    if (!comparisonData || !comparisonData.comparisons) {
      return { total: 0, common: 0, finfactorOnly: 0, rebitOnly: 0 };
    }
    
    const allComparisons = comparisonData.comparisons;
    
    if (layer === 'all') {
      // For "all layers", group all comparisons and count by status
      const grouped = groupComparisonsByFieldName(allComparisons);
      return {
        total: grouped.length,
        common: grouped.filter(c => c.status === 'common').length,
        finfactorOnly: grouped.filter(c => c.status === 'finfactor-only').length,
        rebitOnly: grouped.filter(c => c.status === 'rebit-only').length,
      };
    }
    
    // For specific layers, filter by layer (exclude REBIT-only fields), then group, then count by status
    const layerFields = allComparisons.filter(comp => 
      comp.finfactorField?.layer === layer // Only FinFactor fields with matching layer
    );
    const grouped = groupComparisonsByFieldName(layerFields);
    
    // For specific layers, REBIT-only fields are hidden (they don't belong to any layer)
    return {
      total: grouped.length,
      common: grouped.filter(c => c.status === 'common').length,
      finfactorOnly: grouped.filter(c => c.status === 'finfactor-only').length,
      rebitOnly: 0, // REBIT-only fields don't have a layer, so 0 for specific layers
    };
  };

  const getStatusCounts = (status: 'all' | 'common' | 'finfactor-only' | 'rebit-only') => {
    if (!comparisonData) return 0;
    
    // Calculate counts based on ACTUAL displayed fields (after grouping)
    // This ensures the count matches what's actually shown in the UI
    const allComparisons = comparisonData.comparisons || [];
    
    if (status === 'all') {
      // For "all", show total after grouping
      const grouped = groupComparisonsByFieldName(allComparisons);
      return grouped.length;
    }
    
    // Filter by status first, then group to get accurate count
    const filteredByStatus = allComparisons.filter(c => c.status === status);
    const grouped = groupComparisonsByFieldName(filteredByStatus);
    return grouped.length;
  };

  const uniqueFITypes = Array.from(new Set(
    comparisonData?.comparisons
      .flatMap(c => [
        c.rebitField?.fiType,
        ...(c.finfactorField ? getFITypesForTable(c.finfactorField.tableName) : [])
      ])
      .filter(Boolean) as string[]
  )).sort();

  const statusConfig = {
    'all': { label: 'All Fields', icon: '📋', color: 'from-slate-600 to-slate-700' },
    'common': { label: 'Common', icon: '✅', color: 'from-emerald-600 to-emerald-700' },
    'finfactor-only': { label: 'FinFactor Only', icon: '🟠', color: 'from-orange-600 to-orange-700' },
    'rebit-only': { label: 'REBIT Only', icon: '🔵', color: 'from-blue-600 to-blue-700' }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mx-auto mb-4"></div>
          <p className="text-slate-400">Loading schema comparison...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-red-400 text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold mb-2">Error Loading Comparison</h2>
          <p className="text-slate-400 mb-4">{error}</p>
          <button
            onClick={loadComparison}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg font-semibold"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!comparisonData) {
    if (!loading && !error) {
      // Data should have loaded, but it's null - try reloading
      loadComparison();
    }
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-yellow-400 text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold mb-2">No Data Available</h2>
          <p className="text-slate-400 mb-4">Comparison data has not been loaded yet.</p>
          <button
            onClick={loadComparison}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg font-semibold"
          >
            Reload Data
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-xl border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-2xl">🔍</span>
              <h1 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                Schema Comparison: FinFactor vs REBIT
              </h1>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-emerald-900/30 to-emerald-800/20 rounded-xl border border-emerald-700/30 p-6"
          >
            <div className="text-3xl font-bold text-emerald-400 mb-2">
              {comparisonData.commonFields}
            </div>
            <div className="text-sm text-slate-400">Common Fields</div>
            <div className="text-xs text-slate-500 mt-1">Present in both schemas</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gradient-to-br from-orange-900/30 to-orange-800/20 rounded-xl border border-orange-700/30 p-6"
          >
            <div className="text-3xl font-bold text-orange-400 mb-2">
              {comparisonData.finfactorOnlyFields}
            </div>
            <div className="text-sm text-slate-400">FinFactor Only</div>
            <div className="text-xs text-slate-500 mt-1">Unique to FinFactor API</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-gradient-to-br from-blue-900/30 to-blue-800/20 rounded-xl border border-blue-700/30 p-6"
          >
            <div className="text-3xl font-bold text-blue-400 mb-2">
              {comparisonData.rebitOnlyFields}
            </div>
            <div className="text-sm text-slate-400">REBIT Only</div>
            <div className="text-xs text-slate-500 mt-1">Unique to REBIT standards</div>
          </motion.div>
        </div>

        {/* Layer Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-slate-800/50 rounded-xl border border-slate-700 p-4 mb-4"
        >
          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm font-semibold text-slate-400">Filter by Layer:</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {(['all', 'A', 'B', 'C'] as const).map((layer) => {
              const counts = getLayerCounts(layer);
              const isActive = activeLayerTab === layer;
              return (
                <button
                  key={layer}
                  onClick={() => setActiveLayerTab(layer)}
                  className={`px-4 py-2 rounded-lg font-semibold transition-all flex items-center gap-2 ${
                    isActive
                      ? layer === 'A'
                        ? 'bg-purple-600 text-white'
                        : layer === 'B'
                        ? 'bg-cyan-600 text-white'
                        : layer === 'C'
                        ? 'bg-pink-600 text-white'
                        : 'bg-gradient-to-r from-slate-600 to-slate-700 text-white'
                      : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <span>{layer === 'all' ? '📊' : `Layer ${layer}`}</span>
                  {layer === 'all' && <span className="text-xs">All Layers</span>}
                  <span className="text-xs opacity-75">({counts.total})</span>
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* Status Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-slate-800/50 rounded-xl border border-slate-700 p-4 mb-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm font-semibold text-slate-400">Filter by Status:</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {(['all', 'common', 'finfactor-only', 'rebit-only'] as const).map((status) => {
              const count = getStatusCounts(status);
              const isActive = activeStatusTab === status;
              const config = statusConfig[status];
              return (
                <button
                  key={status}
                  onClick={() => setActiveStatusTab(status)}
                  className={`px-4 py-2 rounded-lg font-semibold transition-all flex items-center gap-2 ${
                    isActive
                      ? `bg-gradient-to-r ${config.color} text-white shadow-lg`
                      : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <span>{config.icon}</span>
                  <span>{config.label}</span>
                  <span className="text-xs opacity-75">({count})</span>
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* Additional Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-slate-800/50 rounded-xl border border-slate-700 p-4 mb-6"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm text-slate-400 mb-2">🔍 Search Fields</label>
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                placeholder="Search by field name, table name..."
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-2">🏦 FI Type</label>
              <select
                value={filters.fiType}
                onChange={(e) => setFilters({ ...filters, fiType: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="all">All FI Types</option>
                {uniqueFITypes.map(fiType => (
                  <option key={fiType} value={fiType}>{fiType}</option>
                ))}
              </select>
            </div>
          </div>
          
        </motion.div>

        {/* Comparison Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden"
        >
          <div className="p-4 border-b border-slate-700 bg-gradient-to-r from-slate-800 to-slate-900">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Field Comparison</h2>
                <p className="text-xs text-slate-400 mt-1">
                  {activeLayerTab !== 'all' && `Layer ${activeLayerTab} • `}
                  {activeStatusTab !== 'all' && statusConfig[activeStatusTab] && `${statusConfig[activeStatusTab].label} • `}
                  Showing <span className="font-semibold text-white">{filteredComparisons.length}</span> unique field{filteredComparisons.length !== 1 ? 's' : ''}
                  {activeLayerTab !== 'all' && activeStatusTab !== 'all' && (
                    <span className="text-slate-500"> (Layer {activeLayerTab} • {statusConfig[activeStatusTab]?.label})</span>
                  )}
                  {activeLayerTab !== 'all' && activeStatusTab === 'rebit-only' && (
                    <span className="text-yellow-400 ml-2">(REBIT-only fields hidden for specific layers - select "All Layers" to view them)</span>
                  )}
                </p>
              </div>
              <div className="text-sm text-slate-400">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-emerald-400">✓ Common: {getStatusCounts('common')}</span>
                  <span className="text-orange-400">•</span>
                  <span className="text-orange-400">FinFactor Only: {getStatusCounts('finfactor-only')}</span>
                  <span className="text-blue-400">•</span>
                  <span className="text-blue-400">REBIT Only: {getStatusCounts('rebit-only')}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-900/50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Field Name</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">FinFactor</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">REBIT</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Data Type</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Layer</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Table</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {filteredComparisons.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                      <div className="flex flex-col items-center gap-2">
                        <span className="text-4xl">🔍</span>
                        <p className="font-semibold">No fields match the current filters</p>
                        {activeLayerTab !== 'all' && activeStatusTab === 'rebit-only' ? (
                          <div className="text-xs text-yellow-400 mt-2 max-w-md">
                            <p>REBIT-only fields don't have a FinFactor layer assignment.</p>
                            <p className="mt-1">Select "All Layers" to view REBIT-only fields.</p>
                          </div>
                        ) : activeLayerTab !== 'all' && activeStatusTab === 'common' ? (
                          <div className="text-xs text-blue-400 mt-2 max-w-md">
                            <p>No common fields found in Layer {activeLayerTab}.</p>
                            <p className="mt-1">
                              Common fields might be in other layers. Try selecting "All Layers" or check Layer B/C.
                            </p>
                            <p className="mt-2 text-slate-400">
                              Total common fields: {comparisonData?.commonFields || 0}
                            </p>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-500">Try adjusting your layer or status tabs</p>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredComparisons
                    .filter(comp => {
                      // FINAL validation: Ensure layer matches exactly (should never fail if filtering is correct)
                      if (activeLayerTab !== 'all') {
                        // REBIT-only fields should NEVER appear when a specific layer is selected
                        if (!comp.finfactorField) {
                          return false; // Hide REBIT-only fields for specific layers
                        }
                        // FinFactor fields MUST match the selected layer
                        if (comp.finfactorField.layer !== activeLayerTab) {
                          console.error(`❌ CRITICAL: Layer mismatch in display: ${comp.fieldName} - layer ${comp.finfactorField.layer} vs filter ${activeLayerTab}`);
                          return false; // Don't render mismatched fields
                        }
                      }
                      return true;
                    })
                    .map((comp, idx) => {
                      return (
                      <tr key={idx} className="hover:bg-slate-800/50 transition-colors">
                        <td className="px-4 py-3">
                          {getStatusBadge(comp.status)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-mono text-sm text-cyan-400">
                            {comp.finfactorField?.fieldName || comp.rebitField?.name || comp.fieldName || '—'}
                          </div>
                          {comp.similarityScore && comp.similarityScore < 1.0 && (
                            <div className="text-xs text-slate-500 mt-1">
                              Similarity: {(comp.similarityScore * 100).toFixed(0)}%
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {comp.finfactorField ? (
                            <div className="text-sm">
                              <div className="text-white">{comp.finfactorField.fieldName || '—'}</div>
                              <div className="text-xs text-slate-500">{comp.finfactorField.dataType || '—'}</div>
                            </div>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {comp.rebitField && comp.rebitField.name ? (
                            <div className="text-sm">
                              <div className="text-white">{String(comp.rebitField.name || '—')}</div>
                              <div className="text-xs text-slate-500">{String(comp.rebitField.type || '—')}</div>
                            </div>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm">
                            {comp.finfactorField && comp.finfactorField.dataType && (
                              <div className="text-amber-400">{String(comp.finfactorField.dataType)}</div>
                            )}
                            {comp.rebitField && comp.rebitField.type && (
                              <div className="text-blue-400">{String(comp.rebitField.type)}</div>
                            )}
                            {comp.dataTypeMatch && comp.finfactorField && comp.rebitField && (
                              <div className="text-xs text-emerald-400 mt-1">✓ Types match</div>
                            )}
                            {!comp.finfactorField && !comp.rebitField && (
                              <span className="text-slate-600">—</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {comp.finfactorField?.layer && getLayerBadge(comp.finfactorField.layer)}
                        </td>
                        <td className="px-4 py-3">
                          {comp.finfactorField && (
                            <div className="text-xs text-slate-400 font-mono">
                              {comp.finfactorField.tableName.includes(' | ') ? (
                                <div>
                                  <div className="text-cyan-400 mb-1">📋 Multiple sources:</div>
                                  {comp.finfactorField.tableName.split(' | ').map((table, idx) => (
                                    <div key={idx} className="ml-2 mb-1">
                                      • {table}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                comp.finfactorField.tableName
                              )}
                            </div>
                          )}
                          {!comp.finfactorField && comp.rebitField && (
                            <span className="text-slate-600 text-xs">REBIT-only field</span>
                          )}
                        </td>
                      </tr>
                    );
                  }).filter(Boolean) // Remove any null entries from validation
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

