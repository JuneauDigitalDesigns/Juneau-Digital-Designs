import { notFound, redirect } from "next/navigation";
import { currentSiteContext } from "@/app/lib/portal-dashboard";
import { wizardData } from "@/app/lib/page-additions-store";
import { tabHref } from "@/app/portal/types";
import { PageAdditionWizard } from "@/app/components/portal/page-additions/PageAdditionWizard";

export const dynamic = "force-dynamic";

/**
 * The facts wizard for one page JDD approved (2026-11-14). Open only while the page is the
 * client's to answer (waiting for facts, or received); anything else goes back to the Overview,
 * where the notice says where it stands.
 */
export default async function PageAdditionPage({ searchParams }: { searchParams: Promise<{ site?: string; id?: string }> }) {
    const ctx = await currentSiteContext(searchParams);
    if (!ctx) notFound();
    const { id } = await searchParams;
    const data = id ? await wizardData(ctx.account, ctx.raw, id) : null;
    if (!data) redirect(tabHref("", ctx.props.slug));

    const sentAt = data.facts.submittedAt;
    const sent = (addedAt: string) => Boolean(sentAt) && addedAt <= (sentAt as string);
    const unsentJob = data.facts.jobs.find((j) => !sent(j.addedAt));
    return (
        <PageAdditionWizard
            key={data.proposal.id}
            siteSlug={ctx.props.slug}
            id={data.proposal.id}
            service={data.serviceName}
            town={data.proposal.town}
            towns={data.profile.towns.map((t) => t.name)}
            state={(data.profile as { state?: string }).state ?? ""}
            initial={{
                photos: data.facts.photos
                    .filter((p) => p.status !== "rejected")
                    .map((p) => ({ id: p.id, url: p.url, filename: p.filename, town: p.town, sent: sent(p.addedAt) })),
                reviews: data.facts.reviews
                    .filter((r) => r.status !== "rejected")
                    .map((r) => ({ id: r.id, text: r.text, name: r.name ?? "", verbatim: r.verbatim, sent: sent(r.addedAt) })),
                job: unsentJob?.text ?? "",
            }}
            initialNeeded={data.needed}
        />
    );
}
