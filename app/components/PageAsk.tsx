import ClosingAsk from "./home/ClosingAsk";

/**
 * A page's closing ask: the same two asks on /faq, /about and /hvac, styled by the class each page
 * passes. Get Started goes to /contact (Xander, 19 Nov 2026); until then this component also held
 * the slide-over form it opened.
 */
export default function PageAsk({ className }: { className: string }) {
  return <ClosingAsk className={className} />;
}
