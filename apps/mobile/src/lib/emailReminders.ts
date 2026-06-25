import { supabase } from "@/lib/supabase";

/** Pendant côté serveur de `scheduleReminder`/`cancelReminder` (notifications.ts)
 * pour le canal email — même philosophie d'échec silencieux : un rappel email
 * raté ne doit jamais empêcher la création/suppression du rendez-vous local. */
export async function scheduleEmailReminder(trigger: Date, subject: string, body: string): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return null;

    const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/email-reminders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ sendAt: trigger.toISOString(), subject, body }),
    });
    if (!res.ok) return null;
    const json = await res.json().catch(() => null);
    return json?.id ?? null;
  } catch {
    return null;
  }
}

export async function cancelEmailReminder(id: string | null | undefined): Promise<void> {
  if (!id) return;
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/email-reminders/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    // best-effort : un rappel orphelin côté serveur n'est pas grave (il sera
    // simplement envoyé une fois, sans conséquence sur l'app).
  }
}
