package com.daymark.api.habit;

import com.daymark.api.habit.HabitModels.RepeatKind;
import com.daymark.api.habit.HabitModels.TrackType;
import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/** Loads a user's habits, schedules, reminders and check-ins for reuse across services. */
@Component
public class HabitData {
    public record Habit(long id, String name, Long categoryId, String categoryName, String categoryColor,
                        String icon, String goal, TrackType trackType, BigDecimal targetValue, String unit,
                        boolean archived, LocalDate startDate, Set<DayOfWeek> days, List<Reminder> reminders) {
        public boolean isDueOn(LocalDate date) {
            return days.contains(date.getDayOfWeek()) && !date.isBefore(startDate);
        }

        public boolean isMeasurable() {
            return trackType == TrackType.MEASURABLE;
        }
    }

    public record Reminder(long id, LocalTime time, RepeatKind repeat, Set<DayOfWeek> days, Integer intervalDays,
                           String message, boolean enabled) {
        public boolean firesOn(Habit habit, LocalDate date) {
            if (!enabled || date.isBefore(habit.startDate())) return false;
            return switch (repeat) {
                case DAILY -> true;
                case HABIT_DAYS -> habit.days().contains(date.getDayOfWeek());
                case CUSTOM_DAYS -> days.contains(date.getDayOfWeek());
                case EVERY_N_DAYS -> intervalDays != null
                        && ChronoUnit.DAYS.between(habit.startDate(), date) % intervalDays == 0;
            };
        }
    }

    public record Snapshot(List<Habit> habits, Map<Long, Set<LocalDate>> completed,
                           Map<Long, Map<LocalDate, BigDecimal>> values) {
        public Set<LocalDate> completedFor(long habitId) {
            return completed.getOrDefault(habitId, Set.of());
        }

        public BigDecimal valueFor(long habitId, LocalDate date) {
            return values.getOrDefault(habitId, Map.of()).get(date);
        }
    }

    private record ScheduleRow(long habitId, DayOfWeek day) {}

    private record CheckInRow(long habitId, LocalDate date, boolean completed, BigDecimal value) {}

    private record ReminderRow(long habitId, Reminder reminder) {}

    private final JdbcClient jdbc;

    public HabitData(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public static String joinDays(Set<DayOfWeek> days) {
        return days == null || days.isEmpty() ? null : days.stream().map(Enum::name).collect(Collectors.joining(","));
    }

    public static Set<DayOfWeek> splitDays(String value) {
        if (value == null || value.isBlank()) return Set.of();
        return Arrays.stream(value.split(",")).map(DayOfWeek::valueOf)
                .collect(Collectors.toCollection(() -> EnumSet.noneOf(DayOfWeek.class)));
    }

    public Snapshot load(long userId, LocalDate from, LocalDate to) {
        Map<Long, Set<DayOfWeek>> schedules = new HashMap<>();
        jdbc.sql("""
                SELECT d.habit_id, d.day_of_week
                FROM habit_schedule_days d
                JOIN habits h ON h.id = d.habit_id
                WHERE h.user_id = :userId
                """)
                .param("userId", userId)
                .query((row, n) -> new ScheduleRow(row.getLong("habit_id"), DayOfWeek.valueOf(row.getString("day_of_week"))))
                .list()
                .forEach(row -> schedules.computeIfAbsent(row.habitId(), id -> EnumSet.noneOf(DayOfWeek.class)).add(row.day()));

        Map<Long, List<Reminder>> reminders = new HashMap<>();
        jdbc.sql("""
                SELECT r.id, r.habit_id, r.remind_at, r.repeat_kind, r.days, r.interval_days, r.message, r.enabled
                FROM habit_reminders r
                JOIN habits h ON h.id = r.habit_id
                WHERE h.user_id = :userId
                ORDER BY r.remind_at, r.id
                """)
                .param("userId", userId)
                .query((row, n) -> new ReminderRow(row.getLong("habit_id"), new Reminder(row.getLong("id"),
                        row.getObject("remind_at", LocalTime.class), RepeatKind.valueOf(row.getString("repeat_kind")),
                        splitDays(row.getString("days")), row.getObject("interval_days", Integer.class),
                        row.getString("message"), row.getBoolean("enabled"))))
                .list()
                .forEach(row -> reminders.computeIfAbsent(row.habitId(), id -> new ArrayList<>()).add(row.reminder()));

        List<Habit> habits = jdbc.sql("""
                SELECT h.id, h.name, h.category_id, c.name AS category_name, c.color AS category_color,
                       h.icon, h.goal, h.track_type, h.target_value, h.unit, h.archived, h.start_date
                FROM habits h
                LEFT JOIN categories c ON c.id = h.category_id
                WHERE h.user_id = :userId
                ORDER BY h.sort_order, h.id
                """)
                .param("userId", userId)
                .query((row, n) -> {
                    long id = row.getLong("id");
                    return new Habit(id, row.getString("name"), row.getObject("category_id", Long.class),
                            row.getString("category_name"), row.getString("category_color"),
                            row.getString("icon"), row.getString("goal"), TrackType.valueOf(row.getString("track_type")),
                            row.getBigDecimal("target_value"), row.getString("unit"), row.getBoolean("archived"),
                            row.getObject("start_date", LocalDate.class),
                            Set.copyOf(schedules.getOrDefault(id, Set.of())),
                            List.copyOf(reminders.getOrDefault(id, List.of())));
                })
                .list();

        Map<Long, Set<LocalDate>> completed = new HashMap<>();
        Map<Long, Map<LocalDate, BigDecimal>> values = new HashMap<>();
        jdbc.sql("""
                SELECT habit_id, entry_date, completed, value
                FROM habit_check_ins
                WHERE user_id = :userId AND entry_date BETWEEN :from AND :to
                """)
                .param("userId", userId)
                .param("from", from)
                .param("to", to)
                .query((row, n) -> new CheckInRow(row.getLong("habit_id"), row.getObject("entry_date", LocalDate.class),
                        row.getBoolean("completed"), row.getBigDecimal("value")))
                .list()
                .forEach(row -> {
                    if (row.completed()) completed.computeIfAbsent(row.habitId(), id -> new HashSet<>()).add(row.date());
                    if (row.value() != null) values.computeIfAbsent(row.habitId(), id -> new HashMap<>()).put(row.date(), row.value());
                });

        return new Snapshot(habits, completed, values);
    }
}
