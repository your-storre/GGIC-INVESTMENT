// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, sendEmailVerification, updateProfile } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, doc, setDoc, updateDoc, getDoc, query, where, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDQDX4eyp7fbmHqbyjytWZEv-jK7XxynqA",
  authDomain: "ggic-investment.firebaseapp.com",
  databaseURL: "https://ggic-investment-default-rtdb.firebaseio.com",
  projectId: "ggic-investment",
  storageBucket: "ggic-investment.firebasestorage.app",
  messagingSenderId: "805530882494",
  appId: "1:805530882494:web:574b965b3ed0402b0f69ef",
  measurementId: "G-NR5R3EJM93"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { auth, db, storage, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, sendEmailVerification, updateProfile, collection, addDoc, getDocs, doc, setDoc, updateDoc, getDoc, query, where, orderBy, onSnapshot, ref, uploadBytes, getDownloadURL };