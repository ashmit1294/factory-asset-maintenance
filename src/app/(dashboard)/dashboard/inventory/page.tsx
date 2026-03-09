'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { apiClient } from '@/lib/apiClient';

interface InventoryItem {
  _id: string;
  itemName: string;
  quantity: number;
  unit: string;
  reorderLevel: number;
  updatedAt: string;
}

export default function InventoryPage() {
  const { canManage } = useAuth();

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const fetchInventory = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());

      const res = await apiClient.get<InventoryItem[]>(`/api/inventory?${params}`);
      setItems(res.data ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load inventory');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const t = setTimeout(() => fetchInventory(), 300);
    return () => clearTimeout(t);
  }, [fetchInventory]);

  const lowStockCount = items.filter((i) => i.quantity <= i.reorderLevel).length;

  return (
    <div className="p-6 space-y-5 max-w-6xl mx-auto">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Inventory</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage spare parts and materials
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200
                           px-2.5 py-1 rounded-full font-medium">
            {items.length} Items
          </span>
          {lowStockCount > 0 && (
            <span className="text-xs bg-red-50 text-red-700 border border-red-200
                             px-2.5 py-1 rounded-full font-medium">
              {lowStockCount} Low Stock
            </span>
          )}
        </div>
      </div>

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex-1 relative max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search items..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg
                       focus:outline-none focus:ring-2 focus:ring-blue-500
                       focus:border-transparent"
          />
        </div>
      </div>

      {/* ── Inventory table ──────────────────────────────────────────────── */}
      {error ? (
        <div className="text-center py-10 text-sm text-red-600">{error}</div>
      ) : loading ? (
        <div className="bg-white rounded-xl border border-gray-200 space-y-3 p-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <svg className="h-12 w-12 text-gray-200 mx-auto mb-3" fill="none"
            stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <p className="text-sm text-gray-400">No inventory items found</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-5 py-3 text-left font-semibold text-gray-700">Item Name</th>
                  <th className="px-5 py-3 text-left font-semibold text-gray-700">Quantity</th>
                  <th className="px-5 py-3 text-left font-semibold text-gray-700">Unit</th>
                  <th className="px-5 py-3 text-left font-semibold text-gray-700">Reorder Level</th>
                  <th className="px-5 py-3 text-left font-semibold text-gray-700">Status</th>
                  <th className="px-5 py-3 text-left font-semibold text-gray-700">Last Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item) => {
                  const isLowStock = item.quantity <= item.reorderLevel;
                  return (
                    <tr key={item._id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3 font-medium text-gray-900">
                        {item.itemName}
                      </td>
                      <td className="px-5 py-3 text-gray-600">
                        {item.quantity}
                      </td>
                      <td className="px-5 py-3 text-gray-600">
                        <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                          {item.unit}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-gray-600">
                        {item.reorderLevel}
                      </td>
                      <td className="px-5 py-3">
                        {isLowStock ? (
                          <span className="text-xs bg-red-50 text-red-700 px-2.5 py-1 rounded-full font-medium">
                            ⚠️ Low Stock
                          </span>
                        ) : (
                          <span className="text-xs bg-green-50 text-green-700 px-2.5 py-1 rounded-full font-medium">
                            ✓ In Stock
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-xs text-gray-400">
                        {new Date(item.updatedAt).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
