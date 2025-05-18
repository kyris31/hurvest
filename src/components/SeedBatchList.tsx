'use client';

import React from 'react';
import { SeedBatch, Crop } from '@/lib/db';
import { QRCodeCanvas } from 'qrcode.react';

interface SeedBatchListProps {
  seedBatches: (SeedBatch & { cropName?: string })[];
  crops: Crop[];
  onEdit: (seedBatch: SeedBatch) => void;
  onDelete: (id: string) => Promise<void>;
  isDeleting: string | null;
}

export default function SeedBatchList({ seedBatches, crops, onEdit, onDelete, isDeleting }: SeedBatchListProps) {
  
  const getCropDetails = (cropId: string): { name: string; variety?: string } => {
    const crop = crops.find(c => c.id === cropId && c.is_deleted !== 1);
    return crop ? { name: crop.name, variety: crop.variety } : { name: 'Unknown Crop' };
  };

  const activeSeedBatches = seedBatches.filter(batch => batch.is_deleted !== 1);

  if (activeSeedBatches.length === 0) {
    return (
      <p className="text-center text-gray-500 mt-8">
        No active seed batches found. Add your first seed batch to get started!
      </p>
    );
  }

  return (
    <div className="overflow-x-auto shadow-md rounded-lg">
      <table className="min-w-full bg-white">
        <thead className="bg-green-600 text-white">
          <tr>
            <th className="text-left py-3 px-5 uppercase font-semibold text-sm">Batch Code</th>
            <th className="text-left py-3 px-5 uppercase font-semibold text-sm">Crop (Variety)</th>
            <th className="text-left py-3 px-5 uppercase font-semibold text-sm">Supplier</th>
            <th className="text-left py-3 px-5 uppercase font-semibold text-sm">Purchase Date</th>
            <th className="text-right py-3 px-5 uppercase font-semibold text-sm">Initial Qty</th>
            <th className="text-right py-3 px-5 uppercase font-semibold text-sm">Current Qty</th>
            <th className="text-left py-3 px-5 uppercase font-semibold text-sm">Unit</th>
            <th className="text-center py-3 px-5 uppercase font-semibold text-sm">QR Code</th>
            <th className="text-center py-3 px-5 uppercase font-semibold text-sm">Synced</th>
            <th className="text-center py-3 px-5 uppercase font-semibold text-sm">Actions</th>
          </tr>
        </thead>
        <tbody className="text-gray-700">
          {activeSeedBatches.map((batch) => {
            const cropDetails = getCropDetails(batch.crop_id);
            return (
              <tr key={batch.id} className="border-b border-gray-200 hover:bg-green-50 transition-colors duration-150">
                <td className="py-3 px-5">{batch.batch_code}</td>
                <td className="py-3 px-5">
                  {cropDetails.name}
                  {cropDetails.variety && <span className="text-xs text-gray-500 ml-1">({cropDetails.variety})</span>}
                </td>
                <td className="py-3 px-5">{batch.supplier || <span className="text-gray-400">N/A</span>}</td>
                <td className="py-3 px-5">{batch.purchase_date ? new Date(batch.purchase_date).toLocaleDateString() : <span className="text-gray-400">N/A</span>}</td>
                <td className="py-3 px-5 text-right">{batch.initial_quantity ?? <span className="text-gray-400">N/A</span>}</td>
                <td className="py-3 px-5 text-right">{batch.current_quantity ?? <span className="text-gray-400">N/A</span>}</td>
                <td className="py-3 px-5">{batch.quantity_unit || <span className="text-gray-400">N/A</span>}</td>
                <td className="py-3 px-5 text-center">
                  {batch.qr_code_data ? (
                    <QRCodeCanvas value={batch.qr_code_data} size={40} level="M" includeMargin={false} />
                  ) : (
                    <span className="text-gray-400 text-xs">N/A</span>
                  )}
                </td>
                <td className="py-3 px-5 text-center">
                  {batch._synced === 0 ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      Pending
                    </span>
                  ) : batch._synced === 1 ? (
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
                    onClick={() => onEdit(batch)}
                    className="text-blue-600 hover:text-blue-800 font-medium mr-3 transition-colors duration-150"
                    disabled={isDeleting === batch.id}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onDelete(batch.id)}
                    className="text-red-600 hover:text-red-800 font-medium transition-colors duration-150 disabled:opacity-50"
                    disabled={isDeleting === batch.id}
                  >
                    {isDeleting === batch.id ? 'Deleting...' : 'Delete'}
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