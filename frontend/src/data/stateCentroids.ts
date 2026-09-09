/**
 * Functional (latitude, longitude) centroids per state/UT.
 * Mirrors STATE_CENTROIDS in backend mock_data.py so the frontend's offline
 * fallback markers sit on the same coordinates as `/api/projects?map=true`.
 * Coordinates are display-only (for project pinning), never used for routing.
 */
export const stateCentroids: Record<string, [number, number]> = {
  'Andaman & Nicobar': [11.7401, 92.6586],
  'Andhra Pradesh': [15.9129, 79.74],
  'Arunachal Pradesh': [28.218, 94.7278],
  Assam: [26.2006, 92.9376],
  Bihar: [25.0961, 85.3131],
  Chandigarh: [30.7333, 76.7794],
  Chhattisgarh: [21.2787, 81.8661],
  'Dadra & Nagar Haveli': [20.1809, 73.0169],
  Delhi: [28.6139, 77.209],
  Gujarat: [22.2587, 71.1924],
  Goa: [15.2993, 74.124],
  Haryana: [29.0588, 76.0856],
  'Himachal Pradesh': [31.1048, 77.1734],
  'Jammu & Kashmir': [33.7782, 76.5762],
  Jharkhand: [23.6102, 85.2799],
  Karnataka: [15.3173, 75.7139],
  Kerala: [10.8505, 76.2711],
  Lakshadweep: [10.5667, 72.6417],
  'Madhya Pradesh': [22.9734, 78.6569],
  Maharashtra: [19.7515, 75.7139],
  Manipur: [24.6637, 93.9063],
  Meghalaya: [25.467, 91.3662],
  Mizoram: [23.1645, 92.9376],
  Nagaland: [26.1584, 94.5624],
  Odisha: [20.9517, 85.0985],
  Puducherry: [11.9416, 79.8083],
  Punjab: [31.1471, 75.3412],
  Rajasthan: [27.0238, 74.2179],
  Sikkim: [27.533, 88.5122],
  'Tamil Nadu': [11.1271, 78.6569],
  Telangana: [18.1124, 79.0193],
  Tripura: [23.9408, 91.9882],
  'Uttar Pradesh': [26.8467, 80.9462],
  Uttarakhand: [30.0668, 79.0193],
  'West Bengal': [22.9868, 87.855],
}