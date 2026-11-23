import { getStore } from "@netlify/blobs";

export const config = { path: ["/api/imagen", "/api/imagen/*"] };

const json = (d, s = 200) =>
  new Response(JSON.stringify(d), {
    status: s,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

export default async (req) => {
  const store = getStore("imagenes");

  if (req.method === "GET") {
    const id = new URL(req.url).pathname.split("/").pop();
    if (!/^[a-f0-9]{32}$/.test(id)) return new Response("No encontrada", { status: 404 });
    const data = await store.get(id, { type: "arrayBuffer" });
    if (!data) return new Response("No encontrada", { status: 404 });
    return new Response(data, {
      headers: { "content-type": "image/jpeg", "cache-control": "public, max-age=31536000, immutable" },
    });
  }

  if (req.method === "POST") {
    const clave = process.env.ADMIN_PASSWORD;
    if (!clave) return json({ error: "Falta ADMIN_PASSWORD en Netlify" }, 500);
    if (req.headers.get("x-admin-password") !== clave) return json({ error: "No autorizado" }, 401);

    const buf = await req.arrayBuffer();
    const b = new Uint8Array(buf);
    if (buf.byteLength > 4500000) return json({ error: "Imagen muy pesada" }, 413);
    if (!(b[0] === 0xff && b[1] === 0xd8)) return json({ error: "Solo imágenes JPG" }, 400);

    const id = crypto.randomUUID().replace(/-/g, "");
    await store.set(id, buf);
    return json({ url: `/api/imagen/${id}` });
  }

  return json({ error: "Método no permitido" }, 405);
};
