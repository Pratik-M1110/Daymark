package com.daymark.api.habit;

import com.daymark.api.habit.HabitData.Habit;
import com.daymark.api.habit.HabitData.Reminder;
import com.daymark.api.habit.HabitData.Snapshot;
import com.daymark.api.habit.HabitModels.CheckInEntry;
import com.daymark.api.habit.HabitModels.CheckInRequest;
import com.daymark.api.habit.HabitModels.HabitRequest;
import com.daymark.api.habit.HabitModels.HabitResponse;
import com.daymark.api.habit.HabitModels.ReminderDue;
import com.daymark.api.habit.HabitModels.ReminderInput;
import com.daymark.api.habit.HabitModels.ReminderResponse;
import com.daymark.api.habit.HabitModels.RepeatKind;
import com.daymark.api.habit.HabitModels.TrackType;
import com.daymark.api.user.CurrentUser;
import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class HabitService {
    private static final int MAX_HISTORY_DAYS = 366;

    private record Tracking(TrackType type, BigDecimal target) {}

    private final JdbcClient jdbc;
    private final HabitData habitData;
    private final CurrentUser currentUser;

    public HabitService(JdbcClient jdbc, HabitData habitData, CurrentUser currentUser) {
        this.jdbc = jdbc;
        this.habitData = habitData;
        this.currentUser = currentUser;
    }

    public List<HabitResponse> list(LocalDate requestedDate) {
        LocalDate today = currentUser.today();
        LocalDate date = requestedDate == null ? today : requestedDate;
        LocalDate weekStart = date.minusDays(date.getDayOfWeek().getValue() - 1L);
        LocalDate weekEnd = weekStart.plusDays(6);
        LocalDate from = weekStart.isBefore(today.minusDays(366)) ? weekStart : today.minusDays(366);

        Snapshot snapshot = habitData.load(currentUser.id(), from, today.isAfter(weekEnd) ? today : weekEnd);
        return snapshot.habits().stream().map(habit -> {
            var completed = snapshot.completedFor(habit.id());
            int weekCompleted = (int) completed.stream()
                    .filter(day -> !day.isBefore(weekStart) && !day.isAfter(weekEnd))
                    .count();
            return new HabitResponse(habit.id(), habit.name(), habit.categoryId(), habit.categoryName(),
                    habit.categoryColor(), habit.icon(), habit.goal(), habit.trackType(), habit.targetValue(),
                    habit.unit(), habit.days().size(), habit.days(), habit.archived(), habit.startDate(),
                    HabitStreakCalculator.current(today, habit.days(), completed),
                    habit.isDueOn(date), completed.contains(date), snapshot.valueFor(habit.id(), date), weekCompleted,
                    habit.reminders().stream().map(HabitService::toResponse).toList());
        }).toList();
    }

    /** Reminders that fire on the given date, with whether the habit is already done. */
    public List<ReminderDue> remindersOn(LocalDate requestedDate) {
        LocalDate date = requestedDate == null ? currentUser.today() : requestedDate;
        Snapshot snapshot = habitData.load(currentUser.id(), date, date);
        return snapshot.habits().stream()
                .filter(habit -> !habit.archived())
                .flatMap(habit -> habit.reminders().stream()
                        .filter(reminder -> reminder.firesOn(habit, date))
                        .map(reminder -> new ReminderDue(habit.id(), habit.name(), habit.icon(),
                                habit.categoryColor() == null ? "slate" : habit.categoryColor(), reminder.time(),
                                reminder.message(), snapshot.completedFor(habit.id()).contains(date))))
                .sorted(Comparator.comparing(ReminderDue::time))
                .toList();
    }

    @Transactional
    public HabitResponse create(HabitRequest request) {
        long userId = currentUser.id();
        requireCategory(userId, request.categoryId());
        validateTracking(request);

        int sortOrder = jdbc.sql("SELECT COALESCE(MAX(sort_order), 0) + 1 FROM habits WHERE user_id = :userId")
                .param("userId", userId)
                .query(Integer.class)
                .single();

        KeyHolder keys = new GeneratedKeyHolder();
        jdbc.sql("""
                INSERT INTO habits (user_id, category_id, name, icon, goal, track_type, target_value, unit, sort_order, start_date)
                VALUES (:userId, :categoryId, :name, :icon, :goal, :trackType, :target, :unit, :sortOrder, :startDate)
                """)
                .param("sortOrder", sortOrder)
                .param("userId", userId)
                .param("categoryId", request.categoryId())
                .param("name", request.name().trim())
                .param("icon", request.icon())
                .param("goal", goalOf(request))
                .param("trackType", trackTypeOf(request).name())
                .param("target", targetOf(request))
                .param("unit", unitOf(request))
                .param("startDate", currentUser.today())
                .update(keys);
        long id = keys.getKey().longValue();
        replaceSchedule(id, request);
        replaceReminders(id, request.reminders());
        return find(id);
    }

    @Transactional
    public HabitResponse update(long id, HabitRequest request) {
        long userId = currentUser.id();
        requireOwned(userId, id);
        requireCategory(userId, request.categoryId());
        validateTracking(request);

        jdbc.sql("""
                UPDATE habits
                SET name = :name, category_id = :categoryId, icon = :icon, goal = :goal,
                    track_type = :trackType, target_value = :target, unit = :unit,
                    archived = COALESCE(:archived, archived)
                WHERE id = :id AND user_id = :userId
                """)
                .param("name", request.name().trim())
                .param("categoryId", request.categoryId())
                .param("icon", request.icon())
                .param("goal", goalOf(request))
                .param("trackType", trackTypeOf(request).name())
                .param("target", targetOf(request))
                .param("unit", unitOf(request))
                .param("archived", request.archived())
                .param("id", id)
                .param("userId", userId)
                .update();
        replaceSchedule(id, request);
        if (request.reminders() != null) replaceReminders(id, request.reminders());
        recomputeCompletion(id);
        return find(id);
    }

    @Transactional
    public void delete(long id) {
        int rows = jdbc.sql("DELETE FROM habits WHERE id = :id AND user_id = :userId")
                .param("id", id)
                .param("userId", currentUser.id())
                .update();
        if (rows == 0) throw notFound();
    }

    /** Creates or replaces the entry for a date. Works for today and any past date. */
    @Transactional
    public void recordCheckIn(long id, CheckInRequest request) {
        long userId = currentUser.id();
        Tracking tracking = trackingOf(userId, id);
        if (request.date().isAfter(currentUser.today())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "You cannot check in on a future date.");
        }

        boolean completed;
        BigDecimal value;
        if (tracking.type() == TrackType.MEASURABLE) {
            value = request.value();
            if (value == null) {
                if (request.completed() == null) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Enter the amount you did.");
                }
                value = request.completed() ? tracking.target() : BigDecimal.ZERO;
            }
            completed = reachesTarget(value, tracking.target());
        } else {
            if (request.completed() == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Say whether the habit was done.");
            }
            completed = request.completed();
            value = null;
        }

        jdbc.sql("""
                INSERT INTO habit_check_ins (habit_id, user_id, entry_date, completed, value)
                VALUES (:habitId, :userId, :date, :completed, :value)
                ON DUPLICATE KEY UPDATE completed = VALUES(completed), value = VALUES(value)
                """)
                .param("habitId", id)
                .param("userId", userId)
                .param("date", request.date())
                .param("completed", completed)
                .param("value", value)
                .update();
        if (completed || (value != null && value.signum() > 0)) {
            jdbc.sql("UPDATE habits SET start_date = LEAST(start_date, :date) WHERE id = :id")
                    .param("date", request.date())
                    .param("id", id)
                    .update();
        }
    }

    /** Removes all tracking data for a single date. */
    @Transactional
    public void deleteCheckIn(long id, LocalDate date) {
        requireOwned(currentUser.id(), id);
        jdbc.sql("DELETE FROM habit_check_ins WHERE habit_id = :habitId AND entry_date = :date")
                .param("habitId", id)
                .param("date", date)
                .update();
    }

    public List<CheckInEntry> history(long id, LocalDate from, LocalDate to) {
        requireOwned(currentUser.id(), id);
        if (to.isBefore(from) || ChronoUnit.DAYS.between(from, to) >= MAX_HISTORY_DAYS) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Choose a date range of up to " + MAX_HISTORY_DAYS + " days.");
        }
        return jdbc.sql("""
                SELECT entry_date, completed, value FROM habit_check_ins
                WHERE habit_id = :habitId AND entry_date BETWEEN :from AND :to
                ORDER BY entry_date
                """)
                .param("habitId", id)
                .param("from", from)
                .param("to", to)
                .query((row, n) -> new CheckInEntry(row.getObject("entry_date", LocalDate.class),
                        row.getBoolean("completed"), row.getBigDecimal("value")))
                .list();
    }

    private static ReminderResponse toResponse(Reminder reminder) {
        return new ReminderResponse(reminder.id(), reminder.time(), reminder.repeat(), reminder.days(),
                reminder.intervalDays(), reminder.message(), reminder.enabled());
    }

    private static boolean reachesTarget(BigDecimal value, BigDecimal target) {
        return target == null ? value.signum() > 0 : value.compareTo(target) >= 0;
    }

    /** After the target changes, measured entries may flip between done and not done. */
    private void recomputeCompletion(long habitId) {
        jdbc.sql("""
                UPDATE habit_check_ins c
                JOIN habits h ON h.id = c.habit_id
                SET c.completed = CASE
                    WHEN h.track_type = 'MEASURABLE' AND c.value IS NOT NULL THEN
                        CASE WHEN h.target_value IS NULL THEN c.value > 0 ELSE c.value >= h.target_value END
                    ELSE c.completed END
                WHERE c.habit_id = :id
                """)
                .param("id", habitId)
                .update();
    }

    private HabitResponse find(long id) {
        LocalDate today = currentUser.today();
        return list(today).stream().filter(habit -> habit.id() == id).findFirst().orElseThrow(this::notFound);
    }

    private void replaceSchedule(long habitId, HabitRequest request) {
        jdbc.sql("DELETE FROM habit_schedule_days WHERE habit_id = :id").param("id", habitId).update();
        for (DayOfWeek day : request.scheduledDays()) {
            jdbc.sql("INSERT INTO habit_schedule_days (habit_id, day_of_week) VALUES (:id, :day)")
                    .param("id", habitId)
                    .param("day", day.name())
                    .update();
        }
    }

    private void replaceReminders(long habitId, List<ReminderInput> reminders) {
        jdbc.sql("DELETE FROM habit_reminders WHERE habit_id = :id").param("id", habitId).update();
        if (reminders == null) return;
        for (ReminderInput reminder : reminders) {
            if (reminder.repeat() == RepeatKind.CUSTOM_DAYS && (reminder.days() == null || reminder.days().isEmpty())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Pick at least one day for the reminder.");
            }
            if (reminder.repeat() == RepeatKind.EVERY_N_DAYS && reminder.intervalDays() == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose how many days apart the reminder repeats.");
            }
            jdbc.sql("""
                    INSERT INTO habit_reminders (habit_id, remind_at, repeat_kind, days, interval_days, message, enabled)
                    VALUES (:habitId, :time, :repeat, :days, :interval, :message, :enabled)
                    """)
                    .param("habitId", habitId)
                    .param("time", reminder.time())
                    .param("repeat", reminder.repeat().name())
                    .param("days", reminder.repeat() == RepeatKind.CUSTOM_DAYS ? HabitData.joinDays(reminder.days()) : null)
                    .param("interval", reminder.repeat() == RepeatKind.EVERY_N_DAYS ? reminder.intervalDays() : null)
                    .param("message", reminder.message() == null || reminder.message().isBlank() ? null : reminder.message().trim())
                    .param("enabled", reminder.enabled() == null || reminder.enabled())
                    .update();
        }
    }

    private void validateTracking(HabitRequest request) {
        if (trackTypeOf(request) == TrackType.MEASURABLE && request.targetValue() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Set a target amount for a measurable habit.");
        }
    }

    private TrackType trackTypeOf(HabitRequest request) {
        return request.trackType() == null ? TrackType.YES_NO : request.trackType();
    }

    private BigDecimal targetOf(HabitRequest request) {
        return trackTypeOf(request) == TrackType.MEASURABLE ? request.targetValue() : null;
    }

    private String unitOf(HabitRequest request) {
        if (trackTypeOf(request) != TrackType.MEASURABLE || request.unit() == null || request.unit().isBlank()) return null;
        return request.unit().trim();
    }

    private String goalOf(HabitRequest request) {
        if (trackTypeOf(request) == TrackType.MEASURABLE) {
            String unit = unitOf(request);
            return request.targetValue().stripTrailingZeros().toPlainString() + (unit == null ? "" : " " + unit);
        }
        return request.goal() == null || request.goal().isBlank() ? "Once" : request.goal().trim();
    }

    private Tracking trackingOf(long userId, long habitId) {
        return jdbc.sql("SELECT track_type, target_value FROM habits WHERE id = :id AND user_id = :userId")
                .param("id", habitId)
                .param("userId", userId)
                .query((row, n) -> new Tracking(TrackType.valueOf(row.getString("track_type")), row.getBigDecimal("target_value")))
                .optional()
                .orElseThrow(this::notFound);
    }

    private void requireOwned(long userId, long habitId) {
        int found = jdbc.sql("SELECT COUNT(*) FROM habits WHERE id = :id AND user_id = :userId")
                .param("id", habitId)
                .param("userId", userId)
                .query(Integer.class)
                .single();
        if (found == 0) throw notFound();
    }

    private void requireCategory(long userId, Long categoryId) {
        if (categoryId == null) return;
        int found = jdbc.sql("SELECT COUNT(*) FROM categories WHERE id = :id AND user_id = :userId")
                .param("id", categoryId)
                .param("userId", userId)
                .query(Integer.class)
                .single();
        if (found == 0) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown category.");
    }

    private ResponseStatusException notFound() {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "Habit not found.");
    }
}
