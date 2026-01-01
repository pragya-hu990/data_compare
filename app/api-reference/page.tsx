'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';

// Type definitions
interface ApiEndpoint {
  name: string;
  method: string;
  url: string;
  curl: string;
  description: string;
  sampleInput?: string;
  sampleOutput?: string;
}

interface ApiCategory {
  category: string;
  icon: string;
  description: string;
  endpoints: ApiEndpoint[];
}

// API Reference Data
const apiEndpoints: ApiCategory[] = [
  {
    category: 'Test Endpoints',
    icon: '🧪',
    description: 'Internal API routes for testing database operations',
    endpoints: [
      {
        name: 'Run Layer A Tests',
        method: 'GET',
        url: '/api/test/layer-a',
        curl: 'curl -s http://localhost:3000/api/test/layer-a | jq .',
        description: 'Tests User CRUD, API logging, Consent management',
        sampleOutput: '{ "summary": { "passed": 5, "total": 5, "status": "ALL_PASS" } }',
      },
      {
        name: 'Run Layer B Tests',
        method: 'GET',
        url: '/api/test/layer-b',
        curl: 'curl -s http://localhost:3000/api/test/layer-b | jq .',
        description: 'Tests Accounts, Transactions, Finfactor API integration',
        sampleOutput: '{ "summary": { "passed": 6, "total": 6, "status": "ALL_PASS" } }',
      },
      {
        name: 'Run Layer C Tests',
        method: 'GET',
        url: '/api/test/layer-c',
        curl: 'curl -s http://localhost:3000/api/test/layer-c | jq .',
        description: 'Tests Summaries, Snapshots, Financial Insights',
        sampleOutput: '{ "summary": { "passed": 5, "total": 5, "status": "ALL_PASS" } }',
      },
      {
        name: 'Run Full Flow Test',
        method: 'GET',
        url: '/api/test/full-flow',
        curl: 'curl -s http://localhost:3000/api/test/full-flow | jq .',
        description: 'Tests complete A→B→C data flow with real Finfactor API',
        sampleOutput: '{ "summary": { "passed": 7, "total": 7, "dataFlow": "Finfactor API → Layer A → Layer B → Layer C" } }',
      },
      {
        name: 'Cleanup Layer A',
        method: 'DELETE',
        url: '/api/test/layer-a',
        curl: 'curl -s -X DELETE http://localhost:3000/api/test/layer-a | jq .',
        description: 'Removes Layer A test data',
        sampleOutput: '{ "status": "CLEANED", "message": "Deleted test user..." }',
      },
      {
        name: 'Cleanup Layer B',
        method: 'DELETE',
        url: '/api/test/layer-b',
        curl: 'curl -s -X DELETE http://localhost:3000/api/test/layer-b | jq .',
        description: 'Removes Layer B test data',
        sampleOutput: '{ "status": "CLEANED" }',
      },
      {
        name: 'Cleanup Layer C',
        method: 'DELETE',
        url: '/api/test/layer-c',
        curl: 'curl -s -X DELETE http://localhost:3000/api/test/layer-c | jq .',
        description: 'Removes Layer C test data',
        sampleOutput: '{ "status": "CLEANED" }',
      },
      {
        name: 'Cleanup All',
        method: 'DELETE',
        url: '/api/test/full-flow',
        curl: 'curl -s -X DELETE http://localhost:3000/api/test/full-flow | jq .',
        description: 'Removes all test data',
        sampleOutput: '{ "status": "CLEANED" }',
      },
    ],
  },
  {
    category: 'Finfactor Authentication',
    icon: '🔐',
    description: 'Get access token for Finfactor API calls',
    endpoints: [
      {
        name: 'Login / Get Token',
        method: 'POST',
        url: 'https://dhanaprayoga.fiu.finfactor.in/pfm/api/v2/user-login',
        curl: `curl -s -X POST https://dhanaprayoga.fiu.finfactor.in/pfm/api/v2/user-login \\
  -H "Content-Type: application/json" \\
  -d '{"userId": "pfm@dhanaprayoga", "password": "7777"}' | jq '.token'`,
        description: 'Authenticate and get JWT token (valid for 24 hours)',
        sampleInput: '{ "userId": "pfm@dhanaprayoga", "password": "7777" }',
        sampleOutput: '{ "token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..." }',
      },
    ],
  },
  {
    category: 'Deposit APIs',
    icon: '🏦',
    description: 'Bank account and deposit operations',
    endpoints: [
      {
        name: 'Get Linked Accounts',
        method: 'POST',
        url: '/pfm/api/v2/deposit/user-linked-accounts',
        curl: `curl -s -X POST https://dhanaprayoga.fiu.finfactor.in/pfm/api/v2/deposit/user-linked-accounts \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer <TOKEN>" \\
  -d '{"uniqueIdentifier": "8956545791"}' | jq '.totalFiData'`,
        description: 'Fetch all linked bank accounts for a user',
        sampleInput: '{ "uniqueIdentifier": "8956545791" }',
        sampleOutput: '{ "totalFiData": 17, "fipData": [{ "fipName": "Dhanagar Finvu Bank", "linkedAccounts": [...] }] }',
      },
      {
        name: 'Get Account Statement',
        method: 'POST',
        url: '/pfm/api/v2/deposit/user-account-statement',
        curl: `curl -s -X POST https://dhanaprayoga.fiu.finfactor.in/pfm/api/v2/deposit/user-account-statement \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer <TOKEN>" \\
  -d '{"uniqueIdentifier": "8956545791", "accountId": "SAVINGS-001", "from": "2025-01-01", "to": "2025-12-31"}' | jq '.transactions | length'`,
        description: 'Get transaction history for a specific account',
        sampleInput: '{ "uniqueIdentifier": "8956545791", "accountId": "SAVINGS-001", "from": "2025-01-01", "to": "2025-12-31" }',
        sampleOutput: '{ "transactions": [{ "txnId": "TXN001", "amount": 5000, "type": "CREDIT" }, ...] }',
      },
      {
        name: 'Get Deposit Insights',
        method: 'POST',
        url: '/pfm/api/v2/deposit/insights',
        curl: `curl -s -X POST https://dhanaprayoga.fiu.finfactor.in/pfm/api/v2/deposit/insights \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer <TOKEN>" \\
  -d '{"uniqueIdentifier": "8956545791", "accountIds": [], "from": "2025-01-01", "to": "2025-12-31", "frequency": "MONTHLY"}' | jq '.depositInsights'`,
        description: 'Get analytics: balance trends, income, expenses',
        sampleInput: '{ "uniqueIdentifier": "8956545791", "accountIds": [], "from": "2025-01-01", "to": "2025-12-31", "frequency": "MONTHLY" }',
        sampleOutput: '{ "depositInsights": { "balance": [...], "incoming": [...], "outgoing": [...] } }',
      },
    ],
  },
  {
    category: 'Mutual Fund APIs',
    icon: '📈',
    description: 'Mutual fund holdings and transactions',
    endpoints: [
      {
        name: 'Get MF Holdings',
        method: 'POST',
        url: '/pfm/api/v2/mutual-fund/user-linked-accounts/holding-folio',
        curl: `curl -s -X POST https://dhanaprayoga.fiu.finfactor.in/pfm/api/v2/mutual-fund/user-linked-accounts/holding-folio \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer <TOKEN>" \\
  -d '{"uniqueIdentifier": "8956545791", "filterZeroValueAccounts": "true"}' | jq '.totalHoldings'`,
        description: 'Fetch mutual fund holdings with folio details',
        sampleInput: '{ "uniqueIdentifier": "8956545791", "filterZeroValueAccounts": "true" }',
        sampleOutput: '{ "totalHoldings": 5, "currentValue": 150000.50, "holdings": [...] }',
      },
      {
        name: 'Get MF Transactions',
        method: 'POST',
        url: '/pfm/api/v2/mutual-fund/user-linked-accounts/transactions',
        curl: `curl -s -X POST https://dhanaprayoga.fiu.finfactor.in/pfm/api/v2/mutual-fund/user-linked-accounts/transactions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer <TOKEN>" \\
  -d '{"uniqueIdentifier": "8956545791", "from": "2024-01-01", "to": "2025-12-31"}' | jq '.transactions | length'`,
        description: 'Get mutual fund transaction history',
        sampleInput: '{ "uniqueIdentifier": "8956545791", "from": "2024-01-01", "to": "2025-12-31" }',
        sampleOutput: '{ "transactions": [{ "schemeName": "HDFC Flexi Cap", "amount": 10000, "type": "PURCHASE" }] }',
      },
    ],
  },
  {
    category: 'Equity APIs',
    icon: '📊',
    description: 'Stock holdings and demat account operations',
    endpoints: [
      {
        name: 'Get Equity Holdings',
        method: 'POST',
        url: '/pfm/api/v2/equity/user-linked-accounts/holdings',
        curl: `curl -s -X POST https://dhanaprayoga.fiu.finfactor.in/pfm/api/v2/equity/user-linked-accounts/holdings \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer <TOKEN>" \\
  -d '{"uniqueIdentifier": "8956545791"}' | jq '.holdings'`,
        description: 'Get stock holdings from demat accounts',
        sampleInput: '{ "uniqueIdentifier": "8956545791" }',
        sampleOutput: '{ "holdings": [{ "symbol": "RELIANCE", "quantity": 50, "currentValue": 125000 }] }',
      },
    ],
  },
  {
    category: 'FIP Management',
    icon: '🏛️',
    description: 'Financial Information Providers',
    endpoints: [
      {
        name: 'Get All FIPs',
        method: 'POST',
        url: '/pfm/api/v2/fips',
        curl: `curl -s -X POST https://dhanaprayoga.fiu.finfactor.in/pfm/api/v2/fips \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer <TOKEN>" | jq '.[0:5]'`,
        description: 'List all available Financial Information Providers',
        sampleInput: '{}',
        sampleOutput: '[{ "fipId": "HDFC-FIP", "fipName": "HDFC Bank", "fiTypes": ["DEPOSIT"] }, ...]',
      },
    ],
  },
];

