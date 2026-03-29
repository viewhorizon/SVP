import { describe, expect, it } from "vitest";
import { buildFodaCoverageCounters, buildPlanningAnalysis, convertRequirementsTextToTasks, parseImportContent, type Task } from "./kanbanService";

describe("kanbanService parsers", () => {
  it("parsea JSON con backlog/sprintlog", () => {
    const payload = JSON.stringify({
      backlog: [
        { title: "API votos", description: "Crear endpoint", priority: "high" },
        "Definir reglas SPV",
      ],
      sprintlog: [{ title: "UI columnas", description: "Ajustar scroll", status: "todo" }],
    });

    const tasks = parseImportContent(payload, "json");
    expect(tasks).toHaveLength(3);
    expect(tasks[0].status).toBe("backlog");
    expect(tasks[2].status).toBe("todo");
  });

  it("parsea lineas pipe-separated en TXT/CSV", () => {
    const content = [
      "Task A|Descripcion amplia|in-progress|backend|high|3h",
      "Task B|Descripcion B|review|frontend|low|1h",
    ].join("\n");

    const tasks = parseImportContent(content, "txt");
    expect(tasks).toHaveLength(2);
    expect(tasks[0].status).toBe("in-progress");
    expect(tasks[1].priority).toBe("low");
  });

  it("parsea formato TOON con columnas de tablero", () => {
    const content = [
      "API puntos|Validar idempotencia|todo|backend|high|4h",
      "UI kanban|Agregar filtros|review|frontend|medium|2h",
    ].join("\n");

    const tasks = parseImportContent(content, "toon");
    expect(tasks).toHaveLength(2);
    expect(tasks[0].status).toBe("todo");
    expect(tasks[0].priority).toBe("high");
    expect(tasks[1].status).toBe("review");
  });

  it("convierte texto de requisitos libre a tareas", () => {
    const content = [
      "- Implementar login seguro (alta)",
      "2. En proceso: endpoint de votos",
      "3) Completado: documentacion API",
    ].join("\n");

    const tasks = convertRequirementsTextToTasks(content);
    expect(tasks).toHaveLength(3);
    expect(tasks[0].priority).toBe("high");
    expect(tasks[1].status).toBe("in-progress");
    expect(tasks[2].status).toBe("done");
  });
});

describe("kanbanService metrics", () => {
  const sampleTasks: Task[] = [
    {
      id: "t-1",
      title: "Fortaleza de arquitectura",
      description: "Descripcion con contexto y metrica 8h",
      category: "backend",
      priority: "medium",
      estimated: "8h",
      status: "todo",
    },
    {
      id: "t-2",
      title: "Debilidad de cobertura",
      description: "Descripcion de riesgo y deuda",
      category: "testing",
      priority: "high",
      estimated: "2h",
      status: "backlog",
    },
  ];

  it("genera resumen SMART con cobertura", () => {
    const analysis = buildPlanningAnalysis(sampleTasks);
    expect(analysis.summary).toContain("2 tareas");
    expect(analysis.smart.coverage).toBeGreaterThan(0);
    expect(analysis.smart.measurable).toBeGreaterThanOrEqual(50);
  });

  it("cuenta FODA por palabras clave", () => {
    const counters = buildFodaCoverageCounters(sampleTasks);
    expect(counters.fortalezas).toBe(1);
    expect(counters.debilidades).toBe(1);
  });
});