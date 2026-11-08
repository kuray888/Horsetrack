import { describe, expect, it } from "vitest";
import { groupTeam, invitableHorses, summarizeInvites, type ShareRow } from "./teamModel";

const horses = [
  { id: "h1", name: "Tornade" },
  { id: "h2", name: "Prince" },
  { id: "h3", name: "Altesse" },
];

const row = (over: Partial<ShareRow>): ShareRow => ({
  id: "c",
  horseId: "h1",
  invitedEmail: "lea@test.fr",
  collaboratorUserId: null,
  role: "DEMI_PENSION",
  status: "PENDING",
  ...over,
});

describe("groupTeam", () => {
  it("une personne sur deux chevaux = une seule personne, ses chevaux triés", () => {
    const team = groupTeam(
      [
        row({ id: "a", horseId: "h1", collaboratorUserId: "u-lea", status: "ACCEPTED" }),
        row({ id: "b", horseId: "h2", invitedEmail: "LEA@test.fr " }),
      ],
      horses,
      new Map([["u-lea", "Léa"]])
    );
    expect(team).toHaveLength(1);
    expect(team[0]).toMatchObject({ email: "lea@test.fr", name: "Léa", userId: "u-lea", active: true });
    expect(team[0].shares.map((s) => s.horseName)).toEqual(["Prince", "Tornade"]);
  });

  it("actifs d'abord, puis par nom ; chevaux inconnus ignorés", () => {
    const team = groupTeam(
      [
        row({ id: "a", invitedEmail: "zoe@test.fr" }),
        row({ id: "b", invitedEmail: "marc@test.fr", collaboratorUserId: "u-marc", status: "ACCEPTED" }),
        row({ id: "c", invitedEmail: "x@test.fr", horseId: "inconnu" }),
      ],
      horses,
      new Map()
    );
    expect(team.map((p) => p.email)).toEqual(["marc@test.fr", "zoe@test.fr"]);
  });
});

describe("invitableHorses", () => {
  it("écarte les chevaux déjà partagés avec la personne", () => {
    const [lea] = groupTeam([row({ horseId: "h2" })], horses, new Map());
    expect(invitableHorses(horses, lea).map((h) => h.id)).toEqual(["h1", "h3"]);
    expect(invitableHorses(horses, null)).toHaveLength(3);
  });
});

describe("summarizeInvites", () => {
  it("envoyées, chevaux complets, échecs", () => {
    expect(
      summarizeInvites([
        { horseName: "Tornade", result: "ok" },
        { horseName: "Prince", result: "quota" },
        { horseName: "Altesse", result: "error" },
      ])
    ).toEqual({ sent: ["Tornade"], full: ["Prince"], failed: ["Altesse"] });
  });
});
