import { jsonLdString } from "@/app/lib/site-seo";

/** One schema.org block, rendered into the server HTML where crawlers read it. */
export default function JsonLd({ data }: { data: unknown }) {
    return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(data) }} />;
}
