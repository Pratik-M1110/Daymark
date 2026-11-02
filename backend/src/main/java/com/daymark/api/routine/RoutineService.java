package com.daymark.api.routine;

import com.daymark.api.habit.HabitModels.CheckInRequest;
import com.daymark.api.habit.HabitService;
import com.daymark.api.routine.RoutineModels.CompletionRequest;
import com.daymark.api.routine.RoutineModels.RoutineRequest;
import com.daymark.api.routine.RoutineModels.RoutineResponse;
import com.daymark.api.routine.RoutineModels.RoutineStepInput;
import com.daymark.api.routine.RoutineModels.RoutineStepResponse;
import com.daymark.api.user.CurrentUser;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class RoutineService {
    private record RoutineRow(long id, String name, LocalTime time, String color) {}

    private record StepRow(long id, long routineId, String name, boolean completed, Long habitId, String habitIcon,
                           String habitColor) {}

    private record StepLink(long id, Long habitId) {}

    private final JdbcClient jdbc;
    private final CurrentUser currentUser;
    private final HabitService habits;

    public RoutineService(JdbcClient jdbc, CurrentUser currentUser, HabitService habits) {
        this.jdbc = jdbc;
        this.currentUser = currentUser;
        this.habits = habits;
    }

    public List<RoutineResponse> list(LocalDate requestedDate) {
        LocalDate date = requestedDate == null ? currentUser.today() : requestedDate;
        long userId = currentUser.id();

        List<RoutineRow> routines = jdbc.sql("""
                SELECT id, name, scheduled_time, color FROM routines
                WHERE user_id = :userId
                ORDER BY sort_order, id
                """)
                .param("userId", userId)
                .query((row, n) -> new RoutineRow(row.getLong("id"), row.getString("name"),
                        row.getObject("scheduled_time", LocalTime.class), row.getString("color")))
                .list();

        // Linked steps take their name and completion from the habit itself.
        Map<Long, List<RoutineStepResponse>> steps = new LinkedHashMap<>();
        jdbc.sql("""
                SELECT s.id, s.routine_id, COALESCE(h.name, s.name) AS name, s.habit_id, h.icon AS habit_icon,
                       cat.color AS habit_color,
                       CASE WHEN s.habit_id IS NULL THEN (c.step_id IS NOT NULL) ELSE COALESCE(ci.completed, FALSE) END AS completed
                FROM routine_steps s
                JOIN routines r ON r.id = s.routine_id
                LEFT JOIN routine_step_completions c ON c.step_id = s.id AND c.entry_date = :date
                LEFT JOIN habits h ON h.id = s.habit_id
                LEFT JOIN categories cat ON cat.id = h.category_id
                LEFT JOIN habit_check_ins ci ON ci.habit_id = s.habit_id AND ci.entry_date = :date
                WHERE r.user_id = :userId
                ORDER BY s.sort_order, s.id
                """)
                .param("userId", userId)
                .param("date", date)
                .query((row, n) -> new StepRow(row.getLong("id"), row.getLong("routine_id"), row.getString("name"),
                        row.getBoolean("completed"), row.getObject("habit_id", Long.class),
                        row.getString("habit_icon"), row.getString("habit_color")))
                .list()
                .forEach(step -> steps.computeIfAbsent(step.routineId(), id -> new ArrayList<>())
                        .add(new RoutineStepResponse(step.id(), step.name(), step.completed(), step.habitId(),
                                step.habitIcon(), step.habitColor())));

        return routines.stream()
                .map(routine -> new RoutineResponse(routine.id(), routine.name(), routine.time(), routine.color(),
                        steps.getOrDefault(routine.id(), List.of())))
                .toList();
    }

    @Transactional
    public RoutineResponse create(RoutineRequest request) {
        long userId = currentUser.id();
        validateSteps(userId, request.steps());
        int sortOrder = jdbc.sql("SELECT COALESCE(MAX(sort_order), 0) + 1 FROM routines WHERE user_id = :userId")
                .param("userId", userId)
                .query(Integer.class)
                .single();
        KeyHolder keys = new GeneratedKeyHolder();
        jdbc.sql("""
                INSERT INTO routines (user_id, name, scheduled_time, color, sort_order)
                VALUES (:userId, :name, :time, :color, :sortOrder)
                """)
                .param("userId", userId)
                .param("name", request.name().trim())
                .param("time", request.scheduledTime())
                .param("color", request.color())
                .param("sortOrder", sortOrder)
                .update(keys);
        long id = keys.getKey().longValue();
        saveSteps(id, request.steps());
        return find(id);
    }

    @Transactional
    public RoutineResponse update(long id, RoutineRequest request) {
        validateSteps(currentUser.id(), request.steps());
        int rows = jdbc.sql("""
                UPDATE routines SET name = :name, scheduled_time = :time, color = :color
                WHERE id = :id AND user_id = :userId
                """)
                .param("name", request.name().trim())
                .param("time", request.scheduledTime())
                .param("color", request.color())
                .param("id", id)
                .param("userId", currentUser.id())
                .update();
        if (rows == 0) throw notFound();
        saveSteps(id, request.steps());
        return find(id);
    }

    @Transactional
    public void delete(long id) {
        int rows = jdbc.sql("DELETE FROM routines WHERE id = :id AND user_id = :userId")
                .param("id", id)
                .param("userId", currentUser.id())
                .update();
        if (rows == 0) throw notFound();
    }

    @Transactional
    public void setStepCompletion(long routineId, long stepId, CompletionRequest request) {
        requireOwned(routineId);
        requirePastOrToday(request.date());
        StepLink step = jdbc.sql("SELECT id, habit_id FROM routine_steps WHERE id = :step AND routine_id = :routine")
                .param("step", stepId)
                .param("routine", routineId)
                .query((row, n) -> new StepLink(row.getLong("id"), row.getObject("habit_id", Long.class)))
                .optional()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Step not found."));
        complete(step, request.date(), request.completed());
    }

    @Transactional
    public void setRoutineCompletion(long routineId, CompletionRequest request) {
        requireOwned(routineId);
        requirePastOrToday(request.date());
        List<StepLink> steps = jdbc.sql("SELECT id, habit_id FROM routine_steps WHERE routine_id = :routine")
                .param("routine", routineId)
                .query((row, n) -> new StepLink(row.getLong("id"), row.getObject("habit_id", Long.class)))
                .list();
        for (StepLink step : steps) complete(step, request.date(), request.completed());
    }

    private void complete(StepLink step, LocalDate date, boolean completed) {
        if (step.habitId() != null) {
            habits.recordCheckIn(step.habitId(), new CheckInRequest(date, completed, null));
        } else if (completed) {
            jdbc.sql("INSERT IGNORE INTO routine_step_completions (step_id, entry_date) VALUES (:step, :date)")
                    .param("step", step.id())
                    .param("date", date)
                    .update();
        } else {
            jdbc.sql("DELETE FROM routine_step_completions WHERE step_id = :step AND entry_date = :date")
                    .param("step", step.id())
                    .param("date", date)
                    .update();
        }
    }

    private void validateSteps(long userId, List<RoutineStepInput> inputs) {
        Set<Long> seen = new HashSet<>();
        for (RoutineStepInput input : inputs) {
            if (input.habitId() != null) {
                if (!seen.add(input.habitId())) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A habit can only appear once in a routine.");
                }
                int found = jdbc.sql("SELECT COUNT(*) FROM habits WHERE id = :id AND user_id = :userId")
                        .param("id", input.habitId())
                        .param("userId", userId)
                        .query(Integer.class)
                        .single();
                if (found == 0) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown habit in routine.");
            } else if (input.name() == null || input.name().isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Every step needs a name or a habit.");
            }
        }
    }

    /** Keeps existing step ids (and their history), removes dropped steps and inserts new ones. */
    private void saveSteps(long routineId, List<RoutineStepInput> inputs) {
        Set<Long> existing = new HashSet<>(jdbc.sql("SELECT id FROM routine_steps WHERE routine_id = :routine")
                .param("routine", routineId)
                .query(Long.class)
                .list());
        Set<Long> kept = new HashSet<>();
        for (RoutineStepInput input : inputs) {
            if (input.id() != null && existing.contains(input.id())) kept.add(input.id());
        }
        for (Long id : existing) {
            if (!kept.contains(id)) {
                jdbc.sql("DELETE FROM routine_steps WHERE id = :id").param("id", id).update();
            }
        }

        int order = 0;
        for (RoutineStepInput input : inputs) {
            order++;
            String name = input.habitId() != null ? nameOfHabit(input.habitId()) : input.name().trim();
            if (input.id() != null && kept.contains(input.id())) {
                jdbc.sql("UPDATE routine_steps SET name = :name, habit_id = :habit, sort_order = :order WHERE id = :id")
                        .param("name", name)
                        .param("habit", input.habitId())
                        .param("order", order)
                        .param("id", input.id())
                        .update();
            } else {
                jdbc.sql("INSERT INTO routine_steps (routine_id, name, habit_id, sort_order) VALUES (:routine, :name, :habit, :order)")
                        .param("routine", routineId)
                        .param("name", name)
                        .param("habit", input.habitId())
                        .param("order", order)
                        .update();
            }
        }
    }

    private String nameOfHabit(long habitId) {
        return jdbc.sql("SELECT name FROM habits WHERE id = :id").param("id", habitId).query(String.class).single();
    }

    private RoutineResponse find(long id) {
        return list(currentUser.today()).stream().filter(routine -> routine.id() == id).findFirst()
                .orElseThrow(this::notFound);
    }

    private void requireOwned(long routineId) {
        int found = jdbc.sql("SELECT COUNT(*) FROM routines WHERE id = :id AND user_id = :userId")
                .param("id", routineId)
                .param("userId", currentUser.id())
                .query(Integer.class)
                .single();
        if (found == 0) throw notFound();
    }

    private void requirePastOrToday(LocalDate date) {
        if (date.isAfter(currentUser.today())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "You cannot complete steps on a future date.");
        }
    }

    private ResponseStatusException notFound() {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "Routine not found.");
    }
}
