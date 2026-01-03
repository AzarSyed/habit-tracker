/**
 * Habits Module - Handles habit CRUD operations and completion tracking
 * OPTIMIZED: Uses cached Storage.getData() without PIN parameter
 */

const Habits = {
    // Generate unique ID
    generateId() {
        return 'habit_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    },

    // Get all habits
    getAll() {
        const data = Storage.getData();
        return data ? data.habits : [];
    },

    // Get habit by ID
    getById(id) {
        const habits = this.getAll();
        return habits.find(h => h.id === id);
    },

    // Add new habit
    add(habit) {
        const data = Storage.getData();
        if (!data) return false;

        const newHabit = {
            id: this.generateId(),
            name: habit.name.trim(),
            description: habit.description ? habit.description.trim() : '',
            monthlyTarget: habit.monthlyTarget || 20,
            createdAt: new Date().toISOString()
        };

        data.habits.push(newHabit);
        data.completions[newHabit.id] = [];

        return Storage.saveData(data);
    },

    // Update habit
    update(id, updates) {
        const data = Storage.getData();
        if (!data) return false;

        const index = data.habits.findIndex(h => h.id === id);
        if (index === -1) return false;

        data.habits[index] = {
            ...data.habits[index],
            name: updates.name.trim(),
            description: updates.description ? updates.description.trim() : '',
            monthlyTarget: updates.monthlyTarget || 20
        };

        return Storage.saveData(data);
    },

    // Delete habit
    delete(id) {
        const data = Storage.getData();
        if (!data) return false;

        data.habits = data.habits.filter(h => h.id !== id);
        delete data.completions[id];

        return Storage.saveData(data);
    },

    // Toggle completion for a date
    toggleCompletion(habitId, date) {
        const data = Storage.getData();
        if (!data) return false;

        const dateStr = this.formatDate(date);

        if (!data.completions[habitId]) {
            data.completions[habitId] = [];
        }

        const index = data.completions[habitId].indexOf(dateStr);
        if (index === -1) {
            // Add completion
            data.completions[habitId].push(dateStr);
        } else {
            // Remove completion
            data.completions[habitId].splice(index, 1);
        }

        return Storage.saveData(data);
    },

    // Check if habit is completed for a date
    isCompleted(habitId, date) {
        const data = Storage.getData();
        if (!data || !data.completions[habitId]) return false;

        const dateStr = this.formatDate(date);
        return data.completions[habitId].includes(dateStr);
    },

    // Get completions for a habit
    getCompletions(habitId) {
        const data = Storage.getData();
        if (!data || !data.completions[habitId]) return [];
        return data.completions[habitId];
    },

    // Get all completions
    getAllCompletions() {
        const data = Storage.getData();
        return data ? data.completions : {};
    },

    // Calculate current streak for a habit
    getCurrentStreak(habitId) {
        const completions = this.getCompletions(habitId);
        if (completions.length === 0) return 0;

        // Sort dates descending
        const sortedDates = completions
            .map(d => new Date(d))
            .sort((a, b) => b - a);

        let streak = 0;
        let currentDate = new Date();
        currentDate.setHours(0, 0, 0, 0);

        // Check if today is completed
        const todayStr = this.formatDate(currentDate);
        const todayCompleted = completions.includes(todayStr);

        // If today not completed, start checking from yesterday
        if (!todayCompleted) {
            currentDate.setDate(currentDate.getDate() - 1);
        }

        // Count consecutive days
        for (let i = 0; i < 365; i++) { // Max 1 year
            const dateStr = this.formatDate(currentDate);
            if (completions.includes(dateStr)) {
                streak++;
                currentDate.setDate(currentDate.getDate() - 1);
            } else {
                break;
            }
        }

        return streak;
    },

    // Calculate longest streak for a habit
    getLongestStreak(habitId) {
        const completions = this.getCompletions(habitId);
        if (completions.length === 0) return 0;

        // Sort dates ascending
        const sortedDates = completions
            .map(d => new Date(d))
            .sort((a, b) => a - b);

        let longestStreak = 1;
        let currentStreak = 1;

        for (let i = 1; i < sortedDates.length; i++) {
            const diff = (sortedDates[i] - sortedDates[i - 1]) / (1000 * 60 * 60 * 24);
            if (diff === 1) {
                currentStreak++;
                longestStreak = Math.max(longestStreak, currentStreak);
            } else {
                currentStreak = 1;
            }
        }

        return longestStreak;
    },

    // Get monthly completion count
    getMonthlyCompletions(habitId, year, month) {
        const completions = this.getCompletions(habitId);
        const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;

        return completions.filter(d => d.startsWith(monthStr)).length;
    },

    // Get weekly completions
    getWeeklyCompletions(habitId, weekStart) {
        const completions = this.getCompletions(habitId);
        let count = 0;

        for (let i = 0; i < 7; i++) {
            const date = new Date(weekStart);
            date.setDate(date.getDate() + i);
            const dateStr = this.formatDate(date);
            if (completions.includes(dateStr)) {
                count++;
            }
        }

        return count;
    },

    // Get overall stats
    getStats(habitId = null) {
        const habits = habitId ? [this.getById(habitId)].filter(Boolean) : this.getAll();
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        let totalCompletions = 0;
        let currentStreakTotal = 0;
        let longestStreakTotal = 0;
        let monthlyCompletions = 0;
        let monthlyTarget = 0;

        habits.forEach(habit => {
            const completions = this.getCompletions(habit.id);
            totalCompletions += completions.length;
            currentStreakTotal += this.getCurrentStreak(habit.id);
            longestStreakTotal = Math.max(longestStreakTotal, this.getLongestStreak(habit.id));
            monthlyCompletions += this.getMonthlyCompletions(habit.id, currentYear, currentMonth);
            monthlyTarget += habit.monthlyTarget;
        });

        const avgCurrentStreak = habits.length > 0 ? Math.round(currentStreakTotal / habits.length) : 0;
        const monthlyPercent = monthlyTarget > 0 ? Math.round((monthlyCompletions / monthlyTarget) * 100) : 0;

        return {
            totalCompletions,
            currentStreak: avgCurrentStreak,
            longestStreak: longestStreakTotal,
            monthlyCompletion: Math.min(monthlyPercent, 100),
            monthlyCompletions,
            monthlyTarget
        };
    },

    // Format date as YYYY-MM-DD
    formatDate(date) {
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },

    // Get dates for current week (Monday to Sunday)
    getWeekDates(referenceDate = new Date()) {
        const dates = [];
        const date = new Date(referenceDate);

        // Get Monday of the week
        const day = date.getDay();
        const diff = date.getDate() - day + (day === 0 ? -6 : 1);
        date.setDate(diff);

        for (let i = 0; i < 7; i++) {
            dates.push(new Date(date));
            date.setDate(date.getDate() + 1);
        }

        return dates;
    },

    // Check if date is today
    isToday(date) {
        const today = new Date();
        const d = new Date(date);
        return d.toDateString() === today.toDateString();
    },

    // Check if date is in the future
    isFuture(date) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        return d > today;
    }
};
