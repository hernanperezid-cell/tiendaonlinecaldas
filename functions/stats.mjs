import { getStore } from "@netlify/blobs";

export const config = { path: "/api/stats" };

const json = (d, s = 200) =>
  new Response(JSON.stringify(d), {
    status: s,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

const hoy = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
const corto = (t, n) => String(t ?? "").slice(0, n);

export default async (req) => {
  const store = getStore("estadisticas");

  // Ver estadísticas: solo con la clave de administrador
  if (req.method === "GET") {
    const clave = process.env.ADMIN_PASSWORD;
    if (!clave) return json({ error: "Falta ADMIN_PASSWORD en Netlify" }, 500);
    if (req.headers.get("x-admin-password") !== clave) return json({ error: "No autorizado" }, 401);
    const datos = (await store.get("datos", { type: "json" })) ?? { dias: {}, prods: {}, pedidos: [] };
    return json(datos);
  }

  // Registrar un evento (lo envía la tienda; no lleva datos personales salvo el nombre que el cliente escribe)
  if (req.method === "POST") {
    let b;
    try { b = await req.json(); } catch { return json({ error: "Datos inválidos" }, 400); }
    const tipos = ["visita", "vista", "agregar", "pedido"];
    if (!tipos.includes(b.t)) return json({ error: "Evento inválido" }, 400);

    const d = (await store.get("datos", { type: "json" })) ?? { dias: {}, prods: {}, pedidos: [] };
    const dia = hoy();
    const x = (d.dias[dia] ??= { visita: 0, vista: 0, agregar: 0, pedido: 0 });
    x[b.t] = (x[b.t] || 0) + 1;

    if (b.t !== "visita" && b.id) {
      const id = corto(b.id, 40);
      const p = (d.prods[id] ??= { n: corto(b.nombre, 80), vista: 0, agregar: 0, pedido: 0 });
      if (b.nombre) p.n = corto(b.nombre, 80);
      p[b.t] = (p[b.t] || 0) + 1;
    }

    if (b.t === "pedido") {
      d.pedidos.unshift({
        f: new Date().toISOString(),
        cliente: corto(b.cliente, 60),
        items: corto(b.items, 400),
        total: Number(b.total) || 0,
        et: corto(b.et, 30),
      });
      d.pedidos = d.pedidos.slice(0, 100);
      // pedidos por producto
      for (const id of Array.isArray(b.ids) ? b.ids.slice(0, 30) : []) {
        const k = corto(id.id, 40);
        const p = (d.prods[k] ??= { n: corto(id.n, 80), vista: 0, agregar: 0, pedido: 0 });
        p.pedido = (p.pedido || 0) + 1;
      }
    }

    // conservar solo los últimos 120 días
    const llaves = Object.keys(d.dias).sort();
    while (llaves.length > 120) delete d.dias[llaves.shift()];

    await store.setJSON("datos", d);
    return json({ ok: true });
  }

  return json({ error: "Método no permitido" }, 405);
};
