/**
 * Main App Module - Initializes and coordinates all modules
 */

const App = {
    currentPIN: null,
    currentTab: 'home',

    // Initialize the app
    init() {
        this.loadData();
        this.bindEvents();
        this.initViews();
    },

    // Load data and initialize modules
    loadData() {
        // Views will load data as needed through Habits module
    },

    // Bind global event listeners
    bindEvents() {
        // Bottom navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const tab = e.currentTarget.dataset.tab;
                this.switchTab(tab);
            });
        });

        // Settings button
        document.getElementById('settings-btn').addEventListener('click', () => {
            this.showSettings();
        });

        // Settings back button
        document.getElementById('settings-back').addEventListener('click', () => {
            this.hideSettings();
        });

        // Settings actions
        document.getElementById('change-pin').addEventListener('click', () => {
            this.showChangePIN();
        });

        document.getElementById('export-data').addEventListener('click', () => {
            this.exportData();
        });

        document.getElementById('import-data').addEventListener('click', () => {
            document.getElementById('import-file').click();
        });

        document.getElementById('import-file').addEventListener('change', (e) => {
            this.importData(e.target.files[0]);
        });

        document.getElementById('clear-data').addEventListener('click', () => {
            this.showClearDataConfirm();
        });

        // Google Drive buttons
        document.getElementById('gdrive-connect').addEventListener('click', () => {
            this.connectGoogleDrive();
        });

        document.getElementById('gdrive-disconnect').addEventListener('click', () => {
            this.disconnectGoogleDrive();
        });

        document.getElementById('gdrive-backup-now').addEventListener('click', () => {
            this.backupNow();
        });

        document.getElementById('gdrive-sync-from-cloud').addEventListener('click', () => {
            this.syncFromCloud();
        });

        // Confirm modal
        document.getElementById('confirm-cancel').addEventListener('click', () => {
            this.hideConfirmModal();
        });
    },

    // Initialize views
    initViews() {
        Views.init();

        // Initialize charts when analytics tab is first shown
        this.chartsInitialized = false;
        // Initialize workouts when tab is first shown
        this.workoutsInitialized = false;
    },

    // Switch between tabs
    switchTab(tab) {
        this.currentTab = tab;

        // Update nav buttons
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.tab === tab);
        });

        // Show/hide screens
        document.getElementById('app-screen').classList.toggle('active', tab === 'home');
        document.getElementById('workout-screen').classList.toggle('active', tab === 'workouts');
        document.getElementById('analytics-screen').classList.toggle('active', tab === 'analytics');

        // Initialize charts on first view
        if (tab === 'analytics' && !this.chartsInitialized) {
            Charts.init();
            this.chartsInitialized = true;
        } else if (tab === 'analytics') {
            Charts.refresh();
        }

        // Initialize workouts on first view
        if (tab === 'workouts') {
            if (!this.workoutsInitialized) {
                WorkoutViews.init();
                this.workoutsInitialized = true;
            } else {
                WorkoutViews.render();
            }
        }
    },

    // Show settings screen
    showSettings() {
        document.getElementById('app-screen').classList.remove('active');
        document.getElementById('analytics-screen').classList.remove('active');
        document.getElementById('settings-screen').classList.add('active');

        // Update Google Drive status
        this.updateGDriveUI();
    },

    // Hide settings screen
    hideSettings() {
        document.getElementById('settings-screen').classList.remove('active');
        if (this.currentTab === 'home') {
            document.getElementById('app-screen').classList.add('active');
        } else {
            document.getElementById('analytics-screen').classList.add('active');
        }
    },

    // Show change PIN flow
    showChangePIN() {
        // Create a simple prompt flow
        const currentPIN = prompt('Enter your current PIN:');
        if (!currentPIN) return;

        if (!Storage.verifyPIN(currentPIN)) {
            Utils.showToast('Incorrect PIN');
            return;
        }

        const newPIN = prompt('Enter new PIN (4-6 digits):');
        if (!newPIN || newPIN.length < 4 || newPIN.length > 6 || !/^\d+$/.test(newPIN)) {
            Utils.showToast('PIN must be 4-6 digits');
            return;
        }

        const confirmPIN = prompt('Confirm new PIN:');
        if (confirmPIN !== newPIN) {
            Utils.showToast('PINs do not match');
            return;
        }

        if (Storage.changePIN(currentPIN, newPIN)) {
            this.currentPIN = newPIN;
            Utils.showToast('PIN changed successfully');
        } else {
            Utils.showToast('Failed to change PIN');
        }
    },

    // Export data
    exportData() {
        const exportObj = Storage.exportData();
        if (!exportObj) {
            Utils.showToast('Export failed');
            return;
        }

        const dataStr = JSON.stringify(exportObj, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `habit-tracker-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        Utils.showToast('Data exported');
    },

    // Import data
    importData(file) {
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedData = JSON.parse(e.target.result);

                Utils.showConfirm(
                    'Import Data?',
                    'This will replace all your current data. Continue?',
                    () => {
                        if (Storage.importData(importedData)) {
                            Utils.showToast('Data imported successfully');
                            Views.render();
                            if (this.chartsInitialized) {
                                Charts.updateHabitFilter();
                                Charts.refresh();
                            }
                        } else {
                            Utils.showToast('Import failed');
                        }
                    }
                );
            } catch (error) {
                Utils.showToast('Invalid file format');
            }
        };
        reader.readAsText(file);

        // Reset file input
        document.getElementById('import-file').value = '';
    },

    // Show clear data confirmation
    showClearDataConfirm() {
        Utils.showConfirm(
            'Clear All Data?',
            'This will permanently delete all your habits, progress, and settings. You will need to set up a new PIN.',
            () => {
                Storage.clearAll();
                Auth.showSetupScreen();
                Utils.showToast('All data cleared');
            }
        );
    },

    // Hide confirm modal
    hideConfirmModal() {
        document.getElementById('confirm-modal').classList.remove('active');
    },

    // Connect Google Drive
    async connectGoogleDrive() {
        try {
            if (typeof GDrive === 'undefined') {
                Utils.showToast('Google Drive not available');
                return;
            }

            await GDrive.init();
            await GDrive.signIn();
            Utils.showToast('Connected to Google Drive');

            // Trigger initial backup
            this.backupNow();
        } catch (error) {
            console.error('Google Drive connect error:', error);
            Utils.showToast('Failed to connect');
        }
    },

    // Disconnect Google Drive
    disconnectGoogleDrive() {
        Utils.showConfirm(
            'Disconnect Google Drive?',
            'Auto-backup will be disabled. Your existing backup will remain in Drive.',
            () => {
                if (typeof GDrive !== 'undefined') {
                    GDrive.signOut();
                    Utils.showToast('Disconnected from Google Drive');
                }
            }
        );
    },

    // Manual backup
    async backupNow() {
        if (typeof GDrive === 'undefined' || !localStorage.getItem('gdrive_connected')) {
            Utils.showToast('Google Drive not connected');
            return;
        }

        Utils.showToast('Backing up...');
        const encryptedData = localStorage.getItem(Storage.KEYS.DATA);
        if (encryptedData) {
            const success = await GDrive.backup(encryptedData);
            if (success) {
                Utils.showToast('Backup complete');
            } else {
                Utils.showToast('Backup failed');
            }
        }
    },

    // Sync from cloud - download and replace local data
    async syncFromCloud() {
        if (typeof GDrive === 'undefined' || !localStorage.getItem('gdrive_connected')) {
            Utils.showToast('Google Drive not connected');
            return;
        }

        Utils.showConfirm(
            'Sync from Cloud?',
            'This will replace your local data with the cloud backup. Any local changes not backed up will be lost.',
            async () => {
                Utils.showToast('Downloading from cloud...');

                try {
                    const backupData = await GDrive.restore();

                    if (!backupData || !backupData.data) {
                        Utils.showToast('No backup found in cloud');
                        return;
                    }

                    // The backup data is encrypted - we need to decrypt with current key
                    const encryptedData = backupData.data;

                    // Try to decrypt with current cached key
                    if (Storage._cachedKey) {
                        try {
                            const decrypted = Storage.decrypt(encryptedData, Storage._cachedKey);
                            if (decrypted && decrypted.habits) {
                                // Save decrypted data back (re-encrypted with current key)
                                Storage._cachedData = decrypted;
                                const reEncrypted = Storage.encrypt(decrypted, Storage._cachedKey);
                                localStorage.setItem(Storage.KEYS.DATA, reEncrypted);

                                // Refresh views
                                Views.render();
                                if (this.chartsInitialized) {
                                    Charts.updateHabitFilter();
                                    Charts.refresh();
                                }

                                Utils.showToast('Synced from cloud successfully!');
                                return;
                            }
                        } catch (e) {
                            console.error('Decrypt with current key failed:', e);
                        }
                    }

                    // If current key doesn't work, the backup was made with different PIN
                    Utils.showToast('Backup PIN differs from current PIN. Clear data and restore from welcome screen.');

                } catch (error) {
                    console.error('Sync from cloud error:', error);
                    Utils.showToast('Sync failed');
                }
            }
        );
    },

    // Update Google Drive UI
    updateGDriveUI() {
        if (typeof GDrive !== 'undefined') {
            GDrive.onSignInChange(localStorage.getItem('gdrive_connected') === 'true');

            // Show backup/sync buttons if connected
            const isConnected = localStorage.getItem('gdrive_connected') === 'true';
            const backupBtn = document.getElementById('gdrive-backup-now');
            const syncBtn = document.getElementById('gdrive-sync-from-cloud');

            if (backupBtn) {
                backupBtn.classList.toggle('hidden', !isConnected);
            }
            if (syncBtn) {
                syncBtn.classList.toggle('hidden', !isConnected);
            }
        }
    }
};

/**
 * Utility functions
 */
const Utils = {
    // Show toast notification
    showToast(message, duration = 3000) {
        const toast = document.getElementById('toast');
        const toastMessage = document.getElementById('toast-message');

        toastMessage.textContent = message;
        toast.classList.remove('hidden');

        setTimeout(() => {
            toast.classList.add('hidden');
        }, duration);
    },

    // Show confirmation dialog
    showConfirm(title, message, onConfirm) {
        const modal = document.getElementById('confirm-modal');
        document.getElementById('confirm-title').textContent = title;
        document.getElementById('confirm-message').textContent = message;

        const okBtn = document.getElementById('confirm-ok');
        const cancelBtn = document.getElementById('confirm-cancel');

        // Remove old listeners
        const newOkBtn = okBtn.cloneNode(true);
        okBtn.parentNode.replaceChild(newOkBtn, okBtn);

        const newCancelBtn = cancelBtn.cloneNode(true);
        cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

        // Add new listeners
        newOkBtn.addEventListener('click', () => {
            modal.classList.remove('active');
            onConfirm();
        });

        newCancelBtn.addEventListener('click', () => {
            modal.classList.remove('active');
        });

        modal.classList.add('active');
    }
};

// Initialize auth when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    Auth.init();
});

// Register service worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('service-worker.js')
            .then(registration => {
                console.log('ServiceWorker registered:', registration.scope);
            })
            .catch(error => {
                console.log('ServiceWorker registration failed:', error);
            });
    });
}
