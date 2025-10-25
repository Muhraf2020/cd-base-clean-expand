'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface StateInfo {
  code: string;
  name: string;
  clinicCount: number;
}

export default function StateGrid() {
  const [states, setStates] = useState<StateInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStateCounts();
  }, []);

  const loadStateCounts = async () => {
    try {
      setLoading(true);
      // Single API call instead of 50+!
      const response = await fetch('/api/stats');
      const data = await response.json();
      
      setStates(data.states || []);
    } catch (error) {
      console.error('Error loading state counts:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} className="bg-white rounded-lg shadow-md p-4 sm:p-6 animate-pulse">
            <div className="h-6 bg-gray-200 rounded mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
      {states.map((state) => (
        <Link
          key={state.code}
          href={`/clinics?state=${state.code}`}
          className="bg-gradient-to-br from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 rounded-lg shadow-md hover:shadow-xl transition-all duration-300 p-4 sm:p-6 group border-2 border-blue-200 hover:border-blue-400 active:scale-95"
        >
          <div className="flex flex-col items-center text-center">
            <div className="text-2xl sm:text-3xl font-bold text-blue-600 mb-1 sm:mb-2 group-hover:scale-110 transition-transform">
              {state.code}
            </div>
            <div className="text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2 line-clamp-2">
              {state.name}
            </div>
            <div className="flex items-center gap-1 text-xs text-gray-600">
              <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
              </svg>
              <span className="font-semibold">{state.clinicCount}</span>
              <span className="hidden sm:inline">clinics</span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
