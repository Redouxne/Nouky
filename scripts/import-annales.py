#!/usr/bin/env python3
"""Mirror the public MedShake internat annales listed on its index page."""

import concurrent.futures
import hashlib
import json
import re
import time
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "data" / "annales"
INDEX = "https://www.medshake.net/pharmacie/concours-internat/annales/"
PDF = re.compile(r"/pdf/(dossiers|exercices)(\d{4}(?:-(?:nord|sud))?)\.pdf$")
QCM = re.compile(r"/qcm/voir/(\d{4}(?:-(?:nord|sud))?)/$")


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.urls = []

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            href = dict(attrs).get("href")
            if href:
                self.urls.append(urljoin(INDEX, href))


def fetch(url):
    request = Request(url, headers={"User-Agent": "Nouky personal study archive/1.0"})
    with urlopen(request, timeout=40) as response:
        return response.read(), response.headers.get_content_type()


def download(item):
    path = DEST / item["file"]
    if path.exists() and path.stat().st_size > 100:
        content = path.read_bytes()
    else:
        for attempt in range(3):
            try:
                content, content_type = fetch(item["url"])
                expected = "application/pdf" if item["type"] != "qcm" else "text/html"
                if content_type != expected or (item["type"] != "qcm" and not content.startswith(b"%PDF")):
                    raise ValueError(f"Unexpected content type {content_type}")
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(content)
                break
            except Exception:
                if attempt == 2:
                    raise
                time.sleep(1 + attempt * 2)
    return {**item, "bytes": len(content), "sha256": hashlib.sha256(content).hexdigest()}


def main():
    index, _ = fetch(INDEX)
    parser = Links()
    parser.feed(index.decode("utf-8", "replace"))
    items = {}
    for url in parser.urls:
        path = urlparse(url).path
        pdf = PDF.search(path)
        qcm = QCM.search(path)
        if pdf:
            kind, session = pdf.groups()
            ext = "pdf"
        elif qcm:
            session = qcm.group(1)
            kind, ext = "qcm", "html"
        else:
            continue
        item_id = f"{session}-{kind}"
        items[item_id] = {"id": item_id, "sessionId": session, "type": kind,
                          "url": url, "file": f"{item_id}.{ext}"}
    DEST.mkdir(parents=True, exist_ok=True)
    (DEST / "source-index.html").write_bytes(index)
    complete, failed = [], []
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        futures = {pool.submit(download, item): item for item in items.values()}
        for future in concurrent.futures.as_completed(futures):
            item = futures[future]
            try:
                result = future.result()
                complete.append(result)
                print(f"OK {result['id']} {result['bytes']} bytes", flush=True)
            except Exception as error:
                failed.append({"id": item["id"], "error": str(error)})
                print(f"FAIL {item['id']}: {error}", flush=True)
    manifest = {"source": INDEX, "importedAt": datetime.now(timezone.utc).isoformat(),
                "items": sorted(complete, key=lambda item: item["id"]), "failed": failed}
    (DEST / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    print(f"Imported {len(complete)}/{len(items)}; failed {len(failed)}")
    if failed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
