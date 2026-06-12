import { api, ApiError } from "../api";

export function renderLogin(root: HTMLElement): void {
  root.innerHTML = `
    <div class="login-wrap">
      <form class="login-card" id="login-form">
        <h1>Backoffice<span>.</span></h1>
        <p class="login-sub">yann.aynn.fr</p>
        <label>
          <span>Mot de passe</span>
          <input type="password" name="password" autocomplete="current-password" autofocus required />
        </label>
        <button type="submit">Entrer →</button>
        <p class="login-error" role="alert"></p>
      </form>
    </div>
  `;

  const form = root.querySelector<HTMLFormElement>("#login-form")!;
  const errorEl = root.querySelector<HTMLElement>(".login-error")!;
  const button = form.querySelector<HTMLButtonElement>("button")!;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const password = String(new FormData(form).get("password") ?? "");
    if (!password) return;
    button.disabled = true;
    errorEl.textContent = "";
    try {
      await api("/api/admin/login", { method: "POST", body: JSON.stringify({ password }) });
      // Coupe le tracker analytics sur ce navigateur (cf. src/track.ts)
      try {
        localStorage.setItem("yt_admin", "1");
      } catch {
        /* storage indisponible */
      }
      location.hash = "#/dashboard";
    } catch (err) {
      errorEl.textContent = err instanceof ApiError ? err.message : "Erreur réseau, réessaie.";
    } finally {
      button.disabled = false;
    }
  });
}
