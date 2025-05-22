'use client';

import React from 'react';
import { InputInventory, Supplier } from '@/lib/db'; // Added Supplier
import { QRCodeCanvas } from 'qrcode.react';

interface InputInventoryListProps {
  inventoryItems: (InputInventory & { supplierName?: string })[]; // Expect enriched items
  suppliers: Supplier[]; // Still needed if we keep local supplierMap, or for other potential uses
  onEdit: (item: InputInventory) => void;
  onDelete: (id: string) => Promise<void>;
  isDeleting: string | null;
  sortConfig: { key: string; direction: 'ascending' | 'descending' } | null;
  requestSort: (key: string) => void;
}

export default function InputInventoryList({
  inventoryItems,
  suppliers,
  onEdit,
  onDelete,
  isDeleting,
  sortConfig,
  requestSort
}: InputInventoryListProps) {
  // Filtering for activeItems is now done in the parent component (InputInventoryPage)
  // const activeItems = inventoryItems.filter(item => item.is_deleted !== 1);
  const activeItems = inventoryItems; // Assuming parent passes already filtered (for is_deleted) items

  // Create a map for quick supplier lookup - this might be redundant if parent passes supplierName
  const supplierMap = React.useMemo(() =>
    new Map(suppliers.map(s => [s.id, s.name])),
    [suppliers]
  );

  if (activeItems.length === 0) {
    return <p className="text-center text-gray-500 mt-8">No active inventory items found. Add your first item to get started!</p>;
  }

  return (
    <div className="overflow-x-auto shadow-md rounded-lg">
      <table className="min-w-full bg-white">
        <thead className="bg-green-600 text-white">
          <tr>
            {/* Helper function for sortable headers */}
            {['name', 'type', 'supplierName', 'current_quantity', 'quantity_unit', 'total_purchase_cost', 'costPerUnit'].map((key) => {
              const label = key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
              const isSortKey = sortConfig?.key === key;
              const directionIcon = isSortKey ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : '';
              const textAlignClass = ['current_quantity', 'total_purchase_cost', 'costPerUnit'].includes(key) ? 'text-right' : 'text-left';
              
              return (
                <th key={key} className={`${textAlignClass} py-3 px-5 uppercase font-semibold text-sm cursor-pointer hover:bg-green-700`} onClick={() => requestSort(key)}>
                  {label} {directionIcon}
                </th>
              );
            })}
            <th className="text-center py-3 px-5 uppercase font-semibold text-sm">QR Code</th>
            <th className="text-center py-3 px-5 uppercase font-semibold text-sm">Synced</th>
            <th className="text-center py-3 px-5 uppercase font-semibold text-sm">Actions</th>
          </tr>
        </thead>
        <tbody className="text-gray-700">
          {activeItems.map((item) => {
            const costPerUnit = (item.total_purchase_cost !== undefined && item.initial_quantity !== undefined && item.initial_quantity > 0)
              ? (item.total_purchase_cost / item.initial_quantity)
              : undefined;
            // supplierName is now expected to be part of the item object from the parent
            const supplierName = item.supplierName || (item.supplier_id ? supplierMap.get(item.supplier_id) : null);
            const needsRestock = typeof item.minimum_stock_level === 'number' &&
                                 typeof item.current_quantity === 'number' &&
                                 item.current_quantity <= item.minimum_stock_level;
            return (
              <tr key={item.id} className={`border-b border-gray-200 hover:bg-green-50 transition-colors duration-150 ${needsRestock ? 'bg-red-50 hover:bg-red-100' : ''}`}>
                <td className="py-3 px-5">{item.name}</td>
                <td className="py-3 px-5">{item.type || <span className="text-gray-400">N/A</span>}</td>
                <td className="py-3 px-5">{supplierName || <span className="text-gray-400">N/A</span>}</td>
                <td className={`py-3 px-5 text-right ${needsRestock ? 'text-red-600 font-bold' : ''}`}>
                  {item.current_quantity ?? <span className="text-gray-400">N/A</span>}
                  {needsRestock && <span className="ml-1 text-xs">(Low!)</span>}
                </td>
                <td className="py-3 px-5">{item.quantity_unit || <span className="text-gray-400">N/A</span>}</td>
                <td className="py-3 px-5 text-right">{item.total_purchase_cost !== undefined ? item.total_purchase_cost.toFixed(2) : <span className="text-gray-400">N/A</span>}</td>
                <td className="py-3 px-5 text-right">{costPerUnit !== undefined ? costPerUnit.toFixed(2) : <span className="text-gray-400">N/A</span>}</td>
                <td className="py-3 px-5 text-center">
                  {item.qr_code_data ? (
                    <QRCodeCanvas value={item.qr_code_data} size={40} level="M" includeMargin={false} />
                  ) : (
                    <span className="text-gray-400 text-xs">N/A</span>
                  )}
                </td>
                <td className="py-3 px-5 text-center">
                  {item._synced === 0 ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                    Pending
                  </span>
                ) : item._synced === 1 ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Synced
                  </span>
                ) : (
                     <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                    Unknown
                  </span>
                )}
              </td>
              <td className="py-3 px-5 text-center">
                <button
                  onClick={() => onEdit(item)}
                  className="text-blue-600 hover:text-blue-800 font-medium mr-3 transition-colors duration-150"
                  disabled={isDeleting === item.id}
                >
                  Edit
                </button>
                <button
                  onClick={() => onDelete(item.id)}
                  className="text-red-600 hover:text-red-800 font-medium transition-colors duration-150 disabled:opacity-50"
                  disabled={isDeleting === item.id}
                >
                  {isDeleting === item.id ? 'Deleting...' : 'Delete'}
                </button>
              </td>
            </tr>
          );
        })}
        </tbody>
      </table>
    </div>
  );
}