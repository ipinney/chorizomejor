/**
 * CHORIZO MEJOR — Place Data Validation & Fix Script
 *
 * Run this in the browser console while signed in as Ivan.
 * This script:
 *   1. Fixes incorrect addresses (validated against Google/Yelp/websites)
 *   2. Adds social media links (Instagram, Facebook) for food trucks
 *   3. Adds schedule/location URLs where available
 *   4. Flags places that may be closed or unverifiable
 *
 * Usage:
 *   1. Open chorizomejor.com, sign in as Ivan
 *   2. Open browser console (F12)
 *   3. Paste this script
 *   4. Run: fixPlaceData()
 */

const PLACE_FIXES = {
  // ===================================================================
  // ADDRESS CORRECTIONS (validated against Google Maps / Yelp / websites)
  // ===================================================================

  "Gerardo's Drive-In": {
    address: "609 Patton St, Houston, TX 77009",
    lat: 29.7960,
    lng: -95.3710,
    neighborhood: "northside"
  },

  "Papalo Taqueria": {
    address: "712 Main St, Houston, TX 77002"
    // Inside Finn Hall food court downtown
  },

  "La Chingada Tacos & Tequila": {
    address: "1402 Northwood St, Houston, TX 77009",
    lat: 29.8015,
    lng: -95.3895
  },

  "Dichos Taqueria": {
    address: "614 S Wayside Dr, Suite 101, Houston, TX 77011",
    lat: 29.7470,
    lng: -95.3135,
    neighborhood: "east-end",
    type: "restaurant", // Not a truck — fixed brick-and-mortar
    websiteURL: "https://www.dichostaqueriatx.com/",
    instagramURL: "https://www.instagram.com/dichostaqueria/",
    facebookURL: "https://www.facebook.com/dichostaqueria/"
  },

  "Delicias Maya": {
    address: "729 Studewood St, Houston, TX 77007",
    lat: 29.7738,
    lng: -95.3998,
    neighborhood: "heights",
    instagramURL: "https://www.instagram.com/deliciasmaya1/",
    facebookURL: "https://www.facebook.com/Thedeliciasmaya1/"
  },

  "El Taco Rico Aracely": {
    address: "1607 Hutchins St, Houston, TX 77003",
    lat: 29.7450,
    lng: -95.3570,
    facebookURL: "https://www.facebook.com/p/El-Taco-Rico-Aracely-100075969914774/"
  },

  "El Ultimo Taco Truck": {
    // Mobile truck — usually at Antoine & Long Point area
    address: "7645 Long Point Rd, Houston, TX 77055 (mobile)",
    lat: 29.8065,
    lng: -95.5000,
    neighborhood: "spring-branch",
    instagramURL: "https://www.instagram.com/eltacotruck/",
    facebookURL: "https://www.facebook.com/UltimoTacoTruck/"
  },

  "Tacos La Bala": {
    // Was a food truck, now has multiple brick-and-mortar locations
    address: "5800 Bellaire Blvd, Houston, TX 77081",
    lat: 29.7060,
    lng: -95.4895,
    neighborhood: "bellaire",
    type: "restaurant", // No longer a truck
    websiteURL: "https://tacos-la-bala.com/",
    instagramURL: "https://www.instagram.com/tacoslabalakaty/",
    facebookURL: "https://www.facebook.com/gorditasytacoslabala/"
  },

  "Ema": {
    // Actually CasaEma, different location than listed
    address: "5307 N Main St Suite 100, Houston, TX 77009",
    lat: 29.8105,
    lng: -95.3892,
    neighborhood: "northside"
  },

  "Velvet Taco": {
    // Wrong address — no location at 2407 Main St
    address: "907 Westheimer Rd, Houston, TX 77006",
    lat: 29.7431,
    lng: -95.3882,
    neighborhood: "montrose"
  },

  "Torchy's Tacos (Sugar Land)": {
    address: "15810 Southwest Fwy Ste 600, Sugar Land, TX 77478"
  },

  "Tacos Dona Lena": {
    // Actually a restaurant, not a truck
    address: "8788 Hammerly Blvd, Houston, TX 77080",
    lat: 29.7927,
    lng: -95.5130,
    type: "restaurant",
    websiteURL: "https://www.donalenatacos.com/",
    instagramURL: "https://www.instagram.com/tacosdonalena/",
    facebookURL: "https://www.facebook.com/tacosdonalena/"
  },

  // ===================================================================
  // FOOD TRUCK SOCIAL MEDIA & SCHEDULE LINKS (address already correct)
  // ===================================================================

  "Tacos La Sultana": {
    instagramURL: "https://www.instagram.com/tacos_la_sultana/",
    facebookURL: "https://www.facebook.com/TacoslaSultana/",
    phone: "(832) 923-9289"
  },

  "Taconmadre": {
    type: "restaurant", // Has multiple fixed locations now
    websiteURL: "https://taconmadre.com/",
    instagramURL: "https://www.instagram.com/taqueriataconmadre/",
    facebookURL: "https://www.facebook.com/taconmadretx/",
    scheduleURL: "https://taconmadre.com/locations/"
  },

  "Tacos Tierra Caliente": {
    // Montrose location — address correct at 2003 W Alabama
    websiteURL: "https://www.tacostierracalientemx.com/",
    scheduleURL: "https://www.tacostierracalientemx.com/locations-1"
  },

  "Tacos Tierra Caliente (Heights)": {
    websiteURL: "https://www.tacostierracalientemx.com/",
    instagramURL: "https://www.instagram.com/tacostierracalientetx/",
    scheduleURL: "https://www.tacostierracalientemx.com/locations-1"
  },

  "Tacos Laguna": {
    instagramURL: "https://www.instagram.com/tacoslaguna/",
    facebookURL: "https://www.facebook.com/RiosLagunaTacos/"
  },

  "El Taconazo": {
    facebookURL: "https://www.facebook.com/p/El-Taconazo-61566033132706/",
    websiteURL: "https://eltaconazo.shop/"
  },

  "The Birria Queen": {
    instagramURL: "https://www.instagram.com/thebirriaqueen/",
    facebookURL: "https://www.facebook.com/TheBirriaQueenHouston/",
    websiteURL: "https://www.thebirriaqueen.com/"
  },

  "Tacos Eliza": {
    websiteURL: "http://tacoseliza.com/",
    phone: "(832) 571-4492"
  }
};

