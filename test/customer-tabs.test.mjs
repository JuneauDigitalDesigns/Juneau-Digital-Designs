import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * The customer record's tabs (Xander, 2026-11-12, approved from the mockup): Timeline, where it
 * opens, then Contact info, Jobs and Notes. Tags moved into Contact info; "Coming up" (the
 * follow-ups) sits on the Timeline; the single "Job value" and "Your notes" boxes are gone.
 *
 * Source-level, like the other record guards: no signed-in portal account to drive it in a
 * browser, and the compiler cannot see any of it.
 */

function code(path) {
    return readFileSync(path, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
}

const dir = "app/components/portal/crm";
const record = code(`${dir}/CustomerRecord.tsx`);
const tabs = code(`${dir}/record/RecordTabs.tsx`);
const contact = code(`${dir}/record/ContactTab.tsx`);
const comingUp = code(`${dir}/record/ComingUp.tsx`);
const jobs = code(`${dir}/record/JobsTab.tsx`);
const notes = code(`${dir}/record/NotesTab.tsx`);

test("four tabs, in the approved words and order", () => {
    const labels = [...tabs.matchAll(/\{ id: "(\w+)", label: "([^"]+)" \}/g)].map((m) => [m[1], m[2]]);
    assert.deepEqual(labels, [
        ["timeline", "Timeline"],
        ["contact", "Contact info"],
        ["jobs", "Jobs"],
        ["notes", "Notes"],
    ]);
    assert.match(tabs, /role="tablist"/);
    assert.match(tabs, /role="tab"/);
    assert.match(tabs, /aria-selected=\{on\}/);
});

test("the record opens on the Timeline", () => {
    assert.match(record, /initialTab = "timeline"/);
    assert.match(record, /role="tabpanel"/);
});

test("each tab shows its own part", () => {
    assert.match(record, /tab === "timeline" && activity/);
    assert.match(record, /tab === "contact" && \(\s*<ContactTab/);
    assert.match(record, /tab === "jobs" && \(\s*<JobsTab/);
    assert.match(record, /tab === "notes" && \(\s*<NotesTab/);
});

test("Coming up leads the Timeline and keeps the follow-ups' tour anchor", () => {
    const activity = record.slice(record.indexOf("const activity = ("), record.indexOf("const body = ("));
    assert.ok(activity.indexOf("<ComingUp") > -1, "Coming up is not on the Timeline");
    assert.ok(activity.indexOf("<ComingUp") < activity.indexOf('data-tour="crm-drawer-timeline"'));
    assert.match(comingUp, />\s*Coming up\s*</);
    assert.match(comingUp, /data-tour="crm-drawer-tasks"/);
});

test("tags live in Contact info, not beside the timeline", () => {
    assert.match(contact, /<TagEditor\b/);
    assert.match(contact, /<Label>Tags<\/Label>/);
    assert.doesNotMatch(record, /<TagEditor\b/);
});

test("the single Job value and Your notes boxes are gone", () => {
    assert.doesNotMatch(record, /label="Job value"/);
    assert.doesNotMatch(record, /<Label>Your notes<\/Label>/);
    assert.doesNotMatch(record, /patch\(\{ note:/);
    assert.doesNotMatch(record, /patch\(\{ value:/);
});

test("every tour anchor of the record is on the tab it opens on", () => {
    // The tour opens a record and walks stage, follow-ups, timeline and review in turn; none of
    // them may sit behind another tab.
    for (const anchor of ["crm-drawer-stage", "crm-drawer-timeline", "crm-drawer-review"]) {
        assert.match(record, new RegExp(`data-tour="${anchor}"`), anchor);
    }
    // Their own tab tours (tours v2, 2026-11-12) may anchor inside them; the record's may not.
    for (const src of [contact, jobs, notes]) assert.doesNotMatch(src, /data-tour="crm-drawer-/);
});

test("jobs carry their own status, Paid included, and the approved words", () => {
    assert.match(jobs, /JOB_STATUSES\.map/);
    for (const s of ["Add a job", "No jobs yet", "Changes save as you go.", "Delete job", "Delete this job and its visits?", "Keep it", "Job notes"]) {
        assert.ok(jobs.includes(s), s);
    }
});

test("notes use the approved words", () => {
    for (const s of ["Save note", "No notes yet", "Delete this note?", "Keep it", "Write a note about "]) {
        assert.ok(notes.includes(s), s);
    }
});
