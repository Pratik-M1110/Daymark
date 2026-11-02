package com.daymark.api.user;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.DateTimeException;
import java.time.ZoneId;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/profile")
public class ProfileController {
    public record Profile(String name, String timeZone) {}

    public record ProfileRequest(@NotBlank @Size(max = 80) String name, @NotBlank @Size(max = 64) String timeZone) {}

    private final JdbcClient jdbc;
    private final CurrentUser currentUser;

    public ProfileController(JdbcClient jdbc, CurrentUser currentUser) {
        this.jdbc = jdbc;
        this.currentUser = currentUser;
    }

    @GetMapping
    public Profile get() {
        return jdbc.sql("SELECT display_name, time_zone FROM users WHERE id = :id")
                .param("id", currentUser.id())
                .query((row, rowNumber) -> new Profile(row.getString("display_name"), row.getString("time_zone")))
                .single();
    }

    @PutMapping
    public Profile update(@Valid @RequestBody ProfileRequest request) {
        String zone;
        try {
            zone = ZoneId.of(request.timeZone()).getId();
        } catch (DateTimeException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose a valid time zone.");
        }
        jdbc.sql("UPDATE users SET display_name = :name, time_zone = :zone WHERE id = :id")
                .param("name", request.name().trim())
                .param("zone", zone)
                .param("id", currentUser.id())
                .update();
        return get();
    }
}
