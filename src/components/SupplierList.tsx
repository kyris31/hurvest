'use client';

import React from 'react';
import { Supplier } from '@/lib/db'; // Assuming Supplier interface is in db.ts

interface SupplierListProps {
  suppliers: Supplier[];
  onEdit: (supplier: Supplier) => void;
  onDelete: (id: string) => Promise<void>;
  isDeleting: string | null; // ID of the supplier currently being deleted
}

export default function SupplierList({ suppliers, onEdit, onDelete, isDeleting }: SupplierListProps) {
  const activeSuppliers = suppliers.filter(supplier => supplier.is_deleted !== 1);

  if (activeSuppliers.length === 0) {
    return <p className="text-center text-gray-500 mt-8">No suppliers recorded yet. Add your first supplier!</p>;
  }

  return (
    <div className="overflow-x-auto shadow-md rounded-lg">
      <table className="min-w-full bg-white">
        <thead className="bg-green-600 text-white">
          <tr>
            <th className="text-left py-3 px-5 uppercase font-semibold text-sm">Name</th>
            <th className="text-left py-3 px-5 uppercase font-semibold text-sm">Contact Person</th>
            <th className="text-left py-3 px-5 uppercase font-semibold text-sm">Email</th>
            <th className="text-left py-3 px-5 uppercase font-semibold text-sm">Phone</th>
            <th className="text-left py-3 px-5 uppercase font-semibold text-sm">Address</th>
            <th className="text-center py-3 px-5 uppercase font-semibold text-sm">Synced</th>
            <th className="text-center py-3 px-5 uppercase font-semibold text-sm">Actions</th>
          </tr>
        </thead>
        <tbody className="text-gray-700">
          {activeSuppliers.map((supplier) => (
            <tr key={supplier.id} className="border-b border-gray-200 hover:bg-green-50 transition-colors duration-150">
              <td className="py-3 px-5">{supplier.name}</td>
              <td className="py-3 px-5">{supplier.contact_person || 'N/A'}</td>
              <td className="py-3 px-5">{supplier.email || 'N/A'}</td>
              <td className="py-3 px-5">{supplier.phone || 'N/A'}</td>
              <td className="py-3 px-5 whitespace-pre-wrap">{supplier.address || 'N/A'}</td>
              <td className="py-3 px-5 text-center">
                {supplier._synced === 0 ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                    Pending
                  </span>
                ) : supplier._synced === 1 ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Synced
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                    Unknown
                  </span>
                )}
              </td>
              <td className="py-3 px-5 text-center space-x-2">
                <button
                  onClick={() => onEdit(supplier)}
                  className="text-blue-600 hover:text-blue-800 font-medium transition-colors duration-150"
                  disabled={isDeleting === supplier.id}
                >
                  Edit
                </button>
                <button
                  onClick={() => onDelete(supplier.id)}
                  className="text-red-600 hover:text-red-800 font-medium transition-colors duration-150 disabled:opacity-50"
                  disabled={isDeleting === supplier.id}
                >
                  {isDeleting === supplier.id ? 'Deleting...' : 'Delete'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}