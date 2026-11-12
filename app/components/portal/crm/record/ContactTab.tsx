"use client";

import { formatPhone, type CustomerRow } from "../stages";
import { EditableField, Label, TagEditor } from "./fields";

/**
 * The Contact info tab: who they are and how to reach them.
 *
 * The four correctable fields that used to head the details column, with "Came from" and
 * "Customer since" beside them, and the tags (Xander, 2026-11-12: "Tags should definitely move
 * into contact info"). Two columns when the panel is wide (`@3xl`, the panel's own container),
 * one on a phone.
 */
export default function ContactTab({
    customer,
    patch,
    fieldError,
    className,
}: {
    customer: CustomerRow;
    patch: (body: Record<string, unknown>) => Promise<boolean>;
    fieldError: string | null;
    className?: string;
}) {
    const since = new Date(customer.firstContactAt ?? customer.createdAt);

    return (
        <div
            className={`grid grid-cols-[minmax(0,1fr)] @3xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-x-10 gap-y-6 content-start ${className ?? ""}`}
        >
            <div className="flex flex-col gap-2.5 min-w-0">
                {/* The receptionist takes these down by ear mid-call, so they are often close
                    rather than right. */}
                <p className="m-0 mb-0.5 text-[12.5px] leading-snug" style={{ color: "var(--fg-2)" }}>
                    Click a field to correct it.
                </p>
                <EditableField
                    id="f-name"
                    label="Name"
                    value={customer.name ?? ""}
                    onSave={(v) => patch({ name: v || null })}
                />
                <EditableField
                    id="f-phone"
                    label="Phone"
                    type="tel"
                    value={customer.phone ? formatPhone(customer.phone) : ""}
                    onSave={(v) => patch({ phone: v || null })}
                />
                <EditableField
                    id="f-email"
                    label="Email"
                    type="email"
                    value={customer.email ?? ""}
                    onSave={(v) => patch({ email: v || null })}
                />
                <EditableField
                    id="f-address"
                    label="Address"
                    multiline
                    value={customer.address ?? ""}
                    onSave={(v) => patch({ address: v || null })}
                />

                {fieldError && (
                    <p
                        className="text-[12px] rounded-md px-2.5 py-2 m-0"
                        style={{
                            color: "var(--chart-neg)",
                            background: "color-mix(in srgb, var(--chart-neg) 10%, transparent)",
                        }}
                        role="alert"
                    >
                        {fieldError}
                    </p>
                )}
            </div>

            <div className="flex flex-col gap-4 min-w-0 @3xl:pt-7">
                {/* Not editable: where they came from and when are facts about the record, not
                    details about the person. */}
                <Fact label="Came from">
                    {customer.source === "web-form"
                        ? "Website form"
                        : customer.source === "call"
                          ? "Phone call"
                          : "Added by you"}
                </Fact>
                <Fact label="Customer since">
                    {Number.isNaN(since.getTime())
                        ? ""
                        : since.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                </Fact>
                <div>
                    <Label>Tags</Label>
                    <TagEditor tags={customer.tags} onChange={(tags) => void patch({ tags })} />
                </div>
            </div>
        </div>
    );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div
            className="flex justify-between gap-3 pb-3 text-[13px] border-b"
            style={{ borderColor: "var(--rule-weak)" }}
        >
            <span style={{ color: "var(--fg-2)" }}>{label}</span>
            <span className="text-right" style={{ color: "var(--fg)" }}>
                {children}
            </span>
        </div>
    );
}
