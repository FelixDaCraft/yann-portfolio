/**
 * Backoffice yann.aynn.fr — SPA vanilla hash-routée.
 * #/login · #/dashboard · #/inbox · #/links
 */
import "./admin.css";
import { api } from "./api";
import { renderLogin } from "./views/login";
import { renderDashboard } from "./views/dashboard";
import { renderInbox } from "./views/inbox";
import { renderLinks } from "./views/links";

const app = document.getElementById("app") as HTMLElement;

type View = (root: HTMLElement) => void | Promise<void>;

const routes: Record<string, { view: View; label: string }> = {
  "#/dashboard": { view: renderDashboard, label: "Dashboard" },
  "#/inbox": { view: renderInbox, label: "Inbox" },
  "#/links": { view: renderLinks, label: "Liens" },
};

function shell(activeHash: string): void {
  const nav = Object.entries(routes)
    .map(([hash, r]) => `<a href="${hash}" class="${hash === activeHash ? "is-active" : ""}">${r.label}</a>`)
    .join("");
  app.innerHTML = `
    <header class="admin-header">
      <a class="admin-brand" href="#/dashboard">yann.aynn.fr <span>backoffice</span></a>
      <nav class="admin-nav">${nav}</nav>
      <button type="button" class="admin-logout">Déconnexion</button>
    </header>
    <main class="admin-main"></main>
  `;
  app.querySelector<HTMLButtonElement>(".admin-logout")?.addEventListener("click", () => {
    api("/api/admin/logout", { method: "POST" })
      .catch(() => {})
      .finally(() => {
        location.hash = "#/login";
      });
  });
}

async function navigate(): Promise<void> {
  const hash = location.hash || "#/dashboard";
  if (hash === "#/login") {
    app.innerHTML = "";
    renderLogin(app);
    return;
  }
  const route = routes[hash] ?? routes["#/dashboard"]!;
  shell(hash in routes ? hash : "#/dashboard");
  const main = app.querySelector<HTMLElement>(".admin-main")!;
  try {
    await route.view(main);
  } catch (err) {
    // Les 401 redirigent déjà vers #/login via le wrapper api()
    if (location.hash !== "#/login") {
      main.innerHTML = `<p class="empty">Erreur : ${err instanceof Error ? err.message : "inconnue"}</p>`;
    }
  }
}

window.addEventListener("hashchange", navigate);

// Boot : session valide → vue demandée, sinon login.
api("/api/admin/me")
  .then(() => navigate())
  .catch(() => {
    location.hash = "#/login";
    return navigate();
  });
