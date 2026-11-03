"use client";

import Drawer from "../ui/Drawer";
import CustomerRecord from "./CustomerRecord";
import type { CustomerRow } from "./stages";

/**
 * The customer record as a phone sheet.
 *
 * All that is left of what used to be a 743-line drawer: the body moved to `CustomerRecord`,
 * which the desktop now renders as the whole content area beside the rail. On a phone a sheet
 * is still right — it rises from the thumb, carries a grip, and flicks away — so this keeps it,
 * and keeps the record you are looking at over the board you came from.
 *
 * `width` stays `xl` for the handful of tablet widths that get the desktop branch of `Drawer`
 * without being wide enough for the board-and-record split.
 */
export default function CustomerDrawer({
    open,
    onClose,
    customerId,
    siteSlug,
    onChanged,
    onRequestReview,
}: {
    open: boolean;
    onClose: () => void;
    customerId: string | null;
    siteSlug: string;
    onChanged: () => void;
    onRequestReview: (c: CustomerRow) => void;
}) {
    return (
        <Drawer open={open} onClose={onClose} title="Customer" width="xl" padded={false} surface="raised">
            <CustomerRecord
                customerId={customerId}
                siteSlug={siteSlug}
                variant="sheet"
                onChanged={onChanged}
                onRequestReview={onRequestReview}
            />
        </Drawer>
    );
}
