import base64
import json
import os
import re
import smtplib
import tempfile
from datetime import datetime
from email.message import EmailMessage
from email.utils import formataddr
from html import escape
from http.server import BaseHTTPRequestHandler
from io import BytesIO

from PIL import Image
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    Image as ReportLabImage,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

DEFAULT_RECIPIENT = "gomeserosiane.dev@gmail.com"


def clean_text(value, fallback="Não informado"):
    text = re.sub(r"\s+", " ", str(value or "")).strip()
    return text or fallback


def safe_filename(value):
    text = clean_text(value, "cadastro").lower()
    text = re.sub(r"[^a-z0-9]+", "-", text, flags=re.I).strip("-")
    return text or "cadastro"


def parse_json_body(handler):
    length = int(handler.headers.get("content-length", 0))
    raw = handler.rfile.read(length).decode("utf-8") if length else "{}"
    return json.loads(raw or "{}")


def recipient_list(extra_from_payload=None):
    values = [os.environ.get("EMAIL_TO", DEFAULT_RECIPIENT)]
    if os.environ.get("EMAIL_EXTRA_TO"):
        values.append(os.environ["EMAIL_EXTRA_TO"])
    if extra_from_payload:
        values.extend(extra_from_payload)

    recipients = []
    for item in values:
        if isinstance(item, list):
            candidates = item
        else:
            candidates = str(item).split(",")
        for candidate in candidates:
            email = candidate.strip()
            if email and email not in recipients:
                recipients.append(email)
    return recipients or [DEFAULT_RECIPIENT]


def make_styles():
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(
        name="PremiumTitle",
        parent=styles["Title"],
        fontName="Helvetica-Bold",
        fontSize=22,
        leading=26,
        textColor=colors.white,
        spaceAfter=8,
    ))
    styles.add(ParagraphStyle(
        name="PremiumSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#E2E8F0"),
    ))
    styles.add(ParagraphStyle(
        name="SectionTitle",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=16,
        textColor=colors.HexColor("#0A2A4E"),
        spaceBefore=14,
        spaceAfter=8,
    ))
    styles.add(ParagraphStyle(
        name="Label",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor("#64748B"),
    ))
    styles.add(ParagraphStyle(
        name="Value",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9.5,
        leading=12,
        textColor=colors.HexColor("#0F172A"),
    ))
    styles.add(ParagraphStyle(
        name="Identity",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=15,
        leading=19,
        textColor=colors.HexColor("#0F172A"),
    ))
    styles.add(ParagraphStyle(
        name="SmallMuted",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#475569"),
    ))
    return styles


def header_canvas(canvas, doc):
    canvas.saveState()
    width, height = A4
    canvas.setFillColor(colors.HexColor("#0A2A4E"))
    canvas.rect(0, height - 35 * mm, width, 35 * mm, stroke=0, fill=1)
    canvas.setFillColor(colors.HexColor("#94A3B8"))
    canvas.setFont("Helvetica", 8)
    canvas.drawRightString(width - 18 * mm, 11 * mm, f"Página {doc.page}")
    canvas.restoreState()


def signature_flowable(signature_data):
    if not signature_data or not signature_data.startswith("data:image"):
        return None
    try:
        encoded = signature_data.split(",", 1)[1]
        raw = base64.b64decode(encoded)
        image = Image.open(BytesIO(raw)).convert("RGBA")
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".png")
        image.save(tmp.name, "PNG")
        tmp.close()
        return ReportLabImage(tmp.name, width=80 * mm, height=28 * mm)
    except Exception:
        return None


