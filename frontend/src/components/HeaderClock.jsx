import { useEffect, useState } from "react";

function formatNow() {
  const now = new Date();
  const time = now.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
  const date = now.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
  const weekdayRaw = now.toLocaleDateString("ru-RU", {
    weekday: "long"
  });
  const weekday =
    typeof weekdayRaw === "string" && weekdayRaw.length > 0
      ? `${weekdayRaw.slice(0, 1).toUpperCase()}${weekdayRaw.slice(1)}`
      : "";

  return { time, date, weekday };
}

/**
 * Локальное состояние времени, чтобы не вызывать setState на корневом App каждую секунду.
 */
export default function HeaderClock() {
  const [value, setValue] = useState(() => formatNow());

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setValue(formatNow());
    }, 1000);
    return () => window.clearInterval(timerId);
  }, []);

  return (
    <div className="header-time-block" aria-label="Текущие дата и время">
      <div className="header-date-value">{value.date}</div>
      <div className="header-weekday-value">{value.weekday}</div>
      <div className="header-time-value">{value.time}</div>
    </div>
  );
}
