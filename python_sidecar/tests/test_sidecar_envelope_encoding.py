import io
import json
import sys
import unittest
from contextlib import redirect_stdout
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from python_sidecar.main import print_envelope  # noqa: E402


class SidecarEnvelopeEncodingTests(unittest.TestCase):
    def test_print_envelope_is_safe_for_windows_code_pages(self) -> None:
        stream = io.StringIO()

        with redirect_stdout(stream):
            print_envelope(True, data={"word": "\u3044"})

        output = stream.getvalue()
        output.encode("cp1252")

        self.assertNotIn("\u3044", output)
        self.assertIn("\\u3044", output)
        self.assertEqual(json.loads(output)["data"]["word"], "\u3044")


if __name__ == "__main__":
    unittest.main()
