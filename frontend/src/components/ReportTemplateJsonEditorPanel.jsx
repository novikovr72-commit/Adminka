import {
  forwardRef,
  memo,
  useCallback,
  useDeferredValue,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState
} from "react";

const REPORT_TEMPLATE_JSON_LINE_HEIGHT_PX = 18;
const REPORT_TEMPLATE_JSON_PADDING_PX = 10;
const REPORT_TEMPLATE_JSON_GUTTER_WIDTH_PX = 48;
const REPORT_TEMPLATE_JSON_BASE_FONT_SIZE_PX = 13;

function resolveCaretLine(value, selectionStart) {
  const sqlText = String(value ?? "");
  const safeSelection = Number.isFinite(selectionStart)
    ? Math.max(0, Math.min(Number(selectionStart), sqlText.length))
    : sqlText.length;
  let lineNumber = 1;
  for (let index = 0; index < safeSelection; index += 1) {
    if (sqlText[index] === "\n") {
      lineNumber += 1;
    }
  }
  return lineNumber;
}

const ReportTemplateJsonEditorPanel = memo(
  forwardRef(function ReportTemplateJsonEditorPanel({ committedText, isEditing, zoom }, ref) {
    const [text, setText] = useState(committedText);
    const [activeLine, setActiveLine] = useState(1);
    const [scrollTop, setScrollTop] = useState(0);
    const textareaRef = useRef(null);
    const textRef = useRef(committedText);
    textRef.current = text;

    const caretRafRef = useRef(0);
    const scrollPendingRef = useRef({ top: 0, raf: 0 });

    useEffect(() => {
      setText(committedText);
      setActiveLine(1);
      setScrollTop(0);
    }, [committedText]);

    useImperativeHandle(ref, () => ({
      getValue: () => String(textRef.current ?? "")
    }));

    const deferredText = useDeferredValue(text);
    const lineNumbers = useMemo(() => {
      const lineCount = Math.max(1, String(deferredText ?? "").split("\n").length);
      return Array.from({ length: lineCount }, (_, index) => String(index + 1)).join("\n");
    }, [deferredText]);

    const fontSizePx = REPORT_TEMPLATE_JSON_BASE_FONT_SIZE_PX * zoom;
    const lineHeightPx = REPORT_TEMPLATE_JSON_LINE_HEIGHT_PX * zoom;
    const activeLineTopPx =
      REPORT_TEMPLATE_JSON_PADDING_PX +
      (Math.max(1, activeLine) - 1) * lineHeightPx -
      scrollTop;

    const handleSelect = useCallback((event) => {
      const editor = event.currentTarget;
      if (caretRafRef.current) {
        cancelAnimationFrame(caretRafRef.current);
      }
      caretRafRef.current = requestAnimationFrame(() => {
        const nextLine = resolveCaretLine(editor.value, editor.selectionStart);
        setActiveLine((prev) => (prev === nextLine ? prev : nextLine));
        const nextScrollTop = Math.max(0, Number(editor.scrollTop) || 0);
        setScrollTop((prev) => (prev === nextScrollTop ? prev : nextScrollTop));
        caretRafRef.current = 0;
      });
    }, []);

    const handleScroll = useCallback((event) => {
      const editor = event.currentTarget;
      const nextScrollTop = Math.max(0, Number(editor.scrollTop) || 0);
      scrollPendingRef.current.top = nextScrollTop;
      if (scrollPendingRef.current.raf) {
        return;
      }
      scrollPendingRef.current.raf = requestAnimationFrame(() => {
        scrollPendingRef.current.raf = 0;
        const top = scrollPendingRef.current.top;
        setScrollTop((prev) => (prev === top ? prev : top));
      });
    }, []);

    return (
      <div
        className={`report-template-json-panel${isEditing ? " is-editing" : ""}`}
        style={{
          "--json-font-size-px": `${fontSizePx}px`,
          "--json-line-height-px": `${lineHeightPx}px`
        }}
      >
        {isEditing ? (
          <div
            className="report-template-json-active-line"
            style={{
              top: `${activeLineTopPx}px`,
              left: `${13 + REPORT_TEMPLATE_JSON_GUTTER_WIDTH_PX + 1}px`
            }}
            aria-hidden="true"
          />
        ) : null}
        {isEditing ? (
          <div className="report-template-json-gutter" aria-hidden="true">
            <pre
              className="report-template-json-gutter-content"
              style={{
                transform: `translateY(-${scrollTop}px)`
              }}
            >
              {lineNumbers}
            </pre>
          </div>
        ) : null}
        <textarea
          ref={textareaRef}
          className={`report-template-json-textarea${isEditing ? " is-editing" : ""}`}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onSelect={handleSelect}
          onScroll={handleScroll}
          readOnly={!isEditing}
        />
      </div>
    );
  })
);

ReportTemplateJsonEditorPanel.displayName = "ReportTemplateJsonEditorPanel";

export default ReportTemplateJsonEditorPanel;
