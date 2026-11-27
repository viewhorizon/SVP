import React, { useState } from 'react';
import { ChevronDown, TrendingUp, AlertCircle } from 'lucide-react';
import type { Task } from '../../services/kanbanService';

interface StrategicBacklogPanelProps {
  strategicTasks: Task[];
  allTasks: Task[];
  onTaskClick: (task: Task) => void;
}

export const StrategicBacklogPanel: React.FC<StrategicBacklogPanelProps> = ({
  strategicTasks,
  allTasks,
  onTaskClick,
}) => {
  const [expandedTaskIds, setExpandedTaskIds] = useState<string[]>([]);

  const toggleExpanded = (taskId: string) => {
    setExpandedTaskIds((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
  };

  // Calcular progreso de una tarea estratégica basado en sus subtareas
  const getTaskProgress = (task: Task): number => {
    if (!task.childTaskIds || task.childTaskIds.length === 0) return 0;

    const childTasks = allTasks.filter((t) => task.childTaskIds?.includes(t.id));
    const completedCount = childTasks.filter((t) => t.status === 'done').length;
    return Math.round((completedCount / childTasks.length) * 100);
  };

  // Color gradual basado en progreso
  const getProgressColor = (progress: number): string => {
    if (progress === 0) return 'from-slate-200 to-slate-300'; // gris
    if (progress < 25) return 'from-red-200 to-red-300'; // rojo
    if (progress < 50) return 'from-orange-200 to-orange-300'; // naranja
    if (progress < 75) return 'from-yellow-200 to-yellow-300'; // amarillo
    if (progress < 100) return 'from-lime-200 to-lime-300'; // lima
    return 'from-emerald-200 to-emerald-300'; // verde
  };

  const getProgressTextColor = (progress: number): string => {
    if (progress === 0) return 'text-slate-700';
    if (progress < 25) return 'text-red-700';
    if (progress < 50) return 'text-orange-700';
    if (progress < 75) return 'text-yellow-700';
    if (progress < 100) return 'text-lime-700';
    return 'text-emerald-700';
  };

  return (
    <div className="space-y-4">
      {strategicTasks.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-600">
          No hay tareas estratégicas en el backlog
        </div>
      ) : (
        strategicTasks.map((task) => {
          const progress = getTaskProgress(task);
          const childTasks = allTasks.filter((t) => task.childTaskIds?.includes(t.id)) || [];
          const isExpanded = expandedTaskIds.includes(task.id);

          return (
            <div
              key={task.id}
              className={`rounded-lg border-2 border-slate-200 bg-gradient-to-r ${getProgressColor(
                progress
              )} p-4 transition-all hover:shadow-md cursor-pointer`}
            >
              {/* Header */}
              <div
                className="flex items-start justify-between gap-4"
                onClick={() => toggleExpanded(task.id)}
              >
                <div className="flex-1">
                  <h4 className="font-bold text-slate-900">{task.title}</h4>
                  <p className="text-sm text-slate-700">{task.description}</p>

                  {/* Metadata */}
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <span className={`inline-block rounded-full px-2 py-1 ${
                      task.priority === 'high' ? 'bg-red-100 text-red-700' :
                      task.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {task.priority}
                    </span>
                    <span className="text-slate-600">{task.estimated}</span>
                  </div>
                </div>

                {/* Progress Indicator */}
                <div className="text-right">
                  <div className={`text-2xl font-bold ${getProgressTextColor(progress)}`}>
                    {progress}%
                  </div>
                  <div className="text-xs text-slate-600">
                    {childTasks.filter((t) => t.status === 'done').length}/{childTasks.length} completas
                  </div>
                  <ChevronDown
                    className={`mt-1 w-4 h-4 transition-transform ${
                      isExpanded ? 'rotate-180' : ''
                    }`}
                  />
                </div>
              </div>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="mt-4 space-y-3 border-t border-slate-300 pt-4">
                  {/* Criterios de Aceptación */}
                  {task.acceptanceCriteria && task.acceptanceCriteria.length > 0 && (
                    <div>
                      <h5 className="font-semibold text-slate-800 text-xs">Criterios de Aceptación:</h5>
                      <ul className="mt-1 space-y-1">
                        {task.acceptanceCriteria.map((criterion, idx) => (
                          <li key={idx} className="flex gap-2 text-xs text-slate-700">
                            <span className="text-emerald-600">✓</span>
                            {criterion}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Dependencias */}
                  {task.dependencies && task.dependencies.length > 0 && (
                    <div>
                      <h5 className="font-semibold text-slate-800 text-xs">Dependencias:</h5>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {task.dependencies.map((depId) => (
                          <span
                            key={depId}
                            className="inline-block rounded bg-blue-100 px-2 py-1 text-xs text-blue-700 cursor-pointer hover:bg-blue-200"
                            onClick={() => {
                              const depTask = allTasks.find((t) => t.id === depId);
                              if (depTask) onTaskClick(depTask);
                            }}
                          >
                            {depId}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Riesgos */}
                  {task.risks && task.risks.length > 0 && (
                    <div className="rounded-lg bg-orange-50 p-2">
                      <h5 className="font-semibold text-orange-900 text-xs flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Riesgos Identificados:
                      </h5>
                      <ul className="mt-1 space-y-1">
                        {task.risks.map((risk, idx) => (
                          <li key={idx} className="text-xs text-orange-800">
                            • {risk}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Subtareas */}
                  {childTasks.length > 0 && (
                    <div>
                      <h5 className="font-semibold text-slate-800 text-xs flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" /> Subtareas ({childTasks.filter(t => t.status === 'done').length}/{childTasks.length}):
                      </h5>
                      <div className="mt-2 space-y-1">
                        {childTasks.map((child) => (
                          <div
                            key={child.id}
                            className={`flex items-center gap-2 rounded px-2 py-1 text-xs cursor-pointer hover:bg-black/5 ${
                              child.status === 'done' ? 'text-slate-500 line-through' : 'text-slate-700'
                            }`}
                            onClick={() => onTaskClick(child)}
                          >
                            <span
                              className={`inline-block w-2 h-2 rounded-full ${
                                child.status === 'done' ? 'bg-emerald-500' :
                                child.status === 'in-progress' ? 'bg-amber-500' :
                                child.status === 'review' ? 'bg-violet-500' :
                                'bg-slate-400'
                              }`}
                            />
                            <span className="font-mono">{child.id}</span> - {child.title}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
};
