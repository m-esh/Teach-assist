import { useMemo, useState } from 'react';
import {
  assessmentPercent,
  categoriesWithData,
  categoryAverages,
  counted,
  courseMark,
  effectiveReport,
  fmt,
  officialMark,
  requiredForTarget,
} from '../lib/calc';
import type { Assessment, CatMark, Category, Course, CourseReport } from '../lib/types';
import { emptyWhatIf, useStore, type WhatIf } from '../store';
import { Delta, Icon, MarkRing, NumberInput, Sheet, markColor } from '../components/ui';
import { displayName } from './Courses';

function applyWhatIf(report: CourseReport, w: WhatIf): Assessment[] {
  return [
    ...report.assessments.filter((a) => !w.removed.includes(a.id)).map((a) => w.edited[a.id] ?? a),
    ...w.added,
  ];
}

/** Typical weight of an evaluation in a category (median), used to prefill forms. */
function typicalWeight(report: CourseReport, key: string): number {
  const ws = report.assessments
    .map((a) => a.marks[key])
    .filter((m): m is CatMark => !!m && m.weight > 0)
    .map((m) => m.weight)
    .sort((a, b) => a - b);
  return ws.length ? ws[Math.floor(ws.length / 2)] : 1;
}

const weightSourceText: Record<CourseReport['weightSource'], string> = {
  teachassist: 'Weightings from TeachAssist.',
  inferred: 'Weightings worked out from your TeachAssist mark.',
  estimated: "Estimated weightings. TeachAssist doesn't publish them for this course.",
  custom: 'Using your custom weightings.',
};

