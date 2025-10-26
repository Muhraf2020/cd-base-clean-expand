'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface CityInfo {
  name: string;
  clinicCount: number;
  slug: string;
}

interface CityGridProps {
  stateCode: string;
}

export default function CityGrid({ stateCode }: CityGridProps) {
  const [cities, setCities] = useState<CityInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalClinics, setTotalClinics] = useState(0);

  useEffect(() => {
    loadCities();
  }, [stateCode]);

  const loadCities = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/cities?state=${stateCode}`);
      const data = await response.json();
      
      setCities(data.cities || []);
      setTotalClinics(data.totalClinics || 0);
    } catch (error) {
      console.error('Error loading cities:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="bg-white rounded-lg shadow-md p-4 sm:p-6 animate-pulse">
            <div className="h-6 bg-gray-200 rounded mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          </div>
        ))}
      </div>
    );
  }

  if (cities.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 text-lg">No cities found for this state.</p>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6 text-center">
        <p className="text-gray-600">
          {totalClinics.toLocaleString()} clinics across {cities.length} cities
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
        {cities.map((city) => (
          <Link
            key={city.slug}
            href={`/state/${stateCode}/city/${encodeURIComponent(city.slug)}`}
            className="bg-gradient-to-br from-green-50 to-green-100 hover:from-green-100 hover:to-green-200 rounded-lg shadow-md hover:shadow-xl transition-all duration-300 p-6 group border-2 border-green-200 hover:border-green-400 active:scale-95"
          >
            <div className="flex flex-col items-center text-center">
              <div className="text-3xl mb-3 group-hover:scale-110 transition-transform">
                🏙️
              </div>
              <div className="text-lg font-bold text-gray-900 mb-2 line-clamp-2">
                {city.name}
              </div>
              <div className="flex items-center gap-1 text-sm text-gray-600">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                </svg>
                <span className="font-semibold">{city.clinicCount}</span>
                <span>clinics</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
