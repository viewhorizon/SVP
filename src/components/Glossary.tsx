import { useMemo, useState } from "react";
import { Search } from "lucide-react";

type GlossaryCategory = "Puntos y votos" | "API y seguridad" | "Integración y operación" | "Datos y arquitectura";

type GlossaryEntry = {
  term: string;
  category: GlossaryCategory;
  definition: string;
};

const categories: GlossaryCategory[] = [
  "Puntos y votos",
  "API y seguridad",
  "Integración y operación",
  "Datos y arquitectura",
];

const entries: GlossaryEntry[] = [
  { term: "SPV", category: "Puntos y votos", definition: "Sistema de Votos y Puntos. Convierte la actividad y los votos válidos en puntos según las reglas activas." },
  { term: "Voto", category: "Puntos y votos", definition: "Registro de apoyo de una persona a una actividad. Puede aportar al cálculo de puntos, pero no representa una compra." },
  { term: "votes", category: "Puntos y votos", definition: "Tabla que conserva los votos registrados, su actividad, usuario, solicitud y puntos generados." },
  { term: "Actividad", category: "Puntos y votos", definition: "Trabajo o acción registrada que puede recibir votos y participar en el cálculo de puntos." },
  { term: "point_rules", category: "Puntos y votos", definition: "Tabla con las reglas versionadas que determinan cómo se calculan los puntos para cada tipo de actividad." },
  { term: "point_limits", category: "Puntos y votos", definition: "Tabla de límites de negocio, como votos o puntos máximos dentro de un periodo y alcance definidos." },
  { term: "points_wallet", category: "Puntos y votos", definition: "Billetera de cada usuario: muestra sus puntos disponibles y el total acumulado durante su vida en el sistema." },
  { term: "available_points", category: "Puntos y votos", definition: "Cantidad de puntos que el usuario puede usar o transferir actualmente." },
  { term: "lifetime_points", category: "Puntos y votos", definition: "Total histórico de puntos acumulados; no equivale necesariamente al saldo disponible." },
  { term: "points_ledger", category: "Puntos y votos", definition: "Libro de movimientos de puntos. Registra cada crédito o débito y los saldos antes y después para facilitar la trazabilidad." },
  { term: "Crédito (CREDIT)", category: "Puntos y votos", definition: "Movimiento que aumenta el saldo de una billetera." },
  { term: "Débito (DEBIT)", category: "Puntos y votos", definition: "Movimiento que reduce el saldo de una billetera, por ejemplo al transferir puntos." },
  { term: "Transferencia", category: "Puntos y votos", definition: "Movimiento de puntos entre usuarios. Se registra para que el origen y el destino puedan auditarse." },
  { term: "Alcance (scope)", category: "Puntos y votos", definition: "Indica dónde aplica una regla o límite: de forma global, para una persona o para una actividad." },
  { term: "Alcance de actividad", category: "Puntos y votos", definition: "Clasificación de la actividad, por ejemplo global, local, digital o real; puede seleccionar una regla de puntos." },
  { term: "Límite diario", category: "Puntos y votos", definition: "Máximo permitido durante una ventana de un día, como la cantidad de votos, créditos o transferencias." },
  { term: "Rate limit", category: "API y seguridad", definition: "Protección que limita cuántas solicitudes puede hacer un cliente en cierto periodo. Reduce abuso y mantiene disponible la API; es distinto de los límites de negocio de point_limits." },
  { term: "Idempotencia", category: "API y seguridad", definition: "Propiedad por la que repetir la misma solicitud no duplica su efecto. El identificador de solicitud permite reconocer un reintento." },
  { term: "requestId", category: "API y seguridad", definition: "Identificador de una solicitud. Sirve para rastrear su recorrido y evitar que un reintento aplique dos veces la misma operación." },
  { term: "eventId", category: "API y seguridad", definition: "Identificador único de un evento de negocio, útil para reconocer duplicados y seguirlo en registros." },
  { term: "UUID", category: "API y seguridad", definition: "Identificador único con formato estándar, usado para distinguir usuarios, eventos y solicitudes." },
  { term: "API", category: "API y seguridad", definition: "Interfaz que permite que la aplicación y otros servicios intercambien datos mediante solicitudes y respuestas." },
  { term: "Endpoint", category: "API y seguridad", definition: "Dirección y método concretos de una API para una operación; por ejemplo, registrar un voto." },
  { term: "Token Bearer", category: "API y seguridad", definition: "Credencial que el cliente autorizado envía con una solicitud para demostrar su identidad o permisos. Debe mantenerse privada." },
  { term: "Transacción", category: "Datos y arquitectura", definition: "Grupo de cambios de base de datos que se confirma completo o se revierte completo, evitando estados parciales." },
  { term: "Concurrencia", category: "Datos y arquitectura", definition: "Situación en la que varias solicitudes ocurren a la vez. El sistema debe mantener saldos y registros consistentes." },
  { term: "JSONB", category: "Datos y arquitectura", definition: "Tipo de PostgreSQL para almacenar datos estructurados en formato JSON y consultarlos sin crear una columna para cada atributo." },
  { term: "Metadatos (metadata)", category: "Datos y arquitectura", definition: "Información complementaria asociada a un registro, como el origen de una operación o detalles de auditoría." },
  { term: "Neon / PostgreSQL", category: "Datos y arquitectura", definition: "Neon aloja la base de datos PostgreSQL del proyecto. PostgreSQL guarda y relaciona los datos mediante tablas y transacciones." },
  { term: "Reintento", category: "Integración y operación", definition: "Nuevo intento de una operación que no pudo completarse. La idempotencia ayuda a que un reintento seguro no duplique efectos." },
  { term: "Outbox Pattern", category: "Integración y operación", definition: "Patrón que guarda un evento en la misma base de datos que el cambio de negocio y lo entrega después, con seguimiento y reintentos." },
  { term: "At-least-once", category: "Integración y operación", definition: "Garantía de entrega que permite que un evento llegue una o más veces; el receptor debe tolerar duplicados." },
  { term: "Dead-letter queue (DLQ)", category: "Integración y operación", definition: "Cola o registro donde quedan los eventos que agotaron sus reintentos, para poder revisarlos y resolverlos." },
  { term: "Reconciliación", category: "Integración y operación", definition: "Proceso que compara saldos o registros relacionados para detectar y resolver diferencias." },
  { term: "Health check", category: "Integración y operación", definition: "Comprobación rápida que indica si una API o servicio responde y está disponible." },
  { term: "Modo de simulación", category: "Integración y operación", definition: "Entorno controlado para probar flujos y observar eventos sin confundirlos con una operación real." },
  { term: "Kanban", category: "Integración y operación", definition: "Tablero visual para organizar tareas por estado, como pendiente, en curso o completada." },
];

