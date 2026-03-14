import { useState } from "react";

export default function ExportToExcelButton({
  exportFile,
  disabled = false,
  className = "panel-action-button",
  onError
}) {
  const [isExporting, setIsExporting] = useState(false);

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

  return (
    <button
      type="button"
      className={className}
      onClick={handleExport}
      disabled={disabled || isExporting}
    >
      <span aria-hidden="true">⇩</span>
      <span>{isExporting ? "Выгрузка..." : "Выгрузить в Excel"}</span>
    </button>
  );
}
