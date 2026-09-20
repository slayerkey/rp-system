"""Regression checks for the deliberate Lite trim and narrow upsell experiment.

Run after build_davinci_lite(): python -m unittest discover -s profiles/_build -p test_davinci_lite.py
"""
import copy
import json
from pathlib import Path
import unittest
from uuid import uuid4
import zipfile

import common
from marketplace_policy import check_marketplace_buttons, LITE_SLUG, PRO_URL, WEBSITE

ROOT = Path(__file__).resolve().parents[2]
PROD = json.loads((ROOT / "registry.json").read_text(encoding="utf-8"))["products"][LITE_SLUG]
HOTKEY = "com.elgato.streamdeck.system.hotkey"
# Independent contract: title, keyboard key, Shift, Ctrl (Cmd on Mac).
STANDARD = {
    "0,0": ("Select\nA", "A", False, False),
    "1,0": ("Marker\nM", "M", False, False),
    "2,0": ("Snap\nN", "N", False, False),
    "3,0": ("Zoom\nFit", "Z", True, False),
    "0,1": ("Rev", "J", False, False),
    "1,1": ("Stop", "K", False, False),
    "2,1": ("Play", "L", False, False),
    "3,1": ("In\nI", "I", False, False),
    "4,1": ("Out\nO", "O", False, False),
    "0,2": ("Undo", "Z", False, True),
    "1,2": ("Redo", "Z", True, True),
}
PLUS = {"0,0": STANDARD["0,0"], "1,0": STANDARD["1,0"],
        "2,0": STANDARD["3,0"], "0,1": STANDARD["3,1"], "1,1": STANDARD["4,1"]}


def archive(variant):
    return zipfile.ZipFile(ROOT / PROD["paths"]["dir"] / PROD["variant_files"][variant])


class LitePackageTests(unittest.TestCase):
    def check_hotkey(self, record, key, shift, ctrl, mac):
        self.assertEqual(record["VKeyCode"], (common.MAC if mac else common.VK)[key])
        self.assertEqual(record["NativeCode"], record["VKeyCode"])
        self.assertEqual(record["QTKeyCode"], common.qt_code(key))
        self.assertEqual(record["KeyShift"], shift)
        self.assertEqual(record["KeyCtrl"], ctrl and not mac)
        self.assertEqual(record["KeyCmd"], ctrl and mac)
        self.assertFalse(record["KeyOption"])
        self.assertEqual(record["KeyModifiers"], int(shift) + (8 if mac else 2) * ctrl)

    def test_all_six_archives(self):
        self.assertEqual(set(PROD["variant_files"]),
                         {f"{d}_{o}" for d in ("std", "xl", "plus") for o in ("win", "mac")})
        for variant in PROD["variant_files"]:
            with self.subTest(variant=variant), archive(variant) as z:
                names = set(z.namelist())
                self.assertIn("package.json", names)
                self.assertNotIn("manifest.json", names)
                pkg = json.loads(z.read("package.json"))
                plus, mac = variant.startswith("plus"), variant.endswith("mac")
                device = common.PLUS if plus else common.XL if variant.startswith("xl") else common.MK2
                self.assertEqual(pkg["DeviceModel"], device.model)
                self.assertEqual(pkg["OSType"], "Mac" if mac else "Windows")
                self.assertEqual(set(pkg["RequiredPlugins"]), {HOTKEY, WEBSITE})
                roots = [n for n in names if n.endswith("/manifest.json") and n.count("/") == 2]
                self.assertEqual(len(roots), 1)
                root = json.loads(z.read(roots[0]))
                manifests = [n for n in names if n.endswith("/manifest.json") and n.count("/") == 4]
                self.assertEqual(len(manifests), 1)
                page_id = manifests[0].split("/")[-2]
                self.assertEqual(root["Pages"], {"Current": page_id, "Default": page_id, "Pages": [page_id]})
                page = json.loads(z.read(manifests[0]))
                self.assertEqual(page["Name"], "Resolve")
                self.assertEqual([c["Type"] for c in page["Controllers"]],
                                 ["Keypad", "Encoder"] if plus else ["Keypad"])
                self.assertEqual(check_marketplace_buttons(LITE_SLUG, [page], pkg["RequiredPlugins"], plus), [])
                keys = page["Controllers"][0]["Actions"]
                expected = PLUS if plus else STANDARD
                self.assertEqual(set(keys), set(expected) | {"3,0" if plus else "4,0"})
                for pos, (title, key, shift, ctrl) in expected.items():
                    action = keys[pos]
                    self.assertEqual(action["UUID"], HOTKEY)
                    self.assertEqual(action["Name"], title.replace("\n", " "))
                    self.assertEqual(action["States"][0]["Title"], title)
                    records = action["Settings"]["Hotkeys"]
                    self.assertEqual(len(records), 4)
                    self.check_hotkey(records[0], key, shift, ctrl, mac)
                    self.assertTrue(all(r["VKeyCode"] == -1 for r in records[1:]))
                actions = list(keys.values())
                if plus:
                    dials = page["Controllers"][1]["Actions"]
                    self.assertEqual(set(dials), {"0,0"})
                    dial = dials["0,0"]
                    self.assertEqual(dial["UUID"], HOTKEY)
                    self.assertEqual(dial["Name"], "Scrub")
                    self.assertEqual(dial["States"], [{"Title": "Scrub"}])
                    records = dial["Settings"]["Hotkeys"]
                    self.check_hotkey(records[0], "LEFT", False, False, mac)
                    self.check_hotkey(records[1], "RIGHT", False, False, mac)
                    self.assertTrue(all(r["VKeyCode"] == -1 for r in records[2:]))
                    actions.append(dial)
                used = {"black.png"}
                for action in actions:
                    used.update(Path(s["Image"]).name for s in action["States"] if s.get("Image"))
                    if action.get("Encoder"):
                        used.add(Path(action["Encoder"]["Icon"]).name)
                exported = {Path(n).name for n in names if n.endswith(".png")}
                self.assertEqual(exported, used, "No orphan icons, including removed controls")


