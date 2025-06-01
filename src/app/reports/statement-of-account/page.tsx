'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { db, Customer, Invoice, Sale, SaleItem } from '@/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { useReactToPrint } from 'react-to-print';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { formatDateToDDMMYYYY } from '@/lib/dateUtils';

// Hardcoded company details for now
const COMPANY_DETAILS = {
  name: "K.K. Biofresh",
  address: "1ης Απριλίου 300 7520 Ξυλοφάγου Λάρνακα",
  phone: "99611241",
  email: "kyris31@gmail.com"
  // vatNumber: "------------" // Removed VAT number
};

interface EnrichedInvoice extends Invoice {
  sale_total_amount?: number; // Calculated from associated sale
  customer_name?: string;
}

export default function StatementOfAccountPage() {
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [statementInvoices, setStatementInvoices] = useState<EnrichedInvoice[]>([]);
  const [currentCustomer, setCurrentCustomer] = useState<Customer | null>(null);
  const [loadingStatement, setLoadingStatement] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const componentToPrintRef = useRef<HTMLDivElement>(null);

  const customers = useLiveQuery(
    () => db.customers.where('is_deleted').notEqual(1).sortBy('name'),
    []
  );

  const fetchStatementData = useCallback(async () => {
    if (!selectedCustomerId) {
      setStatementInvoices([]);
      setCurrentCustomer(null);
      return;
    }

    setLoadingStatement(true);
    setError(null);
    try {
      const customer = await db.customers.get(selectedCustomerId);
      setCurrentCustomer(customer || null);

      if (!customer) {
        setStatementInvoices([]);
        setLoadingStatement(false);
        return;
      }

      // Fetch sales for the customer
      const customerSales = await db.sales
        .where('customer_id').equals(selectedCustomerId)
        .and(sale => sale.is_deleted !== 1)
        .toArray();
      
      const saleIds = customerSales.map(s => s.id);

      // Fetch invoices linked to these sales
      const invoices = await db.invoices
        .where('sale_id').anyOf(saleIds)
        .and(inv => inv.is_deleted !== 1)
        .sortBy('invoice_date');

      const enrichedInvoices: EnrichedInvoice[] = [];
      let totalDue = 0;

      for (const invoice of invoices) {
        const sale = customerSales.find(s => s.id === invoice.sale_id);
        let saleTotal = sale?.total_amount;

        // If sale.total_amount is not pre-calculated, calculate it from saleItems
        if (sale && typeof saleTotal !== 'number') {
            const items = await db.saleItems.where('sale_id').equals(sale.id).filter(si => si.is_deleted !== 1).toArray();
            saleTotal = items.reduce((sum, item) => {
                const itemTotal = item.quantity_sold * item.price_per_unit;
                const discount = item.discount_type === 'Amount' 
                                ? (item.discount_value || 0)
                                : item.discount_type === 'Percentage' 
                                    ? itemTotal * ((item.discount_value || 0) / 100)
                                    : 0;
                return sum + (itemTotal - discount);
            }, 0);
        }
        
        enrichedInvoices.push({
          ...invoice,
          sale_total_amount: saleTotal,
          customer_name: customer.name
        });

        if (invoice.status !== 'Paid') {
          totalDue += saleTotal || 0;
        }
      }
      
      setStatementInvoices(enrichedInvoices);

    } catch (err) {
      console.error("Error fetching statement data:", err);
      setError("Failed to load statement data.");
    } finally {
      setLoadingStatement(false);
    }
  }, [selectedCustomerId]);

  useEffect(() => {
    fetchStatementData();
  }, [fetchStatementData]);

  const handlePrint = useReactToPrint({
    // @ts-ignore - Assuming 'content' is a valid prop but types might be mismatched/incorrect
    content: (): HTMLDivElement | null => componentToPrintRef.current,
    documentTitle: `Statement_of_Account_${currentCustomer?.name?.replace(/\s+/g, '_') || 'Customer'}`
  });

  const handleExportPdf = () => {
    console.log("handleExportPdf called");
    if (componentToPrintRef.current) {
      console.log("componentToPrintRef.current is available:", componentToPrintRef.current);
      const input = componentToPrintRef.current;
      // Temporarily remove box-shadow for PDF generation to avoid rendering issues
      const originalBoxShadow = input.style.boxShadow;
      input.style.boxShadow = 'none';

      html2canvas(input, {
        scale: 2, // Increase scale for better quality
        useCORS: true, // If you have external images
        onclone: (clonedDoc) => {
          const allElements = clonedDoc.getElementsByTagName('*');
          for (let i = 0; i < allElements.length; i++) {
            const element = allElements[i] as HTMLElement;
            if (element.style) {
              const computedStyle = window.getComputedStyle(element);
              
              // Check text color
              const textColor = computedStyle.getPropertyValue('color');
              if (textColor.includes('oklch')) {
                console.log(`OKLCH found for text color on element ${element.tagName}, replacing with black.`);
                element.style.color = 'black';
              }

              // Check background color
              const bgColor = computedStyle.getPropertyValue('background-color');
              if (bgColor.includes('oklch')) {
                 console.log(`OKLCH found for background-color on element ${element.tagName}, replacing with white.`);
                // Be careful with overriding background, could make text invisible if it was light on dark
                // For simplicity, let's try white, but this might need refinement
                element.style.backgroundColor = 'white';
              }

              // Check border colors (more complex as there are multiple border color properties)
              const borderTopColor = computedStyle.getPropertyValue('border-top-color');
              if (borderTopColor.includes('oklch')) {
                element.style.borderTopColor = '#cccccc'; // Light gray fallback
              }
              const borderRightColor = computedStyle.getPropertyValue('border-right-color');
              if (borderRightColor.includes('oklch')) {
                element.style.borderRightColor = '#cccccc';
              }
              const borderBottomColor = computedStyle.getPropertyValue('border-bottom-color');
              if (borderBottomColor.includes('oklch')) {
                element.style.borderBottomColor = '#cccccc';
              }
              const borderLeftColor = computedStyle.getPropertyValue('border-left-color');
              if (borderLeftColor.includes('oklch')) {
                element.style.borderLeftColor = '#cccccc';
              }
            }
          }
        }
      }).then((canvas) => {
        console.log("html2canvas success, canvas object:", canvas);
        // Restore original box-shadow
        input.style.boxShadow = originalBoxShadow;

        const imgData = canvas.toDataURL('image/png');
        console.log("imgData length:", imgData.length);
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'pt', // points, matches html2canvas output better
          format: 'a4'
        });

        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;
        
        // Calculate the aspect ratio
        const ratio = canvasWidth / canvasHeight;
        let imgWidth = pdfWidth - 20; // pdfWidth with some margin
        let imgHeight = imgWidth / ratio;

        // If the calculated height is too large for the page, scale down
        if (imgHeight > pdfHeight - 20) {
            imgHeight = pdfHeight - 20; // pdfHeight with some margin
            imgWidth = imgHeight * ratio;
        }
        
        // Center the image on the page (optional)
        const x = (pdfWidth - imgWidth) / 2;
        const y = 10; // Top margin

        pdf.addImage(imgData, 'PNG', x, y, imgWidth, imgHeight);
        console.log("PDF image added, attempting to save...");
        pdf.save(`Statement_of_Account_${currentCustomer?.name?.replace(/\s+/g, '_') || 'Customer'}.pdf`);
        console.log("pdf.save() called.");
      }).catch(err => {
        console.error("Error during html2canvas or PDF generation:", err);
        // Restore original box-shadow in case of error
        if (input) input.style.boxShadow = originalBoxShadow;
      });
    } else {
      console.warn("handleExportPdf: componentToPrintRef.current is null or undefined.");
    }
  };
  
  const calculateTotalDue = () => {
    return statementInvoices
      .filter(inv => inv.status !== 'Paid')
      .reduce((sum, inv) => sum + (inv.sale_total_amount || 0), 0);
  };

  return (
    <div className="p-4 md:p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Statement of Account</h1>
      </header>

      <div className="mb-6 p-4 bg-white shadow rounded-lg">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label htmlFor="customer" className="block text-sm font-medium text-gray-700 mb-1">
              Select Customer
            </label>
            <select
              id="customer"
              name="customer"
              value={selectedCustomerId || ''}
              onChange={(e) => setSelectedCustomerId(e.target.value || null)}
              className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
            >
              <option value="">-- Select a Customer --</option>
              {customers?.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </div>
          {/* Date range pickers can be added here later */}
          <div className="md:col-span-1 flex flex-col md:flex-row items-stretch md:items-end space-y-2 md:space-y-0 md:space-x-2">
            <button
                onClick={handlePrint}
                disabled={!selectedCustomerId || statementInvoices.length === 0 || loadingStatement}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded shadow-sm transition-colors duration-150 disabled:opacity-50"
            >
                Print Statement
            </button>
            <button
                onClick={handleExportPdf}
                disabled={!selectedCustomerId || statementInvoices.length === 0 || loadingStatement}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded shadow-sm transition-colors duration-150 disabled:opacity-50"
            >
                Export to PDF
            </button>
          </div>
        </div>
      </div>

      {loadingStatement && <p className="text-center">Loading statement...</p>}
      {error && <p className="text-red-500 text-center">{error}</p>}

      {!loadingStatement && selectedCustomerId && currentCustomer && (
        <div ref={componentToPrintRef} className="p-6 bg-white shadow-lg rounded-lg print-container">
          {/* Statement Header */}
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-800">{COMPANY_DETAILS.name}</h2>
            <p className="text-sm text-gray-600">{COMPANY_DETAILS.address}</p>
            <p className="text-sm text-gray-600">Phone: {COMPANY_DETAILS.phone} | Email: {COMPANY_DETAILS.email}</p>
            {/* {COMPANY_DETAILS.vatNumber && <p className="text-sm text-gray-600">VAT No: {COMPANY_DETAILS.vatNumber}</p>} */}
            <h3 className="text-2xl font-semibold text-gray-700 mt-6 border-b pb-2">Statement of Account</h3>
          </div>

          {/* Customer and Date Info */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <h4 className="font-semibold text-gray-700">To:</h4>
              <p className="text-gray-600">{currentCustomer.name}</p>
              {currentCustomer.address && <p className="text-gray-600">{currentCustomer.address}</p>}
              {currentCustomer.contact_info && <p className="text-gray-600">{currentCustomer.contact_info}</p>}
            </div>
            <div className="text-right">
              <p className="text-gray-600"><span className="font-semibold">Statement Date:</span> {formatDateToDDMMYYYY(new Date())}</p>
              {/* Add date range here if implemented */}
            </div>
          </div>

          {/* Invoice Table */}
          {statementInvoices.length > 0 ? (
            <table className="min-w-full divide-y divide-gray-200 mb-6">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice #</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount (€)</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {statementInvoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDateToDDMMYYYY(invoice.invoice_date)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{invoice.invoice_number}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">Invoice for Sale ID: {invoice.sale_id}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      {invoice.sale_total_amount?.toFixed(2) || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        invoice.status === 'Paid' ? 'bg-green-100 text-green-800' :
                        invoice.status === 'Overdue' ? 'bg-red-100 text-red-800' :
                        invoice.status === 'Sent' ? 'bg-blue-100 text-blue-800' :
                        'bg-yellow-100 text-yellow-800' // Draft or other
                      }`}>
                        {invoice.status || 'N/A'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-gray-500 text-center py-4">No invoices found for this customer in the selected period.</p>
          )}

          {/* Summary */}
          <div className="flex justify-end mt-8">
            <div className="w-full max-w-xs">
              <div className="flex justify-between py-2 border-b">
                <span className="font-semibold text-gray-700">Total Due:</span>
                <span className="font-semibold text-gray-900">€{calculateTotalDue().toFixed(2)}</span>
              </div>
            </div>
          </div>
          
          {/* Footer/Notes for Print */}
          <div className="mt-12 pt-6 border-t text-center text-xs text-gray-500 print-footer">
            <p>Thank you for your business!</p>
            <p>Please make payments to [Your Bank Details Here] referencing the invoice number.</p>
            <p>{COMPANY_DETAILS.name} - Generated on {new Date().toLocaleString()}</p>
          </div>
        </div>
      )}
      {!loadingStatement && selectedCustomerId && !currentCustomer && (
        <p className="text-center text-gray-500 mt-4">Customer not found.</p>
      )}
      {!loadingStatement && !selectedCustomerId && (
        <p className="text-center text-gray-500 mt-4">Please select a customer to generate a statement.</p>
      )}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-container, .print-container * {
            visibility: visible;
          }
          .print-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .print-footer {
            position: fixed;
            bottom: 20px;
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}