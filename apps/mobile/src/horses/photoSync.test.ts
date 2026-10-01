import { describe, expect, it } from "vitest";
import { horseIdsWithUnsentPhoto } from "./photoSync";

const exists = () => true;

describe("horseIdsWithUnsentPhoto", () => {
  it("désigne un cheval créé avec sa photo, jamais envoyée", () => {
    expect(
      horseIdsWithUnsentPhoto(
        [{ id: "h1", photoUrl: "file:///Documents/horse-1.jpg", photoPath: null }],
        [{ id: "h1", photoPath: null }],
        exists
      )
    ).toEqual(["h1"]);
  });

  it("ignore une photo déjà sur le serveur, ici ou d'après la relecture", () => {
    expect(
      horseIdsWithUnsentPhoto(
        [
          { id: "a", photoUrl: "file:///a.jpg", photoPath: "a/photo.jpg" },
          { id: "b", photoUrl: "file:///b.jpg", photoPath: null },
        ],
        [
          { id: "a", photoPath: "a/photo.jpg" },
          { id: "b", photoPath: "b/photo.jpg" },
        ],
        exists
      )
    ).toEqual([]);
  });

  it("ignore un cheval partagé, un cheval pas encore en base, une photo distante ou un fichier disparu", () => {
    expect(
      horseIdsWithUnsentPhoto(
        [
          { id: "partage", photoUrl: "file:///p.jpg", photoPath: null, sharedRole: "COACH" },
          { id: "pas-en-base", photoUrl: "file:///n.jpg", photoPath: null },
          { id: "distante", photoUrl: "https://signee", photoPath: null },
          { id: "fichier-perdu", photoUrl: "file:///perdu.jpg", photoPath: null },
        ],
        [
          { id: "partage", photoPath: null },
          { id: "distante", photoPath: null },
          { id: "fichier-perdu", photoPath: null },
        ],
        (uri) => uri !== "file:///perdu.jpg"
      )
    ).toEqual([]);
  });
});
