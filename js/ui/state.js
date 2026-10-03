/* État de l'interface (non persistant, propre à cet onglet) : le jour
   sélectionné est partagé entre Aujourd'hui, Entraînement et Nutrition,
   pour qu'un jour choisi dans un onglet le reste dans les autres. */
import { todayKey } from "../core/util.js";

export const ui = {
  date: todayKey(),
  openedOn: todayKey(),
  progressTab: "activity",
  historyMode: "jour",
  historyDate: todayKey(),
  calMonth: null,
  weightRange: "3m",
  library: { q: "", group: "", equip: "" },
};

/* Au retour sur l'application le lendemain, on revient sur aujourd'hui
   plutôt que de rester sur la date d'hier. */
export function refreshDay() {
  const t = todayKey();
  if (ui.openedOn !== t) {
    ui.openedOn = t;
    ui.date = t;
    ui.historyDate = t;
    return true;
  }
  return false;
}
