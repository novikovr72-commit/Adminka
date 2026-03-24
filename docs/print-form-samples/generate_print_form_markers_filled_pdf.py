from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas


def draw_page_header(c, title):
    width, height = A4
    c.setFont("Helvetica-Bold", 14)
    c.drawString(40, height - 40, title)
    c.setFont("Helvetica", 10)
    c.drawString(40, height - 58, "Filled example by recognized print-form markers")
    c.line(40, height - 64, width - 40, height - 64)


def page_1(c):
    width, height = A4
    draw_page_header(c, "Page 1: Filled single parameters")

    y = height - 100
    c.setFont("Helvetica", 11)
    c.drawString(40, y, "Document date: 2026-03-16")
    y -= 20
    c.drawString(40, y, "Contract number: TRD-2026-0147")
    y -= 20
    c.drawString(40, y, "Customer: METAL TRADE PARTNER LLC")
    y -= 20
    c.drawString(40, y, "Total amount, USD: 18,450.00")
    y -= 20
    c.drawString(40, y, "Signer: Ivan Petrov")
    y -= 20
    c.drawString(40, y, "Signer position: Head of Claims")
    y -= 35
    c.setFont("Helvetica-Bold", 11)
    c.drawString(40, y, "Legacy fields also filled:")
    y -= 20
    c.setFont("Helvetica", 11)
    c.drawString(40, y, "Legacy date: 2026-03-16")
    y -= 20
    c.drawString(40, y, "Legacy contract: TRD-2026-0147")


def page_2(c):
    width, height = A4
    draw_page_header(c, "Page 2: Filled ClaimItems table")

    y = height - 100
    c.setFont("Helvetica", 11)
    c.drawString(40, y, "Claim items table")
    y -= 24

    table_left = 40
    table_right = width - 40
    header_y = y
    row_h = 22

    c.line(table_left, header_y + 8, table_right, header_y + 8)
    c.line(table_left, header_y - row_h, table_right, header_y - row_h)
    c.line(table_left, header_y - row_h * 2, table_right, header_y - row_h * 2)
    c.line(table_left, header_y - row_h * 3, table_right, header_y - row_h * 3)

    col_x = [table_left, 90, 220, 330, table_right]
    for x in col_x:
        c.line(x, header_y + 8, x, header_y - row_h * 3)

    c.setFont("Helvetica-Bold", 10)
    c.drawString(50, header_y - 8, "No")
    c.drawString(100, header_y - 8, "Product")
    c.drawString(230, header_y - 8, "Weight")
    c.drawString(340, header_y - 8, "Refund USD")

    c.setFont("Helvetica", 10)
    row1_y = header_y - row_h - 8
    c.drawString(50, row1_y, "1")
    c.drawString(100, row1_y, "HRC 2.0x1250")
    c.drawString(230, row1_y, "12.500")
    c.drawString(340, row1_y, "6,200.00")

    row2_y = row1_y - row_h
    c.drawString(50, row2_y, "2")
    c.drawString(100, row2_y, "CRC 1.2x1000")
    c.drawString(230, row2_y, "9.300")
    c.drawString(340, row2_y, "4,650.00")

    y = header_y - row_h * 3 - 24
    c.setFont("Helvetica", 11)
    c.drawString(40, y, "Footer note: Inspection report attached.")


def page_3(c):
    width, height = A4
    draw_page_header(c, "Page 3: Filled mixed tables")

    y = height - 100
    c.setFont("Helvetica-Bold", 11)
    c.drawString(40, y, "Invoices")
    y -= 20
    c.setFont("Helvetica", 11)
    c.drawString(50, y, "INV-4471   2026-03-10   7,800.00")
    y -= 20
    c.drawString(50, y, "INV-4472   2026-03-11   10,650.00")
    y -= 30

    c.setFont("Helvetica-Bold", 11)
    c.drawString(40, y, "Shipments")
    y -= 20
    c.setFont("Helvetica", 11)
    c.drawString(50, y, "BATCH-901   11.200   WH-IST-01")
    y -= 20
    c.drawString(50, y, "BATCH-902   10.600   WH-IST-02")
    y -= 28

    c.drawString(40, y, "Document author: Marina Sidorova")
    y -= 20
    c.drawString(40, y, "Approval date: 2026-03-16")


def main():
    output_path = "/Users/roman/Documents/Cursor/adminka/docs/print-form-samples/print-form-markers-sample-filled.pdf"
    c = canvas.Canvas(output_path, pagesize=A4)
    page_1(c)
    c.showPage()
    page_2(c)
    c.showPage()
    page_3(c)
    c.showPage()
    c.save()
    print(output_path)


if __name__ == "__main__":
    main()
