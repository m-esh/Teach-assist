/**
 * Parsers for TeachAssist HTML. These run on the device (DOMParser).
 *
 * TeachAssist has (at least) three page shapes and they vary by teacher:
 *  - Course list (listReports.php)
 *  - "Grid" reports: one row per evaluation, one column per category. The
 *    categories differ per course (K/T/C/A/O/F, or Term / Attendance / Final...),
 *    so they are always read from the header row, never assumed.
 *  - "Expectations" reports: Term Work {weight} = x%, plus tables of tasks
 *    (Assessment Tasks, Individualized ..., Final Culminating Task,
 *    Attendance & Participation).
 *
 * Everything here is written defensively: anything we can't read is skipped
 * rather than crashing, and the course list mark is always kept as a fallback.
 */
import type { Assessment, CatMark, Category, Course, CourseReport } from './types';
import { applyInference } from './calc';

const ws = (s: string | null | undefined) => (s ?? '').replace(/[ \s]+/g, ' ').trim();
const num = (s: string | undefined) => (s === undefined ? NaN : parseFloat(s));

function parseDoc(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

function text(el: Element | null | undefined): string {
  return ws(el?.textContent);
}

/** Text with <br>/block boundaries turned into newlines. */
function lines(el: Element): string[] {
  const out: string[] = [];
  let cur = '';
  const walk = (n: Node) => {
    if (n.nodeType === 3) {
      cur += n.textContent ?? '';
      return;
    }
    if (n.nodeType !== 1) return;
    const tag = (n as Element).tagName;
    if (tag === 'BR') {
      out.push(cur);
      cur = '';
      return;
    }
    const block = /^(DIV|P|TR|TABLE|LI|H\d)$/.test(tag);
    if (block && cur.trim()) {
      out.push(cur);
      cur = '';
    }
    n.childNodes.forEach(walk);
    if (block && cur.trim()) {
      out.push(cur);
      cur = '';
    }
  };
  walk(el);
  out.push(cur);
  return out.map(ws).filter(Boolean);
}

function ownRows(table: Element): Element[] {
  return Array.from(table.querySelectorAll('tr')).filter((tr) => tr.closest('table') === table);
}

function ownCells(tr: Element): Element[] {
  return Array.from(tr.children).filter((c) => c.tagName === 'TD' || c.tagName === 'TH');
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'x';

/* ------------------------------------------------------------------ */
/* Course list                                                         */
/* ------------------------------------------------------------------ */

const TITLE_WITH_SCHOOL = /^(.*)\s+-\s+([A-Z0-9]{3,10}-\d+)\s*:\s*(.*)$/;
const TITLE_NO_SCHOOL = /^([A-Z0-9]{3,10}-\d+)\s*:\s*(.*)$/;

export function parseCourseList(html: string): Course[] {
  const doc = parseDoc(html);
  const courses: Course[] = [];
  const seen = new Set<string>();

  for (const tr of Array.from(doc.querySelectorAll('tr'))) {
    const cells = ownCells(tr);
    if (cells.length < 3) continue;
    const first = cells[0];
    if (first.tagName === 'TH' || first.querySelector('table')) continue;
    const full = lines(first).join(' ');
    if (!/Block\s*:/i.test(full) && !/[A-Z0-9]{3,10}-\d+\s*:/.test(full)) continue;

    const blockIdx = full.search(/Block\s*:/i);
    const titlePart = ws(blockIdx >= 0 ? full.slice(0, blockIdx) : full);
    const blockPart = blockIdx >= 0 ? full.slice(blockIdx) : '';

    let school = '';
    let code = titlePart;
    let name = '';
    const m1 = titlePart.match(TITLE_WITH_SCHOOL);
    const m2 = titlePart.match(TITLE_NO_SCHOOL);
    if (m1) [, school, code, name] = m1;
    else if (m2) [, code, name] = m2;

    const bm = blockPart.match(/Block\s*:\s*(.*?)\s*-\s*rm\.?\s*(.*)$/i);
    const block = bm ? ws(bm[1]) : ws(blockPart.replace(/Block\s*:/i, ''));
    const room = bm ? ws(bm[2]) : '';

    const dates = text(cells[1]).match(/(\d{4}-\d{2}-\d{2})\s*~\s*(\d{4}-\d{2}-\d{2})/);
    const markText = text(cells[2]);
    const midterm = markText.match(/MIDTERM\s*MARK\s*:?\s*(\d+(?:\.\d+)?)\s*%/i);
    const current = markText.match(/current\s*mark\s*=?\s*(\d+(?:\.\d+)?)\s*%/i);
    const final = markText.match(/FINAL\s*MARK\s*:?\s*(\d+(?:\.\d+)?)\s*%/i);
    const link = tr.querySelector('a[href*="subject_id"]');
    const subjectId = link?.getAttribute('href')?.match(/subject_id=(\d+)/)?.[1];

    let id = subjectId ?? `code:${code}`;
    if (seen.has(id)) id = `${id}#${courses.length}`;
    seen.add(id);

    courses.push({
      id,
      code: ws(code),
      name: ws(name),
      school: ws(school),
      block,
      room,
      start: dates?.[1] ?? '',
      end: dates?.[2] ?? '',
      listMark: current ? num(current[1]) : null,
      midterm: midterm ? num(midterm[1]) : null,
      final: final ? num(final[1]) : null,
    });
  }
  return courses;
}

/* ------------------------------------------------------------------ */
/* Shared helpers for reports                                          */
/* ------------------------------------------------------------------ */

function hexOf(el: Element): string | null {
  const bg = el.getAttribute('bgcolor') ?? el.getAttribute('style')?.match(/background(?:-color)?\s*:\s*(#?[0-9a-f]{3,6})/i)?.[1];
  if (!bg) return null;
  let h = bg.replace('#', '').toLowerCase();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return /^[0-9a-f]{6}$/.test(h) ? h : null;
}

/** Pink = "not used in the calculation" (not handed in / not marked yet). */
function isPink(h: string) {
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return r >= 0xf0 && g < 0xd0 && b < 0xd0 && Math.abs(g - b) < 0x30;
}

/** Dark grey = "No Mark", omitted from the calculation. */
function isNoMarkGrey(h: string) {
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return Math.abs(r - g) < 8 && Math.abs(g - b) < 8 && r <= 0xb0 && r >= 0x40;
}

function exclusionOf(el: Element): 'not-counted' | 'no-mark' | undefined {
  for (const e of [el, ...Array.from(el.querySelectorAll('[bgcolor],[style]'))]) {
    const h = hexOf(e);
    if (!h) continue;
    if (isPink(h)) return 'not-counted';
    if (isNoMarkGrey(h)) return 'no-mark';
  }
  return undefined;
}

const FRACTION = /(-?\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/;

const LEVEL_PCT: Record<string, number> = {
  '4++': 100, '4+': 95, '4': 88, '4-': 82, '4/4+': 92, '3/4': 80,
  '3+': 78, '3': 75, '3-': 72, '2/3': 70,
  '2+': 68, '2': 65, '2-': 62, '1/2': 60,
  '1+': 58, '1': 55, '1-': 52, R: 40,
};

export function levelToPercent(level: string): number | null {
  const k = level.replace(/\s+/g, '').toUpperCase().replace(/^LEVEL/, '');
  return k in LEVEL_PCT ? LEVEL_PCT[k] : null;
}

function shortFor(label: string, used: Set<string>): string {
  const l = label.toLowerCase();
  let s = /knowledge/.test(l) ? 'K' : /^other/.test(l) ? 'O' : (label.match(/[A-Za-z]/)?.[0] ?? '?').toUpperCase();
  if (used.has(s)) {
    const second = label.replace(/[^A-Za-z]/g, '')[1]?.toLowerCase() ?? String(used.size);
    s = s + second;
  }
  used.add(s);
  return s;
}

const isFinalish = (label: string) => /final|culminat|exam|summative/i.test(label);
const isMinorish = (label: string) => /attendance|participation|^other/i.test(label);

/** Weights used when TeachAssist doesn't publish them. Always shown as "estimated". */
export function defaultWeights(categories: Category[]): Record<string, number> {
  const finals = categories.filter((c) => isFinalish(c.label));
  const minors = categories.filter((c) => !isFinalish(c.label) && isMinorish(c.label));
  const rest = categories.filter((c) => !finals.includes(c) && !minors.includes(c));
  const w: Record<string, number> = {};
  for (const c of finals) w[c.key] = 30 / finals.length;
  for (const c of minors) w[c.key] = 0;
  for (const c of rest) w[c.key] = (finals.length ? 70 : 100) / rest.length;
  if (!rest.length) for (const c of minors) w[c.key] = (finals.length ? 70 : 100) / minors.length;
  return w;
}

function findReportedMark(doc: Document): number | undefined {
  const body = ws(doc.body?.textContent);
  const m = body.match(/(\d{1,3}(?:\.\d+)?)\s*%\s*Course\b/i);
  if (m) return num(m[1]);
  for (const div of Array.from(doc.querySelectorAll('div[style]'))) {
    if (/font-size\s*:\s*64pt/i.test(div.getAttribute('style') ?? '')) {
      const v = text(div).match(/^(\d{1,3}(?:\.\d+)?)\s*%$/);
      if (v) return num(v[1]);
    }
  }
  return undefined;
}

const normLabel = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');

function matchCategory(label: string, categories: Category[]): Category | undefined {
  const n = normLabel(label);
  if (!n) return undefined;
  return categories.find((c) => {
    const cn = normLabel(c.label);
    return cn === n || cn.startsWith(n) || n.startsWith(cn);
  });
}

/* ------------------------------------------------------------------ */
/* Grid reports                                                        */
/* ------------------------------------------------------------------ */

function findGridTable(doc: Document): Element | null {
  for (const table of Array.from(doc.querySelectorAll('table'))) {
    const rows = ownRows(table);
    if (!rows.length) continue;
    const head = ownCells(rows[0]);
    if (head.length >= 2 && /^assignments?$/i.test(text(head[0]))) return table;
  }
  return null;
}

function parseGridCell(cell: Element): CatMark | null {
  const t = text(cell);
  if (!t) return null;
  const noMark = /no\s*mark/i.test(t);
  const frac = t.match(FRACTION);
  const weightMatch = t.match(/weight\s*=\s*(\d+(?:\.\d+)?)/i);
  const weight = weightMatch ? num(weightMatch[1]) : /no\s*weight/i.test(t) ? 0 : 1;
  if (!frac) {
    return noMark ? { got: 0, outOf: 0, weight: 0, excluded: true, raw: 'No mark' } : null;
  }
  const mark: CatMark = { got: num(frac[1]), outOf: num(frac[2]), weight };
  if (noMark || exclusionOf(cell)) mark.excluded = true;
  return mark;
}

function parseGridReport(doc: Document, table: Element): CourseReport {
  const rows = ownRows(table);
  const head = ownCells(rows[0]).slice(1);
  const used = new Set<string>();
  const keys = new Set<string>();
  const categories: Category[] = head.map((h) => {
    const label = text(h) || '?';
    let key = slug(label);
    while (keys.has(key)) key += '_';
    keys.add(key);
    return { key, label, short: shortFor(label, used) };
  });
  const headColors = head.map(hexOf);

  const assessments: Assessment[] = [];
  let current: Assessment | null = null;

  for (const row of rows.slice(1)) {
    const cells = ownCells(row);
    if (!cells.length) continue;
    let nameCell = cells.find((c) => Number(c.getAttribute('rowspan')) >= 2) ?? null;
    if (!nameCell && cells.length === categories.length + 1 && !FRACTION.test(text(cells[0]))) nameCell = cells[0];

    if (!nameCell) {
      // Second row of a pair: feedback
      if (current) {
        const fb = text(row);
        if (fb && !current.feedback) current.feedback = fb.replace(/^feedback\s*:?\s*/i, '');
      }
      continue;
    }

    const name = text(nameCell);
    if (!name) {
      current = null;
      continue;
    }
    const dataCells = cells.filter((c) => c !== nameCell);
    const marks: Record<string, CatMark> = {};
    dataCells.forEach((cell, i) => {
      let cat: Category | undefined;
      if (dataCells.length === categories.length) cat = categories[i];
      else {
        const h = hexOf(cell);
        const idx = h ? headColors.indexOf(h) : -1;
        cat = idx >= 0 ? categories[idx] : categories[i];
      }
      if (!cat) return;
      const m = parseGridCell(cell);
      if (m) marks[cat.key] = m;
    });

    const rowExcl = exclusionOf(nameCell);
    if (rowExcl) for (const m of Object.values(marks)) m.excluded = true;

    current = { id: `${assessments.length}-${slug(name)}`, name, marks, excluded: rowExcl };
    assessments.push(current);
  }

  // Weighting table (older reports publish "Course Weighting" per category)
  let weights: Record<string, number> | null = null;
  for (const t of Array.from(doc.querySelectorAll('table'))) {
    if (t === table || !/Course\s*Weighting/i.test(t.textContent ?? '')) continue;
    const trs = ownRows(t);
    const headIdx = trs.findIndex((r) => /Course\s*Weighting/i.test(r.textContent ?? ''));
    if (headIdx < 0) continue;
    const col = ownCells(trs[headIdx]).findIndex((c) => /Course\s*Weighting/i.test(c.textContent ?? ''));
    const found: Record<string, number> = {};
    for (const r of trs.slice(headIdx + 1)) {
      const cs = ownCells(r);
      const cat = matchCategory(text(cs[0]), categories);
      const v = num(text(cs[col]).replace('%', ''));
      if (cat && !Number.isNaN(v)) found[cat.key] = v;
    }
    if (Object.keys(found).length) {
      const sum = Object.values(found).reduce((a, b) => a + b, 0);
      for (const c of categories) {
        if (found[c.key] === undefined) found[c.key] = isFinalish(c.label) && sum < 100 ? 100 - sum : 0;
      }
      weights = found;
      break;
    }
  }

  // Category averages table ("T : Term | 86.8%")
  const reportedAverages: Record<string, number> = {};
  for (const r of Array.from(doc.querySelectorAll('tr'))) {
    const rowText = ownCells(r).map(text).join(' ');
    const m = rowText.match(/^[A-Z]{1,2}\s*:\s*(.+?)\s+(\d+(?:\.\d+)?)\s*%$/);
    if (!m) continue;
    const cat = matchCategory(m[1], categories);
    if (cat) reportedAverages[cat.key] = num(m[2]);
  }

  return {
    format: 'grid',
    categories,
    assessments,
    weights: weights ?? defaultWeights(categories),
    weightSource: weights ? 'teachassist' : 'estimated',
    reportedMark: findReportedMark(doc),
    reportedAverages,
  };
}

/* ------------------------------------------------------------------ */
/* Expectations reports                                                */
/* ------------------------------------------------------------------ */

const EXP_CATS: Category[] = [
  { key: 'term', label: 'Term Work', short: 'T' },
  { key: 'final', label: 'Final Culminating', short: 'F' },
  { key: 'attendance', label: 'Attendance & Participation', short: 'A' },
];

function sectionOf(context: string): 'term' | 'final' | 'attendance' | null {
  const re = /(Final\s+Culminating|Attendance\s*(?:&|and)?\s*Participation|Assessment\s+Tasks|Individualized\s+(?:Conversations|Observations|Products))/gi;
  let last: string | null = null;
  let m: RegExpExecArray | null;
  while ((m = re.exec(context))) last = m[1];
  if (!last) return null;
  if (/final/i.test(last)) return 'final';
  if (/attendance/i.test(last)) return 'attendance';
  return 'term';
}

/**
 * Layout-agnostic reader for expectation reports: finds every "x / y" mark,
 * climbs to the element that holds the whole row, and reads the cells around it
 * (name before, weight after, an expectation code like "B2." anywhere).
 */
export function scanMarkRows(doc: Document): Assessment[] {
  const out: Assessment[] = [];
  const body = doc.body;
  if (!body) return out;
  const bodyText = body.textContent ?? '';
  const seen = new Set<Element>();
  const MARK_ONLY = /^(-?\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/;

  for (const el of Array.from(body.querySelectorAll('*'))) {
    if (/^(SCRIPT|STYLE)$/.test(el.tagName)) continue;
    const t = text(el);
    const m = t.match(MARK_ONLY);
    if (!m) continue;
    // Use the innermost element holding the mark.
    if (Array.from(el.children).some((c) => text(c) === t)) continue;

    let cell: Element = el;
    let row: Element | null = el.parentElement;
    while (row && row !== body && ownCellsAny(row).length < 3) {
      cell = row;
      row = row.parentElement;
    }
    if (!row || row === body || seen.has(row)) continue;
    seen.add(row);

    const cells = ownCellsAny(row);
    const idx = cells.indexOf(cell);
    const texts = cells.map((c) => text(c));
    const before = texts.slice(0, Math.max(idx, 0)).filter(Boolean);
    const after = texts.slice(idx + 1);
    const expectation = texts.find((x) => /^[A-Z]\d{1,2}\.?$/.test(x));
    const name = before.find((x) => x !== expectation && !/^[A-Z]\d{1,2}\.?$/.test(x)) ?? 'Evaluation';
    const wText = after.find((x) => /^\d+(?:\.\d+)?$/.test(x));
    const weight = wText !== undefined ? num(wText) : 1;
    const feedback = after.filter((x) => x && x !== wText && !/^\d+(?:\.\d+)?$/.test(x)).join(' ') || undefined;

    const rawRow = row.textContent ?? '';
    const pos = rawRow ? bodyText.indexOf(rawRow) : -1;
    const context = pos >= 0 ? bodyText.slice(Math.max(0, pos - 800), pos) : '';
    const section = sectionOf(context) ?? 'term';

    const mark: CatMark = { got: num(m[1]), outOf: num(m[2]), weight };
    if (exclusionOf(row)) mark.excluded = true;
    out.push({ id: `${out.length}-${slug(name)}`, name, expectation, feedback, marks: { [section]: mark } });
  }
  return out;
}

/** Child elements that look like cells (td/th or any element child in div layouts). */
function ownCellsAny(el: Element): Element[] {
  return Array.from(el.children).filter((c) => !/^(BR|SCRIPT|STYLE)$/.test(c.tagName));
}

function parseExpectationsReport(doc: Document): CourseReport {
  const body = ws(doc.body?.textContent);
  const tw = body.match(/Term\s*Work\s*\{\s*(\d+(?:\.\d+)?)\s*\}\s*=?\s*(\d+(?:\.\d+)?)?\s*%?/i);
  const termWeight = tw ? num(tw[1]) : NaN;
  const assessments: Assessment[] = [];
  let acc = '';

  const processTable = (table: Element, context: string) => {
    const rows = ownRows(table);
    const hIdx = rows.findIndex((r) => ownCells(r).some((c) => /^(Task\s*Name|Recorded\s*Time)$/i.test(text(c))));
    const before = rows.slice(0, Math.max(hIdx, 0)).map((r) => text(r)).join(' ');
    const section = sectionOf(`${context} ${before}`) ?? 'term';
    const head = ownCells(rows[hIdx]).map((c) => text(c));
    const col = (re: RegExp) => head.findIndex((h) => re.test(h));
    const cName = col(/Task\s*Name/i);
    const cTime = col(/Recorded\s*Time/i);
    const cExp = col(/Expectation/i);
    const cMark = col(/^(Mark|Level)$/i);
    const cWeight = col(/^Weight$/i);
    const cFb = col(/Feedback/i);
    const kind = cName < 0 ? (context.match(/Individualized\s+(\w+)/gi)?.pop() ?? 'Observation') : '';

    for (const r of rows.slice(hIdx + 1)) {
      const cs = ownCells(r).map((c) => text(c));
      if (cs.length < 2 || cMark < 0) continue;
      const markText = cs[cMark] ?? '';
      const frac = markText.match(FRACTION);
      let mark: CatMark | null = null;
      const weight = cWeight >= 0 && cs[cWeight] !== '' ? num(cs[cWeight]) : 1;
      if (frac) mark = { got: num(frac[1]), outOf: num(frac[2]), weight: Number.isNaN(weight) ? 1 : weight };
      else {
        const lvl = levelToPercent(markText);
        if (lvl !== null) mark = { got: lvl, outOf: 100, weight: Number.isNaN(weight) ? 1 : weight, raw: `Level ${markText}` };
      }
      const nameBase = cName >= 0 ? cs[cName] : `${kind.replace(/^Individualized\s+/i, '').replace(/s$/, '')}${cTime >= 0 && cs[cTime] ? ` (${cs[cTime]})` : ''}`;
      if (!nameBase && !mark) continue;
      if (mark && (/no\s*mark/i.test(markText) || exclusionOf(r))) mark.excluded = true;
      const name = nameBase || 'Evaluation';
      assessments.push({
        id: `${assessments.length}-${slug(name)}`,
        name,
        expectation: cExp >= 0 ? cs[cExp] : undefined,
        feedback: cFb >= 0 && cs[cFb] ? cs[cFb] : undefined,
        marks: mark ? { [section]: mark } : {},
      });
    }
  };

  const walk = (n: Node) => {
    if (n.nodeType === 3) {
      acc = (acc + ' ' + (n.textContent ?? '')).slice(-400);
      return;
    }
    if (n.nodeType !== 1) return;
    const el = n as Element;
    if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE') return;
    if (el.tagName === 'TABLE') {
      const isTaskTable = ownRows(el).some((r) => ownCells(r).some((c) => /^(Task\s*Name|Recorded\s*Time)$/i.test(text(c))));
      if (isTaskTable) {
        processTable(el, acc);
        acc = (acc + ' ' + text(el)).slice(-400);
        return;
      }
    }
    el.childNodes.forEach(walk);
  };
  if (doc.body) walk(doc.body);
  // Real pages don't always use <table> rows; fall back to a layout-agnostic scan.
  if (!assessments.some((a) => Object.keys(a.marks).length)) {
    assessments.length = 0;
    assessments.push(...scanMarkRows(doc));
  }

  const term = Number.isNaN(termWeight) ? 70 : termWeight;
  const rest = Math.max(0, 100 - term);
  const final = Math.min(30, rest);
  const reportedAverages: Record<string, number> = {};
  if (tw?.[2]) reportedAverages.term = num(tw[2]);

  return {
    format: 'expectations',
    categories: EXP_CATS.map((c) => ({ ...c })),
    assessments,
    weights: { term, final, attendance: rest - final },
    weightSource: 'estimated',
    reportedMark: undefined,
    reportedAverages,
  };
}

/* ------------------------------------------------------------------ */

export function parseReport(html: string): CourseReport | null {
  const doc = parseDoc(html);
  const grid = findGridTable(doc);
  let report: CourseReport | null = null;
  if (grid) report = parseGridReport(doc, grid);
  else if (/Term\s*Work\s*\{|Task\s*Name|Assessment\s+Tasks/i.test(doc.body?.textContent ?? '')) report = parseExpectationsReport(doc);
  return report ? applyInference(report) : null;
}

export function looksLoggedOut(html: string): boolean {
  return /name=["']?password/i.test(html) && !/viewReport|Student Reports/i.test(html);
}