// Places that may be closed or unverifiable — flag for manual review
const POSSIBLY_CLOSED = [
  { name: "La Macro", note: "Google shows address as 1822 N Main St (permanently closed?). Listed at 7327 Harrisburg Blvd." },
  { name: "Tacos A Go Go (Heights)", note: "White Oak Dr location shows as permanently closed on Google." },
  { name: "Tlahuac Taqueria", note: "Previous location at 5 E Greenway Plz marked closed. 1402 N Shepherd not verified." },
  { name: "Taqueria Los Munecos", note: "Not found on Google/Yelp at 2711 Harrisburg. May be closed or very informal." },
  { name: "Asados Don Pancho", note: "No search results found. May be closed or operating under different name." },
  { name: "Tacos El Gordo", note: "Not found at 7720 Long Point Rd. Closest match is 'Tacos Los Gordos NL' at 9366 Long Point." },
  { name: "Laredo Taqueria (Montrose)", note: "No confirmed location at 1606 Montrose Blvd. Known locations are Snover St, Patton St, San Jacinto St." }
];

/**
 * Apply all place fixes to Firestore.
 */
async function fixPlaceData() {
  const db = firebase.firestore();
  let updated = 0;
  let notFound = 0;
  let errors = 0;

  console.log('🌮 Starting place data fixes...\n');

  for (const [name, fixes] of Object.entries(PLACE_FIXES)) {
    try {
      const snap = await db.collection('places')
        .where('name', '==', name)
        .limit(1)
        .get();

      if (snap.empty) {
        console.warn(`⚠️  "${name}" not found in Firestore — skipping`);
        notFound++;
        continue;
      }

      const docRef = snap.docs[0].ref;
      await docRef.update(fixes);
      updated++;
      console.log(`✅ Fixed "${name}" — ${Object.keys(fixes).join(', ')}`);
    } catch (err) {
      console.error(`❌ Failed to update "${name}":`, err.message);
      errors++;
    }
  }

  console.log('\n--- POSSIBLY CLOSED / UNVERIFIABLE ---');
  POSSIBLY_CLOSED.forEach(p => {
    console.warn(`⚠️  ${p.name}: ${p.note}`);
  });

  console.log(`\n🌮 Done! Updated: ${updated} | Not found: ${notFound} | Errors: ${errors}`);
  console.log(`⚠️  ${POSSIBLY_CLOSED.length} places flagged for manual review (see above).`);
  console.log('Hard-refresh place detail pages to see the new buttons.');
}

// Make available globally
if (typeof window !== 'undefined') {
  window.fixPlaceData = fixPlaceData;
  window.PLACE_FIXES = PLACE_FIXES;
  window.POSSIBLY_CLOSED = POSSIBLY_CLOSED;
  console.log(`🌮 Place fix script loaded! ${Object.keys(PLACE_FIXES).length} fixes ready.`);
  console.log('Run fixPlaceData() to apply all corrections to Firestore.');
}
