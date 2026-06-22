/**
 * flowchart-diagram.spec.ts
 *
 * Reproduces the flowchart from the design mockup:
 *   Modal ──┐
 *            ├──▶ Step 1 ──Account──▶ Step 2 ──▶ [Beige box]
 *   Email ──┘        │
 *               No account
 *                    │
 *                    ▼
 *             Create account ──▶ Verify email
 *                                     │
 *                                     ▼
 *                                  Step 2 (top)
 *
 * Output: samples/outputs/flowchart-diagram.docx
 */

import { describe, test, expect, beforeAll } from "vitest";
import path from "path";
import fs from "fs";
import { Mdocxengine, EMU_PER_INCH } from "@/index";

const INPUT  = path.resolve("samples/example.docx");
const OUTPUT = path.resolve("samples/outputs/flowchart-diagram.docx");

const I = EMU_PER_INCH; // 914400

// ── Colors ────────────────────────────────────────────────────────────────────
const PURPLE      = "9B59B6";
const GREEN       = "27AE60";
const ORANGE      = "F39C12";
const DARK_ORANGE = "E67E22";
const BEIGE_FILL  = "F5DEB3";
const BEIGE_BDR   = "C8A96E";
const WHITE       = "FFFFFF";
const ARROW_COLOR = "555555";

// ── Shape sizes ───────────────────────────────────────────────────────────────
const CIRCLE_W  = Math.round(0.9 * I);
const CIRCLE_H  = Math.round(0.9 * I);
const RECT_W    = Math.round(1.2 * I);
const RECT_H    = Math.round(1.2 * I);
const DIAM_W    = Math.round(1.2 * I);
const DIAM_H    = Math.round(0.9 * I);

// ── Shape positions (x = from left column edge, y = from top of anchor para) ─
//  Top row: Modal circle, Step1, Step2, BeigeRect
//  Bottom row: Email circle, CreateAcct, VerifyEmail

const MODAL_X  = Math.round(0.05 * I);
const MODAL_Y  = Math.round(0.50 * I);

const EMAIL_X  = Math.round(0.05 * I);
const EMAIL_Y  = Math.round(2.80 * I);

const STEP1_X  = Math.round(1.55 * I);
const STEP1_Y  = Math.round(0.35 * I);

const STEP2_X  = Math.round(3.50 * I);
const STEP2_Y  = Math.round(0.35 * I);

const BEIGE_X  = Math.round(5.30 * I);
const BEIGE_Y  = Math.round(0.35 * I);
const BEIGE_W  = Math.round(1.00 * I);

const CREAT_X  = Math.round(1.55 * I);
const CREAT_Y  = Math.round(2.55 * I);

const VERIF_X  = Math.round(3.50 * I);
const VERIF_Y  = Math.round(2.55 * I);

// ── Derived centers / edges ───────────────────────────────────────────────────
const cy = (y: number, h: number) => y + Math.round(h / 2);
const cx = (x: number, w: number) => x + Math.round(w / 2);
const right  = (x: number, w: number) => x + w;
const bottom = (y: number, h: number) => y + h;

let engine: Mdocxengine;

