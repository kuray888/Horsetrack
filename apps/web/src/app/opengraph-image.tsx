import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

/** Image de partage (Open Graph / réseaux sociaux), générée une fois au
 * build — même composition que les visuels App Store : fond crème, titre
 * marine et bleu, téléphones posés sur le bandeau bleu à filet cuivre. */
export const alt = "Horsetrack — Toute votre vie équestre, au même endroit. Application iPhone de suivi du cheval.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const asset = (...p: string[]) => path.join(process.cwd(), ...p);
const dataUrl = async (file: string) => `data:image/png;base64,${(await readFile(file)).toString("base64")}`;

export default async function OpengraphImage() {
  const [extraBold, bold, logo, home, planning] = await Promise.all([
    readFile(asset("src/assets/fonts/BricolageGrotesque_800ExtraBold.ttf")),
    readFile(asset("src/assets/fonts/BricolageGrotesque_700Bold.ttf")),
    dataUrl(asset("public/brand/logo-mark.png")),
    dataUrl(asset("src/assets/og/accueil.png")),
    dataUrl(asset("src/assets/og/planning-concours.png")),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: "#f9f7f2",
          fontFamily: "Bricolage",
          color: "#081f38",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 150,
            background: "#2378bd",
            borderTop: "10px solid #b66b45",
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", padding: "64px 0 0 72px", width: 700 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <img src={logo} width={26} height={39} alt="" />
            <span style={{ fontSize: 26, fontWeight: 800, letterSpacing: 1.5, paddingTop: 6 }}>HORSETRACK</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", marginTop: 40, fontSize: 76, fontWeight: 800, lineHeight: 1, letterSpacing: -2.5 }}>
            <span>Toute votre vie</span>
            <span>équestre.</span>
            <span style={{ color: "#2a86d4" }}>Au même endroit.</span>
          </div>
          <div style={{ display: "flex", marginTop: 28, fontSize: 28, fontWeight: 700, color: "#3d4d61" }}>
            Planning · Soins · Concours · Journal · Budget
          </div>
        </div>
        <img
          src={planning}
          height={460}
          alt=""
          style={{ position: "absolute", right: 40, bottom: 40, transform: "rotate(8deg)" }}
        />
        <img src={home} height={540} alt="" style={{ position: "absolute", right: 210, bottom: -10 }} />
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Bricolage", data: extraBold, weight: 800, style: "normal" },
        { name: "Bricolage", data: bold, weight: 700, style: "normal" },
      ],
    }
  );
}
