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
  { name: "Gerardo's Drive-In", address: "609 Patton St, Houston, TX 77009", neighborhood: "northside", type: "restaurant", lat: 29.7960, lng: -95.3710 },

  // === EADO ===
  { name: "Taqueria Los Munecos", address: "2711 Harrisburg Blvd, Houston, TX 77003", neighborhood: "eado", type: "restaurant", lat: 29.7455, lng: -95.3447 },
  { name: "Asados Don Pancho", address: "2500 Navigation Blvd, Houston, TX 77003", neighborhood: "eado", type: "truck", lat: 29.7544, lng: -95.3510 },
  { name: "Emma's Kitchen", address: "2117 Chenevert St Suite M, Houston, TX 77003", neighborhood: "eado", type: "restaurant", lat: 29.7439, lng: -95.3646 },
  { name: "El Taco Rico Aracely", address: "1607 Hutchins St, Houston, TX 77003", neighborhood: "eado", type: "truck", lat: 29.7450, lng: -95.3570 },
  { name: "Tacos Eliza", address: "902 St Emanuel St, Houston, TX 77003", neighborhood: "eado", type: "truck", lat: 29.7521, lng: -95.3552 },

  // === THE HEIGHTS ===
  { name: "Tacos Tierra Caliente (Heights)", address: "1100 N Shepherd Dr, Houston, TX 77008", neighborhood: "heights", type: "truck", lat: 29.7864, lng: -95.4104 },
  { name: "Tlahuac Taqueria", address: "1402 N Shepherd Dr, Houston, TX 77008", neighborhood: "heights", type: "restaurant", lat: 29.7917, lng: -95.4107 },
  { name: "Tacos La Bala", address: "5800 Bellaire Blvd, Houston, TX 77081", neighborhood: "bellaire", type: "restaurant", lat: 29.7060, lng: -95.4895 },
  { name: "El Ultimo Taco Truck", address: "7645 Long Point Rd, Houston, TX 77055 (mobile)", neighborhood: "spring-branch", type: "truck", lat: 29.8065, lng: -95.5000 },
  { name: "Tacos A Go Go (Heights)", address: "2912 White Oak Dr, Houston, TX 77007", neighborhood: "heights", type: "restaurant", lat: 29.7740, lng: -95.3960 },
  { name: "Chilosos Taco House", address: "701 E 20th St, Houston, TX 77008", neighborhood: "heights", type: "restaurant", lat: 29.8044, lng: -95.3909 },
  { name: "La Cocina de TJ (Birria y Mas)", address: "2025 N Durham Dr, Houston, TX 77008", neighborhood: "heights", type: "restaurant", lat: 29.8045, lng: -95.4126 },
  { name: "The Taco Stand", address: "2018 N Shepherd Dr, Houston, TX 77008", neighborhood: "heights", type: "restaurant", lat: 29.8046, lng: -95.4099 },
  { name: "La Chingada Tacos & Tequila", address: "1402 Northwood St, Houston, TX 77009", neighborhood: "heights", type: "restaurant", lat: 29.8015, lng: -95.3895 },
  { name: "Ema", address: "5307 N Main St Suite 100, Houston, TX 77009", neighborhood: "northside", type: "bakery", lat: 29.8105, lng: -95.3892 },
  { name: "Dichos Taqueria", address: "614 S Wayside Dr, Suite 101, Houston, TX 77011", neighborhood: "east-end", type: "restaurant", lat: 29.7470, lng: -95.3135 },

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
  { name: "Delicias Maya", address: "729 Studewood St, Houston, TX 77007", neighborhood: "heights", type: "truck", lat: 29.7738, lng: -95.3998 },

  // === MIDTOWN ===
  { name: "Tacos A Go Go (Midtown)", address: "3704 Main St, Houston, TX 77002", neighborhood: "midtown", type: "restaurant", lat: 29.7384, lng: -95.3799 },
  { name: "Velvet Taco", address: "907 Westheimer Rd, Houston, TX 77006", neighborhood: "montrose", type: "restaurant", lat: 29.7431, lng: -95.3882 },
  { name: "La Calle Tacos (Midtown)", address: "401 Gray St, Houston, TX 77002", neighborhood: "midtown", type: "restaurant", lat: 29.7519, lng: -95.3764 },
  { name: "Luna y Sol", address: "2808 Milam St, Houston, TX 77006", neighborhood: "midtown", type: "restaurant", lat: 29.7411, lng: -95.3810 },

  // === DOWNTOWN ===
  { name: "Taco Fuego", address: "401 Franklin St Suite 1260, Houston, TX 77201", neighborhood: "downtown", type: "restaurant", lat: 29.7662, lng: -95.3649 },
  { name: "La Calle Tacos (Downtown)", address: "909 Franklin St, Houston, TX 77002", neighborhood: "downtown", type: "restaurant", lat: 29.7635, lng: -95.3607 },
  { name: "Space City Birria", address: "415 Milam St, Houston, TX 77002", neighborhood: "downtown", type: "restaurant", lat: 29.7619, lng: -95.3634 },
  { name: "La Taquiza Street Tacos", address: "800 Capitol St, Houston, TX 77002", neighborhood: "downtown", type: "restaurant", lat: 29.7595, lng: -95.3650 },
  { name: "Papalo Taqueria", address: "712 Main St, Houston, TX 77002", neighborhood: "downtown", type: "restaurant", lat: 29.7564, lng: -95.3642 },
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
  { name: "Tacos Dona Lena", address: "8788 Hammerly Blvd, Houston, TX 77080", neighborhood: "spring-branch", type: "restaurant", lat: 29.7927, lng: -95.5130 },
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
  { name: "Torchy's Tacos (Sugar Land)", address: "15810 Southwest Fwy Ste 600, Sugar Land, TX 77478", neighborhood: "sugar-land", type: "restaurant", lat: 29.5977, lng: -95.6198 },

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

