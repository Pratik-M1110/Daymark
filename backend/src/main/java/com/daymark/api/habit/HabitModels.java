package com.daymark.api.habit;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Set;

public final class HabitModels {
    private HabitModels() {}

    public enum TrackType { YES_NO, MEASURABLE }

    /** How often a reminder fires: every day, on the habit's scheduled days, on chosen weekdays, or every N days. */
    public enum RepeatKind { DAILY, HABIT_DAYS, CUSTOM_DAYS, EVERY_N_DAYS }

    public record ReminderInput(
            Long id,
            @NotNull LocalTime time,
            @NotNull RepeatKind repeat,
            Set<DayOfWeek> days,
            @Min(2) @Max(365) Integer intervalDays,
            @Size(max = 120) String message,
            Boolean enabled) {}

    public record HabitRequest(
            @NotBlank @Size(max = 80) String name,
            Long categoryId,
            @NotBlank @Pattern(regexp = "[a-z]{2,16}", message = "must be a known icon name") String icon,
            @Size(max = 40) String goal,
            @NotEmpty Set<DayOfWeek> scheduledDays,
            Boolean archived,
            TrackType trackType,
            @DecimalMin(value = "0.01") BigDecimal targetValue,
            @Size(max = 24) String unit,
            @Size(max = 10) List<@Valid ReminderInput> reminders) {}

    /** Yes/no habits send {@code completed}; measurable habits send {@code value} (or {@code completed} to log the full target). */
    public record CheckInRequest(@NotNull LocalDate date, Boolean completed, @DecimalMin(value = "0") BigDecimal value) {}

    public record CheckInEntry(LocalDate date, boolean completed, BigDecimal value) {}

    public record ReminderResponse(long id, LocalTime time, RepeatKind repeat, Set<DayOfWeek> days,
                                   Integer intervalDays, String message, boolean enabled) {}

    public record HabitResponse(
            long id,
            String name,
            Long categoryId,
            String categoryName,
            String categoryColor,
            String icon,
            String goal,
            TrackType trackType,
            BigDecimal targetValue,
            String unit,
            int weeklyTarget,
            Set<DayOfWeek> scheduledDays,
            boolean archived,
            LocalDate startDate,
            int streak,
            boolean dueOnDate,
            boolean completed,
            BigDecimal value,
            int weekCompleted,
            List<ReminderResponse> reminders) {}

    public record ReminderDue(long habitId, String habitName, String icon, String categoryColor,
                              LocalTime time, String message, boolean completed) {}
}
