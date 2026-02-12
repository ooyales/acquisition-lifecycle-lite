import { useState, useEffect } from 'react';
import { DollarSign, Loader2, AlertCircle, Wallet, TrendingUp, PiggyBank, Banknote } from 'lucide-react';
import { fundingApi } from '@/api/funding';
import type { FundingSource } from '@/types';

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '-';
  return `$${value.toLocaleString()}`;
}

export default function FundingPage() {
  const [sources, setSources] = useState<FundingSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    fundingApi
      .list()
      .then(setSources)
      .catch((err: any) => {
        setError(err?.response?.data?.error || 'Failed to load funding sources.');
      })
      .finally(() => setLoading(false));
  }, []);

  const totalBudget = sources.reduce((sum, s) => sum + s.total_budget, 0);
  const totalCommitted = sources.reduce((sum, s) => sum + s.committed, 0);
  const totalSpent = sources.reduce((sum, s) => sum + s.spent, 0);
  const totalAvailable = sources.reduce((sum, s) => sum + s.available, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={24} className="animate-spin text-eaw-primary" />
        <span className="ml-2 text-sm text-eaw-muted">Loading funding sources...</span>
      </div>
    );
  }

  return (
    <div>
      {/* Page Header */}
      <div className="flex items-center gap-3 mb-6">
        <DollarSign size={24} className="text-eaw-primary" />
        <div>
          <h1 className="text-xl font-bold text-eaw-font">Funding Sources</h1>
          <p className="text-sm text-eaw-muted">
            Track budget allocation, committed funds, and remaining availability
          </p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          <AlertCircle size={16} className="flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="eaw-card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Wallet size={20} className="text-eaw-primary" />
            </div>
            <div>
              <p className="text-xs text-eaw-muted uppercase tracking-wide font-medium">Total Budget</p>
              <p className="text-xl font-bold text-eaw-font">{formatCurrency(totalBudget)}</p>
            </div>
          </div>
        </div>

        <div className="eaw-card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-50 rounded-lg">
              <TrendingUp size={20} className="text-eaw-warning" />
            </div>
            <div>
              <p className="text-xs text-eaw-muted uppercase tracking-wide font-medium">Total Committed</p>
              <p className="text-xl font-bold text-eaw-warning">{formatCurrency(totalCommitted)}</p>
            </div>
          </div>
        </div>

        <div className="eaw-card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-50 rounded-lg">
              <Banknote size={20} className="text-eaw-success" />
            </div>
            <div>
              <p className="text-xs text-eaw-muted uppercase tracking-wide font-medium">Total Spent</p>
              <p className="text-xl font-bold text-eaw-success">{formatCurrency(totalSpent)}</p>
            </div>
          </div>
        </div>

        <div className="eaw-card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-50 rounded-lg">
              <PiggyBank size={20} className="text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-eaw-muted uppercase tracking-wide font-medium">Total Available</p>
              <p className="text-xl font-bold text-purple-600">{formatCurrency(totalAvailable)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Funding Source Cards */}
      {sources.length === 0 ? (
        <div className="eaw-card">
          <p className="text-sm text-eaw-muted text-center py-12">
            No funding sources found. Use the Data Import Wizard to add funding sources.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {sources.map((source) => {
            const usedPct = source.total_budget > 0
              ? ((source.committed + source.spent) / source.total_budget) * 100
              : 0;
            const spentPct = source.total_budget > 0
              ? (source.spent / source.total_budget) * 100
              : 0;
            const committedPct = source.total_budget > 0
              ? (source.committed / source.total_budget) * 100
              : 0;

            return (
              <div key={source.id} className="eaw-card">
                <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                  {/* Left: Source Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-base font-semibold text-eaw-font truncate">
                        {source.name}
                      </h3>
                      <span className="badge-info">{source.funding_type}</span>
                      <span className="badge-muted">FY{source.fiscal_year}</span>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-eaw-muted mb-3">
                      <span>Owner: {source.owner}</span>
                      {source.notes && <span>Note: {source.notes}</span>}
                    </div>

                    {/* Progress Bar */}
                    <div className="mb-2">
                      <div className="h-3 bg-gray-100 rounded-full overflow-hidden flex">
                        <div
                          className="bg-eaw-success h-full transition-all duration-500"
                          style={{ width: `${Math.min(spentPct, 100)}%` }}
                          title={`Spent: ${formatCurrency(source.spent)}`}
                        />
                        <div
                          className="bg-eaw-warning h-full transition-all duration-500"
                          style={{ width: `${Math.min(committedPct, 100 - Math.min(spentPct, 100))}%` }}
                          title={`Committed: ${formatCurrency(source.committed)}`}
                        />
                      </div>
                      <div className="flex items-center gap-4 mt-1.5 text-xs text-eaw-muted">
                        <span className="flex items-center gap-1">
                          <span className="w-2.5 h-2.5 rounded-sm bg-eaw-success inline-block" />
                          Spent
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2.5 h-2.5 rounded-sm bg-eaw-warning inline-block" />
                          Committed
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2.5 h-2.5 rounded-sm bg-gray-100 inline-block" />
                          Available
                        </span>
                        <span className="ml-auto font-medium">
                          {usedPct.toFixed(1)}% utilized
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Dollar Amounts */}
                  <div className="flex-shrink-0 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
                    <div className="text-center lg:text-right">
                      <p className="text-xs text-eaw-muted uppercase tracking-wide mb-0.5">Total</p>
                      <p className="text-sm font-semibold text-eaw-font">{formatCurrency(source.total_budget)}</p>
                    </div>
                    <div className="text-center lg:text-right">
                      <p className="text-xs text-eaw-muted uppercase tracking-wide mb-0.5">Committed</p>
                      <p className="text-sm font-semibold text-eaw-warning">{formatCurrency(source.committed)}</p>
                    </div>
                    <div className="text-center lg:text-right">
                      <p className="text-xs text-eaw-muted uppercase tracking-wide mb-0.5">Spent</p>
                      <p className="text-sm font-semibold text-eaw-success">{formatCurrency(source.spent)}</p>
                    </div>
                    <div className="text-center lg:text-right">
                      <p className="text-xs text-eaw-muted uppercase tracking-wide mb-0.5">Available</p>
                      <p className="text-lg font-bold text-purple-600">{formatCurrency(source.available)}</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
