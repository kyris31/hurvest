'use client';

import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, GeneralExpense } from '@/lib/db';
import { requestPushChanges } from '@/lib/sync';
import GeneralExpenseList from '@/components/GeneralExpenseList';
import GeneralExpenseForm from '@/components/GeneralExpenseForm';
import { exportGeneralExpensesToCSV, exportGeneralExpensesToPDF } from '@/lib/reportUtils';

export default function GeneralExpensesPage() {
  const [showForm, setShowForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState<GeneralExpense | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generalExpenses = useLiveQuery(
    async () => {
      try {
        // Sort by bill_date descending, then by created_at descending as a tie-breaker
        const expenses = await db.general_expenses
          .orderBy('bill_date')
          .reverse()
          .filter(exp => exp.is_deleted !== 1)
          .toArray();
        // Secondary sort if bill_dates are the same
        return expenses.sort((a, b) => {
          if (a.bill_date < b.bill_date) return 1;
          if (a.bill_date > b.bill_date) return -1;
          // If bill_dates are equal, sort by creation time (most recent first)
          const timeA = a._last_modified || new Date(a.created_at || 0).getTime();
          const timeB = b._last_modified || new Date(b.created_at || 0).getTime();
          return timeB - timeA;
        });
      } catch (err) {
        console.error("Failed to fetch general expenses:", err);
        setError("Failed to load expenses. Please try again.");
        return [];
      }
    },
    [] 
  );

  const isLoading = generalExpenses === undefined;

  const handleFormSubmit = async (data: Omit<GeneralExpense, 'id' | '_synced' | '_last_modified' | 'created_at' | 'updated_at' | 'is_deleted' | 'deleted_at'> | GeneralExpense) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const now = new Date().toISOString();
      const currentTimestamp = Date.now();

      if ('id' in data && data.id) { // Editing existing
        const updatedExpense: Partial<GeneralExpense> = {
          ...data,
          updated_at: now,
          _synced: 0,
          _last_modified: currentTimestamp,
        };
        await db.general_expenses.update(data.id, updatedExpense);
      } else { // Adding new
        const expenseDataFromForm = data as Omit<GeneralExpense, 'id' | '_synced' | '_last_modified' | 'created_at' | 'updated_at' | 'is_deleted' | 'deleted_at'>;
        const newExpenseData: Omit<GeneralExpense, 'id'> = {
          ...expenseDataFromForm,
          created_at: now,
          updated_at: now,
          _synced: 0,
          _last_modified: currentTimestamp,
          is_deleted: 0,
          deleted_at: undefined,
        };
        const id = crypto.randomUUID();
        await db.general_expenses.add({ ...newExpenseData, id });
      }
      setShowForm(false);
      setEditingExpense(null);
      await requestPushChanges();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to save expense.";
      console.error("Failed to save expense:", err);
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (expense: GeneralExpense) => {
    setEditingExpense(expense);
    setShowForm(true);
    setError(null);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this expense record?")) {
      setIsDeleting(id);
      setError(null);
      try {
        await db.markForSync('general_expenses', id, {}, true);
        await requestPushChanges();
      } catch (err) {
        console.error("Failed to delete expense:", err);
        setError("Failed to delete expense.");
      } finally {
        setIsDeleting(null);
      }
    }
  };
  
  const handleExportCSV = async () => {
    // For now, pass empty filters. UI for filters will be added later.
    await exportGeneralExpensesToCSV({});
  };

  const handleExportPDF = async () => {
    // For now, pass empty filters. UI for filters will be added later.
    await exportGeneralExpensesToPDF({});
  };


  return (
    <div>
      <header className="bg-white shadow mb-6">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-wrap justify-between items-center gap-4">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">General Expenses</h1>
            <div className="flex space-x-3">
              <button
                onClick={handleExportCSV}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded shadow-sm transition-colors duration-150 text-sm"
              >
                Export CSV
              </button>
              <button
                onClick={handleExportPDF}
                className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded shadow-sm transition-colors duration-150 text-sm"
              >
                Export PDF
              </button>
              <button
                onClick={() => { setEditingExpense(null); setShowForm(true); setError(null); }}
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded shadow-sm transition-colors duration-150 text-sm"
              >
                Add New Expense
              </button>
            </div>
          </div>
        </div>
      </header>

      {showForm && (
        <GeneralExpenseForm
          initialData={editingExpense}
          onSubmit={handleFormSubmit}
          onCancel={() => { setShowForm(false); setEditingExpense(null); setError(null);}}
          isSubmitting={isSubmitting}
        />
      )}

      <div className="mt-4">
        {error && <p className="text-red-500 mb-4 p-3 bg-red-100 rounded-md">{error}</p>}
        {isLoading && <p className="text-center text-gray-500">Loading expenses...</p>}
        {!isLoading && !error && generalExpenses && (
          <GeneralExpenseList
            expenses={generalExpenses}
            onEdit={handleEdit}
            onDelete={handleDelete}
            isDeleting={isDeleting}
          />
        )}
         {!isLoading && generalExpenses && generalExpenses.length === 0 && !error && !showForm && (
           <div className="text-center py-10">
            <svg className="mx-auto h-12 w-12 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /> {/* Simple plus icon */}
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No expenses recorded</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by adding a new general expense.</p>
            <div className="mt-6">
              <button
                type="button"
                onClick={() => { setEditingExpense(null); setShowForm(true); setError(null); }}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                 <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                   <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                 </svg>
                Add New Expense
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}