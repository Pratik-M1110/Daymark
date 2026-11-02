package com.daymark.api.category;

import com.daymark.api.user.CurrentUser;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/categories")
public class CategoryController {
    public static final String TONES = "violet|rose|amber|emerald|sky|coral|teal|slate";

    public record CategoryRequest(
            @NotBlank @Size(max = 32) String name,
            @NotBlank @Pattern(regexp = TONES, message = "must be one of the palette colours") String color) {}

    public record CategoryResponse(long id, String name, String color, int habitCount) {}

    private final JdbcClient jdbc;
    private final CurrentUser currentUser;

    public CategoryController(JdbcClient jdbc, CurrentUser currentUser) {
        this.jdbc = jdbc;
        this.currentUser = currentUser;
    }

    @GetMapping
    public List<CategoryResponse> list() {
        return jdbc.sql("""
                SELECT c.id, c.name, c.color, COUNT(h.id) AS habit_count
                FROM categories c
                LEFT JOIN habits h ON h.category_id = c.id
                WHERE c.user_id = :userId
                GROUP BY c.id, c.name, c.color, c.sort_order
                ORDER BY c.sort_order, c.id
                """)
                .param("userId", currentUser.id())
                .query((row, n) -> new CategoryResponse(row.getLong("id"), row.getString("name"),
                        row.getString("color"), row.getInt("habit_count")))
                .list();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CategoryResponse create(@Valid @RequestBody CategoryRequest request) {
        long userId = currentUser.id();
        int sortOrder = jdbc.sql("SELECT COALESCE(MAX(sort_order), 0) + 1 FROM categories WHERE user_id = :userId")
                .param("userId", userId)
                .query(Integer.class)
                .single();
        KeyHolder keys = new GeneratedKeyHolder();
        jdbc.sql("INSERT INTO categories (user_id, name, color, sort_order) VALUES (:userId, :name, :color, :sortOrder)")
                .param("userId", userId)
                .param("name", request.name().trim())
                .param("color", request.color())
                .param("sortOrder", sortOrder)
                .update(keys);
        return find(keys.getKey().longValue());
    }

    @PutMapping("/{id}")
    public CategoryResponse update(@PathVariable long id, @Valid @RequestBody CategoryRequest request) {
        int rows = jdbc.sql("UPDATE categories SET name = :name, color = :color WHERE id = :id AND user_id = :userId")
                .param("name", request.name().trim())
                .param("color", request.color())
                .param("id", id)
                .param("userId", currentUser.id())
                .update();
        if (rows == 0) throw notFound();
        return find(id);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable long id) {
        int rows = jdbc.sql("DELETE FROM categories WHERE id = :id AND user_id = :userId")
                .param("id", id)
                .param("userId", currentUser.id())
                .update();
        if (rows == 0) throw notFound();
    }

    private CategoryResponse find(long id) {
        return list().stream().filter(category -> category.id() == id).findFirst().orElseThrow(this::notFound);
    }

    private ResponseStatusException notFound() {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "Category not found.");
    }
}
