import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBopYr0IiMzK9nwCxK3NjoDwYXNAHi95PA",
  authDomain: "carepules-5ff07.firebaseapp.com",
  projectId: "carepules-5ff07",
  storageBucket: "carepules-5ff07.firebasestorage.app",
  messagingSenderId: "1047950214331",
  appId: "1:1047950214331:web:2b095b65a33d16e915959e",
  measurementId: "G-GDD4N4E9FQ"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
