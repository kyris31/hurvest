'use client';

import React, { useState, useEffect } from 'react';
import type { Sale } from '@/lib/db';

interface RecordPaymentModalProps {
  sale: Sale;
  isOpen: boolean;
  onClose: () => void;
  onRecordPayment: (
    saleId: string,
    paymentDetails: { date: string; amount: number; method: Sale['payment_method']; notes?: string }
  ) => Promise<void>;
  isSubmitting: boolean;
}

export default function RecordPaymentModal({ sale, isOpen, onClose, onRecordPayment, isSubmitting }: RecordPaymentModalProps) {
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [amountBeingPaid, setAmountBeingPaid] = useState<number | ''>('');
  const [paymentMethod, setPaymentMethod] = useState<Sale['payment_method']>(sale.payment_method || 'cash');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setPaymentDate(new Date().toISOString().split('T')[0]);
      const remainingBalance = (sale.total_amount || 0) - (sale.amount_paid || 0);
      setAmountBeingPaid(remainingBalance > 0 ? parseFloat(remainingBalance.toFixed(2)) : '');
      setPaymentMethod(sale.payment_method || 'cash');
      setPaymentNotes('');
      setError(null);
    }
  }, [isOpen, sale]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (amountBeingPaid === '' || isNaN(Number(amountBeingPaid)) || Number(amountBeingPaid) <= 0) {
      setError('Please enter a valid positive amount to pay.');
      return;
    }
    if (!paymentMethod) {
      setError('Please select a payment method.');
      return;
    }

    await onRecordPayment(sale.id, {
      date: paymentDate,
      amount: Number(amountBeingPaid),
      method: paymentMethod,
      notes: paymentNotes.trim() || undefined,
    });
    // onClose will typically be called by the parent after successful submission
  };

  const remainingBalance = (sale.total_amount || 0) - (sale.amount_paid || 0);

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-75 overflow-y-auto h-full w-full z-50 flex justify-center items-center p-4">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
        <h2 className="text-xl font-bold mb-4 text-gray-800">Record Payment for Sale #{sale.id.substring(0, 8)}...</h2>
        
        <div className="mb-3 text-sm">
          <p>Sale Date: <span className="font-medium">{new Date(sale.sale_date).toLocaleDateString()}</span></p>
          <p>Total Amount: <span className="font-medium">€{(sale.total_amount || 0).toFixed(2)}</span></p>
          <p>Currently Paid: <span className="font-medium">€{(sale.amount_paid || 0).toFixed(2)}</span></p>
          <p>Remaining Balance: <span className={`font-bold ${remainingBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
            €{remainingBalance.toFixed(2)}
          </span></p>
        </div>

        {error && <p className="text-red-500 text-sm mb-3 p-2 bg-red-50 rounded">{error}</p>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="paymentDate" className="block text-sm font-medium text-gray-700">Payment Date</label>
            <input
              type="date"
              id="paymentDate"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
              required
              disabled={isSubmitting}
            />
          </div>
          <div>
            <label htmlFor="amountBeingPaid" className="block text-sm font-medium text-gray-700">Amount Being Paid (€)</label>
            <input
              type="number"
              step="0.01"
              id="amountBeingPaid"
              value={amountBeingPaid}
              onChange={(e) => setAmountBeingPaid(e.target.value === '' ? '' : parseFloat(e.target.value))}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
              required
              placeholder="0.00"
              disabled={isSubmitting}
            />
          </div>
          <div>
            <label htmlFor="paymentMethodModal" className="block text-sm font-medium text-gray-700">Payment Method</label>
            <select
              id="paymentMethodModal"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as Sale['payment_method'])}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
              disabled={isSubmitting}
            >
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="on_account">On Account (No new payment)</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label htmlFor="paymentNotesModal" className="block text-sm font-medium text-gray-700">Payment Notes (Optional)</label>
            <textarea
              id="paymentNotesModal"
              rows={2}
              value={paymentNotes}
              onChange={(e) => setPaymentNotes(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
              disabled={isSubmitting}
            />
          </div>
          <div className="flex justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md border border-gray-300 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-400 rounded-md shadow-sm"
            >
              {isSubmitting ? 'Recording...' : 'Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}