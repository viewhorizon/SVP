import { useEffect, useState } from "react";
import { createTask, type Task, type TaskPriority } from "../../services/kanbanService";

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

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setDescription("");
    setCategory(defaultCategory || "general");
    setEstimated("1h");
    setPriority("medium");
  }, [open, defaultCategory]);

  if (!open) return null;

  const handleCreate = () => {
    if (!title.trim()) return;
    onCreate(
      createTask({
        title,
        description,
        category,
        estimated,
        priority,
      }),
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-4 shadow-xl md:p-5">
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
            rows={4}
            placeholder="Descripcion"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2"
          />
        </div>

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
