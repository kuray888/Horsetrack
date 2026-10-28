import { describe, expect, it } from "vitest";
import { hasUnsentJournalMedia, mergeJournalVideo } from "@/agenda/journalMedia";

const base = { horseId: "h1", photoUri: null, photoPath: null, videoUri: null, videoPath: null };

describe("médias d'un souvenir", () => {
  it("repère une photo ou une vidéo restée sur le téléphone", () => {
    expect(hasUnsentJournalMedia({ ...base, photoUri: "file:///p.jpg" })).toBe(true);
    expect(hasUnsentJournalMedia({ ...base, videoUri: "file:///v.mp4" })).toBe(true);
    expect(hasUnsentJournalMedia({ ...base, videoUri: "file:///v.mp4", videoPath: "h1/journal/j1.mp4" })).toBe(false);
    expect(hasUnsentJournalMedia({ ...base, photoUri: "https://signed/p.jpg", photoPath: "h1/journal/j1.jpg" })).toBe(false);
    expect(hasUnsentJournalMedia({ ...base, horseId: null, photoUri: "file:///p.jpg" })).toBe(false);
    expect(hasUnsentJournalMedia(base)).toBe(false);
  });

  it("colonne absente côté serveur : la vidéo locale est gardée", () => {
    const local = { ...base, videoUri: "file:///v.mp4", videoPath: "h1/journal/j1.mp4" };
    expect(mergeJournalVideo(local, { ...base, videoUri: undefined, videoPath: undefined }, "missing")).toEqual({
      videoUri: "file:///v.mp4",
      videoPath: "h1/journal/j1.mp4",
      resend: false,
    });
  });

  it("colonne tout juste créée : la vidéo envoyée avant est gardée et la ligne renvoyée", () => {
    const local = { ...base, videoUri: "file:///v.mp4", videoPath: "h1/journal/j1.mp4" };
    expect(mergeJournalVideo(local, base, "catching_up")).toEqual({
      videoUri: "file:///v.mp4",
      videoPath: "h1/journal/j1.mp4",
      resend: true,
    });
  });

  it("sinon le serveur fait foi : vidéo retirée ailleurs, ou ajoutée ailleurs", () => {
    const local = { ...base, videoUri: "file:///v.mp4", videoPath: "h1/journal/j1.mp4" };
    expect(mergeJournalVideo(local, base, "present")).toEqual({ videoUri: null, videoPath: null, resend: false });
    const remote = { ...base, videoUri: "https://signed/v.mp4", videoPath: "h1/journal/j1.mp4" };
    expect(mergeJournalVideo(base, remote, "present")).toEqual({
      videoUri: "https://signed/v.mp4",
      videoPath: "h1/journal/j1.mp4",
      resend: false,
    });
  });
});
