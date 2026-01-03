/**
 * Google Drive Backup Module
 * Handles Google OAuth and Drive API for encrypted backup/restore
 */

const GDrive = {
    CLIENT_ID: '92480829396-mu32t5uvsnfi8opncrrvchogrov246b5.apps.googleusercontent.com',
    SCOPES: 'https://www.googleapis.com/auth/drive.appdata',
    BACKUP_FILENAME: 'habit-tracker-backup.json',

    // State
    isSignedIn: false,
    accessToken: null,
    tokenClient: null,

    // Initialize Google Identity Services
    init() {
        return new Promise((resolve) => {
            // Check if already initialized
            if (this.tokenClient) {
                resolve(true);
                return;
            }

            // Wait for Google Identity Services to load
            if (typeof google === 'undefined' || !google.accounts) {
                console.log('Google Identity Services not loaded yet');
                resolve(false);
                return;
            }

            this.tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: this.CLIENT_ID,
                scope: this.SCOPES,
                callback: (response) => {
                    if (response.access_token) {
                        this.accessToken = response.access_token;
                        this.isSignedIn = true;
                        localStorage.setItem('gdrive_connected', 'true');
                        this.onSignInChange(true);
                    }
                },
                error_callback: (error) => {
                    console.error('OAuth error:', error);
                    this.isSignedIn = false;
                    this.onSignInChange(false);
                }
            });

            // Check if was previously connected
            if (localStorage.getItem('gdrive_connected') === 'true') {
                // Will prompt for re-auth if needed on first backup
                this.isSignedIn = false;
            }

            resolve(true);
        });
    },

    // Sign in to Google
    signIn() {
        return new Promise((resolve, reject) => {
            if (!this.tokenClient) {
                reject(new Error('Google API not initialized'));
                return;
            }

            this.tokenClient.callback = (response) => {
                if (response.error) {
                    reject(new Error(response.error));
                    return;
                }
                this.accessToken = response.access_token;
                this.isSignedIn = true;
                localStorage.setItem('gdrive_connected', 'true');
                this.onSignInChange(true);
                resolve(true);
            };

            this.tokenClient.requestAccessToken({ prompt: 'consent' });
        });
    },

    // Sign out
    signOut() {
        if (this.accessToken) {
            google.accounts.oauth2.revoke(this.accessToken);
        }
        this.accessToken = null;
        this.isSignedIn = false;
        localStorage.removeItem('gdrive_connected');
        this.onSignInChange(false);
    },

    // Callback for sign-in state changes
    onSignInChange(signedIn) {
        // Update UI
        const statusEl = document.getElementById('gdrive-status');
        const connectBtn = document.getElementById('gdrive-connect');
        const disconnectBtn = document.getElementById('gdrive-disconnect');
        const lastBackupEl = document.getElementById('gdrive-last-backup');

        if (statusEl) {
            statusEl.textContent = signedIn ? 'Connected' : 'Not connected';
            statusEl.className = signedIn ? 'gdrive-status connected' : 'gdrive-status';
        }

        if (connectBtn) connectBtn.classList.toggle('hidden', signedIn);
        if (disconnectBtn) disconnectBtn.classList.toggle('hidden', !signedIn);

        if (lastBackupEl) {
            const lastBackup = localStorage.getItem('gdrive_last_backup');
            if (signedIn && lastBackup) {
                const date = new Date(lastBackup);
                lastBackupEl.textContent = `Last backup: ${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
                lastBackupEl.classList.remove('hidden');
            } else {
                lastBackupEl.classList.add('hidden');
            }
        }
    },

    // Ensure we have a valid token
    async ensureToken() {
        if (this.accessToken) {
            return true;
        }

        if (!this.tokenClient) {
            await this.init();
        }

        return new Promise((resolve) => {
            this.tokenClient.callback = (response) => {
                if (response.access_token) {
                    this.accessToken = response.access_token;
                    this.isSignedIn = true;
                    resolve(true);
                } else {
                    resolve(false);
                }
            };

            // Request token silently if possible
            this.tokenClient.requestAccessToken({ prompt: '' });
        });
    },

    // Find backup file in appDataFolder
    async findBackupFile() {
        try {
            const response = await fetch(
                `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='${this.BACKUP_FILENAME}'&fields=files(id,name,modifiedTime)`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`
                    }
                }
            );

            if (!response.ok) {
                if (response.status === 401) {
                    this.accessToken = null;
                    return null;
                }
                throw new Error('Failed to search files');
            }

            const data = await response.json();
            return data.files && data.files.length > 0 ? data.files[0] : null;
        } catch (error) {
            console.error('Error finding backup:', error);
            return null;
        }
    },

    // Upload backup to Google Drive
    async backup(encryptedData) {
        if (!await this.ensureToken()) {
            console.log('Not signed in to Google Drive');
            return false;
        }

        try {
            const fileContent = JSON.stringify({
                version: '1.0',
                timestamp: new Date().toISOString(),
                data: encryptedData
            });

            // Check if file exists
            const existingFile = await this.findBackupFile();

            const metadata = {
                name: this.BACKUP_FILENAME,
                mimeType: 'application/json'
            };

            if (!existingFile) {
                metadata.parents = ['appDataFolder'];
            }

            const form = new FormData();
            form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
            form.append('file', new Blob([fileContent], { type: 'application/json' }));

            let url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
            let method = 'POST';

            if (existingFile) {
                url = `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=multipart`;
                method = 'PATCH';
            }

            const response = await fetch(url, {
                method: method,
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`
                },
                body: form
            });

            if (!response.ok) {
                if (response.status === 401) {
                    this.accessToken = null;
                    return false;
                }
                throw new Error('Backup upload failed');
            }

            // Update last backup time
            const now = new Date().toISOString();
            localStorage.setItem('gdrive_last_backup', now);
            this.onSignInChange(true);

            console.log('Backup uploaded successfully');
            return true;
        } catch (error) {
            console.error('Backup error:', error);
            return false;
        }
    },

    // Download backup from Google Drive
    async restore() {
        if (!await this.ensureToken()) {
            return null;
        }

        try {
            const file = await this.findBackupFile();

            if (!file) {
                console.log('No backup found');
                return null;
            }

            const response = await fetch(
                `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`
                    }
                }
            );

            if (!response.ok) {
                throw new Error('Failed to download backup');
            }

            const backupData = await response.json();
            console.log('Backup downloaded successfully');
            return backupData;
        } catch (error) {
            console.error('Restore error:', error);
            return null;
        }
    },

    // Check if backup exists (for fresh install flow)
    async checkBackupExists() {
        if (!await this.ensureToken()) {
            return false;
        }

        const file = await this.findBackupFile();
        return file !== null;
    },

    // Delete backup from Google Drive
    async deleteBackup() {
        if (!await this.ensureToken()) {
            return false;
        }

        try {
            const file = await this.findBackupFile();

            if (!file) {
                return true;
            }

            const response = await fetch(
                `https://www.googleapis.com/drive/v3/files/${file.id}`,
                {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`
                    }
                }
            );

            if (!response.ok && response.status !== 204) {
                throw new Error('Failed to delete backup');
            }

            localStorage.removeItem('gdrive_last_backup');
            return true;
        } catch (error) {
            console.error('Delete backup error:', error);
            return false;
        }
    }
};
