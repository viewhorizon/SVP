import { useEffect, useState } from "react";
import { createTask, type Task, type TaskPriority } from "../../services/kanbanService";
import { Plus, X, CheckCircle2, Link2, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";

interface CreateTaskModalProps {
  open: boolean;
  defaultCategory: string;
  onClose: () => void;
  onCreate: (task: Task) => void;
}

export function CreateTaskModal({ open, defaultCategory, onClose, onCreate }: CreateTaskModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(defaultCategory || "general");
  const [estimated, setEstimated] = useState("1h");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  
  // Nuevos campos Sprint 3
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [acceptanceCriteria, setAcceptanceCriteria] = useState<string[]>([]);
  const [newCriteria, setNewCriteria] = useState("");
  const [dependencies, setDependencies] = useState<string[]>([]);
  const [newDependency, setNewDependency] = useState("");
  const [risks, setRisks] = useState<string[]>([]);
  const [newRisk, setNewRisk] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setDescription("");
    setCategory(defaultCategory || "general");
    setEstimated("1h");
    setPriority("medium");
    setShowAdvanced(false);
    setAcceptanceCriteria([]);
    setNewCriteria("");
    setDependencies([]);
    setNewDependency("");
    setRisks([]);
    setNewRisk("");
  }, [open, defaultCategory]);

  if (!open) return null;

  const addCriteria = () => {
    if (newCriteria.trim()) {
      setAcceptanceCriteria([...acceptanceCriteria, newCriteria.trim()]);
      setNewCriteria("");
    }
  };

  const removeCriteria = (index: number) => {
    setAcceptanceCriteria(acceptanceCriteria.filter((_, i) => i !== index));
  };

  const addDependency = () => {
    if (newDependency.trim()) {
      setDependencies([...dependencies, newDependency.trim()]);
      setNewDependency("");
    }
  };

  const removeDependency = (index: number) => {
    setDependencies(dependencies.filter((_, i) => i !== index));
  };

  const addRisk = () => {
    if (newRisk.trim()) {
      setRisks([...risks, newRisk.trim()]);
      setNewRisk("");
    }
  };

  const removeRisk = (index: number) => {
    setRisks(risks.filter((_, i) => i !== index));
  };

  const handleCreate = () => {
    if (!title.trim()) return;
    onCreate(
      createTask({
        title,
        description,
        category,
        estimated,
        priority,
        acceptanceCriteria: acceptanceCriteria.length > 0 ? acceptanceCriteria : undefined,
        dependencies: dependencies.length > 0 ? dependencies : undefined,
        risks: risks.length > 0 ? risks : undefined,
      }),
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-xl md:p-5">
        <div className="mb-3">
          <h3 className="text-lg font-bold text-slate-900">Crear tarea</h3>
          <p className="text-xs text-slate-600">Agrega una nueva actividad directamente al tablero.</p>
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Titulo"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2"
          />
          <input
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            placeholder="Categoria"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            value={estimated}
            onChange={(event) => setEstimated(event.target.value)}
            placeholder="Estimado (ej. 2h)"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <select
            value={priority}
            onChange={(event) => setPriority(event.target.value as TaskPriority)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="high">Alta</option>
            <option value="medium">Media</option>
            <option value="low">Baja</option>
          </select>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            placeholder="Descripcion"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2"
          />
        </div>

        {/* Campos avanzados */}
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="mt-3 flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700"
        >
          <span>Campos avanzados (criterios, dependencias, riesgos)</span>
          {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {showAdvanced && (
          <div className="mt-3 space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
            {/* Criterios de Aceptacion */}
            <div>
              <label className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
                <CheckCircle2 size={14} /> Criterios de Aceptacion
              </label>
              <div className="flex gap-2">
                <input
                  value={newCriteria}
                  onChange={(e) => setNewCriteria(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCriteria())}
                  placeholder="Agregar criterio medible..."
                  className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
                />
                <button type="button" onClick={addCriteria} className="rounded bg-emerald-600 p-1 text-white">
                  <Plus size={16} />
                </button>
              </div>
              {acceptanceCriteria.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {acceptanceCriteria.map((c, i) => (
                    <li key={i} className="flex items-center justify-between rounded bg-emerald-100 px-2 py-1 text-xs text-emerald-800">
                      <span>{c}</span>
                      <button type="button" onClick={() => removeCriteria(i)} className="text-emerald-600 hover:text-emerald-800">
                        <X size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Dependencias */}
            <div>
              <label className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-blue-700">
                <Link2 size={14} /> Dependencias (IDs de tareas)
              </label>
              <div className="flex gap-2">
                <input
                  value={newDependency}
                  onChange={(e) => setNewDependency(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addDependency())}
                  placeholder="ID de tarea (ej. sp3-01)..."
                  className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
                />
                <button type="button" onClick={addDependency} className="rounded bg-blue-600 p-1 text-white">
                  <Plus size={16} />
                </button>
              </div>
              {dependencies.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {dependencies.map((d, i) => (
                    <span key={i} className="inline-flex items-center gap-1 rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-800">
                      {d}
                      <button type="button" onClick={() => removeDependency(i)} className="text-blue-600 hover:text-blue-800">
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Riesgos */}
            <div>
              <label className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-amber-700">
                <AlertTriangle size={14} /> Riesgos Identificados
              </label>
              <div className="flex gap-2">
                <input
                  value={newRisk}
                  onChange={(e) => setNewRisk(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addRisk())}
                  placeholder="Describir riesgo potencial..."
                  className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
                />
                <button type="button" onClick={addRisk} className="rounded bg-amber-600 p-1 text-white">
                  <Plus size={16} />
                </button>
              </div>
              {risks.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {risks.map((r, i) => (
                    <li key={i} className="flex items-center justify-between rounded bg-amber-100 px-2 py-1 text-xs text-amber-800">
                      <span>{r}</span>
                      <button type="button" onClick={() => removeRisk(i)} className="text-amber-600 hover:text-amber-800">
                        <X size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleCreate}
            className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white"
          >
            Crear
          </button>
        </div>
      </div>
    </div>
  );
}
