/**
 * Suggestion chips for a service's details: what's included, the jobs customers call about, and
 * the questions they ask. A client taps only what's true; nothing here is ever sent unless
 * picked, and the copywriter may tidy a picked item but never adds one.
 *
 * ── ONE APPROVED BATCH PER TRADE ────────────────────────────────────────────────
 * Xander, 2026-11-10: "Yes, one trade per batch", each batch approved word for word, live
 * clients' trades first. Add nothing here without that approval.
 *
 * Approved so far:
 * - HVAC, batch 1: "AC Installation & Service", and the included and jobs lists of "Furnace Repair
 *   & Replacement", on the copy deck Xander approved as drafted on 2026-11-10.
 * - HVAC, batch 2: the other ten HVAC services and the Furnace questions, approved by Xander as
 *   drafted on 2026-11-10 ("Approve all as drafted"). With no paying clients yet, HVAC went first
 *   as the trade that already had the sample. HVAC is now complete.
 * Every other trade shows "add your own" with no chips until its batch is approved.
 *
 * Keys are the exact menu labels in @jdd/schema's industry-menu.ts (a test pins this). Xander,
 * 2026-11-10: approved lists move into @jdd/schema's MenuService so the console intake offers the
 * same chips.
 */

export type ServiceSuggestions = { included: string[]; jobs: string[]; questions: string[] };

const NONE: ServiceSuggestions = { included: [], jobs: [], questions: [] };

