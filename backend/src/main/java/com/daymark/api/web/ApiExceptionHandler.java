package com.daymark.api.web;

import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice
public class ApiExceptionHandler {
    public record ErrorBody(String message) {}

    @ExceptionHandler(ResponseStatusException.class)
    ResponseEntity<ErrorBody> status(ResponseStatusException exception) {
        String message = exception.getReason() != null ? exception.getReason() : "Request failed.";
        return ResponseEntity.status(exception.getStatusCode()).body(new ErrorBody(message));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ErrorBody> invalid(MethodArgumentNotValidException exception) {
        String message = exception.getBindingResult().getFieldErrors().stream()
                .findFirst()
                .map(error -> error.getField() + " " + error.getDefaultMessage())
                .orElse("The request is not valid.");
        return ResponseEntity.badRequest().body(new ErrorBody(message));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<ErrorBody> unreadable() {
        return ResponseEntity.badRequest().body(new ErrorBody("The request body could not be read."));
    }

    @ExceptionHandler(DuplicateKeyException.class)
    ResponseEntity<ErrorBody> duplicate() {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(new ErrorBody("That name is already in use."));
    }
}
