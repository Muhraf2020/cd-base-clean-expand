// components/FeaturedClinicsSection.tsx
'use client';

import { useEffect, useState } from 'react';
import { Clinic } from '@/lib/dataTypes';
import ClinicBanner from './ClinicBanner';
import Link from 'next/link';

interface FeaturedClinicsSectionProps {
  currentClinicId: string;
  city: string;
  stateCode: string;
}

export default function FeaturedClinicsSection({
  currentClinicId,
  city,
  stateCode,
}: FeaturedClinicsSectionProps) {
  const [featuredClinics, setFeaturedClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFeaturedClinics();
  }, [city, stateCode, currentClinicId]);

  const loadFeaturedClinics = async () => {
    try {
      setLoading(true);
      
      // Fetch featured clinics from the same city
      const response = await fetch(
        `/api/featured-clinics?city=${encodeURIComponent(city)}&state=${stateCode}&exclude=${currentClinicId}`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch featured clinics');
      }

      const data = await response.json();
      setFeaturedClinics(data.clinics || []);
    } catch (error) {
      console.error('Error loading featured clinics:', error);
      setFeaturedClinics([]);
    } finally {
      setLoading(false);
    }
  };

  // Don't render section if no featured clinics
  if (!loading && featuredClinics.length === 0) {
    return null;
  }

  return (
    <section className="mt-12 pt-8 border-t border-gray-200">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Featured Dermatology Clinics in {city}
        </h2>
        <p className="text-gray-600">
          Top-rated clinics serving the {city} area
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-lg shadow-md overflow-hidden animate-pulse"
            >
              <div className="h-48 bg-gray-200"></div>
              <div className="p-4">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {featuredClinics.map((clinic) => (
            <Link
              key={clinic.place_id}
              href={`/clinics/${clinic.place_id}`}
              className="group block"
            >
              <div className="bg-white rounded-lg shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden relative">
                {/* Featured Badge */}
                <div className="absolute top-3 left-3 z-10">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-yellow-400 to-orange-500 text-white shadow-lg">
                    <svg
                      className="w-3 h-3 mr-1"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    Featured
                  </span>
                </div>

                {/* Banner */}
                <div className="h-48 overflow-hidden">
                  <ClinicBanner
                    clinicName={clinic.display_name}
                    placeId={clinic.place_id}
                    rating={clinic.rating}
                    website={clinic.website}
                    className="w-full h-full object-cover transform-gpu group-hover:scale-105 transition-transform duration-300"
                  />
                </div>

                {/* Content */}
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 mb-2 line-clamp-1 group-hover:text-blue-600 transition-colors">
                    {clinic.display_name}
                  </h3>

                  {clinic.rating && (
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-yellow-400">★</span>
                      <span className="font-semibold text-gray-900">
                        {clinic.rating.toFixed(1)}
                      </span>
                      {clinic.user_rating_count && (
                        <span className="text-sm text-gray-500">
                          ({clinic.user_rating_count})
                        </span>
                      )}
                    </div>
                  )}

                  <p className="text-sm text-gray-600 line-clamp-2">
                    {clinic.formatted_address}
                  </p>

                  {/* Quick Features */}
                  <div className="flex flex-wrap gap-1 mt-3">
                    {clinic.accessibility_options?.wheelchair_accessible_entrance && (
                      <span className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded">
                        ♿ Accessible
                      </span>
                    )}
                    {clinic.parking_options?.free_parking_lot && (
                      <span className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded">
                        🅿️ Free Parking
                      </span>
                    )}
                    {clinic.website && (
                      <span className="text-xs px-2 py-1 bg-purple-50 text-purple-700 rounded">
                        🌐 Website
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* View More Link */}
      {featuredClinics.length > 0 && (
        <div className="mt-6 text-center">
          <Link
            href={`/clinics?city=${encodeURIComponent(city)}&state=${stateCode}`}
            className="inline-flex items-center px-6 py-3 border border-blue-600 text-blue-600 font-medium rounded-lg hover:bg-blue-50 transition-colors"
          >
            View All Clinics in {city}
            <svg
              className="w-5 h-5 ml-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </Link>
        </div>
      )}
    </section>
  );
}
