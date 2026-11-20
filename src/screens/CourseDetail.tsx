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
import type { Assessment, CatMark, Course, CourseReport } from '../lib/types';
import { emptyWhatIf, useStore, type WhatIf } from '../store';
import { Delta, GlassButton, Icon, Mark, MiniRing, NavBar, NumberInput, Ring, Section, Sheet, Stepper, TrendChart } from '../components/ui';
import { displayName } from './Courses';

function applyWhatIf(report: CourseReport, w: WhatIf): Assessment[] {
  return [...report.assessments.filter((a) => !w.removed.includes(a.id)).map((a) => w.edited[a.id] ?? a), ...w.added];
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

const trim = (n: number) => fmt(n, 2).replace(/\.?0+$/, '') || '0';

const weightSourceText: Record<CourseReport['weightSource'], string> = {
  teachassist: 'Weightings from TeachAssist.',
  inferred: 'Weightings worked out from your TeachAssist mark.',
  estimated: "Weightings are estimated because TeachAssist doesn't publish them for this course.",
  custom: 'Using your custom weightings.',
};

export function CourseDetail({ course, onBack }: { course: Course; onBack(): void }) {
  const store = useStore();
  const report = effectiveReport(course, store.vault.weightOverrides);
  const whatIf = store.whatIf(course.id);
  const setWhatIf = (w: WhatIf) => store.setWhatIf(course.id, w);
  const [editing, setEditing] = useState<Assessment | 'new' | null>(null);
  const [weightsOpen, setWeightsOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const official = officialMark(course);
  const assessments = report ? applyWhatIf(report, whatIf) : [];
  const changed = whatIf.removed.length + Object.keys(whatIf.edited).length + whatIf.added.length > 0;
  const baseCalc = report ? courseMark(report, report.weights, report.assessments) : null;
  const projected = report ? courseMark(report, report.weights, assessments) : null;
  // Shown relative to TeachAssist's own number so estimated weightings don't skew the baseline.
  const shownProjected = changed && projected !== null && baseCalc !== null && official !== null ? official + (projected - baseCalc) : projected;
  const avgs = report ? categoryAverages(report, assessments) : {};
  const withData = report ? categoriesWithData(report, report.assessments) : [];
  const mismatch = !!report && official !== null && baseCalc !== null && Math.abs(baseCalc - official) >= 0.15;
  const weightSum = report ? report.categories.reduce((s, c) => s + (report.weights[c.key] ?? 0), 0) : 0;
  const weightNote = report && (mismatch || (withData.length >= 2 && report.weightSource === 'estimated') || report.weightSource === 'custom');
  const subtitle = [course.block && `Block ${course.block}`, course.room && `Room ${course.room}`].filter(Boolean).join(' · ');
  const shown = changed ? shownProjected : official;
  const evalCount = report ? report.assessments.length + whatIf.added.length : 0;
  const trend = report
    ? assessments
        .filter((a) => report.categories.some((c) => counted(a, c.key)))
        .map((a) => ({ label: a.name, value: assessmentPercent(a, report.weights) ?? 0 }))
    : [];

  return (
    <div className="screen">
      <NavBar
        eyebrow={course.code}
        title={displayName(course)}
        subtitle={subtitle}
        left={
          <GlassButton onClick={onBack} label="Back">
            <Icon name="back" size={20} />
          </GlassButton>
        }
        right={
          report ? (
            <GlassButton onClick={() => setEditMode(!editMode)} label={editMode ? 'Done' : 'What-if'} prominent={editMode} wide>
              {editMode ? (
                'Done'
              ) : (
                <>
                  <Icon name="wand" size={17} /> What-if
                </>
              )}
            </GlassButton>
          ) : undefined
        }
      />

      <section className="hero-card detail-hero">
        <Ring value={shown} size={188} stroke={15}>
          <Mark value={shown} animate className="ring-mark big" />
          <span className="ring-caption">{changed ? 'Projected' : 'Course mark'}</span>
        </Ring>
        <div className="hero-pills">
          {changed ? (
            <>
              <span className="pill">
                TeachAssist {fmt(official)}% <Delta from={official ?? baseCalc} to={shownProjected} />
              </span>
              <button className="pill pill-btn" onClick={() => setWhatIf(emptyWhatIf())}>
                <Icon name="undo" size={15} /> Reset
              </button>
            </>
          ) : (
            <>
              {course.midterm !== null && <span className="pill">Midterm {fmt(course.midterm, 0)}%</span>}
              {report && <span className="pill">{report.assessments.filter((a) => Object.keys(a.marks).length).length} marked</span>}
            </>
          )}
        </div>
      </section>

      {course.reportError && <div className="notice">{course.reportError}</div>}
      {!report && !course.reportError && <div className="empty">No detailed report on TeachAssist yet.</div>}

      {report && (
        <>
          {trend.length >= 2 && (
            <Section header="Results" footer="Each bar is an evaluation, oldest to newest. The dashed line is your average." className="trend-section">
              <div className="trend-wrap">
                <TrendChart points={trend} />
              </div>
            </Section>
          )}

          <Section
            header="Breakdown"
            action={
              <button className="header-link" onClick={() => setWeightsOpen(true)}>
                Weightings
              </button>
            }
            footer={
              weightNote ? (
                <>
                  {weightSourceText[report.weightSource]}
                  {mismatch && ` Calculated ${fmt(baseCalc)}% vs TeachAssist ${fmt(official)}%.`}{' '}
                  <button className="inline-link" onClick={() => setWeightsOpen(true)}>
                    Adjust
                  </button>
                </>
              ) : undefined
            }
          >
            {report.categories.map((c) => {
              const avg = avgs[c.key];
              const share = weightSum > 0 ? ((report.weights[c.key] ?? 0) / weightSum) * 100 : 0;
              return (
                <div className="row cat-row" key={c.key}>
                  <span className="letter">{c.short}</span>
                  <span className="row-main">
                    <span className="cat-line">
                      <span className="row-title">{c.label}</span>
                      <Mark value={avg} className="cat-mark" />
                    </span>
                    <span className="meter" aria-hidden>
                      <span style={{ width: `${Math.max(0, Math.min(100, avg ?? 0))}%` }} />
                    </span>
                    <span className="row-sub">{share > 0 ? `${fmt(share, share % 1 ? 1 : 0)}% of course` : 'Not counted'}</span>
                  </span>
                </div>
              );
            })}
          </Section>

          <NeededSection report={report} assessments={assessments} current={shown} offset={official !== null && baseCalc !== null ? official - baseCalc : 0} />

          <Section
            header="Evaluations"
            action={<span className="header-aside">{evalCount}</span>}
            footer={editMode ? 'Remove, edit or add evaluations to see how your mark changes. This resets when you close the app.' : undefined}
          >
            {editMode && (
              <button className="row add-row" onClick={() => setEditing('new')}>
                <span className="round-btn add">
                  <Icon name="plus" size={14} />
                </span>
                <span className="row-title accent">Add an evaluation</span>
              </button>
            )}
            {[...whatIf.added].reverse().map((a) => (
              <EvalCell
                key={a.id}
                a={a}
                report={report}
                tag="What-if"
                editMode={editMode}
                onEdit={() => setEditing(a)}
                onToggle={() => setWhatIf({ ...whatIf, added: whatIf.added.filter((x) => x.id !== a.id) })}
              />
            ))}
            {[...report.assessments].reverse().map((orig) => {
              const removed = whatIf.removed.includes(orig.id);
              const isEdited = !!whatIf.edited[orig.id];
              return (
                <EvalCell
                  key={orig.id}
                  a={whatIf.edited[orig.id] ?? orig}
                  report={report}
                  tag={removed ? 'Removed' : isEdited ? 'Edited' : undefined}
                  removed={removed}
                  editMode={editMode}
                  onEdit={() => setEditing(whatIf.edited[orig.id] ?? orig)}
                  onToggle={() => {
                    if (removed) setWhatIf({ ...whatIf, removed: whatIf.removed.filter((x) => x !== orig.id) });
                    else if (isEdited) {
                      const e = { ...whatIf.edited };
                      delete e[orig.id];
                      setWhatIf({ ...whatIf, edited: e });
                    } else setWhatIf({ ...whatIf, removed: [...whatIf.removed, orig.id] });
                  }}
                  revertable={isEdited}
                />
              );
            })}
            {!evalCount && <div className="row muted-row">No evaluations posted yet.</div>}
          </Section>
        </>
      )}

      {report && editing !== null && (
        <EvalEditor
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
      {report && course.report && weightsOpen && (
        <WeightsEditor
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

function EvalCell({
  a,
  report,
  tag,
  removed,
  editMode,
  onEdit,
  onToggle,
  revertable,
}: {
  a: Assessment;
  report: CourseReport;
  tag?: string;
  removed?: boolean;
  editMode: boolean;
  onEdit(): void;
  onToggle(): void;
  revertable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const pct = assessmentPercent(a, report.weights);
  const hasMarks = Object.keys(a.marks).length > 0;
  const anyCounted = report.categories.some((c) => counted(a, c.key));
  const hasDetail = !!(a.feedback || a.expectation);
  const restoring = removed || revertable;

  return (
    <div className={`row eval-row ${removed ? 'removed' : ''} ${editMode ? 'editing' : ''}`}>
      {editMode && (
        <button className={`round-btn ${restoring ? 'restore' : 'remove'}`} onClick={onToggle} aria-label={restoring ? `Restore ${a.name}` : `Remove ${a.name}`}>
          <Icon name={restoring ? 'undo' : 'minus'} size={14} />
        </button>
      )}
      <button
        className="eval-body"
        onClick={() => (editMode ? !removed && onEdit() : hasDetail && setOpen(!open))}
        aria-expanded={editMode ? undefined : open}
      >
        <span className="eval-top">
          <MiniRing value={hasMarks && anyCounted ? pct : null} />
          <span className="row-title eval-name">{a.name}</span>
          {hasMarks && pct !== null ? <Mark value={pct} className="eval-mark" /> : <span className="row-none">Not marked</span>}
        </span>
        {(tag || a.excluded === 'no-mark' || (hasMarks && !anyCounted && !a.excluded)) && (
          <span className="tags">
            {tag && <span className={`tag ${tag === 'What-if' ? 'accent' : tag === 'Removed' ? 'red' : ''}`}>{tag}</span>}
            {a.excluded === 'no-mark' && <span className="tag">No mark</span>}
            {hasMarks && !anyCounted && !a.excluded && <span className="tag">Not counted</span>}
          </span>
        )}
        {hasMarks && (
          <span className="chips">
            {report.categories.map((c) => {
              const m = a.marks[c.key];
              if (!m) return null;
              return (
                <span key={c.key} className={`chip ${counted(a, c.key) ? '' : 'off'}`} title={c.label}>
                  <b>{c.short}</b>
                  {m.raw ?? `${trim(m.got)}/${trim(m.outOf)}`}
                  <i>×{trim(m.weight)}</i>
                </span>
              );
            })}
          </span>
        )}
        {open && hasDetail && (
          <span className="feedback">
            {a.expectation && <span className="row-sub">Expectation {a.expectation}</span>}
            {a.feedback && <span>{a.feedback}</span>}
          </span>
        )}
      </button>
      {editMode && !removed && (
        <span className="chev">
          <Icon name="chevron" size={16} />
        </span>
      )}
    </div>
  );
}

interface Row {
  got: string;
  outOf: string;
  weight: string;
}

function EvalEditor({ report, initial, onClose, onSave }: { report: CourseReport; initial: Assessment | null; onClose(): void; onSave(a: Assessment): void }) {
  const withData = categoriesWithData(report);
  const defaultCats = withData.length ? withData : report.categories.slice(0, 1).map((c) => c.key);
  const [name, setName] = useState(initial?.name ?? '');
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
  const valid = Object.keys(marks).length > 0;
  const preview = valid ? assessmentPercent({ id: 'p', name: '', marks }, report.weights) : null;

  const save = () =>
    valid &&
    onSave({
      id: initial?.id ?? `whatif-${Date.now()}`,
      name: name.trim() || (initial ? initial.name : 'Upcoming evaluation'),
      marks,
      hypothetical: initial ? initial.hypothetical : true,
      feedback: initial?.feedback,
      expectation: initial?.expectation,
    });

  return (
    <Sheet title={initial ? 'Edit Evaluation' : 'New Evaluation'} onClose={onClose} action={{ label: initial ? 'Save' : 'Add', onClick: save, disabled: !valid }}>
      <Section>
        <label className="row field-row">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (e.g. Unit 5 Test)" aria-label="Evaluation name" />
        </label>
        <label className="row field-row">
          <span className="row-title grow">Same score everywhere</span>
          <span className="inline-input">
            <NumberInput
              value={fill}
              ariaLabel="Percent for all categories"
              placeholder="—"
              onChange={(v) => {
                setFill(v);
                const pct = parseFloat(v);
                if (!Number.isFinite(pct)) return;
                setRows((r) =>
                  Object.fromEntries(
                    Object.entries(r).map(([k, row]) => {
                      if (!(parseFloat(row.weight) > 0)) return [k, row];
                      const out = parseFloat(row.outOf) > 0 ? parseFloat(row.outOf) : 100;
                      return [k, { ...row, outOf: String(out), got: String(Math.round((pct / 100) * out * 100) / 100) }];
                    }),
                  ),
                );
              }}
            />
            %
          </span>
        </label>
      </Section>

      <Section
        header={
          <span className="grid-labels">
            <span />
            <span>Mark</span>
            <span>Out of</span>
            <span>Weight</span>
          </span>
        }
        footer="Leave a mark blank to skip that category. Weight is the evaluation's weight inside the category, as TeachAssist shows it."
      >
        {report.categories.map((c) => (
          <div className="row grid-row" key={c.key}>
            <span className="letter" title={c.label}>
              {c.short}
            </span>
            <NumberInput value={rows[c.key].got} onChange={(v) => set(c.key, { got: v })} ariaLabel={`${c.label} mark`} placeholder="—" />
            <NumberInput value={rows[c.key].outOf} onChange={(v) => set(c.key, { outOf: v })} ariaLabel={`${c.label} out of`} placeholder="—" />
            <NumberInput value={rows[c.key].weight} onChange={(v) => set(c.key, { weight: v })} ariaLabel={`${c.label} weight`} placeholder="—" />
          </div>
        ))}
      </Section>
      {preview !== null && (
        <div className="sheet-preview">
          This evaluation: <Mark value={preview} />
        </div>
      )}
    </Sheet>
  );
}

function NeededSection({ report, assessments, current, offset }: { report: CourseReport; assessments: Assessment[]; current: number | null; offset: number }) {
  const withData = categoriesWithData(report);
  const firstCat = withData[0] ?? report.categories[0]?.key;
  const [target, setTarget] = useState(current === null ? 85 : Math.min(100, Math.floor(current / 5) * 5 + 5));
  const [showWeights, setShowWeights] = useState(false);
  const [weights, setWeights] = useState<Record<string, string>>(() =>
    Object.fromEntries(report.categories.map((c) => [c.key, c.key === firstCat ? String(typicalWeight(report, c.key)) : ''])),
  );
  const evalWeights = Object.fromEntries(Object.entries(weights).map(([k, v]) => [k, parseFloat(v) || 0]));
  const res = useMemo(
    () => {
      const r = requiredForTarget(report, report.weights, assessments, evalWeights, target - offset);
      return { ...r, max: r.max === undefined ? undefined : r.max + offset, min: r.min === undefined ? undefined : r.min + offset };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [report, assessments, JSON.stringify(evalWeights), target, offset],
  );
  const weightSummary = report.categories
    .filter((c) => evalWeights[c.key] > 0)
    .map((c) => `${c.short} ×${trim(evalWeights[c.key])}`)
    .join(', ');

  return (
    <Section header="What do I need?" footer="Includes any what-if changes you've made.">
      <div className="row">
        <span className="row-main">
          <span className="row-title">I want to finish with</span>
        </span>
        <span className="target-value">{target}%</span>
        <Stepper value={target} onChange={setTarget} min={50} max={100} label="target mark" />
      </div>
      <div className="row needed-row">
        <Gauge value={res.kind === 'needed' ? res.percent ?? null : res.kind === 'guaranteed' ? 0 : res.kind === 'impossible' ? 100 : null} state={res.kind} />
        {res.kind === 'needed' && (
          <>
            <Mark value={res.percent} className="needed-mark" />
            <span className="row-sub">needed on your next evaluation</span>
          </>
        )}
        {res.kind === 'guaranteed' && (
          <>
            <span className="needed-msg good">
              <Icon name="check" size={20} /> Already there
            </span>
            <span className="row-sub">Even 0% keeps you at {fmt(res.min)}% or above.</span>
          </>
        )}
        {res.kind === 'impossible' && (
          <>
            <span className="needed-msg">Out of reach on one evaluation</span>
            <span className="row-sub">100% would bring you to {fmt(res.max)}%.</span>
          </>
        )}
        {res.kind === 'invalid' && <span className="row-sub">Give the next evaluation a weight in at least one category.</span>}
      </div>
      <button className="row" onClick={() => setShowWeights(!showWeights)} aria-expanded={showWeights}>
        <span className="row-main">
          <span className="row-title">Next evaluation counts as</span>
        </span>
        <span className="row-value">{weightSummary || 'Set weight'}</span>
        <span className={`chev ${showWeights ? 'down' : ''}`}>
          <Icon name="chevron" size={16} />
        </span>
      </button>
      {showWeights &&
        report.categories.map((c) => (
          <label className="row sub-row" key={c.key}>
            <span className="letter">{c.short}</span>
            <span className="row-main">
              <span className="row-title">{c.label}</span>
            </span>
            <NumberInput value={weights[c.key]} onChange={(v) => setWeights((w) => ({ ...w, [c.key]: v }))} ariaLabel={`${c.label} weight`} placeholder="0" className="small-num" />
          </label>
        ))}
    </Section>
  );
}

function WeightsEditor({ onClose, report, original, onSave }: { onClose(): void; report: CourseReport; original: CourseReport; onSave(w: Record<string, number> | null): void }) {
  const [vals, setVals] = useState<Record<string, string>>(() =>
    Object.fromEntries(report.categories.map((c) => [c.key, String(Math.round((report.weights[c.key] ?? 0) * 100) / 100)])),
  );
  const total = Object.values(vals).reduce((s, v) => s + (parseFloat(v) || 0), 0);
  return (
    <Sheet
      title="Weightings"
      onClose={onClose}
      action={{ label: 'Save', disabled: total <= 0, onClick: () => onSave(Object.fromEntries(Object.entries(vals).map(([k, v]) => [k, parseFloat(v) || 0]))) }}
    >
      <Section footer={`${weightSourceText[report.weightSource]} Total ${fmt(total, 1)}. Values are scaled automatically, so they don't need to add to 100.`}>
        {report.categories.map((c) => (
          <label className="row" key={c.key}>
            <span className="letter">{c.short}</span>
            <span className="row-main">
              <span className="row-title">{c.label}</span>
            </span>
            <NumberInput value={vals[c.key]} onChange={(v) => setVals((x) => ({ ...x, [c.key]: v }))} ariaLabel={`${c.label} weighting`} className="small-num" />
          </label>
        ))}
      </Section>
      {report.weightSource === 'custom' && (
        <Section>
          <button className="row" onClick={() => onSave(null)}>
            <span className="row-title accent">Reset to {original.weightSource === 'teachassist' ? "TeachAssist's" : 'automatic'} weightings</span>
          </button>
        </Section>
      )}
    </Sheet>
  );
}

/** Half-circle gauge for "what do I need". */
function Gauge({ value, state }: { value: number | null; state: string }) {
  const r = 34;
  const len = Math.PI * r;
  const pct = value === null ? 0 : Math.max(0, Math.min(100, value));
  return (
    <svg className={`gauge ${state}`} width="88" height="50" viewBox="0 0 88 50" aria-hidden>
      <path d={`M10 44 A${r} ${r} 0 0 1 78 44`} className="gauge-track" />
      <path d={`M10 44 A${r} ${r} 0 0 1 78 44`} className="gauge-fill" strokeDasharray={len} strokeDashoffset={len * (1 - pct / 100)} />
    </svg>
  );
}
