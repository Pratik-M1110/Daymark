package com.daymark.api.routine;

import com.daymark.api.routine.RoutineModels.CompletionRequest;
import com.daymark.api.routine.RoutineModels.RoutineRequest;
import com.daymark.api.routine.RoutineModels.RoutineResponse;
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
@RequestMapping("/api/routines")
public class RoutineController {
    private final RoutineService service;

    public RoutineController(RoutineService service) {
        this.service = service;
    }

    @GetMapping
    public List<RoutineResponse> list(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return service.list(date);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public RoutineResponse create(@Valid @RequestBody RoutineRequest request) {
        return service.create(request);
    }

    @PutMapping("/{id}")
    public RoutineResponse update(@PathVariable long id, @Valid @RequestBody RoutineRequest request) {
        return service.update(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable long id) {
        service.delete(id);
    }

    @PutMapping("/{id}/steps/{stepId}/completion")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void setStep(@PathVariable long id, @PathVariable long stepId, @Valid @RequestBody CompletionRequest request) {
        service.setStepCompletion(id, stepId, request);
    }

    @PutMapping("/{id}/completion")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void setAll(@PathVariable long id, @Valid @RequestBody CompletionRequest request) {
        service.setRoutineCompletion(id, request);
    }
}