export function CourseDetail({ course, onBack }: { course: Course; onBack(): void }) {
  const store = useStore();
  const report = effectiveReport(course, store.vault.weightOverrides);
  const whatIf = store.whatIf(course.id);
  const setWhatIf = (w: WhatIf) => store.setWhatIf(course.id, w);
  const [editing, setEditing] = useState<Assessment | 'new' | null>(null);
  const [weightsOpen, setWeightsOpen] = useState(false);
  const [whatIfMode, setWhatIfMode] = useState(false);

  const official = officialMark(course);
  const assessments = report ? applyWhatIf(report, whatIf) : [];
  const changed = whatIf.removed.length + Object.keys(whatIf.edited).length + whatIf.added.length > 0;
  const baseCalc = report ? courseMark(report, report.weights, report.assessments) : null;
  const projected = report ? courseMark(report, report.weights, assessments) : null;
  // Projected mark shown relative to TeachAssist's own number, so estimated weights don't skew the baseline.
  const shownProjected = changed && projected !== null && baseCalc !== null && official !== null ? official + (projected - baseCalc) : projected;
  const avgs = report ? categoryAverages(report, assessments) : {};
  const withData = report ? categoriesWithData(report, report.assessments) : [];
  const mismatch = report && official !== null && baseCalc !== null && Math.abs(baseCalc - official) >= 0.15;
  const weightSum = report ? report.categories.reduce((s, c) => s + (report.weights[c.key] ?? 0), 0) : 0;
  const showWeightNote = report && (mismatch || (withData.length >= 2 && report.weightSource === 'estimated'));

  return (
    <div className="screen detail">
      <header className="top">
        <button className="icon-btn" onClick={onBack} aria-label="Back">
          <Icon name="back" />
        </button>
        <div className="top-center">
          <h1 className="small-title">{course.code}</h1>
          <div className="sub">{displayName(course)}</div>
        </div>
        <span className="icon-btn ghost" />
      </header>

      {changed && (
        <div className="whatif-bar">
          <div>
            <div className="eyebrow">What-if projection</div>
            <div className="whatif-mark" style={{ color: markColor(shownProjected) }}>
              {fmt(shownProjected)}% <Delta from={official ?? baseCalc} to={shownProjected} />
            </div>
          </div>
          <button className="btn small ghost" onClick={() => setWhatIf(emptyWhatIf())}>
            Reset
          </button>
        </div>
      )}

      <section className="card hero detail-hero">
        <MarkRing mark={changed ? shownProjected : official} size={140} label={changed ? 'projected' : 'course'} />
        <div className="hero-text">
          {changed && <div className="muted small">TeachAssist: {fmt(official)}%</div>}
          {course.midterm !== null && <div className="chip">Midterm {fmt(course.midterm, 0)}%</div>}
          <div className="muted small">
            {[course.block && `Block ${course.block}`, course.room && `Room ${course.room}`].filter(Boolean).join(' · ')}
          </div>
          {course.school && <div className="faint small">{course.school}</div>}
        </div>
      </section>

      {course.reportError && <div className="banner warn">{course.reportError}</div>}
      {!report && !course.reportError && <div className="empty">No detailed report on TeachAssist yet.</div>}

      {report && (
        <>
          <section className="card">
            <div className="card-head">
              <h3>Breakdown</h3>
              <button className="link" onClick={() => setWeightsOpen(true)}>
                Weightings
              </button>
            </div>
            {report.categories.map((c) => {
              const avg = avgs[c.key];
              const share = weightSum > 0 ? ((report.weights[c.key] ?? 0) / weightSum) * 100 : 0;
              return (
                <div className="cat" key={c.key}>
                  <span className="cat-badge">{c.short}</span>
                  <div className="cat-main">
                    <div className="cat-top">
                      <span>{c.label}</span>
                      <span style={{ color: markColor(avg) }}>{avg === null ? '—' : `${fmt(avg)}%`}</span>
                    </div>
                    <div className="bar">
                      <div style={{ width: `${Math.max(0, Math.min(100, avg ?? 0))}%`, background: markColor(avg) }} />
                    </div>
                    <div className="faint small">{share > 0 ? `${fmt(share)}% of course` : 'Not counted'}</div>
                  </div>
                </div>
              );
            })}
            {showWeightNote && (
              <div className="note">
                {weightSourceText[report.weightSource]}
                {mismatch && ` Calculated ${fmt(baseCalc)}% vs TeachAssist ${fmt(official)}%.`}{' '}
                <button className="link" onClick={() => setWeightsOpen(true)}>
                  Adjust
                </button>
              </div>
            )}
          </section>

          <NeededCard report={report} assessments={assessments} current={changed ? shownProjected : official} offset={official !== null && baseCalc !== null ? official - baseCalc : 0} />

          <section>
            <div className="section-head">
              <h3 className="group-label">Evaluations</h3>
              <div className="whatif-toggle">
                <span className="small muted">What-if</span>
                <button
                  role="switch"
                  aria-checked={whatIfMode}
                  aria-label="What-if mode"
                  className={`toggle ${whatIfMode ? 'on' : ''}`}
                  onClick={() => setWhatIfMode(!whatIfMode)}
                >
                  <span />
                </button>
              </div>
            </div>
            {whatIfMode && (
              <button className="card add-row" onClick={() => setEditing('new')}>
                <Icon name="plus" /> Add a what-if evaluation
              </button>
            )}
            <div className="list">
              {[...whatIf.added].reverse().map((a) => (
                <EvalCard
                  key={a.id}
                  a={a}
                  report={report}
                  tag="What-if"
                  whatIfMode={whatIfMode}
                  onEdit={() => setEditing(a)}
                  onRemove={() => setWhatIf({ ...whatIf, added: whatIf.added.filter((x) => x.id !== a.id) })}
                />
              ))}
              {[...report.assessments].reverse().map((orig) => {
                const removed = whatIf.removed.includes(orig.id);
                const a = whatIf.edited[orig.id] ?? orig;
                return (
                  <EvalCard
                    key={orig.id}
                    a={a}
                    report={report}
                    tag={removed ? 'Removed' : whatIf.edited[orig.id] ? 'Edited' : undefined}
                    dim={removed}
                    whatIfMode={whatIfMode}
                    onEdit={() => setEditing(a)}
                    onRemove={() =>
                      setWhatIf({
                        ...whatIf,
                        removed: removed ? whatIf.removed.filter((x) => x !== orig.id) : [...whatIf.removed, orig.id],
                      })
                    }
                    removed={removed}
                    onRevert={
                      whatIf.edited[orig.id]
                        ? () => {
                            const e = { ...whatIf.edited };
                            delete e[orig.id];
                            setWhatIf({ ...whatIf, edited: e });
                          }
                        : undefined
                    }
                  />
                );
              })}
              {!report.assessments.length && !whatIf.added.length && <div className="empty">No evaluations posted yet.</div>}
            </div>
            {whatIfMode && <p className="faint small center">What-if changes are only on this device and reset when you close the app.</p>}
          </section>
        </>
      )}

      {report && (
        <EvalEditor
          open={editing !== null}
          report={report}
          initial={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSave={(a) => {
            if (editing === 'new') setWhatIf({ ...whatIf, added: [...whatIf.added, a] });
            else if (a.hypothetical) setWhatIf({ ...whatIf, added: whatIf.added.map((x) => (x.id === a.id ? a : x)) });
            else setWhatIf({ ...whatIf, edited: { ...whatIf.edited, [a.id]: a } });
            setEditing(null);
          }}
        />
      )}
      {report && course.report && (
        <WeightsEditor
          open={weightsOpen}
          onClose={() => setWeightsOpen(false)}
          report={report}
          original={course.report}
          onSave={(w) => {
            store.setWeights(course.code, w);
            setWeightsOpen(false);
          }}
        />
      )}
    </div>
  );
}

function EvalCard({
  a,
  report,
  tag,
  dim,
  whatIfMode,
  onEdit,
  onRemove,
  removed,
  onRevert,
}: {
  a: Assessment;
  report: CourseReport;
  tag?: string;
  dim?: boolean;
  whatIfMode: boolean;
  onEdit(): void;
  onRemove(): void;
  removed?: boolean;
  onRevert?(): void;
}) {
  const [open, setOpen] = useState(false);
  const pct = assessmentPercent(a, report.weights);
  const anyCounted = report.categories.some((c) => counted(a, c.key));
  const hasMarks = Object.keys(a.marks).length > 0;
  return (
    <div className={`card eval ${dim ? 'dim' : ''}`}>
      <button className="eval-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <div className="eval-name">
          {a.name}
          {tag && <span className={`tag ${tag === 'What-if' ? 'tag-accent' : ''}`}>{tag}</span>}
          {a.excluded === 'no-mark' && <span className="tag">No mark</span>}
          {hasMarks && !anyCounted && !a.excluded && <span className="tag">Not counted</span>}
        </div>
        <div className="eval-pct" style={{ color: markColor(hasMarks ? pct : null) }}>
          {hasMarks && pct !== null ? `${fmt(pct)}%` : <span className="faint small">Not marked</span>}
        </div>
      </button>
      {hasMarks && (
        <div className="chips">
          {report.categories.map((c) => {
            const m = a.marks[c.key];
            if (!m) return null;
            return (
              <span key={c.key} className={`mchip ${counted(a, c.key) ? '' : 'off'}`} title={c.label}>
                <b>{c.short}</b> {m.raw ?? `${fmt(m.got, 2).replace(/\.?0+$/, '')}/${fmt(m.outOf, 2).replace(/\.?0+$/, '')}`}
                {m.outOf > 0 && !m.raw && <i>{fmt((m.got / m.outOf) * 100, 0)}%</i>}
                <i>w{fmt(m.weight, 2).replace(/\.?0+$/, '') || 0}</i>
              </span>
            );
          })}
        </div>
      )}
      {open && (a.feedback || a.expectation) && (
        <div className="feedback">
          {a.expectation && <div className="faint small">Expectation {a.expectation}</div>}
          {a.feedback && <div>{a.feedback}</div>}
        </div>
      )}
      {whatIfMode && (
        <div className="eval-actions">
          {!removed && (
            <button className="btn small ghost" onClick={onEdit}>
              <Icon name="edit" size={16} /> Edit
            </button>
          )}
          {onRevert && (
            <button className="btn small ghost" onClick={onRevert}>
              <Icon name="undo" size={16} /> Revert
            </button>
          )}
          <button className="btn small ghost" onClick={onRemove}>
            <Icon name={removed ? 'undo' : 'trash'} size={16} /> {removed ? 'Restore' : 'Remove'}
          </button>
        </div>
      )}
    </div>
  );
}

interface Row {
  got: string;
  outOf: string;
  weight: string;
}

function EvalEditor({
  open,
  report,
  initial,
  onClose,
  onSave,
}: {
  open: boolean;
  report: CourseReport;
  initial: Assessment | null;
  onClose(): void;
  onSave(a: Assessment): void;
}) {
  return open ? <EvalEditorInner report={report} initial={initial} onClose={onClose} onSave={onSave} /> : null;
}

function EvalEditorInner({ report, initial, onClose, onSave }: { report: CourseReport; initial: Assessment | null; onClose(): void; onSave(a: Assessment): void }) {
  const withData = categoriesWithData(report);
  const defaultCats = withData.length ? withData : report.categories.slice(0, 1).map((c) => c.key);
  const [name, setName] = useState(initial?.name ?? 'Upcoming test');
  const [rows, setRows] = useState<Record<string, Row>>(() =>
    Object.fromEntries(
      report.categories.map((c) => {
        const m = initial?.marks[c.key];
        if (m) return [c.key, { got: String(m.got), outOf: String(m.outOf), weight: String(m.weight) }];
        const on = !initial && defaultCats.includes(c.key);
        return [c.key, { got: '', outOf: on ? '100' : '', weight: on ? String(typicalWeight(report, c.key)) : '' }];
      }),
    ),
  );
  const [fill, setFill] = useState('');

  const set = (k: string, patch: Partial<Row>) => setRows((r) => ({ ...r, [k]: { ...r[k], ...patch } }));
  const marks: Record<string, CatMark> = {};
  for (const c of report.categories) {
    const r = rows[c.key];
    const got = parseFloat(r.got);
    const outOf = parseFloat(r.outOf);
    const weight = parseFloat(r.weight);
    if (Number.isFinite(got) && outOf > 0) marks[c.key] = { got, outOf, weight: Number.isFinite(weight) ? weight : 1 };
  }
  const valid = Object.keys(marks).length > 0 && name.trim();

  return (
    <Sheet open title={initial ? 'Edit evaluation' : 'Add what-if evaluation'} onClose={onClose}>
      <label className="field">
        <span>Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} aria-label="Evaluation name" />
      </label>
      <div className="fill-row">
        <span className="small muted">Same % in every category</span>
        <NumberInput
          value={fill}
          ariaLabel="Percent for all categories"
          placeholder="%"
          onChange={(v) => {
            setFill(v);
            const pct = parseFloat(v);
            if (!Number.isFinite(pct)) return;
            setRows((r) =>
              Object.fromEntries(
                Object.entries(r).map(([k, row]) => {
                  if (!(parseFloat(row.weight) > 0)) return [k, row];
                  const out = parseFloat(row.outOf) > 0 ? parseFloat(row.outOf) : 100;
                  return [k, { ...row, outOf: String(out), got: String(Math.round(((pct / 100) * out) * 100) / 100) }];
                }),
              ),
            );
          }}
        />
      </div>
      <div className="grid-head">
        <span />
        <span>Mark</span>
        <span>Out of</span>
        <span>Weight</span>
      </div>
      {report.categories.map((c: Category) => (
        <div className="grid-row" key={c.key}>
          <span className="cat-badge" title={c.label}>
            {c.short}
          </span>
          <NumberInput value={rows[c.key].got} onChange={(v) => set(c.key, { got: v })} ariaLabel={`${c.label} mark`} placeholder="—" />
          <NumberInput value={rows[c.key].outOf} onChange={(v) => set(c.key, { outOf: v })} ariaLabel={`${c.label} out of`} placeholder="—" />
          <NumberInput value={rows[c.key].weight} onChange={(v) => set(c.key, { weight: v })} ariaLabel={`${c.label} weight`} placeholder="—" />
        </div>
      ))}
      <p className="faint small">Leave a category's mark blank to skip it. Weight is the evaluation's weight inside that category (as TeachAssist shows it, e.g. weight=1).</p>
      <button
        className="btn primary block"
        disabled={!valid}
        onClick={() =>
          onSave({
            id: initial?.id ?? `whatif-${Date.now()}`,
            name: name.trim(),
            marks,
            hypothetical: initial ? initial.hypothetical : true,
            feedback: initial?.feedback,
            expectation: initial?.expectation,
          })
        }
      >
        {initial ? 'Save' : 'Add'}
      </button>
    </Sheet>
  );
}

