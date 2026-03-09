'use client';

import { useEffect, useState, useCallback, use } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { apiClient, ApiClientError } from '@/lib/apiClient';
import StatusBadge from '@/components/StatusBadge';
import PriorityBadge from '@/components/PriorityBadge';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Technician {
  _id: string;
  name: string;
  email: string;
}

interface MaterialItem {
  name: string;
  quantity: number;
  unit: string;
}

interface MaterialRequest {
  _id: string;
  status: string;
  items: MaterialItem[];
  rejectionCount: number;
  rejectionNote: string | null;
  approvedBy?: { name: string } | null;
  requestedBy?: { name: string };
  createdAt: string;
}

interface EventLogEntry {
  action: string;
  fromStatus: string | null;
  toStatus: string;
  performedBy: { userId: string; name: string; role: string };
  note?: string;
  timestamp: string;
}

interface Task {
  _id: string;
  taskCode: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  slaDeadline: string;
  slaBreached: boolean;
  __v: number;
  reportedBy: { _id: string; name: string; email: string };
  assignedTo: { _id: string; name: string; email: string } | null;
  machineryId: { _id: string; name: string; serialNumber: string; location: string; type: string };
  cancellationReason: string | null;
  rejectionReason: string | null;
  pauseReason: string | null;
  reopenReason: string | null;
  escalatedAt: string | null;
  completedAt: string | null;
  confirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Modal types ───────────────────────────────────────────────────────────────
type ModalType =
  | 'assign'
  | 'cancel'
  | 'reject'
  | 'pause'
  | 'reopen'
  | 'material_request'
  | 'approve_mr'
  | 'reject_mr'
  | null;

const TERMINAL_STATES = ['CONFIRMED', 'CANCELLED', 'REJECTED'];

// ─────────────────────────────────────────────────────────────────────────────
export default function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user, canManage, isTechnician } = useAuth();

  const [task,         setTask]         = useState<Task | null>(null);
  const [materialReqs, setMaterialReqs] = useState<MaterialRequest[]>([]);
  const [eventLog,     setEventLog]     = useState<EventLogEntry[]>([]);
  const [technicians,  setTechnicians]  = useState<Technician[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error,        setError]        = useState('');
  const [actionError,  setActionError]  = useState('');
  const [successMsg,   setSuccessMsg]   = useState('');

  // Modal state
  const [modal,      setModal]      = useState<ModalType>(null);
  const [activeMrId, setActiveMrId] = useState<string>('');

  // Form inputs for various actions
  const [assignedTo,      setAssignedTo]      = useState('');
  const [cancelReason,    setCancelReason]    = useState('');
  const [rejectReason,    setRejectReason]    = useState('');
  const [pauseReason,     setPauseReason]     = useState('');
  const [reopenReason,    setReopenReason]    = useState('');
  const [mrRejectNote,    setMrRejectNote]    = useState('');
  const [mrItems,         setMrItems]         = useState<MaterialItem[]>([
    { name: '', quantity: 1, unit: 'pcs' },
  ]);

  const UNIT_OPTIONS = ['pcs', 'kg', 'litres', 'metres', 'boxes'];

  // ── Fetch task ────────────────────────────────────────────────────────────
  const fetchTask = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get<Task>(`/api/tasks/${id}`);
      setTask(res.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load task');
    } finally {
      setLoading(false);
    }
  }, [id]);

  // ── Fetch material requests ───────────────────────────────────────────────
  const fetchMaterialReqs = useCallback(async () => {
    try {
      const res = await apiClient.get<MaterialRequest[]>(
        `/api/tasks/${id}/material-request`
      );
      setMaterialReqs(res.data ?? []);
    } catch {
      // Non-fatal
    }
  }, [id]);

  // ── Fetch event log (managers only) ──────────────────────────────────────
  const fetchEventLog = useCallback(async () => {
    if (!canManage) return;
    try {
      const res = await apiClient.get<EventLogEntry[]>(
        `/api/tasks/${id}/event-log`
      );
      setEventLog(res.data ?? []);
    } catch {
      // Non-fatal
    }
  }, [id, canManage]);

  // ── Fetch technicians (managers only) ────────────────────────────────────
  const fetchTechnicians = useCallback(async () => {
    if (!canManage) return;
    try {
      const res = await apiClient.get<Technician[]>('/api/users/technicians');
      setTechnicians(res.data ?? []);
    } catch {
      // Non-fatal
    }
  }, [canManage]);

  useEffect(() => {
    fetchTask();
    fetchMaterialReqs();
    fetchEventLog();
    fetchTechnicians();
  }, [fetchTask, fetchMaterialReqs, fetchEventLog, fetchTechnicians]);

  // ── Action helpers ────────────────────────────────────────────────────────
  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const closeModal = () => {
    setModal(null);
    setActiveMrId('');
    setAssignedTo('');
    setCancelReason('');
    setRejectReason('');
    setPauseReason('');
    setReopenReason('');
    setMrRejectNote('');
    setMrItems([{ name: '', quantity: 1, unit: 'pcs' }]);
    setActionError('');
  };

  // ── Generic status transition ─────────────────────────────────────────────
  const doTransition = async (nextStatus: string, extra: Record<string, unknown> = {}) => {
    if (!task) return;
    setActionLoading(true);
    setActionError('');
    try {
      const res = await apiClient.patch<Task>(`/api/tasks/${id}/status`, {
        nextStatus,
        __v: task.__v,
        ...extra,
      });
      setTask(res.data);
      showSuccess(`Task moved to ${nextStatus.replace(/_/g, ' ')}`);
      closeModal();
      fetchMaterialReqs();
      fetchEventLog();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Assign technician ─────────────────────────────────────────────────────
  const doAssign = async () => {
    if (!task || !assignedTo) return;
    setActionLoading(true);
    setActionError('');
    try {
      const res = await apiClient.patch<Task>(`/api/tasks/${id}/assign`, {
        assignedTo,
        __v: task.__v,
      });
      setTask(res.data);
      showSuccess('Task assigned successfully');
      closeModal();
      fetchEventLog();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Assignment failed');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Create material request ───────────────────────────────────────────────
  const doCreateMR = async () => {
    setActionLoading(true);
    setActionError('');
    const validItems = mrItems.filter((i) => i.name.trim() && i.quantity >= 1);
    if (validItems.length === 0) {
      setActionError('Add at least one valid item');
      setActionLoading(false);
      return;
    }
    try {
      await apiClient.post(`/api/tasks/${id}/material-request`, {
        items: validItems,
      });
      showSuccess('Material request submitted');
      closeModal();
      fetchTask();
      fetchMaterialReqs();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to submit request');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Approve material request ──────────────────────────────────────────────
  const doApproveMR = async () => {
    setActionLoading(true);
    setActionError('');
    try {
      await apiClient.patch(
        `/api/tasks/${id}/material-request/${activeMrId}/approve`,
        {}
      );
      showSuccess('Material request approved, inventory updated');
      closeModal();
      fetchTask();
      fetchMaterialReqs();
      fetchEventLog();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Approval failed');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Reject material request ───────────────────────────────────────────────
  const doRejectMR = async () => {
    if (!mrRejectNote.trim()) {
      setActionError('Rejection note is required');
      return;
    }
    setActionLoading(true);
    setActionError('');
    try {
      const res = await apiClient.patch<{
        escalated: boolean;
        rejectionCount: number;
        message: string;
      }>(
        `/api/tasks/${id}/material-request/${activeMrId}/reject`,
        { rejectionNote: mrRejectNote.trim() }
      );
      showSuccess(res.data.message);
      closeModal();
      fetchTask();
      fetchMaterialReqs();
      fetchEventLog();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Rejection failed');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Determine available actions ───────────────────────────────────────────
  const getActions = () => {
    if (!task || !user) return [];
    const s = task.status;
    const isAssigned = task.assignedTo?._id === user._id;
    const actions: { label: string; color: string; fn: () => void; danger?: boolean }[] = [];

    if (canManage) {
      if (s === 'REPORTED') {
        actions.push({
          label: 'Move to Review',
          color: 'bg-yellow-500 hover:bg-yellow-600',
          fn: () => doTransition('UNDER_REVIEW'),
        });
        actions.push({
          label: 'Cancel Task',
          color: 'bg-red-500 hover:bg-red-600',
          fn: () => setModal('cancel'),
          danger: true,
        });
      }
      if (s === 'UNDER_REVIEW') {
        actions.push({
          label: 'Assign Technician',
          color: 'bg-blue-600 hover:bg-blue-700',
          fn: () => setModal('assign'),
        });
        actions.push({
          label: 'Reject Task',
          color: 'bg-orange-500 hover:bg-orange-600',
          fn: () => setModal('reject'),
          danger: true,
        });
        actions.push({
          label: 'Cancel Task',
          color: 'bg-red-500 hover:bg-red-600',
          fn: () => setModal('cancel'),
          danger: true,
        });
      }
      if (s === 'ASSIGNED') {
        actions.push({
          label: 'Cancel Task',
          color: 'bg-red-500 hover:bg-red-600',
          fn: () => setModal('cancel'),
          danger: true,
        });
      }
      if (s === 'IN_PROGRESS') {
        actions.push({
          label: 'Pause Task',
          color: 'bg-slate-500 hover:bg-slate-600',
          fn: () => setModal('pause'),
        });
      }
      if (s === 'PAUSED') {
        actions.push({
          label: 'Resume Task',
          color: 'bg-indigo-600 hover:bg-indigo-700',
          fn: () => doTransition('IN_PROGRESS'),
        });
        actions.push({
          label: 'Cancel Task',
          color: 'bg-red-500 hover:bg-red-600',
          fn: () => setModal('cancel'),
          danger: true,
        });
      }
      if (s === 'ESCALATED') {
        actions.push({
          label: 'Resolve Escalation',
          color: 'bg-purple-600 hover:bg-purple-700',
          fn: () => doTransition('IN_PROGRESS'),
        });
        actions.push({
          label: 'Cancel Task',
          color: 'bg-red-500 hover:bg-red-600',
          fn: () => setModal('cancel'),
          danger: true,
        });
      }
      if (s === 'MATERIAL_REQUESTED') {
        actions.push({
          label: 'Cancel Task',
          color: 'bg-red-500 hover:bg-red-600',
          fn: () => setModal('cancel'),
          danger: true,
        });
      }
      if (s === 'COMPLETED') {
        actions.push({
          label: 'Confirm Completion',
          color: 'bg-green-600 hover:bg-green-700',
          fn: () => doTransition('CONFIRMED'),
        });
        actions.push({
          label: 'Reopen Task',
          color: 'bg-purple-500 hover:bg-purple-600',
          fn: () => setModal('reopen'),
        });
      }
      if (s === 'REOPENED') {
        actions.push({
          label: 'Reassign Technician',
          color: 'bg-blue-600 hover:bg-blue-700',
          fn: () => setModal('assign'),
        });
      }
    }

    if (isTechnician && isAssigned) {
      if (s === 'ASSIGNED') {
        actions.push({
          label: 'Start Working',
          color: 'bg-indigo-600 hover:bg-indigo-700',
          fn: () => doTransition('IN_PROGRESS'),
        });
      }
      if (s === 'IN_PROGRESS') {
        actions.push({
          label: 'Request Materials',
          color: 'bg-orange-500 hover:bg-orange-600',
          fn: () => setModal('material_request'),
        });
        actions.push({
          label: 'Mark as Completed',
          color: 'bg-teal-600 hover:bg-teal-700',
          fn: () => doTransition('COMPLETED'),
        });
      }
      if (s === 'REOPENED') {
        actions.push({
          label: 'Start Working',
          color: 'bg-indigo-600 hover:bg-indigo-700',
          fn: () => doTransition('IN_PROGRESS'),
        });
      }
    }

    return actions;
  };

  // ─────────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-600 text-sm mb-4">{error || 'Task not found'}</p>
        <Link href="/dashboard/tasks"
          className="text-blue-600 hover:underline text-sm">
          ← Back to tasks
        </Link>
      </div>
    );
  }

  const actions     = getActions();
  const isTerminal  = TERMINAL_STATES.includes(task.status);
  const pendingMR   = materialReqs.find((m) => m.status === 'PENDING');
  const slaDate     = new Date(task.slaDeadline);
  const isAssignedToMe = task.assignedTo?._id === user?._id;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">

      {/* ── Success toast ────────────────────────────────────────────────── */}
      {successMsg && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200
                        text-green-700 text-sm rounded-xl px-4 py-3">
          <svg className="h-4 w-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd" />
          </svg>
          {successMsg}
        </div>
      )}

      {/* ── Breadcrumb + back ────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/dashboard/tasks" className="hover:text-blue-600 transition-colors">
          Tasks
        </Link>
        <span>/</span>
        <span className="font-mono text-gray-700">{task.taskCode}</span>
      </div>

      {/* ── Header card ──────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="font-mono text-xs text-gray-400 bg-gray-100
                               px-2 py-0.5 rounded">
                {task.taskCode}
              </span>
              <PriorityBadge priority={task.priority} />
              <StatusBadge   status={task.status}   />
              {task.slaBreached && (
                <span className="text-xs font-medium text-red-600 bg-red-50
                                  border border-red-200 px-2 py-0.5 rounded-full">
                  ⚠ SLA Breached
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold text-gray-900">{task.title}</h1>
          </div>

          {/* Actions */}
          {!isTerminal && actions.length > 0 && (
            <div className="flex flex-wrap gap-2 flex-shrink-0">
              {actions.map((a) => (
                <button
                  key={a.label}
                  onClick={a.fn}
                  disabled={actionLoading}
                  className={`px-3.5 py-2 text-sm font-medium text-white rounded-lg
                              transition-colors disabled:opacity-50 ${a.color}`}
                >
                  {a.label}
                </button>
              ))}
            </div>
          )}

          {isTerminal && (
            <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1.5
                             rounded-lg font-medium flex-shrink-0">
              Terminal state
            </span>
          )}
        </div>

        {/* Description */}
        <div className="bg-gray-50 rounded-lg px-4 py-3">
          <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
            {task.description}
          </p>
        </div>

        {/* Meta grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <MetaField
            label="Machine"
            value={`${task.machineryId?.name} (${task.machineryId?.serialNumber})`}
          />
          <MetaField
            label="Location"
            value={task.machineryId?.location}
          />
          <MetaField
            label="Reported By"
            value={task.reportedBy?.name}
          />
          <MetaField
            label="Assigned To"
            value={task.assignedTo
              ? `${task.assignedTo.name}${isAssignedToMe ? ' (You)' : ''}`
              : 'Unassigned'}
            muted={!task.assignedTo}
          />
          <MetaField
            label="SLA Deadline"
            value={slaDate.toLocaleDateString('en-IN', {
              day: '2-digit', month: 'short', year: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })}
            danger={task.slaBreached}
          />
          <MetaField
            label="Created"
            value={new Date(task.createdAt).toLocaleDateString('en-IN', {
              day: '2-digit', month: 'short', year: 'numeric',
            })}
          />
          {task.completedAt && (
            <MetaField
              label="Completed"
              value={new Date(task.completedAt).toLocaleDateString('en-IN', {
                day: '2-digit', month: 'short', year: 'numeric',
              })}
            />
          )}
          {task.confirmedAt && (
            <MetaField
              label="Confirmed"
              value={new Date(task.confirmedAt).toLocaleDateString('en-IN', {
                day: '2-digit', month: 'short', year: 'numeric',
              })}
            />
          )}
        </div>

        {/* Reason fields */}
        {task.cancellationReason && (
          <ReasonBanner color="red" label="Cancellation Reason" text={task.cancellationReason} />
        )}
        {task.rejectionReason && (
          <ReasonBanner color="orange" label="Rejection Reason" text={task.rejectionReason} />
        )}
        {task.pauseReason && (
          <ReasonBanner color="slate" label="Pause Reason" text={task.pauseReason} />
        )}
        {task.reopenReason && (
          <ReasonBanner color="purple" label="Reopen Reason" text={task.reopenReason} />
        )}
      </div>

      {/* ── Material Requests ─────────────────────────────────────────────── */}
      {(isTechnician || canManage) && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-800">
              Material Requests
              {materialReqs.length > 0 && (
                <span className="ml-2 text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                  {materialReqs.length}
                </span>
              )}
            </h2>
          </div>

          {materialReqs.length === 0 ? (
            <div className="px-5 py-6 text-sm text-gray-400 text-center">
              No material requests yet.
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {materialReqs.map((mr) => (
                <div key={mr._id} className="px-5 py-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-medium px-2.5 py-1 rounded-full
                          ${mr.status === 'PENDING'   ? 'bg-yellow-50  text-yellow-700' : ''}
                          ${mr.status === 'APPROVED'  ? 'bg-green-50   text-green-700'  : ''}
                          ${mr.status === 'REJECTED'  ? 'bg-red-50     text-red-700'    : ''}
                        `}
                      >
                        {mr.status}
                      </span>
                      {mr.rejectionCount > 0 && (
                        <span className="text-xs text-red-500">
                          {mr.rejectionCount} rejection{mr.rejectionCount > 1 ? 's' : ''}
                        </span>
                      )}
                      <span className="text-xs text-gray-400">
                        {new Date(mr.createdAt).toLocaleDateString('en-IN', {
                          day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                    </div>

                    {/* Manager approve / reject buttons */}
                    {canManage && mr.status === 'PENDING' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setActiveMrId(mr._id);
                            setModal('approve_mr');
                          }}
                          className="px-3 py-1.5 text-xs font-medium bg-green-600
                                     hover:bg-green-700 text-white rounded-lg transition-colors"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => {
                            setActiveMrId(mr._id);
                            setModal('reject_mr');
                          }}
                          className="px-3 py-1.5 text-xs font-medium bg-red-500
                                     hover:bg-red-600 text-white rounded-lg transition-colors"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Items table */}
                  <div className="rounded-lg border border-gray-100 overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left px-3 py-2 font-semibold text-gray-500">Item</th>
                          <th className="text-right px-3 py-2 font-semibold text-gray-500">Qty</th>
                          <th className="text-left px-3 py-2 font-semibold text-gray-500">Unit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {mr.items.map((item, idx) => (
                          <tr key={idx}>
                            <td className="px-3 py-2 text-gray-700">{item.name}</td>
                            <td className="px-3 py-2 text-right text-gray-700">{item.quantity}</td>
                            <td className="px-3 py-2 text-gray-400">{item.unit}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {mr.rejectionNote && (
                    <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
                      <span className="font-semibold">Rejection note:</span> {mr.rejectionNote}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Event Log (managers only) ────────────────────────────────────── */}
      {canManage && eventLog.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-800">
              Audit Trail
              <span className="ml-2 text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                {eventLog.length} events
              </span>
            </h2>
          </div>
          <div className="p-5">
            <div className="space-y-0">
              {[...eventLog].reverse().map((entry, idx) => (
                <div key={idx} className="flex gap-3 pb-4">
                  <div className="flex flex-col items-center">
                    <div className="h-2.5 w-2.5 rounded-full bg-blue-400 mt-1 flex-shrink-0" />
                    {idx < eventLog.length - 1 && (
                      <div className="w-px bg-gray-200 flex-1 mt-1" />
                    )}
                  </div>
                  <div className="flex-1 pb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-gray-700">
                        {entry.performedBy.name}
                      </span>
                      <span className="text-xs text-gray-400">
                        ({entry.performedBy.role})
                      </span>
                      {entry.fromStatus && (
                        <span className="text-xs text-gray-400">
                          {entry.fromStatus} → <strong className="text-gray-600">{entry.toStatus}</strong>
                        </span>
                      )}
                      <span className="text-xs text-gray-400 ml-auto">
                        {new Date(entry.timestamp).toLocaleDateString('en-IN', {
                          day: '2-digit', month: 'short',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                    </div>
                    {entry.note && (
                      <p className="text-xs text-gray-500 mt-0.5">{entry.note}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* MODALS                                                            */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={closeModal}
          />

          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md
                          border border-gray-200 z-10 overflow-hidden">

            {/* Modal header */}
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">
                {modal === 'assign'           && 'Assign Technician'}
                {modal === 'cancel'           && 'Cancel Task'}
                {modal === 'reject'           && 'Reject Task'}
                {modal === 'pause'            && 'Pause Task'}
                {modal === 'reopen'           && 'Reopen Task'}
                {modal === 'material_request' && 'Request Materials'}
                {modal === 'approve_mr'       && 'Approve Material Request'}
                {modal === 'reject_mr'        && 'Reject Material Request'}
              </h3>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal body */}
            <div className="px-5 py-4 space-y-4">

              {actionError && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200
                                rounded-lg px-3 py-2.5">
                  {actionError}
                </div>
              )}

              {/* ── Assign ── */}
              {modal === 'assign' && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">
                    Select Technician
                  </label>
                  <select
                    value={assignedTo}
                    onChange={(e) => setAssignedTo(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm border border-gray-300
                               rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500
                               bg-white"
                  >
                    <option value="">Choose a technician...</option>
                    {technicians.map((t) => (
                      <option key={t._id} value={t._id}>
                        {t.name} — {t.email}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* ── Cancel ── */}
              {modal === 'cancel' && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">
                    Cancellation Reason <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    rows={3}
                    placeholder="Why is this task being cancelled?"
                    className="w-full px-3.5 py-2.5 text-sm border border-gray-300
                               rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500
                               resize-none"
                  />
                </div>
              )}

              {/* ── Reject ── */}
              {modal === 'reject' && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">
                    Rejection Reason <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    rows={3}
                    placeholder="Why is this task being rejected?"
                    className="w-full px-3.5 py-2.5 text-sm border border-gray-300
                               rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500
                               resize-none"
                  />
                </div>
              )}

              {/* ── Pause ── */}
              {modal === 'pause' && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">
                    Pause Reason <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={pauseReason}
                    onChange={(e) => setPauseReason(e.target.value)}
                    rows={3}
                    placeholder="Why is this task being paused?"
                    className="w-full px-3.5 py-2.5 text-sm border border-gray-300
                               rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500
                               resize-none"
                  />
                </div>
              )}

              {/* ── Reopen ── */}
              {modal === 'reopen' && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">
                    Reopen Reason <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={reopenReason}
                    onChange={(e) => setReopenReason(e.target.value)}
                    rows={3}
                    placeholder="Why is this task being reopened?"
                    className="w-full px-3.5 py-2.5 text-sm border border-gray-300
                               rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500
                               resize-none"
                  />
                </div>
              )}

              {/* ── Material Request ── */}
              {modal === 'material_request' && (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600">
                    Add the items you need from inventory:
                  </p>
                  {mrItems.map((item, idx) => (
                    <div key={idx} className="flex gap-2 items-start">
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => {
                          const updated = [...mrItems];
                          updated[idx].name = e.target.value;
                          setMrItems(updated);
                        }}
                        placeholder="Item name"
                        className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg
                                   focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) => {
                          const updated = [...mrItems];
                          updated[idx].quantity = parseInt(e.target.value) || 1;
                          setMrItems(updated);
                        }}
                        className="w-20 px-3 py-2 text-sm border border-gray-300 rounded-lg
                                   focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <select
                        value={item.unit}
                        onChange={(e) => {
                          const updated = [...mrItems];
                          updated[idx].unit = e.target.value;
                          setMrItems(updated);
                        }}
                        className="w-24 px-2 py-2 text-sm border border-gray-300 rounded-lg
                                   focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        {UNIT_OPTIONS.map((u) => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </select>
                      {mrItems.length > 1 && (
                        <button
                          onClick={() => setMrItems(mrItems.filter((_, i) => i !== idx))}
                          className="text-red-400 hover:text-red-600 mt-2"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setMrItems([...mrItems, { name: '', quantity: 1, unit: 'pcs' }])}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    + Add another item
                  </button>
                </div>
              )}

              {/* ── Approve MR ── */}
              {modal === 'approve_mr' && (
                <p className="text-sm text-gray-600">
                  Approving this material request will deduct items from inventory
                  and move the task back to <strong>IN_PROGRESS</strong>. This
                  action uses a MongoDB transaction and cannot be undone.
                </p>
              )}

              {/* ── Reject MR ── */}
              {modal === 'reject_mr' && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">
                    Rejection Note <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={mrRejectNote}
                    onChange={(e) => setMrRejectNote(e.target.value)}
                    rows={3}
                    placeholder="Explain why you're rejecting this request..."
                    className="w-full px-3.5 py-2.5 text-sm border border-gray-300
                               rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500
                               resize-none"
                  />
                  {pendingMR && pendingMR.rejectionCount >= 2 && (
                    <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
                      ⚠ This rejection will trigger <strong>auto-escalation</strong>{' '}
                      (rejection count will reach 3).
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div className="px-5 py-4 border-t border-gray-100 flex gap-3">
              <button
                onClick={closeModal}
                className="flex-1 py-2.5 text-sm font-medium border border-gray-300
                           text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (modal === 'assign')           doAssign();
                  if (modal === 'cancel')           doTransition('CANCELLED',   { cancellationReason: cancelReason });
                  if (modal === 'reject')           doTransition('REJECTED',    { rejectionReason: rejectReason });
                  if (modal === 'pause')            doTransition('PAUSED',      { pauseReason });
                  if (modal === 'reopen')           doTransition('REOPENED',    { reopenReason });
                  if (modal === 'material_request') doCreateMR();
                  if (modal === 'approve_mr')       doApproveMR();
                  if (modal === 'reject_mr')        doRejectMR();
                }}
                disabled={actionLoading}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5
                            text-sm font-medium text-white rounded-lg
                            transition-colors disabled:opacity-50
                            ${modal === 'cancel' || modal === 'reject' || modal === 'reject_mr'
                              ? 'bg-red-600 hover:bg-red-700'
                              : 'bg-blue-600 hover:bg-blue-700'
                            }`}
              >
                {actionLoading && (
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10"
                      stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {actionLoading ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Reusable sub-components ───────────────────────────────────────────────────
function MetaField({
  label,
  value,
  muted = false,
  danger = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
  danger?: boolean;
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
        {label}
      </p>
      <p className={`text-sm font-medium
        ${danger ? 'text-red-600' : muted ? 'text-gray-400 italic' : 'text-gray-800'}`}>
        {value || '—'}
      </p>
    </div>
  );
}

function ReasonBanner({
  color,
  label,
  text,
}: {
  color: 'red' | 'orange' | 'slate' | 'purple';
  label: string;
  text: string;
}) {
  const styles = {
    red:    'bg-red-50    border-red-200    text-red-700',
    orange: 'bg-orange-50 border-orange-200 text-orange-700',
    slate:  'bg-slate-50  border-slate-200  text-slate-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
  };
  return (
    <div className={`text-sm rounded-lg px-4 py-2.5 border ${styles[color]}`}>
      <span className="font-semibold">{label}:</span>{' '}
      {text}
    </div>
  );
}
