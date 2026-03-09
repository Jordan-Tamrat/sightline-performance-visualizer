export const getOrCreateUserIdentifier = (): string => {
    if (typeof window === 'undefined') {
        return ''; // SSR fallback
    }

    const STORAGE_KEY = 'sightline_user_id';
    let userId = localStorage.getItem(STORAGE_KEY);

    if (!userId) {
        // Generate standard UUID using crypto API
        userId = crypto.randomUUID();
        localStorage.setItem(STORAGE_KEY, userId);
    }

    return userId;
};
