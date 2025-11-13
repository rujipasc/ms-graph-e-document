#!/usr/bin/env python3
"""
Utility script to re-save PDF files without encryption.
Usage: python3 scripts/resave_pdf.py <input.pdf> <output.pdf>
Depends on either `pypdf` (preferred) or `PyPDF2`.
"""

import sys
from pathlib import Path

CRYPTO_DEP_MSG = (
    "cryptography>=3.1 is required to decrypt AES-protected PDFs. "
    "Install it inside your project virtualenv with `pip install cryptography`."
)


def _ensure_crypto_backend():
    try:
        import cryptography  # type: ignore  # noqa: F401
    except ModuleNotFoundError as err:
        raise RuntimeError(CRYPTO_DEP_MSG) from err


def _load_pdf_reader(source_path):
    try:
        from pypdf import PdfReader  # type: ignore
    except ModuleNotFoundError:
        try:
            from PyPDF2 import PdfReader  # type: ignore
        except ModuleNotFoundError as err:
            raise RuntimeError(
                "Neither `pypdf` nor `PyPDF2` is installed. "
                "Install one of them to enable PDF re-saving."
            ) from err

    reader = PdfReader(source_path)
    if getattr(reader, "is_encrypted", False):
        _ensure_crypto_backend()
        # Attempt common empty-password decrypt flows.
        decrypted = False
        for password in ("", b"", None):
            try:
                result = reader.decrypt(password)  # type: ignore[arg-type]
            except TypeError:
                # Older PyPDF2 expects str, so skip bytes.
                continue
            if result not in (False, 0):
                decrypted = True
                break
        if not decrypted and reader.is_encrypted:
            raise RuntimeError(
                f"Unable to decrypt '{source_path}'. Provide a password or re-export the file."
            )
    return reader


def _add_metadata(writer, metadata):
    if not metadata:
        return
    sanitized = {}
    for key, value in metadata.items():
        if isinstance(key, str) and isinstance(value, str):
            sanitized[key] = value
    if sanitized:
        writer.add_metadata(sanitized)


def resave_pdf(source, target):
    try:
        from pypdf import PdfWriter  # type: ignore
    except ModuleNotFoundError:
        try:
            from PyPDF2 import PdfWriter  # type: ignore
        except ModuleNotFoundError as err:
            raise RuntimeError(
                "Neither `pypdf` nor `PyPDF2` is installed. "
                "Install one of them to enable PDF re-saving."
            ) from err

    reader = _load_pdf_reader(source)
    writer = PdfWriter()
    for page in reader.pages:
        writer.add_page(page)
    _add_metadata(writer, getattr(reader, "metadata", {}) or {})
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open("wb") as fh:
        writer.write(fh)


def main(argv):
    if len(argv) != 3:
        raise SystemExit(
            "Usage: python3 scripts/resave_pdf.py <input.pdf> <output.pdf>"
        )
    source = Path(argv[1]).expanduser().resolve()
    target = Path(argv[2]).expanduser().resolve()
    if not source.is_file():
        raise SystemExit(f"Source PDF not found: {source}")
    resave_pdf(source, target)


if __name__ == "__main__":
    try:
        main(sys.argv)
    except Exception as exc:  # pragma: no cover - CLI helper
        print(f"[resave_pdf] ERROR: {exc}", file=sys.stderr)
        sys.exit(1)
