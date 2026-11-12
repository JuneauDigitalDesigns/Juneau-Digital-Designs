"use client";

import Drawer from "../ui/Drawer";
import CustomerRecord, { type ReviewContext } from "./CustomerRecord";

/**
 * The customer record as a phone sheet.
 *
 * All that is left of what used to be a 743-line drawer: the body moved to `CustomerRecord`,
 * which the desktop renders in the wide panel that slides over the board (`CustomerPanel`). On
 * a phone a sheet is still right — it rises from the thumb, carries a grip, and flicks away — so
 * this keeps it, and keeps the record you are looking at over the board you came from.
 *
 * Its way back reads "All customers", the same words as the desktop panel's, rather than a
 * title and an ✕: it says where you are going, and it sits where a thumb is.
 *
 * Only mounted open below 768px (`useIsMobile`), where `Drawer` is always the sheet; `width`
 * is the desktop branch's and never applies.
 */
export default function CustomerDrawer({
    open,
    onClose,
    customerId,
    siteSlug,
    onChanged,
    review,
    onNotFound,
}: {
    open: boolean;
    onClose: () => void;
    customerId: string | null;
    siteSlug: string;
    onChanged: () => void;
    review: ReviewContext;
    onNotFound?: () => void;
}) {
    return (
        <Drawer
            open={open}
            onClose={onClose}
            title="Customer"
            back="All customers"
            width="xl"
            padded={false}
            surface="raised"
        >
            <CustomerRecord
                customerId={customerId}
                siteSlug={siteSlug}
                variant="sheet"
                onChanged={onChanged}
                review={review}
                onNotFound={onNotFound}
            />
        </Drawer>
    );
}
