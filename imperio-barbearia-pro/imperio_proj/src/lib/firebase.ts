import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyA7ISbwf_RCg_3IRTOboeV1Y9W4_wf8HY4",
  authDomain: "barb-imperio.firebaseapp.com",
  projectId: "barb-imperio",
  storageBucket: "barb-imperio.firebasestorage.app",
  messagingSenderId: "1011188015253",
  appId: "1:1011188015253:web:bc824812e8ac6628017b9c"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
