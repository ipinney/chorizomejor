/*********************************
 * 1. Firebase Configuration
 ********************************/
// 1. Create a Firebase project at https://firebase.google.com/
// 2. Enable Email/Password Auth (and optional Google/Facebook if desired)
// 3. Enable Cloud Firestore or Realtime Database
// 4. Paste your config here:
const firebaseConfig = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "YOUR_FIREBASE_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_FIREBASE_PROJECT_ID",
  storageBucket: "YOUR_FIREBASE_PROJECT_ID.appspot.com",
  messagingSenderId: "XXXXXX",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
// If using Firestore:
const db = firebase.firestore();
const storage = firebase.storage();

/*********************************
 * 2. Global Variables
 ********************************/
let map;                  // Google Map instance
let markers = [];         // Array to store Google Map markers
let selectedPlaceId = ""; // ID of the currently selected Taco Place

/*********************************
 * 3. Auth Handling
 ********************************/
const authSection = document.getElementById("auth-section");

firebase.auth().onAuthStateChanged(user => {
  if (user) {
    // User logged in
    authSection.innerHTML = `
      <span>Logged in as ${user.email}</span>
      <button id="btn-logout">Logout</button>
    `;
    document.getElementById("btn-logout").addEventListener("click", () => {
      firebase.auth().signOut();
    });
    // Show main content
    loadTacoPlaces();
  } else {
    // User logged out
    authSection.innerHTML = `
      <button id="btn-login">Login</button>
      <button id="btn-signup">Sign Up</button>
    `;
    document.getElementById("btn-login").addEventListener("click", showLoginPrompt);
    document.getElementById("btn-signup").addEventListener("click", showSignupPrompt);
  }
});

/*********************************
 * 4. Sign Up / Login Prompts
 ********************************/
function showSignupPrompt() {
  const email = prompt("Enter email:");
  const pass = prompt("Enter password:");
  if (email && pass) {
    firebase.auth().createUserWithEmailAndPassword(email, pass)
      .catch(err => alert("Error: " + err.message));
  }
}

function showLoginPrompt() {
  const email = prompt("Enter email:");
  const pass = prompt("Enter password:");
  if (email && pass) {
    firebase.auth().signInWithEmailAndPassword(email, pass)
      .catch(err => alert("Error: " + err.message));
  }
}

/*********************************
 * 5. Initialize Google Map
 ********************************/
function initMap() {
  map = new google.maps.Map(document.getElementById("map"), {
    center: { lat: 29.7604, lng: -95.3698 }, // Houston by default
    zoom: 10,
  });
}

/*********************************
 * 6. Load Taco Places
 ********************************/
async function loadTacoPlaces() {
  // Clear existing markers from map
  markers.forEach(m => m.setMap(null));
  markers = [];

  const snapshot = await db.collection("tacoPlaces").get();
  const places = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  
  const placesUl = document.getElementById("places-ul");
  placesUl.innerHTML = "";

  places.forEach(place => {
    // Add to list
    const li = document.createElement("li");
    li.textContent = place.name + " – " + (place.city || "");
    li.addEventListener("click", () => showPlaceDetails(place.id));
    placesUl.appendChild(li);

    // Add marker
    if (place.location) {
      const marker = new google.maps.Marker({
        position: place.location,
        map,
        title: place.name
      });
      marker.addListener("click", () => showPlaceDetails(place.id));
      markers.push(marker);
    }
  });
}

/*********************************
 * 7. Add a Taco Place (Modal)
 ********************************/
const btnAddPlace = document.getElementById("btn-add-place");
const addPlaceForm = document.getElementById("add-place-form");
const closeAddPlace = document.getElementById("close-add-place");
const placeSubmit = document.getElementById("place-submit");

btnAddPlace.addEventListener("click", () => {
  if (!firebase.auth().currentUser) {
    alert("Must be logged in to add a place.");
    return;
  }
  addPlaceForm.classList.remove("hidden");
});

closeAddPlace.addEventListener("click", () => {
  addPlaceForm.classList.add("hidden");
});

placeSubmit.addEventListener("click", async () => {
  const name = document.getElementById("place-name").value.trim();
  const address = document.getElementById("place-address").value.trim();
  const city = document.getElementById("place-city").value.trim();

  if (!name) {
    alert("Please enter a name.");
    return;
  }

  // Optionally use Google Geocoding if you want to convert address to lat/lng
  // For now, we'll store the text. You can enhance this later.
  
  const newPlace = {
    name,
    address,
    city,
    location: null, // or geocode to lat/lng
    average_tortilla: 0,
    average_chorizo: 0,
    reviews_count: 0,
  };

  await db.collection("tacoPlaces").add(newPlace);
  addPlaceForm.classList.add("hidden");

  // Clear form
  document.getElementById("place-name").value = "";
  document.getElementById("place-address").value = "";
  document.getElementById("place-city").value = "";

  loadTacoPlaces();
});