def generate_pdf(payload):
    identity = payload.get("identity") or {}
    name = clean_text(identity.get("name"))
    form_type = clean_text(identity.get("formType"), "Ficha de cadastro")
    document_label = clean_text(identity.get("documentLabel"), "Documento")
    document_number = clean_text(identity.get("documentNumber"))
    created_at = clean_text(payload.get("localeDate"), datetime.now().strftime("%d/%m/%Y %H:%M"))
    styles = make_styles()
    buffer = BytesIO()

    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=18 * mm,
        leftMargin=18 * mm,
        topMargin=16 * mm,
        bottomMargin=18 * mm,
        title=f"Novo cadastro - {name}",
        author="Ficha Oral Blue",
    )

    story = []
    header = Table([
        [Paragraph("Novo cadastro", styles["PremiumTitle"])],
        [Paragraph(f"{escape(form_type)}<br/>Gerado em {escape(created_at)}", styles["PremiumSubtitle"])],
    ], colWidths=[174 * mm])
    header.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#0A2A4E")),
        ("LEFTPADDING", (0, 0), (-1, -1), 10 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10 * mm),
        ("TOPPADDING", (0, 0), (-1, -1), 8 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8 * mm),
    ]))
    story.append(header)
    story.append(Spacer(1, 9 * mm))
    story.append(Paragraph(escape(name), styles["Identity"]))
    story.append(Paragraph(f"{escape(document_label)}: {escape(document_number)}", styles["SmallMuted"]))
    story.append(Spacer(1, 5 * mm))

    for section in payload.get("sections") or []:
        rows = section.get("rows") or []
        if not rows:
            continue
        story.append(Paragraph(escape(clean_text(section.get("title"), "Informações")), styles["SectionTitle"]))
        table_rows = []
        for row in rows:
            label = escape(clean_text(row.get("label"), "Campo"))
            value = escape(clean_text(row.get("value")))
            table_rows.append([Paragraph(label, styles["Label"]), Paragraph(value, styles["Value"])])
        table = Table(table_rows, colWidths=[48 * mm, 126 * mm], hAlign="LEFT")
        table.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#E2E8F0")),
            ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F8FAFC")),
            ("LEFTPADDING", (0, 0), (-1, -1), 5),
            ("RIGHTPADDING", (0, 0), (-1, -1), 5),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ]))
        story.append(table)

    signature = signature_flowable(payload.get("signatureImage"))
    if signature:
        story.append(Spacer(1, 8 * mm))
        story.append(Paragraph("Assinatura digital", styles["SectionTitle"]))
        sig_table = Table([[signature]], colWidths=[90 * mm])
        sig_table.setStyle(TableStyle([
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
            ("BACKGROUND", (0, 0), (-1, -1), colors.white),
            ("LEFTPADDING", (0, 0), (-1, -1), 5 * mm),
            ("RIGHTPADDING", (0, 0), (-1, -1), 5 * mm),
            ("TOPPADDING", (0, 0), (-1, -1), 5 * mm),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5 * mm),
        ]))
        story.append(sig_table)

    doc.build(story, onFirstPage=header_canvas, onLaterPages=header_canvas)
    buffer.seek(0)
    filename = f"{safe_filename(form_type)}-{safe_filename(name)}.pdf"
    message = f"Novo cadastro! Nome: {name} e {document_label}: {document_number}"
    subject = f"Novo cadastro - {name}"
    return buffer.read(), filename, subject, message


def send_email(pdf_bytes, filename, subject, message, recipients):
    email_user = os.environ.get("EMAIL_USER")
    email_password = os.environ.get("EMAIL_PASSWORD")
    from_name = os.environ.get("EMAIL_FROM_NAME", "Ficha Oral Blue")

    if not email_user or not email_password:
        raise RuntimeError("Configure EMAIL_USER e EMAIL_PASSWORD nas variáveis de ambiente da Vercel.")

    msg = EmailMessage()
    msg["From"] = formataddr((from_name, email_user))
    msg["To"] = ", ".join(recipients)
    msg["Subject"] = subject
    msg.set_content(message)
    msg.add_alternative(f"""
    <div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.5">
      <h2 style="margin:0 0 12px;color:#0A2A4E">Novo cadastro recebido</h2>
      <p>{escape(message)}</p>
      <p>O PDF completo está anexado a este email.</p>
    </div>
    """, subtype="html")
    msg.add_attachment(pdf_bytes, maintype="application", subtype="pdf", filename=filename)

    with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=30) as smtp:
        smtp.login(email_user, email_password)
        smtp.send_message(msg)


class handler(BaseHTTPRequestHandler):
    def _send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self._send_json(200, {"success": True})

    def do_POST(self):
        try:
            payload = parse_json_body(self)
            pdf_bytes, filename, subject, message = generate_pdf(payload)
            recipients = recipient_list(payload.get("extraRecipients"))
            send_email(pdf_bytes, filename, subject, message, recipients)
            self._send_json(200, {
                "success": True,
                "message": message,
                "filename": filename,
                "recipients": recipients,
            })
        except Exception as error:
            self._send_json(500, {"success": False, "error": str(error)})
