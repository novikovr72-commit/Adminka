from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


def resolve_font():
    candidates = [
        "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/Library/Fonts/Arial Unicode.ttf",
        "/Library/Fonts/Arial.ttf",
    ]
    for candidate in candidates:
        if Path(candidate).exists():
            pdfmetrics.registerFont(TTFont("TemplateFont", candidate))
            return "TemplateFont"
    return "Helvetica"


def main():
    output_path = "/Users/roman/Documents/Cursor/adminka/docs/print-form-samples/claim-trading-filled-example.pdf"
    font_name = resolve_font()
    c = canvas.Canvas(output_path, pagesize=A4)
    width, height = A4

    left = 40
    right_block_x = width - 250
    y = height - 40

    # Logo block (vector placeholder style for NLMK)
    logo_x = left
    logo_y_top = y + 10
    logo_w = 86
    logo_h = 34
    c.setStrokeColor(colors.HexColor("#0E5AA7"))
    c.setLineWidth(1.2)
    c.rect(logo_x, logo_y_top - logo_h, logo_w, logo_h, stroke=1, fill=0)
    c.setFont("Helvetica-Bold", 16)
    c.setFillColor(colors.HexColor("#0E5AA7"))
    c.drawCentredString(logo_x + logo_w / 2, logo_y_top - 24, "NLMK")
    c.setFillColor(colors.black)

    c.setFont(font_name, 11)
    c.drawString(left + logo_w + 12, y, "NLMK Turkey Çelik Ticaret A.Ş.")
    y -= 18
    c.drawString(
        left + logo_w + 12,
        y,
        "Address : Esentepe Mh. Harman 1 Sk. Nidakule Levent No: 7-9 K:21 D:63 Şişli 34394 İstanbul, Türkiye",
    )
    y -= 16
    c.drawString(left + logo_w + 12, y, "Phone   : +90 (212) 803 71 34")
    y -= 16
    c.drawString(left + logo_w + 12, y, "Fax     : +90 (212) 803 71 16")
    y -= 20

    # Counterparty block on the right side, opposite company header block.
    right_y = height - 40
    c.drawString(right_block_x, right_y, "NOVOLIPETSK STEEL (PAO NLMK)")
    right_y -= 16
    c.drawString(right_block_x, right_y, "2, Metallurgov sq., Lipetsk, 398040")
    right_y -= 16
    c.drawString(right_block_x, right_y, "The Russian Federation.")
    right_y -= 16
    c.drawString(right_block_x, right_y, "ПАО «НЛМК»")
    right_y -= 16
    c.drawString(right_block_x, right_y, "Площадь металлургов 2, Липецк 398040")
    right_y -= 16
    c.drawString(right_block_x, right_y, "Российская Федерация")

    y = min(y, right_y) - 18

    c.drawString(left, y, "Istanbul, 16.03.2026")
    y -= 26

    c.setFont(font_name, 12)
    c.drawString(left, y, "Кас. претензии по контракту")
    y -= 18
    c.drawString(left, y, "№ TRD-2026-0147")
    y -= 18
    c.drawString(left, y, "на сумму 18,450.00 USD")
    y -= 28

    c.setFont(font_name, 11)
    c.drawString(left, y, "Уважаемые господа!")
    y -= 20
    c.drawString(
        left,
        y,
        "Настоящим сообщаю, что клиентом (компания METAL TRADE PARTNER LLC) заявлена",
    )
    y -= 16
    c.drawString(left, y, "претензия в отношении металлопродукции, отгруженной по вышеуказанному")
    y -= 16
    c.drawString(left, y, "контракту:")
    y -= 22

    c.drawString(left, y, "Причины претензии – Surface quality issue / edge cracking.")
    y -= 20
    c.drawString(left, y, "Сумма претензии в отношении 21.800 т металла составляет")
    y -= 16
    c.drawString(left, y, "18,450.00 USD.")
    y -= 22
    c.drawString(left, y, "Идентификационные данные проблемного металла и подтверждающие")
    y -= 16
    c.drawString(left, y, "претензионные материалы прилагаются.")
    y -= 20
    c.drawString(left, y, "Прошу сообщить свое мнение по данной претензии.")
    y -= 34

    c.drawString(left, y, "С уважением,")
    y -= 22
    c.drawString(left, y, "Head of Claims Department")
    c.drawString(left + 260, y, "Ivan Petrov")

    c.save()
    print(output_path)


if __name__ == "__main__":
    main()
