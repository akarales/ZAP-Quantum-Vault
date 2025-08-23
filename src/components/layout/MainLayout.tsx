import React from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

interface MainLayoutProps {
  children: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="flex h-[calc(100vh-3.5rem)]">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <div className="h-full w-full p-4 md:p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