export default function ApiReferencePage() {
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<number | null>(0);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(id);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  const quickStartScript = `# ============================================
# FINFACTOR AA - QUICK TEST SCRIPT
# ============================================

# 1. Run All Layer Tests
echo "🧪 Running Layer A..."
curl -s http://localhost:3000/api/test/layer-a | jq '.summary'

echo "🧪 Running Layer B..."
curl -s http://localhost:3000/api/test/layer-b | jq '.summary'

echo "🧪 Running Layer C..."
curl -s http://localhost:3000/api/test/layer-c | jq '.summary'

echo "🧪 Running Full Flow..."
curl -s http://localhost:3000/api/test/full-flow | jq '.summary'

# ============================================
# 2. Test Finfactor API Directly
# ============================================

# Get auth token
TOKEN=$(curl -s -X POST https://dhanaprayoga.fiu.finfactor.in/pfm/api/v2/user-login \\
  -H "Content-Type: application/json" \\
  -d '{"userId": "pfm@dhanaprayoga", "password": "7777"}' | jq -r '.token')

echo "Token: $TOKEN"

# Get deposit accounts
curl -s -X POST https://dhanaprayoga.fiu.finfactor.in/pfm/api/v2/deposit/user-linked-accounts \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $TOKEN" \\
  -d '{"uniqueIdentifier": "8956545791"}' | jq '.totalFiData, .fipData[0].fipName'

# ============================================
# 3. Cleanup Test Data
# ============================================
curl -s -X DELETE http://localhost:3000/api/test/layer-a | jq '.status'
curl -s -X DELETE http://localhost:3000/api/test/layer-b | jq '.status'
curl -s -X DELETE http://localhost:3000/api/test/layer-c | jq '.status'
curl -s -X DELETE http://localhost:3000/api/test/full-flow | jq '.status'`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-xl border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-2xl">📚</span>
              <h1 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                API Reference
              </h1>
            </div>
            <div className="flex gap-3">
              <Link
                href="/schema-comparison"
                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-lg font-semibold transition-all flex items-center gap-2"
              >
                <span>🔍</span>
                Schema Comparison
              </Link>
              <Link
                href="/live-tester"
                className="px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 rounded-lg font-semibold transition-all flex items-center gap-2"
              >
                <span>🔌</span>
                Live Tester
              </Link>
              <Link
                href="/test-dashboard"
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg font-semibold transition-all flex items-center gap-2"
              >
                <span>🧪</span>
                Test Dashboard
              </Link>
              <Link
                href="/"
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg font-semibold transition-all flex items-center gap-2"
              >
                <span>🏠</span>
                Home
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Quick Start Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-emerald-900/30 to-cyan-900/30 rounded-2xl border border-emerald-700/30 p-6 mb-8"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-emerald-400">🚀 Quick Start Script</h2>
            <button
              onClick={() => copyToClipboard(quickStartScript, 'quickstart')}
              className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                copiedCmd === 'quickstart'
                  ? 'bg-emerald-500 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              {copiedCmd === 'quickstart' ? '✓ Copied!' : '📋 Copy Full Script'}
            </button>
          </div>
          <p className="text-slate-400 mb-4">
            Copy and paste this into your terminal to run a complete integration test:
          </p>
          <div className="bg-slate-950 rounded-lg p-4 overflow-x-auto max-h-64 overflow-y-auto">
            <pre className="text-sm text-slate-300 font-mono whitespace-pre">{quickStartScript}</pre>
          </div>
        </motion.div>

        {/* Environment Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-slate-800/50 rounded-2xl border border-slate-700 p-6 mb-8"
        >
          <h3 className="text-lg font-bold mb-4 text-slate-300">📝 Environment Variables</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-900 rounded-lg p-4">
              <div className="text-sm text-slate-500 mb-1">Base URL (Local)</div>
              <code className="text-cyan-400">http://localhost:3000</code>
            </div>
            <div className="bg-slate-900 rounded-lg p-4">
              <div className="text-sm text-slate-500 mb-1">Finfactor API</div>
              <code className="text-cyan-400">https://dhanaprayoga.fiu.finfactor.in</code>
            </div>
            <div className="bg-slate-900 rounded-lg p-4">
              <div className="text-sm text-slate-500 mb-1">Test User ID</div>
              <code className="text-amber-400">pfm@dhanaprayoga</code>
            </div>
            <div className="bg-slate-900 rounded-lg p-4">
              <div className="text-sm text-slate-500 mb-1">Test Unique Identifier</div>
              <code className="text-amber-400">8956545791</code>
            </div>
          </div>
        </motion.div>

        {/* API Categories */}
        <div className="space-y-4">
          {apiEndpoints.map((category, catIdx) => (
            <motion.div
              key={catIdx}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * (catIdx + 1) }}
              className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700 overflow-hidden"
            >
              {/* Category Header */}
              <button
                onClick={() => setExpandedCategory(expandedCategory === catIdx ? null : catIdx)}
                className="w-full bg-gradient-to-r from-slate-700 to-slate-800 px-6 py-4 flex items-center justify-between hover:from-slate-600 hover:to-slate-700 transition-all"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{category.icon}</span>
                  <div className="text-left">
                    <h3 className="text-xl font-bold">{category.category}</h3>
                    <p className="text-sm text-slate-400">{category.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="bg-slate-600 px-3 py-1 rounded-full text-sm">
                    {category.endpoints.length} endpoints
                  </span>
                  <span className={`transition-transform ${expandedCategory === catIdx ? 'rotate-180' : ''}`}>
                    ▼
                  </span>
                </div>
              </button>

              {/* Endpoints */}
              {expandedCategory === catIdx && (
                <div className="p-4 space-y-4">
                  {category.endpoints.map((endpoint, idx) => {
                    const cmdId = `${catIdx}-${idx}`;
                    return (
                      <div key={idx} className="bg-slate-900/50 rounded-xl p-4 border border-slate-700">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`px-2 py-1 rounded text-xs font-bold ${
                                endpoint.method === 'GET' ? 'bg-emerald-500/20 text-emerald-400' :
                                endpoint.method === 'POST' ? 'bg-blue-500/20 text-blue-400' :
                                endpoint.method === 'DELETE' ? 'bg-red-500/20 text-red-400' :
                                'bg-purple-500/20 text-purple-400'
                              }`}>
                                {endpoint.method}
                              </span>
                              <span className="font-semibold">{endpoint.name}</span>
                            </div>
                            <p className="text-slate-400 text-sm">{endpoint.description}</p>
                            {endpoint.url && (
                              <code className="text-xs text-cyan-400 mt-1 block">{endpoint.url}</code>
                            )}
                          </div>
                          <button
                            onClick={() => copyToClipboard(endpoint.curl, cmdId)}
                            className={`px-3 py-1 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
                              copiedCmd === cmdId
                                ? 'bg-emerald-500 text-white'
                                : 'bg-slate-700 hover:bg-slate-600 text-white'
                            }`}
                          >
                            {copiedCmd === cmdId ? '✓ Copied!' : '📋 Copy'}
                          </button>
                        </div>
                        
                        {/* Curl Command */}
                        <div className="bg-slate-950 rounded-lg p-3 overflow-x-auto">
                          <pre className="text-sm text-slate-300 whitespace-pre-wrap font-mono">
                            <code>{endpoint.curl}</code>
                          </pre>
                        </div>

                        {/* Sample Input/Output */}
                        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                          {endpoint.sampleInput && (
                            <div>
                              <div className="text-xs text-slate-500 mb-1">Sample Input:</div>
                              <div className="bg-slate-950 rounded-lg p-2 overflow-x-auto">
                                <pre className="text-xs text-amber-400 font-mono">{endpoint.sampleInput}</pre>
                              </div>
                            </div>
                          )}
                          {endpoint.sampleOutput && (
                            <div>
                              <div className="text-xs text-slate-500 mb-1">Sample Output:</div>
                              <div className="bg-slate-950 rounded-lg p-2 overflow-x-auto">
                                <pre className="text-xs text-emerald-400 font-mono">{endpoint.sampleOutput}</pre>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {/* Footer */}
        <div className="text-center text-slate-500 mt-12">
          <p>Finfactor Account Aggregator • API Documentation</p>
        </div>
      </div>
    </div>
  );
}

