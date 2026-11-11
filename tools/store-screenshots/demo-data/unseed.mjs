import { readFileSync } from "node:fs";
import { login, rest } from "./sb.mjs";
const ids = JSON.parse(readFileSync(new URL("./demo-ids.json", import.meta.url), "utf8"));
const { token } = await login();
for (const [table, list] of Object.entries(ids)) {
  const gone = await rest(token, "DELETE", `${table}?id=like.demo_store_*`);
  console.log(table, "supprimées :", gone.length, "/", list.length);
}
for (const t of Object.keys(ids)) console.log(t, "restantes demo_store_ :", (await rest(token, "GET", `${t}?select=id&id=like.demo_store_*`)).length);
