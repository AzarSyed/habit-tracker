/**
 * Views Module - Handles list and grid view rendering
 * OPTIMIZED: Event delegation, reduced DOM queries, debounced rendering
 */

const Views = {
    currentView: 'list',
    currentWeekStart: null,
    _renderTimeout: null,

    // Initialize views
    init() {
        this.currentWeekStart = this.getWeekStart(new Date());
        this.bindEvents();
        this.render();
    },

    // Bind event listeners using event delegation
    bindEvents() {
        // View toggle
        document.getElementById('view-toggle').addEventListener('click', () => {
            this.toggleView();
        });

        // Week navigation
        document.getElementById('prev-week').addEventListener('click', () => {
            this.navigateWeek(-1);
        });

        document.getElementById('next-week').addEventListener('click', () => {
            this.navigateWeek(1);
        });

        // Add habit button
        document.getElementById('add-habit-btn').addEventListener('click', () => {
            this.showHabitModal();
        });

        // Habit modal events
        document.getElementById('modal-close').addEventListener('click', () => {
            this.hideHabitModal();
        });

        document.getElementById('habit-modal').addEventListener('click', (e) => {
            if (e.target.id === 'habit-modal') {
                this.hideHabitModal();
            }
        });

        document.getElementById('habit-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveHabit();
        });

        document.getElementById('delete-habit').addEventListener('click', () => {
            this.deleteCurrentHabit();
        });

        // Event delegation for habit list
        document.getElementById('habits-list').addEventListener('click', (e) => {
            const card = e.target.closest('.habit-card');
            if (!card) return;

            const action = e.target.closest('[data-action]')?.dataset.action;
            const habitId = card.dataset.habitId;

            if (action === 'toggle') {
                this.toggleHabitCompletion(habitId, new Date());
            } else if (action === 'edit') {
                this.showHabitModal(habitId);
            }
        });

        // Event delegation for habit grid
        document.getElementById('habits-grid').addEventListener('click', (e) => {
            const cell = e.target.closest('.grid-cell:not(.future)');
            if (cell) {
                const habitId = cell.dataset.habitId;
                const date = new Date(cell.dataset.date);
                this.toggleHabitCompletion(habitId, date);
                return;
            }

            const name = e.target.closest('.grid-habit-name');
            if (name) {
                this.showHabitModal(name.dataset.habitId);
            }
        });
    },

    // Get Monday of the week
    getWeekStart(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        d.setDate(diff);
        d.setHours(0, 0, 0, 0);
        return d;
    },

    // Navigate weeks
    navigateWeek(direction) {
        this.currentWeekStart.setDate(this.currentWeekStart.getDate() + (direction * 7));
        this.render();
    },

    // Toggle between list and grid view
    toggleView() {
        this.currentView = this.currentView === 'list' ? 'grid' : 'list';

        const listView = document.getElementById('list-view');
        const gridView = document.getElementById('grid-view');
        const gridIcon = document.getElementById('grid-icon');
        const listIcon = document.getElementById('list-icon');

        const isList = this.currentView === 'list';
        listView.classList.toggle('active', isList);
        gridView.classList.toggle('active', !isList);
        gridIcon.classList.toggle('hidden', !isList);
        listIcon.classList.toggle('hidden', isList);

        this.render();
    },

    // Main render function
    render() {
        this.updateDateDisplay();

        if (this.currentView === 'list') {
            this.renderListView();
        } else {
            this.renderGridView();
        }
    },

    // Update date display
    updateDateDisplay() {
        const today = new Date();
        const weekStart = new Date(this.currentWeekStart);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);

        const currentWeekStart = this.getWeekStart(today);
        const isCurrentWeek = weekStart.getTime() === currentWeekStart.getTime();

        let displayText;
        if (isCurrentWeek) {
            displayText = `Today, ${today.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
        } else {
            const startStr = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const endStr = weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            displayText = `${startStr} - ${endStr}`;
        }

        document.getElementById('current-date').textContent = displayText;
    },

    // Render list view
    renderListView() {
        const habits = Habits.getAll();
        const listContainer = document.getElementById('habits-list');
        const emptyState = document.getElementById('empty-state');

        if (habits.length === 0) {
            listContainer.innerHTML = '';
            emptyState.classList.remove('hidden');
            return;
        }

        emptyState.classList.add('hidden');

        const today = new Date();
        const todayStr = Habits.formatDate(today);
        const data = Storage.getData();
        const completions = data ? data.completions : {};

        // Build HTML in one go
        const html = habits.map(habit => {
            const habitCompletions = completions[habit.id] || [];
            const isCompleted = habitCompletions.includes(todayStr);
            const streak = this.calculateStreak(habitCompletions);

            return `
                <div class="habit-card" data-habit-id="${habit.id}">
                    <button class="habit-checkbox ${isCompleted ? 'checked' : ''}" data-action="toggle">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                    </button>
                    <div class="habit-info" data-action="edit">
                        <div class="habit-name">${this.escapeHtml(habit.name)}</div>
                        ${habit.description ? `<div class="habit-description">${this.escapeHtml(habit.description)}</div>` : ''}
                    </div>
                    ${streak > 0 ? `<div class="habit-streak"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>${streak}</div>` : ''}
                    <button class="habit-edit" data-action="edit">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="1"></circle>
                            <circle cx="12" cy="5" r="1"></circle>
                            <circle cx="12" cy="19" r="1"></circle>
                        </svg>
                    </button>
                </div>
            `;
        }).join('');

        listContainer.innerHTML = html;
    },

    // Calculate streak (simplified for performance)
    calculateStreak(completions) {
        if (!completions || completions.length === 0) return 0;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let streak = 0;
        let checkDate = new Date(today);

        // Check if today is completed, if not start from yesterday
        const todayStr = Habits.formatDate(checkDate);
        if (!completions.includes(todayStr)) {
            checkDate.setDate(checkDate.getDate() - 1);
        }

        // Count consecutive days (max 100 for performance)
        for (let i = 0; i < 100; i++) {
            const dateStr = Habits.formatDate(checkDate);
            if (completions.includes(dateStr)) {
                streak++;
                checkDate.setDate(checkDate.getDate() - 1);
            } else {
                break;
            }
        }

        return streak;
    },

    // Render grid view
    renderGridView() {
        const habits = Habits.getAll();
        const weekDates = this.getWeekDates();
        const data = Storage.getData();
        const completions = data ? data.completions : {};
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Render day headers
        const daysHtml = weekDates.map(date => {
            const isToday = date.toDateString() === today.toDateString();
            const dayName = date.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2);
            return `<div class="grid-day ${isToday ? 'today' : ''}"><span class="grid-day-name">${dayName}</span><span class="grid-day-num">${date.getDate()}</span></div>`;
        }).join('');

        document.getElementById('grid-days').innerHTML = daysHtml;

        // Render habit rows
        const gridContainer = document.getElementById('habits-grid');

        if (habits.length === 0) {
            gridContainer.innerHTML = '<div class="empty-state"><p>No habits yet</p></div>';
            return;
        }

        const html = habits.map(habit => {
            const habitCompletions = completions[habit.id] || [];

            const cells = weekDates.map(date => {
                const dateStr = Habits.formatDate(date);
                const isCompleted = habitCompletions.includes(dateStr);
                const isFuture = date > today;

                return `<button class="grid-cell ${isCompleted ? 'completed' : ''} ${isFuture ? 'future' : ''}" data-habit-id="${habit.id}" data-date="${dateStr}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg></button>`;
            }).join('');

            return `<div class="grid-row"><div class="grid-habit-name" data-habit-id="${habit.id}">${this.escapeHtml(habit.name)}</div><div class="grid-cells">${cells}</div></div>`;
        }).join('');

        gridContainer.innerHTML = html;
    },

    // Get week dates starting from currentWeekStart
    getWeekDates() {
        const dates = [];
        const date = new Date(this.currentWeekStart);

        for (let i = 0; i < 7; i++) {
            dates.push(new Date(date));
            date.setDate(date.getDate() + 1);
        }

        return dates;
    },

    // Toggle habit completion
    toggleHabitCompletion(habitId, date) {
        if (Habits.toggleCompletion(habitId, date)) {
            this.render();
        }
    },

    // Show habit modal
    showHabitModal(habitId = null) {
        const modal = document.getElementById('habit-modal');
        const title = document.getElementById('modal-title');
        const form = document.getElementById('habit-form');
        const deleteBtn = document.getElementById('delete-habit');

        form.reset();
        form.dataset.habitId = habitId || '';

        if (habitId) {
            const habit = Habits.getById(habitId);
            if (habit) {
                title.textContent = 'Edit Habit';
                document.getElementById('habit-name').value = habit.name;
                document.getElementById('habit-description').value = habit.description || '';
                document.getElementById('habit-target').value = habit.monthlyTarget;
                deleteBtn.classList.remove('hidden');
            }
        } else {
            title.textContent = 'Add Habit';
            deleteBtn.classList.add('hidden');
        }

        modal.classList.add('active');
    },

    // Hide habit modal
    hideHabitModal() {
        document.getElementById('habit-modal').classList.remove('active');
    },

    // Save habit
    saveHabit() {
        const form = document.getElementById('habit-form');
        const habitId = form.dataset.habitId;

        const habitData = {
            name: document.getElementById('habit-name').value,
            description: document.getElementById('habit-description').value,
            monthlyTarget: parseInt(document.getElementById('habit-target').value) || 20
        };

        if (!habitData.name.trim()) {
            Utils.showToast('Please enter a habit name');
            return;
        }

        const success = habitId ? Habits.update(habitId, habitData) : Habits.add(habitData);

        if (success) {
            this.hideHabitModal();
            this.render();
            Utils.showToast(habitId ? 'Habit updated' : 'Habit added');

            if (typeof Charts !== 'undefined' && App.chartsInitialized) {
                Charts.updateHabitFilter();
            }
        } else {
            Utils.showToast('Failed to save habit');
        }
    },

    // Delete current habit
    deleteCurrentHabit() {
        const form = document.getElementById('habit-form');
        const habitId = form.dataset.habitId;

        if (!habitId) return;

        Utils.showConfirm(
            'Delete Habit?',
            'This will permanently delete this habit and all its progress.',
            () => {
                if (Habits.delete(habitId)) {
                    this.hideHabitModal();
                    this.render();
                    Utils.showToast('Habit deleted');

                    if (typeof Charts !== 'undefined' && App.chartsInitialized) {
                        Charts.updateHabitFilter();
                    }
                }
            }
        );
    },

    // Escape HTML to prevent XSS
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};
