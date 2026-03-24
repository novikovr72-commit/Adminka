import { memo } from "react";
import {
  REPORT_TEMPLATE_DATA_FORMAT_OPTIONS,
  REPORT_TEMPLATE_DATA_TYPE_OPTIONS,
  REPORT_TEMPLATE_HORIZONTAL_ALIGN_OPTIONS,
  REPORT_TEMPLATE_VERTICAL_ALIGN_OPTIONS
} from "../reportTemplateConstants";

function ReportTemplateFieldTableRowComponent({
  field,
  sourceIndex,
  visibleOrderText,
  isReportTemplateEditMode,
  isFieldVisible,
  isRowEditable,
  linkFieldOptions,
  onFieldRowChange,
  onFieldDragOver,
  onFieldDrop,
  onFieldDragStart,
  onFieldDrag,
  onFieldDragEnd,
  onOverflowMouseEnter,
  onOverflowMouseMove,
  onOverflowMouseLeave
}) {
  const fieldType = String(field.fieldDataType ?? "text").trim().toLowerCase();
  const fieldFormatOptions =
    REPORT_TEMPLATE_DATA_FORMAT_OPTIONS[fieldType] ?? REPORT_TEMPLATE_DATA_FORMAT_OPTIONS.text;

  const renderOverflow = (value, fallback = "-") => {
    const normalized = String(value ?? "").trim();
    const displayValue = normalized || fallback;
    return (
      <span
        className="report-template-cell-overflow-text"
        onMouseEnter={(event) => onOverflowMouseEnter(event, normalized)}
        onMouseMove={onOverflowMouseMove}
        onMouseLeave={onOverflowMouseLeave}
      >
        {displayValue}
      </span>
    );
  };

  return (
    <tr
      className={
        !isFieldVisible ? "report-template-fields-row report-template-fields-row-hidden" : ""
      }
      onDragOver={(event) => onFieldDragOver(sourceIndex, event)}
      onDrop={(event) => onFieldDrop(sourceIndex, event)}
    >
      <td>{isFieldVisible ? visibleOrderText : "-"}</td>
      <td>
        <div className="report-template-field-name-cell">
          {isReportTemplateEditMode && (
            <span
              className="report-template-row-drag-handle"
              draggable={isFieldVisible}
              onDragStart={(event) => onFieldDragStart(sourceIndex, field.fieldName, event)}
              onDrag={onFieldDrag}
              onDragEnd={onFieldDragEnd}
              data-tooltip={isFieldVisible ? "Перетащить строку" : "Строка скрыта"}
              aria-label={isFieldVisible ? "Перетащить строку" : "Строка скрыта"}
            >
              ⋮⋮
            </span>
          )}
          {renderOverflow(field.fieldName)}
        </div>
      </td>
      <td>
        {isReportTemplateEditMode ? (
          <select
            className="employee-card-field-input employee-card-field-select"
            value={isFieldVisible ? "true" : "false"}
            onChange={(event) =>
              onFieldRowChange(sourceIndex, "reportVisible", String(event.target.value) === "true")
            }
          >
            <option value="true">ДА</option>
            <option value="false">НЕТ</option>
          </select>
        ) : isFieldVisible ? (
          "ДА"
        ) : (
          "НЕТ"
        )}
      </td>
      <td>
        {isRowEditable ? (
          <input
            type="text"
            className="employee-card-field-input"
            defaultValue={String(field.fieldCaption ?? "")}
            key={`report-template-field-caption-${sourceIndex}-${String(field.fieldCaption ?? "")}`}
            onBlur={(event) => onFieldRowChange(sourceIndex, "fieldCaption", event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.currentTarget.blur();
              }
            }}
          />
        ) : (
          renderOverflow(field.fieldCaption)
        )}
      </td>
      <td>
        {isRowEditable ? (
          <select
            className="employee-card-field-input employee-card-field-select"
            value={fieldType}
            onChange={(event) => onFieldRowChange(sourceIndex, "fieldDataType", event.target.value)}
          >
            {REPORT_TEMPLATE_DATA_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : (
          renderOverflow(
            REPORT_TEMPLATE_DATA_TYPE_OPTIONS.find((option) => option.value === fieldType)?.label
          )
        )}
      </td>
      <td>
        {isRowEditable ? (
          <select
            className="employee-card-field-input employee-card-field-select"
            value={String(field.fieldDataFormat ?? "")}
            onChange={(event) =>
              onFieldRowChange(sourceIndex, "fieldDataFormat", event.target.value)
            }
          >
            {fieldFormatOptions.map((option) => (
              <option key={option.value || "empty"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : (
          renderOverflow(field.fieldDataFormat)
        )}
      </td>
      <td>
        {isRowEditable ? (
          <select
            className="employee-card-field-input employee-card-field-select"
            value={String(field.fieldVertAlign ?? "ВЕРХ")}
            onChange={(event) =>
              onFieldRowChange(sourceIndex, "fieldVertAlign", event.target.value)
            }
          >
            {REPORT_TEMPLATE_VERTICAL_ALIGN_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : (
          renderOverflow(field.fieldVertAlign)
        )}
      </td>
      <td>
        {isRowEditable ? (
          <select
            className="employee-card-field-input employee-card-field-select"
            value={String(field.fieldHorizAlign ?? "СЛЕВА")}
            onChange={(event) =>
              onFieldRowChange(sourceIndex, "fieldHorizAlign", event.target.value)
            }
          >
            {REPORT_TEMPLATE_HORIZONTAL_ALIGN_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : (
          renderOverflow(field.fieldHorizAlign)
        )}
      </td>
      <td>
        {isRowEditable ? (
          <select
            className="employee-card-field-input employee-card-field-select"
            value={String(field.fieldLink ?? "")}
            onChange={(event) => onFieldRowChange(sourceIndex, "fieldLink", event.target.value)}
          >
            <option value="">-</option>
            {linkFieldOptions.map((linkName) => (
              <option key={linkName} value={linkName}>
                {linkName}
              </option>
            ))}
            {String(field.fieldLink ?? "").trim() &&
              !linkFieldOptions.includes(String(field.fieldLink ?? "").trim()) && (
                <option value={String(field.fieldLink ?? "").trim()}>
                  {String(field.fieldLink ?? "").trim()}
                </option>
              )}
          </select>
        ) : (
          renderOverflow(field.fieldLink)
        )}
      </td>
      <td>
        {isRowEditable ? (
          <select
            className="employee-card-field-input employee-card-field-select"
            value={field.fieldAutoWidth ? "true" : "false"}
            onChange={(event) =>
              onFieldRowChange(sourceIndex, "fieldAutoWidth", String(event.target.value) === "true")
            }
          >
            <option value="true">ДА</option>
            <option value="false">НЕТ</option>
          </select>
        ) : field.fieldAutoWidth ? (
          "ДА"
        ) : (
          "НЕТ"
        )}
      </td>
      <td>
        {isRowEditable ? (
          <input
            type="text"
            className={`employee-card-field-input${
              field.fieldAutoWidth ? " report-template-field-width-input-disabled" : ""
            }`}
            inputMode="numeric"
            placeholder="напр. 18"
            defaultValue={String(field.filedWidth ?? "")}
            key={`report-template-field-width-${sourceIndex}-${String(
              field.filedWidth ?? ""
            )}-${field.fieldAutoWidth ? "auto" : "manual"}`}
            disabled={Boolean(field.fieldAutoWidth)}
            data-tooltip={
              field.fieldAutoWidth
                ? "Поле недоступно, пока включена Автоширина = ДА"
                : "Ширина колонки в единицах Excel"
            }
            onBlur={(event) => onFieldRowChange(sourceIndex, "filedWidth", event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.currentTarget.blur();
              }
            }}
          />
        ) : (
          renderOverflow(field.filedWidth)
        )}
      </td>
      <td>
        {isRowEditable ? (
          <select
            className="employee-card-field-input employee-card-field-select"
            value={field.fieldAutoTransfer ? "true" : "false"}
            onChange={(event) =>
              onFieldRowChange(
                sourceIndex,
                "fieldAutoTransfer",
                String(event.target.value) === "true"
              )
            }
          >
            <option value="true">ДА</option>
            <option value="false">НЕТ</option>
          </select>
        ) : field.fieldAutoTransfer ? (
          "ДА"
        ) : (
          "НЕТ"
        )}
      </td>
      <td>
        {isRowEditable ? (
          <select
            className="employee-card-field-input employee-card-field-select"
            value={field.fieldBoldFont ? "true" : "false"}
            onChange={(event) =>
              onFieldRowChange(sourceIndex, "fieldBoldFont", String(event.target.value) === "true")
            }
          >
            <option value="true">ДА</option>
            <option value="false">НЕТ</option>
          </select>
        ) : field.fieldBoldFont ? (
          "ДА"
        ) : (
          "НЕТ"
        )}
      </td>
    </tr>
  );
}

function rowPropsEqual(prev, next) {
  return (
    prev.field === next.field &&
    prev.sourceIndex === next.sourceIndex &&
    prev.visibleOrderText === next.visibleOrderText &&
    prev.isReportTemplateEditMode === next.isReportTemplateEditMode &&
    prev.isFieldVisible === next.isFieldVisible &&
    prev.isRowEditable === next.isRowEditable &&
    prev.linkFieldOptions === next.linkFieldOptions &&
    prev.onFieldRowChange === next.onFieldRowChange &&
    prev.onFieldDragOver === next.onFieldDragOver &&
    prev.onFieldDrop === next.onFieldDrop &&
    prev.onFieldDragStart === next.onFieldDragStart &&
    prev.onFieldDrag === next.onFieldDrag &&
    prev.onFieldDragEnd === next.onFieldDragEnd &&
    prev.onOverflowMouseEnter === next.onOverflowMouseEnter &&
    prev.onOverflowMouseMove === next.onOverflowMouseMove &&
    prev.onOverflowMouseLeave === next.onOverflowMouseLeave
  );
}

const ReportTemplateFieldTableRow = memo(ReportTemplateFieldTableRowComponent, rowPropsEqual);

export default ReportTemplateFieldTableRow;
