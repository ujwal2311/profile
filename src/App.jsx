import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Room from './pages/Room';
import Dashboard from './pages/Dashboard';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/room/:roomId" element={<Room />} />
      <Route path="/dashboard" element={<Dashboard />} />
    </Routes>
  );
}
