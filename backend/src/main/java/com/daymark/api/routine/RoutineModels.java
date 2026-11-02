package com.daymark.api.routine;

import com.daymark.api.category.CategoryController;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

public final class RoutineModels {
    private RoutineModels() {}

    /** Either a free-text step ({@code name}) or a step linked to an existing habit ({@code habitId}). */
    public record RoutineStepInput(Long id, @Size(max = 100) String name, Long habitId) {}

    public record RoutineRequest(
            @NotBlank @Size(max = 80) String name,
            LocalTime scheduledTime,
            @NotBlank @Pattern(regexp = CategoryController.TONES, message = "must be one of the palette colours") String color,
            @NotEmpty @Size(max = 20) List<@Valid RoutineStepInput> steps) {}

    public record RoutineStepResponse(long id, String name, boolean completed, Long habitId, String habitIcon,
                                      String habitColor) {}

    public record RoutineResponse(long id, String name, LocalTime scheduledTime, String color,
                                  List<RoutineStepResponse> steps) {}

    public record CompletionRequest(@NotNull LocalDate date, @NotNull Boolean completed) {}
}