// ===================== PLACE LINKS DATA =====================
// External links, phone numbers, etc. for place detail pages.
// Run updatePlaceLinks() from the browser console to write to Firestore.

const PLACE_LINKS = {
  "Villa Arcos": {
    yelpURL: "https://www.yelp.com/biz/villa-arcos-houston",
    googleMapsURL: "https://www.google.com/maps/search/Villa+Arcos+Houston+TX",
    websiteURL: "https://originalvillaarcos.com/",
    phone: "832-426-4766"
  },
  "Laredo Taqueria (Navigation)": {
    yelpURL: "https://www.yelp.com/biz/laredo-taqueria-houston-2",
    googleMapsURL: "https://www.google.com/maps/search/Laredo+Taqueria+Navigation+Houston+TX",
    websiteURL: "https://www.laredotaqueria.com/",
    phone: "713-861-7279"
  },
  "Laredo Taqueria (Montrose)": {
    yelpURL: "https://www.yelp.com/biz/laredo-taqueria-houston-2",
    googleMapsURL: "https://www.google.com/maps/search/Laredo+Taqueria+Montrose+Houston+TX",
    websiteURL: "https://www.laredotaqueria.com/",
    phone: "713-861-7279"
  },
  "The Original Ninfa's on Navigation": {
    yelpURL: "https://www.yelp.com/biz/the-original-ninfas-on-navigation-houston-3",
    googleMapsURL: "https://www.google.com/maps/search/Original+Ninfas+on+Navigation+Houston+TX",
    websiteURL: "https://ninfas.com/",
    phone: "713-228-1175"
  },
  "Brothers Taco House": {
    yelpURL: "https://www.yelp.com/biz/brothers-taco-house-houston",
    googleMapsURL: "https://www.google.com/maps/search/Brothers+Taco+House+Houston+TX",
    phone: "713-223-0091"
  },
  "Tacos A Go Go (Midtown)": {
    yelpURL: "https://www.yelp.com/biz/tacos-a-go-go-midtown-houston-2",
    googleMapsURL: "https://www.google.com/maps/search/Tacos+A+Go+Go+Midtown+Houston+TX",
    websiteURL: "https://www.tacosagogo.com/",
    phone: "713-807-8226"
  },
  "Tacos A Go Go (Heights)": {
    yelpURL: "https://www.yelp.com/biz/tacos-a-go-go-houston",
    googleMapsURL: "https://www.google.com/maps/search/Tacos+A+Go+Go+Heights+Houston+TX",
    websiteURL: "https://www.tacosagogo.com/",
    phone: "713-807-8226"
  },
  "Tacos A Go Go (Washington)": {
    yelpURL: "https://www.yelp.com/biz/tacos-a-go-go-houston-4",
    googleMapsURL: "https://www.google.com/maps/search/Tacos+A+Go+Go+Washington+Houston+TX",
    websiteURL: "https://www.tacosagogo.com/"
  },
  "Torchy's Tacos (Sugar Land)": {
    yelpURL: "https://www.yelp.com/biz/torchys-tacos-houston",
    googleMapsURL: "https://www.google.com/maps/search/Torchys+Tacos+Sugar+Land+TX",
    websiteURL: "https://torchystacos.com/",
    phone: "713-595-8226"
  },
  "Velvet Taco": {
    yelpURL: "https://www.yelp.com/biz/velvet-taco-washington-ave-houston",
    googleMapsURL: "https://www.google.com/maps/search/Velvet+Taco+Houston+TX",
    websiteURL: "https://www.velvettaco.com/",
    phone: "832-834-5908"
  },
  "El Tiempo Taqueria": {
    yelpURL: "https://www.yelp.com/biz/el-tiempo-taqueria-houston",
    googleMapsURL: "https://www.google.com/maps/search/El+Tiempo+Taqueria+Houston+TX",
    websiteURL: "https://www.eltiempotaqueria.com/",
    phone: "713-862-7792"
  },
  "Tacos Tierra Caliente": {
    yelpURL: "https://www.yelp.com/biz/tacos-tierra-caliente-houston",
    googleMapsURL: "https://www.google.com/maps/search/Tacos+Tierra+Caliente+Houston+TX",
    websiteURL: "https://www.tacostierracalientemx.com/",
    phone: "713-584-9359"
  },
  "Tacos Tierra Caliente (Heights)": {
    yelpURL: "https://www.yelp.com/biz/tacos-tierra-caliente-houston",
    googleMapsURL: "https://www.google.com/maps/search/Tacos+Tierra+Caliente+Heights+Houston+TX",
    websiteURL: "https://www.tacostierracalientemx.com/"
  },
  "Taqueria Arandas": {
    yelpURL: "https://www.yelp.com/biz/taquerias-arandas-houston-13",
    googleMapsURL: "https://www.google.com/maps/search/Taqueria+Arandas+Houston+TX",
    websiteURL: "https://www.taqueriasarandas.com/",
    phone: "713-432-0212"
  },
  "El Taconazo": {
    yelpURL: "https://www.yelp.com/biz/el-taconazo-houston-5",
    googleMapsURL: "https://www.google.com/maps/search/El+Taconazo+Houston+TX",
    websiteURL: "https://eltaconazo.shop/",
    phone: "832-989-4472"
  },
  "Sunrise Taquitos": {
    yelpURL: "https://www.yelp.com/biz/sunrise-taquitos-mexican-grill-houston",
    googleMapsURL: "https://www.google.com/maps/search/Sunrise+Taquitos+Houston+TX",
    websiteURL: "https://sunrisetaquitostx.com/",
    phone: "713-880-5959"
  },
  "La Guadalupana Bakery & Cafe": {
    yelpURL: "https://www.yelp.com/biz/la-guadalupana-bakery-and-caf%C3%A9-houston-3",
    googleMapsURL: "https://www.google.com/maps/search/La+Guadalupana+Bakery+Cafe+Houston+TX",
    websiteURL: "https://www.laguadalupanacafeandbakery.com/",
    phone: "713-522-2301"
  },
  "The Pit Room": {
    yelpURL: "https://www.yelp.com/biz/the-pit-room-houston",
    googleMapsURL: "https://www.google.com/maps/search/The+Pit+Room+Houston+TX",
    websiteURL: "https://thepitroombbq.com/",
    phone: "281-888-1929"
  },
  "Teotihuacan Mexican Cafe": {
    yelpURL: "https://www.yelp.com/biz/teotihuacan-mexican-cafe-houston-4",
    googleMapsURL: "https://www.google.com/maps/search/Teotihuacan+Mexican+Cafe+Houston+TX",
    websiteURL: "https://teomexicancafe.com/",
    phone: "713-426-4420"
  },
  "Chilosos Taco House": {
    yelpURL: "https://www.yelp.com/biz/chilosos-taco-house-houston",
    googleMapsURL: "https://www.google.com/maps/search/Chilosos+Taco+House+Houston+TX"
  },
  "El Rey Taqueria": {
    yelpURL: "https://www.yelp.com/biz/el-rey-taqueria-houston-3",
    googleMapsURL: "https://www.google.com/maps/search/El+Rey+Taqueria+Houston+TX"
  },
  "La Calle Tacos (Midtown)": {
    yelpURL: "https://www.yelp.com/biz/la-calle-tacos-houston",
    googleMapsURL: "https://www.google.com/maps/search/La+Calle+Tacos+Midtown+Houston+TX",
    websiteURL: "https://www.lacalletacos.com/"
  },
  "La Calle Tacos (Downtown)": {
    yelpURL: "https://www.yelp.com/biz/la-calle-tacos-houston",
    googleMapsURL: "https://www.google.com/maps/search/La+Calle+Tacos+Downtown+Houston+TX",
    websiteURL: "https://www.lacalletacos.com/"
  },
  "Tio Trompo": {
    yelpURL: "https://www.yelp.com/biz/tio-trompo-houston",
    googleMapsURL: "https://www.google.com/maps/search/Tio+Trompo+Houston+TX"
  },
  "Cochinita & Co": {
    yelpURL: "https://www.yelp.com/biz/cochinita-and-co-houston",
    googleMapsURL: "https://www.google.com/maps/search/Cochinita+Co+Houston+TX"
  }
};

