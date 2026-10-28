import { describe, expect, it } from "vitest";
import { commentPushMessages, isExpoPushToken, threadParticipants } from "@/lib/communityPush";

describe("notifications du fil privé", () => {
  it("prévient les participants, jamais l'auteur", () => {
    expect(threadParticipants("owner", ["dp", null, "owner"], "dp")).toEqual(["owner"]);
    expect(threadParticipants("owner", ["dp", "coach"], "owner")).toEqual(["dp", "coach"]);
  });

  it("n'accepte que des jetons Expo", () => {
    expect(isExpoPushToken("ExponentPushToken[abcdefghij1234]")).toBe(true);
    expect(isExpoPushToken("https://evil.example/push")).toBe(false);
  });

  it("écrit dans la langue de chaque appareil et ouvre le bon fil", () => {
    const msgs = commentPushMessages({
      recipients: [
        { token: "ExponentPushToken[aaaaaaaaaaaa]", userId: "u1", lang: "fr" },
        { token: "ExponentPushToken[bbbbbbbbbbbb]", userId: "u2", lang: "en" },
        { token: "pas-un-jeton", userId: "u3", lang: "fr" },
      ],
      horseId: "h1",
      horseName: "Éclair",
      targetType: "session",
      targetId: "s1",
      body: "Super séance aujourd'hui,\nbravo !",
    });
    expect(msgs).toHaveLength(2);
    expect(msgs[0].title).toBe("Nouveau commentaire sur la séance de Éclair");
    expect(msgs[1].title).toBe("New comment on Éclair's session");
    expect(msgs[0].body).toBe("Super séance aujourd'hui, bravo !");
    expect(msgs[0].data.url).toBe("/comments?horseId=h1&targetType=session&targetId=s1");
  });
});
