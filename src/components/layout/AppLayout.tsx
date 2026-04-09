import { Outlet } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';
import { useState } from 'react';

const AppLayout = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Sidebar />
      <main className="ml-64 mt-16 p-6 min-h-[calc(100vh-64px)] transition-all duration-300">
        <Outlet />
      </main>
    </div>
  );
};

export default AppLayout;
