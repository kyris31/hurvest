import Link from 'next/link';
import React, { useState, useEffect } from 'react';
import { SyncError } from '../lib/sync'; // Import the SyncError type

const navItems = [
  { href: '/', label: 'Dashboard' },
  { href: '/crops', label: 'Crops' },
  { href: '/planting', label: 'Planting Logs' },
  { href: '/seedling-production', label: 'Seedling Production' },
  { href: '/inventory', label: 'Inventory' },
  { href: '/cultivation', label: 'Cultivation' },
  { href: '/harvests', label: 'Harvests' },
  { href: '/sales', label: 'Sales' },
  { href: '/trees', label: 'Trees' }, // Added Trees link
  { href: '/reminders', label: 'Reminders' },
  { href: '/reports', label: 'Reports' },
];

const quickAddNavItems = [
  { href: '/crops?action=add', label: 'Add Crop' },
  { href: '/inventory/seed-batches?action=add', label: 'Add Seed Batch' },
  { href: '/seedling-production?action=add', label: 'Add Sowing Record' },
  { href: '/reminders?action=add', label: 'Add Reminder' },
  { href: '/customers?action=add', label: 'Add Customer' },
  { href: '/trees?action=add', label: 'Add Tree' },
];

interface NavigationProps {
  isOnline: boolean;
  syncing: boolean;
  lastSyncStatus: string | null;
  onManualSync: () => Promise<void>;
  syncErrorDetails?: SyncError[]; // Optional: array of detailed sync errors
  onClearSyncErrors?: () => void; // Optional: function to clear displayed errors
}

export default function Navigation({
  isOnline,
  syncing,
  lastSyncStatus,
  onManualSync,
  syncErrorDetails,
  onClearSyncErrors
}: NavigationProps) {
  const [manualSyncMessage, setManualSyncMessage] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSyncClick = async () => {
    setManualSyncMessage("Syncing...");
    try {
      await onManualSync();
      setManualSyncMessage("Sync successful!");
    } catch (error) {
      setManualSyncMessage("Sync failed. Check console.");
      console.error("Manual sync error:", error);
    }
    setTimeout(() => setManualSyncMessage(null), 3000);
  };

  return (
    <nav className="bg-green-700 p-4 text-white">
      <div className="container mx-auto flex flex-wrap justify-between items-center">
        <Link href="/" className="text-xl font-bold mb-2 sm:mb-0">
          Hurvesthub
        </Link>
        <ul className="flex flex-wrap items-center space-x-2 sm:space-x-4 mb-2 sm:mb-0">
          {navItems.map((item) => (
            <li key={item.href}>
              <Link href={item.href} className="hover:bg-green-600 px-2 py-1 sm:px-3 sm:py-2 rounded-md text-xs sm:text-sm font-medium">
                {item.label}
              </Link>
            </li>
          ))}
           {/* Quick Add Dropdown */}
           <li className="relative">
            <button
              onClick={() => setShowQuickAdd(!showQuickAdd)}
              onBlur={() => setTimeout(() => setShowQuickAdd(false), 150)} // Hide on blur with delay
              className="hover:bg-green-600 px-2 py-1 sm:px-3 sm:py-2 rounded-md text-xs sm:text-sm font-medium flex items-center"
            >
              Quick Add
              <svg className={`w-2.5 h-2.5 ml-1.5 transform transition-transform duration-200 ${showQuickAdd ? 'rotate-180' : ''}`} aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="10 6 20 12"><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m1 1 4 4 4-4"/></svg>
            </button>
            {showQuickAdd && (
              <div className="absolute right-0 sm:left-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50">
                {quickAddNavItems.map(item => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setShowQuickAdd(false)}
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            )}
          </li>
        </ul>
        <div className="flex items-center space-x-3">
            {mounted ? (
              <>
                <button
                    onClick={handleSyncClick}
                    disabled={syncing || !isOnline}
                    className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-400
                                ${isOnline ? 'bg-blue-500 hover:bg-blue-600' : 'bg-gray-400 cursor-not-allowed'}
                                ${syncing ? 'opacity-50 cursor-wait' : ''}`}
                >
                    {syncing ? 'Syncing...' : 'Sync Now'}
                </button>
                <div className="text-xs sm:text-sm">
                    <span className={`mr-1 px-2 py-0.5 rounded-full text-xs ${isOnline ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>
                        {isOnline ? 'Online' : 'Offline'}
                    </span>
                    {manualSyncMessage && <span className="ml-1 text-yellow-300">{manualSyncMessage}</span>}
                    {!manualSyncMessage && lastSyncStatus && <span className="ml-1">{lastSyncStatus}</span>}
                </div>
              </>
            ) : (
              // Render a placeholder or consistent initial state for SSR
              <div className="text-xs sm:text-sm">
                <span className="mr-1 px-2 py-0.5 rounded-full text-xs bg-gray-200 text-gray-700">
                    Status...
                </span>
              </div>
            )}
        </div>
      </div>
      {/* Display Sync Error Details */}
      {syncErrorDetails && syncErrorDetails.length > 0 && (
        <div className="container mx-auto mt-2 p-2 bg-red-100 border border-red-400 text-red-700 rounded">
          <div className="flex justify-between items-center mb-1">
            <h4 className="font-bold">Sync Issues:</h4>
            {onClearSyncErrors && (
              <button
                onClick={onClearSyncErrors}
                className="text-xs text-red-700 hover:text-red-900 font-semibold"
                title="Clear these messages"
              >
                Dismiss
              </button>
            )}
          </div>
          <ul className="list-disc list-inside text-xs space-y-1">
            {syncErrorDetails.map((err, index) => (
              <li key={index}>
                <strong>Table:</strong> {err.table}, <strong>ID:</strong> {err.id || 'N/A'}<br />
                <strong>Error:</strong> {err.message}
                {err.code && ` (Code: ${err.code})`}
                {err.details && <><br/><strong>Details:</strong> {err.details}</>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </nav>
  );
}