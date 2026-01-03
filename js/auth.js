/**
 * Auth Module - Handles PIN lock screen and authentication
 * OPTIMIZED: Faster PIN verification, correct dot display
 */

const Auth = {
    currentPIN: '',
    setupPIN: '',
    confirmPIN: '',
    isConfirmStep: false,
    failedAttempts: 0,
    maxAttempts: 3,
    lockoutDuration: 30000, // 30 seconds
    isLockedOut: false,
    expectedPinLength: 4, // Will be updated from storage

    // Initialize auth module
    init() {
        this.loadPinLength();
        this.bindEvents();
        this.checkAuthState();
    },

    // Load stored PIN length
    loadPinLength() {
        const storedLength = localStorage.getItem('habit_pin_length');
        if (storedLength) {
            this.expectedPinLength = parseInt(storedLength, 10);
        }
    },

    // Save PIN length
    savePinLength(length) {
        this.expectedPinLength = length;
        localStorage.setItem('habit_pin_length', length.toString());
    },

    // Bind event listeners
    bindEvents() {
        // Lock screen keypad - use event delegation for better performance
        document.querySelector('#lock-screen .pin-keypad').addEventListener('click', (e) => {
            const key = e.target.closest('.key');
            if (key) this.handleLockKeyPress(key.dataset.key);
        });

        // Setup screen keypad
        document.querySelector('#pin-setup-screen .pin-keypad').addEventListener('click', (e) => {
            const key = e.target.closest('.key');
            if (key) this.handleSetupKeyPress(key.dataset.key);
        });

        // Forgot PIN button
        document.getElementById('forgot-pin').addEventListener('click', () => {
            this.showForgotPINConfirm();
        });
    },

    // Check initial auth state
    checkAuthState() {
        if (Storage.isPINSetup()) {
            this.showLockScreen();
        } else {
            this.showSetupScreen();
        }
    },

    // Show lock screen
    showLockScreen() {
        document.getElementById('lock-screen').classList.add('active');
        document.getElementById('pin-setup-screen').classList.remove('active');
        document.getElementById('app-screen').classList.remove('active');
        document.getElementById('forgot-pin').classList.remove('hidden');
        this.setupLockScreenDots();
        this.resetLockScreen();
    },

    // Setup lock screen dots based on expected PIN length
    setupLockScreenDots() {
        const dots = document.querySelectorAll('#lock-screen .pin-dot');
        dots.forEach((dot, index) => {
            if (index < this.expectedPinLength) {
                dot.classList.remove('hidden');
            } else {
                dot.classList.add('hidden');
            }
        });
    },

    // Show setup screen
    showSetupScreen() {
        document.getElementById('lock-screen').classList.remove('active');
        document.getElementById('pin-setup-screen').classList.add('active');
        document.getElementById('app-screen').classList.remove('active');
        this.resetSetupScreen();
    },

    // Show main app
    showApp() {
        document.getElementById('lock-screen').classList.remove('active');
        document.getElementById('pin-setup-screen').classList.remove('active');
        document.getElementById('app-screen').classList.add('active');

        // Initialize the app
        if (typeof App !== 'undefined') {
            App.init();
        }
    },

    // Handle lock screen key press
    handleLockKeyPress(key) {
        if (this.isLockedOut || !key) return;

        if (key === 'delete') {
            this.currentPIN = this.currentPIN.slice(0, -1);
            this.updatePINDisplay('lock-screen');
        } else if (this.currentPIN.length < this.expectedPinLength) {
            this.currentPIN += key;
            this.updatePINDisplay('lock-screen');

            // Auto-submit when PIN reaches expected length
            if (this.currentPIN.length === this.expectedPinLength) {
                // Small delay for visual feedback
                setTimeout(() => this.attemptUnlock(), 100);
            }
        }
    },

    // Handle setup screen key press
    handleSetupKeyPress(key) {
        if (!key) return;

        if (key === 'delete') {
            if (this.isConfirmStep) {
                this.confirmPIN = this.confirmPIN.slice(0, -1);
            } else {
                this.setupPIN = this.setupPIN.slice(0, -1);
            }
        } else if (key === 'confirm') {
            this.handleSetupConfirm();
            return;
        } else {
            if (this.isConfirmStep) {
                if (this.confirmPIN.length < 6) {
                    this.confirmPIN += key;
                }
            } else {
                if (this.setupPIN.length < 6) {
                    this.setupPIN += key;
                }
            }
        }

        this.updateSetupDisplay();
    },

    // Handle setup confirmation
    handleSetupConfirm() {
        if (!this.isConfirmStep) {
            // First step: validate PIN length
            if (this.setupPIN.length < 4) {
                this.showSetupError('PIN must be at least 4 digits');
                return;
            }

            // Move to confirm step
            this.isConfirmStep = true;
            this.expectedPinLength = this.setupPIN.length;
            document.getElementById('setup-title').textContent = 'Confirm PIN';
            document.getElementById('setup-subtitle').textContent = 'Enter the same PIN again';
            this.updateSetupDisplay();
        } else {
            // Second step: verify PINs match
            if (this.confirmPIN !== this.setupPIN) {
                this.showSetupError('PINs do not match');
                this.resetSetupScreen();
                return;
            }

            // Setup complete - save PIN length
            this.savePinLength(this.setupPIN.length);

            if (Storage.setupPIN(this.setupPIN)) {
                this.showApp();
                Utils.showToast('PIN created successfully');
            } else {
                this.showSetupError('Failed to create PIN');
            }
        }
    },

    // Attempt to unlock
    attemptUnlock() {
        if (Storage.verifyPIN(this.currentPIN)) {
            // Success
            this.failedAttempts = 0;
            this.showApp();
        } else {
            this.handleFailedAttempt();
        }
    },

    // Handle failed unlock attempt
    handleFailedAttempt() {
        this.failedAttempts++;
        this.currentPIN = '';

        if (this.failedAttempts >= this.maxAttempts) {
            this.startLockout();
        } else {
            const remaining = this.maxAttempts - this.failedAttempts;
            this.showLockError(`Incorrect PIN. ${remaining} attempt${remaining > 1 ? 's' : ''} remaining`);
            this.shakePINDisplay('lock-screen');
        }

        this.updatePINDisplay('lock-screen');
    },

    // Start lockout period
    startLockout() {
        this.isLockedOut = true;
        let remaining = this.lockoutDuration / 1000;

        const lockoutInterval = setInterval(() => {
            remaining--;
            if (remaining <= 0) {
                clearInterval(lockoutInterval);
                this.isLockedOut = false;
                this.failedAttempts = 0;
                this.showLockError('');
                document.getElementById('lock-subtitle').textContent = 'Enter your PIN to unlock';
            } else {
                document.getElementById('lock-subtitle').textContent = `Too many attempts. Try again in ${remaining}s`;
            }
        }, 1000);

        this.showLockError('Too many failed attempts');
        document.getElementById('lock-subtitle').textContent = `Try again in ${remaining}s`;
    },

    // Update PIN display dots
    updatePINDisplay(screenId) {
        const screen = document.getElementById(screenId);
        const dots = screen.querySelectorAll('.pin-dot:not(.hidden)');
        const pin = this.currentPIN;

        dots.forEach((dot, index) => {
            dot.classList.toggle('filled', index < pin.length);
        });
    },

    // Update setup display
    updateSetupDisplay() {
        const dots = document.querySelectorAll('#pin-setup-screen .pin-dot');
        const pin = this.isConfirmStep ? this.confirmPIN : this.setupPIN;

        dots.forEach((dot, index) => {
            dot.classList.toggle('filled', index < pin.length);
        });
    },

    // Show lock screen error
    showLockError(message) {
        const errorEl = document.getElementById('lock-error');
        if (message) {
            errorEl.textContent = message;
            errorEl.classList.remove('hidden');
        } else {
            errorEl.classList.add('hidden');
        }
    },

    // Show setup screen error
    showSetupError(message) {
        const errorEl = document.getElementById('setup-error');
        if (message) {
            errorEl.textContent = message;
            errorEl.classList.remove('hidden');
            this.shakePINDisplay('pin-setup-screen');
        } else {
            errorEl.classList.add('hidden');
        }
    },

    // Shake PIN display animation
    shakePINDisplay(screenId) {
        const display = document.querySelector(`#${screenId} .pin-display`);
        display.classList.add('shake');
        setTimeout(() => display.classList.remove('shake'), 500);
    },

    // Reset lock screen
    resetLockScreen() {
        this.currentPIN = '';
        this.updatePINDisplay('lock-screen');
        this.showLockError('');
        document.getElementById('lock-title').textContent = 'Enter PIN';
        document.getElementById('lock-subtitle').textContent = 'Enter your PIN to unlock';
    },

    // Reset setup screen
    resetSetupScreen() {
        this.setupPIN = '';
        this.confirmPIN = '';
        this.isConfirmStep = false;
        document.getElementById('setup-title').textContent = 'Create PIN';
        document.getElementById('setup-subtitle').textContent = 'Choose a 4-6 digit PIN';
        this.showSetupError('');
        this.updateSetupDisplay();
    },

    // Show forgot PIN confirmation
    showForgotPINConfirm() {
        Utils.showConfirm(
            'Reset App?',
            'This will delete ALL your data including habits and progress. This cannot be undone.',
            () => {
                Storage.clearAll();
                localStorage.removeItem('habit_pin_length');
                this.expectedPinLength = 4;
                this.showSetupScreen();
                Utils.showToast('All data cleared');
            }
        );
    }
};