class MarketplacePolicyTests(unittest.TestCase):
    def setUp(self):
        with archive("std_win") as z:
            page = next(n for n in z.namelist() if n.endswith("/manifest.json") and n.count("/") == 4)
            self.pages = [json.loads(z.read(page))]
        self.plugins = [HOTKEY, WEBSITE]

    def check(self, slug=LITE_SLUG):
        return check_marketplace_buttons(slug, self.pages, self.plugins, False)

    def test_specific_experiment_passes(self):
        self.assertEqual(self.check(), [])

    def test_other_profiles_cannot_link_even_to_this_pro(self):
        self.assertTrue(self.check("davinci-resolve-pro"))

    def test_arbitrary_product_storefront_and_url_suffixes_blocked(self):
        action = self.pages[0]["Controllers"][0]["Actions"]["4,0"]
        for url in ("https://marketplace.elgato.com/@packrat", PRO_URL + "?ad=1",
                    PRO_URL + "#fragment", PRO_URL.replace("https:", "http:"),
                    "https://marketplace.elgato.com/product/other"):
            with self.subTest(url=url):
                action["Settings"]["path"] = url
                self.assertTrue(self.check())

    def test_duplicate_key_blocked(self):
        keys = self.pages[0]["Controllers"][0]["Actions"]
        keys["4,2"] = copy.deepcopy(keys["4,0"])
        self.assertTrue(self.check())

    def test_extra_page_blocked(self):
        self.pages.append({"Controllers": [{"Type": "Keypad", "Actions": {}}]})
        self.assertTrue(self.check())

    def test_wrong_position_title_controller_or_missing_dependency_blocked(self):
        original = copy.deepcopy(self.pages)
        for defect in ("position", "title", "controller", "dependency", "missing"):
            with self.subTest(defect=defect):
                self.pages = copy.deepcopy(original)
                self.plugins = [HOTKEY, WEBSITE]
                ctl = self.pages[0]["Controllers"][0]
                if defect == "position":
                    ctl["Actions"]["4,2"] = ctl["Actions"].pop("4,0")
                elif defect == "title":
                    ctl["Actions"]["4,0"]["States"][0]["Title"] = "Store"
                elif defect == "controller":
                    ctl["Type"] = "Encoder"
                elif defect == "dependency":
                    self.plugins.remove(WEBSITE)
                else:
                    del ctl["Actions"]["4,0"]
                self.assertTrue(self.check())


class LiteMarketingTests(unittest.TestCase):
    def test_art_uses_shipped_faces_and_layouts(self):
        import gen_marketing as gm
        cfg = gm.davinci_lite_cfg()
        self.assertFalse(cfg["logo_img"])
        variants = {"mk2_v3": ("std_win", 5), "xl_v3": ("xl_win", 8),
                    "plus_v3": ("plus_win", 4)}
        allowed = {v[0].replace("\n", " ") for v in STANDARD.values()} | {"Get Pro"}
        for device, grid, _, *strip in cfg["hero_lineup"]:
            variant, cols = variants[device]
            with archive(variant) as z:
                path = next(n for n in z.namelist() if n.endswith("/manifest.json") and n.count("/") == 4)
                page = json.loads(z.read(path))
                keys = page["Controllers"][0]["Actions"]
                self.assertEqual(sum(bool(s.get("label")) for s in grid), len(keys))
                for pos, action in keys.items():
                    col, row = map(int, pos.split(","))
                    spec = grid[row * cols + col]
                    self.assertEqual(spec["label"], action["States"][0]["Title"].replace("\n", " "))
                    self.assertIn(spec["label"], allowed)
            if device == "plus_v3":
                self.assertEqual(strip, [["Scrub", "", "", ""]])
        for _, specs, *_ in cfg["feature_banners"]:
            self.assertTrue(all(s["label"] in allowed for s in specs))
        for _, specs in cfg["video_scenes"]:
            self.assertTrue(all(s["label"] in allowed for s in specs))

    def test_listing_regenerates_without_stale_copy(self):
        import gen_marketing as gm
        # Use the workspace: this Windows sandbox denies writes in system temp.
        out = ROOT / "data" / f"davinci-copy-test-{uuid4().hex}"
        out.mkdir()
        try:
            gm.me.write_description(gm.davinci_lite_cfg(), str(out))
            gm.inject_compat(LITE_SLUG, out)
            gm.append_release_notes(LITE_SLUG, out)
            generated = (out / "description.txt").read_text(encoding="utf-8")
        finally:
            (out / "description.txt").unlink(missing_ok=True)
            out.rmdir()
        live = ROOT / PROD["paths"]["marketing"] / "description.txt"
        self.assertEqual(generated, live.read_text(encoding="utf-8"))
        listing = generated.split("-" * 40)[0].strip()
        self.assertTrue(250 <= len(listing) <= 4000)
        self.assertNotIn("\u2014", generated)
        self.assertNotIn("\u2013", generated)
        self.assertIn("Five Resolve keys", listing)
        self.assertIn("exactly one Scrub dial", listing)
        self.assertIn("v1.1.0", generated)


if __name__ == "__main__":
    unittest.main()
