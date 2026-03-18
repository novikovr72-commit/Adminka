package com.employees.backend.service;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDFont;
import org.apache.pdfbox.pdmodel.font.PDType0Font;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.apache.pdfbox.pdmodel.graphics.state.PDExtendedGraphicsState;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.pdfbox.text.TextPosition;
import org.apache.pdfbox.util.Matrix;
import org.springframework.stereotype.Service;

@Service
public class PrintFormTemplatePdfService {
    private static final DateTimeFormatter FILE_TS_FORMAT = DateTimeFormatter
        .ofPattern("yyyyMMdd-HHmmss")
        .withZone(ZoneId.systemDefault());
    private static final Pattern PLACEHOLDER_PATTERN = Pattern.compile("\\{([^{}]+)\\}");

    public List<Map<String, Object>> extractPlaceholdersWithCoordinates(byte[] sourcePdf) throws Exception {
        try (PDDocument document = Loader.loadPDF(sourcePdf)) {
            PlaceholderTextStripper stripper = new PlaceholderTextStripper();
            stripper.setSortByPosition(true);
            stripper.getText(document);
            return stripper.results();
        }
    }

    public byte[] renderPdf(
        byte[] sourcePdf,
        Map<String, Object> sourceData,
        List<Map<String, Object>> fieldMapping,
        Map<String, Object> templateOverlaySettings,
        Map<String, Object> overrideOverlaySettings,
        String overlayText
    ) throws Exception {
        try (PDDocument document = Loader.loadPDF(sourcePdf); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            PDFont font = loadUnicodeFont(document);
            for (Map<String, Object> field : fieldMapping) {
                String sourceField = normalizeText(field.get("sourceField"));
                if (sourceField == null) {
                    continue;
                }
                String value = normalizeCellValue(sourceData.get(sourceField));
                if (value.isBlank()) {
                    continue;
                }
                int pageNumber = parseInt(field.get("page"), 1, 1, Integer.MAX_VALUE);
                if (pageNumber > document.getNumberOfPages()) {
                    continue;
                }
                float x = parseFloat(field.get("x"), 36f);
                float y = parseFloat(field.get("y"), 36f);
                float fontSize = Math.max(1f, parseFloat(field.get("fontSize"), 11f));
                float maxWidth = parseFloat(field.get("maxWidth"), 0f);
                String align = normalizeText(field.get("align"));
                Color color = parseHexColorOrDefault(normalizeText(field.get("color")), Color.BLACK);
                PDPage page = document.getPage(pageNumber - 1);
                String text = fitTextByWidth(value, font, fontSize, maxWidth);
                float drawX = x;
                if (maxWidth > 0f && align != null) {
                    float textWidth = font.getStringWidth(text) / 1000f * fontSize;
                    if ("CENTER".equalsIgnoreCase(align)) {
                        drawX = x + (maxWidth - textWidth) / 2f;
                    } else if ("RIGHT".equalsIgnoreCase(align)) {
                        drawX = x + (maxWidth - textWidth);
                    }
                }
                try (PDPageContentStream content = new PDPageContentStream(
                    document,
                    page,
                    PDPageContentStream.AppendMode.APPEND,
                    true,
                    true
                )) {
                    content.beginText();
                    content.setFont(font, fontSize);
                    content.setNonStrokingColor(color);
                    content.newLineAtOffset(drawX, y);
                    content.showText(text);
                    content.endText();
                }
            }
            drawOverlay(document, font, templateOverlaySettings, overrideOverlaySettings, overlayText);
            document.save(out);
            return out.toByteArray();
        }
    }

    public String createPdfFileName(String name) {
        String baseName = normalizeText(name);
        if (baseName == null) {
            baseName = "print-form";
        }
        String normalized = baseName
            .replaceAll("[^\\p{IsAlphabetic}\\p{IsDigit}._-]+", "_")
            .replaceAll("_+", "_")
            .replaceAll("^_+|_+$", "");
        if (normalized.isBlank()) {
            normalized = "print-form";
        }
        return normalized + "-" + FILE_TS_FORMAT.format(Instant.now()) + ".pdf";
    }

