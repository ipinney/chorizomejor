/**
 * CHORIZO MEJOR - Houston Taco Spot Seed Data
 *
 * 70+ real Houston taco spots across 18 neighborhoods.
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
  // === EAST END ===
  { name: "Villa Arcos", address: "3009 Navigation Blvd, Houston, TX 77003", neighborhood: "east-end", type: "restaurant", lat: 29.7557, lng: -95.3395 },
  { name: "Laredo Taqueria (Navigation)", address: "915 Snover St, Houston, TX 77007", neighborhood: "east-end", type: "restaurant", lat: 29.7700, lng: -95.4050 },
  { name: "La Macro", address: "7327 Harrisburg Blvd, Houston, TX 77011", neighborhood: "east-end", type: "restaurant", lat: 29.7303, lng: -95.2975 },
  { name: "The Original Ninfa's on Navigation", address: "2704 Navigation Blvd, Houston, TX 77003", neighborhood: "east-end", type: "restaurant", lat: 29.7569, lng: -95.3425 },
  { name: "El Charro", address: "3801 Harrisburg Blvd, Houston, TX 77003", neighborhood: "east-end", type: "restaurant", lat: 29.7467, lng: -95.3379 },
  { name: "Cochinita & Co", address: "5420 Lawndale St #500, Houston, TX 77023", neighborhood: "east-end", type: "restaurant", lat: 29.7368, lng: -95.3218 },
  { name: "Tacos La Sultana", address: "7011 Capitol St, Houston, TX 77011", neighborhood: "east-end", type: "truck", lat: 29.7346, lng: -95.3023 },
  { name: "Taconmadre", address: "610 Crown St, Houston, TX 77020", neighborhood: "east-end", type: "truck", lat: 29.7784, lng: -95.2935 },
  { name: "Gerardo's Drive-In", address: "4702 Telephone Rd, Houston, TX 77087", neighborhood: "east-end", type: "restaurant", lat: 29.7130, lng: -95.3296 },

  // === EADO ===
  { name: "Taqueria Los Munecos", address: "2711 Harrisburg Blvd, Houston, TX 77003", neighborhood: "eado", type: "restaurant", lat: 29.7455, lng: -95.3447 },
  { name: "Asados Don Pancho", address: "2500 Navigation Blvd, Houston, TX 77003", neighborhood: "eado", type: "truck", lat: 29.7544, lng: -95.3510 },
  { name: "Emma's Kitchen", address: "2117 Chenevert St Suite M, Houston, TX 77003", neighborhood: "eado", type: "restaurant", lat: 29.7439, lng: -95.3646 },
  { name: "El Taco Rico Aracely", address: "2117 Chenevert St, Houston, TX 77003", neighborhood: "eado", type: "truck", lat: 29.7458, lng: -95.3578 },
  { name: "Tacos Eliza", address: "902 St Emanuel St, Houston, TX 77003", neighborhood: "eado", type: "truck", lat: 29.7521, lng: -95.3552 },

  // === THE HEIGHTS ===
  { name: "Tacos Tierra Caliente (Heights)", address: "1100 N Shepherd Dr, Houston, TX 77008", neighborhood: "heights", type: "truck", lat: 29.7864, lng: -95.4104 },
  { name: "Tlahuac Taqueria", address: "1402 N Shepherd Dr, Houston, TX 77008", neighborhood: "heights", type: "restaurant", lat: 29.7917, lng: -95.4107 },
  { name: "Tacos La Bala", address: "1920 Silver St, Houston, TX 77007", neighborhood: "heights", type: "truck", lat: 29.7748, lng: -95.3970 },
  { name: "El Ultimo Taco Truck", address: "1302 N Shepherd Dr, Houston, TX 77008", neighborhood: "heights", type: "truck", lat: 29.7903, lng: -95.4104 },
  { name: "Tacos A Go Go (Heights)", address: "2912 White Oak Dr, Houston, TX 77007", neighborhood: "heights", type: "restaurant", lat: 29.7740, lng: -95.3960 },
  { name: "Chilosos Taco House", address: "701 E 20th St, Houston, TX 77008", neighborhood: "heights", type: "restaurant", lat: 29.8044, lng: -95.3909 },
  { name: "La Cocina de TJ (Birria y Mas)", address: "2025 N Durham Dr, Houston, TX 77008", neighborhood: "heights", type: "restaurant", lat: 29.8045, lng: -95.4126 },
  { name: "The Taco Stand", address: "2018 N Shepherd Dr, Houston, TX 77008", neighborhood: "heights", type: "restaurant", lat: 29.8046, lng: -95.4099 },
  { name: "La Chingada Tacos & Tequila", address: "2533 Ella Blvd, Houston, TX 77008", neighborhood: "heights", type: "restaurant", lat: 29.8050, lng: -95.4190 },
  { name: "Ema", address: "1919 N Shepherd Dr, Houston, TX 77008", neighborhood: "heights", type: "bakery", lat: 29.8030, lng: -95.4102 },
  { name: "Dichos Taqueria", address: "3318 Ella Blvd, Houston, TX 77018", neighborhood: "heights", type: "truck", lat: 29.8141, lng: -95.4191 },

  // === MONTROSE ===
  { name: "Laredo Taqueria (Montrose)", address: "1606 Montrose Blvd, Houston, TX 77006", neighborhood: "montrose", type: "restaurant", lat: 29.7469, lng: -95.3935 },
  { name: "Tacos Tierra Caliente", address: "2003 W Alabama St, Houston, TX 77098", neighborhood: "montrose", type: "truck", lat: 29.7385, lng: -95.4082 },
  { name: "El Rey Taqueria", address: "910 Shepherd Dr, Houston, TX 77007", neighborhood: "montrose", type: "restaurant", lat: 29.7703, lng: -95.4093 },
  { name: "Tio Trompo", address: "316 Shepherd Dr, Houston, TX 77007", neighborhood: "montrose", type: "restaurant", lat: 29.7658, lng: -95.4091 },
  { name: "La Guadalupana Bakery & Cafe", address: "2109 Dunlavy St, Houston, TX 77006", neighborhood: "montrose", type: "bakery", lat: 29.7498, lng: -95.4022 },
  { name: "Cielito Cafe", address: "1915 Dunlavy St, Houston, TX 77006", neighborhood: "montrose", type: "restaurant", lat: 29.7485, lng: -95.4020 },
  { name: "The Pit Room", address: "1201 Richmond Ave, Houston, TX 77006", neighborhood: "montrose", type: "restaurant", lat: 29.7370, lng: -95.3897 },
  { name: "La Mexicana Restaurant", address: "1018 Fairview St, Houston, TX 77006", neighborhood: "montrose", type: "restaurant", lat: 29.7475, lng: -95.3888 },
  { name: "Tacos Laguna", address: "301 W Alabama St, Houston, TX 77006", neighborhood: "montrose", type: "truck", lat: 29.7387, lng: -95.3838 },
  { name: "Delicias Maya", address: "4720 Montrose Blvd, Houston, TX 77006", neighborhood: "montrose", type: "truck", lat: 29.7349, lng: -95.3925 },

  // === MIDTOWN ===
  { name: "Tacos A Go Go (Midtown)", address: "3704 Main St, Houston, TX 77002", neighborhood: "midtown", type: "restaurant", lat: 29.7384, lng: -95.3799 },
  { name: "Velvet Taco", address: "2407 Main St, Houston, TX 77002", neighborhood: "midtown", type: "restaurant", lat: 29.7450, lng: -95.3822 },
  { name: "La Calle Tacos (Midtown)", address: "401 Gray St, Houston, TX 77002", neighborhood: "midtown", type: "restaurant", lat: 29.7519, lng: -95.3764 },
  { name: "Luna y Sol", address: "2808 Milam St, Houston, TX 77006", neighborhood: "midtown", type: "restaurant", lat: 29.7411, lng: -95.3810 },

  // === DOWNTOWN ===
  { name: "Taco Fuego", address: "401 Franklin St Suite 1260, Houston, TX 77201", neighborhood: "downtown", type: "restaurant", lat: 29.7662, lng: -95.3649 },
  { name: "La Calle Tacos (Downtown)", address: "909 Franklin St, Houston, TX 77002", neighborhood: "downtown", type: "restaurant", lat: 29.7635, lng: -95.3607 },
  { name: "Space City Birria", address: "415 Milam St, Houston, TX 77002", neighborhood: "downtown", type: "restaurant", lat: 29.7619, lng: -95.3634 },
  { name: "La Taquiza Street Tacos", address: "800 Capitol St, Houston, TX 77002", neighborhood: "downtown", type: "restaurant", lat: 29.7595, lng: -95.3650 },
  { name: "Papalo Taqueria", address: "910 Louisiana St M140, Houston, TX 77002", neighborhood: "downtown", type: "restaurant", lat: 29.7564, lng: -95.3642 },
  { name: "Lone Star Taco Co.", address: "1001 Texas St Suite 100, Houston, TX 77002", neighborhood: "downtown", type: "restaurant", lat: 29.7575, lng: -95.3623 },

  // === WASHINGTON AVE ===
  { name: "Tacos A Go Go (Washington)", address: "3704 Washington Ave, Houston, TX 77007", neighborhood: "washington-ave", type: "restaurant", lat: 29.7712, lng: -95.4094 },
  { name: "Tacodeli", address: "1902 Washington Ave Suite D, Houston, TX 77007", neighborhood: "washington-ave", type: "restaurant", lat: 29.7679, lng: -95.3774 },
  { name: "El Tiempo Taqueria", address: "5526 Washington Ave, Houston, TX 77007", neighborhood: "washington-ave", type: "restaurant", lat: 29.7732, lng: -95.4275 },

  // === NORTHSIDE ===
  { name: "El Taconazo", address: "4003 Fulton St, Houston, TX 77009", neighborhood: "northside", type: "truck", lat: 29.7962, lng: -95.3673 },
  { name: "Teotihuacan Mexican Cafe", address: "1511 Airline Dr, Houston, TX 77009", neighborhood: "northside", type: "restaurant", lat: 29.7989, lng: -95.3822 },
  { name: "Puebla's Mexican Kitchen", address: "6320 N Main St, Houston, TX 77009", neighborhood: "northside", type: "restaurant", lat: 29.8080, lng: -95.3892 },
  { name: "Azteca Taco House", address: "3801 Hopper Rd Suite B, Houston, TX 77037", neighborhood: "northside", type: "restaurant", lat: 29.8765, lng: -95.3812 },
  { name: "Taqueria Don Tin", address: "311 Patton St, Houston, TX 77009", neighborhood: "northside", type: "restaurant", lat: 29.7963, lng: -95.3710 },

  // === THIRD WARD ===
  { name: "Brothers Taco House", address: "1604 Emancipation Ave, Houston, TX 77003", neighborhood: "third-ward", type: "restaurant", lat: 29.7452, lng: -95.3569 },
  { name: "The Birria Queen", address: "4302 Almeda Rd, Houston, TX 77004", neighborhood: "third-ward", type: "truck", lat: 29.7310, lng: -95.3764 },

  // === RIVER OAKS ===
  { name: "Maximo", address: "6119 Edloe St, Houston, TX 77005", neighborhood: "river-oaks", type: "restaurant", lat: 29.7241, lng: -95.4232 },
  { name: "Mexican Sugar", address: "3505 W Dallas St, Houston, TX 77019", neighborhood: "river-oaks", type: "restaurant", lat: 29.7569, lng: -95.4034 },

  // === GALLERIA ===
  { name: "Taqueria Tepatitlan", address: "5545 Southwest Fwy, Houston, TX 77056", neighborhood: "galleria", type: "restaurant", lat: 29.7252, lng: -95.4754 },
  { name: "La Tapatia (Richmond)", address: "5591 Richmond Ave, Houston, TX 77056", neighborhood: "galleria", type: "restaurant", lat: 29.7309, lng: -95.4763 },

  // === SPRING BRANCH ===
  { name: "Tacos Dona Lena", address: "7725 Long Point Rd, Houston, TX 77055", neighborhood: "spring-branch", type: "truck", lat: 29.8069, lng: -95.5015 },
  { name: "Taqueria Laredo", address: "6606 Long Point Rd, Houston, TX 77055", neighborhood: "spring-branch", type: "restaurant", lat: 29.8027, lng: -95.4883 },
  { name: "Tacos El Gordo", address: "7720 Long Point Rd, Houston, TX 77055", neighborhood: "spring-branch", type: "truck", lat: 29.8069, lng: -95.5024 },
  { name: "Pupusas & Tacos Dona Maria", address: "8220 Long Point Rd, Houston, TX 77055", neighborhood: "spring-branch", type: "restaurant", lat: 29.8090, lng: -95.5105 },

  // === BELLAIRE ===
  { name: "Taqueria Cancun", address: "6550 Renwick Dr, Houston, TX 77081", neighborhood: "bellaire", type: "restaurant", lat: 29.7065, lng: -95.4956 },

  // === PASADENA ===
  { name: "Taqueria Arandas", address: "1002 Southmore Ave, Pasadena, TX 77502", neighborhood: "pasadena", type: "restaurant", lat: 29.6911, lng: -95.2091 },
  { name: "Mi Pueblito", address: "1423 Spencer Hwy, South Houston, TX 77587", neighborhood: "pasadena", type: "restaurant", lat: 29.6598, lng: -95.2310 },
  { name: "Taqueria Del Sol", address: "9521 Cullen Blvd, Houston, TX 77051", neighborhood: "pasadena", type: "restaurant", lat: 29.6626, lng: -95.3448 },

  // === KATY ===
  { name: "Taqueria El Nopalito", address: "5901 S Mason Rd, Katy, TX 77450", neighborhood: "katy", type: "restaurant", lat: 29.7338, lng: -95.7295 },
  { name: "La Tapatia Taqueria", address: "614 S Mason Rd, Katy, TX 77450", neighborhood: "katy", type: "restaurant", lat: 29.7755, lng: -95.7294 },

  // === SUGAR LAND ===
  { name: "Torchy's Tacos (Sugar Land)", address: "16535 Southwest Fwy, Sugar Land, TX 77479", neighborhood: "sugar-land", type: "restaurant", lat: 29.5977, lng: -95.6198 },

  // === SPRING ===
  { name: "Sunrise Taquitos", address: "710 Rayford Rd, Spring, TX 77386", neighborhood: "spring", type: "restaurant", lat: 30.0837, lng: -95.4110 },
];

/**
 * Seed all places into Firestore.
 * Call this from the browser console while signed in.
 */
async function seedAllPlaces() {
  const placesRef = db.collection('places');

  console.log(`Seeding ${HOUSTON_TACO_SPOTS.length} taco spots...`);

  let count = 0;
  let skipped = 0;
  for (const spot of HOUSTON_TACO_SPOTS) {
    try {
      // Check if place already exists by name
      const existing = await placesRef.where('name', '==', spot.name).limit(1).get();
      if (!existing.empty) {
        console.log(`⏭️  Skipping "${spot.name}" (already exists)`);
        skipped++;
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
      console.log(`🌮 Added "${spot.name}" (${count} added, ${skipped} skipped)`);
    } catch (err) {
      console.error(`❌ Failed to add "${spot.name}":`, err.message);
    }
  }

  console.log(`\n✅ Done! Added ${count} new spots, skipped ${skipped} existing.`);
  console.log('Reload the Explore page to see them.');
}

// If running in browser, make it available globally
if (typeof window !== 'undefined') {
  window.seedAllPlaces = seedAllPlaces;
  window.HOUSTON_TACO_SPOTS = HOUSTON_TACO_SPOTS;
  console.log(`🌮 Seed data loaded! ${HOUSTON_TACO_SPOTS.length} spots ready. Run seedAllPlaces() to populate Firestore.`);
}
