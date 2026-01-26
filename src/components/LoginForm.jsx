import React, { useContext, useEffect, useMemo, useState } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import './LoginForm.css';

const LoginForm = ({ onClose }) => {
    const { loginWithApiKey, authLoading, authError } = useContext(AuthContext);
    const [apiKey, setApiKey] = useState('');
    const [rememberMe, setRememberMe] = useState(false);
    const [localError, setLocalError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);

    useEffect(() => {
        setLocalError(authError);
    }, [authError]);

    useEffect(() => {
        const handleKeyDown = event => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const trimmedApiKey = useMemo(() => apiKey.trim(), [apiKey]);

    const submitDisabled = useMemo(() => {
        return authLoading || trimmedApiKey.length === 0;
    }, [authLoading, trimmedApiKey]);

    const handleSubmit = async event => {
        event.preventDefault();
        setLocalError(null);
        setSuccessMessage(null);

        try {
            const result = await loginWithApiKey({ apiKey: trimmedApiKey, rememberMe });
            setSuccessMessage(`Welcome, ${result.userName}!`);
            // Close after a short delay to show the success message
            setTimeout(() => {
                onClose();
            }, 1500);
        } catch (error) {
            setLocalError(error instanceof Error ? error.message : 'Authentication failed');
        }
    };

    return (
        <div
            className="login-overlay"
            role="dialog"
            aria-modal="true"
            onClick={onClose}
        >
            <div className="login-modal" onClick={event => event.stopPropagation()}>
                <div className="login-modal-header">
                    <h2>Sign In</h2>
                    <button
                        type="button"
                        className="login-close-button"
                        onClick={onClose}
                        aria-label="Close login form"
                    >
                        &times;
                    </button>
                </div>
                <p className="login-hint">
                    Enter your FIO API key to authenticate.
                </p>
                <form className="login-form" onSubmit={handleSubmit}>
                    <label htmlFor="login-api-key">FIO API Key
                        <span className="required-indicator" aria-hidden="true">*</span>
                        <span className="sr-only"> (required)</span>
                    </label>
                    <input
                        id="login-api-key"
                        name="apiKey"
                        type="password"
                        autoComplete="off"
                        value={apiKey}
                        onChange={event => setApiKey(event.target.value)}
                        disabled={authLoading}
                        placeholder="Paste your API key"
                    />

                    <div className="remember-me-container">
                        <input
                            id="login-remember-me"
                            name="rememberMe"
                            type="checkbox"
                            checked={rememberMe}
                            onChange={event => setRememberMe(event.target.checked)}
                            disabled={authLoading}
                        />
                        <label htmlFor="login-remember-me" className="remember-me-label">
                            Remember me
                        </label>
                    </div>

                    {localError && (
                        <div className="login-error" role="alert">
                            {localError}
                        </div>
                    )}

                    {successMessage && (
                        <div className="login-success" role="status">
                            {successMessage}
                        </div>
                    )}

                    <div className="login-actions">
                        <button
                            type="button"
                            className="secondary-button"
                            onClick={onClose}
                            disabled={authLoading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="primary-button"
                            disabled={submitDisabled}
                        >
                            {authLoading ? 'Signing In…' : 'Sign In'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default LoginForm;
