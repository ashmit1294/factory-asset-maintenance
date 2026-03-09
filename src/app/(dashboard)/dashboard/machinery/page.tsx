'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { apiClient } from '@/lib/apiClient';

interface Machine {
  _id: string;
  name: string;
  serialNumber: string;
  location: string;
  type: string;
  status: 'ACTIVE' | 'DECOMMISSIONED';
  createdAt: string;
}

interface MaintenanceEntry {
  taskId: string;
  taskCode: string;
  resolvedAt: string;
  summary: string;
}

interface HistoryData {
  machinery: {
    _id: string;
    name: string;
    serialNumber: string;
    location: string;
    type: string;
    status: string;
  };
  maintenanceHistory: MaintenanceEntry[];
  totalRecords: number;
}

export default function MachineryPage() {
  const { canManage } = useAuth();

  const [machines,   setMachines]   = useState<Machine[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [search,     setSearch]     = useState('');
  const [statusFilter, setStatusFilter] = useState('ACTIVE');

  // History modal
  const [historyMachine,  setHistoryMachine]  = useState<HistoryData | null>(null);
  const [historyLoading,  setHistoryLoading]  = useState(false);
  const [historyError,    setHistoryError]    = useState('');
  const [showHistory,     setShowHistory]     = useState(false);

  const fetchMachines = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (search.trim()) params.set('search', search.trim());

      const res = await apiClient.get<Machine[]>(`/api/machinery?${params}`);
      setMachines(res.data ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load machinery');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => {
    const t = setTimeout(() => fetchMachines(), 300);
    return () => clearTimeout(t);
  }, [fetchMachines]);

  const openHistory = async (machineId: string) => {
    setShowHistory(true);
    setHistoryMachine(null);
    setHistoryError('');
    setHistoryLoading(true);
    try {
      const res = await apiClient.get<HistoryData>(
        `/api/machinery/${machineId}/history`
      );
      setHistoryMachine(res.data);
    } catch (err: unknown) {
      setHistoryError(err instanceof Error ? err.message : 'Failed to load history');
    } finally {
      setHistoryLoading(false);
    }
  };

  const activeCount       = machines.filter((m) => m.status === 'ACTIVE').length;
  const decommissionCount = machines.filter((m) => m.status === 'DECOMMISSIONED').length;

  return (
    <div className="p-6 space-y-5 max-w-6xl mx-auto">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Machinery</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            All machines registered in the system
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs bg-green-50 text-green-700 border border-green-200
                           px-2.5 py-1 rounded-full font-medium">
            {activeCount} Active
          </span>
          {decommissionCount > 0 && (
            <span className="text-xs bg-gray-100 text-gray-500 border border-gray-200
                             px-2.5 py-1 rounded-full font-medium">
              {decommissionCount} Decommissioned
            </span>
          )}
        </div>
      </div>

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex gap-3 flex-wrap">
        <div className="flex-1 min-w-52 relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, serial number, location..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg
                       focus:outline-none focus:ring-2 focus:ring-blue-500
                       focus:border-transparent"
          />
        </div>

        <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm">
          {[
            { value: 'ACTIVE',          label: 'Active'          },
            { value: 'DECOMMISSIONED',  label: 'Decommissioned'  },
            { value: '',                label: 'All'             },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={`px-4 py-2 font-medium transition-colors
                          ${statusFilter === opt.value
                            ? 'bg-blue-600 text-white'
                            : 'bg-white text-gray-600 hover:bg-gray-50'
                          }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Machine grid ─────────────────────────────────────────────────── */}
      {error ? (
        <div className="text-center py-10 text-sm text-red-600">{error}</div>
      ) : loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
              <div className="h-4 w-32 bg-gray-100 rounded animate-pulse" />
              <div className="h-3 w-24 bg-gray-100 rounded animate-pulse" />
              <div className="h-3 w-40 bg-gray-100 rounded animate-pulse" />
            </div>
          ))}
        </div>
      ) : machines.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <svg className="h-12 w-12 text-gray-200 mx-auto mb-3" fill="none"
            stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          </svg>
          <p className="text-sm text-gray-400">No machines found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {machines.map((machine) => (
            <div
              key={machine._id}
              className={`bg-white rounded-xl border p-5 space-y-3 transition-shadow
                          hover:shadow-md
                          ${machine.status === 'DECOMMISSIONED'
                            ? 'border-gray-200 opacity-70'
                            : 'border-gray-200'
                          }`}
            >
              {/* Card header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-gray-900 truncate">
                    {machine.name}
                  </h3>
                  <p className="text-xs font-mono text-gray-400 mt-0.5">
                    {machine.serialNumber}
                  </p>
                </div>
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0
                              ${machine.status === 'ACTIVE'
                                ? 'bg-green-50 text-green-700'
                                : 'bg-gray-100 text-gray-500'
                              }`}
                >
                  {machine.status === 'ACTIVE' ? '● Active' : '○ Decommissioned'}
                </span>
              </div>

              {/* Details */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <svg className="h-3.5 w-3.5 flex-shrink-0 text-gray-400"
                    fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {machine.location}
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <svg className="h-3.5 w-3.5 flex-shrink-0 text-gray-400"
                    fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                  {machine.type}
                </div>
              </div>

              {/* Footer */}
              <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs text-gray-400">
                  Added {new Date(machine.createdAt).toLocaleDateString('en-IN', {
                    day: '2-digit', month: 'short', year: 'numeric',
                  })}
                </span>
                <div className="flex items-center gap-2">
                  {/* Report issue button */}
                  <Link
                    href={`/dashboard/tasks/new?machineId=${machine._id}`}
                    className="text-xs text-blue-600 hover:text-blue-800
                               font-medium transition-colors"
                  >
                    Report issue
                  </Link>
                  {/* History button - managers only */}
                  {canManage && (
                    <button
                      onClick={() => openHistory(machine._id)}
                      className="text-xs text-purple-600 hover:text-purple-800
                                 font-medium transition-colors"
                    >
                      History →
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── History Modal ─────────────────────────────────────────────────── */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowHistory(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl
                          border border-gray-200 z-10 max-h-[80vh] flex flex-col">

            {/* Header */}
            <div className="px-5 py-4 border-b border-gray-100 flex items-center
                            justify-between flex-shrink-0">
              <div>
                <h3 className="text-base font-semibold text-gray-900">
                  Maintenance History
                </h3>
                {historyMachine && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {historyMachine.machinery.name} —{' '}
                    {historyMachine.machinery.serialNumber}
                  </p>
                )}
              </div>
              <button
                onClick={() => setShowHistory(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5">
              {historyLoading ? (
                <div className="flex items-center justify-center py-10">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
                </div>
              ) : historyError ? (
                <p className="text-sm text-red-600 text-center py-6">{historyError}</p>
              ) : !historyMachine || historyMachine.maintenanceHistory.length === 0 ? (
                <div className="text-center py-10">
                  <svg className="h-10 w-10 text-gray-200 mx-auto mb-3"
                    fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <p className="text-sm text-gray-400">No maintenance records yet.</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Records appear when tasks are confirmed on this machine.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-gray-500 mb-4">
                    {historyMachine.totalRecords} maintenance record
                    {historyMachine.totalRecords !== 1 ? 's' : ''} total
                  </p>
                  {[...historyMachine.maintenanceHistory].reverse().map(
                    (entry, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl
                                   border border-gray-100"
                      >
                        <div className="h-8 w-8 bg-green-100 rounded-lg flex items-center
                                        justify-center flex-shrink-0">
                          <svg className="h-4 w-4 text-green-600" fill="none"
                            stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round"
                              strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium text-gray-800 truncate">
                              {entry.summary}
                            </p>
                            <span className="text-xs font-mono text-gray-400
                                             flex-shrink-0">
                              {entry.taskCode}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            <p className="text-xs text-gray-400">
                              Resolved{' '}
                              {new Date(entry.resolvedAt).toLocaleDateString('en-IN', {
                                day: '2-digit', month: 'short', year: 'numeric',
                              })}
                            </p>
                            <Link
                              href={`/dashboard/tasks/${entry.taskId}`}
                              className="text-xs text-blue-600 hover:underline"
                              onClick={() => setShowHistory(false)}
                            >
                              View task →
                            </Link>
                          </div>
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}