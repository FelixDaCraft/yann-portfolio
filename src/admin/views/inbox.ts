import { api } from "../api";
import type { Message } from "../api";
import { esc } from "../charts";

const dateFmt = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  dateStyle: "medium",
  timeStyle: "short",
});

function fmtDuration(ms: number | null): string {
  if (ms === null) return "—";
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
}

function contextPanel(m: Message): string {
  let sections: string[] = [];
  try {
    sections = m.sections ? (JSON.parse(m.sections) as string[]) : [];
  } catch {
    /* snapshot illisible */
  }
  return `
    <dl class="msg-context">
      <div><dt>Reçu</dt><dd>${esc(dateFmt.format(new Date(m.ts)))}</dd></div>
      <div><dt>Provenance</dt><dd>${esc(m.referrer || "direct")}</dd></div>
      <div><dt>Pays</dt><dd>${esc(m.country ?? "—")}</dd></div>
      <div><dt>Appareil</dt><dd>${esc(m.device ?? "—")}</dd></div>
      <div><dt>Durée de visite</dt><dd>${fmtDuration(m.duration)}</dd></div>
      <div><dt>Sections vues</dt><dd>${sections.length > 0 ? esc(sections.join(" → ")) : "—"}</dd></div>
    </dl>
  `;
}

export async function renderInbox(root: HTMLElement, selectedId: number | null = null): Promise<void> {
  root.innerHTML = `<p class="empty">Chargement…</p>`;
  const { messages, unread } = await api<{ messages: Message[]; total: number; unread: number }>(
    "/api/admin/messages?limit=200",
  );

  if (messages.length === 0) {
    root.innerHTML = `<p class="empty">Aucun message pour l'instant. Ça viendra.</p>`;
    return;
  }

  const selected = messages.find((m) => m.id === selectedId) ?? messages[0]!;

  const list = messages
    .map(
      (m) => `
      <button type="button" class="msg-item${m.read ? "" : " is-unread"}${m.id === selected.id ? " is-selected" : ""}" data-id="${m.id}">
        <span class="msg-from">${esc(m.name)}</span>
        <span class="msg-preview">${esc(m.body.slice(0, 70))}</span>
        <span class="msg-date">${esc(dateFmt.format(new Date(m.ts)))}</span>
      </button>`,
    )
    .join("");

  root.innerHTML = `
    <div class="inbox-head"><h2>Inbox <small>${messages.length} message${messages.length > 1 ? "s" : ""}${unread > 0 ? ` · ${unread} non lu${unread > 1 ? "s" : ""}` : ""}</small></h2></div>
    <div class="inbox-grid">
      <div class="msg-list">${list}</div>
      <article class="msg-detail">
        <header>
          <h3>${esc(selected.name)}</h3>
          <a href="mailto:${esc(selected.email)}?subject=Re%3A%20ton%20message%20sur%20yann.aynn.fr" class="msg-reply">Répondre à ${esc(selected.email)} →</a>
        </header>
        <pre class="msg-body">${esc(selected.body)}</pre>
        ${contextPanel(selected)}
        <footer>
          <button type="button" class="btn-ghost" data-toggle-read>${selected.read ? "Marquer non lu" : "Marquer lu"}</button>
          <button type="button" class="btn-danger" data-delete>Supprimer</button>
        </footer>
      </article>
    </div>
  `;

  // Sélection d'un message → marque lu automatiquement.
  root.querySelectorAll<HTMLButtonElement>(".msg-item").forEach((item) =>
    item.addEventListener("click", async () => {
      const id = Number(item.dataset["id"]);
      const msg = messages.find((m) => m.id === id);
      if (msg && !msg.read) await api(`/api/admin/messages/${id}`, { method: "PATCH", body: JSON.stringify({ read: true }) });
      void renderInbox(root, id);
    }),
  );

  root.querySelector<HTMLButtonElement>("[data-toggle-read]")?.addEventListener("click", async () => {
    await api(`/api/admin/messages/${selected.id}`, { method: "PATCH", body: JSON.stringify({ read: !selected.read }) });
    void renderInbox(root, selected.id);
  });

  root.querySelector<HTMLButtonElement>("[data-delete]")?.addEventListener("click", async () => {
    if (!confirm(`Supprimer définitivement le message de ${selected.name} ?`)) return;
    await api(`/api/admin/messages/${selected.id}`, { method: "DELETE" });
    void renderInbox(root);
  });

  // Si le 1er message affiché était non lu (sélection auto), le marquer lu.
  if (!selected.read && selectedId === null) {
    await api(`/api/admin/messages/${selected.id}`, { method: "PATCH", body: JSON.stringify({ read: true }) });
    selected.read = 1;
  }
}
