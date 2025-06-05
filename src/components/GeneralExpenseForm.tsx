'use client';

import React, { useState, useEffect } from 'react';
import { GeneralExpense } from '@/lib/db'; // Assuming GeneralExpense is exported from db.ts
import { formatDateToYYYYMMDD } from '@/lib/dateUtils'; // Assuming this utility exists

interface GeneralExpenseFormProps {
  initialData?: GeneralExpense | null;
  onSubmit: (data: Omit<GeneralExpense, 'id' | '_synced' | '_last_modified' | 'created_at' | 'updated_at' | 'is_deleted' | 'deleted_at'> | GeneralExpense) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
}

const SERVICE_TYPES = ['WATER', 'ELECTRICITY', 'TELEPHONE', 'FIELD_TAXES', 'INTERNET', 'VEHICLE_MAINTENANCE', 'OTHER'] as const;
const PAYMENT_STATUSES = ['UNPAID', 'PAID', 'PARTIALLY_PAID'] as const;

export default function GeneralExpenseForm({
  initialData,
  onSubmit,
  onCancel,
  isSubmitting,
}: GeneralExpenseFormProps) {
  type ServiceType = typeof SERVICE_TYPES[number];
  type PaymentStatusType = typeof PAYMENT_STATUSES[number];

  interface FormDataState {
    service_type: ServiceType;
    category: string;
    provider: string;
    bill_date: string;
    due_date: string;
    amount: number | ''; // Allow empty string for input clearing
    payment_status: PaymentStatusType;
    payment_date: string;
    payment_amount: number | ''; // Allow empty string for input clearing
    reference_number: string;
    notes: string;
  }

  const [formData, setFormData] = useState<FormDataState>({
    service_type: SERVICE_TYPES[0],
    category: '',
    provider: '',
    bill_date: formatDateToYYYYMMDD(new Date().toISOString()),
    due_date: formatDateToYYYYMMDD(new Date().toISOString()),
    amount: 0,
    payment_status: PAYMENT_STATUSES[0],
    payment_date: '',
    payment_amount: '',
    reference_number: '',
    notes: '',
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        service_type: initialData.service_type, // This should now be fine due to FormDataState typing
        category: initialData.category || '',
        provider: initialData.provider || '',
        bill_date: initialData.bill_date ? formatDateToYYYYMMDD(initialData.bill_date) : '',
        due_date: initialData.due_date ? formatDateToYYYYMMDD(initialData.due_date) : '',
        amount: initialData.amount || 0,
        payment_status: initialData.payment_status || PAYMENT_STATUSES[0], // This should now be fine
        payment_date: initialData.payment_date ? formatDateToYYYYMMDD(initialData.payment_date) : '',
        payment_amount: initialData.payment_amount !== undefined && initialData.payment_amount !== null ? initialData.payment_amount : '',
        reference_number: initialData.reference_number || '',
        notes: initialData.notes || '',
      });
    }
  }, [initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const numValue = parseFloat(value);
    setFormData(prev => ({ ...prev, [name]: isNaN(numValue) ? '' : numValue }));
  };
  
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const dataToSubmit: any = {
      ...formData,
      amount: parseFloat(formData.amount.toString()), // Ensure amount is a number
      payment_amount: formData.payment_amount ? parseFloat(formData.payment_amount.toString()) : undefined,
    };
    if (initialData?.id) {
      dataToSubmit.id = initialData.id;
    }
    onSubmit(dataToSubmit);
  };

  const isPaidOrPartiallyPaid = formData.payment_status === 'PAID' || formData.payment_status === 'PARTIALLY_PAID';

  return (
    <form onSubmit={handleSubmit} className="space-y-6 p-6 bg-white shadow-lg rounded-lg mb-8 max-w-2xl mx-auto">
      <h2 className="text-2xl font-semibold text-gray-700">{initialData ? 'Edit' : 'Add New'} General Expense</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="service_type" className="block text-sm font-medium text-gray-700">Service Type</label>
          <select
            id="service_type"
            name="service_type"
            value={formData.service_type}
            onChange={handleChange}
            required
            className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
          >
            {SERVICE_TYPES.map(type => (
              <option key={type} value={type}>{type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="category" className="block text-sm font-medium text-gray-700">Category</label>
          <input
            type="text"
            id="category"
            name="category"
            value={formData.category}
            onChange={handleChange}
            className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
            placeholder="e.g., Utilities, Farm Operations"
          />
        </div>
      </div>

      <div>
        <label htmlFor="provider" className="block text-sm font-medium text-gray-700">Provider/Vendor</label>
        <input
          type="text"
          id="provider"
          name="provider"
          value={formData.provider}
          onChange={handleChange}
          className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="bill_date" className="block text-sm font-medium text-gray-700">Bill Date</label>
          <input
            type="date"
            id="bill_date"
            name="bill_date"
            value={formData.bill_date}
            onChange={handleChange}
            required
            className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
          />
        </div>
        <div>
          <label htmlFor="due_date" className="block text-sm font-medium text-gray-700">Due Date</label>
          <input
            type="date"
            id="due_date"
            name="due_date"
            value={formData.due_date}
            onChange={handleChange}
            required
            className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
          />
        </div>
      </div>

      <div>
        <label htmlFor="amount" className="block text-sm font-medium text-gray-700">Amount (€)</label>
        <input
          type="number"
          id="amount"
          name="amount"
          value={formData.amount}
          onChange={handleAmountChange}
          required
          min="0"
          step="0.01"
          className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
        />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="payment_status" className="block text-sm font-medium text-gray-700">Payment Status</label>
          <select
            id="payment_status"
            name="payment_status"
            value={formData.payment_status}
            onChange={handleChange}
            required
            className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
          >
            {PAYMENT_STATUSES.map(status => (
              <option key={status} value={status}>{status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>
            ))}
          </select>
        </div>
      </div>

      {isPaidOrPartiallyPaid && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 border border-gray-200 rounded-md">
          <div>
            <label htmlFor="payment_date" className="block text-sm font-medium text-gray-700">Payment Date</label>
            <input
              type="date"
              id="payment_date"
              name="payment_date"
              value={formData.payment_date}
              onChange={handleChange}
              className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
            />
          </div>
          <div>
            <label htmlFor="payment_amount" className="block text-sm font-medium text-gray-700">Payment Amount (€)</label>
            <input
              type="number"
              id="payment_amount"
              name="payment_amount"
              value={formData.payment_amount}
              onChange={handleAmountChange}
              min="0"
              step="0.01"
              className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
            />
          </div>
        </div>
      )}

      <div>
        <label htmlFor="reference_number" className="block text-sm font-medium text-gray-700">Reference Number</label>
        <input
          type="text"
          id="reference_number"
          name="reference_number"
          value={formData.reference_number}
          onChange={handleChange}
          className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
        />
      </div>

      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-gray-700">Notes</label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          value={formData.notes}
          onChange={handleChange}
          className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
        ></textarea>
      </div>

      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
        >
          {isSubmitting ? (initialData ? 'Saving...' : 'Adding...') : (initialData ? 'Save Changes' : 'Add Expense')}
        </button>
      </div>
    </form>
  );
}