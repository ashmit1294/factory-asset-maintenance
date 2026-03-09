'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { apiClient } from '@/lib/apiClient';
import StatusBadge from '@/components/StatusBadge';
import PriorityBadge from '@/components/PriorityBadge';

interface Task {
  _id: string;
  taskCode: string;
  title: string;
  status: string;
  priority: string;
  slaDeadline: string;
  slaBreached: boolean;
  createdAt: string;
  updatedAt: string;
  machineryId?: { _id: string; name: string; serialNumber: string };
  reportedBy?: { _id: string; name: string };
  assignedTo?: { _id: string; name: string } | null;
}

interface Meta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const STATUS_OPTIONS = [
  'REPORTED', 'UNDER_REVIEW', 'ASSIGNED', 'IN_PROGRESS',
  'MATERIAL_REQUESTED', 'PAUSED', 'ESCALATED', 'COMPLETED',
  'REOPENED', 'CONFIRMED', 'REJECTED', 'CANCELLED',
];

const PRIORITY_OPTIONS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export default function TasksPage() {
  const { user, canManage } = useAuth();
  const router       = useRouter();
  const searchParams = useSearchParams();

  // ── Filter state ──────────────────────────────────────────────────────────
  const [search,      setSearch]      = useState(searchParams.get('search')      || '');
  const [status,      setStatus]      = useState(searchParams.get('status')      || '');
  const [priority,    setPriority]    = useState(searchParams.get('priority')    || '');
  const [slaBreached, setSlaBreached] = useState(searchParams.get('slaBreached') || '');
  const [page,        setPage]        = useState(parseInt(searchParams.get('page') || '1', 10));
  const [sortBy,      setSortBy]      = useState(searchParams.get('sortBy')      || 'createdAt');
  const [sortOrder,   setSortOrder]   = useState(searchParams.get('sortOrder')   || 'desc');

  // ── Data state ────────────────────────────────────────────────────────────
  const [tasks,   setTasks]   = useState<Task[]>([]);
  const [meta,    setMeta]    = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (search)      params.set('search',      search);
      if (status)      params.set('status',      status);
      if (priority)    params.set('priority',    priority);
      if (slaBreached) params.set('slaBreached', slaBreached);
      params.set('page',      String(page));
      params.set('limit',     '20');
      params.set('sortBy',    sortBy);
      params.set('sortOrder', sortOrder);

      const res = await apiClient.get<Task[]>(`/api/tasks?${params}`);
      setTasks(res.data  ?? []);
      setMeta(res.meta   ?? null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [search, status, priority, slaBreached, page, sortBy, sortOrder]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  // Sync filters → URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (search)      params.set('search',      search);
    if (status)      params.set('status',      status);
    if (priority)    params.set('priority',    priority);
    if (slaBreached) params.set('slaBreached', slaBreached);
    if (page > 1)    params.set('page',        String(page));
    router.replace(`/dashboard/tasks?${params}`, { scroll: false });
  }, [search, status, priority, slaBreached, page, router]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
  };

  const clearFilters = () => {
    setSearch('');
    setStatus('');
    setPriority('');
    setSlaBreached('');
    setPage(1);
  };

  const hasFilters = search || status || priority || slaBreached;

  const toggleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    setPage(1);
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortBy !== field) {
      return <span className="text-gray-300 ml-1">↕</span>;
    }
    return (
      <span className="text-blue-500 ml-1">
        {sortOrder === 'asc' ? '↑' : '↓'}
      </span>
    );
  };

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Tasks</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {meta ? `${meta.total} task${meta.total !== 1 ? 's' : ''} total` : 'Loading...'}
          </p>
        </div>
        {(user?.role === 'USER' || canManage) && (
          <Link
            href="/dashboard/tasks/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600
                       hover:bg-blue-700 text-white text-sm font-medium rounded-lg
                       transition-colors shadow-sm"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 4v16m8-8H4" />
            </svg>
            Report Issue
          </Link>
        )}
      </div>

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <form onSubmit={handleSearchSubmit} className="flex flex-wrap gap-3">

          {/* Search */}
          <div className="flex-1 min-w-52 relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search tasks..."
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg
                         focus:outline-none focus:ring-2 focus:ring-blue-500
                         focus:border-transparent"
            />
          </div>

          {/* Status */}
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg
                       focus:outline-none focus:ring-2 focus:ring-blue-500
                       bg-white min-w-36"
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, ' ')}
              </option>
            ))}
          </select>

          {/* Priority */}
          <select
            value={priority}
            onChange={(e) => { setPriority(e.target.value); setPage(1); }}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg
                       focus:outline-none focus:ring-2 focus:ring-blue-500
                       bg-white min-w-32"
          >
            <option value="">All priorities</option>
            {PRIORITY_OPTIONS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>

          {/* SLA Breached */}
          <select
            value={slaBreached}
            onChange={(e) => { setSlaBreached(e.target.value); setPage(1); }}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg
                       focus:outline-none focus:ring-2 focus:ring-blue-500
                       bg-white"
          >
            <option value="">All SLA</option>
            <option value="true">SLA Breached</option>
            <option value="false">Within SLA</option>
          </select>

          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="px-3 py-2 text-sm text-red-600 hover:text-red-800
                         border border-red-200 rounded-lg hover:bg-red-50
                         transition-colors"
            >
              Clear filters
            </button>
          )}
        </form>
      </div>

      {/* ── Table ───────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {error ? (
          <div className="text-center py-10 text-sm text-red-600">{error}</div>
        ) : loading ? (
          <div className="space-y-0">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-gray-50">
                <div className="h-4 w-24 bg-gray-100 rounded animate-pulse" />
                <div className="flex-1 h-4 bg-gray-100 rounded animate-pulse" />
                <div className="h-6 w-20 bg-gray-100 rounded-full animate-pulse" />
                <div className="h-6 w-20 bg-gray-100 rounded-full animate-pulse" />
              </div>
            ))}
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-16">
            <svg className="h-12 w-12 text-gray-200 mx-auto mb-3" fill="none"
              stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-sm font-medium text-gray-400">No tasks found</p>
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="text-sm text-blue-600 hover:underline mt-1"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Table header */}
            <div className="grid grid-cols-12 gap-2 px-5 py-2.5 bg-gray-50
                            border-b border-gray-200 text-xs font-semibold
                            text-gray-500 uppercase tracking-wide">
              <div className="col-span-2">Code</div>
              <div className="col-span-3">Title</div>
              <div className="col-span-2">Machine</div>
              <div
                className="col-span-1 cursor-pointer hover:text-gray-700 select-none"
                onClick={() => toggleSort('priority')}
              >
                Priority <SortIcon field="priority" />
              </div>
              <div className="col-span-2">Status</div>
              <div
                className="col-span-1 cursor-pointer hover:text-gray-700 select-none"
                onClick={() => toggleSort('slaDeadline')}
              >
                SLA <SortIcon field="slaDeadline" />
              </div>
              <div
                className="col-span-1 cursor-pointer hover:text-gray-700 select-none"
                onClick={() => toggleSort('createdAt')}
              >
                Age <SortIcon field="createdAt" />
              </div>
            </div>

            {/* Rows */}
            <div className="divide-y divide-gray-50">
              {tasks.map((task) => (
                <Link
                  key={task._id}
                  href={`/dashboard/tasks/${task._id}`}
                  className="grid grid-cols-12 gap-2 px-5 py-3.5 hover:bg-gray-50
                             transition-colors items-center group"
                >
                  {/* Code */}
                  <div className="col-span-2 font-mono text-xs text-gray-500
                                  group-hover:text-blue-600 truncate">
                    {task.taskCode}
                  </div>

                  {/* Title */}
                  <div className="col-span-3">
                    <p className="text-sm font-medium text-gray-800 truncate
                                  group-hover:text-blue-700">
                      {task.title}
                    </p>
                    {task.assignedTo && (
                      <p className="text-xs text-gray-400 truncate">
                        → {task.assignedTo.name}
                      </p>
                    )}
                  </div>

                  {/* Machine */}
                  <div className="col-span-2 text-xs text-gray-500 truncate">
                    {task.machineryId?.name ?? '—'}
                  </div>

                  {/* Priority */}
                  <div className="col-span-1">
                    <PriorityBadge priority={task.priority} size="sm" />
                  </div>

                  {/* Status */}
                  <div className="col-span-2">
                    <StatusBadge status={task.status} size="sm" />
                  </div>

                  {/* SLA */}
                  <div className="col-span-1">
                    {task.slaBreached ? (
                      <span className="inline-flex items-center gap-1 text-xs
                                       text-red-600 font-medium">
                        <span className="h-1.5 w-1.5 bg-red-500 rounded-full" />
                        Breached
                      </span>
                    ) : (
                      <span className="text-xs text-green-600">
                        {formatSlaRemaining(task.slaDeadline)}
                      </span>
                    )}
                  </div>

                  {/* Age */}
                  <div className="col-span-1 text-xs text-gray-400">
                    {timeAgo(task.createdAt)}
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Pagination ──────────────────────────────────────────────────── */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Showing {(meta.page - 1) * meta.limit + 1}–
            {Math.min(meta.page * meta.limit, meta.total)} of {meta.total}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={meta.page <= 1}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg
                         hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed
                         transition-colors"
            >
              ← Prev
            </button>
            {getPageNumbers(meta.page, meta.totalPages).map((p, i) =>
              p === '...' ? (
                <span key={`ellipsis-${i}`}
                  className="px-2 py-1.5 text-sm text-gray-400">
                  …
                </span>
              ) : (
                <button
                  key={p}
                  onClick={() => setPage(Number(p))}
                  className={`px-3 py-1.5 text-sm border rounded-lg transition-colors
                              ${meta.page === p
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'border-gray-300 hover:bg-gray-50'
                              }`}
                >
                  {p}
                </button>
              )
            )}
            <button
              onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
              disabled={meta.page >= meta.totalPages}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg
                         hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed
                         transition-colors"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function timeAgo(dateStr: string): string {
  const diff  = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 60)  return `${mins}m`;
  if (hours < 24) return `${hours}h`;
  return `${days}d`;
}

function formatSlaRemaining(deadline: string): string {
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return 'Breached';
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(hours / 24);
  if (days > 0) return `${days}d left`;
  return `${hours}h left`;
}

function getPageNumbers(current: number, total: number): (number | string)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, '...', total];
  if (current >= total - 3) return [1, '...', total-4, total-3, total-2, total-1, total];
  return [1, '...', current-1, current, current+1, '...', total];
}