// app/clinics/[id]/page.tsx
// export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { createSupabaseClient } from '@/lib/supabase';
import { Clinic } from '@/lib/dataTypes';
import Link from 'next/link';
import ClinicBanner from '@/components/ClinicBanner';
import { notFound } from 'next/navigation';

// ----------------------
// 1. Updated for Next.js 15 - params is now a Promise
interface ClinicPageProps {
  params: Promise<{
    id: string;
  }>;
}
// ----------------------

// Normalize nested options to snake_case so the UI sees the same shape as /api/clinics
function normalizeClinicForUI(raw: any) {
  const accessibility_options = raw?.accessibility_options
    ? {
        wheelchair_accessible_entrance:
          raw.accessibility_options.wheelchair_accessible_entrance ??
          raw.accessibility_options.wheelchairAccessibleEntrance,
        wheelchair_accessible_parking:
          raw.accessibility_options.wheelchair_accessible_parking ??
          raw.accessibility_options.wheelchairAccessibleParking,
        wheelchair_accessible_restroom:
          raw.accessibility_options.wheelchair_accessible_restroom ??
          raw.accessibility_options.wheelchairAccessibleRestroom,
        wheelchair_accessible_seating:
          raw.accessibility_options.wheelchair_accessible_seating ??
          raw.accessibility_options.wheelchairAccessibleSeating,
      }
    : undefined;

  const payment_options = raw?.payment_options
    ? {
        accepts_credit_cards:
          raw.payment_options.accepts_credit_cards ??
          raw.payment_options.acceptsCreditCards,
        accepts_debit_cards:
          raw.payment_options.accepts_debit_cards ??
          raw.payment_options.acceptsDebitCards,
        accepts_cash_only:
          raw.payment_options.accepts_cash_only ??
          raw.payment_options.acceptsCashOnly,
        accepts_nfc:
          raw.payment_options.accepts_nfc ??
          raw.payment_options.acceptsNfc,
      }
    : undefined;

  const parking_options = raw?.parking_options
    ? {
        free_parking_lot:
          raw.parking_options.free_parking_lot ??
          raw.parking_options.freeParkingLot,
        paid_parking_lot:
          raw.parking_options.paid_parking_lot ??
          raw.parking_options.paidParkingLot,
        free_street_parking:
          raw.parking_options.free_street_parking ??
          raw.parking_options.freeStreetParking,
        paid_street_parking:
          raw.parking_options.paid_street_parking ??
          raw.parking_options.paidStreetParking,
        valet_parking:
          raw.parking_options.valet_parking ??
          raw.parking_options.valetParking,
        free_garage_parking:
          raw.parking_options.free_garage_parking ??
          raw.parking_options.freeGarageParking,
        paid_garage_parking:
          raw.parking_options.paid_garage_parking ??
          raw.parking_options.paidGarageParking,
      }
    : undefined;

  return {
    ...raw,
    accessibility_options,
    payment_options,
    parking_options,
  };
}

// Build a neat list of amenity chips to render (icon + label + tone)
function buildAmenityChips(c: any) {
  const chips: Array<{ label: string; icon: string; tone: 'green' | 'blue' | 'amber' }> = [];

  // Accessibility
  if (c?.accessibility_options?.wheelchair_accessible_entrance) {
    chips.push({ label: 'Wheelchair Accessible Entrance', icon: '♿️', tone: 'green' });
  }
  if (c?.accessibility_options?.wheelchair_accessible_parking) {
    chips.push({ label: 'Wheelchair Accessible Parking', icon: '🅿️', tone: 'blue' });
  }
  if (c?.accessibility_options?.wheelchair_accessible_restroom) {
    chips.push({ label: 'Wheelchair Accessible Restroom', icon: '🚻', tone: 'blue' });
  }
  if (c?.accessibility_options?.wheelchair_accessible_seating) {
    chips.push({ label: 'Wheelchair Accessible Seating', icon: '♿️', tone: 'green' });
  }

  // Parking
  if (c?.parking_options?.free_parking_lot) {
    chips.push({ label: 'Free Parking Lot', icon: '🅿️', tone: 'green' });
  }
  if (c?.parking_options?.paid_parking_lot) {
    chips.push({ label: 'Paid Parking Lot', icon: '🅿️', tone: 'amber' });
  }

  // Payments
  if (c?.payment_options?.accepts_credit_cards) {
    chips.push({ label: 'Accepts Credit Cards', icon: '💳', tone: 'green' });
  }
  if (c?.payment_options?.accepts_cash_only) {
    chips.push({ label: 'Cash Only', icon: '💵', tone: 'amber' });
  }

  return chips;
}

function toneClasses(tone: 'green' | 'blue' | 'amber') {
  if (tone === 'green') return 'bg-green-50/70 border-green-100';
  if (tone === 'blue') return 'bg-blue-50/70 border-blue-100';
  return 'bg-amber-50/70 border-amber-100';
}

