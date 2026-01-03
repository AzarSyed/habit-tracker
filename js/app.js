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
        document.getElementById('analytics-screen').classList.toggle('active', tab === 'analytics');

        // Initialize charts on first view
        if (tab === 'analytics' && !this.chartsInitialized) {
            Charts.init();
            this.chartsInitialized = true;
        } else if (tab === 'analytics') {
            Charts.refresh();
        }
    },

    // Show settings screen
    showSettings() {
        document.getElementById('app-screen').classList.remove('active');
        document.getElementById('analytics-screen').classList.remove('active');
        document.getElementById('settings-screen').classList.add('active');
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
