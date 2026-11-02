package com.daymark.api.stats;

import com.daymark.api.habit.HabitData;
import com.daymark.api.habit.HabitData.Habit;
import com.daymark.api.habit.HabitData.Snapshot;
import com.daymark.api.habit.HabitStreakCalculator;
import com.daymark.api.user.CurrentUser;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class StatsService {
    private static final int MAX_CALENDAR_DAYS = 92;
    private static final int HISTORY_DAYS = 366;

    public record DayStat(LocalDate date, int total, int completed) {}

    public record HabitInsight(long id, String name, String icon, String categoryColor, int streak,
                               int longestStreak, int rate30, List<String> last7) {}

    public record CategoryInsight(String name, String color, int completed) {}

    public record Insights(int weekCheckIns, int lastWeekCheckIns, int bestStreak, int longestStreak,
                           int completionRate30, int activeHabits, List<DayStat> week,
                           List<HabitInsight> habits, List<CategoryInsight> categories) {}

    private final HabitData habitData;
    private final CurrentUser currentUser;

    public StatsService(HabitData habitData, CurrentUser currentUser) {
        this.habitData = habitData;
        this.currentUser = currentUser;
    }

    public List<DayStat> calendar(LocalDate from, LocalDate to, Long categoryId) {
        if (to.isBefore(from) || ChronoUnit.DAYS.between(from, to) >= MAX_CALENDAR_DAYS) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Choose a date range of up to " + MAX_CALENDAR_DAYS + " days.");
        }
        Snapshot snapshot = habitData.load(currentUser.id(), from, to);
        List<Habit> habits = snapshot.habits().stream()
                .filter(habit -> !habit.archived())
                .filter(habit -> categoryId == null || categoryId.equals(habit.categoryId()))
                .toList();
        return days(habits, snapshot, from, to);
    }

    public Insights insights() {
        LocalDate today = currentUser.today();
        LocalDate thisWeek = today.minusDays(today.getDayOfWeek().getValue() - 1L);
        LocalDate lastWeek = thisWeek.minusDays(7);
        Snapshot snapshot = habitData.load(currentUser.id(), today.minusDays(HISTORY_DAYS), today);
        List<Habit> active = snapshot.habits().stream().filter(habit -> !habit.archived()).toList();

        List<DayStat> week = days(active, snapshot, thisWeek, thisWeek.plusDays(6));
        int weekCheckIns = week.stream().mapToInt(DayStat::completed).sum();
        int lastWeekCheckIns = days(active, snapshot, lastWeek, lastWeek.plusDays(6)).stream()
                .mapToInt(DayStat::completed).sum();

        LocalDate windowStart = today.minusDays(29);
        int dueTotal = 0;
        int doneTotal = 0;
        int bestStreak = 0;
        int longestStreak = 0;
        List<HabitInsight> habits = new ArrayList<>();
        Map<String, int[]> categoryTotals = new LinkedHashMap<>();
        Map<String, String> categoryColors = new LinkedHashMap<>();

        for (Habit habit : active) {
            Set<LocalDate> completed = snapshot.completedFor(habit.id());
            int due = 0;
            int done = 0;
            int completedInWindow = 0;
            for (LocalDate day = windowStart; !day.isAfter(today); day = day.plusDays(1)) {
                boolean isDone = completed.contains(day);
                if (isDone) completedInWindow++;
                if (habit.isDueOn(day)) {
                    due++;
                    if (isDone) done++;
                }
            }
            dueTotal += due;
            doneTotal += done;

            int streak = HabitStreakCalculator.current(today, habit.days(), completed);
            int longest = HabitStreakCalculator.longest(today, habit.days(), completed, habit.startDate());
            bestStreak = Math.max(bestStreak, streak);
            longestStreak = Math.max(longestStreak, longest);

            List<String> last7 = new ArrayList<>();
            for (LocalDate day = today.minusDays(6); !day.isAfter(today); day = day.plusDays(1)) {
                if (completed.contains(day)) last7.add("done");
                else if (!habit.isDueOn(day)) last7.add("off");
                else last7.add(day.equals(today) ? "pending" : "missed");
            }

            habits.add(new HabitInsight(habit.id(), habit.name(), habit.icon(),
                    habit.categoryColor() == null ? "slate" : habit.categoryColor(),
                    streak, longest, percent(done, due), last7));

            String category = habit.categoryName() == null ? "Uncategorized" : habit.categoryName();
            categoryColors.putIfAbsent(category, habit.categoryColor() == null ? "slate" : habit.categoryColor());
            categoryTotals.computeIfAbsent(category, name -> new int[1])[0] += completedInWindow;
        }

        List<CategoryInsight> categories = categoryTotals.entrySet().stream()
                .map(entry -> new CategoryInsight(entry.getKey(), categoryColors.get(entry.getKey()), entry.getValue()[0]))
                .sorted(Comparator.comparingInt(CategoryInsight::completed).reversed())
                .toList();

        return new Insights(weekCheckIns, lastWeekCheckIns, bestStreak, longestStreak,
                percent(doneTotal, dueTotal), active.size(), week, habits, categories);
    }

    private List<DayStat> days(List<Habit> habits, Snapshot snapshot, LocalDate from, LocalDate to) {
        List<DayStat> stats = new ArrayList<>();
        for (LocalDate day = from; !day.isAfter(to); day = day.plusDays(1)) {
            int total = 0;
            int completed = 0;
            for (Habit habit : habits) {
                boolean done = snapshot.completedFor(habit.id()).contains(day);
                if (done) completed++;
                if (done || habit.isDueOn(day)) total++;
            }
            stats.add(new DayStat(day, total, completed));
        }
        return stats;
    }

    private int percent(int part, int whole) {
        return whole == 0 ? 0 : Math.min(100, Math.round(part * 100f / whole));
    }
}
