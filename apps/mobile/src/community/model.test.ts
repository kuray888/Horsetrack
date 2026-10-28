import { describe, expect, it } from "vitest";
import { authorLabel, canDelete, cleanCommentBody, reactionSummary, relativeTime } from "@/community/model";

describe("fil privé d'un cheval", () => {
  it("nettoie le texte et refuse un commentaire vide ou trop long", () => {
    expect(cleanCommentBody("  Bravo !\r\n\r\n\r\n\r\nSuper séance  ")).toBe("Bravo !\n\nSuper séance");
    expect(cleanCommentBody("   ")).toBeNull();
    expect(cleanCommentBody("x".repeat(1001))).toBeNull();
  });

  it("affiche le rôle, jamais un email", () => {
    expect(authorLabel({ authorUserId: "me", authorRole: "OWNER" }, "me")).toBe("Toi");
    expect(authorLabel({ authorUserId: "u2", authorRole: "DEMI_PENSION" }, "me")).toBe("Demi-pension");
  });

  it("laisse supprimer son commentaire, et tout le fil au propriétaire", () => {
    expect(canDelete({ authorUserId: "me" }, "me", false)).toBe(true);
    expect(canDelete({ authorUserId: "u2" }, "me", false)).toBe(false);
    expect(canDelete({ authorUserId: "u2" }, "me", true)).toBe(true);
  });

  it("regroupe les réactions", () => {
    const s = reactionSummary(
      [
        { id: "1", userId: "me", emoji: "👏", targetType: "session", targetId: "s" },
        { id: "2", userId: "u2", emoji: "👏", targetType: "session", targetId: "s" },
        { id: "3", userId: "u2", emoji: "💪", targetType: "session", targetId: "s" },
      ],
      "me"
    );
    expect(s.find((r) => r.emoji === "👏")).toEqual({ emoji: "👏", count: 2, mine: true });
    expect(s.find((r) => r.emoji === "💪")).toEqual({ emoji: "💪", count: 1, mine: false });
  });

  it("date les messages simplement", () => {
    const now = new Date(2026, 9, 28, 12, 0);
    expect(relativeTime(new Date(2026, 9, 28, 11, 59, 40), now)).toBe("à l'instant");
    expect(relativeTime(new Date(2026, 9, 28, 11, 45), now)).toBe("il y a 15 min");
    expect(relativeTime(new Date(2026, 9, 28, 9, 0), now)).toBe("il y a 3 h");
  });
});