const needColor = (p: number | undefined) =>
  p === undefined ? 'var(--muted)' : p <= 70 ? 'var(--g-90)' : p <= 85 ? 'var(--g-80)' : p <= 95 ? 'var(--g-70)' : 'var(--g-50)';

function NeededCard({ report, assessments, current, offset }: { report: CourseReport; assessments: Assessment[]; current: number | null; offset: number }) {
  const withData = categoriesWithData(report);
  const firstCat = withData[0] ?? report.categories[0]?.key;
  const defaultTarget = current === null ? 85 : Math.min(100, Math.floor(current / 5) * 5 + 5);
  const [target, setTarget] = useState(String(defaultTarget));
  const [weights, setWeights] = useState<Record<string, string>>(() =>
    Object.fromEntries(report.categories.map((c) => [c.key, c.key === firstCat ? String(typicalWeight(report, c.key)) : ''])),
  );
  const evalWeights = Object.fromEntries(Object.entries(weights).map(([k, v]) => [k, parseFloat(v) || 0]));
  const t = parseFloat(target);
  const res = useMemo(
    () => {
      // Shift by the gap between TeachAssist's mark and ours so estimated weightings don't skew the answer.
      const r = requiredForTarget(report, report.weights, assessments, evalWeights, t - offset);
      return { ...r, min: r.min === undefined ? undefined : r.min + offset, max: r.max === undefined ? undefined : r.max + offset };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [report, assessments, JSON.stringify(evalWeights), t, offset],
  );

  return (
    <section className="card">
      <div className="card-head">
        <h3>
          <Icon name="target" size={18} /> What do I need?
        </h3>
      </div>
      <div className="needed-target">
        <span>To finish at</span>
        <NumberInput value={target} onChange={setTarget} ariaLabel="Target mark" className="target-input" />
        <span>% I need on the next evaluation:</span>
      </div>
      <div className="needed-result">
        {res.kind === 'needed' && (
          <div className="needed-big" style={{ color: needColor(res.percent) }}>
            {fmt(res.percent)}%
          </div>
        )}
        {res.kind === 'guaranteed' && <div className="needed-msg good">You're there even with 0%. Range: {fmt(res.min)}–{fmt(res.max)}%.</div>}
        {res.kind === 'impossible' && <div className="needed-msg bad">Not reachable on this one. 100% gets you {fmt(res.max)}%.</div>}
        {res.kind === 'invalid' && <div className="needed-msg">Give the evaluation a weight in at least one category below.</div>}
      </div>
      <details className="needed-weights">
        <summary className="small muted">Evaluation weight by category</summary>
        <div className="weights-grid">
          {report.categories.map((c) => (
            <label key={c.key} className="wfield">
              <span className="cat-badge" title={c.label}>
                {c.short}
              </span>
              <NumberInput
                value={weights[c.key]}
                onChange={(v) => setWeights((w) => ({ ...w, [c.key]: v }))}
                ariaLabel={`${c.label} weight`}
                placeholder="0"
              />
            </label>
          ))}
        </div>
        <p className="faint small">Prefilled with the usual weight of evaluations in this course. Includes your what-if changes.</p>
      </details>
    </section>
  );
}

function WeightsEditor({
  open,
  onClose,
  report,
  original,
  onSave,
}: {
  open: boolean;
  onClose(): void;
  report: CourseReport;
  original: CourseReport;
  onSave(w: Record<string, number> | null): void;
}) {
  if (!open) return null;
  return <WeightsEditorInner onClose={onClose} report={report} original={original} onSave={onSave} />;
}

function WeightsEditorInner({ onClose, report, original, onSave }: { onClose(): void; report: CourseReport; original: CourseReport; onSave(w: Record<string, number> | null): void }) {
  const [vals, setVals] = useState<Record<string, string>>(() =>
    Object.fromEntries(report.categories.map((c) => [c.key, String(Math.round((report.weights[c.key] ?? 0) * 100) / 100)])),
  );
  const total = Object.values(vals).reduce((s, v) => s + (parseFloat(v) || 0), 0);
  return (
    <Sheet open title="Category weightings" onClose={onClose}>
      <p className="muted small">{weightSourceText[report.weightSource]} These set how much each category counts toward the course mark.</p>
      {report.categories.map((c) => (
        <label className="field inline" key={c.key}>
          <span>
            <span className="cat-badge">{c.short}</span> {c.label}
          </span>
          <NumberInput value={vals[c.key]} onChange={(v) => setVals((x) => ({ ...x, [c.key]: v }))} ariaLabel={`${c.label} weighting`} />
        </label>
      ))}
      <p className="faint small">Total {fmt(total)}. They don't have to add to 100; they're scaled automatically.</p>
      <button
        className="btn primary block"
        disabled={total <= 0}
        onClick={() => onSave(Object.fromEntries(Object.entries(vals).map(([k, v]) => [k, parseFloat(v) || 0])))}
      >
        Save
      </button>
      {report.weightSource === 'custom' && (
        <button className="btn ghost block" onClick={() => onSave(null)}>
          Reset to {original.weightSource === 'teachassist' ? "TeachAssist's" : 'automatic'} weightings
        </button>
      )}
    </Sheet>
  );
}