/** Keyed by trade id, then by the service's menu label (industry-menu.ts). */
export const SUGGESTIONS: Readonly<Record<string, Readonly<Record<string, ServiceSuggestions>>>> = {
    hvac: {
        "Furnace Repair & Replacement": {
            included: [
                "Safety inspection", "Carbon monoxide check", "Repairs on all brands", "Igniter and flame sensor",
                "Blower motor repair", "Removal of the old furnace", "Permit and inspection", "Heat exchanger check",
                "Thermostat check", "Filter change", "Startup and testing",
            ],
            jobs: [
                "No heat", "Furnace won't turn on", "Burning smell", "Strange noises", "Turns on and off a lot",
                "High gas bills", "Pilot light keeps going out", "Carbon monoxide alarm",
                "Furnace over 15 years old",
            ],
            questions: [
                "Should I repair or replace my furnace?", "How long does a new furnace take to put in?",
                "What size furnace does my home need?", "Is my furnace safe to keep running?",
                "Do you service all brands?", "How soon can you come out?",
            ],
        },
        "AC Installation & Service": {
            included: [
                "Sizing for your home", "Removal of the old unit", "Permit and inspection", "New thermostat",
                "Refrigerant line set", "Startup and testing", "Warranty registration", "Repairs on all brands", "Diagnostic visit",
            ],
            jobs: [
                "AC blowing warm air", "AC won't turn on", "Water leaking from the unit", "Ice on the lines",
                "Loud or strange noises", "High electric bills", "Some rooms too hot", "System over 10 years old",
            ],
            questions: [
                "Should I repair or replace my AC?", "How long does a new AC take to put in?", "What size AC does my home need?",
                "Do you service all brands?", "How soon can you come out?", "Do you offer financing?",
            ],
        },
        "Heat Pump Installation": {
            included: [
                "Sizing for your home", "Removal of the old system", "Permit and inspection", "New thermostat",
                "Refrigerant line set", "Electrical hookup", "Pad or wall bracket", "Startup and testing",
                "Warranty registration", "Rebate paperwork", "Repairs on all brands",
            ],
            jobs: [
                "Heat pump not heating", "Heat pump not cooling", "Ice on the outdoor unit", "Runs all the time",
                "Blowing cold air in winter", "Loud or strange noises", "High electric bills",
                "Want to switch from gas or oil", "Old system needs replacing",
            ],
            questions: [
                "Does a heat pump work when it's very cold?", "Can a heat pump replace my furnace?",
                "What size heat pump does my home need?", "Should I repair or replace my heat pump?",
                "Are there rebates for heat pumps?", "How long does a new heat pump take to put in?",
            ],
        },
        "Maintenance Plans": {
            included: [
                "Spring and fall tune-ups", "Filter change", "Coil cleaning", "Drain line flush",
                "Refrigerant level check", "Electrical and safety check", "Thermostat check", "Priority scheduling",
                "Reminder before each visit", "Written report after each visit", "Covers all brands",
            ],
            jobs: [
                "Haven't had a tune-up in years", "Want fewer breakdowns", "New system to keep up",
                "Warranty needs yearly service", "Want lower energy bills", "Rental properties to keep up",
                "Older system to keep running",
            ],
            questions: [
                "How often should my system be serviced?", "What's included in a tune-up?",
                "Do I need a plan to keep my warranty?", "Does the plan cover repairs?",
                "Does it cover heating and cooling?", "Can I cancel anytime?",
            ],
        },
        "Duct Cleaning & Sealing": {
            included: [
                "Supply and return duct cleaning", "Vent and register cleaning", "Blower cleaning",
                "Before and after photos", "Duct sealing", "Leak testing", "Duct insulation",
                "Repair of damaged ducts", "Dryer vent cleaning", "Filter change",
            ],
            jobs: [
                "Dust everywhere", "Musty smell from the vents", "Weak airflow", "Some rooms too hot or cold",
                "Just finished a remodel", "Just moved in", "Allergies acting up", "Pests in the ducts",
                "High energy bills",
            ],
            questions: [
                "How often should ducts be cleaned?", "How long does duct cleaning take?",
                "Will it make a mess in my home?", "Do I need to be home?", "Will sealing my ducts lower my bills?",
                "Can you show me what you found?",
            ],
        },
        "24/7 Emergency Service": {
            included: [
                "Nights, weekends and holidays", "Diagnostic visit", "Repairs on all brands",
                "Common parts on the truck", "Safety check", "Price before work starts",
                "Temporary fix while parts come in",
            ],
            jobs: [
                "No heat", "No AC", "Burning smell", "Carbon monoxide alarm", "Water leaking from the unit",
                "System won't turn on", "Breaker keeps tripping", "Loud banging noise",
            ],
            questions: [
                "Can you come out tonight?", "Do you charge more after hours?", "How soon can you get here?",
                "What should I do until you arrive?", "Do you work weekends and holidays?",
                "Do you service all brands?",
            ],
        },
        "Thermostat Installation": {
            included: [
                "Smart thermostat setup", "Programmable thermostat", "Wi-Fi and app setup", "Compatibility check",
                "Wiring check", "New thermostat wire if needed", "Removal of the old thermostat", "Schedule setup",
                "Zoning controls", "Walkthrough of how to use it",
            ],
            jobs: [
                "Thermostat screen is blank", "System ignores the thermostat", "Wrong temperature reading",
                "Thermostat keeps resetting", "Want a smart thermostat", "Want to control it from my phone",
                "Upstairs and downstairs never match",
            ],
            questions: [
                "Will a smart thermostat work with my system?", "Can you install one I already bought?",
                "Do I need a new wire for a smart thermostat?", "Can I control it from my phone?",
                "How long does it take to put in?",
            ],
        },
        "Indoor Air Quality": {
            included: [
                "Air quality check", "Whole-home air purifier", "UV light", "Whole-home humidifier",
                "Whole-home dehumidifier", "Better air filters", "Fresh air ventilation", "Duct cleaning",
                "Filter change",
            ],
            jobs: [
                "Allergies acting up", "Dust everywhere", "Musty smell", "Air feels too dry", "Too humid inside",
                "Mold near the vents", "Stuffy rooms", "Pet hair and odors", "Someone at home has asthma",
            ],
            questions: [
                "Will an air purifier help my allergies?", "What filter should I use?",
                "How often should I change my filter?", "Do UV lights help?", "Can you test the air in my home?",
                "Do I need a humidifier or a dehumidifier?",
            ],
        },
        "Boiler Service": {
            included: [
                "Safety inspection", "Carbon monoxide check", "Repairs on all brands", "Burner cleaning",
                "Pressure and valve check", "Circulator pump repair", "Radiator bleeding", "Expansion tank check",
                "Removal of the old boiler", "Permit and inspection", "Startup and testing",
            ],
            jobs: [
                "No heat", "No hot water", "Radiators stay cold", "Boiler leaking", "Banging or gurgling pipes",
                "Pilot light keeps going out", "Pressure too high or too low", "Carbon monoxide alarm",
                "High gas or oil bills",
            ],
            questions: [
                "Should I repair or replace my boiler?", "How often should a boiler be serviced?",
                "Why are some radiators cold?", "Do you work on gas and oil boilers?", "How soon can you come out?",
                "Do you offer financing?",
            ],
        },
        "Mini-Split Systems": {
            included: [
                "Sizing for each room", "Indoor and outdoor units", "Wall or ceiling mounting",
                "Refrigerant line set", "Electrical hookup", "Condensate drain line", "Remote or app setup",
                "Permit and inspection", "Startup and testing", "Filter and coil cleaning", "Repairs on all brands",
            ],
            jobs: [
                "Room with no ductwork", "Garage or addition to heat or cool", "One room always too hot",
                "Mini-split not cooling", "Water dripping from the indoor unit", "Blinking lights on the unit",
                "Bad smell when it runs", "Window units to replace", "Remote not working",
            ],
            questions: [
                "Do I need ductwork for a mini-split?", "How many indoor units do I need?",
                "Can one system heat and cool?", "Where does the indoor unit go?", "How do I clean the filters?",
                "Do you service all brands?",
            ],
        },
        "Commercial HVAC": {
            included: [
                "Rooftop units", "Split systems", "Preventive maintenance", "Repairs on all brands",
                "Service after hours", "Building controls", "Make-up air units", "Replacement planning",
                "Permit and inspection", "Written report after each visit", "Service for more than one site",
            ],
            jobs: [
                "Rooftop unit down", "Office too hot", "Store too cold", "Tenants complaining",
                "Water leaking from the ceiling", "High utility bills", "Need a maintenance contract",
                "Failed inspection", "Equipment near the end of its life",
            ],
            questions: [
                "Do you work after hours?", "Do you offer maintenance contracts?", "Do you service rooftop units?",
                "Can you handle more than one location?", "How fast can you respond to a call?",
                "Do you carry commercial insurance?",
            ],
        },
        "Energy Efficiency Audits": {
            included: [
                "Whole-home walkthrough", "Blower door test", "Duct leak testing", "Infrared camera scan",
                "Insulation check", "Air leak check", "Equipment efficiency check", "Written report",
                "Upgrade recommendations", "Rebate paperwork",
            ],
            jobs: [
                "High energy bills", "Drafty rooms", "Some rooms too hot or cold", "Home hard to heat",
                "Home hard to cool", "Planning to replace my system", "Want to use less energy",
                "Buying or selling a home",
            ],
            questions: [
                "What happens during an energy audit?", "How long does an audit take?", "Will it lower my bills?",
                "Are there rebates for upgrades?", "Do I get a written report?", "Do I need to be home?",
            ],
        },
    },
};

export function suggestionsFor(trade: string, service: string): ServiceSuggestions {
    return SUGGESTIONS[trade]?.[service] ?? NONE;
}
