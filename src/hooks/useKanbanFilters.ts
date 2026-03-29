import { useMemo, useState } from "react";
import { STATUS_FILTER_BUTTONS, type Task, type TaskStatus } from "../services/kanbanService";

export const useKanbanFilters = (tasks: Task[]) => {
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilters, setStatusFilters] = useState<Array<"all" | TaskStatus>>(["all"]);

  const isStatusVisible = (status: TaskStatus) => statusFilters.includes("all") || statusFilters.includes(status);

  const toggleStatusFilter = (status: "all" | TaskStatus) => {
    setStatusFilters((current) => {
      if (status === "all") return ["all"];

      const currentWithoutAll = current.filter((value) => value !== "all") as TaskStatus[];
      const alreadySelected = currentWithoutAll.includes(status);

      if (alreadySelected) {
        const next = currentWithoutAll.filter((value) => value !== status);
        return next.length > 0 ? next : ["all"];
      }

      return [...currentWithoutAll, status];
    });
  };

  const categories = useMemo(
    () => ["all", ...new Set(tasks.map((task) => task.category).sort((a, b) => a.localeCompare(b)))],
    [tasks],
  );

  const filteredTasks = useMemo(
    () => tasks.filter((task) => (categoryFilter === "all" || task.category === categoryFilter) && isStatusVisible(task.status)),
    [tasks, categoryFilter, statusFilters],
  );

  const statusCounters = useMemo(() => {
    const base = {
      all: tasks.length,
      backlog: 0,
      todo: 0,
      "in-progress": 0,
      review: 0,
      done: 0,
    } as Record<"all" | TaskStatus, number>;

    tasks.forEach((task) => {
      base[task.status] += 1;
    });

    return base;
  }, [tasks]);

  return {
    categoryFilter,
    setCategoryFilter,
    statusFilters,
    toggleStatusFilter,
    isStatusVisible,
    categories,
    filteredTasks,
    statusButtons: STATUS_FILTER_BUTTONS,
    statusCounters,
  };
};