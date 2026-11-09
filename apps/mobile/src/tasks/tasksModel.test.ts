import { describe, expect, it } from "vitest";
import { canTick, completionId, myTasks, recurrenceLabel, summarizeDay, taskRunsOn, tasksForDay, type StableTask, type TaskCompletion } from "./tasksModel";

const TUE = new Date(2026, 10, 10);

const task = (over: Partial<StableTask> = {}): StableTask => ({
  id: "t1", horseId: "h1", title: "Sortie au pré", assigneeUserId: "u-dp", assigneeName: null, weekdays: [1, 2, 3], dueDate: null,
  time: "08:00", notes: "", validFrom: new Date(2026, 10, 1), validUntil: null, updatedAt: "", ...over,
});

describe("taskRunsOn", () => {
  it("récurrente : les bons jours, dans sa validité", () => {
    expect(taskRunsOn(task(), TUE)).toBe(true);
    expect(taskRunsOn(task({ weekdays: [4] }), TUE)).toBe(false);
    expect(taskRunsOn(task({ validFrom: new Date(2026, 10, 11) }), TUE)).toBe(false);
    expect(taskRunsOn(task({ validUntil: new Date(2026, 10, 9) }), TUE)).toBe(false);
  });
  it("ponctuelle : seulement son jour", () => {
    const once = task({ weekdays: [], dueDate: new Date(2026, 10, 10, 15) });
    expect(taskRunsOn(once, TUE)).toBe(true);
    expect(taskRunsOn(once, new Date(2026, 10, 11))).toBe(false);
    expect(taskRunsOn(task({ weekdays: [], dueDate: null }), TUE)).toBe(false);
  });
});

describe("tasksForDay", () => {
  const done: TaskCompletion = { id: completionId("t2", TUE), taskId: "t2", horseId: "h1", date: TUE, doneByUserId: "u-dp", doneAt: new Date() };
  it("à faire d'abord, par heure, la tâche faite ensuite", () => {
    const list = tasksForDay([task({ id: "t2", time: "07:00" }), task({ id: "t3", time: "18:00", title: "Repas" }), task({ id: "t1" })], [done], TUE);
    expect(list.map((o) => o.task.id)).toEqual(["t1", "t3", "t2"]);
    expect(list[2].completion?.doneByUserId).toBe("u-dp");
  });
});

describe("myTasks / canTick", () => {
  it("ma liste : ce qui m'est confié", () => {
    const list = tasksForDay([task(), task({ id: "t2", assigneeUserId: "u-groom" }), task({ id: "t3", assigneeUserId: null, assigneeName: "Inès" })], [], TUE);
    expect(myTasks(list, "u-dp").map((o) => o.task.id)).toEqual(["t1"]);
    expect(myTasks(list, null)).toEqual([]);
  });
  it("cocher : le chargé de tâche, ou qui gère les tâches", () => {
    expect(canTick(task(), "u-dp", false)).toBe(true);
    expect(canTick(task(), "u-coach", false)).toBe(false);
    expect(canTick(task(), "u-coach", true)).toBe(true);
    expect(canTick(task({ assigneeUserId: null }), null, false)).toBe(false);
  });
});

describe("summarizeDay", () => {
  it("avancement, et retard seulement aujourd'hui", () => {
    const list = tasksForDay([task(), task({ id: "t2", time: "18:00" })], [], TUE);
    expect(summarizeDay(list, new Date(2026, 10, 10, 9, 0))).toEqual({ total: 2, done: 0, late: 1 });
    expect(summarizeDay(list, new Date(2026, 10, 9, 23, 0))).toEqual({ total: 2, done: 0, late: 0 });
  });
});

describe("recurrenceLabel", () => {
  it("jours abrégés, « tous les jours », rien pour une ponctuelle", () => {
    expect(recurrenceLabel([5, 1, 3], "tous les jours")).toBe("lun, mer, ven");
    expect(recurrenceLabel([1, 2, 3, 4, 5, 6, 7], "tous les jours")).toBe("tous les jours");
    expect(recurrenceLabel([], "x")).toBeNull();
  });
});
