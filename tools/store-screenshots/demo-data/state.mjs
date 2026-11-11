import { login, rest } from "./sb.mjs";
const { token } = await login();
for (const t of ["training_sessions","appointments","expenses","journal_entries","horses","horse_collaborators"]) {
  const all = await rest(token, "GET", `${t}?select=id`);
  const demo = all.filter((r) => String(r.id).startsWith("demo_"));
  console.log(t.padEnd(20), "total", all.length, " demo_", demo.length);
}