// Server-side data fetching
async function getClinic(id: string): Promise<Clinic | null> {
  const supabase = createSupabaseClient();

  const { data, error } = await supabase
    .from('clinics')
    .select('*')
    .eq('place_id', id)
    .single();

  if (error || !data) {
    return null;
  }

  return data as Clinic;
}

// ----------------------
// 2. Await the params promise before using
export default async function ClinicDetailPage({ params }: ClinicPageProps) {
  // CRITICAL: Await params in Next.js 15+
  const { id } = await params;

  // Fetch and normalize once (no duplicate declarations)
  const rawClinic = await getClinic(id);
  if (!rawClinic) {
    notFound();
  }
  const clinic = normalizeClinicForUI(rawClinic) as Clinic;

  const amenityChips = buildAmenityChips(clinic);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Lightweight, dependency-free keyframe animations */}
      <style>{`
        @keyframes fadeUp {
          0% { opacity: 0; transform: translateY(6px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .feature-chip {
          opacity: 0;
          animation: fadeUp 420ms ease forwards;
        }
      `}</style>

      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link
            href="/"
            className="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium"
          >
            ← Back to Directory
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Banner Image */}
        <div className="mb-8 rounded-lg overflow-hidden shadow-lg">
          <ClinicBanner
            clinicName={clinic.display_name}
            placeId={clinic.place_id}
            rating={clinic.rating}
            website={clinic.website}
            className="w-full h-64 md:h-80 object-cover"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Title and Status */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">
                    {clinic.display_name}
                  </h1>
                  <p className="text-gray-600">
                    {clinic.primary_type?.replace(/_/g, ' ')}
                  </p>
                </div>

                {clinic.current_open_now !== undefined && (
                  <span
                    className={`px-4 py-2 rounded-lg text-sm font-medium ${
                      clinic.current_open_now
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {clinic.current_open_now ? '● Open Now' : '● Closed'}
                  </span>
                )}
              </div>

              {/* Rating */}
              {clinic.rating && (
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-3xl text-yellow-400">★</span>
                    <span className="text-2xl font-bold text-gray-900">
                      {clinic.rating.toFixed(1)}
                    </span>
                  </div>
                  {clinic.user_rating_count && (
                    <span className="text-gray-600">
                      Based on {clinic.user_rating_count} reviews
                    </span>
                  )}
                </div>
              )}

              {/* Business Status */}
              {clinic.business_status !== 'OPERATIONAL' && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                  <p className="text-yellow-800 font-medium">
                    {clinic.business_status === 'CLOSED_TEMPORARILY'
                      ? '⚠️ This clinic is temporarily closed'
                      : '❌ This clinic is permanently closed'}
                  </p>
                </div>
              )}
            </div>

            {/* Opening Hours */}
            {clinic.opening_hours?.weekday_text && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Opening Hours</h2>
                <div className="space-y-2">
                  {clinic.opening_hours.weekday_text.map((text, index) => (
                    <p key={index} className="text-gray-700">
                      {text}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Features */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Features & Amenities</h2>

              {amenityChips.length === 0 ? (
                <p className="text-gray-600">No amenities listed for this clinic.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {amenityChips.map((chip, i) => (
                    <div
                      key={chip.label}
                      className={`feature-chip flex items-center gap-3 rounded-xl border ${toneClasses(
                        chip.tone
                      )} p-3 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5`}
                      style={{ animationDelay: `${i * 80}ms` }}
                    >
                      <span className="text-xl leading-none">{chip.icon}</span>
                      <span className="text-gray-800">{chip.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Contact Card */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Contact Information</h2>

              {/* Address */}
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-500 mb-2">Address</h3>
                <p className="text-gray-900">{clinic.formatted_address}</p>
              </div>

              {/* Phone */}
              {clinic.phone && (
                <div className="mb-4">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Phone</h3>
                  <a
                    href={`tel:${clinic.phone}`}
                    className="text-blue-600 hover:text-blue-700 font-medium"
                  >
                    {clinic.phone}
                  </a>
                </div>
              )}

              {/* Website */}
              {clinic.website && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Website</h3>
                  <a
                    href={clinic.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-700 font-medium break-all"
                  >
                    Visit Website →
                  </a>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-3">
                {clinic.phone && (
                  <a
                    href={`tel:${clinic.phone}`}
                    className="block w-full text-center px-4 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    📞 Call Now
                  </a>
                )}

                <a
                  href={clinic.google_maps_uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full text-center px-4 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors"
                >
                  📍 Get Directions
                </a>

                {clinic.website && (
                  <a
                    href={clinic.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full text-center px-4 py-3 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    🌐 Visit Website
                  </a>
                )}
              </div>
            </div>

            {/* Map Preview */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-2">Location</h2>
              <p className="text-gray-600 mb-3">View on Google Maps for directions.</p>
              {clinic.google_maps_uri && (
                <a
                  href={clinic.google_maps_uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-4 py-2 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                >
                  Open in Google Maps ↗
                </a>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
