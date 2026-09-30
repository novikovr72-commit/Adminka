import * as echarts from "echarts";
import { useEffect, useMemo, useRef } from "react";
import miningData from "@kazakhmys-docs/mining_process_sample.json";

function useChart(optionFactory, deps) {
  const ref = useRef(null);
  const instRef = useRef(null);
  const roRef = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) {
      return undefined;
    }
    const inst = echarts.init(el, undefined, { renderer: "canvas" });
    instRef.current = inst;
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => inst.resize()) : null;
    roRef.current = ro;
    ro?.observe(el);
    const onResize = () => inst.resize();
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("orientationchange", onResize);
      ro?.disconnect();
      roRef.current = null;
      inst.dispose();
      instRef.current = null;
    };
  }, []);

  useEffect(() => {
    const inst = instRef.current;
    if (!inst) {
      return;
    }
    inst.setOption(optionFactory(), { notMerge: true, lazyUpdate: true });
  }, deps);

  return ref;
}

function formatPct(x, digits = 1) {
  return `${Number(x).toFixed(digits)}%`;
}

function formatKt(x) {
  return `${Number(x).toLocaleString("ru-RU", { maximumFractionDigits: 1 })}`;
}

export function MiningExecutiveDashboard() {
  const data = miningData;

  const planPct = useMemo(() => {
    const a = Number(data.kpis?.plan_mtd_kt);
    const b = Number(data.kpis?.actual_mtd_kt);
    if (!a || Number.isNaN(a) || Number.isNaN(b)) {
      return 0;
    }
    return (b / a) * 100;
  }, [data]);

  const comboOption = useMemo(
    () => () => ({
      tooltip: { trigger: "axis", confine: true },
      legend: { data: ["Факт, тыс. т", "План, тыс. т", "Содержание Cu"], textStyle: { color: "#b8c5d6" }, top: 0 },
      grid: { left: 48, right: 48, top: 40, bottom: 28 },
      xAxis: {
        type: "category",
        data: data.daily.map((d) => d.day),
        axisLabel: { color: "#9aa8b8", fontSize: 11 },
        axisLine: { lineStyle: { color: "rgba(120,160,200,0.25)" } }
      },
      yAxis: [
        {
          type: "value",
          name: "тыс. т",
          nameTextStyle: { color: "#8a9aac", fontSize: 10 },
          splitLine: { lineStyle: { color: "rgba(120,160,200,0.12)" } },
          axisLabel: { color: "#9aa8b8" }
        },
        {
          type: "value",
          name: "% Cu",
          nameTextStyle: { color: "#8a9aac", fontSize: 10 },
          splitLine: { show: false },
          axisLabel: { color: "#9aa8b8" }
        }
      ],
      series: [
        {
          name: "Факт, тыс. т",
          type: "bar",
          data: data.daily.map((d) => d.actual),
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: "rgba(61,214,198,0.95)" },
              { offset: 1, color: "rgba(61,214,198,0.25)" }
            ]),
            borderRadius: [6, 6, 0, 0]
          },
          barMaxWidth: 22
        },
        {
          name: "План, тыс. т",
          type: "line",
          smooth: true,
          showSymbol: false,
          data: data.daily.map((d) => d.plan),
          lineStyle: { width: 2, color: "#6b8cff" },
          itemStyle: { color: "#6b8cff" }
        },
        {
          name: "Содержание Cu",
          type: "line",
          yAxisIndex: 1,
          smooth: true,
          showSymbol: true,
          symbolSize: 6,
          data: data.daily.map((d) => d.grade),
          lineStyle: { width: 2, color: "#ffb347" },
          itemStyle: { color: "#ffb347" },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: "rgba(255,179,71,0.22)" },
              { offset: 1, color: "rgba(255,179,71,0)" }
            ])
          }
        }
      ]
    }),
    [data]
  );

  const sankeyOption = useMemo(
    () => () => ({
      tooltip: { trigger: "item", confine: true },
      series: [
        {
          type: "sankey",
          layout: "none",
          emphasis: { focus: "adjacency" },
          nodeAlign: "justify",
          data: data.sankey.nodes.map((n) => ({ name: n.name })),
          links: data.sankey.links.map((l) => ({
            source: l.source,
            target: l.target,
            value: l.value
          })),
          lineStyle: { color: "gradient", curveness: 0.45, opacity: 0.35 },
          itemStyle: { borderWidth: 0 },
          label: { color: "#dfe8f2", fontSize: 11 }
        }
      ]
    }),
    [data]
  );

  const roseOption = useMemo(
    () => () => ({
      tooltip: { trigger: "item", confine: true },
      series: [
        {
          name: "Часы по этапам",
          type: "pie",
          radius: ["22%", "72%"],
          center: ["50%", "52%"],
          roseType: "area",
          itemStyle: { borderRadius: 6 },
          label: { color: "#dfe8f2", fontSize: 11 },
          data: data.stage_hours.map((s, i) => ({
            value: s.hours,
            name: s.stage,
            itemStyle: {
              color: ["#3dd6c6", "#6b8cff", "#ffb347", "#a78bfa", "#f472b6"][i % 5]
            }
          }))
        }
      ]
    }),
    [data]
  );

  const radarOption = useMemo(
    () => () => {
      const masses = data.mines.map((m) => m.mass_kt);
      const grades = data.mines.map((m) => m.grade);
      const plans = data.mines.map((m) => m.plan_pct);
      const maxM = Math.max(...masses, 1);
      const maxG = Math.max(...grades, 0.1);
      const maxP = Math.max(...plans, 1);
      return {
        tooltip: { confine: true },
        legend: {
          data: data.mines.map((m) => m.name),
          bottom: 0,
          textStyle: { color: "#b8c5d6", fontSize: 10 },
          type: "scroll"
        },
        radar: {
          indicator: [
            { name: "Масса\n(max)", max: maxM },
            { name: "Содерж.\n(max)", max: maxG },
            { name: "% плана\n(max)", max: maxP }
          ],
          center: ["50%", "46%"],
          radius: "58%",
          splitLine: { lineStyle: { color: "rgba(120,160,200,0.15)" } },
          splitArea: { show: true, areaStyle: { color: ["rgba(12,18,28,0.2)", "rgba(12,18,28,0.05)"] } },
          axisName: { color: "#9aa8b8", fontSize: 10 }
        },
        series: [
          {
            type: "radar",
            emphasis: { lineStyle: { width: 3 } },
            data: data.mines.map((m, i) => ({
              value: [m.mass_kt, m.grade, m.plan_pct],
              name: m.name,
              areaStyle: { opacity: 0.12 },
              lineStyle: { width: 2 },
              itemStyle: {
                color: ["#3dd6c6", "#6b8cff", "#ffb347", "#a78bfa", "#22d3ee"][i % 5]
              }
            }))
          }
        ]
      };
    },
    [data]
  );

  const calendarOption = useMemo(
    () => () => {
      const rows = data.calendar_utilisation ?? [];
      const values = rows.map((r) => r[1]);
      const minV = Math.min(...values, 0);
      const maxV = Math.max(...values, 1);
      return {
        tooltip: {
          position: "top",
          formatter: (p) => `${p.data[0]}: ${formatPct(Number(p.data[1]) * 100, 0)} загрузки`
        },
        visualMap: {
          min: minV,
          max: maxV,
          calculable: true,
          orient: "horizontal",
          left: "center",
          bottom: 6,
          inRange: { color: ["#0f1724", "#1e3a5f", "#3dd6c6"] },
          textStyle: { color: "#9aa8b8", fontSize: 10 },
          text: ["Высокая", "Низкая"]
        },
        calendar: {
          top: 36,
          left: 36,
          right: 24,
          cellSize: ["auto", 16],
          range: rows.length ? [rows[0][0], rows[rows.length - 1][0]] : [],
          itemStyle: { borderWidth: 1, borderColor: "rgba(120,160,200,0.2)" },
          yearLabel: { show: false },
          dayLabel: { firstDay: 1, color: "#9aa8b8", fontSize: 10 },
          monthLabel: { color: "#b8c5d6", fontSize: 11 },
          splitLine: { lineStyle: { color: "rgba(120,160,200,0.12)" } }
        },
        series: [
          {
            type: "heatmap",
            coordinateSystem: "calendar",
            data: rows.map((r) => [r[0], r[1]])
          }
        ]
      };
    },
    [data]
  );

  const gaugeOption = useMemo(
    () => () => ({
      series: [
        {
          type: "gauge",
          startAngle: 200,
          endAngle: -20,
          min: 85,
          max: 115,
          splitNumber: 6,
          radius: "88%",
          center: ["50%", "58%"],
          progress: { show: true, width: 10, roundCap: true, itemStyle: { color: "#3dd6c6" } },
          axisLine: { lineStyle: { width: 10, color: [[1, "rgba(120,160,200,0.2)"]] } },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { color: "#8a9aac", distance: 12, fontSize: 10 },
          anchor: { show: true, size: 12, itemStyle: { color: "#3dd6c6" } },
          pointer: { length: "62%", width: 5, itemStyle: { color: "#e8eef6" } },
          title: { show: false },
          detail: {
            valueAnimation: true,
            fontSize: 22,
            fontWeight: 700,
            color: "#e8eef6",
            offsetCenter: [0, "68%"],
            formatter: "{value}%"
          },
          data: [{ value: Number(planPct.toFixed(1)), name: "Выполнение плана МТД" }]
        }
      ]
    }),
    [planPct]
  );

  const refCombo = useChart(comboOption, [comboOption]);
  const refSankey = useChart(sankeyOption, [sankeyOption]);
  const refRose = useChart(roseOption, [roseOption]);
  const refRadar = useChart(radarOption, [radarOption]);
  const refCal = useChart(calendarOption, [calendarOption]);
  const refGauge = useChart(gaugeOption, [gaugeOption]);

  const updatedRu = useMemo(() => {
    try {
      return new Date(data.meta.updated).toLocaleString("ru-RU", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch {
      return data.meta.updated;
    }
  }, [data.meta.updated]);

  const k = data.kpis;

  return (
    <div className="mining-shell">
      <header className="mining-header">
        <div>
          <h1 className="mining-title">{data.meta.enterprise} — {data.meta.process}</h1>
          <p className="mining-sub">
            {data.meta.period_label} · единицы: {data.meta.unit_mass}, {data.meta.unit_grade}
          </p>
        </div>
        <div className="mining-meta">
          Обновлено: {updatedRu}
          <div>Источник: образец данных JSON (папка cursor/docs/Казахстан)</div>
        </div>
      </header>

      <div className="mining-grid">
        <section className="mining-card mining-card--kpi mining-card--third">
          <h2>Добыча МТД</h2>
          <div className="mining-kpi-value">{formatKt(k.actual_mtd_kt)} тыс. т</div>
          <div className={`mining-kpi-delta ${planPct >= 100 ? "mining-kpi-delta--up" : "mining-kpi-delta--down"}`}>
            План {formatKt(k.plan_mtd_kt)} тыс. т · {formatPct(planPct, 1)} выполнения
          </div>
        </section>
        <section className="mining-card mining-card--kpi mining-card--third">
          <h2>Металл в концентрате</h2>
          <div className="mining-kpi-value">{Number(k.metal_in_concentrate_t).toLocaleString("ru-RU")} т</div>
          <div className="mining-kpi-delta mining-kpi-delta--neutral">Кумулятивно за период отчёта</div>
        </section>
        <section className="mining-card mining-card--kpi mining-card--third">
          <h2>Коэфф. вскрыши · ср. сорт</h2>
          <div className="mining-kpi-value">
            {k.strip_ratio.toFixed(2)} · {k.avg_cu_grade_pct.toFixed(2)}% Cu
          </div>
          <div className="mining-kpi-delta mining-kpi-delta--neutral">YoY добыча: {k.yoy_change_pct >= 0 ? "+" : ""}
            {k.yoy_change_pct}%
          </div>
        </section>
        <section className="mining-card mining-card--kpi mining-card--third">
          <h2>Парк · бурение</h2>
          <div className="mining-kpi-value">
            {formatPct(k.fleet_availability_pct)} · {formatPct(k.drilling_progress_pct)}
          </div>
          <div className="mining-kpi-delta mining-kpi-delta--neutral">Доступность · ход КВБР</div>
        </section>

        <section className="mining-card mining-card--wide mining-card--half">
          <h2>Суточная динамика: масса и сорт</h2>
          <div className="chart-host chart-host--tall" ref={refCombo} />
        </section>
        <section className="mining-card mining-card--kpi mining-card--half">
          <h2>Контроль плана (МТД)</h2>
          <div className="chart-host chart-host--compact" ref={refGauge} />
        </section>

        <section className="mining-card mining-card--wide mining-card--half">
          <h2>Потоки руды по переделам</h2>
          <div className="chart-host chart-host--tall" ref={refSankey} />
        </section>
        <section className="mining-card mining-card--half">
          <h2>Структура времени по операциям</h2>
          <div className="chart-host chart-host--tall" ref={refRose} />
        </section>

        <section className="mining-card mining-card--half">
          <h2>Профиль рудников (нормированный радар)</h2>
          <div className="chart-host chart-host--tall" ref={refRadar} />
        </section>
        <section className="mining-card mining-card--half">
          <h2>Интенсивность смен (календарь)</h2>
          <div className="chart-host chart-host--tall" ref={refCal} />
        </section>
      </div>
    </div>
  );
}
