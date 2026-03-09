import React from 'react';

type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

const PRIORITY_CONFIG: Record<
  Priority,
  { label: string; className: string; icon: string }
> = {
  LOW:      { label: 'Low',      icon: '▼', className: 'bg-gray-100   text-gray-500'   },
  MEDIUM:   { label: 'Medium',   icon: '●', className: 'bg-blue-50    text-blue-600'   },
  HIGH:     { label: 'High',     icon: '▲', className: 'bg-orange-50  text-orange-600' },
  CRITICAL: { label: 'Critical', icon: '⚡', className: 'bg-red-50     text-red-600'    },
};

interface Props {
  priority: string;
  size?: 'sm' | 'md';
}

export default function PriorityBadge({ priority, size = 'md' }: Props) {
  const cfg = PRIORITY_CONFIG[priority as Priority] ?? {
    label: priority,
    icon: '●',
    className: 'bg-gray-100 text-gray-500',
  };

  const textSize = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-xs px-2.5 py-1';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium
                  ${textSize} ${cfg.className}`}
    >
      <span className="text-xs leading-none">{cfg.icon}</span>
      {cfg.label}
    </span>
  );
}