'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { apiClient } from '@/lib/apiClient';
import StatusBadge from '@/components/StatusBadge';
import PriorityBadge from '@/components/PriorityBadge';

interface TaskSummary {
  _id: string;
  taskCode: string;
  title: string;
  status: string;
  priority: string;
  slaDeadline: string;
  slaBreached: boolean;
  createdAt: string;
  machineryId?: { name: string };
}

interface StatCard {
  label: string;
  value: number;
  color: string;
  bg: string;
  href: string;
  query: string;
}

export default function DashboardPage() {
  const { user, canManage, isTechnician } = useAuth();

  const [tasks, setTasks]       = useState<TaskSummary[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [totalTasks, setTotal]  = useState(0);

  useEffect(() => {
    if (!user) return;

    const fetchTasks = async () => {
      try {
        const res = await apiClient.get<TaskSummary[]>('/api/tasks?limit=5&sortBy=createdAt&sortOrder=desc');
        setTasks(res.data ?? []);
        setTotal(res.meta?.total ?? 0);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load tasks');
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();
  }, [user]);

  // Build stat cards based on role
  const statCards: StatCard[] = canManage
    ? [
        { label: 'Reported',      value: 0, color: 'text-gray-700',   bg: 'bg-gray-50',   href: '/dashboard/tasks', query: '?status=REPORTED',      },
        { label: 'Under Review',  value: 0, color: 'text-yellow-700', bg: 'bg-yellow-50', href: '/dashboard/tasks', query: '?status=UNDER_REVIEW',   },
        { label: 'In Progress',   value: 0, color: 'text-indigo-700', bg: 'bg-indigo-50', href: '/dashboard/tasks', query: '?status=IN_PROGRESS',    },
        { label: 'Escalated',     value: 0, color: 'text-red-700',    bg: 'bg-red-50',    href: '/dashboard/tasks', query: '?status=ESCALATED',      },
        { label: 'SLA Breached',  value: 0, color: 'text-red-600',    bg: 'bg-red-50',    href: '/dashboard/tasks', query: '?slaBreached=true',      },
        { label: 'Total Tasks',   value: totalTasks, color: 'text-blue-700', bg: 'bg-blue-50', href: '/dashboard/tasks', query: '' },
      ]
    : isTechnician
    ? [
        { label: 'Assigned to Me', value: 0, color: 'text-blue-700',   bg: 'bg-blue-50',   href: '/dashboard/tasks', query: '?status=ASSIGNED'     },
        { label: 'In Progress',    value: 0, color: 'text-indigo-700', bg: 'bg-indigo-50', href: '/dashboard/tasks', query: '?status=IN_PROGRESS'  },
        { label: 'My Total Tasks', value: totalTasks, color: 'text-gray-700', bg: 'bg-gray-50', href: '/dashboard/tasks', query: '' },
      ]
    : [
        { label: 'My Tasks',      value: totalTasks, color: 'text-blue-700',  bg: 'bg-blue-50',  href: '/dashboard/tasks', query: ''                    },
        { label: 'In Progress',   value: 0,          color: 'text-indigo-700', bg: 'bg-indigo-50', href: '/dashboard/tasks', query: '?status=IN_PROGRESS' },
        { label: 'Completed',     value: 0,          color: 'text-teal-700',   bg: 'bg-teal-50',   href: '/dashboard/tasks', query: '?status=CONFIRMED'   },
      ];

  const slaBreachedCount = tasks.filter((t) => t.slaBreached).length;
  const greeting = getGreeting();

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {greeting}, {user?.name?.split(' ')[0]} 👋
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Here's what's happening in your factory today.
          </p>
        </div>
        {(user?.role === 'USER' || canManage) && (
          <Link
            href="/dashboard/tasks/new"
            className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 bg-blue-600
                       hover:bg-blue-700 text-white text-sm font-medium rounded-lg
                       transition-colors shadow-sm"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 4v16m8-8H4" />
            </svg>
            <span className="hidden sm:inline">Report Issue</span>
          </Link>
        )}
      </div>

      {/* ── SLA breach alert ────────────────────────────────────────────── */}
      {canManage && slaBreachedCount > 0 && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200
                        text-red-700 rounded-xl px-4 py-3 text-sm">
          <svg className="h-5 w-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd" />
          </svg>
          <span>
            <strong>{slaBreachedCount}</strong> task{slaBreachedCount > 1 ? 's have' : ' has'} breached SLA in your recent view.{' '}
            <Link href="/dashboard/tasks?slaBreached=true"
              className="underline font-semibold hover:text-red-800">
              View all breached tasks →
            </Link>
          </span>
        </div>
      )}

      {/* ── Stat cards ──────────────────────────────────────────────────── */}
      <div className={`grid gap-4 ${statCards.length >= 6 ? 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-6' : 'grid-cols-2 sm:grid-cols-3'}`}>
        {statCards.map((s) => (
          <Link
            key={s.label}
            href={`${s.href}${s.query}`}
            className={`${s.bg} rounded-xl p-4 border border-gray-100
                        hover:shadow-md transition-shadow group`}
          >
            <p className="text-xs font-medium text-gray-500 mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-400 mt-1 group-hover:underline">
              View tasks →
            </p>
          </Link>
        ))}
      </div>

      {/* ── Recent tasks ────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-800">Recent Tasks</h2>
          <Link
            href="/dashboard/tasks"
            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
          >
            View all →
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
          </div>
        ) : error ? (
          <div className="text-center py-10 text-sm text-red-600">{error}</div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-12">
            <svg className="h-10 w-10 text-gray-300 mx-auto mb-3" fill="none"
              stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-sm text-gray-400">No tasks yet.</p>
            {(user?.role === 'USER' || canManage) && (
              <Link href="/dashboard/tasks/new"
                className="text-sm text-blue-600 hover:underline mt-1 block">
                Report your first issue →
              </Link>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {tasks.map((task) => (
              <Link
                key={task._id}
                href={`/dashboard/tasks/${task._id}`}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50
                           transition-colors group"
              >
                {/* SLA indicator */}
                <div
                  className={`h-2 w-2 rounded-full flex-shrink-0 ${
                    task.slaBreached ? 'bg-red-500' : 'bg-green-400'
                  }`}
                  title={task.slaBreached ? 'SLA Breached' : 'Within SLA'}
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-mono text-gray-400">
                      {task.taskCode}
                    </span>
                    {task.machineryId && (
                      <span className="text-xs text-gray-400 truncate">
                        — {task.machineryId.name}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-gray-800 truncate
                                group-hover:text-blue-700">
                    {task.title}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <PriorityBadge priority={task.priority} size="sm" />
                  <StatusBadge   status={task.status}     size="sm" />
                  <span className="text-xs text-gray-400 hidden xl:block">
                    {timeAgo(task.createdAt)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return 'just now';
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}