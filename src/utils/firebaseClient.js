import { initializeApp, getApps } from 'firebase/app';
import firebaseConfig, { isFirebaseConfigured } from '../config/firebaseConfig';

let appInstance = null;

export const getFirebaseApp = () => {
    if (!isFirebaseConfigured()) {
        return null;
    }

    if (!appInstance) {
        const existingApp = getApps()[0];
        appInstance = existingApp || initializeApp(firebaseConfig);
    }

    return appInstance;
};
