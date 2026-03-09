'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { apiClient, ApiClientError } from '@/lib/apiClient';

interface Machine {
  _id: string;
  name: string;
  serialNumber: string;
  location: string;
}

type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

const PRIORITY_OPTIONS: { value: Priority; label: string; desc: string; color: string }[] = [
  { value: 'LOW',      label: 'Low',      desc: 'Non-urgent, 7 days SLA',    color: 'border-gray-300   bg-gray-50   text-gray-700'   },
  { value: 'MEDIUM',   label: 'Medium',   desc: 'Standard, 72 hours SLA',    color: 'border-blue-300   bg-blue-50   text-blue-700'   },
  { value: 'HIGH',     label: 'High',     desc: 'Urgent, 24 hours SLA',      color: 'border-orange-300 bg-orange-50 text-orange-700' },
  { value: 'CRITICAL', label: 'Critical', desc: 'Emergency, 4 hours SLA',    color: 'border-red-300    bg-red-50    text-red-700'    },
];

export default function NewTaskPage() {
  const { user, canManage } = useAuth();
  const router = useRouter();

  const [machines, setMachines]     = useState<Machine[]>([]);
  const [loadingMachines, setLoadingMachines] = useState(true);

  const [title, setTitle]           = useState('');
  const [description, setDescription] = useState('');
  const [machineryId, setMachineryId] = useState('');
  const [priority, setPriority]     = useState<Priority>('MEDIUM');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState('');
  const [dupWarning, setDupWarning] = useState<{
    warning: string;
    existingTask: { taskCode: string; _id: string };
  } | null>(null);

  // Only USER and MANAGER roles can create tasks
  useEffect(() => {
    if (user && user.role === 'TECHNICIAN') {
      router.replace('/dashboard/tasks');
    }
  }, [user, router]);

  useEffect(() => {
    apiClient.get<Machine[]>('/api/machinery?status=ACTIVE')
      .then((res) => setMachines(res.data ?? []))
      .catch(() => setError('Failed to load machinery list'))
      .finally(() => setLoadingMachines(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setDupWarning(null);

    // Client-side validation
    if (title.trim().length < 3) {
      setError('Title must be at least 3 characters');
      return;
    }
    if (description.trim().length < 10) {
      setError('Description must be at least 10 characters');
      return;
    }
    if (!machineryId) {
      setError('Please select a machine');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiClient.post<{ _id: string; taskCode: string }>(
        '/api/tasks',
        { title: title.trim(), description: description.trim(), machineryId, priority }
      );
      router.push(`/dashboard/tasks/${res.data._id}`);
    } catch (err: unknown) {
      if (err instanceof ApiClientError && err.statusCode === 409) {
        // Soft duplicate detected
        try {
          const parsed = err.raw as {
            warning: string;
            existingTask: { taskCode: string; _id: string };
          };
          if (parsed?.warning) {
            setDupWarning(parsed);
            return;
          }
        } catch {
          // fall through
        }
      }
      setError(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setSubmitting(false);
    }
  };

  const charCountDesc = description.length;

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/tasks"
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-lg font-bold text-gray-900">Report a New Issue</h1>
          <p className="text-sm text-gray-500">
            Fill in the details about the machinery problem
          </p>
        </div>
      </div>

      {/* ── Duplicate warning ───────────────────────────────────────────── */}
      {dupWarning && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
          <div className="flex items-start gap-2">
            <svg className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-amber-800">
                {dupWarning.warning}
              </p>
              <p className="text-sm text-amber-700 mt-0.5">
                Existing task:{' '}
                <span className="font-mono font-bold">
                  {dupWarning.existingTask.taskCode}
                </span>
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link
              href={`/dashboard/tasks/${dupWarning.existingTask._id}`}
              className="flex-1 text-center text-sm font-medium px-3 py-2
                         bg-amber-600 text-white rounded-lg hover:bg-amber-700
                         transition-colors"
            >
              View existing task
            </Link>
            <button
              onClick={() => setDupWarning(null)}
              className="flex-1 text-sm font-medium px-3 py-2 border border-amber-300
                         text-amber-700 rounded-lg hover:bg-amber-100 transition-colors"
            >
              Create anyway
            </button>
          </div>
        </div>
      )}

      {/* ── Error ───────────────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200
                        text-red-700 text-sm rounded-lg px-4 py-3">
          <svg className="h-4 w-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd" />
          </svg>
          {error}
        </div>
      )}

      {/* ── Form ────────────────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">

        {/* Title */}
        <div className="p-5 space-y-1.5">
          <label className="block text-sm font-semibold text-gray-700">
            Issue Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Conveyor belt making grinding noise"
            maxLength={200}
            className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-lg
                       focus:outline-none focus:ring-2 focus:ring-blue-500
                       focus:border-transparent placeholder:text-gray-400 transition"
          />
          <p className="text-xs text-gray-400">{title.length}/200 characters</p>
        </div>

        {/* Description */}
        <div className="p-5 space-y-1.5">
          <label className="block text-sm font-semibold text-gray-700">
            Description <span className="text-red-500">*</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the problem in detail — what you observed, when it started, any unusual sounds or behaviour..."
            rows={4}
            maxLength={2000}
            className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-lg
                       focus:outline-none focus:ring-2 focus:ring-blue-500
                       focus:border-transparent placeholder:text-gray-400
                       resize-none transition"
          />
          <p className={`text-xs ${charCountDesc < 10 ? 'text-red-400' : 'text-gray-400'}`}>
            {charCountDesc}/2000 characters
            {charCountDesc < 10 && charCountDesc > 0 && (
              <span className="ml-1">— need at least 10</span>
            )}
          </p>
        </div>

        {/* Machine */}
        <div className="p-5 space-y-1.5">
          <label className="block text-sm font-semibold text-gray-700">
            Affected Machine <span className="text-red-500">*</span>
          </label>
          {loadingMachines ? (
            <div className="h-10 bg-gray-100 animate-pulse rounded-lg" />
          ) : (
            <select
              value={machineryId}
              onChange={(e) => setMachineryId(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-lg
                         focus:outline-none focus:ring-2 focus:ring-blue-500
                         focus:border-transparent bg-white transition"
            >
              <option value="">Select a machine...</option>
              {machines.map((m) => (
                <option key={m._id} value={m._id}>
                  {m.name} — {m.serialNumber} ({m.location})
                </option>
              ))}
            </select>
          )}
          {machines.length === 0 && !loadingMachines && (
            <p className="text-xs text-amber-600">
              No active machines found. Contact your manager.
            </p>
          )}
        </div>

        {/* Priority */}
        <div className="p-5 space-y-2">
          <label className="block text-sm font-semibold text-gray-700">
            Priority <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            {PRIORITY_OPTIONS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setPriority(p.value)}
                className={`text-left px-3.5 py-3 border-2 rounded-xl transition-all
                            ${priority === p.value
                              ? `${p.color} border-opacity-100 shadow-sm`
                              : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                            }`}
              >
                <p className="text-sm font-semibold">{p.label}</p>
                <p className="text-xs opacity-75 mt-0.5">{p.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Submit */}
        <div className="p-5 flex gap-3">
          <Link
            href="/dashboard/tasks"
            className="flex-1 text-center text-sm font-medium py-2.5 border
                       border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50
                       transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting || loadingMachines}
            className="flex-1 flex items-center justify-center gap-2 py-2.5
                       bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400
                       text-white text-sm font-medium rounded-lg
                       transition-colors"
          >
            {submitting && (
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10"
                  stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {submitting ? 'Submitting...' : 'Submit Issue'}
          </button>
        </div>
      </form>
    </div>
  );
}