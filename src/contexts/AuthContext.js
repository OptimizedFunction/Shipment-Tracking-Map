import React, {
    createContext,
    useCallback,
    useEffect,
    useMemo,
    useState
} from 'react';

export const AuthContext = createContext({
    authToken: null,
    isAuthenticated: false,
    userName: null,
    loginWithApiKey: async () => { },
    logout: () => { },
    authLoading: false,
    authError: null
});

const TOKEN_STORAGE_KEY = 'prun:authToken';
const USER_STORAGE_KEY = 'prun:authUser';

const normalizeString = (value) => {
    if (typeof value !== 'string') {
        return '';
    }
    return value.trim();
};

export const AuthProvider = ({ children }) => {
    const [authToken, setAuthToken] = useState(null);
    const [userName, setUserName] = useState(null);
    const [authLoading, setAuthLoading] = useState(false);
    const [authError, setAuthError] = useState(null);

    useEffect(() => {
        try {
            const storedToken = window.localStorage.getItem(TOKEN_STORAGE_KEY);
            const storedUser = window.localStorage.getItem(USER_STORAGE_KEY);
            if (storedToken) {
                setAuthToken(storedToken);
            }
            if (storedUser) {
                setUserName(storedUser);
            }
        } catch (storageError) {
            // eslint-disable-next-line no-console
            console.warn('Failed to read stored auth token', storageError);
        }
    }, []);

    const loginWithApiKey = useCallback(async ({ apiKey: apiKeyInput, rememberMe = false }) => {
        const trimmedKey = normalizeString(apiKeyInput);

        if (!trimmedKey) {
            throw new Error('API key cannot be empty.');
        }

        setAuthLoading(true);
        setAuthError(null);

        try {
            // Validate API key and get username from the auth endpoint
            const response = await fetch('https://rest.fnar.net/auth', {
                method: 'GET',
                headers: {
                    'Authorization': trimmedKey
                }
            });

            if (!response.ok) {
                let message = `Authentication failed with status ${response.status}`;
                if (response.status === 401) {
                    message = 'Invalid API key';
                } else if (response.status === 403) {
                    message = 'API key is not authorized';
                }
                throw new Error(message);
            }

            const authenticatedUserName = await response.text();

            if (!authenticatedUserName || authenticatedUserName.trim().length === 0) {
                throw new Error('Authentication succeeded but no username was returned.');
            }

            const normalizedUserName = authenticatedUserName.trim();

            setAuthToken(trimmedKey);
            setUserName(normalizedUserName);

            // Only persist if "Remember Me" is checked
            if (rememberMe) {
                try {
                    window.localStorage.setItem(TOKEN_STORAGE_KEY, trimmedKey);
                    window.localStorage.setItem(USER_STORAGE_KEY, normalizedUserName);
                } catch (storageError) {
                    // eslint-disable-next-line no-console
                    console.warn('Failed to persist API key', storageError);
                }
            } else {
                // Clear any previously stored credentials
                try {
                    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
                    window.localStorage.removeItem(USER_STORAGE_KEY);
                } catch (storageError) {
                    // eslint-disable-next-line no-console
                    console.warn('Failed to clear stored credentials', storageError);
                }
            }

            return { apiKey: trimmedKey, userName: normalizedUserName };
        } catch (error) {
            setAuthError(error instanceof Error ? error.message : 'Authentication failed');
            setAuthToken(null);
            setUserName(null);
            try {
                window.localStorage.removeItem(TOKEN_STORAGE_KEY);
                window.localStorage.removeItem(USER_STORAGE_KEY);
            } catch (storageError) {
                // eslint-disable-next-line no-console
                console.warn('Failed to clear stored token', storageError);
            }
            throw error;
        } finally {
            setAuthLoading(false);
        }
    }, []);

    const logout = useCallback(() => {
        setAuthToken(null);
        setUserName(null);
        setAuthError(null);
        try {
            window.localStorage.removeItem(TOKEN_STORAGE_KEY);
            window.localStorage.removeItem(USER_STORAGE_KEY);
        } catch (storageError) {
            // eslint-disable-next-line no-console
            console.warn('Failed to clear stored token', storageError);
        }
    }, []);

    const value = useMemo(() => ({
        authToken,
        isAuthenticated: Boolean(authToken),
        userName,
        loginWithApiKey,
        logout,
        authLoading,
        authError
    }), [authToken, userName, loginWithApiKey, logout, authLoading, authError]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
