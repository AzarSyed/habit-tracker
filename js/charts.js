/**
 * Charts Module - Handles analytics and chart rendering
 */

const Charts = {
    weeklyChart: null,
    currentMonth: new Date().getMonth(),
    currentYear: new Date().getFullYear(),
    selectedHabitId: 'all',

    // Initialize charts
    init() {
        this.bindEvents();
        this.updateHabitFilter();
        this.render();
    },

    // Bind event listeners
    bindEvents() {
        // Month navigation
        document.getElementById('prev-month').addEventListener('click', () => {
            this.navigateMonth(-1);
        });

        document.getElementById('next-month').addEventListener('click', () => {
            this.navigateMonth(1);
        });

        // Habit filter
        document.getElementById('habit-filter').addEventListener('change', (e) => {
            this.selectedHabitId = e.target.value;
            this.render();
        });
    },

    // Navigate months
    navigateMonth(direction) {
        this.currentMonth += direction;

        if (this.currentMonth > 11) {
            this.currentMonth = 0;
            this.currentYear++;
        } else if (this.currentMonth < 0) {
            this.currentMonth = 11;
            this.currentYear--;
        }

        this.renderCalendar();
    },

    // Update habit filter dropdown
    updateHabitFilter() {
        const filter = document.getElementById('habit-filter');
        const habits = Habits.getAll();

        filter.innerHTML = '<option value="all">All Habits</option>' +
            habits.map(h => `<option value="${h.id}">${Views.escapeHtml(h.name)}</option>`).join('');
    },

    // Main render function
    render() {
        this.renderStats();
        this.renderWeeklyChart();
        this.renderCalendar();
        this.renderGoals();
    },

    // Refresh (called after data changes)
    refresh() {
        this.render();
    },

    // Render statistics cards
    renderStats() {
        const habitId = this.selectedHabitId === 'all' ? null : this.selectedHabitId;
        const stats = Habits.getStats(habitId);

        document.getElementById('current-streak').textContent = stats.currentStreak;
        document.getElementById('longest-streak').textContent = stats.longestStreak;
        document.getElementById('monthly-completion').textContent = stats.monthlyCompletion + '%';
        document.getElementById('total-completions').textContent = stats.totalCompletions;
    },

    // Render weekly progress chart
    renderWeeklyChart() {
        const ctx = document.getElementById('weekly-chart').getContext('2d');

        // Destroy existing chart
        if (this.weeklyChart) {
            this.weeklyChart.destroy();
        }

        // Get last 4 weeks of data
        const weeks = this.getLast4WeeksData();

        // Get theme colors
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const textColor = isDark ? '#ffffff' : '#1d1d1f';
        const gridColor = isDark ? '#38383a' : '#e8e8ed';

        this.weeklyChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: weeks.labels,
                datasets: [{
                    label: 'Completion %',
                    data: weeks.data,
                    backgroundColor: '#007aff',
                    borderRadius: 6,
                    borderSkipped: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => `${context.raw}% completed`
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            color: textColor,
                            callback: (value) => value + '%'
                        },
                        grid: {
                            color: gridColor
                        }
                    },
                    x: {
                        ticks: {
                            color: textColor
                        },
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    },

    // Get last 4 weeks data
    getLast4WeeksData() {
        const habits = this.selectedHabitId === 'all' ?
            Habits.getAll() :
            [Habits.getById(this.selectedHabitId)].filter(Boolean);

        const labels = [];
        const data = [];

        const today = new Date();
        let weekStart = Views.getWeekStart(today);

        for (let w = 0; w < 4; w++) {
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 6);

            // Calculate week label
            if (w === 0) {
                labels.unshift('This Week');
            } else if (w === 1) {
                labels.unshift('Last Week');
            } else {
                const startStr = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                labels.unshift(startStr);
            }

            // Calculate completion percentage
            let totalPossible = 0;
            let totalCompleted = 0;

            habits.forEach(habit => {
                for (let d = 0; d < 7; d++) {
                    const date = new Date(weekStart);
                    date.setDate(date.getDate() + d);

                    // Only count days up to today
                    if (date <= today) {
                        totalPossible++;
                        if (Habits.isCompleted(habit.id, date)) {
                            totalCompleted++;
                        }
                    }
                }
            });

            const percent = totalPossible > 0 ? Math.round((totalCompleted / totalPossible) * 100) : 0;
            data.unshift(percent);

            // Move to previous week
            weekStart.setDate(weekStart.getDate() - 7);
        }

        return { labels, data };
    },

    // Render calendar
    renderCalendar() {
        // Update month title
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'];
        document.getElementById('calendar-month').textContent =
            `${monthNames[this.currentMonth]} ${this.currentYear}`;

        // Get calendar data
        const calendarData = this.getCalendarData();
        const container = document.getElementById('calendar-days');

        container.innerHTML = calendarData.map(day => {
            if (day.empty) {
                return '<div class="calendar-day empty"></div>';
            }

            let className = 'calendar-day';
            if (day.percent === 100) {
                className += ' complete';
            } else if (day.percent > 0) {
                className += ' partial';
            }
            if (day.isToday) {
                className += ' today';
            }

            return `<div class="${className}">${day.day}</div>`;
        }).join('');
    },

    // Get calendar data
    getCalendarData() {
        const habits = this.selectedHabitId === 'all' ?
            Habits.getAll() :
            [Habits.getById(this.selectedHabitId)].filter(Boolean);

        const firstDay = new Date(this.currentYear, this.currentMonth, 1);
        const lastDay = new Date(this.currentYear, this.currentMonth + 1, 0);
        const daysInMonth = lastDay.getDate();

        // Get day of week for first day (0 = Sunday, adjust for Monday start)
        let startDay = firstDay.getDay() - 1;
        if (startDay === -1) startDay = 6;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const data = [];

        // Add empty cells for days before month starts
        for (let i = 0; i < startDay; i++) {
            data.push({ empty: true });
        }

        // Add days of month
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(this.currentYear, this.currentMonth, day);
            const isToday = date.getTime() === today.getTime();
            const isFuture = date > today;

            let completed = 0;
            let total = habits.length;

            if (!isFuture && habits.length > 0) {
                habits.forEach(habit => {
                    if (Habits.isCompleted(habit.id, date)) {
                        completed++;
                    }
                });
            }

            const percent = total > 0 && !isFuture ? Math.round((completed / total) * 100) : 0;

            data.push({
                day,
                percent,
                isToday
            });
        }

        return data;
    },

    // Render goals progress
    renderGoals() {
        const habits = Habits.getAll();
        const container = document.getElementById('goals-list');

        if (habits.length === 0) {
            container.innerHTML = '<p style="color: var(--text-muted); text-align: center;">Add habits to track goals</p>';
            return;
        }

        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        const html = habits.map(habit => {
            const completed = Habits.getMonthlyCompletions(habit.id, currentYear, currentMonth);
            const target = habit.monthlyTarget;
            const percent = Math.min(Math.round((completed / target) * 100), 100);

            return `
                <div class="goal-item">
                    <div class="goal-header">
                        <span class="goal-name">${Views.escapeHtml(habit.name)}</span>
                        <span class="goal-progress-text">${completed}/${target} days</span>
                    </div>
                    <div class="goal-bar">
                        <div class="goal-fill" style="width: ${percent}%"></div>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = html;
    }
};