/**
 * Update existing Firestore place documents with external link data.
 * Looks up places by name and batch-updates with fields from PLACE_LINKS.
 *
 * Run from browser console:
 *   1. Open chorizomejor.com and sign in
 *   2. Paste seed-data.js in console
 *   3. Call: updatePlaceLinks()
 */
async function updatePlaceLinks() {
  const db = firebase.firestore();
  let updated = 0;
  let notFound = 0;

  for (const [name, data] of Object.entries(PLACE_LINKS)) {
    try {
      const snap = await db.collection('places')
        .where('name', '==', name)
        .limit(1)
        .get();

      if (snap.empty) {
        console.warn(`⚠️ "${name}" not found in Firestore, skipping`);
        notFound++;
        continue;
      }

      const docRef = snap.docs[0].ref;
      await docRef.update(data);
      updated++;
      console.log(`✅ Updated "${name}" with ${Object.keys(data).length} fields`);
    } catch (err) {
      console.error(`❌ Failed to update "${name}":`, err.message);
    }
  }

  console.log(`\n🌮 Done! Updated ${updated} spots, ${notFound} not found.`);
  console.log('Hard-refresh a place detail page to see the new buttons.');
}

// If running in browser, make it available globally
if (typeof window !== 'undefined') {
  window.seedAllPlaces = seedAllPlaces;
  window.HOUSTON_TACO_SPOTS = HOUSTON_TACO_SPOTS;
  window.updatePlaceLinks = updatePlaceLinks;
  window.PLACE_LINKS = PLACE_LINKS;
  console.log(`🌮 Seed data loaded! ${HOUSTON_TACO_SPOTS.length} spots ready. Run seedAllPlaces() to populate Firestore.`);
  console.log(`🔗 Place links loaded! ${Object.keys(PLACE_LINKS).length} spots with external links. Run updatePlaceLinks() to update Firestore.`);
}
