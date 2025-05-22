'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import type { HurvesthubDB } from '@/lib/db'; // Import the DB type

interface DbContextType {
  isDbReady: boolean;
  dbInstance: HurvesthubDB | null; // Provide the db instance
}

const DbContext = createContext<DbContextType | undefined>(undefined);

export const DbContextProvider: React.FC<{ children: ReactNode; isDbReady: boolean; dbInstance: HurvesthubDB | null }> = ({ children, isDbReady, dbInstance }) => {
  return (
    <DbContext.Provider value={{ isDbReady, dbInstance }}>
      {children}
    </DbContext.Provider>
  );
};

export const useDbContext = (): DbContextType => {
  const context = useContext(DbContext);
  if (context === undefined) {
    throw new Error('useDbContext must be used within a DbContextProvider');
  }
  return context;
};