/*********************************
 * 8. Show Place Details & Reviews
 ********************************/
const placeDetails = document.getElementById("place-details");
const placeTitle = document.getElementById("place-title");
const placeAddressDisplay = document.getElementById("place-address-display");
const avgTortillaEl = document.getElementById("avg-tortilla");
const avgChorizoEl = document.getElementById("avg-chorizo");
const reviewsList = document.getElementById("reviews-list");
const btnAddReview = document.getElementById("btn-add-review");

async function showPlaceDetails(placeId) {
  selectedPlaceId = placeId;
  placeDetails.classList.remove("hidden");

  // Load the place
  const placeDoc = await db.collection("tacoPlaces").doc(placeId).get();
  const placeData = placeDoc.data();
  placeTitle.textContent = placeData.name;
  placeAddressDisplay.textContent = placeData.address;
  avgTortillaEl.textContent = placeData.average_tortilla || 0;
  avgChorizoEl.textContent = placeData.average_chorizo || 0;

  // Load reviews
  const snapshot = await db
    .collection("reviews")
    .where("taco_place_id", "==", placeId)
    .orderBy("createdAt", "desc")
    .get();

  reviewsList.innerHTML = "";
  snapshot.forEach(doc => {
    const r = doc.data();
    const li = document.createElement("li");
    li.innerHTML = `
      <strong>Tortilla:</strong> ${r.tortilla_rating}  
      <strong>Chorizo:</strong> ${r.chorizo_rating}
      <br/>
      <img src="${r.photoURL || ''}" alt="Review Photo" style="max-width:100px; margin-top:5px;">
    `;
    reviewsList.appendChild(li);
  });
}

/*********************************
 * 9. Add Review (Modal)
 ********************************/
const addReviewForm = document.getElementById("add-review-form");
const closeAddReview = document.getElementById("close-add-review");
const reviewSubmit = document.getElementById("review-submit");

btnAddReview.addEventListener("click", () => {
  if (!firebase.auth().currentUser) {
    alert("Must be logged in to review.");
    return;
  }
  addReviewForm.classList.remove("hidden");
});

closeAddReview.addEventListener("click", () => {
  addReviewForm.classList.add("hidden");
});

reviewSubmit.addEventListener("click", async () => {
  const tortilla = parseInt(document.getElementById("tortilla-rating").value, 10);
  const chorizo = parseInt(document.getElementById("chorizo-rating").value, 10);
  const photoFile = document.getElementById("review-photo").files[0];

  if (!tortilla || !chorizo) {
    alert("Please enter valid ratings.");
    return;
  }

  let photoURL = "";
  if (photoFile) {
    // Upload to Firebase Storage
    const storageRef = storage.ref(`reviews/${Date.now()}_${photoFile.name}`);
    await storageRef.put(photoFile);
    photoURL = await storageRef.getDownloadURL();
  }

  const newReview = {
    tortilla_rating: tortilla,
    chorizo_rating: chorizo,
    photoURL,
    taco_place_id: selectedPlaceId,
    user_id: firebase.auth().currentUser.uid,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  await db.collection("reviews").add(newReview);

  // Update place’s averages
  const placeRef = db.collection("tacoPlaces").doc(selectedPlaceId);
  const placeDoc = await placeRef.get();
  if (placeDoc.exists) {
    const placeData = placeDoc.data();
    const oldCount = placeData.reviews_count || 0;
    const newCount = oldCount + 1;

    const updatedAvgTortilla =
      ((placeData.average_tortilla || 0) * oldCount + tortilla) / newCount;
    const updatedAvgChorizo =
      ((placeData.average_chorizo || 0) * oldCount + chorizo) / newCount;

    await placeRef.update({
      average_tortilla: updatedAvgTortilla,
      average_chorizo: updatedAvgChorizo,
      reviews_count: newCount
    });
  }

  // Clear form
  document.getElementById("tortilla-rating").value = "";
  document.getElementById("chorizo-rating").value = "";
  document.getElementById("review-photo").value = "";

  addReviewForm.classList.add("hidden");
  // Refresh details
  showPlaceDetails(selectedPlaceId);
});

/*********************************
 * 10. Start the Map After Window Load
 ********************************/
window.onload = () => {
  initMap();
};
