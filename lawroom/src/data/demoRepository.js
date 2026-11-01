import { seed } from "../domain.js";
import { demoEvents, eventKinds } from "../calendar-domain.js";

function read(key, fallback, valid) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    if (valid(value)) return value;
  } catch {}
  return structuredClone(fallback);
}
function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}
export const demoRepository = {
  listMatters: () =>
    read(
      "lawroom-demo-v1",
      seed,
      (x) =>
        Array.isArray(x) &&
        x.every((c) => c.id && c.tasks && c.events && c.messages),
    ),
  saveMatters: (x) => write("lawroom-demo-v1", x),
  listAgenda: () =>
    read(
      "lawroom-calendar-v1",
      demoEvents,
      (x) =>
        Array.isArray(x) &&
        x.every(
          (e) =>
            e &&
            eventKinds[e.kind] &&
            typeof e.date === "string" &&
            typeof e.title === "string" &&
            e.status,
        ),
    ).map((e) => ({
      ...e,
      lawyer:
        {
          "alkim-azmioglu": "demo-lawyer-a",
          "enes-can-yolcu": "demo-lawyer-b",
        }[e.lawyer] || e.lawyer,
    })),
  saveAgenda: (x) => write("lawroom-calendar-v1", x),
};
