/**
 * CHORIZO MEJOR - Houston Taco Spot Seed Data
 *
 * Run this in the browser console while signed in as an admin,
 * or use it with the Firebase Admin SDK.
 *
 * Browser usage:
 *   1. Open chorizomejor.com and sign in
 *   2. Open browser console (F12)
 *   3. Paste this entire file and press Enter
 *   4. Call: seedAllPlaces()
 */

const HOUSTON_TACO_SPOTS = [
  // === EAST END / EADO ===
  {
    name: "Villa Arcos",
    address: "3002 Navigation Blvd, Houston, TX 77003",
    neighborhood: "east-end",
    type: "restaurant",
    lat: 29.7562,
    lng: -95.3484
  },
  {
    name: "Tacos Tierra Caliente",
    address: "1100 N Shepherd Dr, Houston, TX 77008",
    neighborhood: "heights",
    type: "truck",
    lat: 29.7864,
    lng: -95.4104
  },
  {
    name: "Laredo Taqueria (Navigation)",
    address: "915 Snover St, Houston, TX 77007",
    neighborhood: "east-end",
    type: "restaurant",
    lat: 29.7584,
    lng: -95.3528
  },
  {
    name: "La Macro",
    address: "7327 Harrisburg Blvd, Houston, TX 77011",
    neighborhood: "east-end",
    type: "restaurant",
    lat: 29.7303,
    lng: -95.2975
  },

  // === THE HEIGHTS ===
  {
    name: "Tlahuac Taqueria",
    address: "1402 N Shepherd Dr, Houston, TX 77008",
    neighborhood: "heights",
    type: "restaurant",
    lat: 29.7917,
    lng: -95.4107
  },
  {
    name: "Tacos La Bala",
    address: "1920 Silver St, Houston, TX 77007",
    neighborhood: "heights",
    type: "truck",
    lat: 29.7748,
    lng: -95.3970
  },
  {
    name: "El Ultimo Taco Truck",
    address: "1302 N Shepherd Dr, Houston, TX 77008",
    neighborhood: "heights",
    type: "truck",
    lat: 29.7903,
    lng: -95.4104
  },

  // === MONTROSE ===
  {
    name: "Laredo Taqueria (Montrose)",
    address: "1606 Montrose Blvd, Houston, TX 77006",
    neighborhood: "montrose",
    type: "restaurant",
    lat: 29.7469,
    lng: -95.3935
  },
  {
    name: "Tacos A Go Go (Montrose)",
    address: "3704 Main St, Houston, TX 77002",
    neighborhood: "montrose",
    type: "restaurant",
    lat: 29.7395,
    lng: -95.3822
  },
  {
    name: "El Rey Taqueria",
    address: "910 Shepherd Dr, Houston, TX 77007",
    neighborhood: "montrose",
    type: "restaurant",
    lat: 29.7587,
    lng: -95.4088
  },

  // === MIDTOWN ===
  {
    name: "Velvet Taco",
    address: "2407 Main St, Houston, TX 77002",
    neighborhood: "midtown",
    type: "restaurant",
    lat: 29.7450,
    lng: -95.3822
  },
  {
    name: "Tacodeli",
    address: "1902 Washington Ave, Houston, TX 77007",
    neighborhood: "midtown",
    type: "restaurant",
    lat: 29.7639,
    lng: -95.3890
  },

  // === EADO ===
  {
    name: "Taqueria Los Muñecos",
    address: "2711 Harrisburg Blvd, Houston, TX 77003",
    neighborhood: "eado",
    type: "restaurant",
    lat: 29.7455,
    lng: -95.3447
  },
  {
    name: "Asados Don Pancho",
    address: "2500 Navigation Blvd, Houston, TX 77003",
    neighborhood: "eado",
    type: "truck",
    lat: 29.7544,
    lng: -95.3510
  },

  // === WASHINGTON AVE ===
  {
    name: "Tacos A Go Go (Washington)",
    address: "3704 Washington Ave, Houston, TX 77007",
    neighborhood: "washington-ave",
    type: "restaurant",
    lat: 29.7712,
    lng: -95.4094
  },

  // === SPRING BRANCH ===
  {
    name: "Taqueria Laredo",
    address: "6606 Long Point Rd, Houston, TX 77055",
    neighborhood: "spring-branch",
    type: "restaurant",
    lat: 29.8027,
    lng: -95.4883
  },
  {
    name: "Tacos El Gordo",
    address: "7720 Long Point Rd, Houston, TX 77055",
    neighborhood: "spring-branch",
    type: "truck",
    lat: 29.8069,
    lng: -95.5024
  },
  {
    name: "Pupusas & Tacos Dona Maria",
    address: "8220 Long Point Rd, Houston, TX 77055",
    neighborhood: "spring-branch",
    type: "restaurant",
    lat: 29.8090,
    lng: -95.5105
  },

  // === BELLAIRE ===
  {
    name: "Taqueria Cancun",
    address: "6550 Renwick Dr, Houston, TX 77081",
    neighborhood: "bellaire",
    type: "restaurant",
    lat: 29.7065,
    lng: -95.4956
  },

  // === MEMORIAL ===
  {
    name: "Brothers Taco House",
    address: "1604 Memorial Dr, Houston, TX 77007",
    neighborhood: "memorial",
    type: "restaurant",
    lat: 29.7628,
    lng: -95.3770
  },

  // === PASADENA ===
  {
    name: "Taqueria Arandas",
    address: "1002 Southmore Ave, Pasadena, TX 77502",
    neighborhood: "pasadena",
    type: "restaurant",
    lat: 29.6911,
    lng: -95.2091
  },
  {
    name: "Mi Pueblito",
    address: "1423 Spencer Hwy, South Houston, TX 77587",
    neighborhood: "pasadena",
    type: "restaurant",
    lat: 29.6598,
    lng: -95.2310
  },

  // === KATY ===
  {
    name: "Taqueria El Nopalito",
    address: "5901 S Mason Rd, Katy, TX 77450",
    neighborhood: "katy",
    type: "restaurant",
    lat: 29.7338,
    lng: -95.7295
  },
  {
    name: "La Tapatia Taqueria",
    address: "614 S Mason Rd, Katy, TX 77450",
    neighborhood: "katy",
    type: "restaurant",
    lat: 29.7755,
    lng: -95.7294
  },

  // === SUGAR LAND ===
  {
    name: "Torchy's Tacos (Sugar Land)",
    address: "16535 Southwest Fwy, Sugar Land, TX 77479",
    neighborhood: "sugar-land",
    type: "restaurant",
    lat: 29.5977,
    lng: -95.6198
  }
];

