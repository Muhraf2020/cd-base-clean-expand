// app/clinics/[id]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import type { Clinic } from '@/lib/dataTypes';

export default function ClinicDetailPage() {
  const params = useParams() as { id?: string | string[] };
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    async function fetchClinic() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/clinics/${encodeURIComponent(id)}`, {
          headers: { 'accept': 'application/json' },
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(`Failed to fetch clinic (${res.status})`);
        const data = await res.json();
        // Keep state typed as Clinic; we’ll compute fallbacks at render time
        setClinic((data?.clinic ?? null) as Clinic | null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    }

    fetchClinic();
  }, [id]);

  if (!id) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-red-600">Invalid clinic URL.</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading clinic details...</div>
      </div>
    );
  }

  if (error || !clinic) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-red-600">{error || 'Clinic not found'}</div>
      </div>
    );
  }

  // ---- Field fallbacks to tolerate either API/DB shape without changing `Clinic` ----
  const cAny = clinic as any;
  const phone: string | null = cAny.phone ?? cAny.phone_number ?? null;
  const website: string | null = cAny.website ?? cAny.website_uri ?? null;
  const ratingCount: number | null =
    cAny.user_rating_count ?? cAny.user_ratings_total ?? null;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {clinic.display_name}
          </h1>

          {clinic.current_open_now !== undefined && (
            <div className="mb-4">
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  clinic.current_open_now
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}
              >
                {clinic.current_open_now ? '🟢 Open Now' : '🔴 Closed'}
              </span>
            </div>
          )}

          <div className="space-y-2 text-gray-700">
            <p className="flex items-start">
              <span className="mr-2">📍</span>
              <span>{clinic.formatted_address}</span>
            </p>

            {phone && (
              <p className="flex items-center">
                <span className="mr-2">📞</span>
                <a href={`tel:${phone}`} className="text-blue-600 hover:underline">
                  {phone}
                </a>
              </p>
            )}

            {website && (
              <p className="flex items-center">
                <span className="mr-2">🌐</span>
                <a
                  href={website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline break-all"
                >
                  Visit Website
                </a>
              </p>
            )}

            {clinic.rating && (
              <p className="flex items-center">
                <span className="mr-2">⭐</span>
                <span className="font-semibold">
                  {typeof clinic.rating === 'number'
                    ? clinic.rating.toFixed(1)
                    : clinic.rating}
                </span>
                {ratingCount != null && (
                  <span className="ml-1 text-gray-500">({ratingCount} reviews)</span>
                )}
              </p>
            )}
          </div>
        </div>

        {/* Opening Hours */}
        {clinic.opening_hours?.weekday_text && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Opening Hours</h2>
            <ul className="space-y-2">
              {clinic.opening_hours.weekday_text.map((hours: string, i: number) => {
                const [day, times] = hours.split(': ');
                const isToday =
                  new Date().toLocaleDateString('en-US', { weekday: 'long' }) === day;
                return (
                  <li
                    key={i}
                    className={`flex justify-between py-2 px-3 rounded ${
                      isToday ? 'bg-blue-50 font-semibold' : ''
                    }`}
                  >
                    <span className="text-gray-700">{day}</span>
                    <span className="text-gray-900">{times}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Amenities */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Amenities & Features
          </h2>

          {!clinic.accessibility_options &&
          !clinic.payment_options &&
          !clinic.parking_options ? (
            <p className="text-gray-500 italic">
              No amenity information available for this clinic.
            </p>
          ) : (
            <div className="space-y-6">
              {clinic.accessibility_options && (
                <AmenitiesSection
                  title="♿ Accessibility"
                  options={[
                    {
                      key: 'wheelchair_accessible_entrance',
                      label: 'Wheelchair Accessible Entrance',
                      value: clinic.accessibility_options.wheelchair_accessible_entrance,
                    },
                    {
                      key: 'wheelchair_accessible_parking',
                      label: 'Wheelchair Accessible Parking',
                      value: clinic.accessibility_options.wheelchair_accessible_parking,
                    },
                    {
                      key: 'wheelchair_accessible_restroom',
                      label: 'Wheelchair Accessible Restroom',
                      value: clinic.accessibility_options.wheelchair_accessible_restroom,
                    },
                    {
                      key: 'wheelchair_accessible_seating',
                      label: 'Wheelchair Accessible Seating',
                      value: (clinic as any).accessibility_options
                        ?.wheelchair_accessible_seating,
                    },
                  ]}
                />
              )}

              {clinic.payment_options && (
                <AmenitiesSection
                  title="💳 Payment Methods"
                  options={[
                    {
                      key: 'accepts_credit_cards',
                      label: 'Credit Cards',
                      value: clinic.payment_options.accepts_credit_cards,
                    },
                    {
                      key: 'accepts_debit_cards',
                      label: 'Debit Cards',
                      value: (clinic as any).payment_options?.accepts_debit_cards,
                    },
                    {
                      key: 'accepts_cash_only',
                      label: 'Cash Only',
                      value: clinic.payment_options.accepts_cash_only,
                    },
                    {
                      key: 'accepts_nfc',
                      label: 'NFC/Contactless',
                      value: (clinic as any).payment_options?.accepts_nfc,
                    },
                  ]}
                />
              )}

              {clinic.parking_options && (
                <AmenitiesSection
                  title="🅿️ Parking"
                  options={[
                    {
                      key: 'free_parking_lot',
                      label: 'Free Parking Lot',
                      value: clinic.parking_options.free_parking_lot,
                    },
                    {
                      key: 'paid_parking_lot',
                      label: 'Paid Parking Lot',
                      value: clinic.parking_options.paid_parking_lot,
                    },
                    {
                      key: 'free_street_parking',
                      label: 'Free Street Parking',
                      value: (clinic as any).parking_options?.free_street_parking,
                    },
                    {
                      key: 'paid_street_parking',
                      label: 'Paid Street Parking',
                      value: (clinic as any).parking_options?.paid_street_parking,
                    },
                    {
                      key: 'valet_parking',
                      label: 'Valet Parking',
                      value: (clinic as any).parking_options?.valet_parking,
                    },
                    {
                      key: 'free_garage_parking',
                      label: 'Free Garage Parking',
                      value: (clinic as any).parking_options?.free_garage_parking,
                    },
                    {
                      key: 'paid_garage_parking',
                      label: 'Paid Garage Parking',
                      value: (clinic as any).parking_options?.paid_garage_parking,
                    },
                  ]}
                />
              )}
            </div>
          )}
        </div>

        {/* Google Maps Link */}
        {clinic.google_maps_uri && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <a
              href={clinic.google_maps_uri}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
              <span className="mr-2">📍</span>
              View on Google Maps
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

interface AmenitiesSectionProps {
  title: string;
  options: Array<{
    key: string;
    label: string;
    value: boolean | undefined;
  }>;
}

function AmenitiesSection({ title, options }: AmenitiesSectionProps) {
  const available = options.filter((o) => o.value === true);
  if (available.length === 0) return null;

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-3">{title}</h3>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {available.map((o) => (
          <li
            key={o.key}
            className="flex items-center text-gray-700 bg-gray-50 rounded-lg px-4 py-2"
          >
            <span className="text-green-600 mr-2">✓</span>
            <span>{o.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
