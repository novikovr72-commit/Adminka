package com.employees.backend;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import javax.sql.DataSource;
import java.net.URI;
import java.nio.file.Path;

@Configuration
public class Config implements WebMvcConfigurer {

    @Value("${app.logs-dir:backend/logs}")
    private String logsDir;

    @Value("${spring.datasource.url:jdbc:postgresql://localhost:5432/employees}")
    private String jdbcUrl;

    @Value("${spring.datasource.username:roman}")
    private String username;

    @Value("${spring.datasource.password:}")
    private String password;

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
            .allowedMethods("*")
            .allowedHeaders("*")
            .allowedOrigins("*");
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        Path absoluteLogsPath = Path.of(logsDir).toAbsolutePath().normalize();
        registry
            .addResourceHandler("/api/import-logs/**")
            .addResourceLocations("file:" + absoluteLogsPath + "/");
    }

    @Bean
    public DataSource dataSource() {
        DriverManagerDataSource dataSource = new DriverManagerDataSource();
        dataSource.setDriverClassName("org.postgresql.Driver");
        dataSource.setUrl(jdbcUrl);
        dataSource.setUsername(username);
        dataSource.setPassword(password);
        return dataSource;
    }
}

@RestController
class AliasController {

    @GetMapping("/api/openapi")
    public void openapiAlias(HttpServletRequest request, HttpServletResponse response) throws Exception {
        request.getRequestDispatcher("/api/openapi.json").forward(request, response);
    }

    @GetMapping("/swagger")
    public ResponseEntity<Void> swaggerAlias(HttpServletRequest request) {
        return ResponseEntity.status(HttpStatus.FOUND).location(URI.create("/api/docs")).build();
    }
}
