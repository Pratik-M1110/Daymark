package com.daymark.api.habit;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.Set;

public final class HabitStreakCalculator {
    private static final int LOOKBACK_DAYS = 366;

    private HabitStreakCalculator() {}

    /** Consecutive scheduled days completed, ending today (or yesterday if today is still open). */
    public static int current(LocalDate today, Set<DayOfWeek> scheduledDays, Set<LocalDate> completedDates) {
        if (scheduledDays.isEmpty()) return 0;

        LocalDate cursor = today;
        if (scheduledDays.contains(cursor.getDayOfWeek()) && !completedDates.contains(cursor)) {
            cursor = cursor.minusDays(1);
        }

        int streak = 0;
        LocalDate cutoff = today.minusDays(LOOKBACK_DAYS);
        while (!cursor.isBefore(cutoff)) {
            if (scheduledDays.contains(cursor.getDayOfWeek())) {
                if (!completedDates.contains(cursor)) break;
                streak++;
            }
            cursor = cursor.minusDays(1);
        }
        return streak;
    }

    /** Longest run of consecutive scheduled days completed since the habit started. */
    public static int longest(LocalDate today, Set<DayOfWeek> scheduledDays, Set<LocalDate> completedDates, LocalDate start) {
        LocalDate earliest = today.minusDays(LOOKBACK_DAYS);
        int best = 0;
        int run = 0;
        for (LocalDate day = start.isBefore(earliest) ? earliest : start; !day.isAfter(today); day = day.plusDays(1)) {
            if (!scheduledDays.contains(day.getDayOfWeek())) continue;
            if (completedDates.contains(day)) {
                run++;
                best = Math.max(best, run);
            } else if (!day.equals(today)) {
                run = 0;
            }
        }
        return best;
    }
}
