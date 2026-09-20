"""Shared profile Marketplace-button policy for both package validators."""

WEBSITE = "com.elgato.streamdeck.system.website"
LITE_SLUG = "davinci-resolve-lite"
PRO_URL = ("https://marketplace.elgato.com/product/"
           "davinci-resolve-pro-b703cfa1-1e25-4c62-b26d-30a70ab33933")


def check_marketplace_buttons(slug, pages, required_plugins, is_plus):
    """Return defects; the exception is not a general product-link allowance.

    Owner-approved experiment, 2026-09-07: only DaVinci Resolve Lite's single
    Get Pro key may link to its exact Pro listing. This is NOT verified Elgato
    policy. Revert the experiment if Elgato rejects it. Storefront links and
    every other product's Marketplace buttons remain blocked.
    """
    websites = [(ctl.get("Type"), pos, action)
                for page in pages for ctl in page.get("Controllers", [])
                for pos, action in (ctl.get("Actions") or {}).items()
                if action.get("UUID") == WEBSITE]
    issues = []
    expected_pos = "3,0" if is_plus else "4,0"
    approved = (slug == LITE_SLUG and len(pages) == 1 and len(websites) == 1
                and WEBSITE in required_plugins)
    if approved:
        kind, pos, action = websites[0]
        approved = (kind == "Keypad" and pos == expected_pos
                    and action.get("Settings", {}).get("path") == PRO_URL
                    and [s.get("Title") for s in action.get("States", [])] == ["Get\nPro"])
    if slug == LITE_SLUG and not approved:
        issues.append("Lite Get Pro experiment requires one page and exactly one "
                      f"Website key titled Get Pro at {expected_pos}, the exact Pro "
                      "URL, and the Website RequiredPlugins entry")
    for _, pos, action in websites:
        path = action.get("Settings", {}).get("path", "")
        if "marketplace.elgato.com" in path.lower() and not approved:
            issues.append(f"Marketplace button at {pos} is blocked; only the "
                          "specific DaVinci Lite Get Pro experiment is permitted")
    return issues
