/**
 * Workouts Module - Handles exercise CRUD, logging, and PR tracking
 * Pattern: Mirrors Habits module structure
 */
const Workouts = {
    // ==================== ID GENERATION ====================

    generateId(prefix = 'exercise') {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    },

    // ==================== EXERCISE CRUD ====================

    // Get all active exercises
    getAll() {
        const data = Storage.getData();
        return data && data.exercises ? data.exercises.filter(e => e.isActive !== false) : [];
    },

    // Get all including inactive (for history)
    getAllIncludingInactive() {
        const data = Storage.getData();
        return data && data.exercises ? data.exercises : [];
    },

    // Get exercise by ID
    getById(id) {
        const exercises = this.getAllIncludingInactive();
        return exercises.find(e => e.id === id);
    },

    // Add new exercise
    add(exercise) {
        const data = Storage.getData();
        if (!data) return false;

        if (!data.exercises) data.exercises = [];
        if (!data.workoutLogs) data.workoutLogs = {};
        if (!data.personalRecords) data.personalRecords = {};

        const newExercise = {
            id: this.generateId('exercise'),
            name: exercise.name.trim(),
            type: exercise.type || 'custom',
            category: exercise.category || null,
            trackWeight: exercise.trackWeight || false,
            trackDuration: exercise.trackDuration || false,
            trackDistance: exercise.trackDistance || false,
            unit: exercise.unit || 'reps',
            goal: exercise.goal || { type: 'daily', target: 0 },
            notes: exercise.notes || '',
            createdAt: new Date().toISOString(),
            isActive: true
        };

        data.exercises.push(newExercise);
        data.personalRecords[newExercise.id] = {};

        return Storage.saveData(data) ? newExercise : false;
    },

    // Update exercise
    update(id, updates) {
        const data = Storage.getData();
        if (!data || !data.exercises) return false;

        const index = data.exercises.findIndex(e => e.id === id);
        if (index === -1) return false;

        data.exercises[index] = {
            ...data.exercises[index],
            ...updates,
            id: id // Preserve ID
        };

        return Storage.saveData(data);
    },

    // Soft delete (preserve history)
    delete(id) {
        return this.update(id, { isActive: false });
    },

    // ==================== WORKOUT LOGGING ====================

    // Log a workout entry
    logWorkout(exerciseId, logData) {
        const data = Storage.getData();
        if (!data) return false;

        const exercise = this.getById(exerciseId);
        if (!exercise) return false;

        const dateStr = this.formatDate(new Date());

        if (!data.workoutLogs) data.workoutLogs = {};
        if (!data.workoutLogs[dateStr]) data.workoutLogs[dateStr] = [];

        const newLog = {
            id: this.generateId('log'),
            exerciseId: exerciseId,
            timestamp: new Date().toISOString(),
            sets: logData.sets || [],
            totalReps: this.calculateTotalReps(logData.sets),
            totalWeight: this.calculateTotalWeight(logData.sets),
            totalCount: logData.totalCount || null,
            duration: logData.duration || null,
            distance: logData.distance || null,
            notes: logData.notes || ''
        };

        data.workoutLogs[dateStr].push(newLog);

        // Update PRs
        this.updatePersonalRecords(data, exerciseId, newLog, dateStr);

        return Storage.saveData(data) ? newLog : false;
    },

    // Update existing log entry
    updateLog(dateStr, logId, updates) {
        const data = Storage.getData();
        if (!data || !data.workoutLogs || !data.workoutLogs[dateStr]) return false;

        const logIndex = data.workoutLogs[dateStr].findIndex(l => l.id === logId);
        if (logIndex === -1) return false;

        const existingLog = data.workoutLogs[dateStr][logIndex];

        data.workoutLogs[dateStr][logIndex] = {
            ...existingLog,
            ...updates,
            id: logId,
            exerciseId: existingLog.exerciseId,
            totalReps: this.calculateTotalReps(updates.sets || existingLog.sets),
            totalWeight: this.calculateTotalWeight(updates.sets || existingLog.sets)
        };

        // Recalculate PRs for this exercise
        this.recalculatePRs(data, existingLog.exerciseId);

        return Storage.saveData(data);
    },

    // Delete log entry
    deleteLog(dateStr, logId) {
        const data = Storage.getData();
        if (!data || !data.workoutLogs || !data.workoutLogs[dateStr]) return false;

        const log = data.workoutLogs[dateStr].find(l => l.id === logId);
        if (!log) return false;

        const exerciseId = log.exerciseId;
        data.workoutLogs[dateStr] = data.workoutLogs[dateStr].filter(l => l.id !== logId);

        // Clean up empty date entries
        if (data.workoutLogs[dateStr].length === 0) {
            delete data.workoutLogs[dateStr];
        }

        // Recalculate PRs
        this.recalculatePRs(data, exerciseId);

        return Storage.saveData(data);
    },

    // Get logs for a specific date
    getLogsForDate(date) {
        const data = Storage.getData();
        const dateStr = this.formatDate(date);
        return data && data.workoutLogs && data.workoutLogs[dateStr]
            ? data.workoutLogs[dateStr]
            : [];
    },

    // Get all logs for an exercise
    getLogsForExercise(exerciseId, limit = null) {
        const data = Storage.getData();
        if (!data || !data.workoutLogs) return [];

        const logs = [];
        const dates = Object.keys(data.workoutLogs).sort().reverse();

        for (const dateStr of dates) {
            const dayLogs = data.workoutLogs[dateStr]
                .filter(l => l.exerciseId === exerciseId)
                .map(l => ({ ...l, date: dateStr }));
            logs.push(...dayLogs);

            if (limit && logs.length >= limit) {
                return logs.slice(0, limit);
            }
        }

        return logs;
    },

    // ==================== CALCULATIONS ====================

    calculateTotalReps(sets) {
        if (!sets || !Array.isArray(sets)) return 0;
        return sets.reduce((sum, set) => sum + (set.reps || set.count || 0), 0);
    },

    calculateTotalWeight(sets) {
        if (!sets || !Array.isArray(sets)) return null;
        const weights = sets.filter(s => s.weight).map(s => s.weight * (s.reps || 1));
        return weights.length > 0 ? weights.reduce((a, b) => a + b, 0) : null;
    },

    // ==================== PERSONAL RECORDS ====================

    updatePersonalRecords(data, exerciseId, log, dateStr) {
        if (!data.personalRecords) data.personalRecords = {};
        if (!data.personalRecords[exerciseId]) data.personalRecords[exerciseId] = {};

        const pr = data.personalRecords[exerciseId];
        const exercise = this.getById(exerciseId);

        // Max single set reps
        if (log.sets && log.sets.length > 0) {
            const maxSetReps = Math.max(...log.sets.map(s => s.reps || s.count || 0));
            if (!pr.maxReps || maxSetReps > pr.maxReps.value) {
                pr.maxReps = { value: maxSetReps, date: dateStr, logId: log.id };
            }
        }

        // Max volume (total in session)
        const volume = log.totalReps || log.totalCount || 0;
        if (volume > 0 && (!pr.maxVolume || volume > pr.maxVolume.value)) {
            pr.maxVolume = { value: volume, date: dateStr, logId: log.id };
        }

        // Max weight (if tracked)
        if (exercise && exercise.trackWeight && log.sets) {
            const maxWeight = Math.max(...log.sets.filter(s => s.weight).map(s => s.weight), 0);
            if (maxWeight > 0 && (!pr.maxWeight || maxWeight > pr.maxWeight.value)) {
                pr.maxWeight = { value: maxWeight, date: dateStr, logId: log.id };
            }
        }

        // Max sets in one session
        if (log.sets && log.sets.length > 0) {
            if (!pr.maxSets || log.sets.length > pr.maxSets.value) {
                pr.maxSets = { value: log.sets.length, date: dateStr, logId: log.id };
            }
        }

        // Max duration (if tracked)
        if (log.duration && (!pr.maxDuration || log.duration > pr.maxDuration.value)) {
            pr.maxDuration = { value: log.duration, date: dateStr, logId: log.id };
        }

        // Max distance (if tracked)
        if (log.distance && (!pr.maxDistance || log.distance > pr.maxDistance.value)) {
            pr.maxDistance = { value: log.distance, date: dateStr, logId: log.id };
        }
    },

    recalculatePRs(data, exerciseId) {
        // Reset PRs for this exercise
        if (!data.personalRecords) data.personalRecords = {};
        data.personalRecords[exerciseId] = {};

        // Iterate all logs and recalculate
        if (data.workoutLogs) {
            for (const dateStr of Object.keys(data.workoutLogs)) {
                const logs = data.workoutLogs[dateStr].filter(l => l.exerciseId === exerciseId);
                for (const log of logs) {
                    this.updatePersonalRecords(data, exerciseId, log, dateStr);
                }
            }
        }
    },

    getPersonalRecords(exerciseId) {
        const data = Storage.getData();
        return data && data.personalRecords && data.personalRecords[exerciseId]
            ? data.personalRecords[exerciseId]
            : {};
    },

    // Check if a log entry is a PR
    isPR(exerciseId, logId) {
        const prs = this.getPersonalRecords(exerciseId);
        return Object.values(prs).some(pr => pr && pr.logId === logId);
    },

    // ==================== STATISTICS ====================

    getStats(exerciseId = null, period = 'week') {
        const data = Storage.getData();
        if (!data || !data.workoutLogs) return this.emptyStats();

        const periodDates = this.getPeriodDates(period);

        let totalSessions = 0;
        let totalVolume = 0;
        let daysWorkedOut = new Set();

        for (const dateStr of periodDates) {
            if (!data.workoutLogs[dateStr]) continue;

            const dayLogs = exerciseId
                ? data.workoutLogs[dateStr].filter(l => l.exerciseId === exerciseId)
                : data.workoutLogs[dateStr];

            if (dayLogs.length > 0) {
                daysWorkedOut.add(dateStr);
                totalSessions += dayLogs.length;

                for (const log of dayLogs) {
                    totalVolume += log.totalReps || log.totalCount || 0;
                }
            }
        }

        return {
            totalSessions,
            totalVolume,
            daysWorkedOut: daysWorkedOut.size,
            averagePerDay: daysWorkedOut.size > 0
                ? Math.round(totalVolume / daysWorkedOut.size)
                : 0
        };
    },

    emptyStats() {
        return { totalSessions: 0, totalVolume: 0, daysWorkedOut: 0, averagePerDay: 0 };
    },

    getPeriodDates(period) {
        const dates = [];
        const today = new Date();
        let days = period === 'week' ? 7 : period === 'month' ? 30 : 7;

        for (let i = 0; i < days; i++) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            dates.push(this.formatDate(d));
        }

        return dates;
    },

    // ==================== GOAL TRACKING ====================

    getGoalProgress(exerciseId, date = new Date()) {
        const exercise = this.getById(exerciseId);
        if (!exercise || !exercise.goal || !exercise.goal.target) return null;

        const logs = this.getLogsForExercise(exerciseId);
        let total = 0;
        const periodDates = this.getGoalPeriodDates(exercise.goal.type, date);

        for (const log of logs) {
            if (periodDates.includes(log.date)) {
                total += log.totalReps || log.totalCount || 0;
            }
        }

        return {
            current: total,
            target: exercise.goal.target,
            percent: exercise.goal.target > 0
                ? Math.min(Math.round((total / exercise.goal.target) * 100), 100)
                : 0
        };
    },

    getGoalPeriodDates(goalType, referenceDate) {
        const dates = [];
        const d = new Date(referenceDate);

        if (goalType === 'daily') {
            dates.push(this.formatDate(d));
        } else if (goalType === 'weekly') {
            const dayOfWeek = d.getDay();
            const monday = new Date(d);
            monday.setDate(d.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
            for (let i = 0; i < 7; i++) {
                const date = new Date(monday);
                date.setDate(monday.getDate() + i);
                dates.push(this.formatDate(date));
            }
        } else if (goalType === 'monthly') {
            const year = d.getFullYear();
            const month = d.getMonth();
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            for (let i = 1; i <= daysInMonth; i++) {
                dates.push(this.formatDate(new Date(year, month, i)));
            }
        }

        return dates;
    },

    // ==================== UTILITIES ====================

    formatDate(date) {
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },

    // Get weekly data for charts
    getWeeklyChartData(exerciseId = null) {
        const data = [];
        const labels = [];
        const today = new Date();

        for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const dateStr = this.formatDate(d);

            labels.push(d.toLocaleDateString('en-US', { weekday: 'short' }));

            const logs = this.getLogsForDate(d);
            const filteredLogs = exerciseId
                ? logs.filter(l => l.exerciseId === exerciseId)
                : logs;

            const dayTotal = filteredLogs.reduce((sum, l) =>
                sum + (l.totalReps || l.totalCount || 0), 0);
            data.push(dayTotal);
        }

        return { labels, data };
    }
};
