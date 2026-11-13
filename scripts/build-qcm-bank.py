#!/usr/bin/env python3
"""Extract answerable QCM from the locally mirrored MedShake HTML pages."""

import json
import re
from pathlib import Path
from lxml import html
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data" / "annales"
OUTPUT = ROOT / "src" / "data" / "annales-qcm.json"
MEDIA = ROOT / "public" / "annales-media"


def clean(value):
    return re.sub(r"\s+", " ", value or "").strip()


def parse(path):
    session = path.stem[:-4]
    document = html.fromstring(path.read_bytes())
    result = []
    for block in document.xpath('//div[contains(concat(" ", normalize-space(@class), " "), " qcm ")]'):
        item_text = clean(" ".join(block.xpath('./text()')))
        match = re.search(r"Question\s+n[°º]\s*(\d+)\s*-\s*Réponse\s+(simple|multiple)", item_text, re.I)
        if not match:
            continue
        number = int(match.group(1))
        ol = block.xpath('.//ol[contains(@class, "repQCM")]')
        if not ol:
            continue
        options = []
        correct = []
        for li in ol[0].xpath('./li'):
            option_text = clean(li.text_content())
            option = re.match(r"^([A-E])\s*-\s*(.+)$", option_text)
            if not option:
                continue
            option_id, text = option.groups()
            options.append({"id": option_id, "text": text})
            if "repOk" in li.get("class", "").split():
                correct.append(option_id)
        stem = clean(re.sub(r"^Question\s+n[°º]\s*\d+\s*-\s*Réponse\s+(?:simple|multiple)", "", item_text, count=1, flags=re.I))
        if len(options) != 5 or not correct or not stem:
            continue
        images = block.xpath('.//img[@src]')
        image_url = ""
        if images:
            source = images[0].get("src")
            filename = Path(source).name
            image_url = f"/annales-media/{filename}"
            target = MEDIA / filename
            if not target.exists():
                MEDIA.mkdir(parents=True, exist_ok=True)
                request = Request(f"https://www.medshake.net{source}", headers={"User-Agent": "Nouky personal study archive/1.0"})
                with urlopen(request, timeout=30) as response:
                    target.write_bytes(response.read())
        result.append({
            "id": f"{session}-q{number}", "sessionId": session, "sourceQuestion": number,
            "sourceUrl": f"https://www.medshake.net/pharmacie/concours-internat/annales/qcm/voir/{session}/{number}/",
            "type": f"qcm_{match.group(2).lower()}", "text": stem,
            "imageUrl": image_url,
            "options": options, "correctOptionIds": correct,
            "expectedAnswer": ", ".join(correct),
            "explanation": f"Grille officielle de l'annale {session} : {', '.join(correct)}.",
            "grading": [{"item": "Réponse exacte", "points": 1}],
            "relatedLeitnerSkills": [f"annales.qcm.{session}.q{number}"],
        })
    return result


def main():
    bank = {}
    for path in sorted(SOURCE.glob("*-qcm.html")):
        questions = parse(path)
        bank[path.stem[:-4]] = questions
        print(f"{path.name}: {len(questions)} QCM")
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(bank, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(f"Total: {sum(map(len, bank.values()))} QCM")


if __name__ == "__main__":
    main()
