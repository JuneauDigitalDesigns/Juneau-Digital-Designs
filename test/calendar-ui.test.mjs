import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * The calendar's UI rules (Xander, 2026-11-12), held at source level: no signed-in portal
 * account to drive them, and the compiler cannot see wording or gating.
 */

function code(path) {
    return readFileSync(path, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
}

const dir = "app/components/portal/calendar";
const section = code(`${dir}/CalendarSection.tsx`);
const grid = code(`${dir}/MonthGrid.tsx`);
const list = code(`${dir}/DayList.tsx`);
const form = code(`${dir}/AppointmentForm.tsx`);
const starter = code(`${dir}/CalendarStarter.tsx`);
const record = code("app/components/portal/crm/CustomerRecord.tsx");
const types = code("app/portal/types.ts");

test("Calendar is its own tab, gated like Customers", () => {
    assert.match(types, /\{ id: "calendar", label: "Calendar", shortLabel: "Calendar", href: "calendar", feature: "crm" \}/);
    assert.match(section, /site\.features\.crm/);
    assert.match(section, /gate\.state === "not-on-plan"\) return <CalendarStarter/);
});

test("Starter's page says what Growth adds, in the approved words", () => {
    assert.ok(starter.includes("Every job and follow-up on one calendar"));
    assert.ok(
        starter.includes("Growth adds a calendar to your portal. Book job visits, estimates and call backs against each"),
    );
    assert.ok(starter.includes("customer, and see the follow-ups you set, all in one month view."));
    assert.match(starter, /demo=growth/);
});

test("appointments drag between days, ported from the console", () => {
    assert.match(grid, /from "@dnd-kit\/core"/);
    assert.match(grid, /activationConstraint: \{ distance: 5 \}/);
    assert.match(section, /function move\(id: string, day: string\)/);
});

test("the approved words are on the page, the list and the form", () => {
    assert.ok(section.includes("Jobs, estimates and follow-ups, all in one place."));
    assert.ok(section.includes("New appointment"));
    for (const s of ["Nothing booked.", "Book something on this day", "Open customer", "Mark done", "Due today", "Delete this appointment?"]) {
        assert.ok(list.includes(s), s);
    }
    for (const s of ["New appointment", "Edit appointment", "Customer", "No job", "What", "Day", "Start", "Length", "Address", "Notes", "Save", "Cancel", "You can still save it."]) {
        assert.ok(form.includes(s), s);
    }
});

test("a job can be added to the calendar from the Jobs tab", () => {
    assert.match(record, /renderActions=\{\(job\) =>/);
    assert.ok(record.includes("Add to calendar"));
    assert.match(record, /<AppointmentForm\b/);
    assert.ok(record.includes("Open in calendar"));
});

test("the form over a record takes the keyboard from it", () => {
    assert.match(form, /aria-modal="true"/);
    assert.match(form, /addEventListener\("keydown", onKey, true\)/);
    assert.match(form, /createPortal\(/);
});
