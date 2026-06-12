import { api } from "../api";
import type { LinkResult } from "../api";
import { esc } from "../charts";

export function renderLinks(root: HTMLElement): void {
  root.innerHTML = `
    <div class="inbox-head"><h2>Santé des liens externes</h2></div>
    <p class="links-intro">Vérifie tous les liens sortants du site déployé (HEAD, fallback GET). Un lien mort sur un portfolio fait mauvaise impression — à lancer de temps en temps.</p>
    <button type="button" class="btn-primary" id="linkcheck-run">Vérifier les liens</button>
    <div id="linkcheck-results"></div>
  `;

  const button = root.querySelector<HTMLButtonElement>("#linkcheck-run")!;
  const results = root.querySelector<HTMLElement>("#linkcheck-results")!;

  button.addEventListener("click", async () => {
    button.disabled = true;
    button.textContent = "Vérification en cours…";
    try {
      const data = await api<{ checked: number; results: LinkResult[] }>("/api/admin/linkcheck", { method: "POST" });
      const rows = data.results
        .map(
          (r) => `
          <tr class="${r.ok ? "" : "is-dead"}">
            <td><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.url)}</a></td>
            <td>${r.status === 0 ? "✗ injoignable" : r.status}</td>
            <td>${r.ms} ms</td>
          </tr>`,
        )
        .join("");
      const dead = data.results.filter((r) => !r.ok).length;
      results.innerHTML = `
        <p class="links-summary">${data.checked} liens vérifiés · ${dead === 0 ? "tous OK ✓" : `<strong>${dead} mort${dead > 1 ? "s" : ""}</strong>`}</p>
        <table class="links-table">
          <thead><tr><th>URL</th><th>Statut</th><th>Latence</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      `;
    } catch (err) {
      results.innerHTML = `<p class="empty">Erreur : ${err instanceof Error ? esc(err.message) : "inconnue"}</p>`;
    } finally {
      button.disabled = false;
      button.textContent = "Vérifier les liens";
    }
  });
}
