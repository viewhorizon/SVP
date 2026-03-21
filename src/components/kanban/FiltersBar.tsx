import { TaskStatus } from '../../services/kanbanService';

interface FiltersBarProps {
  selectedCategory: string;
  categories: string[];
  onCategoryChange: (category: string) => void;
  statusFilter: 'all' | TaskStatus;
  onStatusFilterChange: (filter: 'all' | TaskStatus) => void;
  horizontalMobileMode: boolean;
  onHorizontalToggle: () => void;
}

export const FiltersBar: React.FC<FiltersBarProps> = ({
  selectedCategory,
  categories,
  onCategoryChange,
  statusFilter,
  onStatusFilterChange,
  horizontalMobileMode,
  onHorizontalToggle,
}) => {
  const statusButtons: Array<{ value: 'all' | TaskStatus; label: string }> = [
    { value: 'all', label: 'Todos los estados' },
    { value: 'backlog', label: 'Backlog' },
    { value: 'todo', label: 'Por Hacer' },
    { value: 'in-progress', label: 'En Proceso' },
    { value: 'review', label: 'Revisión' },
    { value: 'done', label: 'Completado' },
  ];

  return (
    <div className="mb-6 flex flex-wrap items-center gap-3">
      {/* Horizontal mode toggle for mobile/tablet */}
      <div className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2">
        <span className="text-xs font-medium text-slate-600">Desplazamiento:</span>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={horizontalMobileMode}
            onChange={onHorizontalToggle}
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-xs text-slate-700">Horizontal (móvil/tablet)</span>
        </label>
      </div>

      {/* Status filter buttons */}
      <div className="flex flex-wrap gap-2 overflow-x-auto pb-1">
        {statusButtons.map((btn) => (
          <button
            key={btn.value}
            type="button"
            onClick={() => onStatusFilterChange(btn.value)}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-all ${
              statusFilter === btn.value
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white text-slate-700 shadow-sm border border-slate-300 hover:bg-slate-50'
            }`}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => onCategoryChange('all')}
          className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-medium transition-all ${
            selectedCategory === 'all'
              ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md'
              : 'bg-white text-slate-700 shadow-sm border border-slate-300 hover:bg-slate-50'
          }`}
        >
          Todas las tareas
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => onCategoryChange(cat)}
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-medium transition-all ${
              selectedCategory === cat
                ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md'
                : 'bg-white text-slate-700 shadow-sm border border-slate-300 hover:bg-slate-50'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>
    </div>
  );
};