/**
 * Seed all places into Firestore.
 * Call this from the browser console while signed in.
 */
async function seedAllPlaces() {
  const placesRef = db.collection('places');

  console.log(`Seeding ${HOUSTON_TACO_SPOTS.length} taco spots...`);

  let count = 0;
  for (const spot of HOUSTON_TACO_SPOTS) {
    try {
      // Check if place already exists by name
      const existing = await placesRef.where('name', '==', spot.name).limit(1).get();
      if (!existing.empty) {
        console.log(`⏭️ Skipping "${spot.name}" (already exists)`);
        continue;
      }

      await placesRef.add({
        ...spot,
        reviewCount: 0,
        avgOverall: 0,
        avgTortilla: 0,
        avgProtein: 0,
        avgSalsa: 0,
        avgValue: 0,
        waitYesCount: 0,
        topTags: [],
        addedBy: 'seed',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      count++;
      console.log(`🌮 Added "${spot.name}" (${count}/${HOUSTON_TACO_SPOTS.length})`);
    } catch (err) {
      console.error(`❌ Failed to add "${spot.name}":`, err.message);
    }
  }

  console.log(`\n✅ Done! Seeded ${count} taco spots.`);
  console.log('Reload the Explore page to see them.');
}

// If running in browser, make it available globally
if (typeof window !== 'undefined') {
  window.seedAllPlaces = seedAllPlaces;
  window.HOUSTON_TACO_SPOTS = HOUSTON_TACO_SPOTS;
  console.log('🌮 Seed data loaded! Run seedAllPlaces() to populate Firestore.');
}
