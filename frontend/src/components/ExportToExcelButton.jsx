import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { IconDownload } from "./AppIcons";

export default function ExportToExcelButton({
  exportFile,
  disabled = false,
  className = "panel-action-button",
  onError
}) {
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (!isExporting) {
      return undefined;
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isExporting]);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      if (typeof exportFile !== "function") {
        throw new Error("Функция экспорта не настроена");
      }

      const exportResult = await exportFile();
      const blob = exportResult?.blob;
      const fileName = exportResult?.fileName || "export.xlsx";
      if (!(blob instanceof Blob)) {
        throw new Error("Сервер не вернул файл экспорта");
      }

      const objectUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(objectUrl);
    } catch (error) {
      if (typeof onError === "function") {
        onError(error);
      }
    } finally {
      setIsExporting(false);
    }
  };

  const overlay =
    isExporting &&
    createPortal(
      <div
        className="excel-export-overlay"
        role="alertdialog"
        aria-busy="true"
        aria-live="polite"
        aria-label="Формирование Excel-отчёта"
      >
        <div className="excel-export-overlay-backdrop" aria-hidden />
        <div className="excel-export-overlay-panel">
          <span className="excel-export-spinner" aria-hidden />
          <p className="excel-export-overlay-text">Формирование отчёта…</p>
        </div>
      </div>,
      document.body
    );

  return (
    <>
      {overlay}
      <button
        type="button"
        className={className}
        onClick={handleExport}
        disabled={disabled || isExporting}
      >
        <IconDownload aria-hidden />
        <span>{isExporting ? "Выгрузка..." : "Выгрузить в Excel"}</span>
      </button>
    </>
  );
}
