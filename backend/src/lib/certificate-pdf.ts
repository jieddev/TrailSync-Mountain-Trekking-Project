import { readFile } from "node:fs/promises";

import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";

import { manilaLongDate } from "./manila-date.js";

export type CertificateDetails = { recipient: string; trailName: string; date: Date; guideName: string };

// The same template, fonts and text slots as the guide app's CertificateCard
// (lib/widgets/certificate_card.dart). Slots are in the template's own pixels.
const TEMPLATE_WIDTH = 2000;
// A4 landscape, which has the template's 2000×1414 aspect ratio.
const PAGE_WIDTH = 841.89;
const PAGE_HEIGHT = 595.28;
const k = PAGE_WIDTH / TEMPLATE_WIDTH;

const NAVY = rgb(0x0e / 255, 0x3a / 255, 0x68 / 255);
const INK = rgb(0x11 / 255, 0x11 / 255, 0x11 / 255);

const assets = new URL("../../assets/certificates/", import.meta.url);
const asset = (name: string) => readFile(new URL(name, assets));
let loaded: Promise<[Buffer, Buffer, Buffer]> | undefined;
const loadAssets = () => (loaded ??= Promise.all([asset("certificate_blank.png"), asset("KaushanScript-Regular.ttf"), asset("Lexend-Variable.ttf")]));

type Run = { text: string; font: PDFFont; color: RGB };

// Draws runs as one line centred on the page, its vertical centre at template
// [y]. [lineHeight] is the font-size multiple of the app's line box. Long text
// shrinks to [maxWidth], like the app's FittedBox.
function drawLine(page: PDFPage, runs: Run[], y: number, maxWidth: number, size: number, lineHeight = 1) {
  const width = runs.reduce((sum, run) => sum + run.font.widthOfTextAtSize(run.text, size), 0);
  const fitted = size * Math.min(1, maxWidth / width) * k;
  // Flutter splits the line box between ascent and descent in proportion, so
  // the baseline sits that far below the box's centre.
  const { font } = runs[0];
  const ascent = font.heightAtSize(fitted, { descender: false });
  const total = font.heightAtSize(fitted);
  const baseline = PAGE_HEIGHT - y * k - lineHeight * fitted * (ascent / total - 0.5);
  let x = (PAGE_WIDTH - runs.reduce((sum, run) => sum + run.font.widthOfTextAtSize(run.text, fitted), 0)) / 2;
  for (const run of runs) {
    page.drawText(run.text, { x, y: baseline, size: fitted, font: run.font, color: run.color });
    x += run.font.widthOfTextAtSize(run.text, fitted);
  }
}

// One-page certificate of achievement for a hiker.
export async function renderCertificatePdf({ recipient, trailName, date, guideName }: CertificateDetails): Promise<Uint8Array> {
  const [template, kaushanBytes, lexendBytes] = await loadAssets();
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle(`TrailSync Certificate – ${recipient}`);
  pdf.setAuthor("TrailSync");
  const [image, kaushan, lexend] = await Promise.all([
    pdf.embedPng(template),
    pdf.embedFont(kaushanBytes, { subset: true }),
    pdf.embedFont(lexendBytes, { subset: true }),
  ]);

  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  page.drawImage(image, { x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT });
  drawLine(page, [{ text: recipient, font: kaushan, color: NAVY }], 640, 1100, 110, 1.3);
  drawLine(page, [{ text: trailName, font: lexend, color: NAVY }, { text: ".", font: lexend, color: INK }], 808, 1000, 34);
  drawLine(page, [{ text: manilaLongDate(date).toUpperCase(), font: lexend, color: INK }], 1086, 700, 38);
  // The guide's name doubles as a handwritten-style signature.
  drawLine(page, [{ text: guideName, font: kaushan, color: NAVY }], 1185, 500, 54, 1.3);
  drawLine(page, [{ text: guideName.toUpperCase(), font: lexend, color: INK }], 1266, 700, 44);
  return pdf.save();
}
