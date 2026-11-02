package com.daymark.api.user;

import java.time.LocalDate;
import java.time.ZoneId;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/** The app has no sign-in yet, so every request acts as the single local profile. */
@Component
public class CurrentUser {
    public static final String LOCAL_EMAIL = "local@daymark.app";

    private final JdbcClient jdbc;
    private volatile Long cachedId;

    public CurrentUser(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public long id() {
        Long id = cachedId;
        if (id == null) {
            id = jdbc.sql("SELECT id FROM users WHERE email = :email")
                    .param("email", LOCAL_EMAIL)
                    .query(Long.class)
                    .single();
            cachedId = id;
        }
        return id;
    }

    public ZoneId zone() {
        String zone = jdbc.sql("SELECT time_zone FROM users WHERE id = :id")
                .param("id", id())
                .query(String.class)
                .single();
        return ZoneId.of(zone);
    }

    public LocalDate today() {
        return LocalDate.now(zone());
    }
}
