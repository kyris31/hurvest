'use client';

import React from 'react';
import { Customer, Sale, SaleItem } from '@/lib/db';

interface CustomerListProps {
  customers: Customer[];
  sales: Sale[]; // Pass all sales
  saleItems: SaleItem[]; // Pass all sale items
  onEdit: (customer: Customer) => void;
  onDelete: (id: string) => Promise<void>;
  isDeleting: string | null;
}

export default function CustomerList({ customers, sales, saleItems, onEdit, onDelete, isDeleting }: CustomerListProps) {
  const activeCustomers = customers.filter(customer => customer.is_deleted !== 1);

  const getCustomerTotalSalesValue = (customerId: string): number => {
    const customerSales = sales.filter(s => s.customer_id === customerId && s.is_deleted !== 1);
    let totalValue = 0;
    customerSales.forEach(sale => {
      const itemsForSale = saleItems.filter(si => si.sale_id === sale.id && si.is_deleted !== 1);
      itemsForSale.forEach(item => {
        totalValue += item.quantity_sold * item.price_per_unit;
      });
    });
    return totalValue;
  };

  if (activeCustomers.length === 0) {
    return <p className="text-center text-gray-500 mt-8">No customers recorded yet. Add your first customer!</p>;
  }

  return (
    <div className="overflow-x-auto shadow-md rounded-lg">
      <table className="min-w-full bg-white">
        <thead className="bg-green-600 text-white">
          <tr>
            <th className="text-left py-3 px-5 uppercase font-semibold text-sm">Name</th>
            <th className="text-left py-3 px-5 uppercase font-semibold text-sm">Type</th>
            <th className="text-left py-3 px-5 uppercase font-semibold text-sm">Contact Info</th>
            <th className="text-left py-3 px-5 uppercase font-semibold text-sm">Address</th>
            <th className="text-right py-3 px-5 uppercase font-semibold text-sm">Total Sales Value</th>
            <th className="text-center py-3 px-5 uppercase font-semibold text-sm">Synced</th>
            <th className="text-center py-3 px-5 uppercase font-semibold text-sm">Actions</th>
          </tr>
        </thead>
        <tbody className="text-gray-700">
          {activeCustomers.map((customer) => {
            const totalSalesValue = getCustomerTotalSalesValue(customer.id);
            return (
              <tr key={customer.id} className="border-b border-gray-200 hover:bg-green-50 transition-colors duration-150">
                <td className="py-3 px-5">{customer.name}</td>
                <td className="py-3 px-5">{customer.customer_type || 'N/A'}</td>
                <td className="py-3 px-5">{customer.contact_info || 'N/A'}</td>
                <td className="py-3 px-5 whitespace-pre-wrap">{customer.address || 'N/A'}</td>
                <td className="py-3 px-5 text-right">€{totalSalesValue.toFixed(2)}</td>
                <td className="py-3 px-5 text-center">
                  {customer._synced === 0 ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                    Pending
                  </span>
                ) : customer._synced === 1 ? (
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
                {/* Optional: Button to view sales for this customer */}
                {/* {onViewSales && (
                  <button
                    onClick={() => onViewSales(customer.id)}
                    className="text-purple-600 hover:text-purple-800 font-medium transition-colors duration-150"
                  >
                    Sales
                  </button>
                )} */}
                <button
                  onClick={() => onEdit(customer)}
                  className="text-blue-600 hover:text-blue-800 font-medium transition-colors duration-150"
                  disabled={isDeleting === customer.id}
                >
                  Edit
                </button>
                <button
                  onClick={() => onDelete(customer.id)}
                  className="text-red-600 hover:text-red-800 font-medium transition-colors duration-150 disabled:opacity-50"
                  disabled={isDeleting === customer.id}
                >
                  {isDeleting === customer.id ? 'Deleting...' : 'Delete'}
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