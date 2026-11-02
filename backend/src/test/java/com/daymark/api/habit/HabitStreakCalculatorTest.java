package com.daymark.api.habit;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.EnumSet;
import java.util.Set;
import org.junit.jupiter.api.Test;

class HabitStreakCalculatorTest {
    private static final LocalDate TODAY = LocalDate.of(2026, 10, 31);

    @Test
    void skipsUnscheduledDaysWhenCountingStreak() {
        Set<DayOfWeek> schedule = EnumSet.of(DayOfWeek.MONDAY, DayOfWeek.WEDNESDAY, DayOfWeek.FRIDAY);
        Set<LocalDate> completed = Set.of(
                LocalDate.of(2026, 10, 30), LocalDate.of(2026, 10, 28), LocalDate.of(2026, 10, 26));

        assertEquals(3, HabitStreakCalculator.current(TODAY, schedule, completed));
    }

    @Test
    void missedScheduledDayBreaksStreak() {
        Set<LocalDate> completed = Set.of(LocalDate.of(2026, 10, 31), LocalDate.of(2026, 10, 29));

        assertEquals(1, HabitStreakCalculator.current(TODAY, EnumSet.allOf(DayOfWeek.class), completed));
    }

    @Test
    void startsFromYesterdayWhenTodayIsScheduledButNotDone() {
        Set<LocalDate> completed = Set.of(LocalDate.of(2026, 10, 30), LocalDate.of(2026, 10, 29));

        assertEquals(2, HabitStreakCalculator.current(TODAY, EnumSet.allOf(DayOfWeek.class), completed));
    }

    @Test
    void longestStreakFindsBestRunEvenAfterABreak() {
        Set<LocalDate> completed = Set.of(
                LocalDate.of(2026, 10, 10), LocalDate.of(2026, 10, 11), LocalDate.of(2026, 10, 12), LocalDate.of(2026, 10, 13),
                LocalDate.of(2026, 10, 30));

        assertEquals(4, HabitStreakCalculator.longest(
                TODAY, EnumSet.allOf(DayOfWeek.class), completed, LocalDate.of(2026, 10, 1)));
    }

    @Test
    void openTodayDoesNotResetLongestStreak() {
        Set<LocalDate> completed = Set.of(LocalDate.of(2026, 10, 29), LocalDate.of(2026, 10, 30));

        assertEquals(2, HabitStreakCalculator.longest(
                TODAY, EnumSet.allOf(DayOfWeek.class), completed, LocalDate.of(2026, 10, 20)));
    }
}