    private void drawOverlay(
        PDDocument document,
        PDFont font,
        Map<String, Object> templateOverlaySettings,
        Map<String, Object> overrideOverlaySettings,
        String overlayText
    ) throws Exception {
        LinkedHashMap<String, Object> merged = new LinkedHashMap<>();
        merged.putAll(templateOverlaySettings);
        merged.putAll(overrideOverlaySettings);
        if (overlayText != null) {
            merged.put("text", overlayText);
            merged.put("enabled", true);
        }
        String text = normalizeText(merged.get("text"));
        boolean enabled = toBoolean(merged.get("enabled"), text != null);
        if (!enabled || text == null) {
            return;
        }
        float fontSize = Math.max(1f, parseFloat(merged.get("fontSize"), 9f));
        float opacity = Math.max(0f, Math.min(1f, parseFloat(merged.get("opacity"), 0.35f)));
        float x = parseFloat(merged.get("x"), 36f);
        float y = parseFloat(merged.get("y"), 24f);
        float rotation = parseFloat(merged.get("rotation"), 0f);
        String pageSetting = normalizeText(merged.get("page"));
        Color color = parseHexColorOrDefault(normalizeText(merged.get("color")), new Color(107, 114, 128));
        if (pageSetting == null || "ALL".equalsIgnoreCase(pageSetting)) {
            for (int i = 0; i < document.getNumberOfPages(); i++) {
                drawOverlayOnPage(document, document.getPage(i), font, text, x, y, fontSize, color, opacity, rotation);
            }
            return;
        }
        int page = parseInt(pageSetting, 1, 1, Integer.MAX_VALUE);
        if (page > document.getNumberOfPages()) {
            return;
        }
        drawOverlayOnPage(document, document.getPage(page - 1), font, text, x, y, fontSize, color, opacity, rotation);
    }

    private void drawOverlayOnPage(
        PDDocument document,
        PDPage page,
        PDFont font,
        String text,
        float x,
        float y,
        float fontSize,
        Color color,
        float opacity,
        float rotationDegrees
    ) throws Exception {
        PDExtendedGraphicsState graphicsState = new PDExtendedGraphicsState();
        graphicsState.setNonStrokingAlphaConstant(opacity);
        PDRectangle box = page.getCropBox();
        float drawX = x;
        float drawY = y;
        if (drawX < 0) {
            drawX = box.getWidth() + drawX;
        }
        if (drawY < 0) {
            drawY = box.getHeight() + drawY;
        }
        try (PDPageContentStream content = new PDPageContentStream(
            document,
            page,
            PDPageContentStream.AppendMode.APPEND,
            true,
            true
        )) {
            content.saveGraphicsState();
            content.setGraphicsStateParameters(graphicsState);
            content.beginText();
            content.setFont(font, fontSize);
            content.setNonStrokingColor(color);
            content.newLineAtOffset(drawX, drawY);
            if (rotationDegrees != 0f) {
                content.setTextMatrix(new Matrix(
                    (float) Math.cos(Math.toRadians(rotationDegrees)),
                    (float) Math.sin(Math.toRadians(rotationDegrees)),
                    (float) -Math.sin(Math.toRadians(rotationDegrees)),
                    (float) Math.cos(Math.toRadians(rotationDegrees)),
                    drawX,
                    drawY
                ));
            }
            content.showText(text);
            content.endText();
            content.restoreGraphicsState();
        }
    }

    private PDFont loadUnicodeFont(PDDocument document) {
        List<Path> candidates = List.of(
            Path.of("/System/Library/Fonts/Supplemental/Arial Unicode.ttf"),
            Path.of("/System/Library/Fonts/Supplemental/Arial.ttf"),
            Path.of("/Library/Fonts/Arial Unicode.ttf"),
            Path.of("/Library/Fonts/Arial.ttf")
        );
        for (Path candidate : candidates) {
            try {
                if (Files.exists(candidate)) {
                    return PDType0Font.load(document, candidate.toFile());
                }
            } catch (Exception ignored) {
            }
        }
        return new PDType1Font(Standard14Fonts.FontName.HELVETICA);
    }

    private String fitTextByWidth(String source, PDFont font, float fontSize, float maxWidth) throws Exception {
        if (maxWidth <= 0f || source.isBlank()) {
            return source;
        }
        String value = source;
        float width = font.getStringWidth(value) / 1000f * fontSize;
        if (width <= maxWidth) {
            return value;
        }
        String suffix = "...";
        for (int i = value.length() - 1; i > 0; i--) {
            String candidate = value.substring(0, i) + suffix;
            float candidateWidth = font.getStringWidth(candidate) / 1000f * fontSize;
            if (candidateWidth <= maxWidth) {
                return candidate;
            }
        }
        return suffix;
    }

