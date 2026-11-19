import MoreScreen from "@/app/components/portal/MoreScreen";

/**
 * The phone's More tab (2026-11-19). Everything it shows comes from the chrome, which has
 * already resolved the account and `?site=`, so this page fetches nothing of its own.
 */
export default function MorePage() {
    return <MoreScreen />;
}