describe("flowchart-diagram — reproduce design mockup", () => {
  beforeAll(async () => {
    fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
    engine = await Mdocxengine.loadFromFile(INPUT);
  });

  // ── 1. Draw circles (Modal, Email) ────────────────────────────────────────

  test("1a. Modal circle", async () => {
    const id = await engine.shapes.insertShape("ellipse", {
      position:    { x: MODAL_X, y: MODAL_Y },
      size:        { width: CIRCLE_W, height: CIRCLE_H },
      fillColor:   PURPLE,
      borderColor: PURPLE,
      text:        "Modal",
      textColor:   WHITE,
      fontSize:    11,
      bold:        true,
      textAlign:   "ctr",
    });
    expect(id).toBeGreaterThanOrEqual(1);
  });

  test("1b. Email circle", async () => {
    const id = await engine.shapes.insertShape("ellipse", {
      position:    { x: EMAIL_X, y: EMAIL_Y },
      size:        { width: CIRCLE_W, height: CIRCLE_H },
      fillColor:   PURPLE,
      borderColor: PURPLE,
      text:        "Email",
      textColor:   WHITE,
      fontSize:    11,
      bold:        true,
      textAlign:   "ctr",
    });
    expect(id).toBeGreaterThanOrEqual(1);
  });

  // ── 2. Draw process boxes (Step 1, Step 2, Beige) ────────────────────────

  test("2a. Step 1 (green rect)", async () => {
    const id = await engine.shapes.insertShape("rect", {
      position:    { x: STEP1_X, y: STEP1_Y },
      size:        { width: RECT_W, height: RECT_H },
      fillColor:   GREEN,
      borderColor: GREEN,
      text:        "Step 1",
      textColor:   WHITE,
      fontSize:    13,
      bold:        true,
      textAlign:   "ctr",
    });
    expect(id).toBeGreaterThanOrEqual(1);
  });

  test("2b. Step 2 (orange rect)", async () => {
    const id = await engine.shapes.insertShape("rect", {
      position:    { x: STEP2_X, y: STEP2_Y },
      size:        { width: RECT_W, height: RECT_H },
      fillColor:   ORANGE,
      borderColor: ORANGE,
      text:        "Step 2",
      textColor:   WHITE,
      fontSize:    13,
      bold:        true,
      textAlign:   "ctr",
    });
    expect(id).toBeGreaterThanOrEqual(1);
  });

  test("2c. Beige rectangle (output)", async () => {
    const id = await engine.shapes.insertShape("rect", {
      position:    { x: BEIGE_X, y: BEIGE_Y },
      size:        { width: BEIGE_W, height: RECT_H },
      fillColor:   BEIGE_FILL,
      borderColor: BEIGE_BDR,
    });
    expect(id).toBeGreaterThanOrEqual(1);
  });

  // ── 3. Draw decision diamonds (Create account, Verify email) ─────────────

  test("3a. Create account (diamond)", async () => {
    const id = await engine.shapes.insertShape("diamond", {
      position:    { x: CREAT_X, y: CREAT_Y },
      size:        { width: DIAM_W, height: DIAM_H },
      fillColor:   DARK_ORANGE,
      borderColor: DARK_ORANGE,
      text:        "Create account",
      textColor:   WHITE,
      fontSize:    9,
      bold:        true,
      textAlign:   "ctr",
    });
    expect(id).toBeGreaterThanOrEqual(1);
  });

  test("3b. Verify email (diamond)", async () => {
    const id = await engine.shapes.insertShape("diamond", {
      position:    { x: VERIF_X, y: VERIF_Y },
      size:        { width: DIAM_W, height: DIAM_H },
      fillColor:   DARK_ORANGE,
      borderColor: DARK_ORANGE,
      text:        "Verify email",
      textColor:   WHITE,
      fontSize:    9,
      bold:        true,
      textAlign:   "ctr",
    });
    expect(id).toBeGreaterThanOrEqual(1);
  });

  // ── 4. Draw connectors ────────────────────────────────────────────────────

  test("4a. Modal → Step 1 (diagonal line)", async () => {
    // from Modal's right-center to Step1's left-center
    const x1 = right(MODAL_X, CIRCLE_W);
    const y1 = cy(MODAL_Y, CIRCLE_H);
    const x2 = STEP1_X;
    const y2 = cy(STEP1_Y, RECT_H);
    const id = await engine.shapes.insertLine(x1, y1, x2, y2, {
      color: ARROW_COLOR, arrowEnd: true,
    });
    expect(id).toBeGreaterThanOrEqual(1);
  });

  test("4b. Email → Step 1 (diagonal line going up-right)", async () => {
    // from Email's right-center up-right to Step1's left-center
    const x1 = right(EMAIL_X, CIRCLE_W);
    const y1 = cy(EMAIL_Y, CIRCLE_H);
    const x2 = STEP1_X;
    const y2 = cy(STEP1_Y, RECT_H);
    const id = await engine.shapes.insertLine(x1, y1, x2, y2, {
      color: ARROW_COLOR, arrowEnd: true,
    });
    expect(id).toBeGreaterThanOrEqual(1);
  });

  test("4c. Step 1 → Step 2 (horizontal, 'Account' label)", async () => {
    const x1 = right(STEP1_X, RECT_W);
    const y1 = cy(STEP1_Y, RECT_H);
    const x2 = STEP2_X;
    const y2 = y1;
    const id = await engine.shapes.insertLine(x1, y1, x2, y2, {
      color: ARROW_COLOR, arrowEnd: true,
      label: "Account", labelOffsetY: -130000,
    });
    expect(id).toBeGreaterThanOrEqual(1);
  });

  test("4d. Step 1 → Create account (vertical down, 'No account' label)", async () => {
    const x1 = cx(STEP1_X, RECT_W);
    const y1 = bottom(STEP1_Y, RECT_H);
    const x2 = x1;
    const y2 = CREAT_Y;
    const id = await engine.shapes.insertLine(x1, y1, x2, y2, {
      color: ARROW_COLOR, arrowEnd: true,
      label: "No account", labelOffsetX: 60000,
    });
    expect(id).toBeGreaterThanOrEqual(1);
  });

  test("4e. Create account → Verify email (horizontal)", async () => {
    const x1 = right(CREAT_X, DIAM_W);
    const y1 = cy(CREAT_Y, DIAM_H);
    const x2 = VERIF_X;
    const y2 = y1;
    const id = await engine.shapes.insertLine(x1, y1, x2, y2, {
      color: ARROW_COLOR, arrowEnd: true,
    });
    expect(id).toBeGreaterThanOrEqual(1);
  });

  test("4f. Verify email → Step 2 (vertical up)", async () => {
    const x1 = cx(VERIF_X, DIAM_W);
    const y1 = VERIF_Y;
    const x2 = x1;
    const y2 = bottom(STEP2_Y, RECT_H);
    const id = await engine.shapes.insertLine(x1, y1, x2, y2, {
      color: ARROW_COLOR, arrowEnd: true,
    });
    expect(id).toBeGreaterThanOrEqual(1);
  });

  test("4g. Step 2 → Beige rect (horizontal)", async () => {
    const x1 = right(STEP2_X, RECT_W);
    const y1 = cy(STEP2_Y, RECT_H);
    const x2 = BEIGE_X;
    const y2 = y1;
    const id = await engine.shapes.insertLine(x1, y1, x2, y2, {
      color: ARROW_COLOR, arrowEnd: true,
    });
    expect(id).toBeGreaterThanOrEqual(1);
  });

  // ── 5. Verify shape count and save ───────────────────────────────────────

  test("5. shape count — at least 7 main shapes", async () => {
    const shapes = await engine.shapes.getShapes();
    // 2 circles + 3 rects + 2 diamonds = 7 main shapes (plus connector shapes)
    expect(shapes.length).toBeGreaterThanOrEqual(7);
  });

  test("6. save — write flowchart-diagram.docx to disk", async () => {
    await engine.saveToFile(OUTPUT);
    expect(fs.existsSync(OUTPUT)).toBe(true);
    expect(fs.statSync(OUTPUT).size).toBeGreaterThan(5_000);
    console.log(`\n✓ flowchart-diagram.docx written to: ${OUTPUT}`);
  });
});
