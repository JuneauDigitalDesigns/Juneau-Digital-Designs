import { Card } from "./Card";

/**
 * Shimmer primitive.
 *
 * Replaces the identical 24px spinner that was copy-pasted into three sections. A spinner
 * says "something is happening"; a skeleton says "here is the shape of what's coming",
 * which stops the layout jumping when data lands.
 */
export function Skeleton({
    className = "",
    width,
    height = 12,
    rounded = 4,
}: {
    className?: string;
    width?: number | string;
    height?: number | string;
    rounded?: number | string;
}) {
    return (
        <span
            aria-hidden="true"
            className={`portal-skeleton block ${className}`}
            style={{ width: width ?? "100%", height, borderRadius: rounded }}
        />
    );
}

/** Row of headline tiles. Mirrors the real metric row's auto-fit grid, not a fixed 3-up. */
export function StatRowSkeleton({ count = 3 }: { count?: number }) {
    return (
        <div className="portal-metric-grid">
            {Array.from({ length: count }, (_, i) => (
                <Card key={i} className="flex flex-col gap-3">
                    <Skeleton width="45%" height={9} />
                    <Skeleton width="55%" height={40} />
                    <Skeleton width="35%" height={9} />
                </Card>
            ))}
        </div>
    );
}

/** The Overview health strip's resting shape. */
export function HealthStripSkeleton() {
    return (
        <Card elevation={2} density="none" className="overflow-hidden">
            <div className="portal-health-grid">
                {Array.from({ length: 4 }, (_, i) => (
                    <div key={i} className="flex flex-col gap-2 px-4 py-3">
                        <Skeleton width="50%" height={9} />
                        <Skeleton width="70%" height={16} />
                    </div>
                ))}
            </div>
        </Card>
    );
}

/** A chart card at a given height. */
export function ChartSkeleton({ height = 160 }: { height?: number }) {
    return (
        <Card className="flex flex-col gap-3">
            <Skeleton width="40%" height={9} />
            <Skeleton height={height} rounded={6} />
        </Card>
    );
}

/** Table body placeholder. */
export function TableSkeleton({ rows = 6 }: { rows?: number }) {
    return (
        <Card density="none" className="overflow-hidden">
            <div className="flex flex-col">
                {Array.from({ length: rows }, (_, i) => (
                    <div
                        key={i}
                        className="flex items-center gap-4 px-4 py-3"
                        style={{ borderBottom: i === rows - 1 ? "none" : "1px solid var(--rule)" }}
                    >
                        <Skeleton width="18%" height={10} />
                        <Skeleton width="22%" height={10} />
                        <Skeleton width="20%" height={10} />
                        <Skeleton width="15%" height={10} />
                    </div>
                ))}
            </div>
        </Card>
    );
}

/**
 * The route-level "a panel is loading" shape, shared by every tab.
 *
 * Deliberately just a heading and a metric row. It used to render two chart cards and a
 * six-row table, which no tab actually opens with — so navigating to Overview showed this
 * shape, then a second, different client skeleton, then the real page: three unrelated
 * layouts in sequence. A skeleton that overpromises is worse than a smaller one.
 */
export function SectionSkeleton() {
    return (
        <div className="space-y-6" role="status" aria-label="Loading">
            <Skeleton width="200px" height={32} />
            <StatRowSkeleton />
        </div>
    );
}
