import { getStore } from "@netlify/blobs";

export const config = { path: "/api/catalogo" };

const json = (d, s = 200) =>
  new Response(JSON.stringify(d), {
    status: s,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

export default async (req) => {
  const store = getStore("tienda");

  if (req.method === "GET") {
    const datos = await store.get("catalogo", { type: "json" });
    return json(datos ?? null);
  }

  if (req.method === "POST") {
    const clave = process.env.ADMIN_PASSWORD;
    if (!clave) return json({ error: "Falta ADMIN_PASSWORD en Netlify" }, 500);
    if (req.headers.get("x-admin-password") !== clave) return json({ error: "No autorizado" }, 401);

    let body;
    try { body = await req.json(); } catch { return json({ error: "Datos inválidos" }, 400); }
    if (body.verificar) return json({ ok: true });
    if (!Array.isArray(body.productos)) return json({ error: "Datos inválidos" }, 400);

    await store.setJSON("catalogo", body.productos.slice(0, 500));
    return json({ ok: true });
  }

  return json({ error: "Método no permitido" }, 405);
};
