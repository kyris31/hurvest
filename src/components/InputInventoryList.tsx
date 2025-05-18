'use client';

import React from 'react';
import { InputInventory } from '@/lib/db';
import { QRCodeCanvas } from 'qrcode.react';

interface InputInventoryListProps {
  inventoryItems: InputInventory[];
  onEdit: (item: InputInventory) => void;
  onDelete: (id: string) => Promise<void>;
  isDeleting: string | null; // ID of item being deleted, or null
}

export default function InputInventoryList({ inventoryItems, onEdit, onDelete, isDeleting }: InputInventoryListProps) {
  const activeItems = inventoryItems.filter(item => item.is_deleted !== 1);

  if (activeItems.length === 0) {
    return <p className="text-center text-gray-500 mt-8">No active inventory items found. Add your first item to get started!</p>;
  }

  return (
    <div className="overflow-x-auto shadow-md rounded-lg">
      <table className="min-w-full bg-white">
        <thead className="bg-green-600 text-white">
          <tr>
            <th className="text-left py-3 px-5 uppercase font-semibold text-sm">Name</th>
            <th className="text-left py-3 px-5 uppercase font-semibold text-sm">Type</th>
            <th className="text-left py-3 px-5 uppercase font-semibold text-sm">Supplier</th>
            <th className="text-right py-3 px-5 uppercase font-semibold text-sm">Current Qty</th>
            <th className="text-left py-3 px-5 uppercase font-semibold text-sm">Unit</th>
            <th className="text-right py-3 px-5 uppercase font-semibold text-sm">Total Cost (€)</th>
            <th className="text-right py-3 px-5 uppercase font-semibold text-sm">Cost/Unit (€)</th>
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
            return (
              <tr key={item.id} className="border-b border-gray-200 hover:bg-green-50 transition-colors duration-150">
                <td className="py-3 px-5">{item.name}</td>
                <td className="py-3 px-5">{item.type || <span className="text-gray-400">N/A</span>}</td>
                <td className="py-3 px-5">{item.supplier || <span className="text-gray-400">N/A</span>}</td>
                <td className="py-3 px-5 text-right">{item.current_quantity ?? <span className="text-gray-400">N/A</span>}</td>
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