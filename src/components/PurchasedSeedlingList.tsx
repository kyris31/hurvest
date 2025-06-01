'use client';

import React from 'react';
import { PurchasedSeedling, Crop, Supplier } from '@/lib/db';
import { formatDateToDDMMYYYY } from '@/lib/dateUtils';

interface PurchasedSeedlingListProps {
  purchasedSeedlings: PurchasedSeedling[];
  crops: Crop[];
  suppliers: Supplier[];
  onEdit: (seedling: PurchasedSeedling) => void;
  onDelete: (id: string) => Promise<void>;
  isDeleting: string | null; 
}

export default function PurchasedSeedlingList({ 
  purchasedSeedlings, 
  crops,
  suppliers,
  onEdit, 
  onDelete, 
  isDeleting 
}: PurchasedSeedlingListProps) {

  const getCropDisplay = (cropId?: string) => {
    if (!cropId) return <span className="text-gray-400">N/A</span>;
    const crop = crops.find(c => c.id === cropId && c.is_deleted !== 1);
    if (!crop) return <span className="text-red-500">Unknown Crop</span>;
    return `${crop.name}${crop.variety ? ` - ${crop.variety}` : ''}`;
  };

  const getSupplierName = (supplierId?: string) => {
    if (!supplierId) return <span className="text-gray-400">N/A</span>;
    const supplier = suppliers.find(s => s.id === supplierId && s.is_deleted !== 1);
    return supplier ? supplier.name : <span className="text-red-500">Unknown Supplier</span>;
  };

  const activeSeedlings = purchasedSeedlings.filter(s => s.is_deleted !== 1);

  if (activeSeedlings.length === 0) {
    // This case is handled by the page component's "No purchased seedlings" message.
    // Returning null here to avoid double messaging if that's preferred.
    // Or, could return a specific message for the list component itself.
    return null; 
  }

  return (
    <div className="overflow-x-auto shadow-md rounded-lg">
      <table className="min-w-full bg-white">
        <thead className="bg-green-600 text-white">
          <tr>
            <th className="text-left py-3 px-4 uppercase font-semibold text-sm">Name/Desc.</th>
            <th className="text-left py-3 px-4 uppercase font-semibold text-sm">Crop (Variety)</th>
            <th className="text-left py-3 px-4 uppercase font-semibold text-sm">Supplier</th>
            <th className="text-left py-3 px-4 uppercase font-semibold text-sm">Purchase Date</th>
            <th className="text-right py-3 px-4 uppercase font-semibold text-sm">Initial Qty</th>
            <th className="text-right py-3 px-4 uppercase font-semibold text-sm">Current Qty</th>
            <th className="text-left py-3 px-4 uppercase font-semibold text-sm">Unit</th>
            <th className="text-right py-3 px-4 uppercase font-semibold text-sm">Cost/Unit</th>
            <th className="text-center py-3 px-4 uppercase font-semibold text-sm">Synced</th>
            <th className="text-center py-3 px-4 uppercase font-semibold text-sm">Actions</th>
          </tr>
        </thead>
        <tbody className="text-gray-700">
          {activeSeedlings.map((seedling) => (
            <tr key={seedling.id} className="border-b border-gray-200 hover:bg-green-50 transition-colors duration-150">
              <td className="py-3 px-4">{seedling.name}</td>
              <td className="py-3 px-4">{getCropDisplay(seedling.crop_id)}</td>
              <td className="py-3 px-4">{getSupplierName(seedling.supplier_id)}</td>
              <td className="py-3 px-4">{seedling.purchase_date ? formatDateToDDMMYYYY(seedling.purchase_date) : <span className="text-gray-400">N/A</span>}</td>
              <td className="py-3 px-4 text-right">{seedling.initial_quantity}</td>
              <td className="py-3 px-4 text-right">{seedling.current_quantity}</td>
              <td className="py-3 px-4">{seedling.quantity_unit || <span className="text-gray-400">N/A</span>}</td>
              <td className="py-3 px-4 text-right">{seedling.cost_per_unit !== undefined ? `€${seedling.cost_per_unit.toFixed(2)}` : <span className="text-gray-400">N/A</span>}</td>
              <td className="py-3 px-4 text-center">
                {seedling._synced === 0 ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">Pending</span>
                ) : seedling._synced === 1 ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Synced</span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">Unknown</span>
                )}
              </td>
              <td className="py-3 px-4 text-center whitespace-nowrap">
                <button
                  onClick={() => onEdit(seedling)}
                  className="text-blue-600 hover:text-blue-800 font-medium mr-2 transition-colors duration-150"
                  disabled={isDeleting === seedling.id}
                >
                  Edit
                </button>
                <button
                  onClick={() => onDelete(seedling.id)}
                  className="text-red-600 hover:text-red-800 font-medium transition-colors duration-150 disabled:opacity-50"
                  disabled={isDeleting === seedling.id}
                >
                  {isDeleting === seedling.id ? 'Deleting...' : 'Delete'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}