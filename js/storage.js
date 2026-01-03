/**
 * Storage Module - Handles encrypted localStorage operations
 * OPTIMIZED: Caches encryption key to avoid repeated PBKDF2 derivation
 */

const Storage = {
    // Storage keys
    KEYS: {
        PIN_HASH: 'habit_pin_hash',
        SALT: 'habit_salt',
        DATA: 'habit_data',
        SETTINGS: 'habit_settings'
    },

    // Cached encryption key (derived once on login)
    _cachedKey: null,
    _cachedData: null,

    // Generate a random salt
    generateSalt() {
        const array = new Uint8Array(16);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    },

    // Hash PIN with SHA-256
    hashPIN(pin, salt) {
        const combined = pin + salt;
        return CryptoJS.SHA256(combined).toString();
    },

    // Encrypt data with AES-256
    encrypt(data, key) {
        const jsonString = JSON.stringify(data);
        return CryptoJS.AES.encrypt(jsonString, key).toString();
    },

    // Decrypt data
    decrypt(encryptedData, key) {
        try {
            const bytes = CryptoJS.AES.decrypt(encryptedData, key);
            const decryptedString = bytes.toString(CryptoJS.enc.Utf8);
            if (!decryptedString) {
                return null;
            }
            return JSON.parse(decryptedString);
        } catch (error) {
            console.error('Decryption failed:', error);
            return null;
        }
    },

    // Derive encryption key from PIN (slow - only call once)
    deriveKey(pin, salt) {
        return CryptoJS.PBKDF2(pin, salt, {
            keySize: 256 / 32,
            iterations: 1000  // Reduced from 10000 for mobile performance
        }).toString();
    },

    // Cache the key after successful login
    cacheKey(pin) {
        const salt = localStorage.getItem(this.KEYS.SALT);
        if (salt) {
            this._cachedKey = this.deriveKey(pin, salt);
            // Also cache and decrypt data once
            const encryptedData = localStorage.getItem(this.KEYS.DATA);
            if (encryptedData) {
                this._cachedData = this.decrypt(encryptedData, this._cachedKey);
            }
        }
    },

    // Clear cached key (on lock/logout)
    clearCache() {
        this._cachedKey = null;
        this._cachedData = null;
    },

    // Check if PIN is set up
    isPINSetup() {
        return localStorage.getItem(this.KEYS.PIN_HASH) !== null;
    },

    // Setup new PIN
    setupPIN(pin) {
        const salt = this.generateSalt();
        const pinHash = this.hashPIN(pin, salt);

        localStorage.setItem(this.KEYS.SALT, salt);
        localStorage.setItem(this.KEYS.PIN_HASH, pinHash);

        // Initialize empty data with the new PIN
        const encryptionKey = this.deriveKey(pin, salt);
        const initialData = {
            habits: [],
            completions: {},
            settings: {
                theme: 'auto',
                defaultView: 'list'
            }
        };

        const encryptedData = this.encrypt(initialData, encryptionKey);
        localStorage.setItem(this.KEYS.DATA, encryptedData);

        // Cache the key and data
        this._cachedKey = encryptionKey;
        this._cachedData = initialData;

        return true;
    },

    // Verify PIN
    verifyPIN(pin) {
        const salt = localStorage.getItem(this.KEYS.SALT);
        const storedHash = localStorage.getItem(this.KEYS.PIN_HASH);

        if (!salt || !storedHash) {
            return false;
        }

        const inputHash = this.hashPIN(pin, salt);
        const isValid = inputHash === storedHash;

        // Cache key on successful verification
        if (isValid) {
            this.cacheKey(pin);
        }

        return isValid;
    },

    // Change PIN
    changePIN(oldPIN, newPIN) {
        if (!this.verifyPIN(oldPIN)) {
            return false;
        }

        // Get current data (uses cache)
        const data = this.getData();

        if (!data) {
            return false;
        }

        // Create new salt and hash for new PIN
        const newSalt = this.generateSalt();
        const newPinHash = this.hashPIN(newPIN, newSalt);
        const newKey = this.deriveKey(newPIN, newSalt);

        // Re-encrypt data with new key
        const newEncryptedData = this.encrypt(data, newKey);

        // Save everything
        localStorage.setItem(this.KEYS.SALT, newSalt);
        localStorage.setItem(this.KEYS.PIN_HASH, newPinHash);
        localStorage.setItem(this.KEYS.DATA, newEncryptedData);

        // Update cache
        this._cachedKey = newKey;

        return true;
    },

    // Get decrypted data (uses cache for speed)
    getData() {
        // Return cached data if available
        if (this._cachedData) {
            return this._cachedData;
        }

        // Fallback to decryption if no cache (shouldn't happen normally)
        if (!this._cachedKey) {
            console.warn('No cached key - data access will be slow');
            return null;
        }

        const encryptedData = localStorage.getItem(this.KEYS.DATA);
        if (!encryptedData) {
            return null;
        }

        this._cachedData = this.decrypt(encryptedData, this._cachedKey);
        return this._cachedData;
    },

    // Save encrypted data (uses cached key)
    saveData(data) {
        if (!this._cachedKey) {
            console.error('No cached key - cannot save');
            return false;
        }

        const encryptedData = this.encrypt(data, this._cachedKey);
        localStorage.setItem(this.KEYS.DATA, encryptedData);

        // Update cache
        this._cachedData = data;

        return true;
    },

    // Export data
    exportData() {
        const data = this.getData();
        if (!data) {
            return null;
        }

        return {
            version: '1.0',
            exportDate: new Date().toISOString(),
            data: data
        };
    },

    // Import data
    importData(importedData) {
        try {
            if (!importedData.version || !importedData.data) {
                throw new Error('Invalid import format');
            }

            return this.saveData(importedData.data);
        } catch (error) {
            console.error('Import failed:', error);
            return false;
        }
    },

    // Clear all data
    clearAll() {
        localStorage.removeItem(this.KEYS.PIN_HASH);
        localStorage.removeItem(this.KEYS.SALT);
        localStorage.removeItem(this.KEYS.DATA);
        localStorage.removeItem(this.KEYS.SETTINGS);
        this.clearCache();
    }
};