export default function Glossary() {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<GlossaryCategory | "Todos">("Todos");

  const filteredEntries = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("es");
    return entries.filter((entry) => {
      const matchesCategory = activeCategory === "Todos" || entry.category === activeCategory;
      const searchableText = `${entry.term} ${entry.definition} ${entry.category}`.toLocaleLowerCase("es");
      return matchesCategory && (!normalizedQuery || searchableText.includes(normalizedQuery));
    });
  }, [activeCategory, query]);

  return (
    <section aria-labelledby="glossary-heading" className="mt-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">Referencia del sistema</p>
            <h3 id="glossary-heading" className="mt-1 text-xl font-bold text-slate-900">Glosario del sistema</h3>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
              Explicaciones breves de los términos de votos, puntos, API e infraestructura que aparecen en la aplicación.
            </p>
          </div>
          <span aria-live="polite" className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {filteredEntries.length} {filteredEntries.length === 1 ? "término" : "términos"}
          </span>
        </div>

        <label htmlFor="glossary-search" className="sr-only">Buscar en el glosario</label>
        <div className="relative mt-5">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            id="glossary-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar término, concepto o explicación"
            className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <div role="group" aria-label="Filtrar términos por categoría" className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {(["Todos", ...categories] as const).map((category) => {
            const isActive = activeCategory === category;
            return (
              <button
                key={category}
                type="button"
                aria-pressed={isActive}
                onClick={() => setActiveCategory(category)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  isActive
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                {category}
              </button>
            );
          })}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {filteredEntries.map((entry) => (
            <article key={entry.term} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="font-semibold text-slate-900">{entry.term}</h4>
                <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-slate-500 ring-1 ring-slate-200">
                  {entry.category}
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">{entry.definition}</p>
            </article>
          ))}
          {filteredEntries.length === 0 && (
            <p className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 md:col-span-2">
              No se encontraron términos. Prueba otra búsqueda o selecciona otra categoría.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
