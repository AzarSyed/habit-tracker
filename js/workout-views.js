/**
 * WorkoutViews Module - Handles workout UI rendering
 * Pattern: Mirrors Views module with event delegation
 */
const WorkoutViews = {
    currentDate: new Date(),
    currentExerciseId: null,
    viewMode: 'daily',
    initialized: false,

    // ==================== INITIALIZATION ====================

    init() {
        if (this.initialized) {
            this.render();
            return;
        }
        this.bindEvents();
        this.render();
        this.initialized = true;
    },

    bindEvents() {
        // Date navigation
        document.getElementById('workout-prev-day')?.addEventListener('click', () => {
            this.navigateDay(-1);
        });

        document.getElementById('workout-next-day')?.addEventListener('click', () => {
            this.navigateDay(1);
        });

        // Today button
        document.getElementById('workout-today-btn')?.addEventListener('click', () => {
            this.currentDate = new Date();
            this.render();
        });

        // View mode toggle
        document.getElementById('workout-view-toggle')?.addEventListener('click', () => {
            this.toggleViewMode();
        });

        // Settings button
        document.getElementById('workout-settings-btn')?.addEventListener('click', () => {
            App.showSettings();
        });

        // Add exercise button
        document.getElementById('add-exercise-btn')?.addEventListener('click', () => {
            this.showExerciseModal();
        });

        // Exercise modal events
        document.getElementById('exercise-modal-close')?.addEventListener('click', () => {
            this.hideExerciseModal();
        });

        document.getElementById('exercise-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveExercise();
        });

        document.getElementById('delete-exercise')?.addEventListener('click', () => {
            this.deleteCurrentExercise();
        });

        // Log modal events
        document.getElementById('log-modal-close')?.addEventListener('click', () => {
            this.hideLogModal();
        });

        document.getElementById('log-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveLog();
        });

        document.getElementById('add-set-btn')?.addEventListener('click', () => {
            this.addSetRow();
        });

        // Event delegation for exercise list
        document.getElementById('workout-exercises-list')?.addEventListener('click', (e) => {
            const card = e.target.closest('.exercise-card');
            if (!card) return;

            const exerciseId = card.dataset.exerciseId;
            const action = e.target.closest('[data-action]')?.dataset.action;

            if (action === 'log') {
                this.showLogModal(exerciseId);
            } else if (action === 'edit') {
                this.showExerciseModal(exerciseId);
            } else if (action === 'history') {
                this.showExerciseHistory(exerciseId);
            }
        });

        // Event delegation for log entries
        document.getElementById('workout-log-entries')?.addEventListener('click', (e) => {
            const entry = e.target.closest('.log-entry');
            if (!entry) return;

            const logId = entry.dataset.logId;
            const dateStr = entry.dataset.date;
            const action = e.target.closest('[data-action]')?.dataset.action;

            if (action === 'delete-log') {
                this.confirmDeleteLog(dateStr, logId);
            }
        });

        // Exercise filter for history view
        document.getElementById('exercise-history-filter')?.addEventListener('change', (e) => {
            this.currentExerciseId = e.target.value || null;
            this.renderHistoryView();
        });
    },

    // ==================== NAVIGATION ====================

    navigateDay(direction) {
        this.currentDate.setDate(this.currentDate.getDate() + direction);
        this.render();
    },

    toggleViewMode() {
        this.viewMode = this.viewMode === 'daily' ? 'history' : 'daily';
        this.render();
    },

    // ==================== MAIN RENDER ====================

    render() {
        this.updateDateDisplay();

        if (this.viewMode === 'daily') {
            this.renderDailyView();
        } else {
            this.renderHistoryView();
        }
    },

    updateDateDisplay() {
        const isToday = Workouts.formatDate(this.currentDate) === Workouts.formatDate(new Date());
        const dateText = isToday
            ? 'Today'
            : this.currentDate.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric'
            });

        const dateEl = document.getElementById('workout-current-date');
        if (dateEl) dateEl.textContent = dateText;

        // Show/hide today button
        const todayBtn = document.getElementById('workout-today-btn');
        if (todayBtn) {
            todayBtn.classList.toggle('hidden', isToday);
        }
    },

    // ==================== DAILY VIEW ====================

    renderDailyView() {
        document.getElementById('workout-daily-view')?.classList.add('active');
        document.getElementById('workout-history-view')?.classList.remove('active');

        const exercises = Workouts.getAll();
        const logs = Workouts.getLogsForDate(this.currentDate);

        this.renderExerciseList(exercises, logs);
        this.renderDayLogs(logs);
    },

    renderExerciseList(exercises, todayLogs) {
        const container = document.getElementById('workout-exercises-list');
        const emptyState = document.getElementById('workout-empty-state');

        if (!container) return;

        if (exercises.length === 0) {
            container.innerHTML = '';
            emptyState?.classList.remove('hidden');
            return;
        }

        emptyState?.classList.add('hidden');

        const html = exercises.map(exercise => {
            const exerciseLogs = todayLogs.filter(l => l.exerciseId === exercise.id);
            const todayTotal = exerciseLogs.reduce((sum, l) =>
                sum + (l.totalReps || l.totalCount || 0), 0);

            const goalProgress = Workouts.getGoalProgress(exercise.id, this.currentDate);
            const prs = Workouts.getPersonalRecords(exercise.id);

            // Check if any of today's logs are PRs
            const hasPRToday = exerciseLogs.some(l => Workouts.isPR(exercise.id, l.id));

            return `
                <div class="exercise-card" data-exercise-id="${exercise.id}">
                    <div class="exercise-header">
                        <div class="exercise-info">
                            <span class="exercise-name">${this.escapeHtml(exercise.name)}</span>
                            <span class="exercise-type ${exercise.type}">${exercise.type}</span>
                            ${hasPRToday ? '<span class="pr-badge">PR!</span>' : ''}
                        </div>
                        <button class="exercise-more" data-action="edit">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="1"></circle>
                                <circle cx="12" cy="5" r="1"></circle>
                                <circle cx="12" cy="19" r="1"></circle>
                            </svg>
                        </button>
                    </div>

                    <div class="exercise-stats">
                        <div class="stat">
                            <span class="stat-value">${todayTotal}</span>
                            <span class="stat-label">${exercise.unit} today</span>
                        </div>
                        ${goalProgress && goalProgress.target > 0 ? `
                        <div class="stat">
                            <div class="mini-progress">
                                <div class="mini-progress-fill" style="width: ${goalProgress.percent}%"></div>
                            </div>
                            <span class="stat-label">${goalProgress.current}/${goalProgress.target}</span>
                        </div>
                        ` : ''}
                        ${prs.maxVolume ? `
                        <div class="stat">
                            <span class="stat-value pr">${prs.maxVolume.value}</span>
                            <span class="stat-label">PR</span>
                        </div>
                        ` : ''}
                    </div>

                    <div class="exercise-actions">
                        <button class="btn btn-primary btn-small" data-action="log">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="12" y1="5" x2="12" y2="19"></line>
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                            </svg>
                            Log
                        </button>
                        <button class="btn btn-secondary btn-small" data-action="history">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                            </svg>
                            History
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = html;
    },

    renderDayLogs(logs) {
        const container = document.getElementById('workout-log-entries');
        const titleEl = document.getElementById('workout-log-title');

        if (!container) return;

        // Update title based on date
        const isToday = Workouts.formatDate(this.currentDate) === Workouts.formatDate(new Date());
        if (titleEl) {
            titleEl.textContent = isToday ? "Today's Log" : "Day's Log";
        }

        if (logs.length === 0) {
            container.innerHTML = '<p class="no-logs">No workouts logged for this day</p>';
            return;
        }

        const dateStr = Workouts.formatDate(this.currentDate);

        const html = logs.map(log => {
            const exercise = Workouts.getById(log.exerciseId);
            if (!exercise) return '';

            const isPR = Workouts.isPR(log.exerciseId, log.id);
            const time = new Date(log.timestamp).toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit'
            });

            let setsDisplay = '';
            if (log.sets && log.sets.length > 0) {
                setsDisplay = log.sets.map((set, i) => {
                    const reps = set.reps || set.count || 0;
                    const weight = set.weight ? ` @ ${set.weight}kg` : '';
                    return `<span class="set-pill">Set ${i + 1}: ${reps}${weight}</span>`;
                }).join('');
            }

            return `
                <div class="log-entry ${isPR ? 'is-pr' : ''}" data-log-id="${log.id}" data-date="${dateStr}">
                    <div class="log-header">
                        <span class="log-exercise-name">${this.escapeHtml(exercise.name)}</span>
                        <span class="log-time">${time}</span>
                        ${isPR ? '<span class="pr-badge">PR!</span>' : ''}
                    </div>
                    <div class="log-sets">${setsDisplay}</div>
                    <div class="log-totals">
                        <span>Total: ${log.totalReps || log.totalCount || 0} ${exercise.unit}</span>
                        ${log.duration ? `<span>Duration: ${log.duration} min</span>` : ''}
                        ${log.distance ? `<span>Steps: ${log.distance}</span>` : ''}
                        ${log.notes ? `<span class="log-notes">${this.escapeHtml(log.notes)}</span>` : ''}
                    </div>
                    <div class="log-actions">
                        <button class="btn-icon danger" data-action="delete-log" title="Delete">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = html;
    },

    // ==================== HISTORY VIEW ====================

    renderHistoryView() {
        document.getElementById('workout-daily-view')?.classList.remove('active');
        document.getElementById('workout-history-view')?.classList.add('active');

        this.updateExerciseFilter();

        const exerciseId = this.currentExerciseId;

        if (exerciseId) {
            this.renderExerciseHistoryDetail(exerciseId);
        } else {
            this.renderAllExercisesSummary();
        }
    },

    updateExerciseFilter() {
        const filter = document.getElementById('exercise-history-filter');
        if (!filter) return;

        const exercises = Workouts.getAll();
        filter.innerHTML = '<option value="">All Exercises</option>' +
            exercises.map(e => `<option value="${e.id}" ${e.id === this.currentExerciseId ? 'selected' : ''}>${this.escapeHtml(e.name)}</option>`).join('');
    },

    renderExerciseHistoryDetail(exerciseId) {
        const container = document.getElementById('workout-history-content');
        if (!container) return;

        const exercise = Workouts.getById(exerciseId);
        if (!exercise) return;

        const logs = Workouts.getLogsForExercise(exerciseId, 50);
        const prs = Workouts.getPersonalRecords(exerciseId);
        const weeklyStats = Workouts.getStats(exerciseId, 'week');
        const monthlyStats = Workouts.getStats(exerciseId, 'month');

        const html = `
            <div class="history-header">
                <h3>${this.escapeHtml(exercise.name)}</h3>
                <span class="exercise-type ${exercise.type}">${exercise.type}</span>
            </div>

            <div class="pr-cards">
                ${prs.maxVolume ? `
                <div class="pr-card">
                    <span class="pr-value">${prs.maxVolume.value}</span>
                    <span class="pr-label">Best Session</span>
                    <span class="pr-date">${prs.maxVolume.date}</span>
                </div>` : ''}
                ${prs.maxReps ? `
                <div class="pr-card">
                    <span class="pr-value">${prs.maxReps.value}</span>
                    <span class="pr-label">Best Set</span>
                    <span class="pr-date">${prs.maxReps.date}</span>
                </div>` : ''}
                ${prs.maxWeight ? `
                <div class="pr-card">
                    <span class="pr-value">${prs.maxWeight.value}kg</span>
                    <span class="pr-label">Max Weight</span>
                    <span class="pr-date">${prs.maxWeight.date}</span>
                </div>` : ''}
            </div>

            <div class="history-stats">
                <div class="stat-row">
                    <span>This Week</span>
                    <span>${weeklyStats.totalVolume} ${exercise.unit} in ${weeklyStats.daysWorkedOut} days</span>
                </div>
                <div class="stat-row">
                    <span>This Month</span>
                    <span>${monthlyStats.totalVolume} ${exercise.unit} in ${monthlyStats.daysWorkedOut} days</span>
                </div>
            </div>

            <h4>Recent History</h4>
            <div class="history-list">
                ${logs.length > 0 ? logs.map(log => {
                    const isPR = Workouts.isPR(exerciseId, log.id);
                    return `
                        <div class="history-entry ${isPR ? 'is-pr' : ''}">
                            <div class="history-date">${log.date}</div>
                            <div class="history-value">${log.totalReps || log.totalCount || 0} ${exercise.unit}</div>
                            ${isPR ? '<span class="pr-badge">PR</span>' : ''}
                        </div>
                    `;
                }).join('') : '<p class="no-logs">No history yet</p>'}
            </div>
        `;

        container.innerHTML = html;
    },

    renderAllExercisesSummary() {
        const container = document.getElementById('workout-history-content');
        if (!container) return;

        const exercises = Workouts.getAll();
        const weeklyStats = Workouts.getStats(null, 'week');

        const html = `
            <div class="summary-header">
                <h3>Weekly Summary</h3>
            </div>

            <div class="summary-cards">
                <div class="summary-card">
                    <span class="summary-value">${weeklyStats.daysWorkedOut}</span>
                    <span class="summary-label">Days Active</span>
                </div>
                <div class="summary-card">
                    <span class="summary-value">${weeklyStats.totalSessions}</span>
                    <span class="summary-label">Total Sessions</span>
                </div>
            </div>

            <h4>Exercise Breakdown</h4>
            <div class="exercise-breakdown">
                ${exercises.length > 0 ? exercises.map(exercise => {
                    const stats = Workouts.getStats(exercise.id, 'week');
                    const prs = Workouts.getPersonalRecords(exercise.id);

                    return `
                        <div class="breakdown-row">
                            <span class="breakdown-name">${this.escapeHtml(exercise.name)}</span>
                            <span class="breakdown-value">${stats.totalVolume} ${exercise.unit}</span>
                            ${prs.maxVolume ? `<span class="breakdown-pr">PR: ${prs.maxVolume.value}</span>` : ''}
                        </div>
                    `;
                }).join('') : '<p class="no-logs">No exercises yet</p>'}
            </div>
        `;

        container.innerHTML = html;
    },

    showExerciseHistory(exerciseId) {
        this.currentExerciseId = exerciseId;
        this.viewMode = 'history';
        this.render();
    },

    // ==================== EXERCISE MODAL ====================

    showExerciseModal(exerciseId = null) {
        const modal = document.getElementById('exercise-modal');
        const title = document.getElementById('exercise-modal-title');
        const form = document.getElementById('exercise-form');
        const deleteBtn = document.getElementById('delete-exercise');

        if (!modal || !form) return;

        form.reset();
        form.dataset.exerciseId = exerciseId || '';

        if (exerciseId) {
            const exercise = Workouts.getById(exerciseId);
            if (exercise) {
                title.textContent = 'Edit Exercise';
                document.getElementById('exercise-name').value = exercise.name;
                document.getElementById('exercise-type').value = exercise.type;
                document.getElementById('exercise-unit').value = exercise.unit;
                document.getElementById('exercise-track-weight').checked = exercise.trackWeight;
                document.getElementById('exercise-track-duration').checked = exercise.trackDuration;
                document.getElementById('exercise-goal-type').value = exercise.goal?.type || 'daily';
                document.getElementById('exercise-goal-target').value = exercise.goal?.target || 0;
                deleteBtn.classList.remove('hidden');
            }
        } else {
            title.textContent = 'Add Exercise';
            deleteBtn.classList.add('hidden');
        }

        modal.classList.add('active');
    },

    hideExerciseModal() {
        document.getElementById('exercise-modal')?.classList.remove('active');
    },

    saveExercise() {
        const form = document.getElementById('exercise-form');
        const exerciseId = form.dataset.exerciseId;

        const exerciseData = {
            name: document.getElementById('exercise-name').value,
            type: document.getElementById('exercise-type').value,
            unit: document.getElementById('exercise-unit').value,
            trackWeight: document.getElementById('exercise-track-weight').checked,
            trackDuration: document.getElementById('exercise-track-duration').checked,
            goal: {
                type: document.getElementById('exercise-goal-type').value,
                target: parseInt(document.getElementById('exercise-goal-target').value) || 0
            }
        };

        if (!exerciseData.name.trim()) {
            Utils.showToast('Please enter an exercise name');
            return;
        }

        const success = exerciseId
            ? Workouts.update(exerciseId, exerciseData)
            : Workouts.add(exerciseData);

        if (success) {
            this.hideExerciseModal();
            this.render();
            Utils.showToast(exerciseId ? 'Exercise updated' : 'Exercise added');
        } else {
            Utils.showToast('Failed to save exercise');
        }
    },

    deleteCurrentExercise() {
        const form = document.getElementById('exercise-form');
        const exerciseId = form.dataset.exerciseId;

        if (!exerciseId) return;

        Utils.showConfirm(
            'Delete Exercise?',
            'This will hide this exercise. Your workout history will be preserved.',
            () => {
                if (Workouts.delete(exerciseId)) {
                    this.hideExerciseModal();
                    this.render();
                    Utils.showToast('Exercise deleted');
                }
            }
        );
    },

    // ==================== LOG MODAL ====================

    showLogModal(exerciseId) {
        const modal = document.getElementById('log-modal');
        const exercise = Workouts.getById(exerciseId);
        if (!exercise || !modal) return;

        document.getElementById('log-modal-title').textContent = `Log ${exercise.name}`;
        document.getElementById('log-form').dataset.exerciseId = exerciseId;

        // Show/hide optional fields based on exercise config
        const durationGroup = document.getElementById('log-duration-group');
        const distanceGroup = document.getElementById('log-distance-group');

        if (durationGroup) {
            durationGroup.classList.toggle('hidden', !exercise.trackDuration);
        }

        // Show distance for steps/jumps unit
        if (distanceGroup) {
            const showDistance = exercise.unit === 'steps' || exercise.unit === 'jumps';
            distanceGroup.classList.toggle('hidden', !showDistance);
            const label = distanceGroup.querySelector('label');
            if (label) {
                label.textContent = exercise.unit === 'steps' ? 'Total Steps' : 'Total Jumps';
            }
        }

        // Reset form
        document.getElementById('log-duration').value = '';
        document.getElementById('log-distance').value = '';
        document.getElementById('log-notes').value = '';

        // Reset sets - add one empty set row
        const setsContainer = document.getElementById('log-sets-container');
        setsContainer.innerHTML = this.createSetRowHTML(0, exercise);

        modal.classList.add('active');
    },

    hideLogModal() {
        document.getElementById('log-modal')?.classList.remove('active');
    },

    createSetRowHTML(index, exercise) {
        const unit = exercise.unit || 'reps';
        const showWeight = exercise.trackWeight;

        return `
            <div class="set-row" data-set-index="${index}">
                <span class="set-number">Set ${index + 1}</span>
                <input type="number" class="set-reps" placeholder="${unit}" min="0">
                ${showWeight ? '<input type="number" class="set-weight" placeholder="kg" min="0" step="0.5">' : ''}
                <button type="button" class="remove-set" onclick="WorkoutViews.removeSetRow(${index})">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
        `;
    },

    addSetRow() {
        const container = document.getElementById('log-sets-container');
        const exerciseId = document.getElementById('log-form').dataset.exerciseId;
        const exercise = Workouts.getById(exerciseId);

        if (!container || !exercise) return;

        const currentSets = container.querySelectorAll('.set-row').length;
        container.insertAdjacentHTML('beforeend', this.createSetRowHTML(currentSets, exercise));
    },

    removeSetRow(index) {
        const container = document.getElementById('log-sets-container');
        const rows = container.querySelectorAll('.set-row');
        if (rows.length > 1) {
            rows[index]?.remove();
            // Renumber remaining sets
            container.querySelectorAll('.set-row').forEach((row, i) => {
                row.dataset.setIndex = i;
                row.querySelector('.set-number').textContent = `Set ${i + 1}`;
            });
        } else {
            Utils.showToast('Need at least one set');
        }
    },

    saveLog() {
        const form = document.getElementById('log-form');
        const exerciseId = form.dataset.exerciseId;
        const exercise = Workouts.getById(exerciseId);

        if (!exercise) return;

        // Gather sets data
        const setRows = document.querySelectorAll('#log-sets-container .set-row');
        const sets = Array.from(setRows).map(row => {
            const reps = parseInt(row.querySelector('.set-reps').value) || 0;
            const weightInput = row.querySelector('.set-weight');
            const weight = weightInput ? parseFloat(weightInput.value) || null : null;

            return { reps, weight, count: reps };
        }).filter(set => set.reps > 0);

        // For cardio without sets, use distance as total count
        const distance = parseInt(document.getElementById('log-distance')?.value) || null;

        if (sets.length === 0 && !distance) {
            Utils.showToast('Please enter at least one set or count');
            return;
        }

        const logData = {
            sets,
            duration: parseInt(document.getElementById('log-duration')?.value) || null,
            distance: distance,
            totalCount: distance || null,
            notes: document.getElementById('log-notes')?.value || ''
        };

        const result = Workouts.logWorkout(exerciseId, logData);

        if (result) {
            this.hideLogModal();
            this.render();

            // Check if it's a PR
            if (Workouts.isPR(exerciseId, result.id)) {
                Utils.showToast('New Personal Record!');
            } else {
                Utils.showToast('Workout logged');
            }
        } else {
            Utils.showToast('Failed to log workout');
        }
    },

    confirmDeleteLog(dateStr, logId) {
        Utils.showConfirm(
            'Delete Log Entry?',
            'This will permanently delete this workout entry.',
            () => {
                if (Workouts.deleteLog(dateStr, logId)) {
                    this.render();
                    Utils.showToast('Log entry deleted');
                }
            }
        );
    },

    // ==================== UTILITIES ====================

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};
