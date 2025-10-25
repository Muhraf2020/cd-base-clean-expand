'use client';

import { useState, useEffect } from 'react';
import StateGrid from '@/components/StateGrid';
import SearchBar from '@/components/SearchBar';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const [stats, setStats] = useState({
    totalClinics: 0,
    totalStates: 0,
    loading: true
  });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const response = await fetch('/api/stats');
      const data = await response.json();
      
      setStats({
        totalClinics: data.totalClinics || 0,
        totalStates: data.totalStates || 50,
        loading: false
      });
    } catch (error) {
      console.error('Error loading stats:', error);
      setStats(prev => ({ ...prev, loading: false }));
    }
  };

  const handleSearch = (query: string) => {
    router.push(`/clinics?q=${encodeURIComponent(query)}`);
  };

  const handleLocationSearch = (lat: number, lng: number) => {
    router.push(`/clinics?lat=${lat}&lng=${lng}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Hero Section - Mobile Optimized */}
      <header className="bg-gradient-to-r from-blue-600 to-blue-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16">
          <div className="text-center">
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-3 sm:mb-4 leading-tight">
              Find Dermatology Clinics Near You
            </h1>
            <p className="text-base sm:text-xl lg:text-2xl text-blue-100 mb-6 sm:mb-8 max-w-3xl mx-auto px-4">
              Your comprehensive directory of dermatology clinics across the United States
            </p>
          </div>
        </div>
      </header>

      {/* Sticky Search Bar - Mobile Optimized */}
      <div className="sticky top-0 z-50 bg-white shadow-md">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 lg:px-8 py-2 sm:py-4">
          <SearchBar
            onSearch={handleSearch}
            onLocationSearch={handleLocationSearch}
          />
        </div>
      </div>

      {/* Stats Section - Mobile Optimized */}
      <section className="py-8 sm:py-12 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
            {/* Total Clinics */}
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl shadow-lg p-6 sm:p-8 text-center border-2 border-blue-200">
              <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 bg-blue-600 rounded-full mb-3 sm:mb-4">
                <svg className="w-6 h-6 sm:w-8 sm:h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div className="text-3xl sm:text-4xl font-bold text-blue-600 mb-2">
                {stats.loading ? '...' : stats.totalClinics.toLocaleString()}
              </div>
              <div className="text-sm sm:text-base text-gray-700 font-medium">Dermatology Clinics</div>
            </div>

            {/* Total States */}
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl shadow-lg p-6 sm:p-8 text-center border-2 border-green-200">
              <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 bg-green-600 rounded-full mb-3 sm:mb-4">
                <svg className="w-6 h-6 sm:w-8 sm:h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 013.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
              </div>
              <div className="text-3xl sm:text-4xl font-bold text-green-600 mb-2">
                {stats.totalStates}
              </div>
              <div className="text-sm sm:text-base text-gray-700 font-medium">States Covered</div>
            </div>

            {/* Verified Info */}
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl shadow-lg p-6 sm:p-8 text-center border-2 border-purple-200 sm:col-span-1 col-span-1">
              <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 bg-purple-600 rounded-full mb-3 sm:mb-4">
                <svg className="w-6 h-6 sm:w-8 sm:h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="text-3xl sm:text-4xl font-bold text-purple-600 mb-2">
                100%
              </div>
              <div className="text-sm sm:text-base text-gray-700 font-medium">Verified Information</div>
            </div>
          </div>
        </div>
      </section>

      {/* About Section - Mobile Optimized */}
      <section className="py-8 sm:py-12 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-3 sm:mb-4">
              About Derm Clinics Near Me
            </h2>
            <p className="text-base sm:text-lg text-gray-600 leading-relaxed px-2">
              We provide a comprehensive, up-to-date directory of dermatology clinics across the United States. 
              Whether you're looking for general dermatology care, cosmetic procedures, or specialized skin treatments, 
              our directory helps you find qualified dermatologists in your area.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8 sm:mb-12">
            <div className="bg-white rounded-lg shadow-md p-5 sm:p-6 text-center">
              <div className="text-blue-600 text-3xl sm:text-4xl mb-2 sm:mb-3">🔍</div>
              <h3 className="font-semibold text-gray-900 mb-2 text-sm sm:text-base">Easy Search</h3>
              <p className="text-xs sm:text-sm text-gray-600">
                Find clinics by state, city, or ZIP code
              </p>
            </div>

            <div className="bg-white rounded-lg shadow-md p-5 sm:p-6 text-center">
              <div className="text-green-600 text-3xl sm:text-4xl mb-2 sm:mb-3">⭐</div>
              <h3 className="font-semibold text-gray-900 mb-2 text-sm sm:text-base">Verified Ratings</h3>
              <p className="text-xs sm:text-sm text-gray-600">
                Real patient reviews and ratings
              </p>
            </div>

            <div className="bg-white rounded-lg shadow-md p-5 sm:p-6 text-center">
              <div className="text-purple-600 text-3xl sm:text-4xl mb-2 sm:mb-3">📍</div>
              <h3 className="font-semibold text-gray-900 mb-2 text-sm sm:text-base">Detailed Info</h3>
              <p className="text-xs sm:text-sm text-gray-600">
                Hours, contact info, and directions
              </p>
            </div>

            <div className="bg-white rounded-lg shadow-md p-5 sm:p-6 text-center">
              <div className="text-orange-600 text-3xl sm:text-4xl mb-2 sm:mb-3">♿</div>
              <h3 className="font-semibold text-gray-900 mb-2 text-sm sm:text-base">Accessibility</h3>
              <p className="text-xs sm:text-sm text-gray-600">
                Filter by accessibility features
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* States Grid Section - Mobile Optimized */}
      <section className="py-8 sm:py-12 lg:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-3 sm:mb-4">
              Browse Clinics by State
            </h2>
            <p className="text-base sm:text-lg text-gray-600 px-4">
              Select your state to find dermatology clinics near you
            </p>
          </div>

          <StateGrid />
        </div>
      </section>

      {/* Footer - Mobile Optimized */}
      <footer className="bg-gray-900 text-white mt-12 sm:mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 sm:gap-8">
            <div>
              <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">About</h3>
              <p className="text-gray-400 text-xs sm:text-sm">
                Find the best dermatology clinics near you with verified
                information, ratings, and reviews.
              </p>
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Quick Links</h3>
              <ul className="space-y-2 text-gray-400 text-xs sm:text-sm">
                <li><a href="#" className="hover:text-white">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-white">Terms of Service</a></li>
                <li><a href="#" className="hover:text-white">Contact Us</a></li>
              </ul>
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Connect</h3>
              <p className="text-gray-400 text-xs sm:text-sm">
                © 2025 Derm Clinics Near Me. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
