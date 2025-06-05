'use client';

import React from 'react';
import { GeneralExpense } from '@/lib/db';
import { formatDateToDDMMYYYY } from '@/lib/dateUtils';

interface GeneralExpenseListProps {
  expenses: GeneralExpense[];
  onEdit: (expense: GeneralExpense) => void;
  onDelete: (id: string) => Promise<void>;
  isDeleting: string | null;
}

export default function GeneralExpenseList({
  expenses,
  onEdit,
  onDelete,
  isDeleting,
}: GeneralExpenseListProps) {
  const activeExpenses = expenses.filter(exp => exp.is_deleted !== 1);

  if (activeExpenses.length === 0) {
    return <p className="text-center text-gray-500 mt-8">No general expenses recorded yet.</p>;
  }

  return (
    <div className="overflow-x-auto shadow-md rounded-lg">
      <table className="min-w-full bg-white">
        <thead className="bg-blue-600 text-white">{/* Changed to blue theme for expenses */}<tr>
            <th className="text-left py-3 px-5 uppercase font-semibold text-sm">Bill Date</th>
            <th className="text-left py-3 px-5 uppercase font-semibold text-sm">Service Type</th>
            <th className="text-left py-3 px-5 uppercase font-semibold text-sm">Category</th>
            <th className="text-left py-3 px-5 uppercase font-semibold text-sm">Provider</th>
            <th className="text-right py-3 px-5 uppercase font-semibold text-sm">Amount</th>
            <th className="text-left py-3 px-5 uppercase font-semibold text-sm">Due Date</th>
            <th className="text-left py-3 px-5 uppercase font-semibold text-sm">Status</th>
            <th className="text-center py-3 px-5 uppercase font-semibold text-sm">Actions</th>
          </tr>
        </thead>
        <tbody className="text-gray-700">
          {activeExpenses.map((expense) => (
            <tr key={expense.id} className="border-b border-gray-200 hover:bg-blue-50 transition-colors duration-150">
              <td className="py-3 px-5">{formatDateToDDMMYYYY(expense.bill_date)}</td>
              <td className="py-3 px-5">{expense.service_type.replace(/_/g, ' ')}</td>
              <td className="py-3 px-5">{expense.category || 'N/A'}</td>
              <td className="py-3 px-5">{expense.provider || 'N/A'}</td>
              <td className="py-3 px-5 text-right">€{expense.amount.toFixed(2)}</td>
              <td className="py-3 px-5">{formatDateToDDMMYYYY(expense.due_date)}</td>
              <td className="py-3 px-5">
                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                  expense.payment_status === 'PAID' ? 'bg-green-100 text-green-800' :
                  expense.payment_status === 'PARTIALLY_PAID' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {expense.payment_status.replace(/_/g, ' ')}
                </span>
              </td>
              <td className="py-3 px-5 text-center">
                <button
                  onClick={() => onEdit(expense)}
                  className="text-blue-600 hover:text-blue-800 font-medium mr-3 transition-colors duration-150"
                  disabled={isDeleting === expense.id}
                >
                  Edit
                </button>
                <button
                  onClick={() => onDelete(expense.id)}
                  className="text-red-600 hover:text-red-800 font-medium transition-colors duration-150 disabled:opacity-50"
                  disabled={isDeleting === expense.id}
                >
                  {isDeleting === expense.id ? 'Deleting...' : 'Delete'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}