    private int parseInt(Object value, int defaultValue, int min, int max) {
        if (value == null) {
            return defaultValue;
        }
        try {
            int parsed = Integer.parseInt(String.valueOf(value).trim());
            if (parsed < min) {
                return min;
            }
            return Math.min(parsed, max);
        } catch (Exception ignored) {
            return defaultValue;
        }
    }

    private float parseFloat(Object value, float defaultValue) {
        if (value == null) {
            return defaultValue;
        }
        try {
            return Float.parseFloat(String.valueOf(value).trim());
        } catch (Exception ignored) {
            return defaultValue;
        }
    }

    private boolean toBoolean(Object value, boolean defaultValue) {
        if (value == null) {
            return defaultValue;
        }
        if (value instanceof Boolean bool) {
            return bool;
        }
        String text = String.valueOf(value).trim().toLowerCase(Locale.ROOT);
        if (text.isEmpty()) {
            return defaultValue;
        }
        return Objects.equals(text, "true") || Objects.equals(text, "1") || Objects.equals(text, "yes");
    }

    private String normalizeText(Object value) {
        if (value == null) {
            return null;
        }
        String text = String.valueOf(value).trim();
        return text.isEmpty() ? null : text;
    }

    private String normalizeCellValue(Object value) {
        if (value == null) {
            return "";
        }
        if (value instanceof Instant instant) {
            return FILE_TS_FORMAT.format(instant);
        }
        return String.valueOf(value).trim();
    }

    private Color parseHexColorOrDefault(String value, Color defaultColor) {
        if (value == null) {
            return defaultColor;
        }
        String normalized = value.trim();
        if (!normalized.startsWith("#")) {
            return defaultColor;
        }
        String hex = normalized.substring(1);
        if (hex.length() == 3) {
            hex = "" + hex.charAt(0) + hex.charAt(0) + hex.charAt(1) + hex.charAt(1) + hex.charAt(2) + hex.charAt(2);
        }
        if (hex.length() != 6 || !hex.matches("^[0-9a-fA-F]{6}$")) {
            return defaultColor;
        }
        return new Color(Integer.parseInt(hex.substring(0, 2), 16), Integer.parseInt(hex.substring(2, 4), 16), Integer.parseInt(hex.substring(4, 6), 16));
    }

    private static final class PlaceholderTextStripper extends PDFTextStripper {
        private final List<Map<String, Object>> results = new ArrayList<>();

        private PlaceholderTextStripper() throws Exception {
            super();
        }

        @Override
        protected void writeString(String text, List<TextPosition> textPositions) {
            if (text == null || text.isEmpty() || textPositions == null || textPositions.isEmpty()) {
                return;
            }
            Matcher matcher = PLACEHOLDER_PATTERN.matcher(text);
            while (matcher.find()) {
                String sourceField = String.valueOf(matcher.group(1)).trim();
                if (sourceField.isEmpty()) {
                    continue;
                }
                int startIndex = Math.max(0, Math.min(matcher.start(), textPositions.size() - 1));
                int endIndex = Math.max(startIndex, Math.min(matcher.end() - 1, textPositions.size() - 1));
                TextPosition start = textPositions.get(startIndex);
                TextPosition end = textPositions.get(endIndex);
                float pageHeight = getCurrentPage().getCropBox().getHeight();
                float x = start.getXDirAdj();
                float yTop = start.getYDirAdj();
                float yBottom = Math.max(0f, pageHeight - yTop);
                float width = Math.max(0f, (end.getXDirAdj() + end.getWidthDirAdj()) - x);
                float fontSize = Math.max(1f, start.getFontSizeInPt());
                this.results.add(new LinkedHashMap<>(Map.of(
                    "placeholder", "{" + sourceField + "}",
                    "sourceField", sourceField,
                    "page", getCurrentPageNo(),
                    "x", round2(x),
                    "y", round2(yBottom),
                    "fontSize", round2(fontSize),
                    "maxWidth", round2(width)
                )));
            }
        }

        private static double round2(float value) {
            return Math.round(value * 100.0d) / 100.0d;
        }

        private List<Map<String, Object>> results() {
            return this.results;
        }
    }
}
