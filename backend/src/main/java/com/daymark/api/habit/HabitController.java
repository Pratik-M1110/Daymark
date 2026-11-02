package com.daymark.api.habit;

import com.daymark.api.habit.HabitModels.CheckInEntry;
import com.daymark.api.habit.HabitModels.CheckInRequest;
import com.daymark.api.habit.HabitModels.HabitRequest;
import com.daymark.api.habit.HabitModels.HabitResponse;
import com.daymark.api.habit.HabitModels.ReminderDue;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.List;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class HabitController {
    private final HabitService service;

    public HabitController(HabitService service) {
        this.service = service;
    }

    @GetMapping("/habits")
    public List<HabitResponse> list(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return service.list(date);
    }

    @PostMapping("/habits")
    @ResponseStatus(HttpStatus.CREATED)
    public HabitResponse create(@Valid @RequestBody HabitRequest request) {
        return service.create(request);
    }

    @PutMapping("/habits/{id}")
    public HabitResponse update(@PathVariable long id, @Valid @RequestBody HabitRequest request) {
        return service.update(id, request);
    }

    @DeleteMapping("/habits/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable long id) {
        service.delete(id);
    }

    @PostMapping("/habits/{id}/check-ins")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void checkIn(@PathVariable long id, @Valid @RequestBody CheckInRequest request) {
        service.recordCheckIn(id, request);
    }

    @GetMapping("/habits/{id}/check-ins")
    public List<CheckInEntry> history(
            @PathVariable long id,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return service.history(id, from, to);
    }

    @DeleteMapping("/habits/{id}/check-ins/{date}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteCheckIn(@PathVariable long id, @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        service.deleteCheckIn(id, date);
    }

    @GetMapping("/reminders")
    public List<ReminderDue> reminders(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return service.remindersOn(date);
    }
}
