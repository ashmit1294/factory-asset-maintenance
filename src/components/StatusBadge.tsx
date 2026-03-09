import React from 'react';

type TaskStatus =
  | 'REPORTED'
  | 'UNDER_REVIEW'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'MATERIAL_REQUESTED'
  | 'PAUSED'
  | 'ESCALATED'
  | 'COMPLETED'
  | 'REOPENED'
  | 'CONFIRMED'
  | 'REJECTED'
  | 'CANCELLED';

const STATUS_CONFIG: Record<
  TaskStatus,
  { label: string; className: string; dot: string }
> = {
  REPORTED:           { label: 'Reported',          dot: 'bg-gray-400',   className: 'bg-gray-100    text-gray-600'   },
  UNDER_REVIEW:       { label: 'Under Review',      dot: 'bg-yellow-400', className: 'bg-yellow-50   text-yellow-700' },
  ASSIGNED:           { label: 'Assigned',          dot: 'bg-blue-400',   className: 'bg-blue-50     text-blue-700'   },
  IN_PROGRESS:        { label: 'In Progress',       dot: 'bg-indigo-400', className: 'bg-indigo-50   text-indigo-700' },
  MATERIAL_REQUESTED: { label: 'Material Requested',dot: 'bg-orange-400', className: 'bg-orange-50   text-orange-700' },
  PAUSED:             { label: 'Paused',            dot: 'bg-slate-400',  className: 'bg-slate-100   text-slate-600'  },
  ESCALATED:          { label: 'Escalated',         dot: 'bg-red-500',    className: 'bg-red-50      text-red-700'    },
  COMPLETED:          { label: 'Completed',         dot: 'bg-teal-400',   className: 'bg-teal-50     text-teal-700'   },
  REOPENED:           { label: 'Reopened',          dot: 'bg-purple-400', className: 'bg-purple-50   text-purple-700' },
  CONFIRMED:          { label: 'Confirmed',         dot: 'bg-green-500',  className: 'bg-green-50    text-green-700'  },
  REJECTED:           { label: 'Rejected',          dot: 'bg-red-400',    className: 'bg-red-50      text-red-600'    },
  CANCELLED:          { label: 'Cancelled',         dot: 'bg-gray-400',   className: 'bg-gray-100    text-gray-500'   },
};

interface Props {
  status: string;
  size?: 'sm' | 'md';
}

export default function StatusBadge({ status, size = 'md' }: Props) {
  const cfg = STATUS_CONFIG[status as TaskStatus] ?? {
    label: status,
    dot: 'bg-gray-400',
    className: 'bg-gray-100 text-gray-600',
  };

  const textSize = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-xs px-2.5 py-1';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium
                  ${textSize} ${cfg.className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}