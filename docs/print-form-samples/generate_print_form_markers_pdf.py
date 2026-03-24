from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas


def draw_page_header(c, title):
    width, height = A4
    c.setFont("Helvetica-Bold", 14)
    c.drawString(40, height - 40, title)
    c.setFont("Helvetica", 10)
    c.drawString(40, height - 58, "Example markers for print-form template recognition")
    c.line(40, height - 64, width - 40, height - 64)


def page_1(c):
    width, height = A4
    draw_page_header(c, "Page 1: Single parameters + legacy placeholders")

    y = height - 100
    c.setFont("Helvetica", 11)
    c.drawString(40, y, "Document date: {p:Today}")
    y -= 20
    c.drawString(40, y, "Contract number: {p:AgreementBB}")
    y -= 20
    c.drawString(40, y, "Customer: {p:BusinessPartnerAccountName}")
    y -= 20
    c.drawString(40, y, "Total amount, USD: {p:TotalRefundAmount}")
    y -= 20
    c.drawString(40, y, "Signer: {p:ResponseSignerName}")
    y -= 20
    c.drawString(40, y, "Signer position: {p:SignerPosition}")
    y -= 35

    c.setFont("Helvetica-Bold", 11)
    c.drawString(40, y, "Legacy placeholders (auto treat as single):")
    y -= 20
    c.setFont("Helvetica", 11)
    c.drawString(40, y, "Legacy date: {Today}")
    y -= 20
    c.drawString(40, y, "Legacy contract: {AgreementBB}")


def page_2(c):
    width, height = A4
    draw_page_header(c, "Page 2: Table section markers")

    y = height - 100
    c.setFont("Helvetica", 11)
    c.drawString(40, y, "Table section begin marker: {t:ClaimItems:start}")
    y -= 24

    table_left = 40
    table_right = width - 40
    header_y = y
    row_h = 22

    c.line(table_left, header_y + 8, table_right, header_y + 8)
    c.line(table_left, header_y - row_h, table_right, header_y - row_h)

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
    c.drawString(50, row1_y, "{r:ClaimItems.ItemNo}")
    c.drawString(100, row1_y, "{r:ClaimItems.ProductName}")
    c.drawString(230, row1_y, "{r:ClaimItems.WeightNet}")
    c.drawString(340, row1_y, "{r:ClaimItems.RefundAmount}")

    row2_y = row1_y - row_h
    c.drawString(50, row2_y, "{r:ClaimItems.ItemNo}")
    c.drawString(100, row2_y, "{r:ClaimItems.ProductName}")
    c.drawString(230, row2_y, "{r:ClaimItems.WeightNet}")
    c.drawString(340, row2_y, "{r:ClaimItems.RefundAmount}")

    y = header_y - row_h * 3 - 24
    c.setFont("Helvetica", 11)
    c.drawString(40, y, "Table section end marker: {t:ClaimItems:end}")
    y -= 24
    c.drawString(40, y, "Additional footer field: {p:FooterNote}")


def page_3(c):
    width, height = A4
    draw_page_header(c, "Page 3: Mixed multiple tables")

    y = height - 100
    c.setFont("Helvetica", 11)
    c.drawString(40, y, "{t:Invoices:start}")
    y -= 20
    c.drawString(50, y, "{r:Invoices.DocNo}  {r:Invoices.DocDate}  {r:Invoices.Amount}")
    y -= 20
    c.drawString(50, y, "{r:Invoices.DocNo}  {r:Invoices.DocDate}  {r:Invoices.Amount}")
    y -= 20
    c.drawString(40, y, "{t:Invoices:end}")
    y -= 32

    c.drawString(40, y, "{t:Shipments:start}")
    y -= 20
    c.drawString(50, y, "{r:Shipments.BatchNo}  {r:Shipments.Weight}  {r:Shipments.Warehouse}")
    y -= 20
    c.drawString(50, y, "{r:Shipments.BatchNo}  {r:Shipments.Weight}  {r:Shipments.Warehouse}")
    y -= 20
    c.drawString(40, y, "{t:Shipments:end}")
    y -= 28

    c.drawString(40, y, "Document author: {p:PreparedBy}")
    y -= 20
    c.drawString(40, y, "Approval date: {p:ApprovedAt}")


def main():
    output_path = "/Users/roman/Documents/Cursor/adminka/docs/print-form-samples/print-form-markers-sample.pdf"
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
