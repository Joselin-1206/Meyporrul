import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

import server
sys.path.insert(0, str(ROOT / "scripts"))
from import_project_madurai import parse_readings


class VerificationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        server.initialize_database()

    def test_corpus_count_and_number_lookup(self):
        self.assertEqual(len(server.all_kurals()), 1330)
        self.assertEqual(server.get_kural(1)["number"], 1)
        self.assertIsNone(server.get_kural(0))

    def test_exact_quote_and_spacing_format(self):
        quote = server.get_kural(1)["couplet"]
        self.assertEqual(server.verify(quote)["kind"], "exact")
        self.assertEqual(server.verify(quote.replace(" ", "  "))["kind"], "format")

    def test_partial_altered_and_unknown(self):
        quote = server.get_kural(1)["couplet"]
        self.assertEqual(server.verify(quote.splitlines()[0])["kind"], "partial")
        self.assertEqual(server.verify(quote.replace("ஆதி", "அறிவே"))["kind"], "altered")
        self.assertEqual(server.verify("இது ஒரு முற்றிலும் வேறான தமிழ் வாக்கியம்")["kind"], "not-found")

    def test_insufficient_evidence(self):
        self.assertEqual(server.verify("அறம்")["kind"], "insufficient")

    def test_gate_does_not_approve_when_no_quote_was_detected(self):
        result = server.evaluate_gate("இந்த பதிலில் மேற்கோள் இல்லை.")
        self.assertFalse(result["approved"])
        self.assertEqual(result["quoteCount"], 0)

    def test_manual_quote_cannot_certify_unrelated_draft(self):
        quote = server.get_kural(1)["couplet"]
        result = server.evaluate_gate("யாதும் ஊரே யாவரும் கேளிர்.", quote)
        self.assertFalse(result["approved"])
        self.assertEqual(result["reason"], "selected_quote_not_in_draft")

    def test_manual_quote_in_draft_is_only_selected_quote_verified(self):
        quote = server.get_kural(1)["couplet"]
        result = server.evaluate_gate(f"இதோ மேற்கோள்: “{quote}”", quote)
        self.assertFalse(result["approved"])
        self.assertTrue(result["selectedQuoteVerified"])

    def test_auto_gate_approves_only_detected_verified_quotes(self):
        quote = server.get_kural(1)["couplet"]
        result = server.evaluate_gate(f"மேற்கோள்: “{quote}”")
        self.assertTrue(result["approved"])
        self.assertEqual(result["quoteCount"], 1)

    def test_witness_report_marks_number_conflict_without_rewriting_source(self):
        with server.connect() as db:
            db.execute("INSERT OR REPLACE INTO editions(id,name,source_url,attribution,license_note) VALUES(?,?,?,?,?)",
                       ("test-witness", "Test source", "https://example.invalid", "test fixture", "test only"))
            verse72 = server.get_kural(72)
            db.execute("INSERT OR REPLACE INTO edition_verses(edition_id,number,printed_number,occurrence,line1,line2,couplet,source_locator) VALUES(?,?,?,?,?,?,?,?)",
                       ("test-witness", 71, "71", 1, verse72["line1"], verse72["line2"], verse72["couplet"], "test row"))
        report = server.witness_report(71)
        witness = next(row for row in report["editions"] if row["editionId"] == "test-witness")
        self.assertEqual(witness["readings"][0]["status"], "number-conflict")
        self.assertEqual(witness["readings"][0]["alsoMatchesNumbers"], [72])
        self.assertEqual(witness["readings"][0]["printedNumber"], "71")
        with server.connect() as db:
            db.execute("INSERT OR REPLACE INTO edition_verses(edition_id,number,printed_number,occurrence,line1,line2,couplet,source_locator) VALUES(?,?,?,?,?,?,?,?)",
                       ("test-witness", 72, "71", 1, verse72["line1"], verse72["line2"], verse72["couplet"], "literal label mismatch"))
        report = server.witness_report(72)
        witness = next(row for row in report["editions"] if row["editionId"] == "test-witness")
        self.assertEqual(witness["readings"][0]["status"], "number-conflict")
        with server.connect() as db:
            db.execute("DELETE FROM edition_verses WHERE edition_id='test-witness'")
            db.execute("DELETE FROM editions WHERE id='test-witness'")

    def test_project_madurai_parser_preserves_repeated_printed_numbers(self):
        html = """<html><h2>திருக்குறள்</h2><p>அன்பிற்கும் உண்டோ அடைக்குந்தாழ்<br>ஆர்வலர் புன்கணீர் பூசல் தரும். &nbsp; 71</p><p>அன்பிலார் எல்லாம் தமக்குரியர் அன்புடையார்<br>என்பும் உரியர் பிறர்க்கு. &nbsp; 71</p></html>"""
        reference_index = {
            server.normalize(server.get_kural(71)["couplet"], loose=True): [71],
            server.normalize(server.get_kural(72)["couplet"], loose=True): [72],
        }
        readings = parse_readings(html, reference_index)
        self.assertEqual([row["number"] for row in readings], [71, 72])
        self.assertEqual([row["printed_number"] for row in readings], ["71", "71"])
        self.assertEqual([row["occurrence"] for row in readings], [1, 1])
        self.assertIn("அன்பிலார்", readings[1]["couplet"])

    def test_parser_maps_oversized_source_label_by_verse_text_without_rewriting_label(self):
        verse = server.get_kural(781)
        html = f"<p>{verse['line1']}<br>{verse['line2']} 7811</p>"
        index = {server.normalize(verse["couplet"], loose=True): [781]}
        readings = parse_readings(html, index)
        self.assertEqual(len(readings), 1)
        self.assertEqual(readings[0]["number"], 781)
        self.assertEqual(readings[0]["printed_number"], "7811")


if __name__ == "__main__":
    unittest.main()
